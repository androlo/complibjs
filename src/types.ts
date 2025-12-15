import {CFIval} from "./value_types/ival";
import {ReadonlyUint32Array} from "./readonly_u32array";

export const enum CFStorageTag {
    Const = 0,
    Dense = 1,
    Sparse = 2,
    Arith = 3,
    PowInt = 4,
    PowReal = 5,
    NthRoot= 6,
    Tensor = 7
}

export const enum CFArithOp {
    Add = 0,
    Sub = 1,
    Mul = 2,
    Div = 3
}

export const enum CFPowOp {
    Int = 0,
    Real = 1,
    NthRoot = 2
}

export const enum CFBinOpType {
    Left = 0,
    Right = 1
}

declare const CFUint32Brand: unique symbol;
declare const CFInt32Brand: unique symbol;
declare const CFRealBrand: unique symbol;
declare const CFBitBrand: unique symbol;
declare const CFComparisonBrand: unique symbol;
declare const CFComparisonNBrand: unique symbol;
declare const CFBasisBrand: unique symbol;
declare const CFOrderedBasisBrand: unique symbol;

/** Unsigned 32-bit integer (opaque at type level, number at runtime) */
export type CFUint32 = number & { readonly [CFUint32Brand]: "CFUint32" };
export type CFInt32 = number & { readonly [CFInt32Brand]: "CFInt32" };
export type CFReal = number & { readonly [CFRealBrand]: "CFReal" };
export type CFBit = (0 | 1) & { readonly [CFBitBrand]: "CFBit" };

export type CFRealZero = 0 & { readonly [CFRealBrand]: "CFReal" };
export type CFRealOne  = 1 & { readonly [CFRealBrand]: "CFReal" };

export type CFUnit = CFUint32;
export type CFSeriesIndex = CFUint32;

export type CFUint32Zero = 0 & { readonly [CFUint32Brand]: "CFUint32" };
export type CFUint32One = 1 & { readonly [CFUint32Brand]: "CFUint32" };
export type CFUint32Two = 2 & { readonly [CFUint32Brand]: "CFUint32" };
export type CFUint32Three = 3 & { readonly [CFUint32Brand]: "CFUint32" };
export type CFUint32Four = 4 & { readonly [CFUint32Brand]: "CFUint32" };
export type CFUint32Five = 5 & { readonly [CFUint32Brand]: "CFUint32" };
export type CFUint32Six = 6 & { readonly [CFUint32Brand]: "CFUint32" };
export type CFUint32Seven = 7 & { readonly [CFUint32Brand]: "CFUint32" };
export type CFUint32Eight = 8 & { readonly [CFUint32Brand]: "CFUint32" };
export type CFUint32Nine = 9 & { readonly [CFUint32Brand]: "CFUint32" };
export type CFUint32Ten = 10 & { readonly [CFUint32Brand]: "CFUint32" };

export type CFInt32Zero = 0 & { readonly [CFInt32Brand]: "CFInt32" };
export type CFInt32One = 1 & { readonly [CFInt32Brand]: "CFInt32" };
export type CFInt32Two = 2 & { readonly [CFInt32Brand]: "CFInt32" };
export type CFInt32Three = 3 & { readonly [CFInt32Brand]: "CFInt32" };
export type CFInt32Four = 4 & { readonly [CFInt32Brand]: "CFInt32" };
export type CFInt32Five = 5 & { readonly [CFInt32Brand]: "CFInt32" };
export type CFInt32Six = 6 & { readonly [CFInt32Brand]: "CFInt32" };
export type CFInt32Seven = 7 & { readonly [CFInt32Brand]: "CFInt32" };
export type CFInt32Eight = 8 & { readonly [CFInt32Brand]: "CFInt32" };
export type CFInt32Nine = 9 & { readonly [CFInt32Brand]: "CFInt32" };
export type CFInt32Ten = 10 & { readonly [CFInt32Brand]: "CFInt32" };

export type CFBitZero = 0 & { readonly [CFBitBrand]: "CFBit" };
export type CFBitOne = 1 & { readonly [CFBitBrand]: "CFBit" };

export type CFMaxDim = CFUint32Ten;

export type CFDimSparse =
    CFUint32One |
    CFUint32Two |
    CFUint32Three |
    CFUint32Four |
    CFUint32Five |
    CFUint32Six |
    CFUint32Seven |
    CFUint32Eight |
    CFUint32Nine |
    CFUint32Ten;

export type CFDim = CFUint32Zero | CFDimSparse;

// Value.
export const CF_MAX_DIM = 10 as CFUint32Ten;

// Dimension data.
export type CFDimData = readonly ReadonlySet<CFUnit>[];

export type CFBasis = {
    readonly cf: CFCompFuncBinary,
    readonly data: CFDimData
}  & { readonly [CFBasisBrand]: "CFBasis" };

export type CFOrderedBasis = {
    readonly basis: CFBasis,
    readonly orderedBasis: CFDimData;
} & { readonly [CFOrderedBasisBrand]: "CFOrderedBasis" };

// Comparison types
export type CFComparison = readonly [u: CFUnit, v: CFUnit, s: CFSeriesIndex, value: CFIval] &
    { readonly [CFComparisonBrand]: "CFComparison" };
export type CFComparisonN = readonly [...units: readonly CFUnit[], s: CFSeriesIndex, value: CFIval] &
    { readonly [CFComparisonNBrand]: "CFComparisonN" };

export type CFValidCompDataSet = readonly [CFComparison, ...CFComparison[]]; // At least one item.
export type CFValidCompDataSetN = readonly [CFComparisonN, ...CFComparisonN[]];

// Pre-validation comparison types
export type CFCompData = readonly [u: number, v: number, s: number, value: readonly [number, number]];
export type CFCompDataN = readonly [...idx: readonly number[], value: readonly [number, number]];

export const enum CFFunctionalStorageType {
    Arith = 0,
    Tensor = 1,
    ScalarMul = 2,
    PowInt = 3,
    PowReal = 4,
    NthRoot = 5,
    Const = 6,
    Custom = 7
}

export type CFUFuncDomain<Dim extends CFDim> = {
    readonly dim: Dim,
    readonly NU: CFUint32,
    readonly NS: CFUint32,
    readonly uFuncNegOne: CFUnitFunc<Dim>,
}

export type CFBitSet = {
    /** Bitset for existence: 1 if value present, 0 if null. */
    readonly eBits: ReadonlyUint32Array; // Readonly from readonlyu32array.ts
    /** Words per (s,u) row = ceil(U/32). */
    readonly eWordsPerRow: CFUint32;
    /** CSR row pointer; length S*U + 1. */
    readonly rowPtr: ReadonlyUint32Array;
}

// ---- Small base for generic functions ----

export type CFFuncBase<TStorage extends CFStorageTag, Dim extends CFDim> = {
    readonly dim: Dim;
    readonly NU: CFUint32,
    readonly NS: CFUint32,
    readonly storage: TStorage;
    
    get(...idx: number[]): CFIval | undefined;
    getUnsafe(...idx: [...CFUnit[], CFSeriesIndex]): CFIval;
    E(...idx: number[]): boolean;

    equalDomains(other: CFFuncBase<CFStorageTag, CFDim>): boolean;
}

export type CFFuncConst<Dim extends CFDim> = CFFuncBase<CFStorageTag.Const, Dim> & {
    readonly isZero: boolean;
    readonly isOne: boolean;
    readonly value: CFIval;
}

type HasValues = {readonly values: readonly CFIval[]};

// Maybe switch to Float64Array.
export type CFFuncDense<Dim extends CFDim> = CFFuncBase<CFStorageTag.Dense, Dim> & HasValues & {
    readonly pows: Uint32Array;
}

export type CFFuncSparse<Dim extends CFDimSparse> = CFFuncBase<CFStorageTag.Sparse, Dim> & HasValues & {
    readonly bitset: CFBitSet;
    readonly pows: Uint32Array;
}

export type CFFuncZeroDim = CFFuncDense<CFUint32Zero>;

/** Unit functions */

export type CFUnitFuncBase<Dim extends CFDim> = {

    // Algebra. Undefined for dimensional mismatch
    add(other: CFUnitFunc<Dim>, type?: CFBinOpType): CFUnitFunc<Dim> | undefined;
    sub(other: CFUnitFunc<Dim>, type?: CFBinOpType): CFUnitFunc<Dim> | undefined;
    neg(): CFUnitFunc<Dim>;
    mul(other: CFUnitFunc<Dim>, type?: CFBinOpType): CFUnitFunc<Dim> | undefined;
    div(other: CFUnitFunc<Dim>, type?: CFBinOpType): CFUnitFunc<Dim> | undefined;
    inv(): CFUnitFunc<Dim>;
    smul(x: CFIval, type?: CFBinOpType): CFUnitFunc<Dim>;
    // Tensor multiplication. Undefined for dimension overflow (dim > CF_MAX_DIM)
    tmul(other: CFUnitFunc<CFDim>, type?: CFBinOpType): CFUnitFunc<CFDim> | undefined;

    powInt(exp: CFInt32): CFUnitFunc<Dim>;
    pow(exp: CFReal): CFUnitFunc<Dim>;
    nthRoot(exp: CFUint32): CFUnitFunc<Dim>;

    isLeaf(): this is CFUnitFuncLeaf<Dim>;

    isAlg(): this is CFUnitFuncAlg<Dim>;

    equals(other: CFUnitFunc<Dim>): boolean;

    materialize(): CFUnitFunc<Dim> | undefined;
}

export type CFUnitFuncConst<Dim extends CFDim> = CFUnitFuncBase<Dim> & CFFuncConst<Dim>;

export type CFUnitFuncDense<Dim extends CFDim> = CFUnitFuncBase<Dim> & CFFuncDense<Dim>;

export type CFUnitFuncZeroDim = CFUnitFuncDense<CFUint32Zero> & CFFuncZeroDim;

export type CFUnitFuncSparse<Dim extends CFDimSparse> = CFUnitFuncBase<Dim> & CFFuncSparse<Dim>;

export type CFBaseUnitFunc = CFUnitFuncSparse<CFUint32One>; // Alias

export type CFBaseUnitFuncInverse = CFBaseUnitFunc; // Alias

export type CFUnitFuncLeaf<Dim extends CFDim> =
    CFUnitFuncConst<Dim> |
    CFUnitFuncDense<Dim> |
    CFUnitFuncSparse<Dim & CFDimSparse>;

export type CFUnitFuncArith<Dim extends CFDim> = CFUnitFuncBase<Dim> & CFFuncBase<CFStorageTag.Arith, Dim> & {
    readonly left: CFUnitFunc<Dim>;
    readonly right: CFUnitFunc<Dim>;
    readonly arithOp: CFArithOp;
    readonly opType: CFBinOpType;
};

export type CFUnitFuncTensor<Dim extends CFDim> =
        CFUnitFuncBase<Dim> & CFFuncBase<CFStorageTag.Tensor, Dim> & {
    readonly left: CFUnitFunc<CFDim>;
    readonly right: CFUnitFunc<CFDim>;
    readonly opType: CFBinOpType;
}

export type CFUnitFuncPowInt<Dim extends CFDim> = CFUnitFuncBase<Dim> & CFFuncBase<CFStorageTag.PowInt, Dim> & {
    readonly base: CFUnitFunc<Dim>;
    readonly exp: CFInt32;
};

export type CFUnitFuncPowReal<Dim extends CFDim> = CFUnitFuncBase<Dim> & CFFuncBase<CFStorageTag.PowReal, Dim> & {
    readonly base: CFUnitFunc<Dim>;
    readonly exp: CFReal;
};

export type CFUnitFuncNthRoot<Dim extends CFDim> = CFUnitFuncBase<Dim> & CFFuncBase<CFStorageTag.NthRoot, Dim> & {
    readonly base: CFUnitFunc<Dim>;
    readonly exp: CFUint32;
};

export type CFUnitFuncAlg<Dim extends CFDim> =
    CFUnitFuncArith<Dim> |
    CFUnitFuncTensor<Dim> |
    CFUnitFuncPowInt<Dim> |
    CFUnitFuncPowReal<Dim> |
    CFUnitFuncNthRoot<Dim>;

export type CFUnitFunc<Dim extends CFDim> = CFUnitFuncLeaf<Dim> | CFUnitFuncAlg<Dim>;

/** Comparison functions */

// ---- Generic 2D comp func (sparse CSR-2) ----
export type CFCompFuncBinary = CFFuncSparse<CFUint32Two> & {

    get(u: number, v: number, s: number): CFIval | undefined;
    getUnsafe(u: CFUnit, v: CFUnit, s: CFSeriesIndex): CFIval;

    // Existence
    E(u: CFUnit, v: CFUnit, s: CFSeriesIndex): boolean;

    // Reflexivity
    R(u: CFUnit, s: CFSeriesIndex): boolean;
    R_unsafe(u: CFUnit, s: CFSeriesIndex): boolean;
    R_V(units: CFUnit[], s: CFSeriesIndex): boolean;
    R_V_unsafe(units: CFUnit[], s: CFSeriesIndex): boolean;
    R_FRAME(s: CFSeriesIndex): boolean;
    R_FRAME_unsafe(s: CFSeriesIndex): boolean;
    R_CF(): boolean;

    // Symmetry & left-symmetry
    LS(u: CFUnit, v: CFUnit, s: CFSeriesIndex): boolean;
    S(u: CFUnit, v: CFUnit, s: CFSeriesIndex): boolean;
    S_unsafe(u: CFUnit, v: CFUnit, s: CFSeriesIndex): boolean;
    S_V(units: CFUnit[], s: CFSeriesIndex): boolean;
    S_V_unsafe(units: CFUnit[], s: CFSeriesIndex): boolean;
    S_FRAME(s: CFSeriesIndex): boolean;
    S_FRAME_unsafe(s: CFSeriesIndex): boolean;
    S_CF(): boolean;

    // Transitivity
    T(u: CFUnit, v: CFUnit, w: CFUnit, s: CFSeriesIndex): boolean;
    T_unsafe(u: CFUnit, v: CFUnit, w: CFUnit, s: CFSeriesIndex): boolean;
    T_V(units: CFUnit[], s: CFSeriesIndex): boolean;
    T_V_unsafe(units: CFUnit[], s: CFSeriesIndex): boolean;
    T_FRAME(s: CFSeriesIndex): boolean;
    T_FRAME_unsafe(s: CFSeriesIndex): boolean;
    T_CF(): boolean;

    // ORT (R + S + T)
    ORT_V(units: CFUnit[], s: CFSeriesIndex): boolean;
    ORT_V_unsafe(units: CFUnit[], s: CFSeriesIndex): boolean;
    ORT_FRAME(s: CFSeriesIndex): boolean;
    ORT_FRAME_unsafe(s: CFSeriesIndex): boolean;
    ORT_CF(): boolean;

    // Dimensional helpers
    DO(s: CFSeriesIndex): CFReal | undefined;
    OSS_V(units: CFUnit[], s: CFSeriesIndex): Generator<ReadonlySet<CFUnit>, void, unknown> | undefined;
    OSS_V_unsafe(units: CFUnit[], s: CFSeriesIndex): Generator<ReadonlySet<CFUnit>, void, unknown> | undefined;
    OSS_FRAME(s: CFSeriesIndex): Generator<ReadonlySet<CFUnit>, void, unknown> | undefined;
    OSS_FRAME_unsafe(s: CFSeriesIndex): Generator<ReadonlySet<CFUnit>, void, unknown> | undefined;
    OSS(): Generator<ReadonlySet<CFUnit>, void, unknown>[] | undefined;

    // Basis
    B_FRAME(s: CFSeriesIndex): CFBasis | undefined;
    B_FRAME_unsafe(s: CFSeriesIndex): CFBasis | undefined;
    B_CF(): (CFBasis | undefined)[];

    // Value relations
    VR(u: CFUnit, s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VR_V(units: CFUnit[], s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VR_FRAME(s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VR_CF(errTolerance: CFReal): boolean;

    VS(u: CFUnit, v: CFUnit, s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VS_V(units: CFUnit[], s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VS_FRAME(s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VS_CF(errTolerance: CFReal): boolean;

    VT(u: CFUnit, v: CFUnit, w: CFUnit, s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VT_V(units: CFUnit[], s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VT_FRAME(s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VT_CF(errTolerance: CFReal): boolean;

    VRAT_V(units: CFUnit[], s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VRAT_FRAME(s: CFSeriesIndex, errTolerance: CFReal): boolean;
    VRAT_CF(errTolerance: CFReal): boolean;

    // 0/1 Adjacency matrices
    adj(s: CFSeriesIndex): CFBit[][] | undefined;

    // Turn the comparison function into a 2D sparse unit function.
    toUnitFunc(): CFUnitFuncSparse<CFUint32Two>;
}

export type CFCompFuncTernary = CFFuncSparse<CFUint32Three>;

export type CFCompFuncNAry<Dim extends CFDimSparse> = CFFuncSparse<Dim>;

export type CFUnitFunctionalBase<
    Dim extends CFUint32,
    TStorage extends CFFunctionalStorageType,
    UFDim extends CFDim = CFDim
> = {
    readonly dim: Dim,
    readonly uFuncDomain: CFUFuncDomain<UFDim>;
    readonly storage: TStorage;

    get(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<CFDim> | undefined;
    getUnsafe(...funcs: CFUnitFunc<CFDim>[]): CFUnitFunc<CFDim> | undefined;

    add(other: CFUnitFunctional<Dim, UFDim>, type?: CFBinOpType): CFUnitFunctional<Dim, UFDim>;
    sub(other: CFUnitFunctional<Dim, UFDim>, type?: CFBinOpType): CFUnitFunctional<Dim, UFDim>;
    neg(): CFUnitFunctional<Dim, UFDim>;
    mul(other: CFUnitFunctional<Dim, UFDim>, type?: CFBinOpType): CFUnitFunctional<Dim, UFDim>;
    div(other: CFUnitFunctional<Dim, UFDim>, type?: CFBinOpType): CFUnitFunctional<Dim, UFDim>;
    inv(): CFUnitFunctional<Dim, UFDim>;
    smul(ufunc: CFUnitFunc<CFDim>, type?: CFBinOpType): CFUnitFunctional<Dim, UFDim>;
    tmul(other: CFUnitFunctional<CFUint32, UFDim>, type?: CFBinOpType): CFUnitFunctional<CFUint32, UFDim>;
    powInt(exp: CFInt32): CFUnitFunctional<Dim, UFDim>;
    pow(exp: CFReal): CFUnitFunctional<Dim, UFDim>;
    nthRoot(exp: CFUint32): CFUnitFunctional<Dim, UFDim>;
};

export type CFUnitFunctionalArith<Dim extends CFUint32, UFDim extends CFDim> =
    CFUnitFunctionalBase<Dim, CFFunctionalStorageType.Arith, UFDim> & {
    left: CFUnitFunctional<Dim, UFDim>;
    right: CFUnitFunctional<Dim, UFDim>;
    arithOp: CFArithOp;
    type: CFBinOpType;
}

export type CFUnitFunctionalTensor<Dim extends CFUint32, UFDim extends CFDim> =
    CFUnitFunctionalBase<Dim, CFFunctionalStorageType.Tensor, UFDim> & {
    left: CFUnitFunctional<CFUint32, UFDim>;
    right: CFUnitFunctional<CFUint32, UFDim>;
    type: CFBinOpType;
}

export type CFUnitFunctionalScalarMul<Dim extends CFUint32, UFDim extends CFDim> =
    CFUnitFunctionalBase<Dim, CFFunctionalStorageType.ScalarMul, UFDim> & {
    base: CFUnitFunctional<Dim, UFDim>;
    scalar: CFUnitFunc<CFDim>;
    type: CFBinOpType;
}

export type CFUnitFunctionalPowInt<Dim extends CFUint32, UFDim extends CFDim> =
    CFUnitFunctionalBase<Dim, CFFunctionalStorageType.PowInt, UFDim> & {
    base: CFUnitFunctional<Dim, UFDim>;
    exp: CFInt32;
}

export type CFUnitFunctionalPowReal<Dim extends CFUint32, UFDim extends CFDim> =
    CFUnitFunctionalBase<Dim, CFFunctionalStorageType.PowReal, UFDim> & {
    base: CFUnitFunctional<Dim, UFDim>;
    exp: CFReal;
}

export type CFUnitFunctionalNthRoot<Dim extends CFUint32, UFDim extends CFDim> =
    CFUnitFunctionalBase<Dim, CFFunctionalStorageType.NthRoot, UFDim> & {
    base: CFUnitFunctional<Dim, UFDim>;
    exp: CFUint32;
}

export type CFUnitFunctionalConst<Dim extends CFUint32, UFDim extends CFDim> =
    CFUnitFunctionalBase<Dim, CFFunctionalStorageType.Const, UFDim> & {
    uFunc: CFUnitFunc<UFDim>;
}

export type CFUnitFunctional<Dim extends CFUint32, UFDim extends CFDim> =
    CFUnitFunctionalBase<Dim, CFFunctionalStorageType, UFDim> |
    CFUnitFunctionalArith<Dim, UFDim> |
    CFUnitFunctionalTensor<Dim, UFDim> |
    CFUnitFunctionalScalarMul<Dim, UFDim> |
    CFUnitFunctionalPowInt<Dim, UFDim> |
    CFUnitFunctionalPowReal<Dim, UFDim> |
    CFUnitFunctionalNthRoot<Dim, UFDim> |
    CFUnitFunctionalConst<Dim, UFDim>;

/** uint32 check; rejects non-integers and out-of-range */
export function isUint32(n: number): n is CFUint32 {
    return (n >>> 0) === n && 1 / n !== -Infinity; // exclude -0.
}

/** int32 check; rejects non-integers and out-of-range. Allows -0. */
export function isInt32(n: number): n is CFInt32 {
    return (n | 0) === n;
}

/** real check; rejects non-finite numbers */
export function isReal(x: number): x is CFReal {
    return Number.isFinite(x);
}

/** bit check. */
export function isBit(n: number): n is CFBit {
    return n === 1 || Object.is(n, 0);
}

/** Safe constructors: returns null on invalid input */

export function toUint32(n: number): CFUint32 | null {
    return isUint32(n) ? (n as CFUint32) : null;
}

export function toInt32(n: number): CFInt32 | null {
    return isInt32(n) ? (n as CFInt32) : null;
}

export function toReal(x: number): CFReal | null {
    return Number.isFinite(x) ? (x as CFReal) : null;
}

export function toBit(n: number): CFBit | null {
    return isBit(n) ? (n as CFBit) : null;
}

export function toUnit(n: number): CFUnit | null {
    return isUint32(n) ? (n as unknown as CFUnit) : null;
}

export function toSeriesIndex(n: number): CFSeriesIndex | null {
    return isUint32(n) ? (n as unknown as CFSeriesIndex) : null;
}

export function storageTagToString(tag: CFStorageTag): string {
    switch (tag) {
        case CFStorageTag.Const: return "Const";
        case CFStorageTag.Dense: return "Dense";
        case CFStorageTag.Sparse: return "Sparse";
        case CFStorageTag.Arith: return "Arith";
        case CFStorageTag.PowInt: return "PowInt";
        case CFStorageTag.PowReal: return "PowReal";
        case CFStorageTag.NthRoot: return "NthRoot";
        case CFStorageTag.Tensor: return "Tensor";
        default: return "Unknown";
    }
}

export function arithOpToString(op: CFArithOp): string {
    switch (op) {
        case CFArithOp.Add: return "Add";
        case CFArithOp.Sub: return "Sub";
        case CFArithOp.Mul: return "Mul";
        case CFArithOp.Div: return "Div";
        default: return "Unknown";
    }
}

export function powOpToString(op: CFPowOp): string {
    switch (op) {
        case CFPowOp.Int: return "Int";
        case CFPowOp.Real: return "Real";
        case CFPowOp.NthRoot: return "NthRoot";
        default: return "Unknown";
    }
}

export function binOpTypeToString(opType: CFBinOpType): string {
    switch (opType) {
        case CFBinOpType.Left: return "Left";
        case CFBinOpType.Right: return "Right";
        default: return "Unknown";
    }
}
