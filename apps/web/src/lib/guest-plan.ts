const STORAGE_KEY = "majormap_guest_v1";

export interface GuestSemester {
  id: string;
  term: string;
  year: number;
  courseIds: string[];
}

export interface GuestPlan {
  id: string;
  name: string;
  programId: string | null;
  /** School the plan belongs to; v1 payloads predate this and mean "utah". */
  schoolSlug: string;
  semesters: GuestSemester[];
}

export function loadGuestPlan(): GuestPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic validation: must have id, name, semesters array
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.semesters)
    ) {
      return null;
    }
    // Migrate v1 payloads written before schools existed.
    if (typeof parsed.schoolSlug !== "string") parsed.schoolSlug = "utah";
    return parsed as GuestPlan;
  } catch {
    return null;
  }
}

export function saveGuestPlan(plan: GuestPlan): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

export function clearGuestPlan(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function createGuestPlan(name = "My Plan"): GuestPlan {
  return {
    id: crypto.randomUUID(),
    name,
    programId: null,
    schoolSlug: "utah",
    semesters: [],
  };
}

export function addSemesterToGuest(plan: GuestPlan, term: string, year: number): GuestPlan {
  return {
    ...plan,
    semesters: [...plan.semesters, { id: crypto.randomUUID(), term, year, courseIds: [] }],
  };
}

export function removeSemesterFromGuest(plan: GuestPlan, semesterId: string): GuestPlan {
  return {
    ...plan,
    semesters: plan.semesters.filter((s) => s.id !== semesterId),
  };
}

export function addCourseToGuest(plan: GuestPlan, semesterId: string, courseId: string): GuestPlan {
  return {
    ...plan,
    semesters: plan.semesters.map((s) => {
      if (s.id !== semesterId) return s;
      if (s.courseIds.includes(courseId)) return s; // Duplicate prevention
      return { ...s, courseIds: [...s.courseIds, courseId] };
    }),
  };
}

export function removeCourseFromGuest(
  plan: GuestPlan,
  semesterId: string,
  courseId: string,
): GuestPlan {
  return {
    ...plan,
    semesters: plan.semesters.map((s) => {
      if (s.id !== semesterId) return s;
      return { ...s, courseIds: s.courseIds.filter((id) => id !== courseId) };
    }),
  };
}
