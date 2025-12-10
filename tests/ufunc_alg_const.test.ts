import {describe, expect, it, beforeAll} from "vitest";

import {
    ALGEBRA_IVAL,
    CFArithOp,
    CFBinOpType,
    CFCompFuncBinary, CFInt32,
    CFIval,
    CFReal,
    CFUint32,
    CFUint32One,
    CFUint32Two,
    CFUint32Zero,
    CFUnit, CFUnitFunc,
    CFUnitFuncArith,
    CFUnitFuncArithImpl,
    CFUnitFuncConst,
    CFUnitFuncSparse,
    CFUnitFuncZeroDim,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createConstUnitFunc,
    createZeroDimFunc,
    CFStorageTag,
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

describe("CFConstUnitFunc dimension mismatch", () => {


    it("fails for dimension mismatch", () => {

        const cf = getCompFunc();
        const cVal = [3 as CFReal, 3 as CFReal] as CFIval;

        const f = createConstUnitFunc(1 as CFUint32One, cf.NU, cf.NS, cVal);
        const g = createConstUnitFunc(2 as CFUint32Two, cf.NU, cf.NS, cVal);

        expect(f.add(g as unknown as CFUnitFuncConst<CFUint32One>)).to.be.undefined;
        expect(f.sub(g as unknown as CFUnitFuncConst<CFUint32One>)).to.be.undefined;
        expect(f.mul(g as unknown as CFUnitFuncConst<CFUint32One>)).to.be.undefined;
        expect(f.div(g as unknown as CFUnitFuncConst<CFUint32One>)).to.be.undefined;
    });

});

// --- shared fixtures ---
let cf: CFCompFuncBinary;

// convenient test values
const tVal = [2.0, 3.2] as unknown as CFIval;
const tValMassive = [Number.MAX_VALUE, Number.MAX_VALUE] as unknown as CFIval;

// consts (dim=2)
const cufNull = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.null());
const cufOne = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.one());
const cufTVal = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, tVal);
const cufMassive = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, tValMassive);

// zero-dim consts
const cufNullZD = createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.null());
const cufOneZD = createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.one());

// 1D const null (for const–sparse scenarios)
const cufNull1D = createConstUnitFunc(1 as CFUint32One, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.null());

// zero-dim dense with non-null data (aligns with updated makeZeroDim behavior)
const zduf = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [ALGEBRA_IVAL.one()]);

// sparse (dim=1) built from a comp func (dim=2)
let suf: CFUnitFuncSparse<CFUint32One>;

beforeAll(() => {
    cf = getCompFunc() as unknown as CFCompFuncBinary;
    suf = createBaseUnitFunction(cf, 0 as CFUnit);
});

// ---------------------
// add
// ---------------------
describe('CFConstUnitFunc.add', () => {
    it('0 + 0 = 0 (Left & Right)', () => {
        const left = cufNull.add(cufNull, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(left.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(left.value)).toBe(true);

        const right = cufNull.add(cufNull, CFBinOpType.Right) as CFUnitFuncConst<CFUint32Two>;
        expect(right.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(right.value)).toBe(true);
    });

    it('0 + f = f + 0 = f (const)', () => {
        const left = cufNull.add(cufOne, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(left.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isOne(left.value)).toBe(true);

        const right = cufNull.add(cufOne, CFBinOpType.Right) as CFUnitFuncConst<CFUint32Two>;
        expect(right.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isOne(right.value)).toBe(true);
    });

    it('0 + f = f + 0 where f is zero-dim dense', () => {
        const left = cufNullZD.add(zduf, CFBinOpType.Left) as CFUnitFuncZeroDim;
        expect(left.storage).toBe(CFStorageTag.Dense);
        expect(ALGEBRA_IVAL.isOne(left.values[0])).toBe(true);

        const right = cufNullZD.add(zduf, CFBinOpType.Right) as CFUnitFuncZeroDim;
        expect(right.storage).toBe(CFStorageTag.Dense);
        expect(ALGEBRA_IVAL.isOne(right.values[0])).toBe(true);
    });

    it('0 + f = f + 0 where f is sparse (dim=1)', () => {
        const left = cufNull1D.add(suf, CFBinOpType.Left) as CFUnitFuncSparse<CFUint32One>;
        expect(left.storage).toBe(CFStorageTag.Sparse);

        const right = cufNull1D.add(suf, CFBinOpType.Right) as CFUnitFuncSparse<CFUint32One>;
        expect(right.storage).toBe(CFStorageTag.Sparse);
    });

    it('const overflow collapses to null', () => {
        const left = cufMassive.add(cufMassive, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(left.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(left.value)).toBe(true);

        const right = cufMassive.add(cufMassive, CFBinOpType.Right) as CFUnitFuncConst<CFUint32Two>;
        expect(right.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(right.value)).toBe(true);
    });

    it('const + zero-dim dense produces Arith node (dims aligned)', () => {
        const left = cufOneZD.add(zduf, CFBinOpType.Left) as CFUnitFuncArith<CFUint32Zero>;
        expect(left.storage).toBe(CFStorageTag.Arith);
        expect(left instanceof CFUnitFuncArithImpl).toBe(true);
        expect(left.left.storage).toBe(CFStorageTag.Const);
        expect(left.right.storage).toBe(CFStorageTag.Dense);
        expect(left.arithOp).toBe(CFArithOp.Add);
        expect(left.opType).toBe(CFBinOpType.Left);

        const right = cufOneZD.add(zduf, CFBinOpType.Right) as CFUnitFuncArith<CFUint32Zero>;
        expect(right.storage).toBe(CFStorageTag.Arith);
        expect(right instanceof CFUnitFuncArithImpl).toBe(true);
        expect(right.left.storage).toBe(CFStorageTag.Const);
        expect(right.right.storage).toBe(CFStorageTag.Dense);
        expect(right.arithOp).toBe(CFArithOp.Add);
        expect(right.opType).toBe(CFBinOpType.Right);
    });

    it('domain mismatch returns undefined', () => {
        // dim=2 vs dim=1
        const res = cufNull.add(cufNull1D as unknown as CFUnitFunc<CFUint32Two>, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });
});

// ---------------------
// sub
// ---------------------
describe('CFConstUnitFunc.sub', () => {
    it('g - 0 = g when type === Right and this.isZero (returns the other operand)', () => {
        const res = cufNullZD.sub(zduf, CFBinOpType.Right) as CFUnitFuncZeroDim;
        // Impl returns `other` directly; check identity & storage
        expect(res).toBe(zduf);
        expect(res.storage).toBe(CFStorageTag.Dense);
    });

    it('f - 0 = f (const)', () => {
        const res = cufOne.sub(cufNull, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isOne(res.value)).toBe(true);
    });

    it('const folding: f - 1 and (Right) 1 - f', () => {
        const tValSubOne = ALGEBRA_IVAL.sub(tVal, ALGEBRA_IVAL.one());
        const oneSubTVal = ALGEBRA_IVAL.sub(ALGEBRA_IVAL.one(), tVal);

        const left = cufTVal.sub(cufOne, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(left.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq(left.value, tValSubOne)).toBe(true);

        const right = cufTVal.sub(cufOne, CFBinOpType.Right) as CFUnitFuncConst<CFUint32Two>;
        expect(right.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq(right.value, oneSubTVal)).toBe(true);
    });

    it('c - f (zero-dim const - zero-dim dense) produces Arith node', () => {
        const res = cufNullZD.sub(zduf, CFBinOpType.Left) as CFUnitFuncArith<CFUint32Zero>;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect(res instanceof CFUnitFuncArithImpl).toBe(true);
        expect(res.left.storage).toBe(CFStorageTag.Const);
        expect(res.right.storage).toBe(CFStorageTag.Dense);
        expect(res.arithOp).toBe(CFArithOp.Sub);
        expect(res.opType).toBe(CFBinOpType.Left);
    });

    it('0 - f when type === Right & other is zero returns neg(this) as const (regression check)', () => {
        // this = tVal, other = 0, Right means `other - this` = 0 - tVal = -tVal
        const res = cufTVal.sub(cufNull, CFBinOpType.Right) as CFUnitFuncConst<CFUint32Two>;
        expect(res.storage).toBe(CFStorageTag.Const);
        const negTVal = ALGEBRA_IVAL.neg(tVal)!;
        expect(ALGEBRA_IVAL.eq(res.value, negTVal)).toBe(true);
    });

    it('const overflow collapses to null', () => {
        const left = cufMassive.sub(cufMassive, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        // MAX - MAX may be well-defined (= 0), but if your total arithmetic collapses large-ulp issues to null,
        // keep this as-is. If not, swap to an overflow-prone pair as needed.
        expect(left.storage).toBe(CFStorageTag.Const);
        // If your sub(MAX, MAX) is [0,0] mathematically, that *is* null by your model; this assertion still holds.
        expect(ALGEBRA_IVAL.isNull(left.value)).toBe(true);

        const right = cufMassive.sub(cufMassive, CFBinOpType.Right) as CFUnitFuncConst<CFUint32Two>;
        expect(right.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(right.value)).toBe(true);
    });

    it('domain mismatch returns undefined', () => {
        const res = cufNull.sub(cufNull1D as unknown as CFUnitFunc<CFUint32Two>, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });
});

describe('CFUnitFuncConstImpl.neg', () => {
    // shared fixtures (module-scope)
    const tVal = [2.0, 3.2] as unknown as CFIval;

    const cufNull = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.null());
    const cufOne  = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.one());
    const cufTVal = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, tVal);

    const cufNullZD = createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.null());

    it('-0 = 0 (returns same instance)', () => {
        const res = cufNull.neg();
        expect(res).toBe(cufNull);                // identity by reference
        // and value is still null
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((res as any).value)).toBe(true);
    });

    it('neg of one is [-1, -1]', () => {
        const res = cufOne.neg();
        expect(res).not.toBe(cufOne);
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq((res as any).value, ALGEBRA_IVAL.neg(ALGEBRA_IVAL.one())!)).toBe(true);
    });

    it('neg of non-zero const folds to const', () => {
        const res = cufTVal.neg();
        expect(res.storage).toBe(CFStorageTag.Const);
        const expected = ALGEBRA_IVAL.neg(tVal)!;
        expect(ALGEBRA_IVAL.eq((res as any).value, expected)).toBe(true);
    });

    it('zero-dim: -0 = 0 (same instance), still const', () => {
        const res = cufNullZD.neg();
        expect(res).toBe(cufNullZD);
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull((res as any).value)).toBe(true);
    });
});

describe('CFUnitFuncConstImpl.mul', () => {
    // shared fixtures (module-scope)
    const tVal = [2.0, 3.2] as unknown as CFIval;
    const tValMassive = [Number.MAX_VALUE, Number.MAX_VALUE] as unknown as CFIval;

    // dim=2 consts
    const cufNull = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.null());
    const cufOne  = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.one());
    const cufTVal = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, tVal);
    const cufMassive = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, tValMassive);

    // zero-dim consts
    const cufNullZD = createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.null());
    const cufOneZD  = createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.one());
    const cufTValZD = createConstUnitFunc(0 as CFUint32Zero, 1 as CFUint32, 1 as CFUint32, tVal);

    // 1D const (null)
    const cufNull1D = createConstUnitFunc(1 as CFUint32One, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.null());

    // zero-dim dense with non-null data (per your updated makeZeroDim behavior)
    const zduf = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [ALGEBRA_IVAL.one()]);

    // sparse (dim=1) from a comp func (dim=2)
    let cf: CFCompFuncBinary;
    let suf: CFUnitFuncSparse<CFUint32One>;

    beforeAll(() => {
        cf = getCompFunc(); // replace with your real factory if needed
        suf = createBaseUnitFunction(cf, 0 as CFUnit);
    });

    it('domain mismatch returns undefined (dim 2 vs dim 1)', () => {
        const res = cufNull.mul(cufNull1D as unknown as CFUnitFuncConst<CFUint32Two>, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });

    it('0 * g = 0 (returns this instance)', () => {
        const res = cufNull.mul(cufOne, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res).toBe(cufNull); // identity by reference
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('1 * g = g (returns other instance) for const other', () => {
        const res = cufOne.mul(cufTVal, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res).toBe(cufTVal);
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq(res.value, tVal)).toBe(true);
    });

    it('f * 0 = 0 for const other (returns other)', () => {
        const res = cufTVal.mul(cufNull, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res).toBe(cufNull);
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('f * 1 = f for const other (returns this)', () => {
        const res = cufTVal.mul(cufOne, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res).toBe(cufTVal);
        expect(ALGEBRA_IVAL.eq(res.value, tVal)).toBe(true);
    });

    it('const folding: const * const → const', () => {
        const expected = ALGEBRA_IVAL.mul(tVal, ALGEBRA_IVAL.one());
        const res = cufTVal.mul(cufOne, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq(res.value, expected)).toBe(true);
    });

    it('overflow collapses to null (MAX * MAX)', () => {
        const res = cufMassive.mul(cufMassive, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('zero-dim: 0 * dense(0-dim) = 0 (returns this const)', () => {
        const res = cufNullZD.mul(zduf, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Zero>;
        expect(res).toBe(cufNullZD);
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('zero-dim: 1 * dense(0-dim) = dense(0-dim) (returns other)', () => {
        const res = cufOneZD.mul(zduf, CFBinOpType.Left) as CFUnitFuncZeroDim;
        expect(res).toBe(zduf);
        expect(res.storage).toBe(CFStorageTag.Dense);
        expect(ALGEBRA_IVAL.isOne(res.values[0])).toBe(true);
    });

    it('zero-dim: non-trivial const * dense(0-dim) → Arith node', () => {
        const res = cufTValZD.mul(zduf, CFBinOpType.Left) as CFUnitFuncArith<CFUint32Zero>;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect(res instanceof CFUnitFuncArithImpl).toBe(true);
        expect(res.left.storage).toBe(CFStorageTag.Const);
        expect(res.right.storage).toBe(CFStorageTag.Dense);
        expect(res.arithOp).toBe(CFArithOp.Mul);
        expect(res.opType).toBe(CFBinOpType.Left);
    });

    it('const(1D null) * sparse(1D) with Left zero → returns this const zero', () => {
        const res = cufNull1D.mul(suf, CFBinOpType.Left) as CFUnitFuncConst<CFUint32One>;
        expect(res).toBe(cufNull1D);
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('mixed non-const & const (sparse * nontrivial const) → Arith node', () => {
        const cufTVal1D = createConstUnitFunc(1 as CFUint32One, 1 as CFUint32, 1 as CFUint32, tVal);
        const res = cufTVal1D.mul(suf, CFBinOpType.Left) as CFUnitFuncArith<CFUint32One>;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect(res instanceof CFUnitFuncArithImpl).toBe(true);
        expect(res.left.storage).toBe(CFStorageTag.Const);
        expect(res.right.storage).toBe(CFStorageTag.Sparse);
        expect(res.arithOp).toBe(CFArithOp.Mul);
        expect(res.opType).toBe(CFBinOpType.Left);
    });

    it('Right variant sanity: 1 (const) × sparse (Right) still returns sparse', () => {
        const one1D = createConstUnitFunc(1 as CFUint32One, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.one());
        const res = one1D.mul(suf, CFBinOpType.Right) as CFUnitFuncSparse<CFUint32One>;
        expect(res).toBe(suf);
        expect(res.storage).toBe(CFStorageTag.Sparse);
    });
});

describe('CFUnitFuncConstImpl.div', () => {
    it('domain mismatch returns undefined (dim 2 vs dim 1)', () => {
        const res = cufNull.div(cufNull1D as unknown as CFUnitFuncConst<CFUint32Two>, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });

    it('0 / g = 0 (total division)', () => {
        const res = cufNull.div(cufOne, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('f / 0 = 0 (total division)', () => {
        const res = cufTVal.div(cufNull, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('f / 1 = f (Left) returns the same instance for const other', () => {
        const res = cufTVal.div(cufOne, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res).toBe(cufTVal);
        expect(ALGEBRA_IVAL.eq(res.value, (cufTVal as any).value)).toBe(true);
    });

    it('1 / f (Right with const other=1) inverts THIS (regression for the bug)', () => {
        const res = cufTVal.div(cufOne, CFBinOpType.Right) as CFUnitFuncConst<CFUint32Two>;
        expect(res.storage).toBe(CFStorageTag.Const);
        const expected = ALGEBRA_IVAL.inv((cufTVal as any).value);
        expect(ALGEBRA_IVAL.eq(res.value, expected)).toBe(true);
    });

    it('const folding: const / const → const', () => {
        const cufTwo = createConstUnitFunc(2 as CFUint32Two, 1 as CFUint32, 1 as CFUint32, [2, 2] as unknown as CFIval);
        const res = cufTVal.div(cufTwo, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        const expected = ALGEBRA_IVAL.div((cufTVal as any).value, (cufTwo as any).value);
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq(res.value, expected)).toBe(true);
    });

    it('[MAX,MAX]/[MAX,MAX] = [1, 1]', () => {
        // Using MAX / MAX still well-defined (= [1,1]) in exact math.
        const res = cufMassive.div(cufMassive, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Two>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isOne(res.value)).toBe(true);
    });

    it('zero-dim: 0 / dense(0-dim) = 0 (total division, returns a const null)', () => {
        const res = cufNullZD.div(zduf, CFBinOpType.Left) as CFUnitFuncConst<CFUint32Zero>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('Right variant sanity with non-const other: g / 1 = g (returns other)', () => {
        const one1D = createConstUnitFunc(1 as CFUint32One, 1 as CFUint32, 1 as CFUint32, ALGEBRA_IVAL.one());
        const res = one1D.div(suf, CFBinOpType.Right) as CFUnitFuncSparse<CFUint32One>;
        expect(res).toBe(suf);
        expect(res.storage).toBe(CFStorageTag.Sparse);
    });

    it('mixed const/non-const that is not handled by short-circuits → Arith node (Div)', () => {
        const cufTVal1D = createConstUnitFunc(1 as CFUint32One, 1 as CFUint32, 1 as CFUint32, [2.0, 3.2] as unknown as CFIval);
        const res = cufTVal1D.div(suf, CFBinOpType.Left) as CFUnitFuncArith<CFUint32One>;
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect(res instanceof CFUnitFuncArithImpl).toBe(true);
        expect(res.left.storage).toBe(CFStorageTag.Const);
        expect(res.right.storage).toBe(CFStorageTag.Sparse);
        expect(res.arithOp).toBe(CFArithOp.Div);
        expect(res.opType).toBe(CFBinOpType.Left);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncConstImpl.inv
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncConstImpl.inv', () => {
    it('inv(0) = 0 (total arithmetic)', () => {
        const res = cufNull.inv() as CFUnitFuncConst<typeof cufNull.dim>;
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('inv(1) = 1 (returns new const, not same instance)', () => {
        const res = cufOne.inv() as CFUnitFuncConst<typeof cufOne.dim>;
        expect(res).not.toBe(cufOne);
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isOne(res.value)).toBe(true);
    });

    it('inv([2,3.2]) produces elementwise interval inverse', () => {
        const res = cufTVal.inv() as CFUnitFuncConst<typeof cufTVal.dim>;
        const expected = ALGEBRA_IVAL.inv((cufTVal as any).value);
        expect(res.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq(res.value, expected)).toBe(true);
    });

    it('inv of negative interval works (and flips order)', () => {
        const negVal = [-5, -2] as unknown as CFIval;
        const cufNeg = createConstUnitFunc(cufTVal.dim, cufTVal.NU, cufTVal.NS, negVal);
        const res = cufNeg.inv() as CFUnitFuncConst<typeof cufNeg.dim>;
        const expected = ALGEBRA_IVAL.inv(negVal);
        expect(ALGEBRA_IVAL.eq(res.value, expected)).toBe(true);
    });

    it('inv of interval crossing zero collapses to null', () => {
        const crossZero = [-1, 2] as unknown as CFIval;
        const cufCross = createConstUnitFunc(cufTVal.dim, cufTVal.NU, cufTVal.NS, crossZero);
        const res = cufCross.inv() as CFUnitFuncConst<typeof cufCross.dim>;
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('zero-dim const: inv(0) = 0 (total), inv(1) = 1', () => {
        const oneZD = createConstUnitFunc(0 as CFUint32Zero, cufOne.NU, cufOne.NS, ALGEBRA_IVAL.one());
        const invNull = cufNullZD.inv() as CFUnitFuncConst<CFUint32Zero>;
        const invOne  = oneZD.inv() as CFUnitFuncConst<CFUint32Zero>;
        expect(ALGEBRA_IVAL.isNull(invNull.value)).toBe(true);
        expect(ALGEBRA_IVAL.isOne(invOne.value)).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncConstImpl.smul
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncConstImpl.smul', () => {
    it('x * 0 = 0 and 0 * f = 0 → returns the zero const where applicable', () => {
        // this.isZero → returns this
        const r1 = cufNull.smul(ALGEBRA_IVAL.one()) as CFUnitFuncConst<typeof cufNull.dim>;
        expect(r1).toBe(cufNull);
        expect(ALGEBRA_IVAL.isNull(r1.value)).toBe(true);

        // x is null → makeNullUnitFunc(...)
        const r2 = cufOne.smul(ALGEBRA_IVAL.null()) as CFUnitFuncConst<typeof cufOne.dim>;
        expect(r2.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(r2.value)).toBe(true);
    });

    it('x * 1 = 1 * x = x when this.isOne (returns new const with x)', () => {
        const x = [2, 3.2] as unknown as CFIval;
        const r = cufOne.smul(x) as CFUnitFuncConst<typeof cufOne.dim>;
        expect(r.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq(r.value, x)).toBe(true);
    });

    it('1 * f = f (x is one) returns this', () => {
        const r = cufTVal.smul(ALGEBRA_IVAL.one()) as CFUnitFuncConst<typeof cufTVal.dim>;
        expect(r).toBe(cufTVal);
        expect(ALGEBRA_IVAL.eq(r.value, (cufTVal as any).value)).toBe(true);
    });

    it('general case folds to const via ALGEBRA_IVAL.mul', () => {
        const x = [0.5, 0.5] as unknown as CFIval; // scalar interval
        const r = cufTVal.smul(x) as CFUnitFuncConst<typeof cufTVal.dim>;
        const expected = ALGEBRA_IVAL.mul((cufTVal as any).value, x);
        expect(r.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.eq(r.value, expected)).toBe(true);
    });

    it('overflow in scalar multiply collapses to null', () => {
        const huge = [Number.MAX_VALUE, Number.MAX_VALUE] as unknown as CFIval;
        const r = cufMassive.smul(huge) as CFUnitFuncConst<typeof cufMassive.dim>;
        expect(r.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isNull(r.value)).toBe(true);
    });

    it('zero-dim: respects the same identity/total rules', () => {
        const x = [2, 2] as unknown as CFIval;
        const r1 = cufNullZD.smul(x) as CFUnitFuncConst<CFUint32Zero>;
        expect(ALGEBRA_IVAL.isNull(r1.value)).toBe(true); // 0 * x = 0

        const oneZD = createConstUnitFunc(0 as CFUint32Zero, cufOne.NU, cufOne.NS, ALGEBRA_IVAL.one());
        const r2 = oneZD.smul(x) as CFUnitFuncConst<CFUint32Zero>;
        expect(ALGEBRA_IVAL.eq(r2.value, x)).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncConstImpl.powInt
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncConstImpl.powInt', () => {
    it('e = 0: 0^0 = 0, f^0 = 1 for non-zero f', () => {
        const zPow0 = cufNull.powInt(0 as CFInt32);
        expect(zPow0).toBe(cufNull); // returns this, per impl
        expect(ALGEBRA_IVAL.isNull((zPow0 as any).value)).toBe(true);

        const fPow0 = cufTVal.powInt(0 as CFInt32);
        expect(fPow0.storage).toBe(CFStorageTag.Const);
        expect(ALGEBRA_IVAL.isOne((fPow0 as any).value)).toBe(true);
    });

    it('e = 1: f^1 = f (returns same instance)', () => {
        const res = cufTVal.powInt(1 as CFInt32);
        expect(res).toBe(cufTVal);
    });

    it('e = -1: f^-1 = inv(f)', () => {
        const res = cufTVal.powInt(-1 as CFInt32) as CFUnitFuncConst<typeof cufTVal.dim>;
        const expected = ALGEBRA_IVAL.inv((cufTVal as any).value);
        expect(ALGEBRA_IVAL.eq(res.value, expected)).toBe(true);
    });

    it('0^e = 0 (e > 0) and 1^e = 1', () => {
        const zPow2 = cufNull.powInt(2 as CFInt32) as CFUnitFuncConst<typeof cufNull.dim>;
        expect(ALGEBRA_IVAL.isNull(zPow2.value)).toBe(true);

        const onePowMinus3 = cufOne.powInt(-3 as CFInt32) as CFUnitFuncConst<typeof cufOne.dim>;
        expect(ALGEBRA_IVAL.isOne(onePowMinus3.value)).toBe(true);
    });

    it('general integer exponent folds via ALGEBRA_IVAL.powInt', () => {
        const res = cufTVal.powInt(3 as CFInt32) as CFUnitFuncConst<typeof cufTVal.dim>;
        const expected = ALGEBRA_IVAL.powInt((cufTVal as any).value, 3 as CFInt32);
        expect(ALGEBRA_IVAL.eq(res.value, expected)).toBe(true);
    });

    it('negative exponent on intervals touching zero collapses to null (total arithmetic)', () => {
        const crossZero = createConstUnitFunc(cufTVal.dim, cufTVal.NU, cufTVal.NS,
            [-1, 2] as any);
        const res = crossZero.powInt(-1 as CFInt32) as CFUnitFuncConst<typeof cufTVal.dim>;
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);
    });

    it('zero-dim: same rules apply (0^0 = 0, f^0 = 1)', () => {
        const z0 = cufNullZD.powInt(0 as CFInt32) as CFUnitFuncConst<CFUint32Zero>;
        expect(ALGEBRA_IVAL.isNull(z0.value)).toBe(true);

        const f0 = createConstUnitFunc(0 as CFUint32Zero, cufOne.NU, cufOne.NS, [2, 3] as any)
            .powInt(0 as CFInt32) as CFUnitFuncConst<CFUint32Zero>;
        expect(ALGEBRA_IVAL.isOne(f0.value)).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncConstImpl.pow
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncConstImpl.pow', () => {
    it('e = 0: 0^0 = 0, f^0 = 1 for non-zero f', () => {
        const zPow0 = cufNull.pow(0 as CFReal) as CFUnitFuncConst<typeof cufNull.dim>;
        expect(ALGEBRA_IVAL.isNull(zPow0.value)).toBe(true);

        const fPow0 = cufTVal.pow(0 as CFReal) as CFUnitFuncConst<typeof cufTVal.dim>;
        expect(ALGEBRA_IVAL.isOne(fPow0.value)).toBe(true);
    });

    it('e = 1: f^1 = f (returns same instance)', () => {
        const res = cufTVal.pow(1 as CFReal);
        expect(res).toBe(cufTVal);
    });

    it('e = -1: f^-1 = inv(f)', () => {
        const res = cufTVal.pow(-1 as CFReal) as CFUnitFuncConst<typeof cufTVal.dim>;
        const expected = ALGEBRA_IVAL.inv((cufTVal as any).value);
        expect(ALGEBRA_IVAL.eq(res.value, expected)).toBe(true);
    });

    it('0^e = 0 and 1^e = 1 for any real e (outside e=0 special case handled above)', () => {
        const zPow2 = cufNull.pow(2.5 as CFReal) as CFUnitFuncConst<typeof cufNull.dim>;
        expect(ALGEBRA_IVAL.isNull(zPow2.value)).toBe(true);

        const onePow = cufOne.pow(2.5 as CFReal) as CFUnitFuncConst<typeof cufOne.dim>;
        expect(ALGEBRA_IVAL.isOne(onePow.value)).toBe(true);
    });

    it('non-integer exponent on non-positive base collapses to null (total arithmetic)', () => {
        const neg = createConstUnitFunc(cufTVal.dim, cufTVal.NU, cufTVal.NS,
            [-5, -2] as any);
        const res = neg.pow(0.5 as CFReal) as CFUnitFuncConst<typeof neg.dim>; // sqrt of negative → null
        expect(ALGEBRA_IVAL.isNull(res.value)).toBe(true);

        const crossZero = createConstUnitFunc(cufTVal.dim, cufTVal.NU, cufTVal.NS,
            [-1, 3] as any);
        const res2 = crossZero.pow(0.5 as CFReal) as CFUnitFuncConst<typeof crossZero.dim>;
        expect(ALGEBRA_IVAL.isNull(res2.value)).toBe(true);
    });

    it('general real exponent folds via ALGEBRA_IVAL.pow for positive intervals', () => {
        const pos = createConstUnitFunc(cufTVal.dim, cufTVal.NU, cufTVal.NS,
            [2, 3] as any);
        const res = pos.pow(0.5 as CFReal) as CFUnitFuncConst<typeof pos.dim>;
        const expected = ALGEBRA_IVAL.pow((pos as any).value, 0.5  as CFReal);
        expect(ALGEBRA_IVAL.eq(res.value, expected)).toBe(true);
    });

    it('zero-dim: same rules (e.g., sqrt of positive → defined, sqrt of negative → null)', () => {
        const posZD = createConstUnitFunc(0 as CFUint32Zero, cufOne.NU, cufOne.NS,
            [4, 9] as any);
        const negZD = createConstUnitFunc(0 as CFUint32Zero, cufOne.NU, cufOne.NS,
            [-9, -4] as any);

        const r1 = posZD.pow(0.5 as CFReal) as CFUnitFuncConst<CFUint32Zero>;
        expect(ALGEBRA_IVAL.isNull(r1.value)).toBe(false); // defined

        const r2 = negZD.pow(0.5 as CFReal) as CFUnitFuncConst<CFUint32Zero>;
        expect(ALGEBRA_IVAL.isNull(r2.value)).toBe(true);  // null per total arithmetic
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CFUnitFuncConstImpl.nthRoot
// ─────────────────────────────────────────────────────────────────────────────
describe('CFUnitFuncConstImpl.nthRoot', () => {
    it('n = 0 → null (total arithmetic definition)', () => {
        const r = cufTVal.nthRoot(0 as CFUint32) as CFUnitFuncConst<typeof cufTVal.dim>;
        expect(ALGEBRA_IVAL.isNull(r.value)).toBe(true);
    });

    it('n = 1 → identity (returns same instance for const)', () => {
        const r = cufTVal.nthRoot(1 as CFUint32);
        expect(r.equals(cufTVal)).toBe(true);
    });

    it('n-th root of 0 is 0; n-th root of 1 is 1', () => {
        const r0 = cufNull.nthRoot(5 as CFUint32) as CFUnitFuncConst<typeof cufNull.dim>;
        expect(ALGEBRA_IVAL.isNull(r0.value)).toBe(true);

        const r1 = cufOne.nthRoot(7 as CFUint32) as CFUnitFuncConst<typeof cufOne.dim>;
        expect(ALGEBRA_IVAL.isOne(r1.value)).toBe(true);
    });

    it('even root of negative/touching-negative interval collapses to null; odd root is allowed', () => {
        const neg = createConstUnitFunc(cufTVal.dim, cufTVal.NU, cufTVal.NS,
            [-8, -1] as any);
        const cross = createConstUnitFunc(cufTVal.dim, cufTVal.NU, cufTVal.NS,
            [-1, 4] as any);
        const pos = createConstUnitFunc(cufTVal.dim, cufTVal.NU, cufTVal.NS,
            [1, 8] as any);

        // even roots:
        const rEvenNeg = neg.nthRoot(2 as CFUint32) as CFUnitFuncConst<typeof neg.dim>;
        const rEvenCross = cross.nthRoot(2 as CFUint32) as CFUnitFuncConst<typeof cross.dim>;
        expect(ALGEBRA_IVAL.isNull(rEvenNeg.value)).toBe(true);
        expect(ALGEBRA_IVAL.isNull(rEvenCross.value)).toBe(true);

        // odd roots:
        const rOddNeg = neg.nthRoot(3 as CFUint32) as CFUnitFuncConst<typeof neg.dim>;
        const rOddPos = pos.nthRoot(3 as CFUint32) as CFUnitFuncConst<typeof pos.dim>;
        const expOddNeg = ALGEBRA_IVAL.nthRoot((neg as any).value, 3 as CFUint32);
        const expOddPos = ALGEBRA_IVAL.nthRoot((pos as any).value, 3 as CFUint32);
        expect(ALGEBRA_IVAL.eq(rOddNeg.value, expOddNeg)).toBe(true);
        expect(ALGEBRA_IVAL.eq(rOddPos.value, expOddPos)).toBe(true);
    });

    it('general case folds via ALGEBRA_IVAL.nthRoot (positive intervals)', () => {
        const a = createConstUnitFunc(cufTVal.dim, cufTVal.NU, cufTVal.NS,
            [4, 9] as any);
        const r = a.nthRoot(2 as CFUint32) as CFUnitFuncConst<typeof a.dim>;
        const expected = ALGEBRA_IVAL.nthRoot((a as any).value, 2 as CFUint32);
        expect(ALGEBRA_IVAL.eq(r.value, expected)).toBe(true);
    });

    it('zero-dim: n = 0 → null; n = 1 → identity', () => {
        const posZD = createConstUnitFunc(0 as CFUint32Zero, cufOne.NU, cufOne.NS,
            [4, 9] as any);

        const r0 = posZD.nthRoot(0 as CFUint32) as CFUnitFuncConst<CFUint32Zero>;
        expect(ALGEBRA_IVAL.isNull(r0.value)).toBe(true);

        // Dirty cast here but this will still be checked in 'equals'.
        const r1 = posZD.nthRoot(1 as CFUint32) as CFUnitFuncConst<CFUint32Zero>;

        expect(r1.equals(posZD)).toBe(true);
    });
});
