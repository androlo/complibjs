import {describe, expect, it} from "vitest";
import {
    ALGEBRA_IVAL,
    CFArithOp,
    CFBinOpType,
    CFDim,
    CFInt32,
    CFIval,
    CFReal,
    CFUint32,
    CFUint32Zero,
    CFUnitFunc,
    CFUnitFuncConst,
    CFUnitFuncPowReal,
    createZeroDimFunc,
    CFStorageTag
} from "../src";
import {CFUnitFuncPowRealImpl} from "../src/ufunc";

// ============================================================================
// CFUnitFuncPowRealImpl — full suite (one describe per method)
// ============================================================================

// Simple zero-dim dense base
const Z1 = (ival: CFIval = [2, 3] as any) =>
    createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [ival]); // Dense(0)
const ONE = ALGEBRA_IVAL.one();
const NULL = ALGEBRA_IVAL.null();

// Build f^r (real exponent)
const powRealNode = (exp: CFReal, base?: CFUnitFunc<CFUint32Zero>) => {
    const b = base ?? Z1([2, 4] as any);
    return new CFUnitFuncPowRealImpl(b.NU, b.NS, b, exp);
};

// ============================================================================
// add
// ============================================================================
describe('CFUnitFuncPowRealImpl.add', () => {
    it('wraps arithBase with CFArithOp.Add and passes opType through', () => {
        const A = powRealNode(0.5 as CFReal);
        const B = Z1([5, 6] as any);
        const res = A.add(B, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Add);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(A);
        expect((res as any).right).toBe(B);
    });

    it('domain mismatch ⇒ undefined', () => {
        const A = powRealNode(1.25 as CFReal);
        const bad = createZeroDimFunc(2 as CFUint32, 1 as CFUint32, [ONE, ONE]); // NU mismatched

        expect(A.add(bad, CFBinOpType.Left)).toBeUndefined();
    });
});

// ============================================================================
// sub
// ============================================================================
describe('CFUnitFuncPowRealImpl.sub', () => {
    it('wraps arithBase with CFArithOp.Sub and passes opType through', () => {
        const A = powRealNode(2 as CFReal);
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
describe('CFUnitFuncPowRealImpl.neg', () => {
    it('neg() delegates to smul([-1,-1]) and returns Arith(Mul, this, const([-1,-1]))', () => {
        const A = powRealNode(1.5 as CFReal);
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
describe('CFUnitFuncPowRealImpl.mul', () => {
    it('wraps arithBase with CFArithOp.Mul and passes opType through', () => {
        const A = powRealNode(0.25 as CFReal);
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
describe('CFUnitFuncPowRealImpl.div', () => {
    it('wraps arithBase with CFArithOp.Div and passes opType through', () => {
        const A = powRealNode(3 as CFReal);
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
describe('CFUnitFuncPowRealImpl.inv', () => {
    it('inverts the real exponent: (f^r)^-1 = f^(-r)', () => {
        const A = powRealNode(2.5 as CFReal);
        const invA = A.inv() as CFUnitFuncPowReal<CFUint32Zero>;
        expect(invA.storage).toBe(CFStorageTag.PowReal);
        expect(invA.base).toBe(A.base);
        // Accept both exact and via helper
        expect((invA as any).exp).toBeCloseTo(-2.5);
    });

    it('r=0 stays 0 after inv (1 stays 1 in total arithmetic)', () => {
        const A = powRealNode(0 as CFReal);
        const invA = A.inv() as CFUnitFuncPowReal<CFUint32Zero>;
        expect(invA.exp).toBe(0);
    });
});

// ============================================================================
// smul
// ============================================================================
describe('CFUnitFuncPowRealImpl.smul', () => {
    it('returns Arith(Mul) with left=this, right=const(x), opType propagated', () => {
        const A = powRealNode(1.75 as CFReal);
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
describe('CFUnitFuncPowRealImpl.tmul', () => {
    it('returns Tensor(left=this, right=other, opType propagated)', () => {
        const A = powRealNode(2 as CFReal);
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
// powInt (composition)
// ============================================================================
describe('CFUnitFuncPowRealImpl.powInt', () => {
    it('exp=0 → returns PowInt(base, 0) (handles 0^0 via total arithmetic)', () => {
        const A = powRealNode(4 as CFReal);
        const res = A.powInt(0 as CFInt32);
        expect(res.storage).toBe(CFStorageTag.PowInt);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBe(0);
    });

    it('(f^r)^m = f^(r*m) (real*int)', () => {
        const A = powRealNode(1.5 as CFReal);
        const res = A.powInt(3 as CFInt32);
        expect(res.storage).toBe(CFStorageTag.PowReal);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBeCloseTo(4.5);
    });
});

// ============================================================================
// pow (composition)
// ============================================================================
describe('CFUnitFuncPowRealImpl.pow', () => {
    it('exp=0 → returns PowReal(base, 0)', () => {
        const A = powRealNode(3 as CFReal);
        const res = A.pow(0 as CFReal);
        expect(res.storage).toBe(CFStorageTag.PowReal);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBe(0);
    });

    it('(f^r)^q = f^(r*q) (real*real)', () => {
        const A = powRealNode(2.25 as CFReal);
        const res = A.pow(0.5 as CFReal);
        expect(res.storage).toBe(CFStorageTag.PowReal);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBeCloseTo(1.125); // 2.25 * 0.5
    });
});

// ============================================================================
// nthRoot
// ============================================================================
describe('CFUnitFuncPowRealImpl.nthRoot', () => {
    it('n = 0 ⇒ Const null (total arithmetic)', () => {
        const A = powRealNode(2 as CFReal);
        const res = A.nthRoot(0 as CFUint32) as CFUnitFuncConst<CFDim>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((res as any).value)).toBe(true);
    });

    it('n root (f^r) = f^(r / n)', () => {
        const A = powRealNode(3 as CFReal);
        const res = A.nthRoot(3 as CFUint32) as CFUnitFuncPowReal<CFUint32Zero>;
        expect(res.storage).toBe(CFStorageTag.PowReal);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBeCloseTo(1); // 3 / 3
    });
});

// ============================================================================
// type guards & materialize
// ============================================================================
describe('CFUnitFuncPowRealImpl — guards & materialize', () => {
    it('isLeaf=false, isAlg=true, materialize() returns something truthy', () => {
        const A = powRealNode(2 as CFReal);
        expect(A.isLeaf()).toBe(false);
        expect(A.isAlg()).toBe(true);
        expect(A.materialize()).toBeTruthy();
    });
});
