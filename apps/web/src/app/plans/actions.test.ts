import { describe, expect, it, vi, beforeEach } from "vitest";
import { UTAH_UNIVERSITY_ID } from "@major-map/shared";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Supabase mock builder
function mockSupabase(overrides: Record<string, unknown> = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
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

const TRANSCRIPT_PLAN_ID = "55555555-5555-4555-8555-555555555555";

function mockPlanLookup(universityId: string | null = null) {
  supabaseMock._chain.single = vi.fn().mockResolvedValue({
    data: { id: TRANSCRIPT_PLAN_ID, university_id: universityId },
    error: null,
  });
}

describe("parseTranscriptAction", () => {
  it("returns error when not authenticated", async () => {
    supabaseMock.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { parseTranscriptAction } = await import("./actions.js");
    const result = await parseTranscriptAction(TRANSCRIPT_PLAN_ID, "CS  1400  Intro  3.00  A");
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error for oversized input", async () => {
    const { parseTranscriptAction } = await import("./actions.js");
    const result = await parseTranscriptAction(TRANSCRIPT_PLAN_ID, "x".repeat(60_000));
    expect(result).toEqual({ error: "Invalid input" });
  });

  it("rejects plans the caller does not own", async () => {
    supabaseMock._chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    const { parseTranscriptAction } = await import("./actions.js");
    const result = await parseTranscriptAction(TRANSCRIPT_PLAN_ID, "CS  1400  Intro  3.00  A");
    expect(result).toEqual({ error: "Plan not found" });
  });

  it("returns empty matched when no courses parsed", async () => {
    mockPlanLookup();
    const { parseTranscriptAction } = await import("./actions.js");
    const result = await parseTranscriptAction(TRANSCRIPT_PLAN_ID, "no valid course lines here");
    expect(result).toHaveProperty("matched");
    expect((result as { matched: unknown[] }).matched).toEqual([]);
  });

  it("queries courses scoped to the plan's university", async () => {
    mockPlanLookup("uni-123");
    supabaseMock._chain.in = vi.fn().mockResolvedValue({
      data: [{ id: "uuid-1", code: "CS 1400", title: "Intro to CS", credits: 3 }],
    });

    const { parseTranscriptAction } = await import("./actions.js");
    const result = await parseTranscriptAction(
      TRANSCRIPT_PLAN_ID,
      "CS  1400  Intro to CS  3.00  A",
    );

    expect(supabaseMock.from).toHaveBeenCalledWith("courses");
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith("university_id", "uni-123");
    expect(result).toHaveProperty("matched");
    const matched = (result as { matched: Array<{ courseId: string; grade: string }> }).matched;
    expect(matched).toHaveLength(1);
    expect(matched[0].courseId).toBe("uuid-1");
    expect(matched[0].grade).toBe("A");
  });

  it("separates matched and unmatched courses", async () => {
    mockPlanLookup();
    supabaseMock._chain.in = vi.fn().mockResolvedValue({
      data: [{ id: "uuid-1", code: "CS 1400", title: "Intro to CS", credits: 3 }],
    });

    const { parseTranscriptAction } = await import("./actions.js");
    const text = ["CS  1400  Intro to CS  3.00  A", "FAKE  9999  Not Real  3.00  B"].join("\n");
    const result = (await parseTranscriptAction(TRANSCRIPT_PLAN_ID, text)) as {
      matched: Array<{ code: string }>;
      unmatched: Array<{ subjectCode: string }>;
    };

    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].subjectCode).toBe("FAKE");
  });

  it("sets isPassingGrade correctly", async () => {
    mockPlanLookup();
    supabaseMock._chain.in = vi.fn().mockResolvedValue({
      data: [
        { id: "uuid-1", code: "CS 1400", title: "Intro", credits: 3 },
        { id: "uuid-2", code: "CS 1410", title: "OOP", credits: 3 },
      ],
    });

    const { parseTranscriptAction } = await import("./actions.js");
    const text = ["CS  1400  Intro  3.00  A", "CS  1410  OOP  3.00  W"].join("\n");
    const result = (await parseTranscriptAction(TRANSCRIPT_PLAN_ID, text)) as {
      matched: Array<{ grade: string; isPassingGrade: boolean }>;
    };

    expect(result.matched.find((m) => m.grade === "A")?.isPassingGrade).toBe(true);
    expect(result.matched.find((m) => m.grade === "W")?.isPassingGrade).toBe(false);
  });
});

const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const PROGRAM_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PROGRAM_ID = "33333333-3333-4333-8333-333333333333";

describe("setPlanProgram", () => {
  it("returns error when not authenticated", async () => {
    supabaseMock.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { setPlanProgram } = await import("./actions.js");
    const result = await setPlanProgram(PLAN_ID, PROGRAM_ID);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("rejects malformed UUIDs before any query", async () => {
    const { setPlanProgram } = await import("./actions.js");
    expect(await setPlanProgram("not-a-uuid", PROGRAM_ID)).toEqual({ error: "Invalid plan" });
    expect(await setPlanProgram(PLAN_ID, "nope")).toEqual({ error: "Invalid program" });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("treats a missing/foreign plan as not found (never silent success)", async () => {
    supabaseMock._chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    const { setPlanProgram } = await import("./actions.js");
    const result = await setPlanProgram(PLAN_ID, PROGRAM_ID);
    expect(result).toEqual({ error: "Plan not found" });
  });

  it("rejects setting the program that is already secondary", async () => {
    supabaseMock._chain.single = vi.fn().mockResolvedValue({
      data: { id: PLAN_ID, secondary_program_id: PROGRAM_ID },
      error: null,
    });
    const { setPlanProgram } = await import("./actions.js");
    const result = await setPlanProgram(PLAN_ID, PROGRAM_ID);
    expect(result).toEqual({ error: "That program is already your comparison program" });
  });

  it("rejects a program that does not exist", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1)
        return Promise.resolve({ data: { id: PLAN_ID, secondary_program_id: null }, error: null });
      return Promise.resolve({ data: null, error: null }); // program lookup
    });
    const { setPlanProgram } = await import("./actions.js");
    const result = await setPlanProgram(PLAN_ID, PROGRAM_ID);
    expect(result).toEqual({ error: "Program not found" });
  });

  it("rejects programs from a different school", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1)
        return Promise.resolve({
          data: { id: PLAN_ID, secondary_program_id: null, university_id: "uni-1" },
          error: null,
        });
      return Promise.resolve({ data: { id: PROGRAM_ID, university_id: "uni-2" }, error: null });
    });
    const { setPlanProgram } = await import("./actions.js");
    const result = await setPlanProgram(PLAN_ID, PROGRAM_ID);
    expect(result).toEqual({ error: "That program belongs to a different school" });
  });

  it("rejects cross-school programs even when the plan's university is null (legacy rows)", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1)
        return Promise.resolve({
          data: { id: PLAN_ID, secondary_program_id: null, university_id: null },
          error: null,
        });
      return Promise.resolve({ data: { id: PROGRAM_ID, university_id: "uni-2" }, error: null });
    });
    const { setPlanProgram } = await import("./actions.js");
    const result = await setPlanProgram(PLAN_ID, PROGRAM_ID);
    expect(result).toEqual({ error: "That program belongs to a different school" });
  });

  it("updates the plan and reports success", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1)
        return Promise.resolve({
          data: { id: PLAN_ID, secondary_program_id: OTHER_PROGRAM_ID },
          error: null,
        });
      if (call === 2) return Promise.resolve({ data: { id: PROGRAM_ID }, error: null });
      return Promise.resolve({ data: { id: PLAN_ID }, error: null }); // update result
    });
    supabaseMock._chain.update = vi.fn().mockReturnThis();

    const { setPlanProgram } = await import("./actions.js");
    const result = await setPlanProgram(PLAN_ID, PROGRAM_ID);

    expect(result).toEqual({ success: true });
    expect(supabaseMock._chain.update).toHaveBeenCalledWith({ program_id: PROGRAM_ID });
  });

  it("clears the program without a program lookup", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1)
        return Promise.resolve({ data: { id: PLAN_ID, secondary_program_id: null }, error: null });
      return Promise.resolve({ data: { id: PLAN_ID }, error: null }); // update result
    });
    supabaseMock._chain.update = vi.fn().mockReturnThis();

    const { setPlanProgram } = await import("./actions.js");
    const result = await setPlanProgram(PLAN_ID, null);

    expect(result).toEqual({ success: true });
    expect(supabaseMock._chain.update).toHaveBeenCalledWith({ program_id: null });
    expect(supabaseMock._chain.single).toHaveBeenCalledTimes(2);
  });
});

describe("addSemester ownership", () => {
  it("rejects semesters for plans the caller does not own", async () => {
    supabaseMock._chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    const { addSemester } = await import("./actions.js");
    const result = await addSemester(PLAN_ID, "Fall", 2026);
    expect(result).toEqual({ error: "Plan not found" });
  });
});

describe("addCourse ownership", () => {
  it("rejects courses for semesters the caller does not own", async () => {
    supabaseMock._chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    const { addCourse } = await import("./actions.js");
    const result = await addCourse("44444444-4444-4444-8444-444444444444", PROGRAM_ID);
    expect(result).toEqual({ error: "Semester not found" });
  });

  it("validates the course against the semester's plan university", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1)
        return Promise.resolve({
          data: { id: "sem-1", semester_plans: { university_id: "uni-123" } },
          error: null,
        }); // semester ownership + plan join
      if (call === 2)
        return Promise.resolve({
          data: { id: PROGRAM_ID, is_discontinued: false },
          error: null,
        }); // course lookup
      return Promise.resolve({ data: { id: "pc-1" }, error: null }); // plan_courses insert
    });

    const { addCourse } = await import("./actions.js");
    const result = await addCourse("44444444-4444-4444-8444-444444444444", PROGRAM_ID);

    expect(result).toEqual({ planCourseId: "pc-1" });
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith("university_id", "uni-123");
  });

  it("falls back to Utah scoping for legacy plans without a university", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1)
        return Promise.resolve({
          data: { id: "sem-1", semester_plans: { university_id: null } },
          error: null,
        });
      return Promise.resolve({ data: null, error: null }); // course not found in scope
    });

    const { addCourse } = await import("./actions.js");
    const result = await addCourse("44444444-4444-4444-8444-444444444444", PROGRAM_ID);

    expect(result).toEqual({ error: "Course not found" });
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith("university_id", UTAH_UNIVERSITY_ID);
  });
});

describe("migrateGuestPlan program carry-over", () => {
  function guestPlan(programId: string | null) {
    return { id: "guest-1", name: "My Plan", programId, schoolSlug: "utah", semesters: [] };
  }

  it("carries a valid programId onto the new plan", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1)
        return Promise.resolve({
          data: { id: PROGRAM_ID, university_id: UTAH_UNIVERSITY_ID, is_discontinued: false },
          error: null,
        }); // program check
      return Promise.resolve({ data: { id: "plan-new" }, error: null }); // plan insert
    });

    const { migrateGuestPlan } = await import("./actions.js");
    const result = await migrateGuestPlan(guestPlan(PROGRAM_ID));

    expect(result).toEqual({ success: true, planId: "plan-new", skippedCourses: 0 });
    expect(supabaseMock._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ program_id: PROGRAM_ID, university_id: UTAH_UNIVERSITY_ID }),
    );
  });

  it("drops a program from a different school but still migrates", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1)
        return Promise.resolve({
          data: { id: PROGRAM_ID, university_id: "uni-other", is_discontinued: false },
          error: null,
        }); // program belongs to another school
      return Promise.resolve({ data: { id: "plan-new" }, error: null }); // plan insert
    });

    const { migrateGuestPlan } = await import("./actions.js");
    const result = await migrateGuestPlan(guestPlan(PROGRAM_ID));

    expect(result).toEqual({ success: true, planId: "plan-new", skippedCourses: 0 });
    expect(supabaseMock._chain.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ program_id: expect.anything() }),
    );
  });

  it("drops a discontinued program but still migrates", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1)
        return Promise.resolve({
          data: { id: PROGRAM_ID, university_id: UTAH_UNIVERSITY_ID, is_discontinued: true },
          error: null,
        }); // program discontinued
      return Promise.resolve({ data: { id: "plan-new" }, error: null }); // plan insert
    });

    const { migrateGuestPlan } = await import("./actions.js");
    const result = await migrateGuestPlan(guestPlan(PROGRAM_ID));

    expect(result).toEqual({ success: true, planId: "plan-new", skippedCourses: 0 });
    expect(supabaseMock._chain.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ program_id: expect.anything() }),
    );
  });

  it("rejects overlong plan names before any query", async () => {
    const { migrateGuestPlan } = await import("./actions.js");
    const result = await migrateGuestPlan({ ...guestPlan(null), name: "x".repeat(101) });
    expect(result).toEqual({ error: "Plan name is too long" });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("scopes guest course validation to the plan's school", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve({ data: { id: "plan-new" }, error: null }); // plan insert
      return Promise.resolve({ data: { id: "sem-new" }, error: null }); // semester insert
    });
    // Course lookup returns nothing — the id belongs to another school's catalog.
    supabaseMock._chain.in = vi.fn().mockResolvedValue({ data: [] });
    supabaseMock._chain.insert = vi.fn().mockReturnThis();

    const { migrateGuestPlan } = await import("./actions.js");
    const result = await migrateGuestPlan({
      ...guestPlan(null),
      semesters: [{ id: "s1", term: "Fall", year: 2026, courseIds: ["course-x"] }],
    });

    expect(result).toEqual({ success: true, planId: "plan-new", skippedCourses: 1 });
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith("university_id", UTAH_UNIVERSITY_ID);
  });

  it("drops an unknown programId but still migrates", async () => {
    let call = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve({ data: null, error: null }); // program gone
      return Promise.resolve({ data: { id: "plan-new" }, error: null }); // plan insert
    });

    const { migrateGuestPlan } = await import("./actions.js");
    const result = await migrateGuestPlan(guestPlan(PROGRAM_ID));

    expect(result).toEqual({ success: true, planId: "plan-new", skippedCourses: 0 });
    expect(supabaseMock._chain.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ program_id: expect.anything() }),
    );
  });

  it("never leaks raw database error messages", async () => {
    supabaseMock._chain.single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "secret_constraint"' },
    });
    const { migrateGuestPlan } = await import("./actions.js");
    const result = await migrateGuestPlan(guestPlan(null));
    expect("error" in result && result.error).not.toMatch(/secret_constraint/);
  });
});

describe("importTranscriptCourses", () => {
  it("returns error when not authenticated", async () => {
    supabaseMock.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { importTranscriptCourses } = await import("./actions.js");
    const result = await importTranscriptCourses(TRANSCRIPT_PLAN_ID, [
      { courseId: "c1", grade: "A" },
    ]);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("rejects malformed plan ids before any query", async () => {
    const { importTranscriptCourses } = await import("./actions.js");
    const result = await importTranscriptCourses("plan-1", [{ courseId: "c1", grade: "A" }]);
    expect(result).toEqual({ error: "Invalid plan" });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("returns error for empty courses array", async () => {
    const { importTranscriptCourses } = await import("./actions.js");
    const result = await importTranscriptCourses(TRANSCRIPT_PLAN_ID, []);
    expect(result).toEqual({ error: "No courses to import" });
  });

  it("returns error when plan not found", async () => {
    supabaseMock._chain.single = vi.fn().mockResolvedValue({ data: null, error: null });

    const { importTranscriptCourses } = await import("./actions.js");
    const result = await importTranscriptCourses(TRANSCRIPT_PLAN_ID, [
      { courseId: "c1", grade: "A" },
    ]);
    expect(result).toEqual({ error: "Plan not found" });
  });

  it("scopes course validation to the plan's university", async () => {
    let callCount = 0;
    supabaseMock._chain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return Promise.resolve({
          data: { id: TRANSCRIPT_PLAN_ID, university_id: "uni-123" },
          error: null,
        }); // plan check
      return Promise.resolve({ data: { id: "sem-new" }, error: null }); // semester insert
    });
    supabaseMock._chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    supabaseMock._chain.in = vi.fn().mockResolvedValue({ data: [{ id: "c1" }] });
    supabaseMock._chain.upsert = vi.fn().mockResolvedValue({ error: null });

    const { importTranscriptCourses } = await import("./actions.js");
    const result = await importTranscriptCourses(TRANSCRIPT_PLAN_ID, [
      { courseId: "c1", grade: "A" },
    ]);

    expect(result).toEqual({ success: true, importedCount: 1 });
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith("university_id", "uni-123");
  });

  it("counts another school's course ids as invalid", async () => {
    supabaseMock._chain.single = vi.fn().mockResolvedValue({
      data: { id: TRANSCRIPT_PLAN_ID, university_id: "uni-123" },
      error: null,
    });
    // The scoped lookup returns nothing — the id exists only in another catalog.
    supabaseMock._chain.in = vi.fn().mockResolvedValue({ data: [] });

    const { importTranscriptCourses } = await import("./actions.js");
    const result = await importTranscriptCourses(TRANSCRIPT_PLAN_ID, [
      { courseId: "other-school-course", grade: "A" },
    ]);

    expect(result).toEqual({ error: "1 course(s) not found in catalog" });
  });

  it("creates Prior Coursework semester and upserts courses on success", async () => {
    // Plan exists (legacy row without a university_id — falls back to Utah)
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
    const result = await importTranscriptCourses(TRANSCRIPT_PLAN_ID, [
      { courseId: "c1", grade: "A" },
    ]);

    expect(result).toEqual({ success: true, importedCount: 1 });
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith("university_id", UTAH_UNIVERSITY_ID);
  });
});
