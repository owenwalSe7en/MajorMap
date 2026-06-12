import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "./supabase-client.js";
import {
  normalizeCourse,
  buildCourseGroupIdMap,
  type NormalizedCourse,
} from "./normalizers/courses.js";
import { normalizeProgram, type NormalizedProgram } from "./normalizers/programs.js";
import { normalizePrerequisites, type NormalizedPrereq } from "./normalizers/prerequisites.js";
import { normalizeRequirements, type RequirementItemDraft } from "./normalizers/requirements.js";
import { universityUuid, departmentUuid } from "./uuid.js";
import type { CoursedogCourse, CoursedogProgram } from "./schemas/coursedog.js";
import type { SchoolConfig } from "./schemas/school-config.js";

// Differentiated by row width: courses/programs carry multi-KB raw_data JSONB
// (PostgREST request bodies should stay under ~2 MB); prereqs and requirement
// items are narrow.
const BATCH_SIZES = {
  wide: 200,
  programs: 50,
  narrow: 1000,
} as const;

const IN_CHUNK = 200;
const FLIP_CHUNK = 100;

type ServiceClient = ReturnType<typeof createServiceClient>;

interface BatchResult {
  inserted: number;
  failures: string[];
}

export async function upsertBatch(
  supabase: ServiceClient,
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
  onConflict: string,
  batchSize: number,
): Promise<BatchResult> {
  let inserted = 0;
  const failures: string[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      const message = `${table} batch ${i / batchSize + 1}: ${error.message}`;
      console.error(`Error upserting to ${message}`);
      failures.push(message);
    } else {
      inserted += batch.length;
    }
  }
  return { inserted, failures };
}

// Plain INSERT — requirement_items has no natural unique key, so upserting
// would silently duplicate trees. Batches must stay sequential: parents-first
// ordering across batches is what keeps the self-FK satisfied.
async function insertBatch(
  supabase: ServiceClient,
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
  batchSize: number,
): Promise<BatchResult> {
  let inserted = 0;
  const failures: string[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      const message = `${table} batch ${i / batchSize + 1}: ${error.message}`;
      console.error(`Error inserting to ${message}`);
      failures.push(message);
      // FK ordering means later batches depend on earlier ones — stop here.
      break;
    }
    inserted += batch.length;
  }
  return { inserted, failures };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Mass-discontinuation circuit breaker: refuse to run the stale-marking diff
 * when the fetch yields suspiciously few rows vs. the live catalog — a
 * truncated response must never soft-delete the catalog platform-wide.
 */
export function staleMarkingAllowed(fetchedCount: number, currentActiveCount: number): boolean {
  if (currentActiveCount === 0) return true;
  return fetchedCount >= currentActiveCount * 0.9;
}

export function computeStaleDiff(
  dbRows: Array<{ id: string; is_discontinued: boolean }>,
  fetchedIds: Set<string>,
): { flag: string[]; restore: string[] } {
  const flag: string[] = [];
  const restore: string[] = [];
  for (const row of dbRows) {
    const present = fetchedIds.has(row.id);
    if (!present && !row.is_discontinued) flag.push(row.id);
    else if (present && row.is_discontinued) restore.push(row.id);
  }
  return { flag, restore };
}

async function markDiscontinued(
  supabase: ServiceClient,
  universityId: string,
  table: "courses" | "programs",
  fetchedIds: Set<string>,
): Promise<{ flagged: number; restored: number }> {
  // Page through this university's rows (ids only).
  const dbRows: Array<{ id: string; is_discontinued: boolean }> = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("id, is_discontinued")
      .eq("university_id", universityId)
      // Explicit order: unordered .range() over rows just rewritten by the
      // upsert can skip/duplicate rows across pages, perturbing the
      // circuit-breaker math below.
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed reading ${table} for stale diff: ${error.message}`);
    dbRows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const currentActive = dbRows.filter((r) => !r.is_discontinued).length;
  if (!staleMarkingAllowed(fetchedIds.size, currentActive)) {
    throw new Error(
      `Refusing stale-marking for ${table}: fetch returned ${fetchedIds.size} rows vs ` +
        `${currentActive} active in DB (<90%). The fetch looks truncated.`,
    );
  }

  const { flag, restore } = computeStaleDiff(dbRows, fetchedIds);

  for (const ids of chunk(flag, IN_CHUNK)) {
    const { error } = await supabase.from(table).update({ is_discontinued: true }).in("id", ids);
    if (error) throw new Error(`Failed flagging discontinued ${table}: ${error.message}`);
  }
  for (const ids of chunk(restore, IN_CHUNK)) {
    const { error } = await supabase.from(table).update({ is_discontinued: false }).in("id", ids);
    if (error) throw new Error(`Failed restoring ${table}: ${error.message}`);
  }

  return { flagged: flag.length, restored: restore.length };
}

interface RequirementWork {
  programId: string;
  setId: string;
  versionLabel: string;
  contentHash: string;
  items: RequirementItemDraft[];
}

export async function seed(school: SchoolConfig): Promise<void> {
  const supabase = createServiceClient();
  const rawDir = path.resolve(process.cwd(), "data/raw", school.slug);
  const allFailures: string[] = [];

  // Ordering guard: seeding a second school before the university-scoping
  // migration (and the scoped web deploy) is live would interleave catalogs
  // in every unscoped query. The migration added semester_plans.university_id
  // — its absence means this database is not ready for school #2.
  if (school.slug !== "utah") {
    const { error: guardError } = await supabase
      .from("semester_plans")
      .select("university_id")
      .limit(1);
    if (guardError) {
      throw new Error(
        `Refusing to seed "${school.slug}": the university-scoping migration ` +
          `(semester_plans.university_id) is not applied to this database. ` +
          `Apply migrations and deploy the scoped web app first. (${guardError.message})`,
      );
    }
  }

  // Read raw data
  const coursesPath = path.join(rawDir, "courses.json");
  const programsPath = path.join(rawDir, "programs.json");

  if (!fs.existsSync(coursesPath) || !fs.existsSync(programsPath)) {
    throw new Error(`Raw data not found at ${rawDir}. Run 'catalog:fetch' first.`);
  }

  const rawCourses: CoursedogCourse[] = JSON.parse(fs.readFileSync(coursesPath, "utf-8"));
  const rawPrograms: CoursedogProgram[] = JSON.parse(fs.readFileSync(programsPath, "utf-8"));

  console.log(`Loaded ${rawCourses.length} courses and ${rawPrograms.length} programs from disk`);

  // 1. Upsert university. The seed is authoritative over these config-derived
  // columns — hand edits to the row are overwritten on the next run.
  const universityId = universityUuid(school.slug);
  const { error: universityError } = await supabase.from("universities").upsert(
    {
      id: universityId,
      slug: school.slug,
      name: school.name,
      coursedog_school_id: school.coursedogSchoolId,
      catalog_url: school.catalogUrl,
    },
    { onConflict: "slug" },
  );
  if (universityError) {
    throw new Error(`Failed to upsert university: ${universityError.message}`);
  }
  console.log(`Upserted university: ${school.name}`);

  // 2. Extract and upsert departments
  const deptCodes = new Set<string>();
  for (const c of rawCourses) {
    for (const d of c.departments) deptCodes.add(d);
  }
  const departments = [...deptCodes].map((code) => ({
    id: departmentUuid(school.slug, code),
    university_id: universityId,
    code,
    name: code,
  }));
  const deptResult = await upsertBatch(
    supabase,
    "departments",
    departments,
    "university_id,code",
    BATCH_SIZES.narrow,
  );
  allFailures.push(...deptResult.failures);
  console.log(`Upserted ${deptResult.inserted} departments`);

  // 3. Pass 1: Normalize all courses, deduplicate by natural key, build courseGroupId map
  const allCourses: NormalizedCourse[] = rawCourses.map((raw) =>
    normalizeCourse(raw, school.slug, universityId),
  );

  // Deduplicate: keep last version per (subject_code, number) — Coursedog returns multiple versions
  const courseMap = new Map<string, NormalizedCourse>();
  for (const c of allCourses) {
    courseMap.set(`${c.subject_code}:${c.number}`, c);
  }
  const courses = [...courseMap.values()];
  console.log(`Normalized ${allCourses.length} → ${courses.length} unique courses`);

  const courseGroupIdMap = buildCourseGroupIdMap(allCourses); // use ALL for prereq lookup
  const validCourseIds = new Set(courses.map((c) => c.id));

  const courseResult = await upsertBatch(
    supabase,
    "courses",
    courses,
    "university_id,subject_code,number",
    BATCH_SIZES.wide,
  );
  allFailures.push(...courseResult.failures);
  console.log(`Upserted ${courseResult.inserted} courses`);

  // 4. Pass 2: Normalize prereqs using allCourses (pre-dedup) for correct 1:1 mapping
  const allPrereqs: NormalizedPrereq[] = [];
  const allWarnings: string[] = [];

  for (let i = 0; i < rawCourses.length; i++) {
    const raw = rawCourses[i];
    const courseId = allCourses[i].id; // use allCourses (same length as rawCourses)
    const { prereqs, warnings } = normalizePrerequisites(raw, courseId, courseGroupIdMap);
    allPrereqs.push(...prereqs);
    allWarnings.push(...warnings);
  }

  let prereqInserted = 0;
  if (allPrereqs.length > 0) {
    // Deduplicate prereqs by composite key and filter out FK violations
    const prereqMap = new Map<string, NormalizedPrereq>();
    for (const p of allPrereqs) {
      // Skip prereqs referencing courses that failed to insert
      if (!validCourseIds.has(p.course_id)) continue;
      if (p.prerequisite_course_id && !validCourseIds.has(p.prerequisite_course_id)) continue;

      const key = `${p.course_id}:${p.prerequisite_course_id ?? "null"}:${p.group_id}`;
      prereqMap.set(key, p);
    }
    const dedupedPrereqs = [...prereqMap.values()];
    console.log(`Filtered ${allPrereqs.length} → ${dedupedPrereqs.length} valid unique prereqs`);

    const prereqResult = await upsertBatch(
      supabase,
      "course_prerequisites",
      dedupedPrereqs,
      "course_id,prerequisite_course_id,group_id",
      BATCH_SIZES.narrow,
    );
    allFailures.push(...prereqResult.failures);
    prereqInserted = prereqResult.inserted;
    console.log(`Upserted ${prereqInserted} prerequisite rules`);
  }

  // 5. Normalize and upsert programs (deduplicate by slug)
  const allPrograms: NormalizedProgram[] = rawPrograms.map((raw) =>
    normalizeProgram(raw, school.slug, universityId),
  );
  const programMap = new Map<string, NormalizedProgram>();
  const rawBySlug = new Map<string, CoursedogProgram>();
  for (let i = 0; i < allPrograms.length; i++) {
    programMap.set(allPrograms[i].slug, allPrograms[i]);
    rawBySlug.set(allPrograms[i].slug, rawPrograms[i]);
  }
  const programs = [...programMap.values()];
  console.log(`Normalized ${allPrograms.length} → ${programs.length} unique programs`);

  const programResult = await upsertBatch(
    supabase,
    "programs",
    programs,
    "university_id,slug",
    BATCH_SIZES.programs,
  );
  allFailures.push(...programResult.failures);
  console.log(`Upserted ${programResult.inserted} programs`);

  // Requirement trees reference courses and programs — if anything upstream
  // failed, leaves would point at rows that never landed. Bail before
  // touching requirement_sets so the previously active sets stay live.
  if (allFailures.length > 0) {
    summarize(
      deptResult.inserted,
      courseResult.inserted,
      prereqInserted,
      programResult.inserted,
      allWarnings,
    );
    throw new Error(
      `Seed failed: ${allFailures.length} batch failure(s); requirement seeding skipped.\n` +
        allFailures.slice(0, 5).join("\n"),
    );
  }

  // 6. Requirement sets/items: normalize, skip unchanged via content hash,
  //    insert new sets inactive, flip atomically, then prune old versions.
  const reqStats = await seedRequirements(supabase, {
    programs,
    rawBySlug,
    courses,
    courseGroupIdMap,
    validCourseIds,
  });

  // 7. Stale marking: flag rows that vanished from the catalog, restore ones
  // that returned. Runs only after a fully successful fetch + seed, guarded
  // by the truncation circuit breaker.
  const courseStale = await markDiscontinued(
    supabase,
    universityId,
    "courses",
    new Set(courses.map((c) => c.id)),
  );
  const programStale = await markDiscontinued(
    supabase,
    universityId,
    "programs",
    new Set(programs.map((p) => p.id)),
  );

  summarize(
    deptResult.inserted,
    courseResult.inserted,
    prereqInserted,
    programResult.inserted,
    allWarnings,
  );
  // "SUMMARY: " is a stable machine-consumed prefix — the catalog-refresh
  // workflow greps these lines into the job summary. Keep the prefix intact
  // when rewording.
  console.log(
    `SUMMARY: Requirement sets: ${reqStats.changed} updated, ${reqStats.skipped} unchanged, ${reqStats.withoutRules} programs without rules`,
  );
  console.log(
    `SUMMARY: Requirement parse coverage: ${reqStats.leavesResolved} course leaves resolved, ` +
      `${reqStats.leavesFreeText} free-text fallbacks ` +
      `(${reqStats.coveragePct}% resolved)`,
  );
  console.log(
    `SUMMARY: Discontinued: ${courseStale.flagged} courses flagged / ${courseStale.restored} restored; ` +
      `${programStale.flagged} programs flagged / ${programStale.restored} restored`,
  );
}

interface SeedRequirementsInput {
  programs: NormalizedProgram[];
  rawBySlug: Map<string, CoursedogProgram>;
  courses: NormalizedCourse[];
  courseGroupIdMap: Map<string, string>;
  validCourseIds: Set<string>;
}

export interface RequirementSeedStats {
  changed: number;
  skipped: number;
  withoutRules: number;
  leavesResolved: number;
  leavesFreeText: number;
  coveragePct: number;
}

async function seedRequirements(
  supabase: ServiceClient,
  input: SeedRequirementsInput,
): Promise<RequirementSeedStats> {
  const { programs, rawBySlug, courses, courseGroupIdMap, validCourseIds } = input;

  // Resolution map filtered to courses that survived dedup — the group map is
  // built pre-dedup and would otherwise point leaves at discarded UUIDs.
  const resolutionMap = new Map<string, string>();
  for (const [cgId, courseId] of courseGroupIdMap) {
    if (validCourseIds.has(courseId)) resolutionMap.set(cgId, courseId);
  }
  const courseLabels = new Map(
    courses.map((c) => [c.id, `${c.subject_code} ${c.number} — ${c.title}`]),
  );

  const versionLabel = `captured ${new Date().toISOString()}`;
  const work: RequirementWork[] = [];
  let withoutRules = 0;
  let leavesResolved = 0;
  let leavesFreeText = 0;

  for (const program of programs) {
    const raw = rawBySlug.get(program.slug);
    if (!raw) continue;
    const normalized = normalizeRequirements(raw, {
      courseGroupIdMap: resolutionMap,
      courseLabels,
    });
    if (!normalized) {
      withoutRules++;
      continue;
    }
    leavesResolved += normalized.stats.leavesResolved;
    leavesFreeText += normalized.stats.leavesFreeText;
    work.push({
      programId: program.id,
      setId: randomUUID(),
      versionLabel,
      contentHash: normalized.contentHash,
      items: normalized.items,
    });
  }

  // Compare against currently active sets — unchanged programs are skipped
  // entirely (no weekly churn).
  const activeHashes = new Map<string, string | null>();
  for (const ids of chunk(
    work.map((w) => w.programId),
    IN_CHUNK,
  )) {
    const { data, error } = await supabase
      .from("requirement_sets")
      .select("program_id, content_hash")
      .eq("is_active", true)
      .in("program_id", ids);
    if (error) throw new Error(`Failed to read active requirement sets: ${error.message}`);
    for (const row of data ?? []) {
      activeHashes.set(row.program_id as string, row.content_hash as string | null);
    }
  }

  const changed = work.filter((w) => activeHashes.get(w.programId) !== w.contentHash);
  const skipped = work.length - changed.length;

  if (changed.length === 0) {
    return buildStats(0, skipped, withoutRules, leavesResolved, leavesFreeText);
  }

  const newSetIds = changed.map((w) => w.setId);

  const cleanupNewSets = async () => {
    for (const ids of chunk(newSetIds, IN_CHUNK)) {
      // Delete only inactive debris — a flipped set is complete, valid, live
      // data (its predecessor was already deactivated in the same committed
      // transaction), so it must never be removed here. The is_active filter
      // also makes the cleanup/flip race converge safely. Cascade removes any
      // partially inserted items.
      const { error } = await supabase
        .from("requirement_sets")
        .delete()
        .eq("is_active", false)
        .in("id", ids);
      if (error) {
        console.warn(`Cleanup of inactive requirement sets failed: ${error.message}`);
      }
    }
  };

  try {
    // Insert sets (born inactive — see migration: default false).
    const setRows = changed.map((w) => ({
      id: w.setId,
      program_id: w.programId,
      version_label: w.versionLabel,
      content_hash: w.contentHash,
      is_active: false,
    }));
    const setResult = await insertBatch(supabase, "requirement_sets", setRows, BATCH_SIZES.narrow);
    if (setResult.failures.length > 0) {
      throw new Error(`requirement_sets insert failed: ${setResult.failures.join("; ")}`);
    }

    // Items: one globally ordered stream — per-program lists are already
    // parents-first, and concatenation preserves that invariant, so
    // cross-program batches of 1000 are FK-safe as long as they stay
    // sequential.
    const itemRows = changed.flatMap((w) =>
      w.items.map((item) => ({ ...item, requirement_set_id: w.setId })),
    );
    const itemResult = await insertBatch(
      supabase,
      "requirement_items",
      itemRows,
      BATCH_SIZES.narrow,
    );
    if (itemResult.failures.length > 0) {
      throw new Error(`requirement_items insert failed: ${itemResult.failures.join("; ")}`);
    }

    // Atomic flip per program, batched.
    for (const pairs of chunk(
      changed.map((w) => ({ program_id: w.programId, set_id: w.setId })),
      FLIP_CHUNK,
    )) {
      const { error } = await supabase.rpc("activate_requirement_sets", {
        p_pairs: pairs,
      });
      if (error) throw new Error(`activate_requirement_sets failed: ${error.message}`);
    }
  } catch (err) {
    // Leave the previously active sets untouched; remove our partial debris.
    await cleanupNewSets();
    throw err;
  }

  // Retention: nothing reads historical sets — keep only the active one.
  for (const ids of chunk(
    changed.map((w) => w.programId),
    IN_CHUNK,
  )) {
    const { error } = await supabase
      .from("requirement_sets")
      .delete()
      .eq("is_active", false)
      .in("program_id", ids);
    if (error) {
      console.warn(`Retention cleanup failed (non-fatal): ${error.message}`);
    }
  }

  return buildStats(changed.length, skipped, withoutRules, leavesResolved, leavesFreeText);
}

function buildStats(
  changed: number,
  skipped: number,
  withoutRules: number,
  leavesResolved: number,
  leavesFreeText: number,
): RequirementSeedStats {
  const totalLeaves = leavesResolved + leavesFreeText;
  return {
    changed,
    skipped,
    withoutRules,
    leavesResolved,
    leavesFreeText,
    coveragePct: totalLeaves === 0 ? 100 : Math.round((leavesResolved / totalLeaves) * 100),
  };
}

function summarize(
  deptCount: number,
  courseCount: number,
  prereqCount: number,
  programCount: number,
  warnings: string[],
): void {
  // "SUMMARY: " is a stable machine-consumed prefix — the catalog-refresh
  // workflow greps these lines into the job summary. Keep the prefix intact
  // when rewording.
  console.log("\n=== Seed Summary ===");
  console.log(`SUMMARY: Universities: 1`);
  console.log(`SUMMARY: Departments: ${deptCount}`);
  console.log(`SUMMARY: Courses: ${courseCount}`);
  console.log(`SUMMARY: Prerequisites: ${prereqCount}`);
  console.log(`SUMMARY: Programs: ${programCount}`);
  console.log(`SUMMARY: Warnings: ${warnings.length}`);

  if (warnings.length > 0) {
    console.log("\nFirst 10 warnings:");
    for (const w of warnings.slice(0, 10)) {
      console.log(`  - ${w}`);
    }
    if (warnings.length > 10) {
      console.log(`  ... and ${warnings.length - 10} more`);
    }
  }
}
