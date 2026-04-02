import { describe, expect, it } from "vitest";

describe("MUI Theme", () => {
  it("exports a theme object", async () => {
    const { theme } = await import("./theme.js");
    expect(theme).toBeDefined();
    expect(theme.palette).toBeDefined();
  });

  it("uses Utah crimson as primary color", async () => {
    const { theme } = await import("./theme.js");
    expect(theme.palette.primary.main).toBe("#CC0000");
  });

  it("has white background", async () => {
    const { theme } = await import("./theme.js");
    expect(theme.palette.background.default).toBe("#FFFFFF");
  });

  it("uses compact border-radius", async () => {
    const { theme } = await import("./theme.js");
    expect(theme.shape.borderRadius).toBe(8);
  });
});
