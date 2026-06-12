import { describe, expect, it, vi } from "vitest";
import { computeStaleDiff, staleMarkingAllowed, upsertBatch } from "./seed.js";

function mockClient(failingBatches: number[]) {
  let call = 0;
  const upsert = vi.fn().mockImplementation(() => {
    call++;
    return Promise.resolve(
      failingBatches.includes(call) ? { error: { message: `boom ${call}` } } : { error: null },
    );
  });
  return {
    client: { from: vi.fn(() => ({ upsert })) },
    upsert,
  };
}

describe("upsertBatch", () => {
  it("reports inserted counts and collects failures instead of swallowing them", async () => {
    const { client } = mockClient([2]);

    const rows = [1, 2, 3, 4, 5].map((n) => ({ n }));
    const result = await upsertBatch(
      client as never,
      "courses",
      rows,
      "university_id,subject_code,number",
      2,
    );

    // batches: [1,2] ok, [3,4] fails, [5] ok
    expect(result.inserted).toBe(3);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain("courses batch 2");
    expect(result.failures[0]).toContain("boom 2");
  });

  it("returns no failures on a clean run", async () => {
    const { client, upsert } = mockClient([]);

    const result = await upsertBatch(client as never, "departments", [{ a: 1 }], "code", 100);

    expect(result).toEqual({ inserted: 1, failures: [] });
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

describe("staleMarkingAllowed (mass-discontinuation circuit breaker)", () => {
  it("allows the first seed of a school", () => {
    expect(staleMarkingAllowed(5000, 0)).toBe(true);
  });

  it("allows normal drift", () => {
    expect(staleMarkingAllowed(17500, 17892)).toBe(true);
  });

  it("refuses when the fetch looks truncated", () => {
    // A truncated/partial response must never soft-delete the catalog.
    expect(staleMarkingAllowed(9000, 17892)).toBe(false);
    expect(staleMarkingAllowed(0, 17892)).toBe(false);
  });
});

describe("computeStaleDiff", () => {
  it("flags rows missing from the fetch and restores returned ones", () => {
    const db = [
      { id: "a", is_discontinued: false }, // still present → untouched
      { id: "b", is_discontinued: false }, // vanished → flag
      { id: "c", is_discontinued: true }, // returned → restore
      { id: "d", is_discontinued: true }, // still gone → untouched
    ];
    const fetched = new Set(["a", "c"]);

    expect(computeStaleDiff(db, fetched)).toEqual({ flag: ["b"], restore: ["c"] });
  });
});
