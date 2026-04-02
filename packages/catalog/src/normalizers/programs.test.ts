import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { normalizeProgram } from "./programs.js";
import { universityUuid } from "../uuid.js";

const fixtureDir = path.resolve(import.meta.dirname, "../../../../data/raw/fixtures");
const fixture = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "coursedog-programs-sample.json"), "utf-8"),
);
const rawPrograms = fixture.data;
const universityId = universityUuid("utah");

describe("normalizeProgram", () => {
  it("normalizes CS BS program", () => {
    const csbs = rawPrograms.find((p: Record<string, string>) => p.code === "CPSCBS");
    if (!csbs) throw new Error("CPSCBS not in fixtures");

    const result = normalizeProgram(csbs, "utah", universityId);

    expect(result.name).toBe("Computer Science");
    expect(result.degree_type).toBeTruthy();
    expect(result.slug).toContain("computer-science");
    expect(result.university_id).toBe(universityId);
    expect(result.total_credits).toBe(120);
  });

  it("generates deterministic IDs", () => {
    const csbs = rawPrograms.find((p: Record<string, string>) => p.code === "CPSCBS");
    const r1 = normalizeProgram(csbs, "utah", universityId);
    const r2 = normalizeProgram(csbs, "utah", universityId);
    expect(r1.id).toBe(r2.id);
  });

  it("generates unique slugs for different programs", () => {
    const results = rawPrograms.map((p: Record<string, unknown>) =>
      normalizeProgram(p as never, "utah", universityId),
    );
    const slugs = results.map((r: Record<string, string>) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
