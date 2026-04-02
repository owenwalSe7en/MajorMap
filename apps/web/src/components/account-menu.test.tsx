import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AccountMenu } from "./account-menu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  }),
}));

afterEach(cleanup);

describe("AccountMenu", () => {
  it("shows Sign In link when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    render(<AccountMenu />);
    // Initially renders a placeholder while loading
    // After auth check, shows Sign In
    await vi.waitFor(() => {
      expect(screen.getByText(/sign in/i)).toBeDefined();
    });
  });
});
