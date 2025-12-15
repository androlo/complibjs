import { describe, it, expect } from "vitest";
import type { CFComparison, CFUint32 } from "../../src";
import {CFGenOptions, makeValidCFCompDataset} from "./dataset_gen";

const unpack = (c: CFComparison) => {
    // CFComparison: [u, v, s, [lo, hi]]
    const u = c[0] as number;
    const v = c[1] as number;
    const s = c[2] as number;
    const lo = c[3][0] as number;
    const hi = c[3][1] as number;
    return { u, v, s, lo, hi };
};

describe("makeValidCFCompDataset (sanity)", () => {
    it("generates exactly N items, with correct numUnits/numSeriesIndices", () => {
        const U = 10, S = 8, N = 200;
        const res = makeValidCFCompDataset({
            maxUnitIndex: U - 1 as CFUint32,
            maxSeriesIndex: S - 1 as CFUint32,
            numComparisons: N as CFUint32,
            loRange: [0, 1],
            hiRange: [0, 1],
            seed: 123 as CFUint32,
            diagonalBias: "none",
            seriesDistribution: "roundRobin",
        });
        expect(res.arr.length).toBe(N);
        expect(res.numUnits).toBe(U);
        expect(res.numSeriesIndices).toBe(S);
    });

    it("keeps values in bounds and intervals valid (lo<=hi, not [0,0])", () => {
        const U = 7, S = 6, N = 150;
        const res = makeValidCFCompDataset({
            maxUnitIndex: U - 1 as CFUint32,
            maxSeriesIndex: S - 1 as CFUint32,
            numComparisons: N as CFUint32,
            loRange: [-2, 2],
            hiRange: [-1, 3],
            seed: 42 as CFUint32,
            diagonalBias: "none",
            seriesDistribution: "uniform",
        });

        for (const c of res.arr) {
            const { u, v, s, lo, hi } = unpack(c);
            expect(u).toBeGreaterThanOrEqual(0);
            expect(u).toBeLessThan(U);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(U);
            expect(s).toBeGreaterThanOrEqual(0);
            expect(s).toBeLessThan(S);

            expect(Number.isFinite(lo)).toBe(true);
            expect(Number.isFinite(hi)).toBe(true);
            expect(lo).toBeLessThanOrEqual(hi);
            // generator avoids exactly [0,0]
            expect(!(lo === 0 && hi === 0)).toBe(true);
        }
    });

    it("produces unique (u,v,s) triples", () => {
        const U = 9, S = 9, N = 500;
        const res = makeValidCFCompDataset({
            maxUnitIndex: U - 1 as CFUint32,
            maxSeriesIndex: S - 1 as CFUint32,
            numComparisons: N as CFUint32,
            loRange: [0, 1],
            hiRange: [0, 1],
            seed: 777 as CFUint32,
            diagonalBias: "none",
            seriesDistribution: "roundRobin",
        });

        const seen = new Set<string>();
        for (const c of res.arr) {
            const { u, v, s } = unpack(c);
            const k = `${u}|${v}|${s}`;
            expect(seen.has(k)).toBe(false);
            seen.add(k);
        }
    });

    it("covers all series indices and all units at least once", () => {
        const U = 11, S = 7, N = 200;
        const res = makeValidCFCompDataset({
            maxUnitIndex: U - 1 as CFUint32,
            maxSeriesIndex: S - 1 as CFUint32,
            numComparisons: N as CFUint32,
            loRange: [0, 1],
            hiRange: [0, 1],
            seed: 1 as CFUint32,
            diagonalBias: "none",
            seriesDistribution: "uniform",
        });

        const seenS = new Set<number>();
        const seenU = new Set<number>();

        for (const c of res.arr) {
            const { u, v, s } = unpack(c);
            seenS.add(s);
            seenU.add(u);
            seenU.add(v);
        }
        expect(seenS.size).toBe(S);
        expect(seenU.size).toBe(U);
    });

    it("is deterministic for a given seed", () => {
        const opts: CFGenOptions = {
            maxUnitIndex: 11 as CFUint32,
            maxSeriesIndex: 8 as CFUint32,
            numComparisons: 300 as CFUint32,
            loRange: [0, 2],
            hiRange: [0, 3],
            seed: 2024 as CFUint32,
            diagonalBias: "none" as const,
            seriesDistribution: "roundRobin" as const,
        };
        const a = makeValidCFCompDataset(opts);
        const b = makeValidCFCompDataset(opts);
        // shallow structural equality
        expect(a.numUnits).toBe(b.numUnits);
        expect(a.numSeriesIndices).toBe(b.numSeriesIndices);
        expect(a.arr.length).toBe(b.arr.length);
        for (let i = 0; i < a.arr.length; i++) {
            expect(a.arr[i]).toEqual(b.arr[i]);
        }
    });

    it("distribution: 'uniform' keeps per-series counts balanced (diff ≤ 1)", () => {
        const U = 10, S = 5, N = 333;
        const res = makeValidCFCompDataset({
            maxUnitIndex: U - 1 as CFUint32,
            maxSeriesIndex: S - 1 as CFUint32,
            numComparisons: N as CFUint32,
            loRange: [0, 1],
            hiRange: [0, 1],
            seed: 9 as CFUint32,
            diagonalBias: "none",
            seriesDistribution: "uniform",
        });

        const counts = Array(S).fill(0);
        for (const c of res.arr) counts[unpack(c).s]++;
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        expect(max - min).toBeLessThanOrEqual(1);
    });

    it("distribution: 'roundRobin' cycles series and stays balanced when not near capacity", () => {
        const U = 12, S = 6, N = 240; // far from exhausting a series
        const res = makeValidCFCompDataset({
            maxUnitIndex: U - 1 as CFUint32,
            maxSeriesIndex: S - 1 as CFUint32,
            numComparisons: N as CFUint32,
            loRange: [0, 1],
            hiRange: [0, 1],
            seed: 99 as CFUint32,
            diagonalBias: "none",
            seriesDistribution: "roundRobin",
        });

        const counts = Array(S).fill(0);
        for (const c of res.arr) counts[unpack(c).s]++;
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        expect(max - min).toBeLessThanOrEqual(1);
    });

    it("max capacity (N=U*U*S) succeeds and remains unique", () => {
        const U = 6, S = 4, N = U * U * S;
        const res = makeValidCFCompDataset({
            maxUnitIndex: U - 1 as CFUint32,
            maxSeriesIndex: S - 1 as CFUint32,
            numComparisons: N as CFUint32,
            loRange: [0, 1],
            hiRange: [0, 1],
            seed: 111 as CFUint32,
            diagonalBias: "none",
            seriesDistribution: "uniform",
        });
        expect(res.arr.length).toBe(N);
        const seen = new Set<string>();
        for (const c of res.arr) {
            const { u, v, s } = unpack(c);
            const k = `${u}|${v}|${s}`;
            expect(seen.has(k)).toBe(false);
            seen.add(k);
        }
    });

    it("diagonalBias changes the proportion of u==v (prefer > avoid)", () => {
        const U = 15, S = 10, N = 1200; // enough samples for a stable comparison
        const base: CFGenOptions = {
            maxUnitIndex: U - 1 as CFUint32,
            maxSeriesIndex: S - 1 as CFUint32,
            numComparisons: N as CFUint32,
            loRange: [0, 1],
            hiRange: [0, 1],
            seed: 31415 as CFUint32,
            seriesDistribution: "uniform" as const,
        };

        const pref = makeValidCFCompDataset({ ...base, diagonalBias: "prefer" });
        const avoid = makeValidCFCompDataset({ ...base, diagonalBias: "avoid" });

        const countDiag = (arr: CFComparison[]) =>
            arr.reduce((acc, c) => acc + (unpack(c).u === unpack(c).v ? 1 : 0), 0);

        const dPref = countDiag(pref.arr);
        const dAvoid = countDiag(avoid.arr);

        // With deterministic seed and our biased permutation, prefer should yield more diagonals
        expect(dPref).toBeGreaterThan(dAvoid);
    });

    it("throws on invalid inputs: N too small, N too big, bad ranges", () => {
        const U = 5, S = 7;

        // N too small
        expect(() =>
            makeValidCFCompDataset({
                maxUnitIndex: U - 1 as CFUint32,
                maxSeriesIndex: S - 1 as CFUint32,
                numComparisons: (Math.max(U, S) - 1) as CFUint32,
                loRange: [0, 1],
                hiRange: [0, 1],
            })
        ).toThrow();

        // N too big
        expect(() =>
            makeValidCFCompDataset({
                maxUnitIndex: U - 1 as CFUint32,
                maxSeriesIndex: S - 1 as CFUint32,
                numComparisons: (U * U * S + 1) as CFUint32,
                loRange: [0, 1],
                hiRange: [0, 1],
            })
        ).toThrow();

        // bad ranges: hiMin > hiMax
        expect(() =>
            makeValidCFCompDataset({
                maxUnitIndex: U - 1 as CFUint32,
                maxSeriesIndex: S - 1 as CFUint32,
                numComparisons: Math.max(U, S) as CFUint32,
                loRange: [0, 1],
                hiRange: [2, 1],
            })
        ).toThrow();

        // degenerate [0,0] & [0,0]
        expect(() =>
            makeValidCFCompDataset({
                maxUnitIndex: U - 1 as CFUint32,
                maxSeriesIndex: S - 1 as CFUint32,
                numComparisons: Math.max(U, S) as CFUint32,
                loRange: [0, 0],
                hiRange: [0, 0],
            })
        ).toThrow();
    });
});
