import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SuggestionsPanel } from "./suggestions-panel";
import type { SuggestedCourse } from "@major-map/planner";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  addCourse: vi.fn().mockResolvedValue({ planCourseId: "pc-1" }),
}));

afterEach(cleanup);

const makeSuggestion = (id: string, code: string, overrides?: Partial<SuggestedCourse>): SuggestedCourse => ({
  courseId: id,
  code,
  title: `Course ${code}`,
  credits: 3,
  reason: "Required for degree",
  priority: 100,
  category: "Core Requirements",
  unlockCount: 0,
  ...overrides,
});

const semesters = [
  { id: "s1", term: "Fall", year: 2025, courses: [] },
];

describe("SuggestionsPanel", () => {
  it("renders suggestions when provided", () => {
    const suggestions = [makeSuggestion("c1", "CS 1400")];
    render(<SuggestionsPanel suggestions={suggestions} semesters={semesters}  hasProgram={true} />);
    expect(screen.getByText("Suggested Courses")).toBeDefined();
    expect(screen.getByText("CS 1400")).toBeDefined();
  });

  it("shows empty state when no suggestions", () => {
    render(<SuggestionsPanel suggestions={[]} semesters={semesters}  hasProgram={true} />);
    expect(screen.getByText("All Set")).toBeDefined();
  });

  it("shows program prompt when no program selected", () => {
    render(<SuggestionsPanel suggestions={[]} semesters={semesters}  hasProgram={false} />);
    expect(screen.getByText(/select a program/i)).toBeDefined();
  });

  it("renders category filter when multiple categories exist", () => {
    const suggestions = [
      makeSuggestion("c1", "CS 1400", { category: "Core" }),
      makeSuggestion("c2", "MATH 1210", { category: "Math" }),
    ];
    render(<SuggestionsPanel suggestions={suggestions} semesters={semesters}  hasProgram={true} />);
    expect(screen.getByText("All")).toBeDefined();
    expect(screen.getByText("Core")).toBeDefined();
    expect(screen.getByText("Math")).toBeDefined();
  });

  it("shows add button for each suggestion", () => {
    const suggestions = [makeSuggestion("c1", "CS 1400")];
    render(<SuggestionsPanel suggestions={suggestions} semesters={semesters}  hasProgram={true} />);
    expect(screen.getByText("Add")).toBeDefined();
  });

  it("displays reason badge", () => {
    const suggestions = [makeSuggestion("c1", "CS 1400", { reason: "Unlocks 3 courses" })];
    render(<SuggestionsPanel suggestions={suggestions} semesters={semesters}  hasProgram={true} />);
    expect(screen.getByText("Unlocks 3 courses")).toBeDefined();
  });
});
