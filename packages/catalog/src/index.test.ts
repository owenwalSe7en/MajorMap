import { describe, expect, it } from "vitest";
import { courseUuid, programUuid } from "./uuid.js";

describe("uuid", () => {
  it("generates deterministic course UUIDs", () => {
    const id1 = courseUuid("utah", "CS", "3500");
    const id2 = courseUuid("utah", "CS", "3500");
    expect(id1).toBe(id2);
  });

  it("generates different UUIDs for different courses", () => {
    const id1 = courseUuid("utah", "CS", "3500");
    const id2 = courseUuid("utah", "CS", "1400");
    expect(id1).not.toBe(id2);
  });

  it("generates deterministic program UUIDs", () => {
    const id1 = programUuid("utah", "computer-science-bs");
    const id2 = programUuid("utah", "computer-science-bs");
    expect(id1).toBe(id2);
  });
});
