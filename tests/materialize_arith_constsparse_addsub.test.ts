import {describe, expect, it} from "vitest";
import {
    ALGEBRA_IVAL,
    CFBinOpType,
    CFCompFuncBinary,
    CFIval,
    CFSeriesIndex,
    CFUint32One,
    CFUnit,
    CFUnitFuncDense,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createConstUnitFunc,
    CFStorageTag
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {materializeConstSparseAddSub} from "../src/materialize";

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

describe('materializeConstSparseAddSub', () => {
    // Build a real 1-D sparse (CSR) from your factory
    const cf = getCompFunc();
    const sparse1D = createBaseUnitFunction(cf, 0 as CFUnit); // CFUnitFuncSparse<1>
    const NU = sparse1D.NU;
    const NS = sparse1D.NS;

    // Small helper to exhaustively check a few (u, s) points
    const checkPoints = (dense: CFUnitFuncDense<CFUint32One>, cVal: CFIval, op: (a: CFIval, b: CFIval) => CFIval, left: boolean) => {
        const maxU = Math.min(NU, 8);
        const maxS = Math.min(NS, 3);

        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let u = 0 as CFUnit; u < maxU; u = (u + 1) as CFUnit) {
                const sVal = sparse1D.getUnsafe(u, s) ?? ALGEBRA_IVAL.null();
                const expected = left ? op(cVal, sVal) : op(sVal, cVal);
                const got = dense.getUnsafe(u, s);
                expect(ALGEBRA_IVAL.eq(got, expected)).toBe(true);
            }
        }
    };

    it('Add, opType=Left: (const + sparse) → Dense', () => {
        const c = createConstUnitFunc(sparse1D.dim, NU, NS, [2, 3] as any as CFIval);
        const out = materializeConstSparseAddSub(c, sparse1D, ALGEBRA_IVAL.add, CFBinOpType.Left);

        expect(out.storage).toBe(CFStorageTag.Dense);
        expect(out.dim).toBe(sparse1D.dim);
        expect(out.NU).toBe(NU);
        expect(out.NS).toBe(NS);

        checkPoints(out as CFUnitFuncDense<CFUint32One>, c.value, ALGEBRA_IVAL.add, true);
    });

    it('Add, opType=Right: (sparse + const) → Dense', () => {
        const c = createConstUnitFunc(sparse1D.dim, NU, NS, [2, 3] as any as CFIval);
        const out = materializeConstSparseAddSub(c, sparse1D, ALGEBRA_IVAL.add, CFBinOpType.Right);
        expect(out.storage).toBe(CFStorageTag.Dense);

        checkPoints(out as CFUnitFuncDense<CFUint32One>, c.value, ALGEBRA_IVAL.add, false);
    });

    it('Sub, opType=Left: (const − sparse) → Dense', () => {
        const c = createConstUnitFunc(sparse1D.dim, NU, NS, [5, 7] as any as CFIval);
        const out = materializeConstSparseAddSub(c, sparse1D, ALGEBRA_IVAL.sub, CFBinOpType.Left);
        expect(out.storage).toBe(CFStorageTag.Dense);

        checkPoints(out as CFUnitFuncDense<CFUint32One>, c.value, ALGEBRA_IVAL.sub, true);
    });

    it('Sub, opType=Right: (sparse − const) → Dense', () => {
        const c = createConstUnitFunc(sparse1D.dim, NU, NS, [5, 7] as any as CFIval);
        const out = materializeConstSparseAddSub(c, sparse1D, ALGEBRA_IVAL.sub, CFBinOpType.Right);
        expect(out.storage).toBe(CFStorageTag.Dense);

        checkPoints(out as CFUnitFuncDense<CFUint32One>, c.value, ALGEBRA_IVAL.sub, false);
    });

    it('Add with const null: results equal sparse (total arithmetic)', () => {
        const c0 = createConstUnitFunc(sparse1D.dim, NU, NS, ALGEBRA_IVAL.null());
        const out = materializeConstSparseAddSub(c0, sparse1D, ALGEBRA_IVAL.add, CFBinOpType.Left);
        const maxU = Math.min(NU, 8);
        const maxS = Math.min(NS, 3);

        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let u = 0 as CFUnit; u < maxU; u = (u + 1) as CFUnit) {
                const sv = sparse1D.getUnsafe(u, s) ?? ALGEBRA_IVAL.null();
                const dv = out.getUnsafe(u, s);
                expect(ALGEBRA_IVAL.eq(dv, sv)).toBe(true);
            }
        }
    });

    it('Sub with const null, opType=Left: (0 − sparse) = −sparse', () => {
        const c0 = createConstUnitFunc(sparse1D.dim, NU, NS, ALGEBRA_IVAL.null());
        const out = materializeConstSparseAddSub(c0, sparse1D, ALGEBRA_IVAL.sub, CFBinOpType.Left);
        const maxU = Math.min(NU, 8);
        const maxS = Math.min(NS, 3);

        for (let s = 0 as CFSeriesIndex; s < maxS; s = (s + 1) as CFSeriesIndex) {
            for (let u = 0 as CFUnit; u < maxU; u = (u + 1) as CFUnit) {
                const sv = sparse1D.getUnsafe(u, s) ?? ALGEBRA_IVAL.null();
                const expected = ALGEBRA_IVAL.mul([-1, -1] as any, sv);
                const dv = out.getUnsafe(u, s);
                expect(ALGEBRA_IVAL.eq(dv, expected)).toBe(true);
            }
        }
    });
});
