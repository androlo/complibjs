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
    createZeroDimFunc,
    CFStorageTag
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {
    materializeConstSparseAddSub,
    materializeTensorConstDense,
    materializeTensorDenseDense
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

describe('materializeTensorDenseDense', () => {
    const cf = getCompFunc();

    // Build two realistic Dense<1> from your sparse base for convenience.
    const sp0 = createBaseUnitFunction(cf, 0 as CFUnit) as CFUnitFuncSparse<CFUint32One>;
    const sp1 = createBaseUnitFunction(cf, 1 as CFUnit) as CFUnitFuncSparse<CFUint32One>;

    const denseFromSparse = (sp: CFUnitFuncSparse<CFUint32One>) =>
        materializeConstSparseAddSub(
            createConstUnitFunc(sp.dim, sp.NU, sp.NS, ALGEBRA_IVAL.null()),
            sp,
            ALGEBRA_IVAL.add,
            CFBinOpType.Left
        ) as CFUnitFuncDense<CFUint32One>;

    const dL1 = denseFromSparse(sp0); // Dense<1>
    const dR1 = denseFromSparse(sp1); // Dense<1>
    const NU  = dL1.NU;
    const NS  = dL1.NS;

    it('shape & length for dimL=1, dimR=1', () => {
        const out = materializeTensorDenseDense(dL1, dR1)! as CFUnitFuncDense<CFUint32Two>;
        expect(out).not.toBeUndefined();
        expect(out.storage).toBe(CFStorageTag.Dense);
        expect(out.dim).toBe((dL1.dim + dR1.dim) as CFDim);
        expect(out.NU).toBe(NU);
        expect(out.NS).toBe(NS);

        const expectedLen = (NU ** ((dL1.dim as number) + (dR1.dim as number))) * (NS as number);
        expect((out as any).values.length).toBe(expectedLen);
    });

    it('pointwise correctness for dimL=1, dimR=1', () => {
        const out = materializeTensorDenseDense(dL1, dR1)! as CFUnitFuncDense<CFUint32Two>;
        const maxU = Math.min(NU, 5);
        const maxS = Math.min(NS, 3);

        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let uL = 0 as CFUnit; uL < maxU; uL = (uL + 1) as CFUnit) {
                for (let uR = 0 as CFUnit; uR < maxU; uR = (uR + 1) as CFUnit) {
                    const got = out.getUnsafe(uL, uR, s);
                    const expected = ALGEBRA_IVAL.mul(dL1.getUnsafe(uL, s), dR1.getUnsafe(uR, s));
                    expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
                }
            }
        }
    });

    it('dimL=1, dimR=2 spot-check', () => {
        // Make a Dense<2> on the right from a const<2> ⊗ dense<0> (simple way to get a dim-2 block)
        const c2 = createConstUnitFunc(2 as CFUint32Two, NU, NS, [2, 2] as any);
        // Reuse your earlier materializer to build a Dense<2> quickly:
        const dR2 = materializeTensorConstDense(c2, createZeroDimFunc(NU, NS, [ALGEBRA_IVAL.one(), ALGEBRA_IVAL.one()])) as CFUnitFuncDense<CFUint32Two>;
        // If that path isn’t handy in your current file, feel free to create another Dense<2> however you prefer.

        const out = materializeTensorDenseDense(dL1, dR2)! as CFUnitFuncDense<CFUint32Three>;
        expect(out.dim).toBe((dL1.dim + dR2.dim) as CFDim);

        const maxU = Math.min(NU, 3);
        const maxS = Math.min(NS, 2);
        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let uL = 0 as CFUnit; uL < maxU; uL = (uL + 1) as CFUnit) {
                for (let u1 = 0 as CFUnit; u1 < maxU; u1 = (u1 + 1) as CFUnit) {
                    for (let u2 = 0 as CFUnit; u2 < maxU; u2 = (u2 + 1) as CFUnit) {
                        const got = out.getUnsafe(uL, u1, u2, s);
                        const expected = ALGEBRA_IVAL.mul(dL1.getUnsafe(uL, s), dR2.getUnsafe(u1, u2, s));
                        expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
                    }
                }
            }
        }
    });
});