import {describe, expect, it} from "vitest";

import {
    ALGEBRA_IVAL,
    CFBinOpType,
    CFCompFuncBinary,
    CFDim,
    CFSeriesIndex,
    CFUint32One,
    CFUint32Three,
    CFUint32Two,
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
    materializeTensorConstDense
} from "../src/materialize";

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

describe('materializeTensorConstDense', () => {
    const cf = getCompFunc();

    const sp = createBaseUnitFunction(cf, 0 as CFUnit) as CFUnitFuncSparse<CFUint32One>;
    const denseFromSparse = () =>
        materializeConstSparseAddSub(
            createConstUnitFunc(sp.dim, sp.NU, sp.NS, ALGEBRA_IVAL.null()),
            sp,
            ALGEBRA_IVAL.add,
            CFBinOpType.Left
        ) as CFUnitFuncDense<CFUint32One>;

    const d1 = denseFromSparse(); // Dense<1>
    const NU = d1.NU;
    const NS = d1.NS;

    it('shape & length for dimC=1', () => {
        const c1 = createConstUnitFunc(1 as CFUint32One, NU, NS, [2, 2] as any);
        const out = materializeTensorConstDense(c1, d1)! as CFUnitFuncDense<CFDim>;
        expect(out.storage).toBe(CFStorageTag.Dense);
        expect(out.dim).toBe((c1.dim + d1.dim) as CFDim);
        expect(out.NU).toBe(NU);
        expect(out.NS).toBe(NS);

        const expectedLen = (NU ** (d1.dim as number + 1)) * (NS as number);
        expect((out as any).values.length).toBe(expectedLen);
    });

    it('pointwise correctness for dimC=1', () => {
        const c1 = createConstUnitFunc(1 as CFUint32One, NU, NS, [3, 3] as any);
        const out = materializeTensorConstDense(c1, d1)! as CFUnitFuncDense<CFUint32Two>;

        const maxU = Math.min(NU, 4);
        const maxS = Math.min(NS, 2);
        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let uL = 0 as CFUnit; uL < maxU; uL = (uL + 1) as CFUnit) {
                for (let uR = 0 as CFUnit; uR < maxU; uR = (uR + 1) as CFUnit) {
                    const got = out.getUnsafe(uL, uR, s);
                    const expected = ALGEBRA_IVAL.mul(c1.getUnsafe(uL, s), d1.getUnsafe(uR, s));
                    expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
                }
            }
        }
    });


    it('dimC=2 quick spot-check', () => {
        const c2 = createConstUnitFunc(2 as CFUint32Two, NU, NS, [2, 2] as any);
        const out = materializeTensorConstDense(c2, d1)! as CFUnitFuncDense<CFUint32Three>;

        const maxU = Math.min(NU, 3);
        const maxS = Math.min(NS, 2);
        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let u1 = 0 as CFUnit; u1 < maxU; u1 = (u1 + 1) as CFUnit) {
                for (let u2 = 0 as CFUnit; u2 < maxU; u2 = (u2 + 1) as CFUnit) {
                    for (let ur = 0 as CFUnit; ur < maxU; ur = (ur + 1) as CFUnit) {
                        const got = out.getUnsafe(u1, u2, ur, s);
                        const expected = ALGEBRA_IVAL.mul(c2.getUnsafe(u1, u2, s), d1.getUnsafe(ur, s));
                        expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
                    }
                }
            }
        }
    });
});
