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
    CFUint32One,
    CFUint32Two,
    CFUnit,
    CFUnitFunc,
    CFUnitFuncConst,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createConstUnitFunc,
    createZeroDimFunc,
    CFStorageTag
} from "../src";

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncDenseImpl.arithBase
// ─────────────────────────────────────────────────────────────────────────────

import {makeValidCFCompDataset} from "./utils/dataset_gen";

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

// Build reusable sparse operands (dim=1)
const cf = getCompFunc();
const suf  = createBaseUnitFunction(cf, 0 as CFUnit); // dim=1 sparse
const suf2 = createBaseUnitFunction(cf, 1 as CFUnit); // another dim=1 sparse

// Helpers to fetch shared sparse across blocks
function __getSparse() {
    return { cf, suf, suf2 };
}

// ============================================================================
// add
// ============================================================================
describe('CFUnitFuncSparseImpl.add', () => {
    it('domain mismatch ⇒ undefined', () => {
        const { suf } = __getSparse();
        // Mismatch by dim: make a const with dim=2 but same NU/NS
        const c2 = createConstUnitFunc(2 as CFUint32Two, suf.NU, suf.NS, ALGEBRA_IVAL.one());
        const res = (suf as CFUnitFunc<CFUint32One>).add(c2 as any, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });

    it('delegates to const when other is Const (Left-forced)', () => {
        const { suf } = __getSparse();
        const c1 = createConstUnitFunc(1 as CFUint32One, suf.NU, suf.NS, ALGEBRA_IVAL.one());
        // sparse.add(const) → const.add(sparse, Left)
        const res = (suf as CFUnitFunc<CFUint32One>).add(c1, CFBinOpType.Right)!;
        // const.add(1 + sparse) should yield Arith or a short-circuit;
        // Since const one doesn't short-circuit, expect Arith with left=const, right=sparse.
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Add);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).left).toBe(c1);
        expect((res as any).right).toBe(suf);
    });

    it('non-const other ⇒ Arith(Add) with opType propagated', () => {
        const { suf, suf2 } = __getSparse();
        const res = (suf as CFUnitFunc<CFUint32One>).add(suf2, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Add);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(suf);
        expect((res as any).right).toBe(suf2);
    });
});

// ============================================================================
// sub
// ============================================================================
describe('CFUnitFuncSparseImpl.sub', () => {
    it('domain mismatch ⇒ undefined', () => {
        const { suf } = __getSparse();
        const c2 = createConstUnitFunc(2 as CFUint32Two, suf.NU, suf.NS, ALGEBRA_IVAL.one());
        const res = (suf as CFUnitFunc<CFUint32One>).sub(c2 as any, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });

    it('delegates to const with Left/Right flip when other is Const', () => {
        const { suf } = __getSparse();
        const c1 = createConstUnitFunc(1 as CFUint32One, suf.NU, suf.NS, [2, 3] as any);

        // sparse.sub(const, Left) → const.sub(sparse, Right)
        const left = (suf as CFUnitFunc<CFUint32One>).sub(c1, CFBinOpType.Left)!;
        expect(left.storage).toBe(CFStorageTag.Arith);
        expect((left as any).arithOp).toBe(CFArithOp.Sub);
        expect((left as any).opType).toBe(CFBinOpType.Right);
        expect((left as any).left).toBe(c1);
        expect((left as any).right).toBe(suf);

        // sparse.sub(const, Right) → const.sub(sparse, Left)
        const right = (suf as CFUnitFunc<CFUint32One>).sub(c1, CFBinOpType.Right)!;
        expect(right.storage).toBe(CFStorageTag.Arith);
        expect((right as any).arithOp).toBe(CFArithOp.Sub);
        expect((right as any).opType).toBe(CFBinOpType.Left);
        expect((right as any).left).toBe(c1);
        expect((right as any).right).toBe(suf);
    });

    it('non-const other ⇒ Arith(Sub) with opType propagated', () => {
        const { suf, suf2 } = __getSparse();
        const res = (suf as CFUnitFunc<CFUint32One>).sub(suf2, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Sub);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(suf);
        expect((res as any).right).toBe(suf2);
    });
});

// ============================================================================
// neg
// ============================================================================
describe('CFUnitFuncSparseImpl.neg', () => {
    it('delegates via smul([-1,-1]) => new Sparse with elementwise negation', () => {
        const { suf } = __getSparse();
        const res = (suf as any).neg() as CFUnitFunc<CFUint32One>;
        expect(res.storage).toBe(CFStorageTag.Sparse);
        // elementwise check: values[i] = mul([-1,-1], old[i])
        const oldVals = (suf as any).values as CFIval[];
        const newVals = (res as any).values as CFIval[];
        expect(newVals.length).toBe(oldVals.length);
        for (let i = 0; i < newVals.length; i++) {
            const expected = ALGEBRA_IVAL.mul([-1, -1] as any, oldVals[i]!);
            expect(ALGEBRA_IVAL.eq(newVals[i]!, expected)).toBe(true);
        }
        // same bitset/pows references
        expect((res as any).bitset).toBe((suf as any).bitset);
        expect((res as any).pows).toBe((suf as any).pows);
    });
});

// ============================================================================
// mul
// ============================================================================
describe('CFUnitFuncSparseImpl.mul', () => {
    it('domain mismatch ⇒ undefined', () => {
        const { suf } = __getSparse();
        const c2 = createConstUnitFunc(2 as CFUint32Two, suf.NU, suf.NS, ALGEBRA_IVAL.one());
        const res = (suf as CFUnitFunc<CFUint32One>).mul(c2 as any, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });

    it('delegates to const when other is Const (Left-forced)', () => {
        const { suf } = __getSparse();
        const c1 = createConstUnitFunc(1 as CFUint32One, suf.NU, suf.NS, [2, 2] as any);
        const res = (suf as CFUnitFunc<CFUint32One>).mul(c1, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).left).toBe(c1);
        expect((res as any).right).toBe(suf);
    });

    it('non-const other ⇒ Arith(Mul) with opType propagated', () => {
        const { suf, suf2 } = __getSparse();
        const res = (suf as CFUnitFunc<CFUint32One>).mul(suf2, CFBinOpType.Left)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).left).toBe(suf);
        expect((res as any).right).toBe(suf2);
    });
});

// ============================================================================
// div
// ============================================================================
describe('CFUnitFuncSparseImpl.div', () => {
    it('domain mismatch ⇒ undefined', () => {
        const { suf } = __getSparse();
        const c2 = createConstUnitFunc(2 as CFUint32Two, suf.NU, suf.NS, ALGEBRA_IVAL.one());
        const res = (suf as CFUnitFunc<CFUint32One>).div(c2 as any, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });

    it('delegates to const with Left/Right flip when other is Const', () => {
        const { suf } = __getSparse();
        const c1 = createConstUnitFunc(1 as CFUint32One, suf.NU, suf.NS, [2, 3] as any);

        // sparse.div(const, Left) → const.div(sparse, Right)
        const left = (suf as CFUnitFunc<CFUint32One>).div(c1, CFBinOpType.Left)!;
        expect(left.storage).toBe(CFStorageTag.Arith);
        expect((left as any).arithOp).toBe(CFArithOp.Div);
        expect((left as any).opType).toBe(CFBinOpType.Right);
        expect((left as any).left).toBe(c1);
        expect((left as any).right).toBe(suf);

        // sparse.div(const, Right) → const.div(sparse, Left)
        const right = (suf as CFUnitFunc<CFUint32One>).div(c1, CFBinOpType.Right)!;
        expect(right.storage).toBe(CFStorageTag.Arith);
        expect((right as any).arithOp).toBe(CFArithOp.Div);
        expect((right as any).opType).toBe(CFBinOpType.Left);
        expect((right as any).left).toBe(c1);
        expect((right as any).right).toBe(suf);
    });

    it('non-const other ⇒ Arith(Div) with opType propagated', () => {
        const { suf, suf2 } = __getSparse();
        const res = (suf as CFUnitFunc<CFUint32One>).div(suf2, CFBinOpType.Right)!;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Div);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(suf);
        expect((res as any).right).toBe(suf2);
    });
});

// ============================================================================
// inv
// ============================================================================
describe('CFUnitFuncSparseImpl.inv', () => {
    it('returns new Sparse with elementwise inverse; preserves bitset/pows', () => {
        const { suf } = __getSparse();
        const res = (suf as any).inv() as CFUnitFunc<CFUint32One>;
        expect(res.storage).toBe(CFStorageTag.Sparse);

        const oldVals = (suf as any).values as CFIval[];
        const newVals = (res as any).values as CFIval[];
        expect(newVals.length).toBe(oldVals.length);
        for (let i = 0; i < newVals.length; i++) {
            const expected = ALGEBRA_IVAL.inv(oldVals[i]!);
            expect(ALGEBRA_IVAL.eq(newVals[i]!, expected)).toBe(true);
        }
        expect((res as any).bitset).toBe((suf as any).bitset);
        expect((res as any).pows).toBe((suf as any).pows);
    });
});

// ============================================================================
// smul
// ============================================================================
describe('CFUnitFuncSparseImpl.smul', () => {
    it('x = null ⇒ Const null; x = one ⇒ returns this; otherwise elementwise mul', () => {
        const { suf } = __getSparse();

        const rNull = (suf as any).smul(ALGEBRA_IVAL.null()) as CFUnitFuncConst<CFDim>;
        expect(rNull.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((rNull as any).value)).toBe(true);

        const rOne = (suf as any).smul(ALGEBRA_IVAL.one());
        expect(rOne).toBe(suf);

        const x = [0.5, 0.5] as any as CFIval;
        const rMul = (suf as any).smul(x) as CFUnitFunc<CFUint32One>;
        expect(rMul.storage).toBe(CFStorageTag.Sparse);

        const oldVals = (suf as any).values as CFIval[];
        const newVals = (rMul as any).values as CFIval[];
        for (let i = 0; i < newVals.length; i++) {
            const expected = ALGEBRA_IVAL.mul(x, oldVals[i]!);
            expect(ALGEBRA_IVAL.eq(newVals[i]!, expected)).toBe(true);
        }
        expect((rMul as any).bitset).toBe((suf as any).bitset);
        expect((rMul as any).pows).toBe((suf as any).pows);
    });
});

// ============================================================================
// tmul
// ============================================================================
describe('CFUnitFuncSparseImpl.tmul', () => {
    it('other is Const zero ⇒ returns Const null', () => {
        const { suf } = __getSparse();
        const cz = createConstUnitFunc(1 as CFUint32One, suf.NU, suf.NS, ALGEBRA_IVAL.null());
        const res = (suf as any).tmul(cz, CFBinOpType.Right) as CFUnitFuncConst<CFDim>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((res as any).value)).toBe(true);
    });

    it('general case ⇒ Tensor node with left=this, right=other, opType propagated', () => {
        const { suf } = __getSparse();
        const d0 = createZeroDimFunc(suf.NU, suf.NS, [ALGEBRA_IVAL.one()]); // Dense(0-dim)
        const res = (suf as any).tmul(d0, CFBinOpType.Left);
        expect(res.storage).toBe(CFStorageTag.Tensor);
        expect((res as any).left).toBe(suf);
        expect((res as any).right).toBe(d0);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).dim).toBe((suf as any).dim + (d0 as any).dim);
    });
});

// ============================================================================
// powInt (materialized elementwise for Sparse)
// ============================================================================
describe('CFUnitFuncSparseImpl.powInt', () => {
    it('returns new Sparse with elementwise powInt; preserves bitset/pows', () => {
        const { suf } = __getSparse();
        const res = (suf as any).powInt(3) as CFUnitFunc<CFUint32One>;
        expect(res.storage).toBe(CFStorageTag.Sparse);
        const oldVals = (suf as any).values as CFIval[];
        const newVals = (res as any).values as CFIval[];
        for (let i = 0; i < newVals.length; i++) {
            const expected = ALGEBRA_IVAL.powInt(oldVals[i]!, 3 as CFInt32);
            expect(ALGEBRA_IVAL.eq(newVals[i]!, expected)).toBe(true);
        }
        expect((res as any).bitset).toBe((suf as any).bitset);
        expect((res as any).pows).toBe((suf as any).pows);
    });
});

// ============================================================================
// pow (materialized elementwise for Sparse)
// ============================================================================
describe('CFUnitFuncSparseImpl.pow', () => {
    it('returns new Sparse with elementwise pow; preserves bitset/pows', () => {
        const { suf } = __getSparse();
        const res = (suf as any).pow(0.5) as CFUnitFunc<CFUint32One>;
        expect(res.storage).toBe(CFStorageTag.Sparse);
        const oldVals = (suf as any).values as CFIval[];
        const newVals = (res as any).values as CFIval[];
        for (let i = 0; i < newVals.length; i++) {
            const expected = ALGEBRA_IVAL.pow(oldVals[i]!, 0.5 as CFReal);
            expect(ALGEBRA_IVAL.eq(newVals[i]!, expected)).toBe(true);
        }
        expect((res as any).bitset).toBe((suf as any).bitset);
        expect((res as any).pows).toBe((suf as any).pows);
    });
});

// ============================================================================
// nthRoot (materialized elementwise for Sparse)
// ============================================================================
describe('CFUnitFuncSparseImpl.nthRoot', () => {
    it('returns new Sparse with elementwise nthRoot; preserves bitset/pows', () => {
        const { suf } = __getSparse();
        const res = (suf as any).nthRoot(3 as CFUint32) as CFUnitFunc<CFUint32One>;
        expect(res.storage).toBe(CFStorageTag.Sparse);
        const oldVals = (suf as any).values as CFIval[];
        const newVals = (res as any).values as CFIval[];
        for (let i = 0; i < newVals.length; i++) {
            const expected = ALGEBRA_IVAL.nthRoot(oldVals[i]!, 3 as CFUint32);
            expect(ALGEBRA_IVAL.eq(newVals[i]!, expected)).toBe(true);
        }
        expect((res as any).bitset).toBe((suf as any).bitset);
        expect((res as any).pows).toBe((suf as any).pows);
    });
});

// ============================================================================
// Guards & materialize
// ============================================================================
describe('CFUnitFuncSparseImpl — type guards & materialize', () => {
    it('isLeaf() true, isAlg() false, materialize() returns this', () => {
        const { suf } = __getSparse();
        expect((suf as any).isLeaf()).toBe(true);
        expect((suf as any).isAlg()).toBe(false);
        expect((suf as any).materialize()).toBe(suf);
    });
});
