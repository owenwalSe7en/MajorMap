import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ComparePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
        not: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ data: [] }),
        }),
        in: vi.fn().mockResolvedValue({ data: [] }),
        ilike: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

afterEach(cleanup);

describe("ComparePage", () => {
  it("renders the page title", () => {
    render(<ComparePage />);
    expect(screen.getByText("Compare Programs")).toBeDefined();
  });

  it("renders two program selectors", () => {
    render(<ComparePage />);
    expect(screen.getByText("Program A")).toBeDefined();
    expect(screen.getByText("Program B")).toBeDefined();
  });

  it("shows compare button (disabled without selections)", () => {
    render(<ComparePage />);
    const btn = screen.getByRole("button", { name: /compare/i });
    expect(btn).toHaveProperty("disabled", true);
  });

  it("shows empty state message", () => {
    render(<ComparePage />);
    expect(screen.getByText(/select two programs/i)).toBeDefined();
  });
});
