import { describe, expect, it } from "vitest";
import {
  COURSES_PAGE_SIZE,
  MAX_PAGE,
  PROGRAMS_PAGE_SIZE,
  courseSearchOr,
  lastPageFor,
  pageHref,
  pageNumbers,
  rangeBounds,
  sanitizeCodeSearch,
  sanitizePage,
  sanitizeSearchText,
  showingRange,
} from "./browse.js";

describe("sanitizePage", () => {
  it("defaults to 1 for undefined", () => {
    expect(sanitizePage(undefined)).toBe(1);
  });

  it("defaults to 1 for non-numeric input", () => {
    expect(sanitizePage("abc")).toBe(1);
    expect(sanitizePage("")).toBe(1);
    expect(sanitizePage("1.5e99")).toBe(1);
  });

  it("defaults to 1 for zero and negatives", () => {
    expect(sanitizePage("0")).toBe(1);
    expect(sanitizePage("-1")).toBe(1);
  });

  it("parses valid pages", () => {
    expect(sanitizePage("1")).toBe(1);
    expect(sanitizePage("37")).toBe(37);
  });

  it("caps at MAX_PAGE so huge offsets never reach the DB", () => {
    expect(sanitizePage("999999999999")).toBe(MAX_PAGE);
    expect(sanitizePage(String(Number.MAX_SAFE_INTEGER + 2))).toBe(MAX_PAGE);
  });
});

describe("lastPageFor", () => {
  it("is 1 for empty or null counts", () => {
    expect(lastPageFor(0, 50)).toBe(1);
    expect(lastPageFor(null, 50)).toBe(1);
  });

  it("rounds up partial pages", () => {
    expect(lastPageFor(101, 50)).toBe(3);
    expect(lastPageFor(100, 50)).toBe(2);
    expect(lastPageFor(1, 50)).toBe(1);
  });
});

describe("rangeBounds", () => {
  it("computes inclusive supabase range bounds", () => {
    expect(rangeBounds(1, 50)).toEqual({ from: 0, to: 49 });
    expect(rangeBounds(3, 24)).toEqual({ from: 48, to: 71 });
  });
});

describe("showingRange", () => {
  it("computes human-facing bounds", () => {
    expect(showingRange(1, 50, 120)).toEqual({ start: 1, end: 50 });
    expect(showingRange(3, 50, 120)).toEqual({ start: 101, end: 120 });
  });

  it("handles empty results", () => {
    expect(showingRange(1, 50, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe("sanitizeSearchText", () => {
  it("strips ilike wildcards and caps length", () => {
    expect(sanitizeSearchText("intro%_to")).toBe("introto");
    expect(sanitizeSearchText("a".repeat(200))).toHaveLength(100);
  });

  it("strips PostgREST .or() syntax characters", () => {
    expect(sanitizeSearchText("x,id.not.is.null")).toBe("xidnotisnull");
    expect(sanitizeSearchText("a(b)c")).toBe("abc");
  });
});

describe("sanitizeCodeSearch", () => {
  it("whitelists alphanumerics and spaces only", () => {
    expect(sanitizeCodeSearch("CS 3500")).toBe("CS 3500");
    expect(sanitizeCodeSearch("x,id.not.is.null")).toBe("xidnotisnull");
    expect(sanitizeCodeSearch("a(b)%_'\"\\c")).toBe("abc");
  });

  it("collapses runs of whitespace", () => {
    expect(sanitizeCodeSearch("CS    3500")).toBe("CS 3500");
  });
});

describe("courseSearchOr", () => {
  it("returns null for empty input", () => {
    expect(courseSearchOr("")).toBeNull();
    expect(courseSearchOr("  ")).toBeNull();
    expect(courseSearchOr(",.()")).toBeNull();
  });

  it("matches title and code with sanitized input", () => {
    expect(courseSearchOr("CS 3500")).toBe("title.ilike.%CS 3500%,code.ilike.%CS 3500%");
  });

  it("cannot be used to inject extra disjuncts", () => {
    const or = courseSearchOr("x,id.not.is.null");
    expect(or).toBe("title.ilike.%xidnotisnull%,code.ilike.%xidnotisnull%");
  });
});

describe("pageHref", () => {
  it("omits page=1 for canonical first-page URLs", () => {
    expect(pageHref("/programs", { q: "bio" }, 1)).toBe("/programs?q=bio");
    expect(pageHref("/programs", {}, 1)).toBe("/programs");
  });

  it("preserves existing filters", () => {
    expect(pageHref("/courses", { q: "intro", dept: "CS" }, 3)).toBe(
      "/courses?q=intro&dept=CS&page=3",
    );
  });

  it("skips empty params", () => {
    expect(pageHref("/courses", { q: undefined, dept: "" }, 2)).toBe("/courses?page=2");
  });
});

describe("pageNumbers", () => {
  it("lists all pages when few", () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
  });

  it("windows around the current page with ellipses", () => {
    expect(pageNumbers(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });

  it("keeps first and last visible at the edges", () => {
    expect(pageNumbers(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(pageNumbers(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });
});

describe("page size constants", () => {
  it("are positive", () => {
    expect(PROGRAMS_PAGE_SIZE).toBeGreaterThan(0);
    expect(COURSES_PAGE_SIZE).toBeGreaterThan(0);
  });
});
