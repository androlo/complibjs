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
    CFUint32Zero,
    CFUnitFunc,
    CFUnitFuncConst,
    CFUnitFuncPowInt,
    createBinaryCompFunc,
    createZeroDimFunc,
    CFStorageTag
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {CFUnitFuncPowIntImpl} from "../src/ufunc";

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
// CFUnitFuncPowIntImpl — full suite (one describe per method)
// ============================================================================

// Tiny helpers for easy fixtures
const Z1 = (ival: CFIval = [2, 3] as any) =>
    createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [ival]); // Dense(0)
const ONE = ALGEBRA_IVAL.one();
const NULL = ALGEBRA_IVAL.null();

// Convenience: build f^n
const powIntNode = (exp: CFInt32, base?: CFUnitFunc<CFUint32Zero>) => {
    const b = base ?? Z1([2, 4] as any);
    return new CFUnitFuncPowIntImpl(b.NU, b.NS, b, exp);
};

// ============================================================================
// add
// ============================================================================
describe('CFUnitFuncPowIntImpl.add', () => {
    it('wraps arithBase with CFArithOp.Add and passes opType through', () => {
        const A = powIntNode(2 as CFInt32);
        const B = Z1([5, 6] as any);
        const res = A.add(B, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Add);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(A);
        expect((res as any).right).toBe(B);
    });

    it('domain mismatch ⇒ undefined', () => {
        const A = powIntNode(2 as CFInt32);
        const bad = createZeroDimFunc(2 as CFUint32, 1 as CFUint32, [ONE, ONE]); // NS same, NU mismatched

        expect(A.add(bad, CFBinOpType.Left)).toBeUndefined();
    });
});

// ============================================================================
// sub
// ============================================================================
describe('CFUnitFuncPowIntImpl.sub', () => {
    it('wraps arithBase with CFArithOp.Sub and passes opType through', () => {
        const A = powIntNode(3 as CFInt32);
        const B = Z1([1, 1] as any);
        const res = A.sub(B, CFBinOpType.Left)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Sub);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).left).toBe(A);
        expect((res as any).right).toBe(B);
    });
});

// ============================================================================
// neg
// ============================================================================
describe('CFUnitFuncPowIntImpl.neg', () => {
    it('neg() delegates to smul([-1,-1]) and returns Arith(Mul, this, const([-1,-1]))', () => {
        const A = powIntNode(2 as CFInt32);
        const res = A.neg();
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).left).toBe(A);
        const right = (res as any).right as CFUnitFuncConst<CFDim>;
        expect(right.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq((right as any).value, [-1, -1] as any)).toBe(true);
    });
});

// ============================================================================
// mul
// ============================================================================
describe('CFUnitFuncPowIntImpl.mul', () => {
    it('wraps arithBase with CFArithOp.Mul and passes opType through', () => {
        const A = powIntNode(2 as CFInt32);
        const B = Z1([4, 5] as any);
        const res = A.mul(B, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(A);
        expect((res as any).right).toBe(B);
    });
});

// ============================================================================
// div
// ============================================================================
describe('CFUnitFuncPowIntImpl.div', () => {
    it('wraps arithBase with CFArithOp.Div and passes opType through', () => {
        const A = powIntNode(2 as CFInt32);
        const B = Z1([4, 5] as any);
        const res = A.div(B, CFBinOpType.Left)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Div);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).left).toBe(A);
        expect((res as any).right).toBe(B);
    });
});

// ============================================================================
// inv
// ============================================================================
describe('CFUnitFuncPowIntImpl.inv', () => {
    it('inverts the integer exponent: (f^n)^-1 = f^-n; 0 stays 0', () => {
        const A = powIntNode(3 as CFInt32);
        const invA = A.inv() as CFUnitFuncPowInt<CFUint32Zero>;
        expect(invA.storage).toBe(CFStorageTag.PowInt);
        expect(invA.base).toBe(A.base);
        expect(invA.exp).toBe(-3 as CFInt32);

        const Z = powIntNode(0 as CFInt32);
        const invZ = Z.inv() as CFUnitFuncPowInt<CFUint32Zero>;
        expect(invZ.exp).toBe(0); // base^0 is 1; its inverse is still 1 → exponent remains 0
    });
});

// ============================================================================
// smul
// ============================================================================
describe('CFUnitFuncPowIntImpl.smul', () => {
    it('returns Arith(Mul) with left=this, right=const(x), opType propagated', () => {
        const A = powIntNode(2 as CFInt32);
        const x = [0.5, 0.5] as any as CFIval;
        const res = A.smul(x, CFBinOpType.Right);
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(A);
        const right = (res as any).right as CFUnitFuncConst<CFDim>;
        expect(right.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq((right as any).value, x)).toBe(true);
    });
});

// ============================================================================
// tmul
// ============================================================================
describe('CFUnitFuncPowIntImpl.tmul', () => {
    it('returns Tensor(left=this, right=other, opType propagated)', () => {
        const A = powIntNode(2 as CFInt32);
        const other = Z1([7, 8] as any);
        const res = A.tmul(other, CFBinOpType.Left)!;
        expect(res.storage).toBe(CFStorageTag.Tensor);
        expect((res as any).left).toBe(A);
        expect((res as any).right).toBe(other);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).dim).toBe((A as any).dim + (other as any).dim);
    });
});

// ============================================================================
// powInt (composition rule)
// ============================================================================
describe('CFUnitFuncPowIntImpl.powInt', () => {
    it('exp=0 → returns PowInt(base, 0) (handles 0^0 via total arithmetic)', () => {
        const A = powIntNode(5 as CFInt32);
        const res = A.powInt(0 as CFInt32);
        expect(res.storage).toBe(CFStorageTag.PowInt);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBe(0);
    });

    it('(f^n)^m = f^(n*m) with 32-bit truncation semantics', () => {
        const A = powIntNode(4 as CFInt32);
        const res = A.powInt(3 as CFInt32);
        expect(res.storage).toBe(CFStorageTag.PowInt);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBe(12 as CFInt32);
    });
});

// ============================================================================
// pow (real exponent composition rule)
// ============================================================================
describe('CFUnitFuncPowIntImpl.pow', () => {
    it('returns PowReal(base, n * r) with same (dim, NU, NS)', () => {
        const A = powIntNode(4 as CFInt32); // n = 4
        const r = 0.5 as CFReal;
        const res = A.pow(r);
        expect(res.storage).toBe(CFStorageTag.PowReal);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBeCloseTo(2); // 4 * 0.5 = 2
        expect((res as any).dim).toBe((A as any).dim);
        expect((res as any).NU).toBe((A as any).NU);
        expect((res as any).NS).toBe((A as any).NS);
    });
});

// ============================================================================
// nthRoot (algebraic simplifications)
// ============================================================================
describe('CFUnitFuncPowIntImpl.nthRoot', () => {
    it('exp=0 ⇒ Const null (total arithmetic)', () => {
        const A = powIntNode(2 as CFInt32);
        const res = A.nthRoot(0 as CFUint32) as CFUnitFuncConst<CFDim>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((res as any).value)).toBe(true);
    });

    it('n root (f^n) = f (returns base instance)', () => {
        const A = powIntNode(3 as CFInt32);
        const res = A.nthRoot(3 as CFUint32) as CFUnitFunc<CFUint32Zero>;
        expect(res).toBe(A.base);
    });

    it('m = k·n: n root (f^m) = f^k (when n divides m)', () => {
        const A = powIntNode(12 as CFInt32); // m=12
        const res = A.nthRoot(4 as CFUint32); // n=4 → k=3
        expect(res.storage).toBe(CFStorageTag.PowInt);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBe(3 as CFInt32);
    });

    it('n = k·m and m>0: n root (f^m) = k root f (when m divides n)', () => {
        const A = powIntNode(2 as CFInt32); // m=2>0
        const res = A.nthRoot(6 as CFUint32); // n=6 → k=3
        expect(res.storage).toBe(CFStorageTag.NthRoot);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBe(3 as CFUint32);
    });

    it('otherwise: returns NthRoot(base, n)', () => {
        const A = powIntNode(5 as CFInt32);
        const res = A.nthRoot(4 as CFUint32);
        expect(res.storage).toBe(CFStorageTag.NthRoot);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBe(4 as CFUint32);
    });
});

// ============================================================================
// type guards & materialize
// ============================================================================
describe('CFUnitFuncPowIntImpl — guards & materialize', () => {
    it('isLeaf=false, isAlg=true, materialize() returns something truthy', () => {
        const A = powIntNode(2 as CFInt32);
        expect(A.isLeaf()).toBe(false);
        expect(A.isAlg()).toBe(true);
        expect(A.materialize()).toBeTruthy();
    });
});
