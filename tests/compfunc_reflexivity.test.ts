
import { describe, it, expect } from 'vitest';
import {
    createBinaryCompFunc
} from '../src';
import type {
    CFIval,
    CFUint32,
    CFUnit,
    CFSeriesIndex,
} from '../src';

describe('CFCompFuncBinaryImpl: R, R_V, R_FRAME, R_CF', () => {
    // Fixture: U = 3, S = 2
    // s = 0: diagonal fully set -> R_FRAME(0) === true
    // s = 1: only u=1 set on diagonal -> R_FRAME(1) === false
    const U = 3 as CFUint32;
    const S = 2 as CFUint32;

    const data: Array<[number, number, number, CFIval]> = [
        // s = 0, full diagonal
        [0, 0, 0, [10, 11] as unknown as CFIval],
        [1, 1, 0, [12, 13] as unknown as CFIval],
        [2, 2, 0, [14, 15] as unknown as CFIval],

        // s = 1, only middle diagonal present
        [1, 1, 1, [20, 21] as unknown as CFIval],

        // a couple off-diagonals (should not affect reflexivity)
        [0, 2, 0, [30, 31] as unknown as CFIval],
        [2, 0, 1, [32, 33] as unknown as CFIval],
    ];

    const cf = createBinaryCompFunc(data, U, S);

    describe('R(u, s) and R_unsafe(u, s)', () => {
        it('returns true exactly for diagonal existence at (u,u,s)', () => {
            // s = 0: all diagonal present
            expect(cf.R(0 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
            expect(cf.R(1 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
            expect(cf.R(2 as CFUnit, 0 as CFSeriesIndex)).toBe(true);

            // s = 1: only u=1 present
            expect(cf.R(0 as CFUnit, 1 as CFSeriesIndex)).toBe(false);
            expect(cf.R(1 as CFUnit, 1 as CFSeriesIndex)).toBe(true);
            expect(cf.R(2 as CFUnit, 1 as CFSeriesIndex)).toBe(false);
        });

        it('R_unsafe mirrors truth for valid indices', () => {
            expect(cf.R_unsafe(0 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
            expect(cf.R_unsafe(1 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
            expect(cf.R_unsafe(2 as CFUnit, 0 as CFSeriesIndex)).toBe(true);

            expect(cf.R_unsafe(0 as CFUnit, 1 as CFSeriesIndex)).toBe(false);
            expect(cf.R_unsafe(1 as CFUnit, 1 as CFSeriesIndex)).toBe(true);
            expect(cf.R_unsafe(2 as CFUnit, 1 as CFSeriesIndex)).toBe(false);
        });

        it('R returns false for out-of-range indices (safe variant)', () => {
            expect(cf.R(-1 as unknown as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.R(U as unknown as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.R(0 as CFUnit, -1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.R(0 as CFUnit, S as unknown as CFSeriesIndex)).toBe(false);
        });
    });

    describe('R_V(units, s) and R_V_unsafe(units, s)', () => {
        it('true iff *all* listed units are reflexive at s', () => {
            // s = 0: full diagonal
            expect(cf.R_V([0 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);
            expect(cf.R_V([0 as CFUnit, 1 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);
            expect(cf.R_V([0 as CFUnit, 1 as CFUnit, 2 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);

            // s = 1: only 1 present on diagonal
            expect(cf.R_V([1 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(true);
            expect(cf.R_V([0 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(false);
            expect(cf.R_V([2 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(false);
            expect(cf.R_V([0 as CFUnit, 1 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(false);
            expect(cf.R_V([1 as CFUnit, 2 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(false);
        });

        it('empty unit list yields true (vacuous truth)', () => {
            expect(cf.R_V([] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);
            expect(cf.R_V([] as CFUnit[], 1 as CFSeriesIndex)).toBe(true);
        });

        it('R_V returns false for out-of-range s or unit (safe variant)', () => {
            // OOR series
            expect(cf.R_V([0 as CFUnit] as CFUnit[], -1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.R_V([0 as CFUnit] as CFUnit[], S as unknown as CFSeriesIndex)).toBe(false);

            // OOR unit in the list
            expect(cf.R_V([-1 as unknown as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
            expect(cf.R_V([0 as CFUnit, U as unknown as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
        });

        it('R_V_unsafe matches truth for valid indices', () => {
            expect(cf.R_V_unsafe([0 as CFUnit, 1 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);
            expect(cf.R_V_unsafe([0 as CFUnit, 2 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(false);
            expect(cf.R_V_unsafe([1 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(true);
        });
    });

    describe('R_FRAME(s) / R_FRAME_unsafe(s) and R_CF()', () => {
        it('R_FRAME(s) checks the entire diagonal for a given series', () => {
            expect(cf.R_FRAME(0 as CFSeriesIndex)).toBe(true);
            expect(cf.R_FRAME(1 as CFSeriesIndex)).toBe(false);
        });

        it('R_FRAME returns false for out-of-range series (safe variant)', () => {
            expect(cf.R_FRAME(-1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.R_FRAME(S as unknown as CFSeriesIndex)).toBe(false);
        });

        it('R_FRAME_unsafe mirrors truth for valid series', () => {
            expect(cf.R_FRAME_unsafe(0 as CFSeriesIndex)).toBe(true);
            expect(cf.R_FRAME_unsafe(1 as CFSeriesIndex)).toBe(false);
        });

        it('R_CF() is true iff every series has a full diagonal', () => {
            // With s=0 full and s=1 incomplete, this must be false.
            expect(cf.R_CF()).toBe(false);
        });
    });
});
