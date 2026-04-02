import { describe, expect, it } from "vitest";
import { computeOverlap } from "./overlap.js";

const credits = new Map<string, number>([
  ["c1", 3], ["c2", 4], ["c3", 3], ["c4", 3], ["c5", 3],
  ["c6", 3], ["c7", 3], ["c8", 4],
]);

describe("computeOverlap", () => {
  it("returns empty overlap for disjoint programs", () => {
    const result = computeOverlap(
      { programId: "a", programName: "CS", totalCredits: 120, courseIds: new Set(["c1", "c2"]) },
      { programId: "b", programName: "Math", totalCredits: 120, courseIds: new Set(["c3", "c4"]) },
      credits,
    );
    expect(result.shared).toEqual([]);
    expect(result.sharedCredits).toBe(0);
    expect(result.onlyA).toEqual(["c1", "c2"]);
    expect(result.onlyB).toEqual(["c3", "c4"]);
    expect(result.combinedUniqueCredits).toBe(13); // 3+4+3+3
  });

  it("returns full overlap for identical programs", () => {
    const courseIds = new Set(["c1", "c2", "c3"]);
    const result = computeOverlap(
      { programId: "a", programName: "CS", totalCredits: 120, courseIds },
      { programId: "b", programName: "CS Copy", totalCredits: 120, courseIds },
      credits,
    );
    expect(result.shared.sort()).toEqual(["c1", "c2", "c3"]);
    expect(result.sharedCredits).toBe(10); // 3+4+3
    expect(result.onlyA).toEqual([]);
    expect(result.onlyB).toEqual([]);
    expect(result.combinedUniqueCredits).toBe(10); // same as shared, no extra
  });

  it("handles partial overlap", () => {
    const result = computeOverlap(
      { programId: "a", programName: "CS", totalCredits: 120, courseIds: new Set(["c1", "c2", "c3"]) },
      { programId: "b", programName: "EE", totalCredits: 120, courseIds: new Set(["c2", "c3", "c4"]) },
      credits,
    );
    expect(result.shared.sort()).toEqual(["c2", "c3"]);
    expect(result.sharedCredits).toBe(7); // 4+3
    expect(result.onlyA).toEqual(["c1"]);
    expect(result.onlyB).toEqual(["c4"]);
    expect(result.combinedUniqueCredits).toBe(13); // 3+4+3+3
  });

  it("handles empty programs", () => {
    const result = computeOverlap(
      { programId: "a", programName: "Empty", totalCredits: 0, courseIds: new Set() },
      { programId: "b", programName: "Also Empty", totalCredits: 0, courseIds: new Set() },
      credits,
    );
    expect(result.shared).toEqual([]);
    expect(result.onlyA).toEqual([]);
    expect(result.onlyB).toEqual([]);
    expect(result.sharedCredits).toBe(0);
    expect(result.combinedUniqueCredits).toBe(0);
  });

  it("handles one empty program", () => {
    const result = computeOverlap(
      { programId: "a", programName: "CS", totalCredits: 120, courseIds: new Set(["c1", "c2"]) },
      { programId: "b", programName: "Empty", totalCredits: 0, courseIds: new Set() },
      credits,
    );
    expect(result.shared).toEqual([]);
    expect(result.onlyA).toEqual(["c1", "c2"]);
    expect(result.onlyB).toEqual([]);
    expect(result.combinedUniqueCredits).toBe(7);
  });

  it("uses 0 credits for courses not in credit map", () => {
    const result = computeOverlap(
      { programId: "a", programName: "CS", totalCredits: 120, courseIds: new Set(["unknown1"]) },
      { programId: "b", programName: "Math", totalCredits: 120, courseIds: new Set(["unknown1"]) },
      credits,
    );
    expect(result.shared).toEqual(["unknown1"]);
    expect(result.sharedCredits).toBe(0);
  });
});
