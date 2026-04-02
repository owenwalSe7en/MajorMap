import fs from "node:fs";
import path from "node:path";
import { createServiceClient } from "./supabase-client.js";
import {
  normalizeCourse,
  buildCourseGroupIdMap,
  type NormalizedCourse,
} from "./normalizers/courses.js";
import { normalizeProgram, type NormalizedProgram } from "./normalizers/programs.js";
import { normalizePrerequisites, type NormalizedPrereq } from "./normalizers/prerequisites.js";
import { universityUuid, departmentUuid } from "./uuid.js";
import type { CoursedogCourse, CoursedogProgram } from "./schemas/coursedog.js";

const BATCH_SIZE = 100;
const UNIVERSITY_SLUG = "utah";

async function upsertBatch(
  supabase: ReturnType<typeof createServiceClient>,
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
  onConflict: string,
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      console.error(`Error upserting to ${table} (batch ${i / BATCH_SIZE + 1}):`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

export async function seed(): Promise<void> {
  const supabase = createServiceClient();
  const rawDir = path.resolve(process.cwd(), "data/raw/utah");

  // Read raw data
  const coursesPath = path.join(rawDir, "courses.json");
  const programsPath = path.join(rawDir, "programs.json");

  if (!fs.existsSync(coursesPath) || !fs.existsSync(programsPath)) {
    throw new Error(`Raw data not found at ${rawDir}. Run 'catalog:fetch' first.`);
  }

  const rawCourses: CoursedogCourse[] = JSON.parse(fs.readFileSync(coursesPath, "utf-8"));
  const rawPrograms: CoursedogProgram[] = JSON.parse(fs.readFileSync(programsPath, "utf-8"));

  console.log(`Loaded ${rawCourses.length} courses and ${rawPrograms.length} programs from disk`);

  // 1. Upsert university
  const universityId = universityUuid(UNIVERSITY_SLUG);
  await supabase.from("universities").upsert(
    {
      id: universityId,
      slug: UNIVERSITY_SLUG,
      name: "University of Utah",
      coursedog_school_id: "utah_peoplesoft",
      catalog_url: "https://catalog.utah.edu",
    },
    { onConflict: "slug" },
  );
  console.log("Upserted university: Utah");

  // 2. Extract and upsert departments
  const deptCodes = new Set<string>();
  for (const c of rawCourses) {
    for (const d of c.departments) deptCodes.add(d);
  }
  const departments = [...deptCodes].map((code) => ({
    id: departmentUuid(UNIVERSITY_SLUG, code),
    university_id: universityId,
    code,
    name: code,
  }));
  const deptCount = await upsertBatch(supabase, "departments", departments, "university_id,code");
  console.log(`Upserted ${deptCount} departments`);

  // 3. Pass 1: Normalize all courses, deduplicate by natural key, build courseGroupId map
  const allCourses: NormalizedCourse[] = rawCourses.map((raw) =>
    normalizeCourse(raw, UNIVERSITY_SLUG, universityId),
  );

  // Deduplicate: keep last version per (subject_code, number) — Coursedog returns multiple versions
  const courseMap = new Map<string, NormalizedCourse>();
  for (const c of allCourses) {
    courseMap.set(`${c.subject_code}:${c.number}`, c);
  }
  const courses = [...courseMap.values()];
  console.log(`Normalized ${allCourses.length} → ${courses.length} unique courses`);

  const courseGroupIdMap = buildCourseGroupIdMap(allCourses); // use ALL for prereq lookup

  const courseCount = await upsertBatch(
    supabase,
    "courses",
    courses,
    "university_id,subject_code,number",
  );
  console.log(`Upserted ${courseCount} courses`);

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

  if (allPrereqs.length > 0) {
    // Deduplicate prereqs by composite key and filter out FK violations
    const validCourseIds = new Set(courses.map((c) => c.id));
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

    const prereqCount = await upsertBatch(
      supabase,
      "course_prerequisites",
      dedupedPrereqs,
      "course_id,prerequisite_course_id,group_id",
    );
    console.log(`Upserted ${prereqCount} prerequisite rules`);
  }

  // 5. Normalize and upsert programs (deduplicate by slug)
  const allPrograms: NormalizedProgram[] = rawPrograms.map((raw) =>
    normalizeProgram(raw, UNIVERSITY_SLUG, universityId),
  );
  const programMap = new Map<string, NormalizedProgram>();
  for (const p of allPrograms) programMap.set(p.slug, p);
  const programs = [...programMap.values()];
  console.log(`Normalized ${allPrograms.length} → ${programs.length} unique programs`);

  const programCount = await upsertBatch(supabase, "programs", programs, "university_id,slug");
  console.log(`Upserted ${programCount} programs`);

  // Summary
  console.log("\n=== Seed Summary ===");
  console.log(`Universities: 1`);
  console.log(`Departments: ${deptCount}`);
  console.log(`Courses: ${courseCount}`);
  console.log(`Prerequisites: ${allPrereqs.length}`);
  console.log(`Programs: ${programCount}`);
  console.log(`Warnings: ${allWarnings.length}`);

  if (allWarnings.length > 0) {
    console.log("\nFirst 10 warnings:");
    for (const w of allWarnings.slice(0, 10)) {
      console.log(`  - ${w}`);
    }
    if (allWarnings.length > 10) {
      console.log(`  ... and ${allWarnings.length - 10} more`);
    }
  }
}
