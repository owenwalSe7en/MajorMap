import { describe, expect, it } from "vitest";

describe("Supabase server client", () => {
  it("exports a createClient function", async () => {
    const mod = await import("./server.js");
    expect(mod.createClient).toBeDefined();
    expect(typeof mod.createClient).toBe("function");
  });
});
