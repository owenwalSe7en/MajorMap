import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type { RequirementItemRow } from "@major-map/shared";
import type { CoursedogProgram } from "../schemas/coursedog.js";

/**
 * Normalizes a Coursedog program's requisitesSimple rule trees into flat
 * requirement_items rows (parents-first, ready for batched FK-safe inserts).
 *
 * Every rule lands somewhere: resolvable courseGroupIds become `course`
 * leaves, structure becomes `group` nodes, and anything unresolvable —
 * unknown course refs, courseAttributes ("GE - LS"), free-text rules —
 * becomes a visible `free_text` item. Nothing is silently dropped, which is
 * why there is no "skipped" stat.
 */

/**
 * A requirement_items row minus its set id — the normalizer doesn't know
 * which requirement_set the tree will land in; the seed stamps that on
 * insert. Derived from the canonical shared row type so the two can't drift.
 */
export type RequirementItemDraft = Omit<RequirementItemRow, "requirement_set_id">;

export interface RequirementStats {
  leavesResolved: number;
  leavesFreeText: number;
}

export interface NormalizedRequirements {
  /** Topologically ordered: every parent precedes its children. */
  items: RequirementItemDraft[];
  stats: RequirementStats;
  /** Stable hash of the tree's content (ids excluded) for skip-if-unchanged. */
  contentHash: string;
}

export interface NormalizeRequirementsOptions {
  /** courseGroupId → deduped course UUID (filter through validCourseIds first). */
  courseGroupIdMap: Map<string, string>;
  /** course UUID → display label (e.g. "CS 1400 — Intro"). Optional. */
  courseLabels?: Map<string, string>;
}

interface Ctx {
  items: RequirementItemDraft[];
  stats: RequirementStats;
  map: Map<string, string>;
  labels: Map<string, string>;
}

function stripHtml(html: unknown): string | null {
  if (typeof html !== "string" || html.length === 0) return null;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : null;
}

function emit(
  ctx: Ctx,
  parentId: string | null,
  sortOrder: number,
  fields: Omit<RequirementItemDraft, "id" | "parent_id" | "sort_order">,
): RequirementItemDraft {
  const item: RequirementItemDraft = {
    id: uuidv4(),
    parent_id: parentId,
    sort_order: sortOrder,
    ...fields,
  };
  ctx.items.push(item);
  return item;
}

function emitCourseLeaf(
  ctx: Ctx,
  parentId: string,
  sortOrder: number,
  courseGroupId: string,
  rule: unknown,
): void {
  const courseId = ctx.map.get(courseGroupId) ?? null;
  if (courseId) {
    ctx.stats.leavesResolved++;
    emit(ctx, parentId, sortOrder, {
      label: ctx.labels.get(courseId) ?? "Course",
      type: "course",
      course_id: courseId,
      credits_required: null,
      courses_required: null,
      description: null,
      raw_rule: rule,
    });
  } else {
    ctx.stats.leavesFreeText++;
    emit(ctx, parentId, sortOrder, {
      label: `Unlisted course (${courseGroupId})`,
      type: "free_text",
      course_id: null,
      credits_required: null,
      courses_required: null,
      description: "This requirement references a course not present in the current catalog.",
      raw_rule: rule,
    });
  }
}

interface ValueEntry {
  ids: string[];
  logic: string;
}

function parseValueEntries(value: unknown): ValueEntry[] | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.condition !== "courses" || !Array.isArray(v.values)) return null;

  const entries: ValueEntry[] = [];
  for (const entry of v.values) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (!Array.isArray(e.value)) continue;
    const ids = (e.value as unknown[]).filter((id): id is string => typeof id === "string");
    if (ids.length > 0) entries.push({ ids, logic: typeof e.logic === "string" ? e.logic : "and" });
  }
  return entries.length > 0 ? entries : null;
}

/** Renders non-course rule values (courseAttributes, literals) as readable text. */
function describeValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof v.condition === "string" && v.condition !== "courses") parts.push(`${v.condition}:`);
  if (Array.isArray(v.values)) {
    for (const entry of v.values) {
      const e = entry as Record<string, unknown>;
      if (Array.isArray(e?.value)) {
        parts.push((e.value as unknown[]).filter((x) => typeof x === "string").join(", "));
      }
    }
  }
  const text = parts.join(" ").trim();
  return text.length > 0 ? text : null;
}

function walkRule(ctx: Ctx, rule: unknown, parentId: string, sortOrder: number): void {
  if (!rule || typeof rule !== "object") return;
  const r = rule as Record<string, unknown>;
  const condition = typeof r.condition === "string" ? r.condition : "unknown";
  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : null;
  const description = stripHtml(r.description);

  // Structural wrappers: anyOf / allOf with nested subRules
  if (condition === "anyOf" || condition === "allOf") {
    const subRules = Array.isArray(r.subRules) ? r.subRules : [];
    if (subRules.length === 0) return;
    const node = emit(ctx, parentId, sortOrder, {
      label: name ?? (condition === "anyOf" ? "One of the following" : "All of the following"),
      type: "group",
      course_id: null,
      credits_required: null,
      courses_required: null,
      description,
      raw_rule: rule,
    });
    subRules.forEach((sub, i) => walkRule(ctx, sub, node.id, i));
    return;
  }

  // Course-list rules: completedAllOf / completedAnyOf / completedAtLeastXOf
  const entries = parseValueEntries(r.value);
  if (entries) {
    const restriction = typeof r.restriction === "number" ? r.restriction : null;
    const coursesRequired =
      condition === "completedAtLeastXOf" ? restriction : condition === "completedAnyOf" ? 1 : null;

    const node = emit(ctx, parentId, sortOrder, {
      label: name ?? defaultLabelFor(condition),
      type: "group",
      course_id: null,
      credits_required: null,
      courses_required: coursesRequired,
      description,
      raw_rule: rule,
    });

    entries.forEach((entry, i) => {
      if (entry.ids.length === 1) {
        emitCourseLeaf(ctx, node.id, i, entry.ids[0], rule);
        return;
      }
      const sub = emit(ctx, node.id, i, {
        label: entry.logic === "or" ? "One of" : "All of",
        type: "group",
        course_id: null,
        credits_required: null,
        courses_required: entry.logic === "or" ? 1 : null,
        description: null,
        raw_rule: null,
      });
      entry.ids.forEach((id, j) => emitCourseLeaf(ctx, sub.id, j, id, rule));
    });
    return;
  }

  // Everything else (courseAttributes, GPA rules, literal text…) → free_text
  ctx.stats.leavesFreeText++;
  emit(ctx, parentId, sortOrder, {
    label: name ?? condition,
    type: "free_text",
    course_id: null,
    credits_required: null,
    courses_required: null,
    description: description ?? describeValue(r.value),
    raw_rule: rule,
  });
}

function defaultLabelFor(condition: string): string {
  switch (condition) {
    case "completedAllOf":
      return "Complete all of the following";
    case "completedAnyOf":
      return "Complete one of the following";
    case "completedAtLeastXOf":
      return "Complete the required number of the following";
    default:
      return condition;
  }
}

export function normalizeRequirements(
  raw: CoursedogProgram,
  options: NormalizeRequirementsOptions,
): NormalizedRequirements | null {
  const requisites = raw.requisites as Record<string, unknown>;
  const simple = requisites?.requisitesSimple;
  if (!Array.isArray(simple)) return null;

  const ctx: Ctx = {
    items: [],
    stats: { leavesResolved: 0, leavesFreeText: 0 },
    map: options.courseGroupIdMap,
    labels: options.courseLabels ?? new Map(),
  };

  let rootOrder = 0;
  for (const group of simple) {
    if (!group || typeof group === "string" || typeof group !== "object") continue;
    const g = group as Record<string, unknown>;
    if (g.showInCatalog === false) continue;
    const rules = Array.isArray(g.rules) ? g.rules : [];
    if (rules.length === 0) continue;

    const node = emit(ctx, null, rootOrder++, {
      label: typeof g.name === "string" && g.name.trim() ? g.name.trim() : "Requirements",
      type: "group",
      course_id: null,
      credits_required: null,
      courses_required: null,
      description: stripHtml(g.description),
      raw_rule: { requirementLevel: g.requirementLevel ?? null },
    });
    rules.forEach((rule, i) => walkRule(ctx, rule, node.id, i));
  }

  if (ctx.items.length === 0) return null;

  return { items: ctx.items, stats: ctx.stats, contentHash: hashItems(ctx.items) };
}

/**
 * Content hash over the tree's semantics: parent linkage by array index (ids
 * are random per run and must not participate), order, labels, types, and
 * rule payload columns.
 */
export function hashItems(items: RequirementItemDraft[]): string {
  const indexById = new Map(items.map((item, i) => [item.id, i]));
  const canonical = items.map((item) => [
    item.parent_id === null ? -1 : (indexById.get(item.parent_id) ?? -2),
    item.sort_order,
    item.label,
    item.type,
    item.course_id,
    item.credits_required,
    item.courses_required,
    item.description,
  ]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
