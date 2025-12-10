import {describe, expect, it} from "vitest";
import {
    ALGEBRA_IVAL,
    CFBinOpType,
    CFIval,
    CFSeriesIndex,
    CFUint32,
    createConstUnitFunc,
    createZeroDimFunc,
    CFStorageTag
} from "../src";
import {materializeConstDense} from "../src/materialize";

describe('materializeConstDense', () => {
    // Build a small 0-dim Dense with multiple series entries (values per s)
    const U = 1 as CFUint32; // zero-dim uses NU but not per-index u
    const S = 3 as CFUint32;

    const dense0 = createZeroDimFunc(
        U,
        S,
        [
            [2, 3] as any as CFIval,
            [4, 5] as any as CFIval,
            [6, 7] as any as CFIval,
        ]
    ); // CFUnitFuncDense<0>

    it('shape: returns Dense with same dim/NU/NS and pows reused', () => {
        const c = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, [1, 1] as any);
        const out = materializeConstDense(c, dense0, ALGEBRA_IVAL.add, CFBinOpType.Left);

        expect(out.storage).toBe(CFStorageTag.Dense);
        expect(out.dim).toBe(dense0.dim);
        expect(out.NU).toBe(dense0.NU);
        expect(out.NS).toBe(dense0.NS);

        // current impl reuses pows; if you later decide to clone, switch to deep-equality
        expect((out as any).pows).toBe((dense0 as any).pows);

        // values length matches input length
        expect((out as any).values.length).toBe((dense0 as any).values.length);
    });

    describe('Add', () => {
        it('Left: const + dense', () => {
            const c = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, [10, 10] as any);
            const out = materializeConstDense(c, dense0, ALGEBRA_IVAL.add, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.add(c.value, dense0.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('Right: dense + const', () => {
            const c = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, [10, 10] as any);
            const out = materializeConstDense(c, dense0, ALGEBRA_IVAL.add, CFBinOpType.Right);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.add(dense0.getUnsafe(s), c.value);
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('const = null acts as additive identity (total arithmetic)', () => {
            const c0 = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, ALGEBRA_IVAL.null());
            const out = materializeConstDense(c0, dense0, ALGEBRA_IVAL.add, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), dense0.getUnsafe(s))).toBe(true);
            }
        });
    });

    describe('Sub', () => {
        it('Left: const − dense', () => {
            const c = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, [9, 9] as any);
            const out = materializeConstDense(c, dense0, ALGEBRA_IVAL.sub, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.sub(c.value, dense0.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('Right: dense − const', () => {
            const c = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, [9, 9] as any);
            const out = materializeConstDense(c, dense0, ALGEBRA_IVAL.sub, CFBinOpType.Right);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.sub(dense0.getUnsafe(s), c.value);
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('Left with const = null → (0 − dense) = −dense', () => {
            const c0 = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, ALGEBRA_IVAL.null());
            const out = materializeConstDense(c0, dense0, ALGEBRA_IVAL.sub, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.mul([-1, -1] as any, dense0.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });
    });

    describe('Mul', () => {
        it('Left: const * dense', () => {
            const c = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, [2, 2] as any);
            const out = materializeConstDense(c, dense0, ALGEBRA_IVAL.mul, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.mul(c.value, dense0.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('Right: dense * const', () => {
            const c = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, [2, 2] as any);
            const out = materializeConstDense(c, dense0, ALGEBRA_IVAL.mul, CFBinOpType.Right);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.mul(dense0.getUnsafe(s), c.value);
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('const = null annihilates: all outputs are null', () => {
            const c0 = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, ALGEBRA_IVAL.null());
            const out = materializeConstDense(c0, dense0, ALGEBRA_IVAL.mul, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                expect(ALGEBRA_IVAL.isNull(out.getUnsafe(s))).toBe(true);
            }
        });

        it('const = one leaves dense unchanged', () => {
            const c1 = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, ALGEBRA_IVAL.one());
            const out = materializeConstDense(c1, dense0, ALGEBRA_IVAL.mul, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), dense0.getUnsafe(s))).toBe(true);
            }
        });
    });

    describe('Div', () => {
        it('Left: const / dense (total division)', () => {
            const c = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, [12, 12] as any);
            const out = materializeConstDense(c, dense0, ALGEBRA_IVAL.div, CFBinOpType.Left);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.div(c.value, dense0.getUnsafe(s));
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('Right: dense / const (total division)', () => {
            const c = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, [3, 3] as any);
            const out = materializeConstDense(c, dense0, ALGEBRA_IVAL.div, CFBinOpType.Right);
            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.div(dense0.getUnsafe(s), c.value);
                expect(ALGEBRA_IVAL.eq(out.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('dense / 0 → 0 (total division), const / dense 0 → 0', () => {
            const c0 = createConstUnitFunc(dense0.dim, dense0.NU, dense0.NS, ALGEBRA_IVAL.null());

            const outRight = materializeConstDense(c0, dense0, ALGEBRA_IVAL.div, CFBinOpType.Right);
            const outLeft  = materializeConstDense(c0, dense0, ALGEBRA_IVAL.div, CFBinOpType.Left);

            for (let s = 0 as CFSeriesIndex; s < S; s = (s + 1) as CFSeriesIndex) {
                expect(ALGEBRA_IVAL.isNull(outRight.getUnsafe(s))).toBe(true); // dense/0 => null
                expect(ALGEBRA_IVAL.isNull(outLeft.getUnsafe(s))).toBe(true);  // 0/dense => null
            }
        });
    });
});
