import { describe, expect, it } from "vitest";
import { resolveCatalogId } from "./coursedog.js";

const TODAY = new Date("2026-06-11T00:00:00Z");

describe("resolveCatalogId", () => {
  it("returns null when no editions carry an id", () => {
    expect(resolveCatalogId([], TODAY)).toBeNull();
    expect(resolveCatalogId([{ effectiveStartDate: "2026-01-01" }], TODAY)).toBeNull();
  });

  it("picks the edition effective today", () => {
    const id = resolveCatalogId(
      [
        { _id: "old", effectiveStartDate: "2024-08-01", effectiveEndDate: "2025-07-31" },
        { _id: "current", effectiveStartDate: "2025-08-01", effectiveEndDate: "2026-07-31" },
        { _id: "future", effectiveStartDate: "2026-08-01", effectiveEndDate: "2027-07-31" },
      ],
      TODAY,
    );
    expect(id).toBe("current");
  });

  it("falls back to the latest edition when none covers today", () => {
    const id = resolveCatalogId(
      [
        { _id: "older", effectiveStartDate: "2023-08-01", effectiveEndDate: "2024-07-31" },
        { _id: "newer", effectiveStartDate: "2024-08-01", effectiveEndDate: "2025-07-31" },
      ],
      TODAY,
    );
    expect(id).toBe("newer");
  });

  it("accepts editions keyed by id instead of _id and open-ended dates", () => {
    const id = resolveCatalogId([{ id: "only", effectiveStartDate: "2025-01-01" }], TODAY);
    expect(id).toBe("only");
  });
});
