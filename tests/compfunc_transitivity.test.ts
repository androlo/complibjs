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

describe('CFCompFuncBinaryImpl: T_*(transitivity)', () => {
    const U = 3 as CFUint32;
    const S = 2 as CFUint32;

    const data: Array<[number, number, number, CFIval]> = [
        // --- s = 0: violate transitivity with 0->1, 1->2 but missing 0->2
        [0, 1, 0, [1, 1] as unknown as CFIval],
        [1, 2, 0, [1, 1] as unknown as CFIval],
        // NOTE: (0,2,0) intentionally absent

        // Add a couple unrelated edges that shouldn't affect the violation
        [2, 2, 0, [7, 9] as unknown as CFIval], // diagonal okay
        [2, 0, 0, [3, 3] as unknown as CFIval],

        // --- s = 1: satisfy transitivity with the full chain + implied edge
        [0, 1, 1, [2, 2] as unknown as CFIval],
        [1, 2, 1, [2, 2] as unknown as CFIval],
        [0, 2, 1, [2, 2] as unknown as CFIval],
    ];

    const cf = createBinaryCompFunc(data, U, S);

    describe('T(u,v,w,s) and T_unsafe(u,v,w,s)', () => {
        it('returns false when both antecedent edges exist but the implied edge is missing', () => {
            // s=0: 0->1 and 1->2 exist, but 0->2 is missing
            expect(cf.T(0 as CFUnit, 1 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(false);
        });

        it('returns true when transitivity is satisfied', () => {
            // s=1: 0->1, 1->2, and 0->2 exist
            expect(cf.T(0 as CFUnit, 1 as CFUnit, 2 as CFUnit, 1 as CFSeriesIndex)).toBe(true);
        });

        it('returns true vacuously if at least one antecedent edge is missing', () => {
            // (0,2,0) missing makes the implication for (0,2,*) vacuously true regardless of (2,w,*)
            expect(cf.T(0 as CFUnit, 2 as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
            // if 1->0 is missing, 0->0 doesn't matter
            expect(cf.T(1 as CFUnit, 0 as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
        });

        it('T_unsafe mirrors truth for valid indices', () => {
            expect(cf.T_unsafe(0 as CFUnit, 1 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.T_unsafe(0 as CFUnit, 1 as CFUnit, 2 as CFUnit, 1 as CFSeriesIndex)).toBe(true);
        });

        it('T returns false for out-of-range indices (safe variant)', () => {
            expect(cf.T(-1 as unknown as CFUnit, 1 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.T(0 as CFUnit, U as unknown as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.T(0 as CFUnit, 1 as CFUnit, -1 as unknown as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.T(0 as CFUnit, 1 as CFUnit, 2 as CFUnit, -1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.T(0 as CFUnit, 1 as CFUnit, 2 as CFUnit, S as unknown as CFSeriesIndex)).toBe(false);
        });
    });

    describe('T_V(units, s) and T_V_unsafe(units, s)', () => {
        it('fails on s=0 for the subset that exposes the violation, passes on s=1', () => {
            const subset = [0 as CFUnit, 1 as CFUnit, 2 as CFUnit] as CFUnit[];
            expect(cf.T_V(subset, 0 as CFSeriesIndex)).toBe(false); // sees 0->1, 1->2, missing 0->2
            expect(cf.T_V(subset, 1 as CFSeriesIndex)).toBe(true);
        });

        it('can be vacuously true for a smaller subset that hides the third node', () => {
            const subset = [0 as CFUnit, 1 as CFUnit] as CFUnit[];
            // Only edges within {0,1} are considered; 1->2 is outside the subset.
            expect(cf.T_V(subset, 0 as CFSeriesIndex)).toBe(true);
        });

        it('returns false for out-of-range s or any out-of-range unit (safe variant)', () => {
            expect(cf.T_V([0 as CFUnit] as CFUnit[], -1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.T_V([0 as CFUnit] as CFUnit[], S as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.T_V([-1 as unknown as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
            expect(cf.T_V([0 as CFUnit, U as unknown as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
        });

        it('T_V_unsafe mirrors truth for valid indices', () => {
            expect(cf.T_V_unsafe([0 as CFUnit, 1 as CFUnit, 2 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
            expect(cf.T_V_unsafe([0 as CFUnit, 1 as CFUnit, 2 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(true);
        });
    });

    describe('T_FRAME(s) / T_FRAME_unsafe(s) and T_CF()', () => {
        it('T_FRAME(s) fails on s=0 and passes on s=1 (as designed)', () => {
            expect(cf.T_FRAME(0 as CFSeriesIndex)).toBe(false);
            expect(cf.T_FRAME(1 as CFSeriesIndex)).toBe(true);
        });

        it('T_FRAME returns false for out-of-range series (safe variant)', () => {
            expect(cf.T_FRAME(-1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.T_FRAME(S as unknown as CFSeriesIndex)).toBe(false);
        });

        it('T_FRAME_unsafe mirrors truth for valid series', () => {
            expect(cf.T_FRAME_unsafe(0 as CFSeriesIndex)).toBe(false);
            expect(cf.T_FRAME_unsafe(1 as CFSeriesIndex)).toBe(true);
        });

        it('T_CF() is true iff every series is transitive', () => {
            // s=0 violates, s=1 satisfies
            expect(cf.T_CF()).toBe(false);
        });
    });
});
