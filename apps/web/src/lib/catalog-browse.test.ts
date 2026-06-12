import { describe, expect, it, vi } from "vitest";
import { fetchCoursesPage, fetchProgramsPage } from "./catalog-browse.js";
import { UTAH_UNIVERSITY_ID } from "@major-map/shared";

interface QueryResult {
  data: unknown[];
  count: number | null;
  error: null;
}

// Thenable chainable mimicking the supabase query builder.
function mockQuery(result: QueryResult) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string, args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  const chain: Record<string, unknown> = {
    then: (resolve: (r: QueryResult) => void) => Promise.resolve(result).then(resolve),
  };
  for (const m of ["select", "order", "range", "eq", "ilike", "or"]) {
    chain[m] = vi.fn((...args: unknown[]) => {
      record(m, args);
      return chain;
    });
  }
  const supabase = { from: vi.fn(() => chain) };
  return { supabase, chain, calls };
}

describe("fetchProgramsPage", () => {
  it("scopes to the university, orders stably, and paginates", async () => {
    const { supabase, calls } = mockQuery({ data: [{ id: "p1" }], count: 593, error: null });

    const result = await fetchProgramsPage(supabase, {
      page: 2,
      universityId: UTAH_UNIVERSITY_ID,
    });

    expect(supabase.from).toHaveBeenCalledWith("programs");
    expect(calls.select?.[0]?.[1]).toEqual({ count: "exact" });
    expect(calls.eq?.[0]).toEqual(["university_id", UTAH_UNIVERSITY_ID]);
    expect(calls.eq?.[1]).toEqual(["is_discontinued", false]);
    expect(calls.order?.map((c) => c[0])).toEqual(["name", "id"]);
    expect(calls.range?.[0]).toEqual([24, 47]);
    expect(result.count).toBe(593);
    expect(result.lastPage).toBe(Math.ceil(593 / 24));
    expect(result.outOfRange).toBe(false);
  });

  it("applies sanitized name search and type filter", async () => {
    const { supabase, calls } = mockQuery({ data: [], count: 0, error: null });

    await fetchProgramsPage(supabase, {
      page: 1,
      q: "bio%_",
      type: "Bachelor of Science",
      universityId: UTAH_UNIVERSITY_ID,
    });

    expect(calls.ilike?.[0]).toEqual(["name", "%bio%"]);
    expect(calls.eq?.map((c) => c[0])).toContain("degree_type");
  });

  it("flags out-of-range pages so callers can redirect-clamp", async () => {
    const { supabase } = mockQuery({ data: [], count: 100, error: null });

    const result = await fetchProgramsPage(supabase, {
      page: 50,
      universityId: UTAH_UNIVERSITY_ID,
    });

    expect(result.outOfRange).toBe(true);
    expect(result.lastPage).toBe(Math.ceil(100 / 24));
  });

  it("scopes to whichever universityId the caller passes", async () => {
    const { supabase, calls } = mockQuery({ data: [], count: 0, error: null });

    await fetchProgramsPage(supabase, { page: 1, universityId: "other-uni" });

    expect(calls.eq?.[0]).toEqual(["university_id", "other-uni"]);
  });
});

describe("fetchCoursesPage", () => {
  it("scopes, orders by code with id tiebreak, and paginates", async () => {
    const { supabase, calls } = mockQuery({ data: [], count: 17892, error: null });

    const result = await fetchCoursesPage(supabase, {
      page: 1,
      universityId: UTAH_UNIVERSITY_ID,
    });

    expect(supabase.from).toHaveBeenCalledWith("courses");
    expect(calls.eq?.[0]).toEqual(["university_id", UTAH_UNIVERSITY_ID]);
    expect(calls.eq?.[1]).toEqual(["is_discontinued", false]);
    expect(calls.order?.map((c) => c[0])).toEqual(["subject_code", "number", "id"]);
    expect(calls.range?.[0]).toEqual([0, 49]);
    expect(result.count).toBe(17892);
  });

  it("searches title and code through a sanitized .or() with separate scoping eq", async () => {
    const { supabase, calls } = mockQuery({ data: [], count: 0, error: null });

    await fetchCoursesPage(supabase, {
      page: 1,
      q: "CS 3500,id.not.is.null",
      universityId: UTAH_UNIVERSITY_ID,
    });

    // university scoping must stay a chained .eq, never inside the .or string
    expect(calls.eq?.[0]).toEqual(["university_id", UTAH_UNIVERSITY_ID]);
    expect(calls.or?.[0]?.[0]).toBe(
      "title.ilike.%CS 3500idnotisnull%,code.ilike.%CS 3500idnotisnull%",
    );
  });

  it("applies the dept filter with existing sanitization", async () => {
    const { supabase, calls } = mockQuery({ data: [], count: 0, error: null });

    await fetchCoursesPage(supabase, {
      page: 1,
      dept: "cs!",
      universityId: UTAH_UNIVERSITY_ID,
    });

    expect(calls.eq?.map((c) => c.join("="))).toContain("subject_code=CS");
  });
});
