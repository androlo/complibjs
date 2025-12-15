import {describe, expect, it} from "vitest";

import {
    ALGEBRA_IVAL,
    CFCompFuncBinary,
    CFDim,
    CFSeriesIndex,
    CFUint32One,
    CFUint32Two,
    CFUnit,
    CFUnitFuncSparse,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createConstUnitFunc,
    CFStorageTag,
    CFUint32
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {materializeTensorSparseConst} from "../src/materialize";

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
// materializeTensorSparseConst — sparse ⊗ const
// ============================================================================

describe('materializeTensorSparseConst', () => {
    const cf = getCompFunc();

    // A real sparse<1>
    const sp = createBaseUnitFunction(cf, 0 as CFUnit) as CFUnitFuncSparse<CFUint32One>;
    const NU = sp.NU;
    const NS = sp.NS;

    it('shape & CSR for dimC=1 (const dimension = 1)', () => {
        const c = createConstUnitFunc(1 as CFUint32One, NU, NS, [2, 2] as any); // const<1>
        const out = materializeTensorSparseConst(sp, c)!;

        expect(out.storage).toBe(CFStorageTag.Sparse);
        expect(out.dim).toBe((sp.dim + 1) as CFDim);
        expect(out.NU).toBe(NU);
        expect(out.NS).toBe(NS);

        // CSR sanity
        const rp = out.bitset.rowPtr;
        for (let i = 1; i < rp.length; i++) {
            expect(rp[i]).toBeGreaterThanOrEqual(rp[i - 1]);
        }
        expect(rp[rp.length - 1]).toBe(out.values.length);
    });

    it('pointwise correctness for dimC=1', () => {
        const c = createConstUnitFunc(1 as CFUint32One, NU, NS, [3, 3] as any); // const<1>
        const out = materializeTensorSparseConst(sp, c)!;

        // Check a small grid of (u_left, u_right, s)
        const maxU = Math.min(NU, 6);
        const maxS = Math.min(NS, 3);
        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let ul = 0 as CFUnit; ul < maxU; ul = (ul + 1) as CFUnit) {
                for (let ur = 0 as CFUnit; ur < maxU; ur = (ur + 1) as CFUnit) {
                    // newDim = sp.dim (1) + c.dim (1) = 2
                    const got = out.getUnsafe(ul, ur, s) ?? ALGEBRA_IVAL.null();

                    const lv = sp.getUnsafe(ul, s) ?? ALGEBRA_IVAL.null();
                    const rv = c.getUnsafe(ur, s); // const -> always same value
                    const expected = ALGEBRA_IVAL.mul(lv, rv);

                    expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
                }
            }
        }
    });

    it('cVal = null annihilates (empty sparse)', () => {
        const cNull = createConstUnitFunc(1 as CFUint32One, NU, NS, ALGEBRA_IVAL.null());
        const out = materializeTensorSparseConst(sp, cNull)!;

        expect(out.storage).toBe(CFStorageTag.Sparse);
        expect(out.values.length).toBe(0);
        expect(out.bitset.eBits.every(v => v === 0)).toBe(true);
        expect(out.bitset.rowPtr[out.bitset.rowPtr.length - 1]).toBe(0);

        // A few getUnsafe samples should be null
        const maxU = Math.min(NU, 4);
        const maxS = Math.min(NS, 2);
        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let ul = 0 as CFUnit; ul < maxU; ul = (ul + 1) as CFUnit) {
                for (let ur = 0 as CFUnit; ur < maxU; ur = (ur + 1) as CFUnit) {
                    expect(ALGEBRA_IVAL.isNull(out.getUnsafe(ul, ur, s))).toBe(true);
                }
            }
        }
    });

    it('dimC=2 also passes pointwise checks on a small grid', () => {
        const c2 = createConstUnitFunc(2 as CFUint32Two, NU, NS, [2, 2] as any); // const<2>
        const out = materializeTensorSparseConst(sp, c2)!;
        expect(out.dim).toBe((sp.dim + 2) as CFDim);

        const maxU = Math.min(NU, 3);
        const maxS = Math.min(NS, 2);
        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let ul = 0 as CFUnit; ul < maxU; ul = (ul + 1) as CFUnit) {
                for (let u1 = 0 as CFUnit; u1 < maxU; u1 = (u1 + 1) as CFUnit) {
                    for (let u2 = 0 as CFUnit; u2 < maxU; u2 = (u2 + 1) as CFUnit) {
                        const got = out.getUnsafe(ul, u1, u2, s) ?? ALGEBRA_IVAL.null();
                        const lv  = sp.getUnsafe(ul, s) ?? ALGEBRA_IVAL.null();
                        const rv  = c2.getUnsafe(u1, u2, s);
                        const expected = ALGEBRA_IVAL.mul(lv, rv);
                        expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
                    }
                }
            }
        }
    });
});
