import {describe, expect, it} from "vitest";
import {
    ALGEBRA_IVAL,
    CFArithOp,
    CFBinOpType, 
    CFInt32, 
    CFIval, 
    CFReal,
    CFUint32,
    CFUint32Zero, CFUnitFunc,
    CFUnitFuncArithImpl,
    createZeroDimFunc,
    CFStorageTag,
    CFUnit,
    CFSeriesIndex
} from "../src";

// ============================================================================
// CFUnitFuncArithImpl.add
// ============================================================================


describe('CFUnitFuncArithImpl.add', () => {
    it('wraps arithBase with CFArithOp.Add and passes opType through', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 5] as any]);
        const ar = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Add, CFBinOpType.Left);

        const C = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[7, 8] as any]);
        const res = ar.add(C, CFBinOpType.Right)!;

        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Add);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(ar);
        expect((res as any).right).toBe(C);
    });

    it('domain mismatch ⇒ undefined', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[1, 1] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 2] as any]);
        const ar = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Add, CFBinOpType.Left);

        // mismatched NU (or NS) to force equalDomains=false
        const C_badNU = createZeroDimFunc(2 as CFUint32, 1 as CFUint32, [ALGEBRA_IVAL.one(), ALGEBRA_IVAL.one()]);
        const res = ar.add(C_badNU, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });
});

// ============================================================================
// CFUnitFuncArithImpl.sub
// ============================================================================
describe('CFUnitFuncArithImpl.sub', () => {
    it('wraps arithBase with CFArithOp.Sub and passes opType through', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[5, 6] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const ar = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Sub, CFBinOpType.Left);

        const C = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[9, 11] as any]);
        const res = ar.sub(C, CFBinOpType.Right)!;

        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Sub);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(ar);
        expect((res as any).right).toBe(C);
    });

    it('domain mismatch ⇒ undefined', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[1, 2] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[3, 4] as any]);
        const ar = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Sub, CFBinOpType.Left);

        // mismatched NS to force equalDomains=false
        const C_badNS = createZeroDimFunc(1 as CFUint32, 2 as CFUint32, [[1, 1] as any, [1, 1] as any]);
        const res = ar.sub(C_badNS, CFBinOpType.Left);
        expect(res).toBeUndefined();
    });
});

// ============================================================================
// CFUnitFuncArithImpl.neg
// ============================================================================
describe('CFUnitFuncArithImpl.neg', () => {
    it('-(A + B) = (-A) + (-B)', () => {
const A = createZeroDimFunc(4 as CFUint32, 1 as CFUint32, [[2, 3], [3, 4], [4, 5], [5, 6] as any]);
        const B = createZeroDimFunc(4 as CFUint32, 1 as CFUint32, [[3, 4], [4, 5], [5, 6], [6, 7] as any]);
        const addNeg = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Add, CFBinOpType.Left).neg()!;

        const aNeg = A.neg();
        const bNeg = B.neg();
        const abAddNeg = new CFUnitFuncArithImpl(A.NU, A.NS, aNeg, bNeg, CFArithOp.Add, CFBinOpType.Left);

        const s = 0 as CFSeriesIndex

        for(let u = 0 as CFUnit; u < A.NU; u++) {
            expect(ALGEBRA_IVAL.eq(addNeg.getUnsafe(u, s)!, abAddNeg.getUnsafe(u, s)!)).toBe(true);
        }
    });

    it('-(A - B) = B - A', () => {
        const A = createZeroDimFunc(4 as CFUint32, 1 as CFUint32, [[2, 3], [3, 4], [4, 5], [5, 6] as any]);
        const B = createZeroDimFunc(4 as CFUint32, 1 as CFUint32, [[3, 4], [4, 5], [5, 6], [6, 7] as any]);
        const subNeg = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Sub, CFBinOpType.Left).neg()!;
        
        const aNeg = A.neg();
        const aSubNeg = new CFUnitFuncArithImpl(A.NU, A.NS, B, aNeg, CFArithOp.Sub, CFBinOpType.Left);

        const s = 0 as CFSeriesIndex

        for(let u = 0 as CFUnit; u < A.NU; u++) {
            const vSubNeg = subNeg.getUnsafe(u, s)!
            const vASubNeg = aSubNeg.getUnsafe(u, s)!
            expect(ALGEBRA_IVAL.eq(vSubNeg, vASubNeg)).toBe(true);
        }
    });

    it('-(A * B) = (-A) * B', () => {
        const A = createZeroDimFunc(4 as CFUint32, 1 as CFUint32, [[2, 3], [3, 4], [4, 5], [5, 6] as any]);
        const B = createZeroDimFunc(4 as CFUint32, 1 as CFUint32, [[3, 4], [4, 5], [5, 6], [6, 7] as any]);
        const mulNeg = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Mul, CFBinOpType.Left).neg()!;

        const aNeg = A.neg();
        const aMulNeg = new CFUnitFuncArithImpl(A.NU, A.NS, aNeg, B, CFArithOp.Mul, CFBinOpType.Left);

        const s = 0 as CFSeriesIndex

        for(let u = 0 as CFUnit; u < A.NU; u++) {
            expect(ALGEBRA_IVAL.eq(mulNeg.getUnsafe(u, s)!, aMulNeg.getUnsafe(u, s)!)).toBe(true);
        }
    });

    it('-(A / B) = (-A) / B', () => {
        const A = createZeroDimFunc(4 as CFUint32, 1 as CFUint32, [[2, 3], [3, 4], [4, 5], [5, 6] as any]);
        const B = createZeroDimFunc(4 as CFUint32, 1 as CFUint32, [[3, 4], [4, 5], [5, 6], [6, 7] as any]);
        const divNeg = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Div, CFBinOpType.Left).neg()!;

        const aNeg = A.neg();
        const aDivNeg = new CFUnitFuncArithImpl(A.NU, A.NS, aNeg, B, CFArithOp.Div, CFBinOpType.Left);

        const s = 0 as CFSeriesIndex

        for(let u = 0 as CFUnit; u < A.NU; u++) {
            expect(ALGEBRA_IVAL.eq(divNeg.getUnsafe(u, s)!, aDivNeg.getUnsafe(u, s)!)).toBe(true);
        }
    });
});

// ============================================================================
// CFUnitFuncArithImpl.mul
// ============================================================================
describe('CFUnitFuncArithImpl.mul', () => {
    it('wraps arithBase with CFArithOp.Mul and passes opType through', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 5] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Add, CFBinOpType.Left);

        const C = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[7, 8] as any]);
        const res = node.mul(C, CFBinOpType.Right)!;

        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).left).toBe(node);
        expect((res as any).right).toBe(C);
    });

    it('domain mismatch ⇒ undefined', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[1, 1] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 2] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Mul, CFBinOpType.Left);

        // Different NS to force mismatch
        const C_bad = createZeroDimFunc(1 as CFUint32, 2 as CFUint32, [[1, 1] as any, [1, 1] as any]);
        expect(node.mul(C_bad, CFBinOpType.Left)).toBeUndefined();
    });
});

// ============================================================================
// CFUnitFuncArithImpl.div
// ============================================================================
describe('CFUnitFuncArithImpl.div', () => {
    it('wraps arithBase with CFArithOp.Div and passes opType through', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[5, 6] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Sub, CFBinOpType.Left);

        const C = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[9, 11] as any]);
        const res = node.div(C, CFBinOpType.Left)!;

        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Div);
        expect((res as any).opType).toBe(CFBinOpType.Left);
        expect((res as any).left).toBe(node);
        expect((res as any).right).toBe(C);
    });

    it('domain mismatch ⇒ undefined', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[1, 2] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[3, 4] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Div, CFBinOpType.Left);

        const C_bad = createZeroDimFunc(2 as CFUint32, 1 as CFUint32, [ALGEBRA_IVAL.one(), ALGEBRA_IVAL.one()]);
        expect(node.div(C_bad, CFBinOpType.Right)).toBeUndefined();
    });
});

// ============================================================================
// CFUnitFuncArithImpl.inv
// ============================================================================
describe('CFUnitFuncArithImpl.inv', () => {
    it('Add/Sub: returns PowInt node with exp = -1', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 5] as any]);

        const addNode = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Add, CFBinOpType.Left);
        const addInv = addNode.inv()!;
        expect(addInv.storage).toBe(CFStorageTag.PowInt);
        expect((addInv as any).exp).toBe(-1);
        expect((addInv as any).dim).toBe(addNode.dim);

        const subNode = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Sub, CFBinOpType.Left);
        const subInv = subNode.inv()!;
        expect(subInv.storage).toBe(CFStorageTag.PowInt);
        expect((subInv as any).exp).toBe(-1);
        expect((subInv as any).dim).toBe(subNode.dim);
    });

    it('Mul: returns Arith(Mul, inv(A), inv(B))', () => {
        // Use Dense so that inv() of A/B is Arith(Div, const(1), A/B)
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 4] as any]); // Dense(0)
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[3, 6] as any]);

        const mulNode = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Mul, CFBinOpType.Left);
        const invMul = mulNode.inv() as CFUnitFunc<CFUint32Zero>;

        expect(invMul.storage).toBe(CFStorageTag.Arith);
        expect((invMul as any).arithOp).toBe(CFArithOp.Mul);
        const L = (invMul as any).left as CFUnitFunc<CFUint32Zero>;
        const R = (invMul as any).right as CFUnitFunc<CFUint32Zero>;
        // Each side should be an inv() subtree of A/B, i.e., Div with left=const(1), right=A|B
        expect(L.storage === CFStorageTag.Arith || L.storage === CFStorageTag.Const).toBe(true);
        expect(R.storage === CFStorageTag.Arith || R.storage === CFStorageTag.Const).toBe(true);
    });

    it('Div: returns Arith(Div, right, left) (i.e., B / A)', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 5] as any]);

        const divNode = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Div, CFBinOpType.Left);
        const invDiv = divNode.inv() as CFUnitFunc<CFUint32Zero>;

        expect(invDiv.storage).toBe(CFStorageTag.Arith);
        expect((invDiv as any).arithOp).toBe(CFArithOp.Div);
        expect((invDiv as any).left).toBe(B);
        expect((invDiv as any).right).toBe(A);
    });
});

// ============================================================================
// CFUnitFuncArithImpl.smul
// ============================================================================
describe('CFUnitFuncArithImpl.smul', () => {
    it('Add: s(A + B) = sA + sB; result opType is Left', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[1, 2] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[3, 4] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Add, CFBinOpType.Right);

        const x = [0.5, 0.5] as any as CFIval;
        const res = node.smul(x, CFBinOpType.Right);
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Add);
        expect((res as any).opType).toBe(CFBinOpType.Left); // per implementation

        const L = (res as any).left as CFUnitFunc<CFUint32Zero>;
        const R = (res as any).right as CFUnitFunc<CFUint32Zero>;
        expect(L.storage === CFStorageTag.Arith || L.storage === CFStorageTag.Const).toBe(true);
        expect(R.storage === CFStorageTag.Arith || R.storage === CFStorageTag.Const).toBe(true);
    });

    it('Sub: s(A - B) = sA - sB', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[5, 7] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Sub, CFBinOpType.Left);

        const x = [2, 2] as any as CFIval;
        const res = node.smul(x, CFBinOpType.Left);
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Sub);
        expect((res as any).opType).toBe(CFBinOpType.Left);
    });

    it('Mul: s(A * B) = (sA) * B', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 4] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[3, 6] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Mul, CFBinOpType.Left);

        const x = [0.25, 0.25] as any as CFIval;
        const res = node.smul(x, CFBinOpType.Right);
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Mul);
        expect((res as any).opType).toBe(CFBinOpType.Left);

        const L = (res as any).left as CFUnitFunc<CFUint32Zero>;
        const R = (res as any).right as CFUnitFunc<CFUint32Zero>;
        // Left is sA (Arith(Mul, const(x), A) or similar), right is original B
        expect(R).toBe(B);
        expect(L.storage === CFStorageTag.Arith || L.storage === CFStorageTag.Const).toBe(true);
    });

    it('Div: s(A / B) = (sA) / B', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[8, 9] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Div, CFBinOpType.Right);

        const x = [10, 10] as any as CFIval;
        const res = node.smul(x, CFBinOpType.Left);
        expect(res.storage).toBe(CFStorageTag.Arith);
        expect((res as any).arithOp).toBe(CFArithOp.Div);
        expect((res as any).opType).toBe(CFBinOpType.Left);

        const L = (res as any).left as CFUnitFunc<CFUint32Zero>;
        const R = (res as any).right as CFUnitFunc<CFUint32Zero>;
        expect(R).toBe(B);
        expect(L.storage === CFStorageTag.Arith || L.storage === CFStorageTag.Const).toBe(true);
    });
});

// ============================================================================
// CFUnitFuncArithImpl.powInt
// ============================================================================
describe('CFUnitFuncArithImpl.powInt', () => {
    it('returns a PowInt node with the same (dim, NU, NS) and correct exp', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 6] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Add, CFBinOpType.Left);

        const res = node.powInt(-3 as CFInt32);
        expect(res.storage).toBe(CFStorageTag.PowInt);
        expect((res as any).exp).toBe(-3);
        expect((res as any).dim).toBe(node.dim);
        expect((res as any).NU).toBe(node.NU);
        expect((res as any).NS).toBe(node.NS);
    });
});

// ============================================================================
// CFUnitFuncArithImpl.pow
// ============================================================================
describe('CFUnitFuncArithImpl.pow', () => {
    it('returns a PowReal node with same (dim, NU, NS) and correct exp', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[1, 2] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[3, 5] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Sub, CFBinOpType.Right);

        const res = node.pow(0.5 as CFReal);
        expect(res.storage).toBe(CFStorageTag.PowReal);
        expect((res as any).exp).toBe(0.5);
        expect((res as any).dim).toBe(node.dim);
        expect((res as any).NU).toBe(node.NU);
        expect((res as any).NS).toBe(node.NS);
    });
});

// ============================================================================
// CFUnitFuncArithImpl.nthRoot
// ============================================================================
describe('CFUnitFuncArithImpl.nthRoot', () => {
    it('returns an NthRoot node with same (dim, NU, NS) and correct exp', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 9] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[1, 1] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Mul, CFBinOpType.Left);

        const res = node.nthRoot(3 as CFUint32);
        expect(res.storage).toBe(CFStorageTag.NthRoot);
        expect((res as any).exp).toBe(3);
        expect((res as any).dim).toBe(node.dim);
        expect((res as any).NU).toBe(node.NU);
        expect((res as any).NS).toBe(node.NS);
    });
});

// ============================================================================
// CFUnitFuncArithImpl.tmul
// ============================================================================
describe('CFUnitFuncArithImpl.tmul', () => {
    it('returns a Tensor node with left=this arith node, right=other, and opType propagated', () => {
        const A = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[2, 3] as any]);
        const B = createZeroDimFunc(1 as CFUint32, 1 as CFUint32, [[4, 5] as any]);
        const node = new CFUnitFuncArithImpl(A.NU, A.NS, A, B, CFArithOp.Div, CFBinOpType.Left);

        // Use a simple 0-dim dense as "other"
        const D0 = createZeroDimFunc(A.NU, A.NS, [ALGEBRA_IVAL.one()]);
        const res = node.tmul(D0, CFBinOpType.Right)!;

        expect(res.storage).toBe(CFStorageTag.Tensor);
        expect((res as any).left).toBe(node);
        expect((res as any).right).toBe(D0);
        expect((res as any).opType).toBe(CFBinOpType.Right);
        expect((res as any).dim).toBe(node.dim + (D0 as any).dim);
    });
});
