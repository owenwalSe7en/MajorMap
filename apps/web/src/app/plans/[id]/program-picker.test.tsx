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

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        ilike: () => ({
          order: () => ({
            limit: () => ({
              then: (resolve: (r: { data: unknown[] }) => void) =>
                Promise.resolve({ data: [] }).then(resolve),
            }),
          }),
        }),
      }),
    }),
  }),
}));

import { ProgramPicker } from "./program-picker.js";

beforeEach(() => {
  vi.clearAllMocks();
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
});
