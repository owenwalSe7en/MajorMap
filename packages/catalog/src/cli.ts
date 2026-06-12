#!/usr/bin/env node
export {};

import { config } from "dotenv";
import path from "node:path";

// Load .env from repo root (two levels up from packages/catalog/)
config({ path: path.resolve(import.meta.dirname, "../../..", ".env") });

function requireEnvVars(vars: string[]): void {
  const missing = vars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

const args = process.argv.slice(2);
const command = args[0];

function parseSchoolArgs(): { slug: string | null; all: boolean } {
  let slug: string | null = null;
  let all = false;
  for (const arg of args.slice(1)) {
    if (arg === "--all") all = true;
    else if (arg.startsWith("--school=")) slug = arg.slice("--school=".length);
  }
  return { slug, all };
}

async function selectSchools() {
  const { loadSchools, schoolBySlugOrThrow } = await import("./schemas/school-config.js");
  const { slug, all } = parseSchoolArgs();
  if (all) return loadSchools();
  // Default to utah for backward compatibility with the original single-school CLI.
  return [schoolBySlugOrThrow(slug ?? "utah")];
}

if (command === "fetch") {
  const schools = await selectSchools();
  const { fetchAll } = await import("./sources/coursedog.js");
  for (const school of schools) {
    await fetchAll(school);
  }
} else if (command === "seed") {
  requireEnvVars(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const schools = await selectSchools();
  const { seed } = await import("./seed.js");
  const failures: string[] = [];
  for (const school of schools) {
    try {
      await seed(school);
    } catch (err) {
      console.error(`Seed failed for ${school.slug}:`, err instanceof Error ? err.message : err);
      failures.push(school.slug);
    }
  }
  if (failures.length > 0) {
    console.error(`Seed failed for: ${failures.join(", ")}`);
    process.exit(1);
  }
} else if (command === "probe") {
  const slugArg = args[1];
  const originArg = args[2];
  if (!slugArg || !originArg) {
    console.log("Usage: major-map-catalog probe <coursedogSchoolId> <origin>");
    console.log("Example: major-map-catalog probe byu https://catalog.byu.edu");
    process.exit(1);
  }
  const { probeSchool } = await import("./discovery/probe.js");
  await probeSchool(slugArg, originArg);
} else {
  console.log("Usage: major-map-catalog <fetch|seed|probe> [--school=<slug>|--all]");
  process.exit(1);
}
