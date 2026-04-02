import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock localStorage
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  length: 0,
  key: () => null,
};

vi.stubGlobal("localStorage", mockLocalStorage);
vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-" + Math.random().toString(36).slice(2, 8) });

describe("guest-plan", () => {
  beforeEach(() => {
    store.clear();
  });

  it("loadGuestPlan returns null when localStorage is empty", async () => {
    const { loadGuestPlan } = await import("./guest-plan.js");
    expect(loadGuestPlan()).toBeNull();
  });

  it("saveGuestPlan persists and loadGuestPlan retrieves", async () => {
    const { loadGuestPlan, saveGuestPlan } = await import("./guest-plan.js");
    const plan = {
      id: "test-id",
      name: "My Plan",
      programId: null,
      semesters: [],
    };
    saveGuestPlan(plan);
    const loaded = loadGuestPlan();
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("test-id");
    expect(loaded!.name).toBe("My Plan");
  });

  it("clearGuestPlan removes all data", async () => {
    const { loadGuestPlan, saveGuestPlan, clearGuestPlan } = await import("./guest-plan.js");
    saveGuestPlan({ id: "test", name: "Test", programId: null, semesters: [] });
    expect(loadGuestPlan()).not.toBeNull();
    clearGuestPlan();
    expect(loadGuestPlan()).toBeNull();
  });

  it("loadGuestPlan returns null for corrupted JSON", async () => {
    const { loadGuestPlan } = await import("./guest-plan.js");
    store.set("majormap_guest_v1", "not-valid-json{{{");
    expect(loadGuestPlan()).toBeNull();
  });

  it("loadGuestPlan returns null for invalid schema", async () => {
    const { loadGuestPlan } = await import("./guest-plan.js");
    store.set("majormap_guest_v1", JSON.stringify({ foo: "bar" }));
    expect(loadGuestPlan()).toBeNull();
  });

  it("addSemester adds a semester to the plan", async () => {
    const { loadGuestPlan, saveGuestPlan, addSemesterToGuest } = await import("./guest-plan.js");
    const plan = { id: "p1", name: "My Plan", programId: null, semesters: [] };
    saveGuestPlan(plan);

    const updated = addSemesterToGuest(plan, "Fall", 2026);
    expect(updated.semesters).toHaveLength(1);
    expect(updated.semesters[0].term).toBe("Fall");
    expect(updated.semesters[0].year).toBe(2026);
  });

  it("removeSemester removes a semester and its courses", async () => {
    const { removeSemesterFromGuest } = await import("./guest-plan.js");
    const plan = {
      id: "p1",
      name: "My Plan",
      programId: null,
      semesters: [{ id: "s1", term: "Fall", year: 2026, courseIds: ["c1", "c2"] }],
    };
    const updated = removeSemesterFromGuest(plan, "s1");
    expect(updated.semesters).toHaveLength(0);
  });

  it("addCourse adds a courseId to a semester", async () => {
    const { addCourseToGuest } = await import("./guest-plan.js");
    const plan = {
      id: "p1",
      name: "My Plan",
      programId: null,
      semesters: [{ id: "s1", term: "Fall", year: 2026, courseIds: [] }],
    };
    const updated = addCourseToGuest(plan, "s1", "course-123");
    expect(updated.semesters[0].courseIds).toContain("course-123");
  });

  it("addCourse is a no-op for duplicate courseId", async () => {
    const { addCourseToGuest } = await import("./guest-plan.js");
    const plan = {
      id: "p1",
      name: "My Plan",
      programId: null,
      semesters: [{ id: "s1", term: "Fall", year: 2026, courseIds: ["course-123"] }],
    };
    const updated = addCourseToGuest(plan, "s1", "course-123");
    expect(updated.semesters[0].courseIds).toHaveLength(1);
  });

  it("removeCourse removes a courseId from a semester", async () => {
    const { removeCourseFromGuest } = await import("./guest-plan.js");
    const plan = {
      id: "p1",
      name: "My Plan",
      programId: null,
      semesters: [{ id: "s1", term: "Fall", year: 2026, courseIds: ["c1", "c2"] }],
    };
    const updated = removeCourseFromGuest(plan, "s1", "c1");
    expect(updated.semesters[0].courseIds).toEqual(["c2"]);
  });
});
