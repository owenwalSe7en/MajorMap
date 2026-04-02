import { describe, expect, it } from "vitest";
import { suggestCourses } from "./engine.js";
import type { PrereqRule } from "../types.js";
import type { RequirementItem, CourseCatalogEntry } from "./engine.js";

// Helper factories
const makeReqItem = (courseId: string, label = "Core", parentLabel = "Core Requirements"): RequirementItem => ({
  id: `ri-${courseId}`,
  courseId,
  label,
  parentId: "parent-1",
  parentLabel,
});

const makeCatalogEntry = (id: string, code: string, title = "Course", credits = 3): CourseCatalogEntry => ({
  id, code, title, credits,
});

const makePrereqRule = (courseId: string, prereqId: string, group = "g1", op: "AND" | "OR" = "AND"): PrereqRule => ({
  courseId,
  prerequisiteCourseId: prereqId,
  groupId: group,
  groupOperator: op,
  isCorequisite: false,
});

describe("suggestCourses", () => {
  it("returns empty array when no requirements exist", () => {
    const result = suggestCourses([], [], [], []);
    expect(result).toEqual([]);
  });

  it("suggests all required courses for a fresh plan (no courses taken)", () => {
    const requirements = [
      makeReqItem("c1", "CS 1400"),
      makeReqItem("c2", "CS 1410"),
    ];
    const catalog = [
      makeCatalogEntry("c1", "CS 1400", "Intro to CS"),
      makeCatalogEntry("c2", "CS 1410", "OOP"),
    ];

    const result = suggestCourses([], requirements, [], catalog);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.courseId)).toContain("c1");
    expect(result.map((s) => s.courseId)).toContain("c2");
  });

  it("does not suggest courses already in the plan (completed)", () => {
    const planCourses = [{ courseId: "c1", status: "completed" as const }];
    const requirements = [
      makeReqItem("c1", "CS 1400"),
      makeReqItem("c2", "CS 1410"),
    ];
    const catalog = [
      makeCatalogEntry("c1", "CS 1400"),
      makeCatalogEntry("c2", "CS 1410"),
    ];

    const result = suggestCourses(planCourses, requirements, [], catalog);

    expect(result).toHaveLength(1);
    expect(result[0].courseId).toBe("c2");
  });

  it("does not suggest courses already in the plan (planned)", () => {
    const planCourses = [{ courseId: "c1", status: "planned" as const }];
    const requirements = [
      makeReqItem("c1", "CS 1400"),
      makeReqItem("c2", "CS 1410"),
    ];
    const catalog = [
      makeCatalogEntry("c1", "CS 1400"),
      makeCatalogEntry("c2", "CS 1410"),
    ];

    const result = suggestCourses(planCourses, requirements, [], catalog);

    expect(result).toHaveLength(1);
    expect(result[0].courseId).toBe("c2");
  });

  it("only suggests courses whose prereqs are met by completed courses", () => {
    const planCourses = [{ courseId: "c1", status: "completed" as const }];
    const requirements = [
      makeReqItem("c1", "CS 1400"),
      makeReqItem("c2", "CS 1410"),
      makeReqItem("c3", "CS 2420"),
    ];
    const catalog = [
      makeCatalogEntry("c1", "CS 1400"),
      makeCatalogEntry("c2", "CS 1410"),
      makeCatalogEntry("c3", "CS 2420"),
    ];
    const prereqs = [
      makePrereqRule("c2", "c1"),  // c2 requires c1 (met)
      makePrereqRule("c3", "c2"),  // c3 requires c2 (not met — c2 not completed)
    ];

    const result = suggestCourses(planCourses, requirements, prereqs, catalog);

    expect(result).toHaveLength(1);
    expect(result[0].courseId).toBe("c2");
    expect(result[0].reason).toContain("Required");
  });

  it("ranks courses that unlock more downstream courses higher", () => {
    const planCourses: Array<{ courseId: string; status?: string }> = [];
    const requirements = [
      makeReqItem("c1", "CS 1400"),
      makeReqItem("c2", "CS 1410"),
      makeReqItem("c3", "CS 2420"),
      makeReqItem("c4", "CS 3500"),
    ];
    const catalog = [
      makeCatalogEntry("c1", "CS 1400"),
      makeCatalogEntry("c2", "CS 1410"),
      makeCatalogEntry("c3", "CS 2420"),
      makeCatalogEntry("c4", "CS 3500"),
    ];
    // c1 unlocks c2, c3, c4 (chain: c1→c2→c3, c1→c4)
    // c2 unlocks c3
    const prereqs = [
      makePrereqRule("c2", "c1"),
      makePrereqRule("c3", "c2"),
      makePrereqRule("c4", "c1"),
    ];

    const result = suggestCourses(planCourses, requirements, prereqs, catalog);

    // Only c1 has all prereqs met (none). c2, c3, c4 need prereqs not completed.
    // c1 should be suggested first because it unlocks the most (c2 and c4 directly)
    expect(result[0].courseId).toBe("c1");
    expect(result[0].unlockCount).toBeGreaterThan(0);
  });

  it("returns empty when all requirements are planned or completed", () => {
    const planCourses = [
      { courseId: "c1", status: "completed" as const },
      { courseId: "c2", status: "planned" as const },
    ];
    const requirements = [
      makeReqItem("c1", "CS 1400"),
      makeReqItem("c2", "CS 1410"),
    ];
    const catalog = [
      makeCatalogEntry("c1", "CS 1400"),
      makeCatalogEntry("c2", "CS 1410"),
    ];

    const result = suggestCourses(planCourses, requirements, [], catalog);

    expect(result).toEqual([]);
  });

  it("includes category from parent requirement label", () => {
    const requirements = [
      makeReqItem("c1", "CS 1400", "Core Requirements"),
    ];
    const catalog = [makeCatalogEntry("c1", "CS 1400")];

    const result = suggestCourses([], requirements, [], catalog);

    expect(result[0].category).toBe("Core Requirements");
  });

  it("includes reason text explaining why course is suggested", () => {
    const requirements = [makeReqItem("c1", "CS 1400")];
    const catalog = [makeCatalogEntry("c1", "CS 1400", "Intro to CS")];

    const result = suggestCourses([], requirements, [], catalog);

    expect(result[0].reason).toBeTruthy();
    expect(result[0].code).toBe("CS 1400");
    expect(result[0].title).toBe("Intro to CS");
    expect(result[0].credits).toBe(3);
  });

  it("caps suggestions at 20", () => {
    const requirements = Array.from({ length: 30 }, (_, i) =>
      makeReqItem(`c${i}`, `CS ${1000 + i}`),
    );
    const catalog = Array.from({ length: 30 }, (_, i) =>
      makeCatalogEntry(`c${i}`, `CS ${1000 + i}`),
    );

    const result = suggestCourses([], requirements, [], catalog);

    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("skips requirement items with null courseId (group nodes)", () => {
    const requirements: RequirementItem[] = [
      { id: "ri-group", courseId: null, label: "Electives", parentId: null, parentLabel: "" },
      makeReqItem("c1", "CS 1400"),
    ];
    const catalog = [makeCatalogEntry("c1", "CS 1400")];

    const result = suggestCourses([], requirements, [], catalog);

    expect(result).toHaveLength(1);
    expect(result[0].courseId).toBe("c1");
  });
});
