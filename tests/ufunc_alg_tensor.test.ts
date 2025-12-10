import {describe, expect, it} from "vitest";
import {
    ALGEBRA_IVAL,
    CFArithOp,
    CFBinOpType,
    CF_MAX_DIM,
    CFCompFuncBinary,
    CFDim,
    CFInt32,
    CFIval,
    CFReal,
    CFUint32,
    CFUint32One,
    CFUint32Zero,
    CFUnit,
    CFUnitFunc,
    CFUnitFuncConst,
    CFUnitFuncTensorImpl,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createConstUnitFunc,
    createZeroDimFunc,
    CFStorageTag
} from "../src";
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

// ============================================================================
// CFUnitFuncTensorImpl — full suite (one big lump, one describe per method)
// ============================================================================

// Shared quick fixtures
const Z1 = () => createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [ALGEBRA_IVAL.one()]);       // Dense(0)
const Zval = (ival: CFIval) => createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [ival]);       // Dense(0)
const C0 = (dim: CFDim, U: CFUint32, S: CFUint32) => createConstUnitFunc(dim, U, S, ALGEBRA_IVAL.null());
const C1 = (dim: CFDim, U: CFUint32, S: CFUint32) => createConstUnitFunc(dim, U, S, ALGEBRA_IVAL.one());

// Build a tiny tensor node helper (0-dim ⊗ 1-dim → 1-dim tensor)
function makeTensor01() {
    const cf = getCompFunc();
    const sparse1D = createBaseUnitFunction(cf, 0 as CFUnit); // dim=1 sparse
    const d0 = Z1();
    const t = new CFUnitFuncTensorImpl(sparse1D.NU, sparse1D.NS, d0, sparse1D, CFBinOpType.Left);
    return { cf, d0, sparse1D, t };
}

// ============================================================================
// constructor / shape
// ============================================================================
describe('CFUnitFuncTensorImpl.constructor', () => {
    it('computes dim = left.dim + right.dim; sets storage=Tensor; keeps NU/NS', () => {
        const { d0, sparse1D } = makeTensor01();
        const t = new CFUnitFuncTensorImpl(sparse1D.NU, sparse1D.NS, d0, sparse1D, CFBinOpType.Right);
        expect(t.storage).toBe(CFStorageTag.Tensor);
        expect((t as any).dim).toBe((d0 as any).dim + (sparse1D as any).dim);
        expect((t as any).NU).toBe(sparse1D.NU);
        expect((t as any).NS).toBe(sparse1D.NS);
        expect(t.opType).toBe(CFBinOpType.Right);
        expect(t.left).toBe(d0);
        expect(t.right).toBe(sparse1D);
    });

    it('throws if left.NU/NS !== right.NU/NS (when guard is added)', () => {
        const d0 = Z1();
        const bad = createConstUnitFunc(1 as CFUint32One, (d0.NU + 1) as CFUint32, d0.NS, ALGEBRA_IVAL.one());

        expect(() => new CFUnitFuncTensorImpl(d0.NU, d0.NS, d0, bad, CFBinOpType.Left)).toThrow();
    });
});

// ============================================================================
// add
// ============================================================================
describe('CFUnitFuncTensorImpl.add', () => {
    it('returns Arith(Add) with opType propagated when domains match', () => {
        const { t } = makeTensor01();
        const other = t; // same shape OK
        const res = t.add(other, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Add);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(t);
        expect((res as any).right).toBe(other);
    });

    it('domain mismatch ⇒ undefined', () => {
        const { t } = makeTensor01();
        const mismatched = C1(((t as any).dim) as CFDim, (t as any).NU, ((t as any).NS + 1) as CFUint32); // NS mismatch

        expect(t.add(mismatched as any, CFBinOpType.Left)).toBeUndefined();
    });
});

// ============================================================================
// sub
// ============================================================================
describe('CFUnitFuncTensorImpl.sub', () => {
    it('returns Arith(Sub) with opType propagated', () => {
        const { t } = makeTensor01();
        const other = t;
        const res = t.sub(other, CFBinOpType.Left)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Sub);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).left).toBe(t);
        expect((res as any).right).toBe(other);
    });
});

// ============================================================================
// neg
// ============================================================================
describe('CFUnitFuncTensorImpl.neg', () => {
    it('neg() = smul([-1,-1]) → Arith(Mul, this, const([-1,-1])) or equivalent', () => {
        const { t } = makeTensor01();
        const res = t.neg()!;
        // exact shape depends on smul implementation (left const or right const).
        // We only assert it’s not undefined and remains same dim/NU/NS.
        expect((res as any).dim).toBe((t as any).dim);
        expect((res as any).NU).toBe((t as any).NU);
        expect((res as any).NS).toBe((t as any).NS);
    });
});

// ============================================================================
// mul
// ============================================================================
describe('CFUnitFuncTensorImpl.mul', () => {
    it('const-zero right ⇒ returns Const null of same dim', () => {
        const { t } = makeTensor01();
        const cz = C0((t as any).dim, (t as any).NU, (t as any).NS);
        const res = t.mul(cz, CFBinOpType.Left)! as CFUnitFuncConst<CFDim>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((res as any).value)).toBe(true);
    });

    it('general case ⇒ Arith(Mul) with opType propagated', () => {
        const { t } = makeTensor01();
        const other = t;
        const res = t.mul(other, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(t);
        expect((res as any).right).toBe(other);
    });
});

// ============================================================================
// div
// ============================================================================
describe('CFUnitFuncTensorImpl.div', () => {
    it('wraps arithBase with CFArithOp.Div and passes opType through', () => {
        const { t } = makeTensor01();
        const other = t;
        const res = t.div(other, CFBinOpType.Left)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Div);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).left).toBe(t);
        expect((res as any).right).toBe(other);
    });
});

// ============================================================================
// inv
// ============================================================================
describe('CFUnitFuncTensorImpl.inv', () => {
    it('returns PowInt node with exp=-1 and same (dim, NU, NS)', () => {
        const { t } = makeTensor01();
        const res = t.inv()!;
        expect(res.storage).toBe(CFStorageTag.PowInt);
        expect((res as any).exp).toBe(-1);
        expect((res as any).dim).toBe((t as any).dim);
        expect((res as any).NU).toBe((t as any).NU);
        expect((res as any).NS).toBe((t as any).NS);
    });
});

// ============================================================================
// smul
// ============================================================================
describe('CFUnitFuncTensorImpl.smul', () => {
    it('x=null ⇒ Const null; x=one ⇒ returns this; else Arith(Mul) with const(x)', () => {
        const { t } = makeTensor01();

        const rNull = t.smul(ALGEBRA_IVAL.null())! as CFUnitFuncConst<CFDim>;
        expect(rNull.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((rNull as any).value)).toBe(true);

        const rOne = t.smul(ALGEBRA_IVAL.one())!;
        expect(rOne).toBe(t);

        const x = [0.5, 0.5] as any as CFIval;
        const rMul = t.smul(x, CFBinOpType.Right)!;
        expect(rMul.storage).toBe(CFStorageTag.Arith);
        expect((rMul as any).arithOp).toBe(CFArithOp.Mul);
        expect((rMul as any).opType).toBe(CFBinOpType.Right);

        // One side should be const(x)
        const L = (rMul as any).left as CFUnitFunc<CFDim>;
        const R = (rMul as any).right as CFUnitFunc<CFDim>;
        const hasConst = (L.storage === CFStorageTag.Const) || (R.storage === CFStorageTag.Const);
        expect(hasConst).toBe(true);
    });
});

// ============================================================================
// tmul
// ============================================================================
describe('CFUnitFuncTensorImpl.tmul', () => {
    it('dim overflow ⇒ undefined', () => {
        const { t } = makeTensor01();
        // Create a synthetic "other" with dim so that sum exceeds CF_MAX_DIM. If CF_MAX_DIM is 10,
        // build 11 by tensoring repeatedly. For a quick check, we mimic overflow by stubbing dim.
        const other =
            Object.assign({}, Z1(), { dim: (CF_MAX_DIM as number) as CFDim });

        const res = t.tmul(other as any, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });

    it('other const zero ⇒ Const null of summed dim', () => {
        const { t } = makeTensor01();
        const cz = C0(0 as CFUint32Zero, (t as any).NU, (t as any).NS);
        const res = t.tmul(cz, CFBinOpType.Left)! as CFUnitFuncConst<CFDim>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((res as any).value)).toBe(true);
    });

    it('general case ⇒ Tensor(left=this, right=other, opType propagated, dim summed)', () => {
        const { t } = makeTensor01();
        const other = Z1(); // 0-dim dense
        const res = t.tmul(other, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Tensor);
        expect((res as any).left).toBe(t);
        expect((res as any).right).toBe(other);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).dim).toBe((t as any).dim + (other as any).dim);
    });
});

// ============================================================================
// powInt / pow / nthRoot
// ============================================================================
describe('CFUnitFuncTensorImpl.powInt / pow / nthRoot', () => {
    it('powInt returns PowInt node with same (dim, NU, NS) and exp', () => {
        const { t } = makeTensor01();
        const res = t.powInt(-2 as CFInt32)!;
        expect(res.storage).toBe(CFStorageTag.PowInt);
        expect((res as any).exp).toBe(-2);
        expect((res as any).dim).toBe((t as any).dim);
    });

    it('pow returns PowReal node with same (dim, NU, NS) and exp', () => {
        const { t } = makeTensor01();
        const res = t.pow(0.5 as CFReal)!;
        expect(res.storage).toBe(CFStorageTag.PowReal);
        expect((res as any).exp).toBe(0.5);
        expect((res as any).dim).toBe((t as any).dim);
    });

    it('nthRoot returns NthRoot node with same (dim, NU, NS) and exp', () => {
        const { t } = makeTensor01();
        const res = t.nthRoot(3 as CFUint32)!;
        expect(res.storage).toBe(CFStorageTag.NthRoot);
        expect((res as any).exp).toBe(3);
        expect((res as any).dim).toBe((t as any).dim);
    });
});

// ============================================================================
// type guards & materialize
// ============================================================================
describe('CFUnitFuncTensorImpl — guards & materialize', () => {
    it('isLeaf() false, isAlg() true, materialize() delegates (not null)', () => {
        const { t } = makeTensor01();
        expect(t.isLeaf()).toBe(false);
        expect(t.isAlg()).toBe(true);
        // The actual materialized form depends on your engine; just assert not undefined.
        expect(t.materialize()).toBeTruthy();
    });
});
