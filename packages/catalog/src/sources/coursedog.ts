import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  CoursedogCourseSchema,
  CoursedogProgramSchema,
  CoursedogPageSchema,
} from "../schemas/coursedog.js";
import type { SchoolConfig } from "../schemas/school-config.js";

const PAGE_SIZE = 500;
const DELAY_MS = 200;
const API_BASE = "https://app.coursedog.com/api/v1";

function headersFor(origin: string): Record<string, string> {
  const bare = origin.replace(/\/$/, "");
  return {
    Referer: `${bare}/`,
    Origin: bare,
    "X-Requested-With": "catalog",
  };
}

async function fetchPage<T extends z.ZodTypeAny>(
  url: string,
  origin: string,
  schema: ReturnType<typeof CoursedogPageSchema<T>>,
  retries = 3,
): Promise<z.infer<typeof schema>> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: headersFor(origin) });

    if (res.status >= 400 && res.status < 500) {
      throw new Error(`Coursedog API returned ${res.status}: ${await res.text()}`);
    }

    if (!res.ok) {
      if (attempt < retries) {
        const delay = DELAY_MS * Math.pow(2, attempt);
        console.log(`  Retry ${attempt}/${retries} after ${delay}ms (status ${res.status})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw new Error(`Coursedog API failed after ${retries} retries: ${res.status}`);
    }

    const json = await res.json();
    return schema.parse(json);
  }

  throw new Error("Unreachable");
}

const CatalogEditionSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    effectiveStartDate: z.string().optional(),
    effectiveEndDate: z.string().optional(),
  })
  .passthrough();

export type CatalogEdition = z.infer<typeof CatalogEditionSchema>;

/**
 * Picks the catalog edition effective today; falls back to the one with the
 * latest effectiveStartDate. Returns null when nothing usable is present.
 */
export function resolveCatalogId(editions: CatalogEdition[], today: Date): string | null {
  const withId: Array<{ id: string; start?: string; end?: string }> = [];
  for (const e of editions) {
    const id = e._id ?? e.id;
    if (id) withId.push({ id, start: e.effectiveStartDate, end: e.effectiveEndDate });
  }
  if (withId.length === 0) return null;

  const now = today.getTime();
  const current = withId.find((e) => {
    const start = e.start ? Date.parse(e.start) : Number.NEGATIVE_INFINITY;
    const end = e.end ? Date.parse(e.end) : Number.POSITIVE_INFINITY;
    return start <= now && now <= end;
  });
  if (current) return current.id;

  const latest = [...withId].sort(
    (a, b) => (b.start ? Date.parse(b.start) : 0) - (a.start ? Date.parse(a.start) : 0),
  )[0];
  return latest.id;
}

/**
 * Resolves the catalog edition to fetch. Live resolution is authoritative —
 * a pinned catalogId in schools.json silently fetches last year's catalog
 * forever — but a pin is the fallback when the catalogs endpoint is
 * unavailable.
 */
async function resolveCatalog(school: SchoolConfig): Promise<string> {
  const url = `${API_BASE}/ca/${school.coursedogSchoolId}/catalogs`;
  try {
    const res = await fetch(url, { headers: headersFor(school.origin) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const editions = z.array(CatalogEditionSchema).parse(await res.json());
    const resolved = resolveCatalogId(editions, new Date());
    if (resolved) {
      if (school.catalogId && school.catalogId !== resolved) {
        console.warn(
          `WARNING: pinned catalogId ${school.catalogId} for ${school.slug} is not the ` +
            `current edition (${resolved}); using the current edition.`,
        );
      }
      return resolved;
    }
    throw new Error("no usable catalog editions in response");
  } catch (err) {
    if (school.catalogId) {
      console.warn(
        `WARNING: could not resolve current catalog for ${school.slug} ` +
          `(${err instanceof Error ? err.message : err}); falling back to pinned ${school.catalogId}.`,
      );
      return school.catalogId;
    }
    throw new Error(
      `Could not resolve a catalogId for ${school.slug} and no pinned fallback exists: ${err}`,
    );
  }
}

async function fetchAllPages<T extends z.ZodTypeAny>(
  endpoint: string,
  origin: string,
  catalogId: string,
  itemSchema: T,
  label: string,
): Promise<z.infer<T>[]> {
  const pageSchema = CoursedogPageSchema(itemSchema);
  const items: z.infer<T>[] = [];
  let skip = 0;

  console.log(`Fetching ${label}...`);

  while (true) {
    const url = `${endpoint}/search/%24filters?catalogId=${catalogId}&limit=${PAGE_SIZE}&skip=${skip}`;
    const page = await fetchPage(url, origin, pageSchema);
    items.push(...page.data);
    console.log(`  Fetched ${items.length}/${page.listLength} ${label}`);

    if (page.data.length < PAGE_SIZE || page.data.length === 0) break;
    skip += PAGE_SIZE;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`Done: ${items.length} ${label}`);
  return items;
}

export async function fetchAll(school: SchoolConfig): Promise<void> {
  const apiUrl = `${API_BASE}/cm/${school.coursedogSchoolId}`;
  const catalogId = await resolveCatalog(school);
  console.log(`Fetching ${school.slug} (catalog ${catalogId})`);

  const courses = await fetchAllPages<typeof CoursedogCourseSchema>(
    `${apiUrl}/courses`,
    school.origin,
    catalogId,
    CoursedogCourseSchema,
    "courses",
  );

  const programs = await fetchAllPages<typeof CoursedogProgramSchema>(
    `${apiUrl}/programs`,
    school.origin,
    catalogId,
    CoursedogProgramSchema,
    "programs",
  );

  // Write raw JSON to disk (slug charset is validated at config load — it is
  // a filesystem path component here).
  const outDir = path.resolve(process.cwd(), "data/raw", school.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "courses.json"), JSON.stringify(courses, null, 2));
  fs.writeFileSync(path.join(outDir, "programs.json"), JSON.stringify(programs, null, 2));

  console.log(`Saved ${courses.length} courses and ${programs.length} programs to ${outDir}`);
}
