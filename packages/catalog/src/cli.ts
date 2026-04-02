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

const command = process.argv[2];

if (command === "fetch") {
  requireEnvVars(["COURSEDOG_API_URL", "COURSEDOG_CATALOG_ID", "COURSEDOG_REFERER"]);
  const { fetchAll } = await import("./sources/coursedog.js");
  await fetchAll();
} else if (command === "seed") {
  requireEnvVars(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const { seed } = await import("./seed.js");
  await seed();
} else {
  console.log("Usage: major-map-catalog <fetch|seed>");
  process.exit(1);
}
