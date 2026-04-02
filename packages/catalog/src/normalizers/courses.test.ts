import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { normalizeCourse, buildCourseGroupIdMap } from "./courses.js";
import { universityUuid } from "../uuid.js";

const fixtureDir = path.resolve(import.meta.dirname, "../../../../data/raw/fixtures");
const fixture = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "coursedog-courses-cs-sample.json"), "utf-8"),
);
const rawCourses = fixture.data;
const universityId = universityUuid("utah");

describe("normalizeCourse", () => {
  it("normalizes a basic course", () => {
    const cs1400 = rawCourses.find((c: Record<string, string>) => c.courseNumber === "1400");
    const result = normalizeCourse(cs1400, "utah", universityId);

    expect(result.subject_code).toBe("CS");
    expect(result.number).toBe("1400");
    expect(result.title).toBeTruthy();
    expect(result.credits_min).toBeGreaterThan(0);
    expect(result.credits_max).toBeGreaterThanOrEqual(result.credits_min);
    expect(result.coursedog_id).toBe(cs1400._id);
    expect(result.course_group_id).toBe(cs1400.courseGroupId);
  });

  it("generates deterministic IDs", () => {
    const cs1400 = rawCourses.find((c: Record<string, string>) => c.courseNumber === "1400");
    const r1 = normalizeCourse(cs1400, "utah", universityId);
    const r2 = normalizeCourse(cs1400, "utah", universityId);
    expect(r1.id).toBe(r2.id);
  });

  it("normalizes all fixture courses without errors", () => {
    const results = rawCourses.map((c: Record<string, unknown>) =>
      normalizeCourse(c as never, "utah", universityId),
    );
    expect(results.length).toBe(rawCourses.length);
    for (const r of results) {
      expect(r.id).toBeTruthy();
      expect(r.subject_code).toBeTruthy();
      expect(r.number).toBeTruthy();
    }
  });
});

describe("buildCourseGroupIdMap", () => {
  it("builds a map from courseGroupId to uuid", () => {
    const courses = rawCourses.map((c: Record<string, unknown>) =>
      normalizeCourse(c as never, "utah", universityId),
    );
    const map = buildCourseGroupIdMap(courses);
    expect(map.size).toBe(courses.length);
    for (const c of courses) {
      expect(map.get(c.course_group_id)).toBe(c.id);
    }
  });
});
