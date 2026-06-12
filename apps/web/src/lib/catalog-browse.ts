import { UTAH_UNIVERSITY_ID } from "@major-map/shared";
import {
  COURSES_PAGE_SIZE,
  PROGRAMS_PAGE_SIZE,
  courseSearchOr,
  lastPageFor,
  rangeBounds,
  sanitizeSearchText,
} from "./browse";

/**
 * Shared, university-scoped browse queries. The /programs and /courses pages
 * (and the /[school]/... routes that wrap them) all go through here so the
 * scoping filter can never be forgotten on one surface.
 */

interface BrowseResult {
  data: unknown[] | null;
  count: number | null;
}

// Accepts both the real SupabaseClient and test doubles; the query builder's
// generics make a precise structural type here brittle across supabase-js
// versions, so the boundary is intentionally loose and results are narrowed
// on the way out.
export interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface ProgramRow {
  id: string;
  slug: string;
  name: string;
  degree_type: string;
  total_credits: number | null;
  description: string | null;
}

export interface CourseRow {
  id: string;
  subject_code: string;
  number: string;
  title: string;
  credits_min: number | null;
  credits_max: number | null;
}

export interface BrowsePage<Row> {
  rows: Row[];
  count: number;
  page: number;
  pageSize: number;
  lastPage: number;
  /** True when the requested page is beyond the last — caller should redirect-clamp. */
  outOfRange: boolean;
}

export interface ProgramsPageOptions {
  page: number;
  q?: string;
  type?: string;
  universityId?: string;
}

export async function fetchProgramsPage(
  supabase: SupabaseLike,
  options: ProgramsPageOptions,
): Promise<BrowsePage<ProgramRow>> {
  const { page, q, type, universityId = UTAH_UNIVERSITY_ID } = options;

  let query = supabase
    .from("programs")
    .select("id, slug, name, degree_type, total_credits, description", { count: "exact" })
    .eq("university_id", universityId)
    .order("name")
    .order("id");

  if (q) {
    const sanitized = sanitizeSearchText(q);
    if (sanitized) query = query.ilike("name", `%${sanitized}%`);
  }
  if (type) {
    query = query.eq("degree_type", type.slice(0, 100));
  }

  const { from, to } = rangeBounds(page, PROGRAMS_PAGE_SIZE);
  const { data, count } = (await query.range(from, to)) as BrowseResult;

  return assemble<ProgramRow>(data, count, page, PROGRAMS_PAGE_SIZE);
}

export interface CoursesPageOptions {
  page: number;
  q?: string;
  dept?: string;
  universityId?: string;
}

export async function fetchCoursesPage(
  supabase: SupabaseLike,
  options: CoursesPageOptions,
): Promise<BrowsePage<CourseRow>> {
  const { page, q, dept, universityId = UTAH_UNIVERSITY_ID } = options;

  let query = supabase
    .from("courses")
    .select("id, subject_code, number, title, credits_min, credits_max", { count: "exact" })
    .eq("university_id", universityId)
    .order("subject_code")
    .order("number")
    .order("id");

  if (q) {
    const orFilter = courseSearchOr(q);
    if (orFilter) query = query.or(orFilter);
  }
  if (dept) {
    const sanitized = dept
      .slice(0, 6)
      .toUpperCase()
      .replace(/[^A-Z ]/g, "");
    if (sanitized) query = query.eq("subject_code", sanitized);
  }

  const { from, to } = rangeBounds(page, COURSES_PAGE_SIZE);
  const { data, count } = (await query.range(from, to)) as BrowseResult;

  return assemble<CourseRow>(data, count, page, COURSES_PAGE_SIZE);
}

function assemble<Row>(
  data: unknown[] | null,
  count: number | null,
  page: number,
  pageSize: number,
): BrowsePage<Row> {
  const total = count ?? 0;
  const lastPage = lastPageFor(total, pageSize);
  return {
    rows: (data ?? []) as Row[],
    count: total,
    page,
    pageSize,
    lastPage,
    outOfRange: (data ?? []).length === 0 && total > 0 && page > lastPage,
  };
}
