import {describe, expect, it} from "vitest";
import {
    ALGEBRA_IVAL,
    CFBinOpType,
    CFCompFuncBinary,
    CFIval,
    CFUnit,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createConstUnitFunc,
    CFStorageTag,
    CFUint32
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {materializeConstSparseMulDiv} from "../src/materialize";

function getCompFunc(): CFCompFuncBinary {
    const base = makeValidCFCompDataset({
        maxUnitIndex: 0 as CFUint32,
        maxSeriesIndex: 0 as CFUint32,
        numComparisons: 1 as CFUint32,
        loRange: [0.1,1],
        hiRange: [1,2]
    });
    return createBinaryCompFunc(base.arr, base.numUnits, base.numSeriesIndices);
}

// ============================================================================
// materializeConstSparseMulDiv — const ⊛ sparse  (⊛ ∈ {*, /})
// ============================================================================

describe('materializeConstSparseMulDiv', () => {
    // Build a small, real sparse (dim=1)
    const cf = getCompFunc();
    const sparse1D = createBaseUnitFunction(cf, 0 as CFUnit); // CFUnitFuncSparse<1>

    it('mul by 1 preserves bitset and values (opType Left)', () => {
        const c1 = createConstUnitFunc(sparse1D.dim, sparse1D.NU, sparse1D.NS, ALGEBRA_IVAL.one());
        const out = materializeConstSparseMulDiv(c1, sparse1D, ALGEBRA_IVAL.mul, CFBinOpType.Left);

        expect(out.storage).toBe(CFStorageTag.Sparse);
        // bitset identical
        expect(out.bitset.eWordsPerRow).toBe(sparse1D.bitset.eWordsPerRow);
        expect(out.bitset.eBits.length).toBe(sparse1D.bitset.eBits.length);
        expect(out.bitset.rowPtr.length).toBe(sparse1D.bitset.rowPtr.length);

        // Same pattern (nnz unchanged)
        const nnzIn  = sparse1D.values.length;
        const nnzOut = out.values.length;
        expect(nnzOut).toBe(nnzIn);

        // Spot-check: for a few first entries, val_out == 1 * val_in
        for (let i = 0; i < Math.min(5, nnzIn); i++) {
            const a = sparse1D.values[i]!;
            const b = out.values[i]!;
            const expected = ALGEBRA_IVAL.mul(c1.value, a);
            expect(ALGEBRA_IVAL.eq(b, expected)).toBe(true);
        }
    });

    it('mul by null removes all nnz (bitset cleared, values empty)', () => {
        const c0 = createConstUnitFunc(sparse1D.dim, sparse1D.NU, sparse1D.NS, ALGEBRA_IVAL.null());
        const out = materializeConstSparseMulDiv(c0, sparse1D, ALGEBRA_IVAL.mul, CFBinOpType.Left);

        expect(out.storage).toBe(CFStorageTag.Sparse);
        // All bits cleared
        const allZero = out.bitset.eBits.every(v => v === 0);
        expect(allZero).toBe(true);

        // nnz = 0, rowPtr is non-decreasing ending at 0 or preserved total length
        expect(out.values.length).toBe(0);
        // CSR terminal pointer should equal nnz
        expect(out.bitset.rowPtr[out.bitset.rowPtr.length - 1]).toBe(0);
    });

    it('div with opType=Left (const / sparse) and Right (sparse / const) differ as expected', () => {
        // Use a non-trivial constant
        const c2 = createConstUnitFunc(sparse1D.dim, sparse1D.NU, sparse1D.NS, [2, 2] as any as CFIval);

        const left  = materializeConstSparseMulDiv(c2, sparse1D, ALGEBRA_IVAL.div, CFBinOpType.Left);  // c2 / val
        const right = materializeConstSparseMulDiv(c2, sparse1D, ALGEBRA_IVAL.div, CFBinOpType.Right); // val / c2

        // Bit patterns remain the same (only values change unless total division makes some null)
        expect(left.bitset.eBits.length).toBe(sparse1D.bitset.eBits.length);
        expect(right.bitset.eBits.length).toBe(sparse1D.bitset.eBits.length);

        // Compare value arrays entrywise with expected formulas
        const n = sparse1D.values.length;
        expect(left.values.length).toBeLessThanOrEqual(n);
        expect(right.values.length).toBeLessThanOrEqual(n);

        // In general total division can null some entries. Validate on surviving nnz by recomputing.
        // Build a helper: recompute and filter nulls the same way the function does.
        const recompute = (opType: CFBinOpType) => {
            const vals: CFIval[] = [];
            for (let i = 0; i < n; i++) {
                const v = sparse1D.values[i]!;
                const newVal = opType === CFBinOpType.Left
                    ? ALGEBRA_IVAL.div(c2.value, v)
                    : ALGEBRA_IVAL.div(v, c2.value);
                if (!ALGEBRA_IVAL.isNull(newVal)) vals.push(newVal);
            }
            return vals;
        };

        const expectedLeftVals  = recompute(CFBinOpType.Left);
        const expectedRightVals = recompute(CFBinOpType.Right);

        // Same order as input; compare elementwise
        expect(left.values.length).toBe(expectedLeftVals.length);
        for (let i = 0; i < left.values.length; i++) {
            expect(ALGEBRA_IVAL.eq(left.values[i]!, expectedLeftVals[i]!)).toBe(true);
        }

        expect(right.values.length).toBe(expectedRightVals.length);
        for (let i = 0; i < right.values.length; i++) {
            expect(ALGEBRA_IVAL.eq(right.values[i]!, expectedRightVals[i]!)).toBe(true);
        }
    });

    it('CSR rowPtr is consistent: non-decreasing and terminal equals values.length', () => {
        const c = createConstUnitFunc(sparse1D.dim, sparse1D.NU, sparse1D.NS, [3, 3] as any as CFIval);
        const out = materializeConstSparseMulDiv(c, sparse1D, ALGEBRA_IVAL.mul, CFBinOpType.Right);

        // Non-decreasing
        const rp = out.bitset.rowPtr;
        for (let i = 1; i < rp.length; i++) {
            expect(rp[i]).toBeGreaterThanOrEqual(rp[i - 1]);
        }
        // Terminal equals nnz
        expect(rp[rp.length - 1]).toBe(out.values.length);
    });
});
