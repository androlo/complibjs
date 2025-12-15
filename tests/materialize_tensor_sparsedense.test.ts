import {describe, expect, it} from "vitest";

import {
    ALGEBRA_IVAL,
    CFBinOpType,
    CFCompFuncBinary,
    CFDim,
    CFSeriesIndex,
    CFUint32One,
    CFUint32Two,
    CFUnit,
    CFUnitFuncDense,
    CFUnitFuncSparse,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createConstUnitFunc,
    CFStorageTag,
    CFUint32
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {
    materializeConstSparseAddSub,
    materializeTensorSparseDense
} from "../src/materialize";

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

describe('materializeTensorSparseDense', () => {
    const cf = getCompFunc();

    const sp0 = createBaseUnitFunction(cf, 0 as CFUnit) as CFUnitFuncSparse<CFUint32One>;
    const d1 = materializeConstSparseAddSub(
        createConstUnitFunc(sp0.dim, sp0.NU, sp0.NS, ALGEBRA_IVAL.null()),
        sp0,
        ALGEBRA_IVAL.add,
        CFBinOpType.Left
    ) as CFUnitFuncDense<CFUint32One>;

    const dR = d1; // right dense<1>

    const NU = sp0.NU;
    const NS = sp0.NS;

    it('shape & length', () => {
        const out = materializeTensorSparseDense(sp0, dR)!;
        expect(out.storage).toBe(CFStorageTag.Dense);
        expect(out.dim).toBe((sp0.dim + dR.dim) as CFDim);
        expect(out.NU).toBe(NU);
        expect(out.NS).toBe(NS);

        const expectedLen = (NU ** ((sp0.dim as number) + (dR.dim as number))) * (NS as number);
        expect((out as any).values.length).toBe(expectedLen);
    });

    it('pointwise correctness (small grid)', () => {
        const out = materializeTensorSparseDense(sp0, dR)! as CFUnitFuncDense<CFUint32Two>;

        const maxU = Math.min(NU, 5);
        const maxS = Math.min(NS, 3);
        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let uL = 0 as CFUnit; uL < maxU; uL = (uL + 1) as CFUnit) {
                for (let uR = 0 as CFUnit; uR < maxU; uR = (uR + 1) as CFUnit) {
                    const got = out.getUnsafe(uL, uR, s);
                    const expected = ALGEBRA_IVAL.mul(sp0.getUnsafe(uL, s) ?? ALGEBRA_IVAL.null(), dR.getUnsafe(uR, s));
                    expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
                }
            }
        }
    });
});
