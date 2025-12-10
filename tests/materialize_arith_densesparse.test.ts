
import {describe, expect, it} from "vitest";
import {
    materializeConstDense,
    materializeConstSparseAddSub,
    materializeConstSparseMulDiv,
    materializeDenseSparse
} from "../src/materialize";
import {
    ALGEBRA_IVAL,
    CFBinOpType, CFCompFuncBinary, CFIval,
    CFSeriesIndex,
    CFUint32One,
    CFUnit, CFUnitFuncDense,
    CFUnitFuncSparse, createBinaryCompFunc, createBaseUnitFunction,
    createConstUnitFunc,
    CFStorageTag
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";

function getCompFunc(): CFCompFuncBinary {
    const base = makeValidCFCompDataset({
        maxUnitIndex: 0,
        maxSeriesIndex: 0,
        numComparisons: 1,
        loRange: [0.1,1],
        hiRange: [1,2]
    });
    return createBinaryCompFunc(base.arr, base.numUnits, base.numSeriesIndices);
}

// ============================================================================
// materializeDenseSparse — dense ⊕ sparse  (⊕ ∈ {+, −, *, /})
// ============================================================================

describe('materializeDenseSparse', () => {
    // Build a real 1-D sparse (CSR) from your factory
    const cf = getCompFunc();
    const sp = createBaseUnitFunction(cf, 0 as CFUnit); // CFUnitFuncSparse<1>
    const NU = sp.NU;
    const NS = sp.NS;

    // Helper: create a Dense<1> with the same domain as `sp`
    // We materialize a dense copy of `sp` using "const null + sp" to fill zeros.
    const denseFromSparse = () => {
        const c0 = createConstUnitFunc(sp.dim, sp.NU, sp.NS, ALGEBRA_IVAL.null());
        return materializeConstSparseAddSub(c0, sp, ALGEBRA_IVAL.add, CFBinOpType.Left) as CFUnitFuncDense<CFUint32One>;
    };

    // Reusable checker over a small grid
    const checkGrid = (
        out: CFUnitFuncDense<CFUint32One>,
        dense: CFUnitFuncDense<CFUint32One>,
        sparse: CFUnitFuncSparse<CFUint32One>,
        op: (a: CFIval, b: CFIval) => CFIval,
        left: boolean
    ) => {
        const maxU = Math.min(NU, 8);
        const maxS = Math.min(NS, 3);

        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let u = 0 as CFUnit; u < maxU; u = (u + 1) as CFUnit) {
                const dVal = dense.getUnsafe(u, s)!;
                const sVal = sparse.getUnsafe(u, s) ?? ALGEBRA_IVAL.null();
                const expected = left ? op(dVal, sVal) : op(sVal, dVal);
                const got = out.getUnsafe(u, s);
                expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
            }
        }
    };

    it('shape: returns Dense with left geometry and same values length', () => {
        const d = denseFromSparse();
        const out = materializeDenseSparse(d, sp, ALGEBRA_IVAL.add, CFBinOpType.Left);

        expect(out.storage).toBe(CFStorageTag.Dense);
        expect(out.dim).toBe(d.dim);
        expect(out.NU).toBe(d.NU);
        expect(out.NS).toBe(d.NS);
        expect((out as any).values.length).toBe((d as any).values.length);
        // pows preserved from left
        expect((out as any).pows).toBe((d as any).pows);
    });

    describe('Add', () => {
        it('Left: dense + sparse', () => {
            const d = denseFromSparse();
            const out = materializeDenseSparse(d, sp, ALGEBRA_IVAL.add, CFBinOpType.Left);
            checkGrid(out, d, sp, ALGEBRA_IVAL.add, true);
        });

        it('Right: sparse + dense', () => {
            const d = denseFromSparse();
            const out = materializeDenseSparse(d, sp, ALGEBRA_IVAL.add, CFBinOpType.Right);
            checkGrid(out, d, sp, ALGEBRA_IVAL.add, false);
        });
    });

    describe('Sub', () => {
        it('Left: dense − sparse', () => {
            const d = denseFromSparse();
            const out = materializeDenseSparse(d, sp, ALGEBRA_IVAL.sub, CFBinOpType.Left);
            checkGrid(out, d, sp, ALGEBRA_IVAL.sub, true);
        });

        it('Right: sparse − dense', () => {
            const d = denseFromSparse();
            const out = materializeDenseSparse(d, sp, ALGEBRA_IVAL.sub, CFBinOpType.Right);
            checkGrid(out, d, sp, ALGEBRA_IVAL.sub, false);
        });
    });

    describe('Mul', () => {
        it('Left: dense * sparse', () => {
            const d = denseFromSparse();
            const out = materializeDenseSparse(d, sp, ALGEBRA_IVAL.mul, CFBinOpType.Left);
            checkGrid(out, d, sp, ALGEBRA_IVAL.mul, true);
        });

        it('Right: sparse * dense', () => {
            const d = denseFromSparse();
            const out = materializeDenseSparse(d, sp, ALGEBRA_IVAL.mul, CFBinOpType.Right);
            checkGrid(out, d, sp, ALGEBRA_IVAL.mul, false);
        });

        it('annihilation: dense all-null ⇒ all null', () => {
            const d = denseFromSparse();
            // Turn d into all-null by multiplying with const null
            const c0 = createConstUnitFunc(d.dim, d.NU, d.NS, ALGEBRA_IVAL.null());
            const dNull = materializeConstDense(c0, d, ALGEBRA_IVAL.mul, CFBinOpType.Left);
            const out = materializeDenseSparse(dNull, sp, ALGEBRA_IVAL.mul, CFBinOpType.Left);
            const maxU = Math.min(NU, 8);
            const maxS = Math.min(NS, 3);
            for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
                for (let u = 0 as CFUnit; u < maxU; u = (u + 1) as CFUnit) {
                    expect(ALGEBRA_IVAL.isNull(out.getUnsafe(u, s))).toBe(true);
                }
            }
        });
    });

    describe('Div', () => {
        it('Left: dense / sparse (total division)', () => {
            const d = denseFromSparse();
            const out = materializeDenseSparse(d, sp, ALGEBRA_IVAL.div, CFBinOpType.Left);
            checkGrid(out, d, sp, ALGEBRA_IVAL.div, true);
        });

        it('Right: sparse / dense (total division)', () => {
            const d = denseFromSparse();
            const out = materializeDenseSparse(d, sp, ALGEBRA_IVAL.div, CFBinOpType.Right);
            checkGrid(out, d, sp, ALGEBRA_IVAL.div, false);
        });

        it('total division: any / 0 → 0, 0 / any → 0', () => {
            const d = denseFromSparse();

            // Build a sparse all-zero by multiplying with const null
            const c0 = createConstUnitFunc(sp.dim, sp.NU, sp.NS, ALGEBRA_IVAL.null());
            const sp0dense = materializeConstSparseMulDiv(c0, sp, ALGEBRA_IVAL.mul, CFBinOpType.Left);
            // Convert back to sparse shape: its bitset is empty; we already have a sparse with empty bits by construction
            const sp0 = sp0dense as unknown as CFUnitFuncSparse<CFUint32One>; // values=[], eBits cleared

            const outLeft  = materializeDenseSparse(d, sp0, ALGEBRA_IVAL.div, CFBinOpType.Left);  // d / 0
            const outRight = materializeDenseSparse(d, sp0, ALGEBRA_IVAL.div, CFBinOpType.Right); // 0 / d

            const maxU = Math.min(NU, 8);
            const maxS = Math.min(NS, 3);
            for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
                for (let u = 0 as CFUnit; u < maxU; u = (u + 1) as CFUnit) {
                    expect(ALGEBRA_IVAL.isNull(outLeft.getUnsafe(u, s))).toBe(true);
                    expect(ALGEBRA_IVAL.isNull(outRight.getUnsafe(u, s))).toBe(true);
                }
            }
        });
    });
});
