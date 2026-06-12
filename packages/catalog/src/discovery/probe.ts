import { z } from "zod";
import { COURSEDOG_API_BASE, coursedogHeaders, resolveCatalogId } from "../sources/coursedog.js";

/**
 * Onboarding helper: validates that a Coursedog school id + catalog origin
 * actually serve data, and prints a ready-to-paste schools.json entry.
 * Candidates always go through human review — nothing is auto-onboarded.
 * See docs/onboarding-a-school.md for the full runbook.
 */

// Observed Coursedog school ids only use [a-z0-9_-]; excluding "." also rules
// out any ".."-style path tricks since the id lands in a URL path segment.
const SCHOOL_ID_RE = /^[a-z0-9_-]{1,64}$/;
const TIMEOUT_MS = 15_000;

const USER_AGENT =
  "MajorMapProbe/1.0 (+https://github.com/owenwalSe7en/MajorMap; degree-planning research)";

const CountSchema = z.object({ listLength: z.number() }).passthrough();

export async function probeSchool(coursedogSchoolId: string, origin: string): Promise<void> {
  if (!SCHOOL_ID_RE.test(coursedogSchoolId)) {
    throw new Error(`Invalid Coursedog school id "${coursedogSchoolId}"`);
  }
  const parsed = new URL(origin);
  if (parsed.protocol !== "https:") {
    throw new Error(`Origin must be https:// (got ${origin})`);
  }

  console.log(`Probing ${coursedogSchoolId} via ${parsed.origin} ...`);

  const catalogsRes = await fetch(`${COURSEDOG_API_BASE}/ca/${coursedogSchoolId}/catalogs`, {
    headers: coursedogHeaders(parsed.origin, USER_AGENT),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (catalogsRes.status === 403 || catalogsRes.status === 429) {
    throw new Error(
      `Coursedog answered ${catalogsRes.status} — stop probing this host; do not retry.`,
    );
  }
  if (!catalogsRes.ok) {
    throw new Error(`catalogs endpoint returned ${catalogsRes.status} — not a Coursedog school?`);
  }
  const editions = z.array(z.record(z.unknown())).parse(await catalogsRes.json());
  console.log(`  Found ${editions.length} catalog edition(s)`);

  const catalogId = resolveCatalogId(editions, new Date());
  if (!catalogId) {
    throw new Error("No usable catalog edition (none carried an id)");
  }
  console.log(`  Current edition: ${catalogId}`);

  const coursesRes = await fetch(
    `${COURSEDOG_API_BASE}/cm/${coursedogSchoolId}/courses/search/%24filters?catalogId=${encodeURIComponent(catalogId)}&limit=1&skip=0`,
    {
      headers: coursedogHeaders(parsed.origin, USER_AGENT),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!coursesRes.ok) {
    throw new Error(`courses endpoint returned ${coursesRes.status}`);
  }
  const { listLength } = CountSchema.parse(await coursesRes.json());
  console.log(`  Courses in current catalog: ${listLength}`);

  // Suggest a clean route slug: strip a trailing SIS suffix (e.g. _peoplesoft).
  const suggestedSlug = coursedogSchoolId.replace(/_(peoplesoft|banner|colleague|workday)$/i, "");

  console.log("\nValidated. Suggested schools.json entry (review before committing):\n");
  console.log(
    JSON.stringify(
      {
        slug: suggestedSlug,
        name: "<official school name>",
        coursedogSchoolId,
        origin: parsed.origin,
        catalogUrl: parsed.origin,
        catalogId,
      },
      null,
      2,
    ),
  );
  console.log(
    "\nRemember: also add the school (slug, name, universityUuid(slug)) to " +
      "packages/shared/src/schools.ts — a catalog test enforces the sync. " +
      "A slug is forever (UUIDs derive from it).",
  );
}
