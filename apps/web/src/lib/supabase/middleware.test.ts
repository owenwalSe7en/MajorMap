import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock @supabase/ssr
const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Helper to create mock NextRequest
function createMockRequest(pathname: string) {
  const url = new URL(pathname, "http://localhost:3000");
  const cookies = new Map<string, string>();
  return {
    url: url.toString(),
    nextUrl: url,
    cookies: {
      getAll: () => Array.from(cookies.entries()).map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => cookies.set(name, value),
    },
  };
}

describe("updateSession middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "test@test.com" } } });
  });

  it("exports updateSession function", async () => {
    const mod = await import("./middleware.js");
    expect(mod.updateSession).toBeDefined();
    expect(typeof mod.updateSession).toBe("function");
  });

  it("returns a response for authenticated users on any path", async () => {
    const mod = await import("./middleware.js");
    const request = createMockRequest("/plans");
    const response = await mod.updateSession(request as never);
    expect(response).toBeDefined();
    expect(response.status).not.toBe(307); // No redirect
  });

  it("redirects unauthenticated users from /progress to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const mod = await import("./middleware.js");
    const request = createMockRequest("/progress");
    const response = await mod.updateSession(request as never);
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirect=%2Fprogress");
  });

  it("does NOT redirect unauthenticated users from /plans", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const mod = await import("./middleware.js");
    const request = createMockRequest("/plans");
    const response = await mod.updateSession(request as never);
    expect(response.status).not.toBe(307);
  });

  it("does NOT redirect unauthenticated users from /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const mod = await import("./middleware.js");
    const request = createMockRequest("/login");
    const response = await mod.updateSession(request as never);
    expect(response.status).not.toBe(307);
  });

  it("proceeds as unauthenticated when getUser() throws (Supabase down)", async () => {
    mockGetUser.mockRejectedValue(new Error("Network error"));
    const mod = await import("./middleware.js");
    const request = createMockRequest("/plans");
    const response = await mod.updateSession(request as never);
    // Should not crash — proceed as unauthenticated
    expect(response).toBeDefined();
    expect(response.status).not.toBe(500);
  });
});
