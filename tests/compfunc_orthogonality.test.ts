
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

describe('CFCompFuncBinaryImpl: ORT_* (equivalence = R ∧ S ∧ T)', () => {
    const U = 3 as CFUint32;
    const S = 2 as CFUint32;

    // s = 0: full equivalence on the whole frame {0,1,2}
    //   - all diagonals
    //   - all pairs both directions
    //
    // s = 1: equivalence only on subset {0,1}
    //   - diagonals (0,0) and (1,1), plus (0,1) & (1,0)
    //   - nothing involving unit 2
    const data: Array<[number, number, number, CFIval]> = [
        // --- s = 0: complete relation on {0,1,2}
        [0,0,0, [1,1] as unknown as CFIval], [1,1,0, [1,1] as unknown as CFIval], [2,2,0, [1,1] as unknown as CFIval],
        [0,1,0, [1,1] as unknown as CFIval], [1,0,0, [1,1] as unknown as CFIval],
        [0,2,0, [1,1] as unknown as CFIval], [2,0,0, [1,1] as unknown as CFIval],
        [1,2,0, [1,1] as unknown as CFIval], [2,1,0, [1,1] as unknown as CFIval],

        // --- s = 1: equivalence only on {0,1}
        [0,0,1, [2,2] as unknown as CFIval],
        [1,1,1, [2,2] as unknown as CFIval],
        [0,1,1, [2,2] as unknown as CFIval],
        [1,0,1, [2,2] as unknown as CFIval],
    ];

    const cf = createBinaryCompFunc(data, U, S);

    describe('ORT_V(units, s) and ORT_V_unsafe(units, s)', () => {
        it('is true when the subset forms an equivalence at s, false otherwise', () => {
            // s = 0: any subset is equivalence because the frame is complete
            expect(cf.ORT_V([0 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);
            expect(cf.ORT_V([0 as CFUnit, 2 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);
            expect(cf.ORT_V([0 as CFUnit, 1 as CFUnit, 2 as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);

            // s = 1: {0,1} is an equivalence, but anything involving 2 is not
            expect(cf.ORT_V([0 as CFUnit, 1 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(true);
            expect(cf.ORT_V([0 as CFUnit, 2 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(false);
            expect(cf.ORT_V([1 as CFUnit, 2 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(false);
            expect(cf.ORT_V([0 as CFUnit, 1 as CFUnit, 2 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(false);
        });

        it('empty subset yields true (vacuous truth)', () => {
            expect(cf.ORT_V([] as CFUnit[], 0 as CFSeriesIndex)).toBe(true);
            expect(cf.ORT_V([] as CFUnit[], 1 as CFSeriesIndex)).toBe(true);
        });

        it('returns false for out-of-range s or any out-of-range unit (safe variant)', () => {
            expect(cf.ORT_V([0 as CFUnit] as CFUnit[], -1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.ORT_V([0 as CFUnit] as CFUnit[], S as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.ORT_V([-1 as unknown as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
            expect(cf.ORT_V([0 as CFUnit, U as unknown as CFUnit] as CFUnit[], 0 as CFSeriesIndex)).toBe(false);
        });

        it('ORT_V_unsafe mirrors truth for valid indices', () => {
            expect(cf.ORT_V_unsafe([0 as CFUnit, 1 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(true);
            expect(cf.ORT_V_unsafe([0 as CFUnit, 2 as CFUnit] as CFUnit[], 1 as CFSeriesIndex)).toBe(false);
        });
    });

    describe('ORT_FRAME(s) / ORT_FRAME_unsafe(s) and ORT_CF()', () => {
        it('ORT_FRAME is true exactly when the whole frame is an equivalence at s', () => {
            expect(cf.ORT_FRAME(0 as CFSeriesIndex)).toBe(true);   // complete relation
            expect(cf.ORT_FRAME(1 as CFSeriesIndex)).toBe(false);  // unit 2 breaks R/S/T over the frame
        });

        it('ORT_FRAME returns false for out-of-range series (safe variant)', () => {
            expect(cf.ORT_FRAME(-1 as unknown as CFSeriesIndex)).toBe(false);
            expect(cf.ORT_FRAME(S as unknown as CFSeriesIndex)).toBe(false);
        });

        it('ORT_FRAME_unsafe mirrors truth for valid series', () => {
            expect(cf.ORT_FRAME_unsafe(0 as CFSeriesIndex)).toBe(true);
            expect(cf.ORT_FRAME_unsafe(1 as CFSeriesIndex)).toBe(false);
        });

        it('ORT_CF() is true iff every series frame is an equivalence', () => {
            // s=0 is OK, s=1 fails
            expect(cf.ORT_CF()).toBe(false);
        });
    });
});
