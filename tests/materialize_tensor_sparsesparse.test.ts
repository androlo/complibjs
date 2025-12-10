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
    CFStorageTag
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {
    materializeTensorSparseSparse
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

describe('materializeTensorSparseSparse', () => {
    const cf = getCompFunc();

    const spA = createBaseUnitFunction(cf, 0 as CFUnit) as CFUnitFuncSparse<CFUint32One>;
    const spB = createBaseUnitFunction(cf, 1 as CFUnit) as CFUnitFuncSparse<CFUint32One>;

    const NU = spA.NU;
    const NS = spA.NS;

    it('shape & CSR sanity', () => {
        const out = materializeTensorSparseSparse(spA, spB)!;
        expect(out.storage).toBe(CFStorageTag.Sparse);
        expect(out.dim).toBe((spA.dim + spB.dim) as CFDim);
        expect(out.NU).toBe(NU);
        expect(out.NS).toBe(NS);

        const rp = out.bitset.rowPtr;
        for (let i = 1; i < rp.length; i++) {
            expect(rp[i]).toBeGreaterThanOrEqual(rp[i - 1]);
        }
        expect(rp[rp.length - 1]).toBe(out.values.length);
    });

    it('pointwise correctness (small grid)', () => {
        const out = materializeTensorSparseSparse(spA, spB)! as CFUnitFuncSparse<CFUint32Two>;

        const maxU = Math.min(NU, 5);
        const maxS = Math.min(NS, 3);
        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let uL = 0 as CFUnit; uL < maxU; uL = (uL + 1) as CFUnit) {
                for (let uR = 0 as CFUnit; uR < maxU; uR = (uR + 1) as CFUnit) {
                    const got = out.getUnsafe(uL, uR, s) ?? ALGEBRA_IVAL.null();
                    const expected = ALGEBRA_IVAL.mul(spA.getUnsafe(uL, s) ?? ALGEBRA_IVAL.null(),
                        spB.getUnsafe(uR, s) ?? ALGEBRA_IVAL.null());
                    expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
                }
            }
        }
    });
});
