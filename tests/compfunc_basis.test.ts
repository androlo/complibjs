import { describe, it, expect } from 'vitest';
import { createBinaryCompFunc } from '../src';
import type {
    CFIval,
    CFUint32,
    CFUnit,
    CFSeriesIndex,
    CFBasis,
} from '../src';
import {setsEqual} from "../src/math_utils";

describe('CFCompFuncBinaryImpl: B_* (basis / partition from equivalence)', () => {
    const U = 3 as CFUint32;
    const S = 2 as CFUint32;

    // s = 0: equivalence classes {{0,2}, {1}}
    // - diagonals: (0,0),(1,1),(2,2)
    // - class {0,2}: (0,2),(2,0)
    // - no edges between {0,2} and {1}
    //
    // s = 1: NOT an equivalence (break symmetry with 0->1 only)
    const data: Array<[number, number, number, CFIval]> = [
        // --- s = 0 (equivalence)
        [0,0,0, [1,1] as unknown as CFIval],
        [1,1,0, [1,1] as unknown as CFIval],
        [2,2,0, [1,1] as unknown as CFIval],
        [0,2,0, [1,1] as unknown as CFIval],
        [2,0,0, [1,1] as unknown as CFIval],

        // --- s = 1 (break symmetry)
        [0,0,1, [1,1] as unknown as CFIval],
        [1,1,1, [1,1] as unknown as CFIval],
        [2,2,1, [1,1] as unknown as CFIval],
        [0,1,1, [1,1] as unknown as CFIval], // (1,0,1) missing -> not symmetric
    ];

    const cf = createBinaryCompFunc(data, U, S);

    const expectBasisEq = (basis: CFBasis, expected: readonly ReadonlySet<CFUnit>[]) => {
        // same cf reference
        expect(basis.cf).toBe(cf);
        // same number of blocks
        expect(basis.data.length).toBe(expected.length);
        // blocks equal as sets (order is deterministic here: reps discovered in ascending u)
        for (let i = 0; i < expected.length; i++) {
            expect(setsEqual(basis.data[i], expected[i]!)).toBe(true);
        }
    };

    describe('B_FRAME(s)', () => {
        it('returns a basis (partition) when the frame is an equivalence at s', () => {
            const b = cf.B_FRAME(0 as CFSeriesIndex)!;
            // For s=0, iteration order yields reps 0, then 1; 2 joins the class of 0.
            expectBasisEq(b, [new Set<CFUnit>([0,2] as CFUnit[]), new Set<CFUnit>([1] as CFUnit[])]);
        });

        it('returns undefined when the frame is not an equivalence at s', () => {
            expect(cf.B_FRAME(1 as CFSeriesIndex)).toBeUndefined();
        });

        it('returns undefined for out-of-range series index (safe variant)', () => {
            expect(cf.B_FRAME(-1 as unknown as CFSeriesIndex)).toBeUndefined();
            expect(cf.B_FRAME(S as unknown as CFSeriesIndex)).toBeUndefined();
        });
    });

    describe('B_FRAME_unsafe(s)', () => {
        it('matches B_FRAME for valid s (no bounds checks)', () => {
            const b = cf.B_FRAME_unsafe(0 as CFSeriesIndex)!;
            expectBasisEq(b, [new Set<CFUnit>([0,2] as CFUnit[]), new Set<CFUnit>([1] as CFUnit[])]);
        });

        it('returns undefined when the frame is not an equivalence (even in unsafe)', () => {
            expect(cf.B_FRAME_unsafe(1 as CFSeriesIndex)).toBeUndefined();
        });
    });

    describe('B_CF()', () => {
        it('returns per-series bases, using unsafe frame basis underneath', () => {
            const arr = cf.B_CF();
            // index 0: defined; index 1: undefined
            expect(arr.length).toBe(S as unknown as number);
            expect(arr[0]).toBeDefined();
            expect(arr[1]).toBeUndefined();

            const b0 = arr[0]!;
            expectBasisEq(b0, [new Set<CFUnit>([0,2] as CFUnit[]), new Set<CFUnit>([1] as CFUnit[])]);
        });
    });
});
