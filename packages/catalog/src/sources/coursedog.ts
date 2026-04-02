import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  CoursedogCourseSchema,
  CoursedogProgramSchema,
  CoursedogPageSchema,
} from "../schemas/coursedog.js";

const PAGE_SIZE = 500;
const DELAY_MS = 200;

function getConfig() {
  const apiUrl = process.env.COURSEDOG_API_URL;
  const catalogId = process.env.COURSEDOG_CATALOG_ID;
  const referer = process.env.COURSEDOG_REFERER;
  if (!apiUrl || !catalogId || !referer) {
    throw new Error("Missing COURSEDOG_API_URL, COURSEDOG_CATALOG_ID, or COURSEDOG_REFERER");
  }
  return { apiUrl, catalogId, referer };
}

async function fetchPage<T extends z.ZodTypeAny>(
  url: string,
  referer: string,
  schema: ReturnType<typeof CoursedogPageSchema<T>>,
  retries = 3,
): Promise<z.infer<typeof schema>> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { Referer: referer, Origin: referer.replace(/\/$/, "") },
    });

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

async function fetchAllPages<T extends z.ZodTypeAny>(
  endpoint: string,
  referer: string,
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
    const page = await fetchPage(url, referer, pageSchema);
    items.push(...page.data);
    console.log(`  Fetched ${items.length}/${page.listLength} ${label}`);

    if (page.data.length < PAGE_SIZE || page.data.length === 0) break;
    skip += PAGE_SIZE;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`Done: ${items.length} ${label}`);
  return items;
}

export async function fetchAll(): Promise<void> {
  const { apiUrl, catalogId, referer } = getConfig();

  const courses = await fetchAllPages<typeof CoursedogCourseSchema>(
    `${apiUrl}/courses`,
    referer,
    catalogId,
    CoursedogCourseSchema,
    "courses",
  );

  const programs = await fetchAllPages<typeof CoursedogProgramSchema>(
    `${apiUrl}/programs`,
    referer,
    catalogId,
    CoursedogProgramSchema,
    "programs",
  );

  // Write raw JSON to disk
  const outDir = path.resolve(process.cwd(), "data/raw/utah");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "courses.json"), JSON.stringify(courses, null, 2));
  fs.writeFileSync(path.join(outDir, "programs.json"), JSON.stringify(programs, null, 2));

  console.log(`Saved ${courses.length} courses and ${programs.length} programs to ${outDir}`);
}
