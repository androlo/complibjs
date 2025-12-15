
import { describe, it, expect } from 'vitest';
import {ALGEBRA_IVAL, CFIval, CFSeriesIndex, CFUint32, CFUnit, createBinaryCompFunc} from "../src";

describe('CFCompFuncBinaryImpl accessors: get / getUnsafe / E', () => {
    // Fixture: U = 3 units (0..2), S = 2 series (0..1).
    const U = 3 as CFUint32;
    const S = 2 as CFUint32;

    const data: Array<[number, number, number, readonly [number, number]]> = [
        [0, 0, 0, [1, 1]],
        [0, 2, 0, [2, 3]],
        [1, 0, 1, [4, 5]],
    ];

    const cf = createBinaryCompFunc(data, U, S);

    // tiny helper to assert interval equality via algebra
    const expectIvalEq = (a: CFIval, b: CFIval) => {
        expect(ALGEBRA_IVAL.eq(a, b)).toBe(true);
    };

    describe('get(u,v,s)', () => {
        it('returns the stored interval when (u,v,s) is present', () => {
            expectIvalEq(cf.get(0, 0, 0)!, [1, 1] as unknown as CFIval);
            expectIvalEq(cf.get(0, 2, 0)!, [2, 3] as unknown as CFIval);
            expectIvalEq(cf.get(1, 0, 1)!, [4, 5] as unknown as CFIval);
        });

        it('returns the algebraic null [0,0] when (u,v,s) is absent but indices are valid', () => {
            expectIvalEq(cf.get(0, 1, 0)!, ALGEBRA_IVAL.null());
            expectIvalEq(cf.get(2, 2, 1)!, ALGEBRA_IVAL.null());
            expectIvalEq(cf.get(2, 0, 0)!, ALGEBRA_IVAL.null());
        });

        it('returns undefined when any index is out of range', () => {
            expect(cf.get(-1, 0, 0)).toBeUndefined();
            expect(cf.get(U as unknown as number, 0, 0)).toBeUndefined();

            expect(cf.get(0, -1, 0)).toBeUndefined();
            expect(cf.get(0, U as unknown as number, 0)).toBeUndefined();

            expect(cf.get(0, 0, -1)).toBeUndefined();
            expect(cf.get(0, 0, S as unknown as number)).toBeUndefined();
        });
    });

    describe('getUnsafe(u,v,s)', () => {
        it('returns the stored interval when present', () => {
            expectIvalEq(
                cf.getUnsafe(0 as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex),
                [1, 1] as unknown as CFIval
            );
            expectIvalEq(
                cf.getUnsafe(0 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex),
                [2, 3] as unknown as CFIval
            );
            expectIvalEq(
                cf.getUnsafe(1 as CFUnit, 0 as CFUnit, 1 as CFSeriesIndex),
                [4, 5] as unknown as CFIval
            );
        });

        it('returns the algebraic null [0,0] when absent (valid indices)', () => {
            expectIvalEq(
                cf.getUnsafe(0 as CFUnit, 1 as CFUnit, 0 as CFSeriesIndex),
                ALGEBRA_IVAL.null()
            );
            expectIvalEq(
                cf.getUnsafe(2 as CFUnit, 2 as CFUnit, 1 as CFSeriesIndex),
                ALGEBRA_IVAL.null()
            );
            expectIvalEq(
                cf.getUnsafe(2 as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex),
                ALGEBRA_IVAL.null()
            );
        });

        // No out-of-range calls here by design—"unsafe" accessor assumes valid indices.
    });

    describe('E(u,v,s)', () => {
        it('is true exactly for present entries; false for absent (valid indices)', () => {
            // Present
            expect(cf.E(0 as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
            expect(cf.E(0 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
            expect(cf.E(1 as CFUnit, 0 as CFUnit, 1 as CFSeriesIndex)).toBe(true);

            // Absent
            expect(cf.E(0 as CFUnit, 1 as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.E(2 as CFUnit, 2 as CFUnit, 1 as CFSeriesIndex)).toBe(false);
            expect(cf.E(2 as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex)).toBe(false);

            // Off-diagonal check (ensures E uses v, not u twice)
            expect(cf.E(0 as CFUnit, 1 as CFUnit, 0 as CFSeriesIndex)).toBe(false);
            expect(cf.E(0 as CFUnit, 2 as CFUnit, 0 as CFSeriesIndex)).toBe(true);
        });

        it('throws RangeError("index out of range") for out-of-range indices', () => {
            const throwsRangeErr = (fn: () => any) =>
                expect(fn).toThrowError(new RangeError('index out of range'));

            // u out of range
            throwsRangeErr(() => cf.E(-1 as unknown as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex));
            throwsRangeErr(() => cf.E(U as unknown as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex));

            // v out of range
            throwsRangeErr(() => cf.E(0 as CFUnit, -1 as unknown as CFUnit, 0 as CFSeriesIndex));
            throwsRangeErr(() => cf.E(0 as CFUnit, U as unknown as CFUnit, 0 as CFSeriesIndex));

            // s out of range
            throwsRangeErr(() => cf.E(0 as CFUnit, 0 as CFUnit, -1 as unknown as CFSeriesIndex));
            throwsRangeErr(() => cf.E(0 as CFUnit, 0 as CFUnit, S as unknown as CFSeriesIndex));
        });
    });
});
