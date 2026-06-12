/**
 * Schools known to the platform. This list is the build-time source of truth
 * for the web app: route slugs validate against it and university IDs resolve
 * from it without a database round trip.
 *
 * IDs are deterministic uuidv5 values derived from `university:{slug}` under
 * the MajorMap namespace — they MUST match `universityUuid(slug)` in
 * packages/catalog/src/uuid.ts (a catalog test enforces this). A slug is
 * forever: renaming one changes every derived course/program UUID and orphans
 * the old rows.
 */
export interface SchoolRef {
  slug: string;
  name: string;
  universityId: string;
}

export const SCHOOLS: readonly SchoolRef[] = [
  {
    slug: "utah",
    name: "University of Utah",
    universityId: "63b63f87-3a1d-58a9-b55d-c0d359823c77",
  },
] as const;

export const DEFAULT_SCHOOL_SLUG = "utah";

export const UTAH_UNIVERSITY_ID = "63b63f87-3a1d-58a9-b55d-c0d359823c77";

/**
 * Top-level web route segments that can never be school slugs — a school
 * slugged like one of these would be shadowed by the static route.
 */
export const RESERVED_SCHOOL_SLUGS = [
  "programs",
  "courses",
  "plans",
  "compare",
  "login",
  "signup",
  "auth",
  "health",
  "api",
] as const;

const SLUG_PATTERN = /^[a-z0-9_-]{1,64}$/;

export function isValidSchoolSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SCHOOL_SLUGS.includes(slug as never);
}

export function schoolBySlug(slug: string): SchoolRef | undefined {
  return SCHOOLS.find((s) => s.slug === slug);
}
