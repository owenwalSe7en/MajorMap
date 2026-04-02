#!/usr/bin/env node
export {};

const command = process.argv[2];

if (command === "fetch") {
  const { fetchAll } = await import("./sources/coursedog.js");
  await fetchAll();
} else if (command === "seed") {
  const { seed } = await import("./seed.js");
  await seed();
} else {
  console.log("Usage: major-map-catalog <fetch|seed>");
  process.exit(1);
}
