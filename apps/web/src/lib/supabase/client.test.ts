import { describe, expect, it, vi } from "vitest";

// Mock @supabase/ssr before importing the module under test
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
}));

describe("Supabase browser client", () => {
  it("exports a createClient function", async () => {
    const mod = await import("./client.js");
    expect(mod.createClient).toBeDefined();
    expect(typeof mod.createClient).toBe("function");
  });

  it("returns a Supabase client instance", async () => {
    const mod = await import("./client.js");
    const client = mod.createClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it("calls createBrowserClient with env vars", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const mod = await import("./client.js");
    mod.createClient();
    expect(createBrowserClient).toHaveBeenCalled();
  });
});
