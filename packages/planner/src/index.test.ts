import { describe, expect, it } from "vitest";
import { helloPlanner } from "./index.js";

describe("helloPlanner", () => {
  it("formats the planner message", () => {
    expect(helloPlanner("major-1")).toBe("planner:major-1");
  });
});
