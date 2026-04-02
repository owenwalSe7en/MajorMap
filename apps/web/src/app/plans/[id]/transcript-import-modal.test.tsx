import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TranscriptImportModal } from "./transcript-import-modal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  parseTranscriptAction: vi.fn().mockResolvedValue({
    matched: [
      { courseId: "c1", code: "CS 1400", title: "Intro to CS", credits: 3, grade: "A", isPassingGrade: true },
      { courseId: "c2", code: "CS 1410", title: "OOP", credits: 3, grade: "W", isPassingGrade: false },
    ],
    unmatched: [{ subjectCode: "FAKE", number: "9999", grade: "B" }],
    totalCredits: 6,
    skippedLines: 2,
  }),
  importTranscriptCourses: vi.fn().mockResolvedValue({ success: true, importedCount: 1 }),
}));

afterEach(cleanup);

describe("TranscriptImportModal", () => {
  it("renders paste step when open", () => {
    render(<TranscriptImportModal planId="plan-1" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Import Transcript")).toBeDefined();
    expect(screen.getByPlaceholderText(/CS\s+1400/)).toBeDefined();
  });

  it("shows Parse button disabled when textarea is empty", () => {
    render(<TranscriptImportModal planId="plan-1" open={true} onOpenChange={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /parse transcript/i });
    expect(btn).toHaveProperty("disabled", true);
  });

  it("enables Parse button when text is entered", () => {
    render(<TranscriptImportModal planId="plan-1" open={true} onOpenChange={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/CS\s+1400/);
    fireEvent.change(textarea, { target: { value: "CS  1400  Intro  3.00  A" } });
    const btn = screen.getByRole("button", { name: /parse transcript/i });
    expect(btn).toHaveProperty("disabled", false);
  });

  it("does not render when closed", () => {
    render(<TranscriptImportModal planId="plan-1" open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Import Transcript")).toBeNull();
  });
});
