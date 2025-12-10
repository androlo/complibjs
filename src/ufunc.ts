// @ts-nocheck
/* eslint-disable */
// noinspection JSUnusedGlobalSymbols,GrazieInspection
import {
    CFArithOp,
    CFBinOpType,
    CFBaseUnitFunc,
    CFBaseUnitFuncInverse,
    CFBitSet,
    CFCompFuncBinary,
    CFDim,
    CFDimSparse,
    CFInt32,
    CFReal,
    CFSeriesIndex,
    CFUint32,
    CFUint32One,
    CFUint32Zero,
    CFUnit,
    CFUnitFunc,
    CFUnitFuncAlg,
    CFUnitFuncArith,
    CFUnitFuncConst,
    CFUnitFuncDense,
    CFUnitFuncLeaf,
    CFUnitFuncNthRoot,
    CFUnitFuncPowInt,
    CFUnitFuncPowReal,
    CFUnitFuncSparse,
    CFUnitFuncTensor,
    CFUnitFuncZeroDim,
    CFStorageTag,
    toInt32,
    toUint32,
    CF_MAX_DIM,
    Add
} from "./types";

import {popcnt32,} from "./bit_utils";
import {CFFuncBaseAbstract, CFFuncConstImpl, CFFuncDenseImpl, CFFuncSparseImpl} from "./func";
import {ALGEBRA_IVAL, CFIval} from "./value_types/ival";
import {ALGEBRA_REAL} from "./real_algebra";
import {materializeUFunc} from "./materialize";

/**
 * Build a generic 1-D base unit function by slicing a CSR-2 comp func at fixed `uFixed`.
 *
 */
function _createBaseUnitFunc(
    cf: CFCompFuncBinary,
    unitFixed: CFUnit,
    inverse: boolean = false
): CFUnitFuncSparse<CFUint32One> {
    const U = cf.NU;
    const S = cf.NS;

    if (unitFixed >= U) {
        throw new Error("createBaseUnitFunc: unitFixed >= U");
    }

    // Bitset for 1-D: rows per s, wordsPerRow = ceil(U/32). Same width as source rows.
    const wordsPerRow = Math.ceil(U / 32) as CFUint32;
    const needed = S * wordsPerRow;

    if (!Number.isSafeInteger(needed)) {
        throw new Error("S * wordsPerRow is too large for a safe JS array length");
    }

    const cfEBits = cf.bitset.eBits;
    const cfEWordsPerRow = cf.bitset.eWordsPerRow;

    const eBits = new Uint32Array(needed);

    // First pass: copy rows and compute rowPtr via popcounts.
    const rowPtr = new Uint32Array(S + 1);
    let nnz = 0;

    if (!inverse) {
        // For regular base, for each series index, all values are in the same row (s*U + unitFixed)*wordsPerRow.
        for (let s = 0; s < S; s++) {
            // 2-D in units, bits on 'v' in (unitBase, v, s), row is (s*U + unitFixed)*wordsPerRow.
            // No overflow is guaranteed when allocating eBits.
            const srcRowBase = (s * U + unitFixed) * cfEWordsPerRow;
            // Just 1-D in units, so a simpler index (one row per series index).
            const dstRowBase = s * wordsPerRow;

            let rowCount = 0;
            for (let w = 0; w < wordsPerRow; w++) {
                // Just copy the words for the row corresponding to unitFixed and s into the target row for s.
                const word = cfEBits[srcRowBase + w] as CFUint32;
                eBits[dstRowBase + w] = word;
                // rowCount means the number of set bits in the word (i.e. nnz in that word).
                rowCount += popcnt32(word);
            }
            // Write the rowPtr for s and add the rowCount to the running total 'nnz'.
            rowPtr[s] = nnz;
            nnz += rowCount;
        }
    } else {
        // For inverse base, we need to copy the bit for unitFixed in each row (s*U + u)*wordsPerRow.
        // Fixed word and bit for all (u, base, s).

        // For the fixed unit, get word as integer division unitFixed/32, and bit as unitFixed % 32,
        // except faster bit-ops replaces / and %.
        // e.g. for unitFixed 68 we get word 68/32 = 2, and bit 68 % 32 = 4.
        const baseWord = unitFixed >>> 5; // integer division by 32
        // set bit x to 1, where x = unitFixed % 32 (all other bits are 0), e.g. for unitFixed 3 we get ...001000.
        const baseBit = (1 << (unitFixed & 31));
        // This array is temp storage for output.
        const arr: Uint32Array = new Uint32Array(wordsPerRow);

        for (let s = 0; s < S; s++) {
            // 'rowCount' is really the column count for all 'u', given the second unit 'unitFixed',
            // but a row is what it'll be in the target bitset.
            let rowCount = 0;
            for (let u = 0; u < U; u++) {
                // Row.
                const srcRowBase = (s * U + u) * cf.bitset.eWordsPerRow;
                // Bitval is the same for all rows, i.e. that of the fixed unit.
                const bitVal = cf.bitset.eBits[srcRowBase + baseWord] & baseBit;
                if (bitVal !== 0) {
                    // Write to the output array (a single row), using 'u' as index. This makes the output
                    // indexed on a single unit, as it should. Just have to remember to fetch the values
                    // as (v, unitFixed, s) in the next step, instead of (unitFixed, v, s).
                    arr[u >>> 5] |= (1 << (u & 31));
                    // rowCount is the number of set bits.
                    rowCount++;
                }
            }

            // Now we have the row for the target bitset in arr. Copy it to the target bitset.
            const dstRowBase = (s * wordsPerRow);
            for (let w = 0; w < wordsPerRow; w++) {
                eBits[dstRowBase + w] = arr[w];
            }
            // Add nnz to the rowPtr, and add the rowCount from this iteration (CSR row-pointer lags one iteration).
            rowPtr[s] = nnz;
            nnz += rowCount;
            // Clear the temporary array for next 's'.
            arr.fill(0);
        }

    }
    rowPtr[S] = nnz;

    // Second pass: pack values in ascending v where bits are set.
    const values: CFIval[] = new Array(nnz);
    for (let s = 0 as CFSeriesIndex; s < S; s++) {
        const dstRowBase = s * wordsPerRow;
        let write = rowPtr[s];

        for (let v = 0 as CFUnit; v < U; v++) {
            const word = eBits[dstRowBase + (v >>> 5)];
            if ((word & (1 << (v & 31))) === 0) continue;

            // Fetch values.
            if (!inverse) {
                values[write++] = cf.getUnsafe(unitFixed, v, s)!;
            } else {
                values[write++] = cf.getUnsafe(v, unitFixed, s)!;
            }
        }
    }

    return new CFUnitFuncSparseImpl(1 as CFUint32One, U, S, values, {
        eBits,
        eWordsPerRow: wordsPerRow,
        rowPtr
    }, new Uint32Array([1, U,]));

}

export function createNullUnitFunc<Dim extends CFDim>(
    dim: Dim,
    U: CFUint32,
    S: CFUint32,
): CFUnitFuncConst<Dim> {
    return new CFUnitFuncConstImpl(dim, U, S);
}

export function createOneUnitFunc<Dim extends CFDim>(
    dim: Dim,
    U: CFUint32,
    S: CFUint32
) {
    return createConstUnitFunc(dim, U, S, ALGEBRA_IVAL.one());
}

export function createConstUnitFunc<Dim extends CFDim>(
    dim: Dim,
    U: CFUint32,
    S: CFUint32,
    value: CFIval
): CFUnitFuncConst<Dim> {
    return new CFUnitFuncConstImpl(dim, U, S, value);
}

export function createZeroDimFunc(
    U: CFUint32,
    S: CFUint32,
    values: readonly CFIval[]
): CFUnitFuncZeroDim {
    let nulls = 0;
    for (const v of values) {
        if (ALGEBRA_IVAL.isNull(v)) {
            nulls++;
        }
    }
    if(nulls === values.length) {
        return createNullUnitFunc(0 as CFUint32Zero, U, S);
    }
    return new CFUnitFuncDenseImpl(0 as CFUint32Zero, U, S, values, new Uint32Array(0));
}

export function createBaseUnitFunction(
    cf: CFCompFuncBinary,
    uFixed: CFUnit): CFBaseUnitFunc {
    return _createBaseUnitFunc(cf, uFixed);
}

export function createBaseUnitFunctionInverse(
    cf: CFCompFuncBinary,
    uFixed: CFUnit): CFBaseUnitFuncInverse {
    return _createBaseUnitFunc(cf, uFixed, true);
}

export class CFUnitFuncConstImpl<Dim extends CFDim> extends CFFuncConstImpl<Dim> implements CFUnitFuncConst<Dim> {
    constructor(
        dim: Dim,
        U: CFUint32,
        S: CFUint32,
        value?: CFIval
    ) {
        super(dim, U, S, value);
    }

    /**
     * f[V] ≡ c
     *
     * D(f) != D(g): undefined
     * c = 0: f + g = g + f = g
     * g[V] ≡ 0: f + g = g + f = f
     *
     * (+ constant folding)
     */
    add = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;
        // 0 + g = g
        if (this.isZero) return other as CFUnitFunc<Dim>;

        if (other.storage === CFStorageTag.Const) {
            // f + 0 = f
            if (other.isZero) return this;
            // f + g const
            const res = ALGEBRA_IVAL.add(this.value, other.value);
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, res);
        }

        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, CFArithOp.Add, type);
    }

    /**
     * f[V] ≡ c
     *
     * D(f) != D(g): undefined
     * c = 0: g - f = g
     * g[V] ≡ 0: f - g = f
     *
     * (+ constant folding)
     */
    sub = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;
        // g - 0 = g
        if (type === CFBinOpType.Right && this.isZero) return other;

        if (other.storage === CFStorageTag.Const) {
            // f - 0 = f
            if (other.isZero && type === CFBinOpType.Left) return this;
            // f - g || g - f const
            const res = type === CFBinOpType.Left ?
                ALGEBRA_IVAL.sub(this.value, other.value) : ALGEBRA_IVAL.sub(other.value, this.value);

            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, res);
        }

        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, CFArithOp.Sub, type);
    }

    neg = (): CFUnitFunc<Dim> => {
        // -0 = 0
        if (this.isZero) return this;
        return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, ALGEBRA_IVAL.neg(this.value)!);
    }

    /**
     * f[V] ≡ c
     *
     * D(f) != D(g): undefined
     * c = 0: f*g = 0*g = 0, g*f = g*0 = 0
     * c = 1: f*g = 1*g = g, g*f = g*1 = g
     *
     * g[V] ≡ c:
     * c = 0: f*g = f*0 = 0, g*f = 0*f = 0
     * c = 1: f*g = f*1 = g, g*f = 1*f = f
     *
     * (+ constant folding)
     */
    mul = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;
        // 0 * g = 0
        if (this.isZero) return this;
        // 1 * g = g
        if (this.isOne) return other;

        if (other.storage === CFStorageTag.Const) {
            // f * 0 = 0
            if (other.isZero) return other;
            // f * 1 = f
            if (other.isOne) return this;

            // f * g const
            const val = ALGEBRA_IVAL.mul(this.value, other.value);
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, val);
        }

        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, CFArithOp.Mul, type) as CFUnitFunc<Dim>;
    }

    /**
     * f[V] ≡ c
     *
     * D(f) != D(g): undefined
     * c = 0: f/g = 0/g = 0, g/f = g/0 = 0
     * c = 1: f/g = 1/g,     g/f = g/1 = g
     *
     * g[V] ≡ c:
     * c = 0: f/g = f/0 = 0, g/f = 0/f = 0
     * c = 1: f/g = f/1 = g, g/f = 1*f
     *
     * (+ constant folding)
     */
    div = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;

        if (this.isZero) {
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS);
        }
        if(other.storage === CFStorageTag.Const) {
            if (other.isZero) {
                return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS);
            }
            if(other.isOne) {
                // f / 1
                if (type === CFBinOpType.Left) return this;
                // 1 / f
                if (type === CFBinOpType.Right) {
                    const val = ALGEBRA_IVAL.inv(this.value);
                    return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, val);
                }
            }
            // f / g const
            const val = ALGEBRA_IVAL.div(this.value, other.value);
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, val);
        }
        // Do this here since the .inv() is avoided if 'other' is const.
        if (this.isOne) {
            // 1 / g
            if (type === CFBinOpType.Left)
                return other.inv() as CFUnitFunc<Dim>;
            // g / 1 = g
            if (type === CFBinOpType.Right) return other;
        }

        // f / g
        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, CFArithOp.Div, type);
    }


    inv = (): CFUnitFunc<Dim> => {
        return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, ALGEBRA_IVAL.inv(this.value));
    }

    /**
     * f[V] ≡ c
     *
     * c = 0: x*f = x*0 = 0, f*x = 0*x = 0
     * c = 1: x*f = x*1 = f, f*x = 1*f = f
     * x = 0: x*f = 0*f = 0, f*x = f*0 = 0
     * x = 1: x*f = 1*f = f, f*x = f*1 = f
     *
     * (+ constant folding)
     */
    smul = (x: CFIval): CFUnitFunc<Dim> | undefined => {

        // x * 0 = 0 * x = 0
        if (this.isZero) return this;
        // x * 1 = 1 * x = x
        if (this.isOne)
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, x);

        // 0 * f = f * 0 = 0
        if(ALGEBRA_IVAL.isNull(x))
            return createNullUnitFunc(this.dim, this.NU, this.NS);
        // 1 * f = f * 1 = f
        if(ALGEBRA_IVAL.isOne(x)) return this;

        // x * f const
        return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, ALGEBRA_IVAL.mul(this.value, x));
    }

    /**
     * f[V] ≡ c
     *
     * c = 0: f x g = 0 x g = 0, g x f = g x 0 = 0
     * g[V] ≡ c
     * c = 0: f x g = f x 0 = 0, g x f = 0 x f = 0
     *
     * (+ constant folding)
     */
    tmul = (other: CFUnitFunc<CFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<CFDim> | undefined => {
        const newDim = this.dim + other.dim as CFDim;
        if (newDim > CF_MAX_DIM) return undefined;

        // 0 x g = g x 0 = 0 (f.dim + g.dim)
        if(this.isZero) {
            return new CFUnitFuncConstImpl(newDim, this.NU, this.NS, this.value);
        }
        // f x 0 = 0 x f = 0 (f.dim + g.dim)
        if (other.storage === CFStorageTag.Const && other.isZero) {
            return new CFUnitFuncConstImpl(newDim, this.NU, this.NS, other.value);
        }
        // f x g
        return new CFUnitFuncTensorImpl(this.NU, this.NS, this, other, type);
    }

    /**
     * f[V] ≡ c
     * e = 0: f^e = f^1 = (f = 0: f^e = 0^0 = 0)
     * c = 0: f^e = 0^e = 0 = f
     * c = 1: f^e = 1^e = 1 = f
     */
    powInt = (exp: CFInt32): CFUnitFunc<Dim> => {
        if (exp === 0) {
            // 0^0 = 0
            if(this.isZero) return this;
            // f^0 = 1
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, ALGEBRA_IVAL.one());
        }

        // f^1 = f
        if(exp === 1) return this;

        // f^-1 = 1/f
        if(exp === -1) return this.inv();
        // 0^e = 0
        if(this.isZero) return this;
        // 1^e = 1
        if(this.isOne) return this;

        // f^e
        const val = ALGEBRA_IVAL.powInt(this.value, exp);
        return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, val);
    }

    /**
     * f[V] ≡ c
     * e = 0: f^e = f^1 = (f = 0: f^e = 0^0 = 0)
     * c = 0: f^e = 0^e = 0 = f
     * c = 1: f^e = 1^e = 1 = f
     */
    pow = (exp: CFReal): CFUnitFunc<Dim> => {
        if (exp === 0) {
            // 0^0 = ?
            if(this.isZero) return this;
            // f^0 = 1
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, ALGEBRA_IVAL.one());
        }
        // f^1 = f
        if(exp === 1) return this;
        // f^-1 = 1/f
        if(exp === -1) return this.inv();
        // 0^e = 0
        if(this.isZero) return this;
        // 1^e = 1
        if(this.isOne) return this;

        // f^e
        const val = ALGEBRA_IVAL.pow(this.value, exp);
        return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, val);
    }

    /**
     * f[V] ≡ c
     * e = 0: e root f = 0
     * c = 0: e root f = e root 0 = 0 = f
     * c = 1: e root f = e root 1 = 1 = f
     */
    nthRoot = (exp: CFUint32): CFUnitFunc<Dim> => {
        // 0 root f = 0
        if (exp === 0) return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS);
        // n root 0 = 0
        if(this.isZero) return this;
        // n root 1 = 1
        if(this.isOne) return this;

        // n root f
        const val = ALGEBRA_IVAL.nthRoot(this.value, exp);
        return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, val);
    }

    isLeaf = (): this is CFUnitFuncLeaf<Dim> => {
        return true;
    }

    isAlg = (): this is CFUnitFuncAlg<Dim> => {
        return false;
    }

    materialize = (): CFUnitFuncLeaf<Dim> | undefined => {
        return this;
    }

    equals(other: CFUnitFunc<Dim>): boolean {
        if(!this.equalDomains(other))
            return false;

        if (this.storage !== other.storage)
            return false;

        return super.equals(other as CFUnitFuncConst<Dim>);
    }
}

export class CFUnitFuncDenseImpl<Dim extends CFDim> extends CFFuncDenseImpl<Dim> implements CFUnitFuncDense<Dim> {

    constructor(
        dim: Dim,
        U: CFUint32,
        S: CFUint32,
        values: readonly CFIval[],
        pows: Uint32Array,
    ) {
        super(dim, U, S, values, pows);
    }

// ---------- Algebra ----------

    arithBase = (other: CFUnitFunc<Dim>, binOp: CFArithOp, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;

        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, binOp, type);
    }

    add = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Add, type);
    }

    sub = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Sub, type);
    }

    neg = (): CFUnitFunc<Dim> => {
        return this.smul([-1 as CFReal, -1 as CFReal] as CFIval);
    }

    mul = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Mul, type);
    }

    div = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Div, type);
    }

    inv = (): CFUnitFunc<Dim> => {
        const inv = createConstUnitFunc(this.dim, this.NU, this.NS, ALGEBRA_IVAL.one());
        return new CFUnitFuncArithImpl(this.NU, this.NS, inv, this, CFArithOp.Div);
    }

    smul = (x: CFIval): CFUnitFunc<Dim> => {
        const xf = createConstUnitFunc(this.dim, this.NU, this.NS, x);
        return new CFUnitFuncArithImpl(this.NU, this.NS, xf, this, CFArithOp.Mul);
    }

    tmul = (other: CFUnitFunc<CFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<CFDim> | undefined => {
        const newDim = this.dim + other.dim as CFDim;
        if (newDim > CF_MAX_DIM) return undefined;
        // tensor product of two zero-dim has dim 0, so is just the product of this and the other.
        if (this.dim === 0 && other.storage === CFStorageTag.Dense && other.dim === 0) {
            return this.mul(other as CFUnitFunc<Dim>)!;
        }
        return new CFUnitFuncTensorImpl(this.NU, this.NS, this, other, type);
    }

    powInt = (exp: CFInt32): CFUnitFunc<Dim> => {
        return new CFUnitFuncPowIntImpl(this.NU, this.NS, this, exp);
    }

    pow = (exp: CFReal): CFUnitFunc<Dim> => {
        return new CFUnitFuncPowRealImpl(this.NU, this.NS, this, exp);
    }

    nthRoot = (exp: CFUint32): CFUnitFunc<Dim> => {
        return new CFUnitFuncNthRootImpl(this.NU, this.NS, this, exp);
    }

    isLeaf = (): this is CFUnitFuncLeaf<Dim> => {
        return true;
    }

    isAlg = (): this is CFUnitFuncAlg<Dim> => {
        return false;
    }

    materialize = (): CFUnitFuncLeaf<Dim> | undefined => {
        return this;
    }

    equals(other: CFUnitFunc<Dim>): boolean {
        if(!this.equalDomains(other))
            return false;

        if (this.storage !== other.storage)
            return false;

        return super.equals(other as CFUnitFuncDense<Dim>);
    }

}

export class CFUnitFuncSparseImpl<Dim extends CFDimSparse> extends CFFuncSparseImpl<Dim>
    implements CFUnitFuncSparse<Dim> {

    constructor(
        dim: Dim,
        U: CFUint32,
        S: CFUint32,
        values: readonly CFIval[],
        bitset: CFBitSet,
        pows: Uint32Array
    ) {
        if (dim < 1) {
            throw new Error("CFUnitFuncSparseImpl: dim === 0");
        }
        super(dim, U, S, values, bitset, pows);
    }

    // ---------- Algebra ----------

    add = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if(!this.equalDomains(other)) return undefined;
        if(other.storage === CFStorageTag.Const)
            return other.add(this, CFBinOpType.Left);

        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, CFArithOp.Add, type);
    }

    sub = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if(!this.equalDomains(other)) return undefined;
        if(other.storage === CFStorageTag.Const)
            return other.sub(this, type === CFBinOpType.Left ? CFBinOpType.Right : CFBinOpType.Left);
        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, CFArithOp.Sub, type);
    }

    neg = (): CFUnitFunc<Dim> => {
        return this.smul([-1 as CFReal, -1 as CFReal]);
    }

    mul = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if(!this.equalDomains(other)) return undefined;
        if(other.storage === CFStorageTag.Const)
            return other.mul(this, CFBinOpType.Left);

        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, CFArithOp.Mul, type);
    }

    div = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if(!this.equalDomains(other)) return undefined;
        if(other.storage === CFStorageTag.Const)
            return other.div(this, type === CFBinOpType.Left ? CFBinOpType.Right : CFBinOpType.Left);
        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, CFArithOp.Div, type);
    }

    inv = (): CFUnitFunc<Dim> => {
        const newVals = new Array<CFIval>(this.values.length);
        for(let i = 0; i < this.values.length; i++) {
            newVals[i] = ALGEBRA_IVAL.inv(this.values[i]!);
        }
        return new CFUnitFuncSparseImpl(this.dim, this.NU, this.NS, newVals, this.bitset, this.pows);
    }

    smul = (x: CFIval): CFUnitFunc<Dim> => {
        if (ALGEBRA_IVAL.isNull(x)) {
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS);
        }
        if (ALGEBRA_IVAL.isOne(x)) {
            return this;
        }
        const newVals = new Array<CFIval>(this.values.length);
        for(let i = 0; i < this.values.length; i++) {
            newVals[i] = ALGEBRA_IVAL.mul(x, this.values[i]!);
        }
        return new CFUnitFuncSparseImpl(this.dim, this.NU, this.NS, newVals, this.bitset, this.pows);
    }

    tmul = (other: CFUnitFunc<CFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<CFDim> | undefined => {
        const newDim = this.dim + other.dim as CFDim;
        if (newDim > CF_MAX_DIM) return undefined;
        if(other.storage === CFStorageTag.Const && other.isZero) {
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS);
        }
        return new CFUnitFuncTensorImpl(this.NU, this.NS, this, other, type);
    }

    powInt = (exp: CFInt32): CFUnitFunc<Dim> => {
        const newVals = new Array<CFIval>(this.values.length);
        for(let i = 0; i < this.values.length; i++) {
            newVals[i] = ALGEBRA_IVAL.powInt(this.values[i]!, exp);
        }
        return new CFUnitFuncSparseImpl(this.dim, this.NU, this.NS, newVals, this.bitset, this.pows);
    }

    pow = (exp: CFReal): CFUnitFunc<Dim> => {
        const newVals = new Array<CFIval>(this.values.length);
        for(let i = 0; i < this.values.length; i++) {
            newVals[i] = ALGEBRA_IVAL.pow(this.values[i]!, exp);
        }
        return new CFUnitFuncSparseImpl(this.dim, this.NU, this.NS, newVals, this.bitset, this.pows);
    }

    nthRoot = (exp: CFUint32): CFUnitFunc<Dim> => {
        const newVals = new Array<CFIval>(this.values.length);
        for(let i = 0; i < this.values.length; i++) {
            newVals[i] = ALGEBRA_IVAL.nthRoot(this.values[i]!, exp);
        }
        return new CFUnitFuncSparseImpl(this.dim, this.NU, this.NS, newVals, this.bitset, this.pows);
    }

    isLeaf = (): this is CFUnitFuncLeaf<Dim> => {
        return true;
    }

    isAlg = (): this is CFUnitFuncAlg<Dim> => {
        return false;
    }

    materialize = (): CFUnitFuncLeaf<Dim> | undefined => {
        return this;
    }

    equals(other: CFUnitFunc<Dim>): boolean {
        if(!this.equalDomains(other))
            return false;

        if (this.storage !== other.storage)
            return false;

        return super.equals(other as CFUnitFuncSparse<Dim>);
    }

}


export class CFUnitFuncArithImpl<Dim extends CFDim> extends
        CFFuncBaseAbstract<CFStorageTag.Arith, Dim>
    implements CFUnitFuncArith<Dim> {

    // Cache const children to avoid repeated virtual calls in getUnsafe
    private readonly _leftConstVal?: CFIval;
    private readonly _rightConstVal?: CFIval;

    constructor(
        U: CFUint32,
        S: CFUint32,
        public readonly left: CFUnitFunc<Dim>,
        public readonly right: CFUnitFunc<Dim>,
        public readonly arithOp: CFArithOp,
        public readonly opType: CFBinOpType = CFBinOpType.Left
    ) {
        if (left.dim != right.dim) {
            throw new Error("ArithUnitFunc: Dimensions does not match.");
        }
        if (left.NU !== right.NU || left.NS !== right.NS) {
            throw new Error("ArithUnitFunc: U/S do not match.");
        }
        super(left.dim as Dim, U, S, CFStorageTag.Arith);

        // Pre-cache const values (they're invariant in idx and s)
        if (left.storage === CFStorageTag.Const) {
            this._leftConstVal = (left as CFUnitFuncConst<Dim>).value;
        }
        if (right.storage === CFStorageTag.Const) {
            this._rightConstVal = (right as CFUnitFuncConst<Dim>).value;
        }
    }

    getUnsafe = (...idx: [...CFUnit[], CFSeriesIndex]): CFIval => {
        // Pull child values (using cached interval for const children)
        const lVal = (this._leftConstVal ?? this.left.getUnsafe(...idx)) ?? ALGEBRA_IVAL.null();
        const rVal = (this._rightConstVal ?? this.right.getUnsafe(...idx)) ?? ALGEBRA_IVAL.null();

        // For commutative ops we can ignore opType entirely.
        switch (this.arithOp) {
            case CFArithOp.Add:
                return ALGEBRA_IVAL.add(lVal, rVal);
            case CFArithOp.Mul:
                return ALGEBRA_IVAL.mul(lVal, rVal);

            case CFArithOp.Sub: {
                // Non-commutative: decide order once
                const a = this.opType === CFBinOpType.Left ? lVal : rVal;
                const b = this.opType === CFBinOpType.Left ? rVal : lVal;
                return ALGEBRA_IVAL.sub(a, b);
            }
            case CFArithOp.Div: {
                const a = this.opType === CFBinOpType.Left ? lVal : rVal;
                const b = this.opType === CFBinOpType.Left ? rVal : lVal;
                return ALGEBRA_IVAL.div(a, b);
            }

            default:
                throw new Error("ArithUnitFunc: Invalid arith op.");
        }
    }

    E = (...idx: [...CFUnit[], CFSeriesIndex]): boolean => {
        return ALGEBRA_IVAL.isNull(this.getUnsafe(...idx));
    }

    arithBase = (other: CFUnitFunc<Dim>, binOp: CFArithOp, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;

        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, binOp, type);
    }

    add = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Add, type);
    }

    sub = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Sub, type);
    }

    neg = (): CFUnitFunc<Dim> => {
        if(this.arithOp === CFArithOp.Add) {
            // -(A + B) = -A + -B
            const A1 = this.left.neg();
            const A2 = this.right.neg();
            return new CFUnitFuncArithImpl(this.NU, this.NS, A1 as CFUnitFunc<Dim>, A2 as CFUnitFunc<Dim>,
                CFArithOp.Add, CFBinOpType.Left);
        } else if (this.arithOp === CFArithOp.Sub) {
            // -(A - B) = B - A
            return new CFUnitFuncArithImpl(this.NU, this.NS, this.right, this.left.neg(),
                CFArithOp.Sub, CFBinOpType.Left);
        } else if (this.arithOp === CFArithOp.Mul) {
            // -(A * B) = -A * B
            const A1 = this.left.neg();
            return new CFUnitFuncArithImpl(this.NU, this.NS, A1 as CFUnitFunc<Dim>, this.right,
                CFArithOp.Mul, CFBinOpType.Left);
        } else if (this.arithOp === CFArithOp.Div) {
            // - (A / B) = -A / B
            const A1 = this.left.neg();
            return new CFUnitFuncArithImpl(this.NU, this.NS, A1 as CFUnitFunc<Dim>, this.right,
                CFArithOp.Div, CFBinOpType.Left);
        }
    }

    mul = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Mul, type);
    }

    div = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Div, type);
    }

    inv = (): CFUnitFunc<Dim> => {
        if(this.arithOp === CFArithOp.Add) {
            // [1] / (A + B) = stuff
            return new CFUnitFuncPowIntImpl(this.NU, this.NS, this, -1 as CFInt32);
        } else if (this.arithOp === CFArithOp.Sub) {
            // [1] / (A - B) = stuff
            return new CFUnitFuncPowIntImpl(this.NU, this.NS, this, -1 as CFInt32);
        } else if (this.arithOp === CFArithOp.Mul) {
            // [1] / (A * B) = (1/A) * (1/B)
            const A1 = this.left.inv();
            const A2 = this.right.inv(); // ← fix
            return new CFUnitFuncArithImpl(this.NU, this.NS, A1, A2, CFArithOp.Mul, CFBinOpType.Left);
        } else if (this.arithOp === CFArithOp.Div) {
            // [1] / (A / B) = B / A
            return new CFUnitFuncArithImpl(this.NU, this.NS, this.right, this.left,
                CFArithOp.Div, CFBinOpType.Left);
        }

    }

    smul = (x: CFIval, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> => {
        if(this.arithOp === CFArithOp.Add) {
            // s(A + B) = sA + sB
            const A1 = this.left.smul(x, type);
            const A2 = this.right.smul(x, type);
            return new CFUnitFuncArithImpl(this.NU, this.NS, A1 as CFUnitFunc<Dim>, A2 as CFUnitFunc<Dim>,
                CFArithOp.Add, CFBinOpType.Left);
        } else if (this.arithOp === CFArithOp.Sub) {
            // s(A - B) = sA - sB
            const A1 = this.left.smul(x, type);
            const A2 = this.right.smul(x, type);
            return new CFUnitFuncArithImpl(this.NU, this.NS, A1 as CFUnitFunc<Dim>, A2 as CFUnitFunc<Dim>,
                CFArithOp.Sub, CFBinOpType.Left);
        } else if (this.arithOp === CFArithOp.Mul) {
            // s(A * B) = sA * B
            const A1 = this.left.smul(x, type);
            return new CFUnitFuncArithImpl(this.NU, this.NS, A1 as CFUnitFunc<Dim>, this.right,
                CFArithOp.Mul, CFBinOpType.Left);
        } else if (this.arithOp === CFArithOp.Div) {
            // s(A / B) = sA / B
            const A1 = this.left.smul(x, type);
            return new CFUnitFuncArithImpl(this.NU, this.NS, A1 as CFUnitFunc<Dim>, this.right,
                CFArithOp.Div, CFBinOpType.Left);
        }
    }

    tmul = (other: CFUnitFunc<CFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<CFDim> | undefined => {
        const newDim = this.dim + other.dim as CFDim;
        if (newDim > CF_MAX_DIM) return undefined;
        return new CFUnitFuncTensorImpl(this.NU, this.NS, this, other, type);
    }

    powInt = (exp: CFInt32): CFUnitFunc<Dim> => {
        return new CFUnitFuncPowIntImpl(this.NU, this.NS, this, exp);
    }

    pow = (exp: CFReal): CFUnitFunc<Dim> => {
        return new CFUnitFuncPowRealImpl(this.NU, this.NS, this, exp);
    }

    nthRoot = (exp: CFUint32): CFUnitFunc<Dim> => {
        return new CFUnitFuncNthRootImpl(this.NU, this.NS, this, exp);
    }

    isLeaf = (): this is CFUnitFuncLeaf<Dim> => {
        return false;
    }

    isAlg = (): this is CFUnitFuncAlg<Dim> => {
        return true;
    }

    materialize = (): CFUnitFuncLeaf<Dim> | undefined => {
        return materializeUFunc(this);
    }

    equals = (other: CFUnitFunc<Dim>): boolean => {
        if(!this.equalDomains(other))
            return false;

        if (this.storage !== other.storage)
            return false;

        const otherArith = other as CFUnitFuncArith<Dim>;

        if(this.opType != otherArith.opType)
            return false;

        if(this.arithOp != otherArith.CFArithOp)
            return false;

        return this.left.equals(otherArith.left) && this.right.equals(otherArith.right);
    }
}

export class CFUnitFuncTensorImpl<Dim1 extends CFDim, Dim2 extends CFDim, Dim extends Add<Dim1, Dim2> = Add<Dim1, Dim2>>
        extends CFFuncBaseAbstract<CFStorageTag.Tensor, Dim> implements CFUnitFuncTensor<Dim>
{

    constructor(
        U: CFUint32,
        S: CFUint32,
        public readonly left: CFUnitFunc<Dim1>,
        public readonly right: CFUnitFunc<Dim2>,
        public readonly opType: CFBinOpType = CFBinOpType.Left
    ) {
        if(left.dim + right.dim > CF_MAX_DIM) throw new Error(
            "CFUnitFuncTensorImpl: Dimensions too big: sum must not exceed 10 (got " + (left.dim + right.dim) + ").");
        if (left.NU !== right.NU || left.NS !== right.NS) {
            throw new Error("CFUnitFuncTensorImpl: U/S do not match.");
        }
        super(left.dim + right.dim as Dim, U, S, CFStorageTag.Tensor);
    }

    getUnsafe = (...idx: [...CFUnit[], CFSeriesIndex]): CFIval => {

        const s = idx[idx.length - 1] as CFSeriesIndex;
        const lDim = this.left.dim;
        const rDim = this.right.dim;
        const lUnits = idx.slice(0, lDim);
        const rUnits = idx.slice(lDim, lDim + rDim);

        let lVal = this.left.getUnsafe(...lUnits, s);
        let rVal = this.right.getUnsafe(...rUnits, s);
        return ALGEBRA_IVAL.mul(lVal, rVal); // commutative
    }

    E = (...idx: [...CFUnit[], CFSeriesIndex]): boolean => {
        const val = this.getUnsafe(...idx);
        return ALGEBRA_IVAL.isNull(val);
    }

    arithBase = (other: CFUnitFunc<Dim>, binOp: CFArithOp, type: CFBinOpType): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;
        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, binOp, type);
    }

    add = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Add, type);
    }

    sub = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Sub, type);
    }

    neg = (): CFUnitFunc<Dim> => {
        return this.smul([-1 as CFReal, -1 as CFReal] as CFIval)!;
    }

    mul = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;
        if(other.storage === CFStorageTag.Const && other.isZero) {
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS);
        }
        return this.arithBase(other, CFArithOp.Mul, type);
    }

    div = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim>| undefined => {
        return this.arithBase(other, CFArithOp.Div, type);
    }

    inv = (): CFUnitFunc<Dim> => {
        return new CFUnitFuncPowIntImpl(this.NU, this.NS, this, -1 as CFInt32);
    }

    smul = (x: CFIval, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> => {
        if(ALGEBRA_IVAL.isNull(x)) {
            return new CFUnitFuncConstImpl(this.dim, this.NU, this.NS);
        }
        if(ALGEBRA_IVAL.isOne(x)) {
            return this;
        }
        return new CFUnitFuncArithImpl(this.NU, this.NS, this,
            new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, x), CFArithOp.Mul, type);
    }

    tmul = (other: CFUnitFunc<CFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<CFDim> | undefined => {
        const newDim = this.dim + other.dim as CFDim;
        if (newDim > CF_MAX_DIM) return undefined;
        if(other.storage === CFStorageTag.Const && other.isZero) {
            return new CFUnitFuncConstImpl(newDim, this.NU, this.NS);
        }
        return new CFUnitFuncTensorImpl(this.NU, this.NS, this, other, type);
    }

    powInt = (exp: CFInt32): CFUnitFunc<Dim> => {
        return new CFUnitFuncPowIntImpl(this.NU, this.NS, this, exp);
    }

    pow = (exp: CFReal): CFUnitFunc<Dim> => {
        return new CFUnitFuncPowRealImpl(this.NU, this.NS, this, exp);
    }

    nthRoot = (exp: CFUint32): CFUnitFunc<Dim> => {
        return new CFUnitFuncNthRootImpl(this.NU, this.NS, this, exp);
    }

    isLeaf = (): this is CFUnitFuncLeaf<Dim> => {
        return false;
    }
    isAlg = (): this is CFUnitFuncAlg<Dim> => {
        return true;
    }

    materialize = (): CFUnitFuncLeaf<Dim> | undefined => {
        return materializeUFunc(this);
    }

    equals = (other: CFUnitFunc<Dim>): boolean => {
        if(!this.equalDomains(other))
            return false;

        if (this.storage !== other.storage)
            return false;

        const otherTensor = other as CFUnitFuncTensor<Dim>;

        if(this.opType != otherTensor.opType)
            return false;

        return this.left.equals(otherTensor.left) && this.right.equals(otherTensor.right);
    }

}

export class CFUnitFuncPowIntImpl<Dim extends CFDim> extends
    CFFuncBaseAbstract<CFStorageTag.PowInt, Dim> implements CFUnitFuncPowInt<Dim>
{

    constructor(
        U: CFUint32,
        S: CFUint32,
        public readonly base: CFUnitFunc<Dim>,
        public readonly exp: CFInt32
    ) {
        super(base.dim as Dim, U, S, CFStorageTag.PowInt);
    }

    getUnsafe = (...idx: [...CFUnit[], CFSeriesIndex]): CFIval => {
        return ALGEBRA_IVAL.powInt(this.base.getUnsafe(...idx), this.exp);
    }

    E = (...idx: [...CFUnit[], CFSeriesIndex]): boolean => {
        const val = this.getUnsafe(...idx);
        return ALGEBRA_IVAL.isNull(val);
    }

    arithBase = (other: CFUnitFunc<Dim>, binOp: CFArithOp, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;
        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, binOp, type);
    }

    add = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Add, type);
    }

    sub = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Sub, type);
    }

    neg = (): CFUnitFunc<Dim> => {
        return this.smul([-1 as CFReal, -1 as CFReal] as CFIval);
    }

    mul = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Mul, type);
    }

    div = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Div, type);
    }

    inv = (): CFUnitFunc<Dim> => {
        return new CFUnitFuncPowIntImpl(this.NU, this.NS, this.base, toInt32(-1*this.exp) || 0);
    }

    smul = (x: CFIval, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> => {
        return new CFUnitFuncArithImpl(this.NU, this.NS, this, new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, x), CFArithOp.Mul, type);
    }

    tmul = (other: CFUnitFunc<CFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<CFDim> | undefined => {
        const newDim = this.dim + other.dim as CFDim;
        if (newDim > CF_MAX_DIM) return undefined;
        return new CFUnitFuncTensorImpl(this.NU, this.NS, this, other, type);
    }

    /**
     * f^0 = 1, 0^0 = 0
     * (f^n)^m = f^(n*m)
     */
    powInt = (exp: CFInt32): CFUnitFunc<Dim> => {
        // this.base could have null values.
        if (exp === 0) {
            // f^0 = 1, 0^0 = 0
            return new CFUnitFuncPowIntImpl(this.NU, this.NS, this.base, exp);
        }
        const newExp = toInt32(this.exp * exp) || 0;
        return new CFUnitFuncPowIntImpl(this.NU, this.NS, this.base, newExp);
    }

    /**
     * f^0 = 1, 0^0 = 0
     * (f^n)^m = f^(n*m)
     *
     */
    pow = (exp: CFReal): CFUnitFunc<Dim> => {
        // this.base could have null values.
        if (exp === 0) {
            // f^0 = 1, 0^0 = 0
            return new CFUnitFuncPowRealImpl(this.NU, this.NS, this.base, exp);
        }
        const newExp = ALGEBRA_REAL.mul(this.exp as number as CFReal, exp) || 0 as CFReal;
        return new CFUnitFuncPowRealImpl(this.NU, this.NS, this.base, newExp);
    }

    /**
     * n root f = 0
     * n root f^n = f
     * m = kn: n root f^m = f^k (n, m positive)
     * n = km: n root f^m = k root f (n, m positive)
     */
    nthRoot = (exp: CFUint32): CFUnitFunc<Dim> => {
        // n root f = ?
        if (exp === 0) {
            return createNullUnitFunc(this.dim, this.NU, this.NS);
        }
        // n root f^n = f
        if(this.exp === exp as number as CFInt32) {
            return this.base;
        }
        // m = kn
        if( this.exp > exp) {
            // Check if exp divides this.exp.
            if (this.exp % exp === 0) {
                // m = kn: n root f^m = f^k
                return new CFUnitFuncPowIntImpl(this.NU, this.NS, this.base, this.exp / exp as CFInt32);
            }
        } else if (this.exp > 0 && this.exp < exp) {
            if (exp % this.exp === 0) {
                // n = k·m: n root f^m = k root f  with  k = n / m  =>  k = exp / this.exp
                return new CFUnitFuncNthRootImpl(this.NU, this.NS, this.base, (exp / this.exp) as CFUint32);
            }
        }
        return new CFUnitFuncNthRootImpl(this.NU, this.NS, this.base, exp);
    }

    isLeaf = (): this is CFUnitFuncLeaf<Dim> => {
        return false;
    }

    isAlg = (): this is CFUnitFuncAlg<Dim> => {
        return true;
    }

    materialize = (): CFUnitFuncLeaf<Dim> | undefined => {
        return materializeUFunc(this);
    }

    equals = (other: CFUnitFunc<Dim>): boolean => {
        if(!this.equalDomains(other))
            return false;

        if (this.storage !== other.storage)
            return false;

        const otherPow = other as CFUnitFuncPowInt<Dim>;

        if(this.exp !== otherPow.exp)
            return false;

        return this.base.equals(otherPow.base);
    }
}

export class CFUnitFuncPowRealImpl<Dim extends CFDim> extends
    CFFuncBaseAbstract<CFStorageTag.PowReal, Dim> implements CFUnitFuncPowReal<Dim>
{

    constructor(
        U: CFUint32,
        S: CFUint32,
        public readonly base: CFUnitFunc<Dim>,
        public readonly exp: CFReal
    ) {
        super(base.dim as Dim, U, S, CFStorageTag.PowReal);
    }

    getUnsafe = (...idx: [...CFUnit[], CFSeriesIndex]): CFIval => {
        return ALGEBRA_IVAL.pow(this.base.getUnsafe(...idx), this.exp);
    }

    E = (...idx: [...CFUnit[], CFSeriesIndex]): boolean => {
        return ALGEBRA_IVAL.isNull(this.getUnsafe(...idx));
    }

    arithBase = (other: CFUnitFunc<Dim>, binOp: CFArithOp, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;
        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, binOp, type);
    }

    add = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Add, type);
    }

    sub = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Sub, type);
    }

    neg = (): CFUnitFunc<Dim> => {
        return this.smul([-1 as CFReal, -1 as CFReal] as CFIval);
    }

    mul = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Mul, type);
    }

    div = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Div, type);
    }

    inv = (): CFUnitFunc<Dim> => {
        return new CFUnitFuncPowRealImpl(
            this.NU, this.NS, this.base,
            ALGEBRA_REAL.mul(this.exp, -1 as CFReal) || 0 as CFReal
        );
    }

    smul = (x: CFIval, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> => {
        return new CFUnitFuncArithImpl(this.NU, this.NS, this, new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, x), CFArithOp.Mul, type);
    }

    tmul = (other: CFUnitFunc<CFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<CFDim> | undefined => {
        const newDim = this.dim + other.dim as CFDim;
        if (newDim > CF_MAX_DIM) return undefined;
        return new CFUnitFuncTensorImpl(this.NU, this.NS, this, other, type);
    }

    /**
     * f^0 = 1, 0^0 = 0
     * (f^n)^m = f^(n*m)
     *
     */
    powInt = (exp: CFInt32): CFUnitFunc<Dim> => {
        // f^0 = 1, 0^0 = 0
        if (exp === 0) {
            return new CFUnitFuncPowIntImpl(this.NU, this.NS, this.base, exp);
        }
        // (f^n)^m = f^(n*m)
        const newExp = ALGEBRA_REAL.mul(this.exp, exp as number as CFReal) || 0 as CFReal;
        return new CFUnitFuncPowRealImpl(this.NU, this.NS, this.base, newExp);
    }

    /**
     * f^0 = 1, 0^0 = 9
     * (f^n)^m = f^(n*m)
     *
     */
    pow = (exp: CFReal): CFUnitFunc<Dim> => {
        // f^0 = 1, 0^0 = 9
        if (exp === 0) {
            return new CFUnitFuncPowRealImpl(this.NU, this.NS, this.base, exp);
        }
        // (f^n)^m = f^(n*m)
        const newExp = ALGEBRA_REAL.mul(this.exp, exp) || 0 as CFReal;
        return new CFUnitFuncPowRealImpl(this.NU, this.NS, this.base, newExp);
    }

    /**
     * n root f = ?
     * n root f^x = f^(x / n)
     *
     */
    nthRoot = (exp: CFUint32): CFUnitFunc<Dim> => {
        // n root f = 0
        if (exp === 0) {
            return createNullUnitFunc(this.dim, this.NU, this.NS);
        }
        // n root f^x = f^(x / n)
        const newExp = ALGEBRA_REAL.div(this.exp, exp as number as CFReal) || 0 as CFReal;
        return new CFUnitFuncPowRealImpl(this.NU, this.NS, this.base, newExp);
    }

    isLeaf = (): this is CFUnitFuncLeaf<Dim> => {
        return false;
    }

    isAlg = (): this is CFUnitFuncAlg<Dim> => {
        return true;
    }

    materialize = (): CFUnitFuncLeaf<Dim> | undefined => {
        return materializeUFunc(this);
    }

    equals = (other: CFUnitFunc<Dim>): boolean => {
        if(!this.equalDomains(other))
            return false;

        if (this.storage !== other.storage)
            return false;

        const otherPow = other as CFUnitFuncPowReal<Dim>;

        if(!ALGEBRA_REAL.eq(this.exp, otherPow.exp))
            return false;

        return this.base.equals(otherPow.base);
    }
}

export class CFUnitFuncNthRootImpl<Dim extends CFDim> extends
    CFFuncBaseAbstract<CFStorageTag.NthRoot, Dim> implements CFUnitFuncNthRoot<Dim>
{

    constructor(
        U: CFUint32,
        S: CFUint32,
        public readonly base: CFUnitFunc<Dim>,
        public readonly exp: CFUint32
    ) {
        super(base.dim as Dim, U, S, CFStorageTag.NthRoot);
    }

    getUnsafe = (...idx: [...CFUnit[], CFSeriesIndex]): CFIval => {
        return ALGEBRA_IVAL.nthRoot(this.base.getUnsafe(...idx), this.exp);
    }

    E = (...idx: [...CFUnit[], CFSeriesIndex]): boolean => {
        return ALGEBRA_IVAL.isNull(this.getUnsafe(...idx));
    }

    arithBase = (other: CFUnitFunc<Dim>, binOp: CFArithOp, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        if (!this.equalDomains(other)) return undefined;
        return new CFUnitFuncArithImpl(this.NU, this.NS, this, other, binOp, type);
    }

    add = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Add, type);
    }

    sub = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Sub, type);
    }

    neg = (): CFUnitFunc<Dim> => {
        return this.smul([-1 as CFReal, -1 as CFReal] as CFIval);
    }

    mul = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Mul, type);
    }

    div = (other: CFUnitFunc<Dim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> | undefined => {
        return this.arithBase(other, CFArithOp.Div, type);
    }

    inv = (): CFUnitFunc<Dim> => {
        // TODO
        return new CFUnitFuncPowRealImpl(this.NU, this.NS, this.base,
            ALGEBRA_REAL.div(-1 as CFReal, this.exp) || 0);
    }

    smul = (x: CFIval, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<Dim> => {
        return new CFUnitFuncArithImpl(this.NU, this.NS, this, new CFUnitFuncConstImpl(this.dim, this.NU, this.NS, x), CFArithOp.Mul, type);
    }

    tmul = (other: CFUnitFunc<CFDim>, type: CFBinOpType = CFBinOpType.Left): CFUnitFunc<CFDim> | undefined => {
        const newDim = this.dim + other.dim as CFDim;
        if (newDim > CF_MAX_DIM) return undefined;
        return new CFUnitFuncTensorImpl(this.NU, this.NS, this, other, type);
    }

    /**
     * f^0 = 1, 0^0 = 0
     * n = km: m root f^n = f^k
     *
     */
    powInt = (exp: CFInt32): CFUnitFunc<Dim> => {
        // f^0 = 1, 0^0 = 0
        if (exp === 0) {
            return new CFUnitFuncPowIntImpl(this.NU, this.NS, this.base, exp);
        }
        // Check if the current exp divides exp.
        if (exp % this.exp === 0) {
            // n = km: m root f^n = f^k
            return new CFUnitFuncPowIntImpl(this.NU, this.NS, this.base, toInt32(exp / this.exp));
        }
        return new CFUnitFuncPowIntImpl(this.NU, this.NS, this, exp);
    }

    /**
     * f^0 = 1, 0^0 = 0
     * m root f^x = f^(x/m)
     *
     */
    pow = (exp: CFReal): CFUnitFunc<Dim> => {
        // f^0 = 1, 0^0 = 0
        if (exp === 0) {
            return new CFUnitFuncPowRealImpl(this.NU, this.NS, this.base, exp);
        }
        // m root f^x = f^(x/m)
        const newExp = ALGEBRA_REAL.div(exp, this.exp as number as CFReal) || 0 as CFReal;
        return new CFUnitFuncPowRealImpl(this.NU, this.NS, this.base, newExp);
    }

    /**
     * 0 root f = 0
     * n root (m root f) = nm root f
     */
    nthRoot = (exp: CFUint32): CFUnitFunc<Dim> => {
        if (exp === 0) return createNullUnitFunc(this.dim, this.NU, this.NS);
        const newExp = toUint32(this.exp * exp) || 0;
        return new CFUnitFuncNthRootImpl(this.NU, this.NS, this.base, newExp);
    }

    isLeaf = (): this is CFUnitFuncLeaf<Dim> => {
        return false;
    }

    isAlg = (): this is CFUnitFuncAlg<Dim> => {
        return true;
    }

    materialize = (): CFUnitFuncLeaf<Dim> | undefined => {
        return materializeUFunc(this);
    }

    equals = (other: CFUnitFunc<Dim>): boolean => {
        if(!this.equalDomains(other))
            return false;

        if (this.storage !== other.storage)
            return false;

        const otherPow = other as CFUnitFuncNthRoot<Dim>;

        if(this.exp !== otherPow.exp)
            return false;

        return this.base.equals(otherPow.base);
    }

}
