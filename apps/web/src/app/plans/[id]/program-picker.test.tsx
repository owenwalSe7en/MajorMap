import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const setPlanProgram = vi.fn();
vi.mock("../actions", () => ({
  setPlanProgram: (...args: unknown[]) => setPlanProgram(...args),
}));

interface SearchResult {
  data: unknown[] | null;
  error: unknown;
}

let searchResult: SearchResult = { data: [], error: null };
const eqSpy = vi.fn();

// Mirrors the real query chain: select → eq → [eq] → ilike → order → limit →
// abortSignal → thenable. Every method returns the chain so reordering filters
// doesn't break the mock.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const chain: Record<string, unknown> = {
      then: (resolve: (r: SearchResult) => void) => Promise.resolve(searchResult).then(resolve),
    };
    for (const method of ["select", "eq", "ilike", "order", "limit", "abortSignal"]) {
      chain[method] = (...args: unknown[]) => {
        if (method === "eq") eqSpy(...args);
        return chain;
      };
    }
    return { from: () => chain };
  },
}));

import { ProgramPicker } from "./program-picker.js";

beforeEach(() => {
  vi.clearAllMocks();
  searchResult = { data: [], error: null };
});

describe("ProgramPicker", () => {
  it("shows the current program with change/clear controls", () => {
    render(
      <ProgramPicker planId="plan-1" currentProgram={{ id: "p1", name: "Computer Science BS" }} />,
    );

    expect(screen.getByText("Computer Science BS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
  });

  it("prompts to select when no program is set", () => {
    render(<ProgramPicker planId="plan-1" currentProgram={null} />);

    expect(screen.getByRole("button", { name: /select a program/i })).toBeInTheDocument();
  });

  it("clears the program and refreshes", async () => {
    setPlanProgram.mockResolvedValue({ success: true });
    render(
      <ProgramPicker planId="plan-1" currentProgram={{ id: "p1", name: "Computer Science BS" }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    await waitFor(() => expect(setPlanProgram).toHaveBeenCalledWith("plan-1", null));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("surfaces action errors instead of refreshing", async () => {
    setPlanProgram.mockResolvedValue({ error: "Plan not found" });
    render(
      <ProgramPicker planId="plan-1" currentProgram={{ id: "p1", name: "Computer Science BS" }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    await waitFor(() => expect(screen.getByText("Plan not found")).toBeInTheDocument());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("opens the search input when changing", () => {
    render(
      <ProgramPicker planId="plan-1" currentProgram={{ id: "p1", name: "Computer Science BS" }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /change/i }));

    expect(screen.getByRole("textbox", { name: /search programs/i })).toBeInTheDocument();
  });

  it("searches after the debounce, filters discontinued, and applies the selection", async () => {
    searchResult = {
      data: [{ id: "p2", name: "Biology BS", degree_type: "Bachelor of Science" }],
      error: null,
    };
    setPlanProgram.mockResolvedValue({ success: true });
    render(<ProgramPicker planId="plan-1" currentProgram={null} universityId="uni-1" />);

    fireEvent.click(screen.getByRole("button", { name: /select a program/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /search programs/i }), {
      target: { value: "bio" },
    });

    expect(await screen.findByText("Biology BS")).toBeInTheDocument();
    expect(eqSpy).toHaveBeenCalledWith("is_discontinued", false);
    expect(eqSpy).toHaveBeenCalledWith("university_id", "uni-1");

    fireEvent.click(screen.getByRole("button", { name: /biology bs/i }));

    await waitFor(() => expect(setPlanProgram).toHaveBeenCalledWith("plan-1", "p2"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows an inline error when the search fails", async () => {
    searchResult = { data: null, error: { message: "boom" } };
    render(<ProgramPicker planId="plan-1" currentProgram={null} />);

    fireEvent.click(screen.getByRole("button", { name: /select a program/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /search programs/i }), {
      target: { value: "bio" },
    });

    expect(await screen.findByText("Search failed — try again")).toBeInTheDocument();
  });
});
