import { describe, expect, it } from "vitest";
import { ping } from "./index.js";

describe("ping", () => {
  it("returns catalog ok", () => {
    expect(ping()).toBe("catalog ok");
  });
});
