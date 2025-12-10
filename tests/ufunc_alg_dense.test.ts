import {describe, expect, it} from "vitest";
import {
    ALGEBRA_IVAL,
    CFArithOp,
    CFBinOpType,
    CFCompFuncBinary,
    CFDim,
    CFInt32,
    CFIval,
    CFReal,
    CFUint32,
    CFUnit,
    CFUnitFuncConst,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createZeroDimFunc,
    CFStorageTag
} from "../src";

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.arithBase
// ─────────────────────────────────────────────────────────────────────────────

import {makeValidCFCompDataset} from "./utils/dataset_gen";

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

describe('CFUnitFuncDenseImpl.arithBase', () => {
    it('returns Arith node when domains match; undefined otherwise', () => {
        // two zero-dim dense with same (NU, NS) => domains match
        const d0a = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [ALGEBRA_IVAL.one()]);
        const d0b = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);

        const ar = (d0a as any).arithBase(d0b, CFArithOp.Add, CFBinOpType.Right);
        expect(ar!.storage).toBe(CFStorageTag.Arith);
        expect((ar as any).arithOp).toBe(CFArithOp.Add);
        expect((ar as any).opType).toBe(CFBinOpType.Right);
        expect((ar as any).left).toBe(d0a);
        expect((ar as any).right).toBe(d0b);

        // domain mismatch: dim(0) vs dim(0) is fine, so mismatch via NU/NS
        const d0c = createZeroDimFunc(2 as CFUint32, 1 as CFUint32, [ALGEBRA_IVAL.one(), ALGEBRA_IVAL.one()]);
        const mis = (d0a as any).arithBase(d0c, CFArithOp.Add, CFBinOpType.Left);
        expect(mis).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.add
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.add', () => {
    it('wraps arithBase with CFArithOp.Add and passes opType through', () => {
        const d0a = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [ALGEBRA_IVAL.one()]);
        const d0b = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);

        const res = d0a.add(d0b, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Add);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(d0a);
        expect((res as any).right).toBe(d0b);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.sub
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.sub', () => {
    it('wraps arithBase with CFArithOp.Sub and passes opType through', () => {
        const d0a = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[5, 6] as any]);
        const d0b = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);

        const res = d0a.sub(d0b, CFBinOpType.Left)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Sub);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).left).toBe(d0a);
        expect((res as any).right).toBe(d0b);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.neg
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.neg', () => {
    it('delegates via smul([-1,-1]) and produces Arith(Mul) with left=const([-1,-1])', () => {
        const d0 = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const res = d0.neg();
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        const left = (res as any).left as CFUnitFuncConst<CFDim>;
        expect(left.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq(left.value, [-1, -1] as any)).toBe(true);
        expect((res as any).right).toBe(d0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.mul
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.mul', () => {
    it('wraps arithBase with CFArithOp.Mul and passes opType through', () => {
        const d0a = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const d0b = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 5] as any]);

        const res = d0a.mul(d0b, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(d0a);
        expect((res as any).right).toBe(d0b);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.div
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.div', () => {
    it('wraps arithBase with CFArithOp.Div and passes opType through', () => {
        const d0a = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const d0b = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 5] as any]);

        const res = d0a.div(d0b, CFBinOpType.Left)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Div);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).left).toBe(d0a);
        expect((res as any).right).toBe(d0b);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.inv
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.inv', () => {
    it('builds 1 const and returns Arith(Div, left=1 const, right=this)', () => {
        const d0 = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 4] as any]);
        const res = d0.inv();
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Div);
        const left = (res as any).left as CFUnitFuncConst<CFDim>;
        expect(left.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isOne(left.value)).toBe(true);
        expect((res as any).right).toBe(d0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.smul
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.smul', () => {
    it('builds const(x) and returns Arith(Mul, left=const(x), right=this)', () => {
        const d0 = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 4] as any]);
        const x = [0.5, 0.5] as any as CFIval;
        const res = d0.smul(x);
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        const left = (res as any).left as CFUnitFuncConst<CFDim>;
        expect(left.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq(left.value, x)).toBe(true);
        expect((res as any).right).toBe(d0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.tmul
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.tmul', () => {
    it('two zero-dim dense: uses mul(), resulting in Arith(Mul) with dim 0', () => {
        const d0a = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const d0b = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 5] as any]);

        const res = d0a.tmul(d0b, CFBinOpType.Left)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).left).toBe(d0a);
        expect((res as any).right).toBe(d0b);
        expect((res as any).dim).toBe(0);
    });

    it('general case: returns Tensor node with dim = sum', () => {
        const d0 = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        // Use any non-zero-dim CFUnitFunc (e.g., a sparse from your factory)
        const cf = getCompFunc(); // or however you obtain your CFCompFuncBinary
        const suf = createBaseUnitFunction(cf, 0 as CFUnit); // dim=1 sparse

        const res = d0.tmul(suf, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Tensor);
        expect((res as any).left).toBe(d0);
        expect((res as any).right).toBe(suf);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).dim).toBe(0 + (suf as any).dim);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.powInt
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.powInt', () => {
    it('returns PowInt node with the same (dim, NU, NS)', () => {
        const d0 = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const res = d0.powInt(3 as CFInt32);
        expect(res.storage).toBe(CFStorageTag.PowInt);
        expect((res as any).dim).toBe((d0 as any).dim);
        expect((res as any).NU).toBe((d0 as any).NU);
        expect((res as any).NS).toBe((d0 as any).NS);
        expect((res as any).exp).toBe(3);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.pow
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.pow', () => {
    it('returns PowReal node with the same (dim, NU, NS)', () => {
        const d0 = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 9] as any]);
        const res = d0.pow(0.5 as CFReal);
        expect(res.storage).toBe(CFStorageTag.PowReal);
        expect((res as any).dim).toBe((d0 as any).dim);
        expect((res as any).NU).toBe((d0 as any).NU);
        expect((res as any).NS).toBe((d0 as any).NS);
        expect((res as any).exp).toBe(0.5);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.nthRoot
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncDenseImpl.nthRoot', () => {
    it('returns NthRoot node with the same (dim, NU, NS)', () => {
        const d0 = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 9] as any]);
        const res = d0.nthRoot(2 as CFUint32);
        expect(res.storage).toBe(CFStorageTag.NthRoot);
        expect((res as any).dim).toBe((d0 as any).dim);
        expect((res as any).NU).toBe((d0 as any).NU);
        expect((res as any).NS).toBe((d0 as any).NS);
        expect((res as any).exp).toBe(2);
    });
});

