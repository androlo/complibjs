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
    CFUnitFuncNthRoot,
    CFUnitFuncPowInt,
    CFUnitFuncPowReal,
    createZeroDimFunc,
    CFStorageTag
} from "../src";
import {CFUnitFuncNthRootImpl} from "../src/ufunc";

// ============================================================================
// CFUnitFuncNthRootImpl — full suite (one describe per method)
// ============================================================================

const Z1 = (ival: CFIval = [4, 9] as any) =>
    createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [ival]); // Dense(0)
const ONE = ALGEBRA_IVAL.one();
const NULL = ALGEBRA_IVAL.null();

// Build n√(base)
const nrootNode = (n: CFUint32, base?: CFUnitFunc<CFUint32Zero>) => {
    const b = base ?? Z1([4, 9] as any);
    return new CFUnitFuncNthRootImpl(b.NU, b.NS, b, n);
};

// ============================================================================
// add
// ============================================================================
describe('CFUnitFuncNthRootImpl.add', () => {
    it('wraps arithBase with CFArithOp.Add and passes opType through', () => {
        const A = nrootNode(2 as CFUint32);
        const B = Z1([1, 2] as any);
        const res = A.add(B, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Add);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(A);
        expect((res as any).right).toBe(B);
    });

    it('domain mismatch ⇒ undefined', () => {
        const A = nrootNode(3 as CFUint32);
        const bad = createZeroDimFunc(2 as CFUint32, 1 as CFUint32, [ONE, ONE]); // NU mismatch

        expect(A.add(bad, CFBinOpType.Left)).toBeUndefined();
    });
});

// ============================================================================
// sub
// ============================================================================
describe('CFUnitFuncNthRootImpl.sub', () => {
    it('wraps arithBase with CFArithOp.Sub and passes opType through', () => {
        const A = nrootNode(5 as CFUint32);
        const B = Z1([16, 25] as any);
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
describe('CFUnitFuncNthRootImpl.neg', () => {
    it('neg() delegates to smul([-1,-1]) and returns Arith(Mul, this, const([-1,-1]))', () => {
        const A = nrootNode(2 as CFUint32);
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
describe('CFUnitFuncNthRootImpl.mul', () => {
    it('wraps arithBase with CFArithOp.Mul and passes opType through', () => {
        const A = nrootNode(2 as CFUint32);
        const B = Z1([1, 1] as any);
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
describe('CFUnitFuncNthRootImpl.div', () => {
    it('wraps arithBase with CFArithOp.Div and passes opType through', () => {
        const A = nrootNode(3 as CFUint32);
        const B = Z1([2, 3] as any);
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
describe('CFUnitFuncNthRootImpl.inv', () => {
    it('returns PowReal(base, -1/n)', () => {
        const A = nrootNode(4 as CFUint32);
        const invA = A.inv() as CFUnitFuncPowReal<CFUint32Zero>;
        expect(invA.storage).toBe(CFStorageTag.PowReal);
        expect(invA.base).toBe(A.base);
        // exp should be close to -0.25
        expect((invA as any).exp).toBeCloseTo(-0.25);
    });
});

// ============================================================================
// smul
// ============================================================================
describe('CFUnitFuncNthRootImpl.smul', () => {
    it('returns Arith(Mul) with left=this, right=const(x), opType propagated (no null short-circuit here)', () => {
        const A = nrootNode(2 as CFUint32);
        const x = NULL; // still represented as const(null) on the right
        const res = A.smul(x, CFBinOpType.Right);
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(A);
        const right = (res as any).right as CFUnitFuncConst<CFDim>;
        expect(right.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((right as any).value)).toBe(true);
    });
});

// ============================================================================
// tmul
// ============================================================================
describe('CFUnitFuncNthRootImpl.tmul', () => {
    it('returns Tensor(left=this, right=other, opType propagated)', () => {
        const A = nrootNode(2 as CFUint32);
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
// powInt (composition / divisibility rules)
// ============================================================================
describe('CFUnitFuncNthRootImpl.powInt', () => {
    it('exp=0 → returns PowInt(base, 0)', () => {
        const A = nrootNode(5 as CFUint32);
        const res = A.powInt(0 as CFInt32);
        expect(res.storage).toBe(CFStorageTag.PowInt);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBe(0);
    });

    it('if n | m: (n root f)^m = f^(m/n) (keeps sign for negative m)', () => {
        const A = nrootNode(4 as CFUint32);
        const res1 = A.powInt(8 as CFInt32) as CFUnitFuncPowInt<CFUint32Zero>;
        expect(res1.storage).toBe(CFStorageTag.PowInt);
        expect((res1 as any).base).toBe(A.base);
        expect((res1 as any).exp).toBe(2 as CFInt32);

        const res2 = A.powInt(-8 as CFInt32) as CFUnitFuncPowInt<CFUint32Zero>;
        expect(res2.storage).toBe(CFStorageTag.PowInt);
        expect((res2 as any).base).toBe(A.base);
        expect((res2 as any).exp).toBe(-2 as CFInt32);
    });

    it('otherwise: returns PowInt(this, m)', () => {
        const A = nrootNode(3 as CFUint32);
        const res = A.powInt(2 as CFInt32);
        expect(res.storage).toBe(CFStorageTag.PowInt);
        expect((res as any).base).toBe(A);
        expect((res as any).exp).toBe(2 as CFInt32);
    });
});

// ============================================================================
// pow (composition)
// ============================================================================
describe('CFUnitFuncNthRootImpl.pow', () => {
    it('exp=0 → returns PowReal(base, 0)', () => {
        const A = nrootNode(6 as CFUint32);
        const res = A.pow(0 as CFReal);
        expect(res.storage).toBe(CFStorageTag.PowReal);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBe(0);
    });

    it('(n root f)^r = f^(r / n)', () => {
        const A = nrootNode(2 as CFUint32);
        const res = A.pow(3 as CFReal);
        expect(res.storage).toBe(CFStorageTag.PowReal);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBeCloseTo(1.5); // 3 / 2
    });
});

// ============================================================================
// nthRoot (nesting rule)
// ============================================================================
describe('CFUnitFuncNthRootImpl.nthRoot', () => {
    it('exp=0 → Const null (total arithmetic)', () => {
        const A = nrootNode(2 as CFUint32);
        const res = A.nthRoot(0 as CFUint32) as CFUnitFuncConst<CFDim>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((res as any).value)).toBe(true);
    });

    it('n root (m root f) = (n*m) root f', () => {
        const A = nrootNode(3 as CFUint32);
        const res = A.nthRoot(4 as CFUint32) as CFUnitFuncNthRoot<CFUint32Zero>;
        expect(res.storage).toBe(CFStorageTag.NthRoot);
        expect((res as any).base).toBe(A.base);
        expect((res as any).exp).toBe(12);
    });
});

// ============================================================================
// type guards & materialize
// ============================================================================
describe('CFUnitFuncNthRootImpl — guards & materialize', () => {
    it('isLeaf=false, isAlg=true, materialize() returns something truthy', () => {
        const A = nrootNode(2 as CFUint32);
        expect(A.isLeaf()).toBe(false);
        expect(A.isAlg()).toBe(true);
        expect(A.materialize()).toBeTruthy();
    });
});
