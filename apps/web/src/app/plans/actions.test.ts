import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Supabase mock builder
function mockSupabase(overrides: Record<string, unknown> = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return {
    from: vi.fn().mockReturnValue(chainable),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    _chain: chainable,
  };
}

let supabaseMock: ReturnType<typeof mockSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => supabaseMock),
}));

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock = mockSupabase();
});

describe("parseTranscriptAction", () => {
  it("returns error when not authenticated", async () => {
    supabaseMock.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { parseTranscriptAction } = await import("./actions.js");
    const result = await parseTranscriptAction("CS  1400  Intro  3.00  A");
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error for oversized input", async () => {
    const { parseTranscriptAction } = await import("./actions.js");
    const result = await parseTranscriptAction("x".repeat(60_000));
    expect(result).toEqual({ error: "Invalid input" });
  });

  it("returns empty matched when no courses parsed", async () => {
    const { parseTranscriptAction } = await import("./actions.js");
    const result = await parseTranscriptAction("no valid course lines here");
    expect(result).toHaveProperty("matched");
    expect((result as { matched: unknown[] }).matched).toEqual([]);
  });

  it("queries courses table with parsed codes", async () => {
    supabaseMock._chain.in = vi.fn().mockResolvedValue({
      data: [
        { id: "uuid-1", code: "CS 1400", title: "Intro to CS", credits: 3 },
      ],
    });

    const { parseTranscriptAction } = await import("./actions.js");
    const result = await parseTranscriptAction("CS  1400  Intro to CS  3.00  A");

    expect(supabaseMock.from).toHaveBeenCalledWith("courses");
    expect(result).toHaveProperty("matched");
    const matched = (result as { matched: Array<{ courseId: string; grade: string }> }).matched;
    expect(matched).toHaveLength(1);
    expect(matched[0].courseId).toBe("uuid-1");
    expect(matched[0].grade).toBe("A");
  });

  it("separates matched and unmatched courses", async () => {
    supabaseMock._chain.in = vi.fn().mockResolvedValue({
      data: [
        { id: "uuid-1", code: "CS 1400", title: "Intro to CS", credits: 3 },
      ],
    });

    const { parseTranscriptAction } = await import("./actions.js");
    const text = [
      "CS  1400  Intro to CS  3.00  A",
      "FAKE  9999  Not Real  3.00  B",
    ].join("\n");
    const result = await parseTranscriptAction(text) as {
      matched: Array<{ code: string }>;
      unmatched: Array<{ subjectCode: string }>;
    };

    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].subjectCode).toBe("FAKE");
  });

  it("sets isPassingGrade correctly", async () => {
    supabaseMock._chain.in = vi.fn().mockResolvedValue({
      data: [
        { id: "uuid-1", code: "CS 1400", title: "Intro", credits: 3 },
        { id: "uuid-2", code: "CS 1410", title: "OOP", credits: 3 },
      ],
    });

    const { parseTranscriptAction } = await import("./actions.js");
    const text = [
      "CS  1400  Intro  3.00  A",
      "CS  1410  OOP  3.00  W",
    ].join("\n");
    const result = await parseTranscriptAction(text) as {
      matched: Array<{ grade: string; isPassingGrade: boolean }>;
    };

    expect(result.matched.find((m) => m.grade === "A")?.isPassingGrade).toBe(true);
    expect(result.matched.find((m) => m.grade === "W")?.isPassingGrade).toBe(false);
  });
});

describe("importTranscriptCourses", () => {
  it("returns error when not authenticated", async () => {
    supabaseMock.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { importTranscriptCourses } = await import("./actions.js");
    const result = await importTranscriptCourses("plan-1", [{ courseId: "c1", grade: "A" }]);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error for empty courses array", async () => {
    const { importTranscriptCourses } = await import("./actions.js");
    const result = await importTranscriptCourses("plan-1", []);
    expect(result).toEqual({ error: "No courses to import" });
  });

  it("returns error when plan not found", async () => {
    supabaseMock._chain.single = vi.fn().mockResolvedValue({ data: null, error: null });

    const { importTranscriptCourses } = await import("./actions.js");
    const result = await importTranscriptCourses("plan-1", [{ courseId: "c1", grade: "A" }]);
    expect(result).toEqual({ error: "Plan not found" });
  });

  it("creates Prior Coursework semester and upserts courses on success", async () => {
    // Plan exists
    let callCount = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ data: { id: "plan-1" }, error: null }); // plan check
      return Promise.resolve({ data: { id: "sem-new" }, error: null }); // semester insert
    });
    // No existing semester
    supabaseMock._chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    // Valid courses
    supabaseMock._chain.in = vi.fn().mockResolvedValue({
      data: [{ id: "c1" }],
    });
    // Upsert succeeds
    supabaseMock._chain.upsert = vi.fn().mockResolvedValue({ error: null });

    const { importTranscriptCourses } = await import("./actions.js");
    const result = await importTranscriptCourses("plan-1", [{ courseId: "c1", grade: "A" }]);

    expect(result).toEqual({ success: true, importedCount: 1 });
  });
});
