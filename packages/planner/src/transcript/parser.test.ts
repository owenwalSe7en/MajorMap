import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseTranscript,
  PASSING_GRADE_SET,
  GRADE_RANK,
} from "./parser.js";

const FIXTURE_PATH = join(__dirname, "../../../../data/raw/fixtures/uofu-transcript-sample.txt");

describe("parseTranscript", () => {
  it("parses standard UofU transcript fixture", () => {
    const text = readFileSync(FIXTURE_PATH, "utf-8");
    const result = parseTranscript(text);

    // Fixture has 20 course lines (ECON 1010 appears twice — dedup keeps highest grade)
    expect(result.courses.length).toBe(19);
    expect(result.totalCredits).toBeGreaterThan(0);
    expect(result.skippedLines).toBeGreaterThan(0); // Headers, GPA lines, etc.
  });

  it("extracts correct fields from a simple line", () => {
    const text = "CS  1400  Introduction to Computer Science  3.00  A";
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(1);
    expect(result.courses[0]).toEqual({
      subjectCode: "CS",
      number: "1400",
      title: "Introduction to Computer Science",
      credits: 3.0,
      grade: "A",
    });
  });

  it("handles plus and minus grades", () => {
    const text = [
      "MATH  1210  Calculus I  4.00  A-",
      "MATH  1220  Calculus II  4.00  B+",
      "MATH  2210  Calculus III  3.00  C+",
    ].join("\n");
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(3);
    expect(result.courses[0].grade).toBe("A-");
    expect(result.courses[1].grade).toBe("B+");
    expect(result.courses[2].grade).toBe("C+");
  });

  it("handles special grades: CR, P, W, I, E", () => {
    const text = [
      "PHIL  1000  Introduction to Philosophy  3.00  CR",
      "BIOL  1010  General Biology  3.00  P",
      "ECON  1010  Economics  3.00  W",
      "CS  3100  Models of Computation  3.00  I",
      "CS  4150  Algorithms  3.00  E",
    ].join("\n");
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(5);
    expect(result.courses.map((c) => c.grade)).toEqual(["CR", "P", "W", "I", "E"]);
  });

  it("handles NC, NP, S, U grades", () => {
    const text = [
      "ART  1000  Intro to Art  3.00  NC",
      "MUS  1010  Music Theory  3.00  NP",
      "PE  1000  Fitness  1.00  S",
      "PE  1010  Swimming  1.00  U",
    ].join("\n");
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(4);
    expect(result.courses.map((c) => c.grade)).toEqual(["NC", "NP", "S", "U"]);
  });

  it("returns empty result for empty input", () => {
    const result = parseTranscript("");
    expect(result.courses).toEqual([]);
    expect(result.totalCredits).toBe(0);
    expect(result.skippedLines).toBe(0);
  });

  it("returns empty result for whitespace-only input", () => {
    const result = parseTranscript("   \n  \n  ");
    expect(result.courses).toEqual([]);
    expect(result.totalCredits).toBe(0);
  });

  it("skips header, footer, and GPA summary lines", () => {
    const text = [
      "University of Utah",
      "Unofficial Academic Transcript",
      "",
      "Student: Jane Doe",
      "Student ID: u1234567",
      "",
      "------- Fall Semester 2022 -------",
      "",
      "CS  1400  Introduction to Computer Science  3.00  A",
      "",
      "Term GPA: 4.00   Term Credits: 3.00",
      "",
      "Cumulative GPA: 4.00",
      "Total Credits Earned: 3.00",
    ].join("\n");
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(1);
    expect(result.courses[0].subjectCode).toBe("CS");
    expect(result.skippedLines).toBeGreaterThan(0);
  });

  it("skips malformed lines", () => {
    const text = [
      "This is not a course line",
      "CS  1400  Introduction to Computer Science  3.00  A",
      "12345",
      "just random text here with numbers 123",
    ].join("\n");
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(1);
    expect(result.skippedLines).toBe(3);
  });

  it("deduplicates repeated courses, keeping highest grade", () => {
    const text = [
      "ECON  1010  Economics as a Social Science  3.00  W",
      "ECON  1010  Economics as a Social Science  3.00  B",
    ].join("\n");
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(1);
    expect(result.courses[0].grade).toBe("B");
    expect(result.courses[0].credits).toBe(3.0);
  });

  it("deduplicates keeping A over B+", () => {
    const text = [
      "CS  1400  Intro to CS  3.00  B+",
      "CS  1400  Intro to CS  3.00  A",
    ].join("\n");
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(1);
    expect(result.courses[0].grade).toBe("A");
  });

  it("handles courses with honors suffix in number", () => {
    const text = "CHEM  1210H  General Chemistry Honors  4.00  A";
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(1);
    expect(result.courses[0].number).toBe("1210H");
  });

  it("handles 5-character subject codes", () => {
    const text = "CVEEN  3100  Environmental Engineering  3.00  B";
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(1);
    expect(result.courses[0].subjectCode).toBe("CVEEN");
  });

  it("computes totalCredits from all parsed courses", () => {
    const text = [
      "CS  1400  Intro to CS  3.00  A",
      "MATH  1210  Calculus I  4.00  B",
    ].join("\n");
    const result = parseTranscript(text);

    expect(result.totalCredits).toBe(7.0);
  });

  it("does not hang on long lines (ReDoS safety)", () => {
    // A line with many spaces but no valid credits/grade pattern
    const longLine = "AA  1234  " + "word ".repeat(200) + "no match here";
    const start = performance.now();
    const result = parseTranscript(longLine);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100); // Should complete in <100ms
    expect(result.courses).toHaveLength(0);
  });

  it("handles lines with tab characters as delimiters", () => {
    const text = "CS\t\t1400\t\tIntroduction to Computer Science\t\t3.00\t\tA";
    const result = parseTranscript(text);

    expect(result.courses).toHaveLength(1);
    expect(result.courses[0].subjectCode).toBe("CS");
  });

  it("caps lines at 500 characters", () => {
    const longLine = "CS  1400  " + "x".repeat(600) + "  3.00  A";
    const result = parseTranscript(longLine);

    expect(result.courses).toHaveLength(0); // Line too long, skipped
  });
});

describe("PASSING_GRADE_SET", () => {
  it("includes standard letter grades A through D-", () => {
    for (const g of ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-"]) {
      expect(PASSING_GRADE_SET.has(g)).toBe(true);
    }
  });

  it("includes CR, P, S", () => {
    expect(PASSING_GRADE_SET.has("CR")).toBe(true);
    expect(PASSING_GRADE_SET.has("P")).toBe(true);
    expect(PASSING_GRADE_SET.has("S")).toBe(true);
  });

  it("excludes W, I, E, NC, NP, U", () => {
    for (const g of ["W", "I", "E", "NC", "NP", "U"]) {
      expect(PASSING_GRADE_SET.has(g)).toBe(false);
    }
  });
});

describe("GRADE_RANK", () => {
  it("ranks A higher than A-", () => {
    expect(GRADE_RANK.A).toBeGreaterThan(GRADE_RANK["A-"]);
  });

  it("ranks A- higher than B+", () => {
    expect(GRADE_RANK["A-"]).toBeGreaterThan(GRADE_RANK["B+"]);
  });

  it("ranks W lower than E", () => {
    expect(GRADE_RANK.W).toBeLessThan(GRADE_RANK.E);
  });
});
