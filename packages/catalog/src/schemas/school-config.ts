import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { RESERVED_SCHOOL_SLUGS } from "@major-map/shared";

/**
 * Pipeline-side school configuration (schools.json). The web app never reads
 * this file — it resolves schools from the build-time SCHOOLS registry in
 * @major-map/shared; a test keeps the two in sync.
 *
 * A slug is forever: course/program UUIDs are uuidv5 of the slug, so renaming
 * one orphans every previously seeded row.
 */
export const SchoolConfigSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9_-]{1,64}$/, "slug must be lowercase [a-z0-9_-], 1-64 chars")
    .refine(
      (slug) => !RESERVED_SCHOOL_SLUGS.includes(slug as never),
      "slug collides with a static web route",
    ),
  name: z.string().min(1),
  /** Coursedog school id, e.g. "utah_peoplesoft" or "byu". */
  coursedogSchoolId: z.string().min(1),
  /** Public catalog origin — Coursedog's soft gate checks these headers. */
  origin: z.string().url().startsWith("https://"),
  /** Human-facing catalog URL stored on the universities row. */
  catalogUrl: z.string().url(),
  /**
   * Optional pinned catalog edition. The fetcher resolves the current
   * effective-dated edition live and only falls back to this — a pinned id
   * silently fetches last year's catalog forever.
   */
  catalogId: z.string().min(1).optional(),
});

export type SchoolConfig = z.infer<typeof SchoolConfigSchema>;

const SchoolsFileSchema = z.array(SchoolConfigSchema).min(1);

export function loadSchools(): SchoolConfig[] {
  const file = path.resolve(import.meta.dirname, "../../schools.json");
  const schools = SchoolsFileSchema.parse(JSON.parse(fs.readFileSync(file, "utf-8")));
  const slugs = new Set<string>();
  for (const school of schools) {
    if (slugs.has(school.slug)) {
      throw new Error(`schools.json: duplicate slug "${school.slug}"`);
    }
    slugs.add(school.slug);
  }
  return schools;
}

export function schoolBySlugOrThrow(slug: string): SchoolConfig {
  const schools = loadSchools();
  const school = schools.find((s) => s.slug === slug);
  if (!school) {
    const known = schools.map((s) => s.slug).join(", ");
    throw new Error(`Unknown school "${slug}". Known schools: ${known}`);
  }
  return school;
}
