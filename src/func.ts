import {
    CFBitSet,
    CFDim,
    CFDimSparse,
    CFFuncBase,
    CFFuncConst,
    CFFuncDense,
    CFFuncSparse,
    CFFuncZeroDim,
    CFSeriesIndex,
    CFUint32,
    CFUint32Zero,
    CFUnit,
    isUint32,
    CFStorageTag
} from "./types";
import {bitsetEquals, getValueBitset} from "./bit_utils";
import {ALGEBRA_IVAL, CFIval} from "./value_types/ival";

export abstract class CFFuncBaseAbstract<TStorage extends CFStorageTag, Dim extends CFDim>
    implements CFFuncBase<TStorage, Dim> {

    protected constructor(
        public readonly dim: Dim,
        public readonly NU: CFUint32,
        public readonly NS: CFUint32,
        public readonly storage: TStorage,
    ) { }

    protected isValidUnit(u: number): u is CFUnit {
        return isUint32(u) && u < this.NU;
    }

    protected isValidSeriesIndex(s: number): s is CFSeriesIndex {
        return isUint32(s) && s < this.NS;
    }

    // ---------- Accessors ----------

    get = (...idx: number[]): CFIval | undefined => {
        if (idx.length === 0) {
            return undefined;
        }
        if (!this.isValidSeriesIndex(idx.at(-1)!)) {
            return undefined;
        }
        if(idx.length > 1) {}
        for(let i = 0; i < idx.length - 1; i++) {
            if (!this.isValidUnit(i)) {
                return undefined;
            }
        }
        return this.getUnsafe(...idx as [...CFUnit[], CFSeriesIndex]);
    }

    abstract getUnsafe(...idx: [...CFUnit[], CFSeriesIndex]): CFIval;
    abstract E(...idx: [...CFUnit[], CFSeriesIndex]): boolean;

    equalDomains = (other: CFFuncBase<CFStorageTag, CFDim>): boolean => {
        return this.dim === other.dim && this.NU === other.NU && this.NS === other.NS;
    }

    abstract equals(other: CFFuncBase<TStorage,Dim>): boolean;

    materialize = (): CFFuncBase<TStorage, Dim> => {
        return this;
    }
}

export class CFFuncConstImpl<Dim extends CFDim> extends CFFuncBaseAbstract<CFStorageTag.Const, Dim>
    implements CFFuncConst<Dim> {

    readonly value: CFIval;
    readonly isZero: boolean = false;
    readonly isOne: boolean = false;

    constructor(
        dim: Dim,
        U: CFUint32,
        S: CFUint32,
        value?: CFIval
    ) {
        super(dim, U, S, CFStorageTag.Const);
        if (value === undefined) {
            this.isZero = true;
            this.value = ALGEBRA_IVAL.null();
        } else {
            this.isZero = ALGEBRA_IVAL.isNull(value);
            if (!this.isZero) {
                this.isOne = ALGEBRA_IVAL.isOne(value);
            }
            this.value = value;
        }
    }

    getUnsafe = (...idx: [...CFUnit[], CFSeriesIndex]): CFIval => {
        return this.value;
    }

    E = (...idx: [...CFUnit[], CFSeriesIndex]): boolean => {
        return ALGEBRA_IVAL.isNull(this.value);
    }

    equals = (other: CFFuncBase<CFStorageTag.Const,Dim>): boolean => {
        if(!this.equalDomains(other)) {
            return false;
        }
        if (this.storage !== other.storage) {
            return false;
        }
        return ALGEBRA_IVAL.eq(this.value, (other as CFFuncConst<Dim>).value);
    }
}

export class CFFuncDenseImpl<Dim extends CFDim> extends CFFuncBaseAbstract<CFStorageTag.Dense, Dim>
    implements CFFuncDense<Dim> {

    constructor(
        dim: Dim,
        U: CFUint32,
        S: CFUint32,
        public readonly values: readonly CFIval[],
        public readonly pows: Uint32Array
    ) {
        super(dim, U, S, CFStorageTag.Dense);
    }

    getUnsafe = (...idx: [...CFUnit[], CFSeriesIndex]): CFIval => {
        const s = idx.at(-1)! as CFSeriesIndex;
        const dim = this.dim;
        if (dim === 0) {
            return this.values[s]!;
        }
        let vIdx = s*this.pows[dim];

        for(let i = 0; i < dim; i++) {
            vIdx += idx[i]! * this.pows[dim - 1 - i];
        }
        return this.values[vIdx]!;
    }

    E = (...idx: [...CFUnit[], CFSeriesIndex]): boolean => {
        const val = this.getUnsafe(...idx)!;
        return ALGEBRA_IVAL.isNull(val);
    }

    equals = (other: CFFuncBase<CFStorageTag.Dense,Dim>): boolean => {
        if(!this.equalDomains(other)) {
            return false;
        }
        if (this.storage !== other.storage) {
            return false;
        }
        const otherDense = other as CFFuncDense<Dim>;
        // Sanity
        if(this.values.length !== otherDense.values.length) {
            throw new Error("CFFuncDenseImpl: values.length !== otherDense.values.length");
        }
        for(let i = 0; i < this.values.length; i++) {
            if (!ALGEBRA_IVAL.eq(this.values[i]!, otherDense.values[i]!)) {
                return false;
            }
        }
        return true;
    }
}

export class CFFuncZeroDimImpl extends CFFuncDenseImpl<CFUint32Zero>
    implements CFFuncZeroDim {

    constructor(
        U: CFUint32,
        S: CFUint32,
        public readonly values: readonly CFIval[]
    ) {
        super(0 as CFUint32Zero, U, S, values, new Uint32Array());
    }

    get = (...idx: number[]): CFIval | undefined => {
        if (idx.length !== 1) {
            return undefined;
        }
        const s = idx[0]!;
        if (!this.isValidSeriesIndex(s)) {
            return undefined;
        }
        return this.values[s]! as CFIval;
    }

    getUnsafe = (...idx: [...CFUnit[], CFSeriesIndex]): CFIval => {
        return this.values[idx.at(-1)!]! as CFIval;
    }

    E = (...idx: [...CFUnit[], CFSeriesIndex]): boolean => {
        return ALGEBRA_IVAL.isNull(this.values[idx.at(-1)!]!);
    }

}

export class CFFuncSparseImpl<Dim extends CFDimSparse> extends CFFuncBaseAbstract<CFStorageTag.Sparse, Dim>
    implements CFFuncSparse<Dim> {
    
    constructor(
        dim: Dim,
        U: CFUint32,
        S: CFUint32,
        public readonly values: readonly CFIval[],
        public readonly bitset: CFBitSet,
        public readonly pows: Uint32Array
    ) {
        if(dim < 1) {
            throw new Error("CFSparseUnitFuncImpl: dim === 0");
        }
        super(dim, U, S, CFStorageTag.Sparse);
    }

    getUnsafe = (...idx: CFUint32[]): CFIval => {

        // Fast branch for 1D (e.g. base unit functions).
        if(this.dim === 1) {
            return getValueBitset(this.bitset, this.values, idx[0] as CFUint32, idx[1] as CFUint32);
        }

        // Split indices: the last is s; the last unit is the in-row bit position.
        const s = idx[idx.length - 1] >>> 0 as CFSeriesIndex;
        const pows = this.pows;

        // Row index = s * U^(dim-1) + Σ_{i=0..dim-2} ui * U^i  (row-major over the first dim-1 unit dims)
        let rowInS = 0;
        // Units first.
        for (let i = 0; i < this.dim - 1; i++) rowInS += (idx[i] * (pows[i] >>> 0)) >>> 0;
        const row = (s * pows[this.dim - 1] + rowInS) >>> 0; // Add s*pows[dim-1] to index (s * U^(dim-1))

        return getValueBitset(this.bitset, this.values, idx.at(-2) as CFUint32, row as CFUint32);
    }

    E = (...idx: number[]): boolean => {
        if (idx.length === 0) {
            return false;
        }
        if (!this.isValidSeriesIndex(idx.at(-1)!)) {
            return false;
        }
        if(idx.length > 1) {}
        for(let i = 0; i < idx.length - 1; i++) {
            if (!this.isValidUnit(i)) {
                return false;
            }
        }
        const s = idx[idx.length - 1] >>> 0 as CFSeriesIndex;
        const pows = this.pows;
        const eWordsPerRow = this.bitset.eWordsPerRow;
        const eBits = this.bitset.eBits;

        // Row index = s * U^(dim-1) + Σ_{i=0..dim-2} ui * U^i  (row-major over the first dim-1 unit dims)
        let rowInS = 0;
        // Units first.
        const dm1 = this.dim - 1;
        for (let i = 0; i < dm1; i++)
            rowInS += (idx[i] * (pows[i] >>> 0)) >>> 0;

        const row = (s * pows[dm1] + rowInS) >>> 0;
        const rowBase = row * eWordsPerRow;
        const uIdx = idx[dm1];
        const word = eBits[rowBase + (uIdx >>> 5)];
        return ((word & (1 << (uIdx & 31))) !== 0);
    }

    equals = (other: CFFuncBase<CFStorageTag.Sparse,Dim>): boolean => {

        if(!this.equalDomains(other)) {
            return false;
        }

        if (this.storage !== other.storage) {
            return false;
        }

        const otherSparse = other as CFFuncSparse<Dim>;

        if (!bitsetEquals(this, otherSparse, false)) { // Check it all for sanity.
            return false;
        }

        // Sanity
        if(this.values.length !== otherSparse.values.length) {
            throw new Error("CFFuncDenseImpl: values.length !== otherDense.values.length");
        }

        

        for(let i = 0; i < this.values.length; i++) {
            if (!ALGEBRA_IVAL.eq(this.values[i]!, otherSparse.values[i]!)) {
                return false;
            }
        }
        return true;
    }

}
