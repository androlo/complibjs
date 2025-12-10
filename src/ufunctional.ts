import {
    CFArithOp,
    CFBinOpType,
    CFDim,
    CFInt32,
    CFReal,
    CFUint32,
    CFUnitFunc,
    CFUnitFunctional,
    CFUnitFunctionalArith,
    CFUnitFunctionalBase,
    CFUnitFunctionalConst,
    CFUnitFunctionalScalarMul,
    CFUnitFunctionalTensor,
    CFFunctionalStorageType,
    CFUFuncDomain
} from "./types";

import {
    CFUnitFuncArithImpl,
    CFUnitFuncNthRootImpl,
    CFUnitFuncPowIntImpl,
    CFUnitFuncPowRealImpl,
    CFUnitFuncTensorImpl,
    createConstUnitFunc
} from "./ufunc";

export function makeConstUnitFunctional<Dim extends CFUint32, UFDim extends CFDim>(
    dim: Dim,
    uFunc: CFUnitFunc<UFDim>
): CFUnitFunctionalConst<Dim, UFDim> {
    const ufNegOne = createConstUnitFunc(uFunc.dim, uFunc.NU, uFunc.NS, [-1, -1] as any);
    const ufd = {dim: uFunc.dim, NU: uFunc.NU, NS: uFunc.NS, uFuncNegOne: ufNegOne};
    return new CFUnitFunctionalConstImpl(dim, ufd, uFunc);
}

export abstract class CFUnitFunctionalAbstract<
    Dim extends CFUint32,
    TStorage extends CFFunctionalStorageType,
    UFDim extends CFDim = CFDim
>
    implements CFUnitFunctionalBase<Dim, TStorage>
{
    constructor(
        public readonly dim: Dim,
        public readonly storage: TStorage,
        public readonly uFuncDomain: CFUFuncDomain<UFDim>
    ) { }

    get(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<CFDim> | undefined {
        if (funcs.length !== this.dim)
            return undefined;
        for(const f of funcs) {
            const ufd =  this.uFuncDomain;
            if (f.dim !== ufd.dim || f.NU !== ufd.NU || f.NS !== ufd.NS) {
                return undefined;
            }
        }
        return this.getUnsafe(...funcs);
    }

    abstract getUnsafe(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<CFDim> | undefined;

    add(other: CFUnitFunctional<Dim, UFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunctional<Dim, UFDim> {
        return new CFUnitFunctionalArithImpl(
            this.dim,
            this.uFuncDomain,
            this, other,
            CFArithOp.Add,
            type
        ) as CFUnitFunctional<Dim, UFDim>;
    }

    sub(other: CFUnitFunctional<Dim, UFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunctional<Dim, UFDim> {
        return new CFUnitFunctionalArithImpl(
            this.dim,
            this.uFuncDomain,
            this, other,
            CFArithOp.Sub,
            type
        ) as CFUnitFunctional<Dim, UFDim>;
    }

    neg(): CFUnitFunctional<Dim, UFDim> {
        return this.smul(this.uFuncDomain.uFuncNegOne, CFBinOpType.Left);
    }

    mul(other: CFUnitFunctional<Dim, UFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunctional<Dim, UFDim> {
        return new CFUnitFunctionalArithImpl(
            this.dim,
            this.uFuncDomain,
            this, other,
            CFArithOp.Mul,
            type
        ) as CFUnitFunctional<Dim, UFDim>;
    }

    div(other: CFUnitFunctional<Dim, UFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunctional<Dim, UFDim> {
        return new CFUnitFunctionalArithImpl(
            this.dim,
            this.uFuncDomain,
            this, other,
            CFArithOp.Div,
            type
        ) as CFUnitFunctional<Dim, UFDim>;
    }

    inv(): CFUnitFunctional<Dim, UFDim> {
        return new CFUnitFunctionalPowInt(this.dim, this.uFuncDomain, this, -1 as CFInt32);
    }

    smul(ufunc: CFUnitFunc<UFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunctional<Dim, UFDim> {
        return new CFUnitFunctionalScalarMulImpl(this.dim, this.uFuncDomain, this, ufunc, type);
    }

    tmul(other: CFUnitFunctional<CFUint32, UFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunctional<CFUint32, UFDim> {
        return new CFUnitFunctionalTensorImpl(this.dim, this.uFuncDomain, this, other, type);
    }

    powInt(exp: CFInt32): CFUnitFunctional<Dim, UFDim> {
        return new CFUnitFunctionalPowInt(this.dim, this.uFuncDomain, this, exp);
    }

    pow(exp: CFReal): CFUnitFunctional<Dim, UFDim> {
        return new CFUnitFunctionalPowReal(this.dim, this.uFuncDomain, this, exp);
    }

    nthRoot(exp: CFUint32): CFUnitFunctional<Dim, UFDim> {
        return new CFUnitFunctionalNthRoot(this.dim, this.uFuncDomain, this, exp);
    }

}

export class CFUnitFunctionalArithImpl<Dim extends CFUint32, UFDim extends CFDim = CFDim>
    extends CFUnitFunctionalAbstract<Dim, CFFunctionalStorageType.Arith, UFDim>
    implements CFUnitFunctionalArith<Dim, UFDim>
{
    constructor(
        dim: Dim,
        CFUFuncDomain: CFUFuncDomain<UFDim>,
        public readonly left: CFUnitFunctional<Dim, UFDim>,
        public readonly right: CFUnitFunctional<Dim, UFDim>,
        public readonly arithOp: CFArithOp,
        public readonly type: CFBinOpType,
    ) {
        super(dim, CFFunctionalStorageType.Arith, CFUFuncDomain);
    }

    getUnsafe(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<CFDim> | undefined {
        const f1 = this.left.getUnsafe(...funcs);
        const f2 = this.right.getUnsafe(...funcs);
        if (f1 === undefined || f2 === undefined) return undefined;
        const ufd = this.uFuncDomain;
        return new CFUnitFuncArithImpl(
            ufd.NU,
            ufd.NS,
            f1,
            f2,
            this.arithOp,
            this.type
        );
    }

}

export class CFUnitFunctionalTensorImpl<Dim extends CFUint32, UFDim extends CFDim>
    extends CFUnitFunctionalAbstract<Dim, CFFunctionalStorageType.Tensor, UFDim>
    implements CFUnitFunctionalTensor<Dim, UFDim>
{
    constructor(
        dim: Dim,
        CFUFuncDomain: CFUFuncDomain<UFDim>,
        public readonly left: CFUnitFunctional<CFUint32, UFDim>,
        public readonly right: CFUnitFunctional<CFUint32, UFDim>,
        public readonly type: CFBinOpType
    ) {
        super(dim, CFFunctionalStorageType.Tensor, CFUFuncDomain);
    }

    getUnsafe(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<CFDim> | undefined {
        const f1 = this.left.getUnsafe(...funcs);
        const f2 = this.right.getUnsafe(...funcs);
        if (f1 === undefined || f2 === undefined) return undefined;
        const ufd = this.uFuncDomain;
        return new CFUnitFuncTensorImpl(
            ufd.NU,
            ufd.NS,
            f1,
            f2,
            this.type
        );
    }

}

export class CFUnitFunctionalScalarMulImpl<Dim extends CFUint32, UFDim extends CFDim>
    extends CFUnitFunctionalAbstract<Dim, CFFunctionalStorageType.ScalarMul, UFDim>
    implements CFUnitFunctionalScalarMul<Dim, UFDim>
{
    constructor(
        dim: Dim,
        CFUFuncDomain: CFUFuncDomain<UFDim>,
        public readonly base: CFUnitFunctional<Dim, UFDim>,
        public readonly scalar: CFUnitFunc<UFDim>,
        public readonly type: CFBinOpType
    ) {
        super(dim, CFFunctionalStorageType.ScalarMul, CFUFuncDomain);
    }

    getUnsafe(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<CFDim> | undefined {
        const f = this.base.getUnsafe(...funcs);
        if (f === undefined) return undefined;
        const ufd = this.uFuncDomain;
        return new CFUnitFuncArithImpl(ufd.NU, ufd.NS, f, this.scalar, CFArithOp.Mul, this.type);
    }

}

export class CFUnitFunctionalPowInt<Dim extends CFUint32, UFDim extends CFDim>
    extends CFUnitFunctionalAbstract<Dim, CFFunctionalStorageType.PowInt, UFDim>
    implements CFUnitFunctionalPowInt<Dim, UFDim>
{
    constructor(
        dim: Dim,
        CFUFuncDomain: CFUFuncDomain<UFDim>,
        public readonly base: CFUnitFunctional<Dim, UFDim>,
        public readonly exp: CFInt32,
    ) {
        super(dim, CFFunctionalStorageType.PowInt, CFUFuncDomain);
    }

    getUnsafe(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<CFDim> | undefined {
        const f = this.base.getUnsafe(...funcs);
        if (f === undefined) return undefined;
        const ufd = this.uFuncDomain;
        return new CFUnitFuncPowIntImpl(ufd.NU, ufd.NS, f, this.exp);
    }

}

export class CFUnitFunctionalPowReal<Dim extends CFUint32, UFDim extends CFDim>
    extends CFUnitFunctionalAbstract<Dim, CFFunctionalStorageType.PowReal, UFDim>
    implements CFUnitFunctionalPowReal<Dim, UFDim>
{
    constructor(
        dim: Dim,
        CFUFuncDomain: CFUFuncDomain<UFDim>,
        public readonly base: CFUnitFunctional<Dim, UFDim>,
        public readonly exp: CFReal,
    ) {
        super(dim, CFFunctionalStorageType.PowReal, CFUFuncDomain);
    }

    getUnsafe(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<CFDim> | undefined {
        const f = this.base.getUnsafe(...funcs);
        if (f === undefined) return undefined;
        const ufd = this.uFuncDomain;
        return new CFUnitFuncPowRealImpl(ufd.NU, ufd.NS, f, this.exp);
    }

}

export class CFUnitFunctionalNthRoot<Dim extends CFUint32, UFDim extends CFDim>
    extends CFUnitFunctionalAbstract<Dim, CFFunctionalStorageType.NthRoot, UFDim>
    implements CFUnitFunctionalNthRoot<Dim, UFDim>
{
    constructor(
        dim: Dim,
        CFUFuncDomain: CFUFuncDomain<UFDim>,
        public readonly base: CFUnitFunctional<Dim, UFDim>,
        public readonly exp: CFUint32,
    ) {
        super(dim, CFFunctionalStorageType.NthRoot, CFUFuncDomain);
    }

    getUnsafe(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<CFDim> | undefined {
        const f = this.base.getUnsafe(...funcs);
        if (f === undefined) return undefined;
        const ufd = this.uFuncDomain;
        return new CFUnitFuncNthRootImpl(ufd.NU, ufd.NS, f, this.exp);
    }

}

export class CFUnitFunctionalConstImpl<Dim extends CFUint32, UFDim extends CFDim>
    extends CFUnitFunctionalAbstract<Dim, CFFunctionalStorageType.Const, UFDim>
    implements CFUnitFunctionalConst<Dim, UFDim>
{

    constructor(
        dim: Dim,
        CFUFuncDomain: CFUFuncDomain<UFDim>,
        public readonly uFunc: CFUnitFunc<UFDim>
    ) {
        super(dim, CFFunctionalStorageType.Const, CFUFuncDomain);
    }

    getUnsafe(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<UFDim> {
        return this.uFunc;
    }
}
