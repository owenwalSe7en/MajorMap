import { schoolBySlug, type SchoolRef } from "@major-map/shared";

export const SITE_URL = "https://majormap.app";

/**
 * Resolves a route slug to a known school — build-time list, deterministic
 * university id, no database round trip. Unknown slugs return null and the
 * route should 404.
 */
export function resolveSchool(slug: string): SchoolRef | null {
  return schoolBySlug(slug) ?? null;
}
