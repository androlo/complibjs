import { describe, it, expect, vi } from "vitest";
import { CFSeriesIndex, CFUnit } from "../src/types";
import { countFilteredSubsets, filteredSubsetsGenerator } from "../src/power_set";

// helpers
const collect = <T>(g: Generator<T, void, unknown>) => {
  const out: T[] = [];
  for (const x of g) out.push(x);
  return out;
};
const toSortedTuples = (sets: Array<ReadonlySet<number>>) =>
  sets.map((s) => Array.from(s).sort((a, b) => a - b));

describe("countFilteredSubsets()", () => {
  it("fast path: predicateTotal true & powerset fits ⇒ returns 2^n; never calls predicatePartial", async () => {

    const set = [10, 20, 30] as CFUnit[]; // n=3
    const s = 0 as CFSeriesIndex;
    const predicateTotal = vi.fn(() => true);
    const predicatePartial = vi.fn(() => {
      throw new Error("predicatePartial must NOT be called in fast path");
    });

    const result = countFilteredSubsets(predicateTotal, predicatePartial, set, s);
    expect(result).toBe(8); // 2^3
    expect(predicateTotal).toHaveBeenCalledTimes(1);
    expect(predicatePartial).not.toHaveBeenCalled();
  });

  it("fast path: predicateTotal true & powerset too large ⇒ returns undefined and logs an error", async () => {

    const set = Array.from({ length: 60 }, (_, i) => i as CFUnit); // 2^60 >> 2^10
    const s = 0 as CFSeriesIndex;
    const predicateTotal = vi.fn(() => true);
    const predicatePartial = vi.fn(() => true);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = countFilteredSubsets(predicateTotal, predicatePartial, set, s);
    expect(result).toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(
      "countFilteredSubsets: powerset too large to count."
    );
    expect(predicatePartial).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it("general path (unsafe branch): counts only subsets satisfying a downward-closed predicate", async () => {

    // Downward-closed predicate: subset size ≤ 2
    const set = [1, 2, 3, 4] as CFUnit[]; // n=4
    const s = 0 as CFSeriesIndex;
    const predicateTotal = vi.fn(() => false);
    const predicatePartial = vi.fn((cur: CFUnit[]) => cur.length <= 2);

    // Expected: C(4,0)+C(4,1)+C(4,2) = 1+4+6 = 11
    const result = countFilteredSubsets(predicateTotal, predicatePartial, set, s);
    expect(result).toBe(11);
    expect(predicateTotal).toHaveBeenCalledTimes(1);
    expect(predicatePartial).toHaveBeenCalled(); // used for pruning
  });

  it("safe branch: prunes at the root (predicatePartial([]) === false) ⇒ returns 0 quickly", async () => {

    const n = 60;
    const set = Array.from({ length: n }, (_, i) => i as CFUnit);
    const s = 0 as CFSeriesIndex;
    const predicateTotal = vi.fn(() => false);
    const predicatePartial = vi.fn((cur: number[]) => cur.length > 0); // false for []

    const result = countFilteredSubsets(predicateTotal, predicatePartial, set, s);
    expect(result).toBe(0);
    expect(predicatePartial).toHaveBeenCalledTimes(1); // only checked for []
  });

  it("empty set: returns 1 when predicate allows empty subset", async () => {

    const set: CFUnit[] = [];
    const s = 0 as CFSeriesIndex;
    const predicateTotal = vi.fn(() => false);
    const predicatePartial = vi.fn(() => true);

    const result = countFilteredSubsets(predicateTotal, predicatePartial, set, s);
    expect(result).toBe(1);
    expect(predicatePartial).toHaveBeenCalledWith([], s);
  });
});

describe("filteredSubsetsGenerator()", () => {
  it("fast path: predicateTotal true yields full powerset (no predicatePartial calls)", async () => {

    const set = [1, 2, 3] as CFUnit[];
    const s = 0 as CFSeriesIndex;
    const predicateTotal = vi.fn(() => true);
    const predicatePartial = vi.fn(() => {
      throw new Error("predicatePartial must NOT be called in fast path");
    });

    const yielded = collect(filteredSubsetsGenerator(predicateTotal, predicatePartial, set, s));
    expect(yielded.length).toBe(8);
    expect(predicatePartial).not.toHaveBeenCalled();

    const tuples = toSortedTuples(yielded);
    expect(tuples).toContainEqual([] as number[]);
    expect(tuples).toContainEqual([1, 2, 3]);
    expect(tuples).toContainEqual([2]);
  });

  it("pruned path: yields only subsets that satisfy the downward-closed predicate", async () => {

    const set = [1, 2, 3] as CFUnit[];
    const s = 0 as CFSeriesIndex;
    const predicateTotal = vi.fn(() => false);
    // Downward-closed: forbid 3
    const predicatePartial = vi.fn((cur: CFUnit[]) => !cur.includes(3 as CFUnit));
    const yielded = collect(filteredSubsetsGenerator(predicateTotal, predicatePartial, set, s));
    const tuples = toSortedTuples(yielded);

    // Expect the powerset of {1,2} only
    expect(tuples.length).toBe(4);
    expect(tuples).toEqual(expect.arrayContaining([[], [1], [2], [1, 2]]));
    for (const t of tuples) expect(t).not.toContain(3);
  });

  it("empty set: yields exactly the empty subset", async () => {

    const set: CFUnit[] = [];
    const s = 0 as CFSeriesIndex;
    const predicateTotal = vi.fn(() => false);
    const predicatePartial = vi.fn(() => true);

    const yielded = collect(filteredSubsetsGenerator(predicateTotal, predicatePartial, set, s));
    expect(yielded.length).toBe(1);
    expect(Array.from(yielded[0])).toEqual([]);
  });

});
