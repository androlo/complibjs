
import { describe, it, expect } from 'vitest';
import {
    createBinaryCompFunc,
} from '../src';
import type {
    CFIval,
    CFUint32,
    CFUnit,
    CFSeriesIndex,
} from '../src';

describe('CFCompFuncBinaryImpl: S_*, LS_* (symmetry & left-symmetry)', () => {
    const U = 3 as CFUint32;
    const S = 2 as CFUint32;

    const data: Array<[number, number, number, CFIval]> = [
        // s = 0: make (0,1) symmetric, (0,2) asymmetric, (1,2) absent
        [0, 1, 0, [1, 1] as unknown as CFIval],
        [1, 0, 0, [1, 1] as unknown as CFIval],

        [0, 2, 0, [2, 2] as unknown as CFIval],
        // note: (2,0,0) intentionally missing to break symmetry

        // s = 1: only a diagonal value so the whole frame is symmetric
        [1, 1, 1, [3, 4] as unknown as CFIval],
    ];

    const cf = createBinaryCompFunc(data, U, S);

    describe('S(u,v,s) and S_unsafe(u,v,s)', () => {
        it('returns true when both directions are present or both absent; false when only one direction is present', () => {
            // s=0
            expect(cf.S(0 as CFUnit, 1 as CFUnit, 0 as CFSeriesIndex)).toBe(true);  // present both ways
            expect(cf.S(0 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(false); // present one way
            expect(cf.S(1 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(true);  // absent both ways

            // s=1 (no off-diagonals): everything off-diagonal is symmetric by vacuity
            expect(cf.S(0 as CFUnit, 1 as CFUnit, 1 as CFSeriesIndex)).toBe(true);
            expect(cf.S(0 as CFUnit, 2 as CFUnit, 1 as CFSeriesIndex)).toBe(true);
            expect(cf.S(1 as CFUnit, 2 as CFUnit, 1 as CFSeriesIndex)).toBe(true);
        });

        it('S_unsafe mirrors truth for valid indices', () => {
            expect(cf.S_unsafe(0 as CFUnit, 1 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
            expect(cf.S_unsafe(0 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.S_unsafe(1 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
        });

        it('S returns false for out-of-range indices (safe variant)', () => {
            expect(cf.S(-1 as unknown as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.S(U as unknown as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.S(0 as CFUnit, -1 as unknown as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.S(0 as CFUnit, U as unknown as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.S(0 as CFUnit, 1 as CFUnit, -1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.S(0 as CFUnit, 1 as CFUnit, S as unknown as CFSeriesIndex)).toBe(false);
        });
    });

    describe('LS(u,v,s) (left-symmetry)', () => {
        it('checks E(u,v,s) => E(v,u,s)', () => {
            // s=0
            expect(cf.LS(0 as CFUnit, 1 as CFUnit, 0 as CFSeriesIndex)).toBe(true);  // true => true
            expect(cf.LS(0 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(false); // true => false
            expect(cf.LS(1 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(true);  // false => (anything) is true

            // s=1: off-diagonals absent -> antecedent false -> implication true
            expect(cf.LS(0 as CFUnit, 2 as CFUnit, 1 as CFSeriesIndex)).toBe(true);
        });

        it('returns false for out-of-range indices (safe variant)', () => {
            expect(cf.LS(-1 as unknown as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.LS(0 as CFUnit, U as unknown as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.LS(0 as CFUnit, 1 as CFUnit, -1 as unknown as CFSeriesIndex)).toBe(false);
        });
    });

    describe('S_V(units, s) and S_V_unsafe(units, s)', () => {
        it('true iff all pairs within the subset are symmetric at s', () => {
            // s = 0
            expect(cf.S_V([0 as CFUnit, 1 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);
            expect(cf.S_V([0 as CFUnit, 2 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
            expect(cf.S_V([1 as CFUnit, 2 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);

            // s = 1 (no off-diagonals)
            expect(cf.S_V([0 as CFUnit, 1 as CFUnit, 2 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(true);
        });

        it('empty subset yields true', () => {
            expect(cf.S_V([] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);
            expect(cf.S_V([] as CFUnit[], 1 as CFSeriesIndex)).toBe(true);
        });

        it('returns false for out-of-range s or any out-of-range unit (safe variant)', () => {
            expect(cf.S_V([0 as CFUnit] as CFUnit[], -1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.S_V([0 as CFUnit] as CFUnit[], S as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.S_V([-1 as unknown as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
            expect(cf.S_V([0 as CFUnit, U as unknown as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
        });

        it('S_V_unsafe matches truth for valid indices', () => {
            expect(cf.S_V_unsafe([0 as CFUnit, 1 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);
            expect(cf.S_V_unsafe([0 as CFUnit, 2 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
        });
    });

    describe('S_FRAME(s) / S_FRAME_unsafe(s) and S_CF()', () => {
        it('S_FRAME checks symmetry for all unit pairs at a given series', () => {
            expect(cf.S_FRAME(0 as CFSeriesIndex)).toBe(false); // asymmetric (0,2) at s=0
            expect(cf.S_FRAME(1 as CFSeriesIndex)).toBe(true);  // vacuously symmetric (no off-diagonals)
        });

        it('S_FRAME returns false for out-of-range series (safe variant)', () => {
            expect(cf.S_FRAME(-1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.S_FRAME(S as unknown as CFSeriesIndex)).toBe(false);
        });

        it('S_FRAME_unsafe mirrors truth for valid series', () => {
            expect(cf.S_FRAME_unsafe(0 as CFSeriesIndex)).toBe(false);
            expect(cf.S_FRAME_unsafe(1 as CFSeriesIndex)).toBe(true);
        });

        it('S_CF is true iff every series is symmetric', () => {
            expect(cf.S_CF()).toBe(false); // s=0 fails symmetry
        });
    });
});
