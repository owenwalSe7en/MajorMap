import { schoolBySlug, type SchoolRef } from "@major-map/shared";

export const SITE_URL = "https://majormap.app";

const SLUG_PATTERN = /^[a-z0-9_-]{1,64}$/;

/**
 * Resolves a route slug to a known school — build-time list, deterministic
 * university id, no database round trip. Unknown or malformed slugs return
 * null and the route should 404.
 */
export function resolveSchool(slug: string): SchoolRef | null {
  if (!SLUG_PATTERN.test(slug)) return null;
  return schoolBySlug(slug) ?? null;
}
