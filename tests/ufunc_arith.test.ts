import { describe, it, expect } from "vitest";

import {
    ALGEBRA_IVAL,
    CFArithOp,
    CFBinOpType,
    CFCompFuncBinary, CFIval, CFSeriesIndex,
    CFUint32,
    CFUint32Zero, CFUnit,
    CFUnitFunc,
    CFUnitFuncArithImpl,
    createBinaryCompFunc, createBaseUnitFunction, createConstUnitFunc,
    createZeroDimFunc,
    CFStorageTag
} from "../src";

import {makeValidCFCompDataset} from "./utils/dataset_gen";

// ============================================================================
// CFUnitFuncArithImpl — constructor & getUnsafe
// ============================================================================

function getCompFunc(): CFCompFuncBinary {
    const base = makeValidCFCompDataset({
        maxUnitIndex: 1,
        maxSeriesIndex: 1,
        numComparisons: 2,
        loRange: [0.1,1],
        hiRange: [1,2]
    });
    return createBinaryCompFunc(base.arr, base.numUnits, base.numSeriesIndices);
}


describe('CFUnitFuncArithImpl.constructor', () => {
    it('sets storage, keeps NU/NS, dim, left/right, CFArithOp, opType', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]); // Dense(0)
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 5] as any]); // Dense(0)
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Add, CFBinOpType.Right);

        expect(node.storage).toBe(CFStorageTag.Arith);
        expect(node.NU).toBe(A.NU);
        expect(node.NS).toBe(A.NS);
        expect(node.dim).toBe(A.dim);
        expect(node.left).toBe(A);
        expect(node.right).toBe(B);
        expect(node.arithOp).toBe(CFArithOp.Add);
        expect(node.opType).toBe(CFBinOpType.Right);
    });

    it('throws when dims mismatch', () => {
        const d0 = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[1, 1] as any]); // dim=0
        // Build a dim=1 node (sparse) to force mismatch
        const cf = getCompFunc();
        const s1 = createBaseUnitFunction(cf, 0 as CFUnit); // dim=1

        expect(() => new CFUnitFuncArithImpl(d0.NU, d0.NS, d0, s1 as unknown as CFUnitFunc<CFUint32Zero>,
            CFArithOp.Mul, CFBinOpType.Left)).toThrow();
    });

    it('throws when NU/NS mismatch', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[1, 2] as any]);
        const B_badNU = createZeroDimFunc(2 as CFUint32, 1 as CFUint32,
            [ALGEBRA_IVAL.one(), ALGEBRA_IVAL.one()]);
        // same dim (0), different NU -> should throw
        expect(() => new CFUnitFuncArithImpl(A.NU, A.NS, A, B_badNU, CFArithOp.Sub, CFBinOpType.Left)).toThrow();
    });
});

describe('CFUnitFuncArithImpl.getUnsafe', () => {
    // Helper: zero-dim const/dense for easy indexing (only need series index)
    const D = (ival: CFIval) => createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [ival]);
    const C = (ival: CFIval) =>
        createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, ival);

    it('Add ignores opType (commutative)', () => {
        const A = D([2, 3] as any);
        const B = D([4, 5] as any);
        const left = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Add, CFBinOpType.Left);
        const right = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Add, CFBinOpType.Right);

        const s = 0 as CFSeriesIndex;
        const expected = ALGEBRA_IVAL.add([2, 3] as any, [4, 5] as any);
        expect(ALGEBRA_IVAL.eq(left.getUnsafe(s), expected)).toBe(true);
        expect(ALGEBRA_IVAL.eq(right.getUnsafe(s), expected)).toBe(true);
    });

    it('Mul ignores opType (commutative)', () => {
        const A = D([2, 3] as any);
        const B = D([4, 5] as any);

        const left = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Mul, CFBinOpType.Left);
        const right = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Mul, CFBinOpType.Right);

        const s = 0 as CFSeriesIndex;
        const expected = ALGEBRA_IVAL.mul([2, 3] as any, [4, 5] as any);

        expect(ALGEBRA_IVAL.eq(left.getUnsafe(s), expected)).toBe(true);
        expect(ALGEBRA_IVAL.eq(right.getUnsafe(s), expected)).toBe(true);
    });

    it('Sub respects opType (Left = A - B, Right = B - A)', () => {
        const A = D([5, 8] as any);
        const B = D([2, 3] as any);

        const left = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Sub, CFBinOpType.Left);
        const right = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Sub, CFBinOpType.Right);

        const s = 0 as CFSeriesIndex;

        const expectedLeft = ALGEBRA_IVAL.sub([5, 8] as any, [2, 3] as any); // A - B
        const expectedRight = ALGEBRA_IVAL.sub([2, 3] as any, [5, 8] as any); // B - A

        expect(ALGEBRA_IVAL.eq(left.getUnsafe(s), expectedLeft)).toBe(true);
        expect(ALGEBRA_IVAL.eq(right.getUnsafe(s), expectedRight)).toBe(true);
    });

    it('Div respects opType (Left = A / B, Right = B / A)', () => {
        const A = D([6, 12] as any);
        const B = D([2, 3] as any);

        const left = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Div, CFBinOpType.Left);
        const right = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Div, CFBinOpType.Right);

        const s = 0 as CFSeriesIndex;

        const expectedLeft = ALGEBRA_IVAL.div([6, 12] as any, [2, 3] as any); // A / B
        const expectedRight = ALGEBRA_IVAL.div([2, 3] as any, [6, 12] as any); // B / A

        expect(ALGEBRA_IVAL.eq(left.getUnsafe(s), expectedLeft)).toBe(true);
        expect(ALGEBRA_IVAL.eq(right.getUnsafe(s), expectedRight)).toBe(true);
    });

    it('handles const children (one side const) identically to dense values', () => {
        const Aconst = C([10, 10] as any);          // const leaf (cached in node)
        const Bdense = D([2, 4] as any);            // zero-dim dense
        const node = new CFUnitFuncArithImpl(Bdense.NU, Bdense.NS, Aconst, Bdense, CFArithOp.Sub, CFBinOpType.Left);

        const s = 0 as CFSeriesIndex;
        const expected = ALGEBRA_IVAL.sub([10, 10] as any, [2, 4] as any);
        expect(ALGEBRA_IVAL.eq(node.getUnsafe(s), expected)).toBe(true);
    });

});
