import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SignupForm } from "./signup-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  }),
}));

afterEach(cleanup);

describe("SignupForm", () => {
  it("renders email, password, and confirm password inputs", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText("Email")).toBeDefined();
    expect(screen.getByLabelText("Password")).toBeDefined();
    expect(screen.getByLabelText("Confirm password")).toBeDefined();
  });

  it("renders a submit button", () => {
    render(<SignupForm />);
    expect(screen.getByRole("button", { name: /sign up/i })).toBeDefined();
  });

  it("renders a link to login", () => {
    render(<SignupForm />);
    expect(screen.getByRole("link", { name: /log in/i })).toBeDefined();
  });
});
