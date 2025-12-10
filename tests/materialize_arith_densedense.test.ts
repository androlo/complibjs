import {describe, expect, it} from "vitest";
import {ALGEBRA_IVAL, CFBinOpType, CFIval, CFSeriesIndex, CFUint32, createZeroDimFunc, CFStorageTag} from "../src";
import {materializeDenseDense} from "../src/materialize";

describe('materializeDenseDense', () => {
    // Build two small 0-dense with multiple series values
    const U = 1 as CFUint32; // zero-dim still has NU, but unit index is absent
    const S = 4 as CFUint32;

    const dA = createZeroDimFunc(
        U,
        S,
        [
            [2, 3] as any as CFIval,
            [4, 5] as any as CFIval,
            [6, 7] as any as CFIval,
            [8, 9] as any as CFIval,
        ]
    ); // CFUnitFuncDense<0>

    const dB = createZeroDimFunc(
        U,
        S,
        [
            [1, 2] as any as CFIval,
            [3, 3] as any as CFIval,
            [5, 8] as any as CFIval,
            [13, 21] as any as CFIval,
        ]
    ); // CFUnitFuncDense<0>

    it('shape: returns Dense with left shape (dim/NU/NS), pows taken from right', () => {
        const out = materializeDenseDense(dA, dB, ALGEBRA_IVAL.add, CFBinOpType.Left);
        expect(out.storage).toBe(CFStorageTag.Dense);
        expect(out.dim).toBe(dA.dim);
        expect(out.NU).toBe(dA.NU);
        expect(out.NS).toBe(dA.NS);
        // implementation currently returns ufr.pows
        expect((out as any).pows).toBe((dB as any).pows);
        expect((out as any).values.length).toBe((dA as any).values.length);
    });

    describe('Add', () => {
        it('Left: val = A + B', () => {
            const out = materializeDenseDense(dA, dB, ALGEBRA_IVAL.add, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.add(dA.getUnsafe(s), dB.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('Right: val = B + A (commutative, but we check ordering anyway)', () => {
            const out = materializeDenseDense(dA, dB, ALGEBRA_IVAL.add, CFBinOpType.Right);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.add(dB.getUnsafe(s), dA.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

    });

    describe('Sub', () => {
        it('Left: val = A − B', () => {
            const out = materializeDenseDense(dA, dB, ALGEBRA_IVAL.sub, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.sub(dA.getUnsafe(s), dB.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('Right: val = B − A', () => {
            const out = materializeDenseDense(dA, dB, ALGEBRA_IVAL.sub, CFBinOpType.Right);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.sub(dB.getUnsafe(s), dA.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

    });

    describe('Mul', () => {
        it('Left: val = A * B', () => {
            const out = materializeDenseDense(dA, dB, ALGEBRA_IVAL.mul, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.mul(dA.getUnsafe(s), dB.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('Right: val = B * A (commutative, but we check ordering anyway)', () => {
            const out = materializeDenseDense(dA, dB, ALGEBRA_IVAL.mul, CFBinOpType.Right);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.mul(dB.getUnsafe(s), dA.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('one is identity: 1 * A = A and A * 1 = A', () => {
            const d1 = createZeroDimFunc(U, S, Array.from({ length: S }, () => ALGEBRA_IVAL.one()));
            const outL = materializeDenseDense(d1, dA, ALGEBRA_IVAL.mul, CFBinOpType.Left);  // 1 * A
            const outR = materializeDenseDense(dA, d1, ALGEBRA_IVAL.mul, CFBinOpType.Right); // A * 1
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                expect(ALGEBRA_IVAL.eq(outL.getUnsafe(s), dA.getUnsafe(s))).toBe(true);
                expect(ALGEBRA_IVAL.eq(outR.getUnsafe(s), dA.getUnsafe(s))).toBe(true);
            }
        });
    });

    describe('Div', () => {
        it('Left: val = A / B (total division)', () => {
            const out = materializeDenseDense(dA, dB, ALGEBRA_IVAL.div, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.div(dA.getUnsafe(s), dB.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('Right: val = B / A (total division)', () => {
            const out = materializeDenseDense(dA, dB, ALGEBRA_IVAL.div, CFBinOpType.Right);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.div(dB.getUnsafe(s), dA.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

    });

    describe('Overflow → null', () => {
        it('add overflow yields nulls', () => {
            const huge = [Number.MAX_VALUE, Number.MAX_VALUE] as any as CFIval;
            const dh = createZeroDimFunc(U, S, [huge, huge, huge, huge]);
            const out = materializeDenseDense(dh, dh, ALGEBRA_IVAL.add, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                expect(ALGEBRA_IVAL.isNull(out.getUnsafe(s))).toBe(true);
            }
        });
    });
});
