import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SCHOOLS } from "@major-map/shared";
import { SchoolConfigSchema, loadSchools } from "./school-config.js";
import { universityUuid } from "../uuid.js";

const VALID = {
  slug: "utah",
  name: "University of Utah",
  coursedogSchoolId: "utah_peoplesoft",
  origin: "https://catalog.utah.edu",
  catalogUrl: "https://catalog.utah.edu",
};

describe("SchoolConfigSchema", () => {
  it("accepts a valid entry (catalogId optional)", () => {
    expect(SchoolConfigSchema.parse(VALID).slug).toBe("utah");
    expect(SchoolConfigSchema.parse({ ...VALID, catalogId: "abc123" }).catalogId).toBe("abc123");
  });

  it("rejects slugs that would shadow a static web route", () => {
    expect(() => SchoolConfigSchema.parse({ ...VALID, slug: "plans" })).toThrow();
    expect(() => SchoolConfigSchema.parse({ ...VALID, slug: "auth" })).toThrow();
  });

  it("rejects malformed slugs (they become filesystem paths and URLs)", () => {
    expect(() => SchoolConfigSchema.parse({ ...VALID, slug: "../escape" })).toThrow();
    expect(() => SchoolConfigSchema.parse({ ...VALID, slug: "Has Spaces" })).toThrow();
    expect(() => SchoolConfigSchema.parse({ ...VALID, slug: "" })).toThrow();
  });

  it("requires https origins", () => {
    expect(() =>
      SchoolConfigSchema.parse({ ...VALID, origin: "http://catalog.utah.edu" }),
    ).toThrow();
    expect(() => SchoolConfigSchema.parse({ ...VALID, origin: "not-a-url" })).toThrow();
  });
});

describe("schools.json", () => {
  it("parses and validates", () => {
    const schools = loadSchools();
    expect(schools.length).toBeGreaterThan(0);
    expect(schools[0].slug).toBe("utah");
  });

  it("has unique slugs", () => {
    const schools = loadSchools();
    expect(new Set(schools.map((s) => s.slug)).size).toBe(schools.length);
  });

  it("stays in sync with the shared SCHOOLS registry (slug + deterministic id)", () => {
    // The web app resolves /[school] routes against SCHOOLS without a DB
    // lookup; every pipeline school must exist there with the uuidv5 id the
    // seed will actually write.
    const schools = loadSchools();
    for (const school of schools) {
      const ref = SCHOOLS.find((s) => s.slug === school.slug);
      expect(ref, `shared SCHOOLS is missing "${school.slug}"`).toBeDefined();
      expect(ref!.universityId).toBe(universityUuid(school.slug));
      expect(ref!.name).toBe(school.name);
    }
  });

  it("exists on disk where the CLI expects it", () => {
    expect(fs.existsSync(path.resolve(import.meta.dirname, "../../schools.json"))).toBe(true);
  });
});
