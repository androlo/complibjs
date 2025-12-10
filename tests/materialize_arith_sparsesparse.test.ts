import {describe, expect, it} from "vitest";

import {
    ALGEBRA_IVAL,
    CFArithOp,
    CFBinOpType,
    CFCompFuncBinary,
    CFIval,
    CFSeriesIndex,
    CFUint32One,
    CFUnit,
    CFUnitFuncSparse,
    createBinaryCompFunc,
    createBaseUnitFunction,
    CFStorageTag
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {materializeSparseSparse} from "../src/materialize";

function getCompFunc(): CFCompFuncBinary {
    const base = makeValidCFCompDataset({
        maxUnitIndex: 1,
        maxSeriesIndex: 0,
        numComparisons: 2,
        loRange: [0.1,1],
        hiRange: [1,2]
    });
    return createBinaryCompFunc(base.arr, base.numUnits, base.numSeriesIndices);
}


// ============================================================================
// materializeSparseSparse — sparse ⊕ sparse  (⊕ ∈ {+, −, *, /})
// ============================================================================

describe('materializeSparseSparse', () => {
    // Build two real sparse 1D functions with different patterns
    const cf = getCompFunc();
    const spA = createBaseUnitFunction(cf, 0 as CFUnit); // CFUnitFuncSparse<1>
    const spB = createBaseUnitFunction(cf, 1 as CFUnit); // CFUnitFuncSparse<1>

    const NU = spA.NU;
    const NS = spA.NS;

    // Sanity: domains must match
    it('shape: returns Sparse with same geometry and valid CSR', () => {
        const out = materializeSparseSparse(spA, spB, CFArithOp.Add, CFBinOpType.Left);

        expect(out.storage).toBe(CFStorageTag.Sparse);
        expect(out.dim).toBe(spA.dim);
        expect(out.NU).toBe(spA.NU);
        expect(out.NS).toBe(spA.NS);

        // CSR sanity: non-decreasing rowPtr, terminal equals values.length
        const rp = out.bitset.rowPtr;
        for (let i = 1; i < rp.length; i++) {
            expect(rp[i]).toBeGreaterThanOrEqual(rp[i - 1]);
        }
        expect(rp[rp.length - 1]).toBe(out.values.length);
    });

    // Helper: compute expected pointwise using inputs and the algebra, then compare to out.getUnsafe
    const checkPointwise = (
        out: CFUnitFuncSparse<CFUint32One>,
        A: CFUnitFuncSparse<CFUint32One>,
        B: CFUnitFuncSparse<CFUint32One>,
        op: (a: CFIval, b: CFIval) => CFIval,
        left: boolean
    ) => {
        const maxU = Math.min(NU, 16);
        const maxS = Math.min(NS, 3);

        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let u = 0 as CFUnit; u < maxU; u = (u + 1) as CFUnit) {
                const a = A.getUnsafe(u, s) ?? ALGEBRA_IVAL.null();
                const b = B.getUnsafe(u, s) ?? ALGEBRA_IVAL.null();
                const expected = left ? op(a, b) : op(b, a);
                const got = out.getUnsafe(u, s) ?? ALGEBRA_IVAL.null();
                expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
            }
        }
    };

    describe('Add (union behavior)', () => {
        it('Left: A + B', () => {
            const out = materializeSparseSparse(spA, spB, CFArithOp.Add, CFBinOpType.Left);
            checkPointwise(out, spA, spB, ALGEBRA_IVAL.add, true);
        });

        it('Right: B + A (same values; ordering irrelevant for add)', () => {
            const out = materializeSparseSparse(spA, spB, CFArithOp.Add, CFBinOpType.Right);
            checkPointwise(out, spA, spB, ALGEBRA_IVAL.add, false);
        });
    });

    describe('Sub (union, order matters)', () => {
        it('Left: A − B', () => {
            const out = materializeSparseSparse(spA, spB, CFArithOp.Sub, CFBinOpType.Left);
            checkPointwise(out, spA, spB, ALGEBRA_IVAL.sub, true);
        });

        it('Right: B − A', () => {
            const out = materializeSparseSparse(spA, spB, CFArithOp.Sub, CFBinOpType.Right);
            checkPointwise(out, spA, spB, ALGEBRA_IVAL.sub, false);
        });
    });

    describe('Mul (intersection behavior from total arithmetic)', () => {
        it('Left: A * B (same as Right for mul)', () => {
            const out = materializeSparseSparse(spA, spB, CFArithOp.Mul, CFBinOpType.Left);
            checkPointwise(out, spA, spB, ALGEBRA_IVAL.mul, true);
        });

        it('Right: B * A', () => {
            const out = materializeSparseSparse(spA, spB, CFArithOp.Mul, CFBinOpType.Right);
            checkPointwise(out, spA, spB, ALGEBRA_IVAL.mul, false);
        });
    });

    describe('Div (intersection behavior from total division; order matters)', () => {
        it('Left: A / B', () => {
            const out = materializeSparseSparse(spA, spB, CFArithOp.Div, CFBinOpType.Left);
            checkPointwise(out, spA, spB, ALGEBRA_IVAL.div, true);
        });

        it('Right: B / A', () => {
            const out = materializeSparseSparse(spA, spB, CFArithOp.Div, CFBinOpType.Right);
            checkPointwise(out, spA, spB, ALGEBRA_IVAL.div, false);
        });
    });

    it('CSR rows reflect number of non-nulls (rank per row)', () => {
        const out = materializeSparseSparse(spA, spB, CFArithOp.Add, CFBinOpType.Left);
        const rp = out.bitset.rowPtr;
        // For a few rows, recompute nnz by scanning u in that row and comparing to rp diff
        const rows = rp.length - 1;
        const rowsToCheck = Math.min(rows, 4);
        for (let row = 0; row < rowsToCheck; row++) {
            const s = Math.floor(row / (NU as number)) as CFSeriesIndex; // since rows = U^(dim-1)*S with dim=1 → rows = S
            let nnz = 0;
            for (let u = 0 as CFUnit; u < NU && row === (s as number); u = (u + 1) as CFUnit) {
                const val = out.getUnsafe(u, s);
                if (val && !ALGEBRA_IVAL.isNull(val)) nnz++;
            }
            expect(rp[row + 1] - rp[row]).toBe(nnz);
        }
    });
});
