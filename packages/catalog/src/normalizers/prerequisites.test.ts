import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { normalizePrerequisites } from "./prerequisites.js";
import { normalizeCourse, buildCourseGroupIdMap } from "./courses.js";
import { universityUuid } from "../uuid.js";

const fixtureDir = path.resolve(import.meta.dirname, "../../../../data/raw/fixtures");
const fixture = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "coursedog-courses-cs-sample.json"), "utf-8"),
);
const rawCourses = fixture.data;
const universityId = universityUuid("utah");

const normalizedCourses = rawCourses.map((c: Record<string, unknown>) =>
  normalizeCourse(c as never, "utah", universityId),
);
const courseGroupIdMap = buildCourseGroupIdMap(normalizedCourses);

describe("normalizePrerequisites", () => {
  it("extracts prerequisites for CS 3500", () => {
    const cs3500raw = rawCourses.find((c: Record<string, string>) => c.courseNumber === "3500");
    const cs3500 = normalizedCourses.find(
      (c: Record<string, string>) => c.number === "3500" && c.subject_code === "CS",
    );
    if (!cs3500raw || !cs3500) throw new Error("CS 3500 not in fixtures");

    const { prereqs, warnings } = normalizePrerequisites(cs3500raw, cs3500.id, courseGroupIdMap);

    expect(prereqs.length).toBeGreaterThan(0);
    expect(prereqs.every((p: Record<string, string>) => p.course_id === cs3500.id)).toBe(true);

    // Some prereqs should resolve to known courses
    const resolved = prereqs.filter((p: Record<string, string | null>) => p.prerequisite_course_id !== null);
    expect(resolved.length).toBeGreaterThan(0);

    console.log(`CS 3500: ${prereqs.length} prereq rules, ${resolved.length} resolved, ${warnings.length} warnings`);
  });

  it("handles courses with no prerequisites", () => {
    const cs1000raw = rawCourses.find((c: Record<string, string>) => c.courseNumber === "1000");
    const cs1000 = normalizedCourses.find(
      (c: Record<string, string>) => c.number === "1000" && c.subject_code === "CS",
    );
    if (!cs1000raw || !cs1000) throw new Error("CS 1000 not in fixtures");

    const { prereqs, warnings } = normalizePrerequisites(cs1000raw, cs1000.id, courseGroupIdMap);
    expect(warnings.length).toBe(0);
    // CS 1000 may or may not have prereqs depending on catalog data
  });

  it("logs warnings for dangling references", () => {
    // Create a course with a fake prereq reference
    const fakeCourse = {
      ...rawCourses[0],
      requisites: {
        requisitesSimple: [
          {
            id: "test-group",
            name: "Test",
            type: "Prerequisite",
            rules: [
              {
                id: "rule-1",
                condition: "minimumGrade",
                value: {
                  condition: "courses",
                  values: [{ value: ["NONEXISTENT_ID"], logic: "and" }],
                },
                grade: "C",
              },
            ],
          },
        ],
      },
    };

    const { warnings } = normalizePrerequisites(fakeCourse, "test-course-id", courseGroupIdMap);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("Dangling prereq ref");
  });
});
