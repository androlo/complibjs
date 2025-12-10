import {describe, expect, it} from "vitest";

import {
    ALGEBRA_IVAL,
    CFCompFuncBinary,
    CFDim,
    CFInt32,
    CFIval,
    CFReal,
    CFSeriesIndex,
    CFUint32,
    CFUint32One,
    CFUint32Zero,
    CFUnit,
    CFUnitFuncConst,
    CFUnitFuncDense,
    CFUnitFuncSparse,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createConstUnitFunc,
    createZeroDimFunc,
    CFPowOp,
    CFStorageTag
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {materializeExpRootLeaf} from "../src/materialize";

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
// materializeExpRootLeaf — powInt / powReal / nthRoot on leaf storages
// ============================================================================

describe('materializeExpRootLeaf', () => {
    // Helpers
    const cf = getCompFunc();

    // ---------- Const ----------
    describe('Const base', () => {
        it('powInt exp=0 → one for non-null, null for null (total arithmetic)', () => {
            const cNonNull = createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, [3, 4] as any);
            const cNull    = createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.null());

            const r1 = materializeExpRootLeaf(cNonNull, 0, CFPowOp.Int)! as CFUnitFuncConst<CFDim>;
            expect(r1.storage).toBe(CFStorageTag.Const);
            expect(ALGEBRA_IVAL.isOne((r1 as any).value)).toBe(true);

            const r0 = materializeExpRootLeaf(cNull, 0, CFPowOp.Int)! as CFUnitFuncConst<CFDim>;
            expect(r0.storage).toBe(CFStorageTag.Const);
            expect(ALGEBRA_IVAL.isNull((r0 as any).value)).toBe(true);
        });

        it('nthRoot exp=0 → null const', () => {
            const c = createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, [5, 6] as any);
            const r = materializeExpRootLeaf(c, 0, CFPowOp.NthRoot)! as CFUnitFuncConst<CFDim>;
            expect(r.storage).toBe(CFStorageTag.Const);
            expect(ALGEBRA_IVAL.isNull((r as any).value)).toBe(true);
        });

        it('powReal general case maps via ALGEBRA_IVAL.pow', () => {
            const c = createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, [2, 3] as any);
            const r = materializeExpRootLeaf(c, 2.5, CFPowOp.Real)! as CFUnitFuncConst<CFDim>;
            const expected = ALGEBRA_IVAL.pow([2, 3] as any, 2.5 as CFReal);
            expect(ALGEBRA_IVAL.eq((r as any).value, expected)).toBe(true);
        });
    });

    // ---------- Sparse ----------
    describe('Sparse base', () => {
        const sp = createBaseUnitFunction(cf, 0 as CFUnit) as CFUnitFuncSparse<CFUint32One>;
        const NU = sp.NU, NS = sp.NS;

        it('powInt exp=1 → identity (bits and values preserved)', () => {
            const r = materializeExpRootLeaf(sp, 1, CFPowOp.Int)! as CFUnitFuncSparse<CFUint32One>;
            expect(r.storage).toBe(CFStorageTag.Sparse);
            expect(r.values.length).toBe(sp.values.length);
            // Check a few values
            for (let i = 0; i < Math.min(8, sp.values.length); i++) {
                const expected = ALGEBRA_IVAL.powInt(sp.values[i]!, 1 as CFInt32);
                expect(ALGEBRA_IVAL.eq(r.values[i]!, expected)).toBe(true);
            }
            // Same CSR shape (#words/rowPtr length)
            expect(r.bitset.eWordsPerRow).toBe(sp.bitset.eWordsPerRow);
            expect(r.bitset.rowPtr.length).toBe(sp.bitset.rowPtr.length);
        });

        it('nthRoot exp=0 → empty sparse (all bits cleared, values = [])', () => {
            const r = materializeExpRootLeaf(sp, 0, CFPowOp.NthRoot)! as CFUnitFuncSparse<CFUint32One>;
            expect(r.storage).toBe(CFStorageTag.Sparse);
            // All bits cleared
            expect(r.bitset.eBits.every(v => v === 0)).toBe(true);
            expect(r.values.length).toBe(0);
            // CSR terminal pointer equals 0
            expect(r.bitset.rowPtr[r.bitset.rowPtr.length - 1]).toBe(0);
        });

        it('powInt exp=2 keeps bits (no nulls produced) and squares values', () => {
            const r = materializeExpRootLeaf(sp, 2, CFPowOp.Int)! as CFUnitFuncSparse<CFUint32One>;
            // Pointwise check on a small grid
            const maxU = Math.min(NU, 8);
            const maxS = Math.min(NS, 3);
            for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
                for (let u = 0 as CFUnit; u < maxU; u = (u + 1) as CFUnit) {
                    const v = sp.getUnsafe(u, s);
                    const got = r.getUnsafe(u, s);
                    const expected = ALGEBRA_IVAL.powInt(v ?? ALGEBRA_IVAL.null(), 2 as CFInt32);
                    // If original had no entry, r should not suddenly grow an entry
                    if (v === undefined) {
                        expect(got === undefined || ALGEBRA_IVAL.isNull(got)).toBe(true);
                    } else {
                        expect(ALGEBRA_IVAL.eq(got!, expected)).toBe(true);
                    }
                }
            }
        });
    });

    // ---------- Dense ----------
    describe('Dense base', () => {
        const d0 = createZeroDimFunc(
            1 as CFUint32,
            3 as CFUint32,
            [
                [2, 3] as any as CFIval,
                [4, 5] as any as CFIval,
                [6, 7] as any as CFIval,
            ]
        ) as CFUnitFuncDense<CFUint32Zero>;

        it('powInt exp=0 → per-entry powInt(...,0)', () => {
            const r = materializeExpRootLeaf(d0, 0, CFPowOp.Int)! as CFUnitFuncDense<CFUint32Zero>;
            for (let s = 0 as CFSeriesIndex; s < d0.NS; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.powInt(d0.getUnsafe(s), 0 as CFInt32);
                expect(ALGEBRA_IVAL.eq(r.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('powReal exp=1.5 → per-entry pow', () => {
            const r = materializeExpRootLeaf(d0, 1.5, CFPowOp.Real)! as CFUnitFuncDense<CFUint32Zero>;
            for (let s = 0 as CFSeriesIndex; s < d0.NS; s = (s + 1) as CFSeriesIndex) {
                const expected = ALGEBRA_IVAL.pow(d0.getUnsafe(s), 1.5 as CFReal);
                expect(ALGEBRA_IVAL.eq(r.getUnsafe(s), expected)).toBe(true);
            }
        });

        it('nthRoot exp=0 → all entries null (total arithmetic)', () => {
            const r = materializeExpRootLeaf(d0, 0, CFPowOp.NthRoot)! as CFUnitFuncDense<CFUint32Zero>;
            for (let s = 0 as CFSeriesIndex; s < d0.NS; s = (s + 1) as CFSeriesIndex) {
                expect(ALGEBRA_IVAL.isNull(r.getUnsafe(s))).toBe(true);
            }
        });
    });
});
