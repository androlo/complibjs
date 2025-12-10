import {describe, expect, it} from "vitest";

import {
    ALGEBRA_IVAL,
    CFBinOpType,
    CFCompFuncBinary,
    CFDim,
    CFSeriesIndex,
    CFUint32One,
    CFUnit,
    CFUnitFuncDense,
    CFUnitFuncSparse,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createConstUnitFunc,
    CFStorageTag
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {
    materializeConstSparseAddSub,
    materializeTensorDenseSparse
} from "../src/materialize";

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

describe('materializeTensorDenseSparse', () => {
    const cf = getCompFunc();

    // Build Dense<1> from a sparse to have realistic data
    const sp0 = createBaseUnitFunction(cf, 0 as CFUnit) as CFUnitFuncSparse<CFUint32One>;
    const d1 = materializeConstSparseAddSub(
        createConstUnitFunc(sp0.dim, sp0.NU, sp0.NS, ALGEBRA_IVAL.null()),
        sp0,
        ALGEBRA_IVAL.add,
        CFBinOpType.Left
    ) as CFUnitFuncDense<CFUint32One>;

    const sp1 = createBaseUnitFunction(cf, 1 as CFUnit) as CFUnitFuncSparse<CFUint32One>;

    const NU = d1.NU;
    const NS = d1.NS;

    it('shape & CSR sanity', () => {
        const out = materializeTensorDenseSparse(d1, sp1)!;
        expect(out.storage).toBe(CFStorageTag.Sparse);
        expect(out.dim).toBe((d1.dim + sp1.dim) as CFDim);
        expect(out.NU).toBe(NU);
        expect(out.NS).toBe(NS);

        const rp = out.bitset.rowPtr;
        for (let i = 1; i < rp.length; i++) {
            expect(rp[i]).toBeGreaterThanOrEqual(rp[i - 1]);
        }
        expect(rp[rp.length - 1]).toBe(out.values.length);
    });

    it('pointwise correctness (small grid)', () => {
        const out = materializeTensorDenseSparse(d1, sp1)!;

        const maxU = Math.min(NU, 5);
        const maxS = Math.min(NS, 3);
        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let uL = 0 as CFUnit; uL < maxU; uL = (uL + 1) as CFUnit) {
                for (let uR = 0 as CFUnit; uR < maxU; uR = (uR + 1) as CFUnit) {
                    const got = out.getUnsafe(uL, uR, s) ?? ALGEBRA_IVAL.null();
                    const expected = ALGEBRA_IVAL.mul(d1.getUnsafe(uL, s), sp1.getUnsafe(uR, s) ?? ALGEBRA_IVAL.null());
                    expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
                }
            }
        }
    });
});