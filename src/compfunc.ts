import {
    CFCompData,
    CFSeriesIndex,
    CFUint32,
    CFUnit,
    isUint32,
    CFBit,
    CFBitSet,
    CFUint32Two,
    CFReal,
    CFCompDataN,
    CFUint32Three,
    CFValidCompDataSet,
    CFCompFuncBinary,
    CFDim,
    CFCompFuncNAry,
    CFCompFuncTernary,
    CFDimSparse,
    CFUnitFuncSparse, CFBasis
} from './types';

import {
    bitTestRow,
    buildSubsetMask,
    buildFullMask,
    andRowWithSubsetInto,
    isZeroWords,
    checkSubsetForBitset,
    getValueBitset
} from "./bit_utils";

import {countFilteredSubsets, filteredSubsetsGenerator} from "./power_set";
import {generatePowerArray, MAX_UINT32_BIGINT, ONE_BIGINT} from "./math_utils";
import {ALGEBRA_IVAL, CFIval} from "./value_types/ival";
import {CFFuncSparseImpl} from "./func";
import {CFUnitFuncSparseImpl} from "./ufunc";
import {ALGEBRA_REAL} from "./real_algebra";

import {
    VR_CF_Error,
    VR_Error,
    VR_FRAME_Error,
    VR_V_Error,
    VRAT_CF_Error,
    VRAT_FRAME_Error,
    VRAT_V_Error,
    VS_CF_Error,
    VS_Error,
    VS_FRAME_Error,
    VS_V_Error,
    VT_CF_Error,
    VT_Error,
    VT_FRAME_Error,
    VT_V_Error
} from "./vrel";

/**
 * Validate inputs for cf_createBinaryCompFunc.
 * arr: Array of (u, v, s, x) triples.
 *
 * Rules:
 *  1) At least one comparison must be provided (arr.length > 0).
 *  2) numUnits and numSeriesIndices must both be 32-bit integers >= 1.
 *  3) All u,v,s are 32-bit unsigned integers.
 *  4) x satisfies algebra.isValid(x) and !algebra.isNull(x)
 *  5) units seen across u and v form exactly {0..numUnits-1}
 *  6) series indices seen form exactly {0..numSeriesIndices-1}
 *  7) no duplicate (u, v, s) triples
 *
 * Throws Error on the first violation found.
 */
export function validateBinaryCompData(
    arr: readonly CFCompData[],
    numUnits: CFUint32,
    numSeriesIndices: CFUint32
): arr is CFValidCompDataSet {
    if (arr.length === 0) {
        throw new Error(`At least one comparison must be provided (got 0).`);
    }
    if (numUnits === 0) {
        throw new Error(`numUnits must be > 0 (got 0).`);
    }
    if (numSeriesIndices === 0) {
        throw new Error(
            `numSeriesIndices must be > 0 (got 0).`
        );
    }
    const biNumUnits = BigInt(numUnits);
    // Early bounds check - needed in compfunc.
    const prod = biNumUnits**2n * BigInt(numSeriesIndices) * (biNumUnits + 31n) / 32n;

    if(prod > MAX_UINT32_BIGINT) {
        throw new Error(
            `numUnits^2*numSeriesIndices must be a 32 bit unsigned integer. Got: ${prod}).`
        );
    }

    const units = new Set<CFUnit>();
    const series = new Set<CFSeriesIndex>();

    // Track the first occurrence index for (u,v,s) to report duplicates
    // Also store position in arr to report the offending entry and previous entry.
    const seen = new Map<number, number>();
    const keyOf =
        (u: CFUnit, v: CFUnit, s: CFSeriesIndex) => s*numUnits*numUnits + u*numUnits + v;

    for (let i = 0; i < arr.length; i++) {
        const [u, v, s, val] = arr[i];

        // 1) u, v, s integers >= 0, 32 bits unsigned.
        if (!isUint32(u)) {
            throw new Error(`Entry ${i}: u must be a 32 bit integer >= 0 (got ${u}).`);
        }
        if (!isUint32(v)) {
            throw new Error(`Entry ${i}: v must be a 32 bit integer >= 0 (got ${v}).`);
        }
        if (!isUint32(s)) {
            throw new Error(`Entry ${i}: s must be a 32 bit integer >= 0 (got ${s}).`);
        }

        // 5) no duplicate (u,v,s)
        {
            const k = keyOf(u, v, s);
            const j = seen.get(k);
            if (j !== undefined) {
                throw new Error(
                    `Duplicate mapping for (u=${u}, v=${v}, s=${s}): first at entry ${j}, duplicate at entry ${i}.`
                );
            }
            seen.set(k, i);
        }
        if (!ALGEBRA_IVAL.isValue(val)) {
            throw new Error(`Entry ${i}: value must be a valid interval (got ${val}).`);
        }
        // 2) values can't be null.
        if(ALGEBRA_IVAL.isNull(val) ) {
            throw new Error(`Entry ${i}: null value is not allowed.`);
        }

        // Collect sets
        units.add(u);
        units.add(v);
        series.add(s);

        // Early bounds clarity
        if (u >= numUnits || v >= numUnits) {
            throw new Error(
                `Entry ${i}: unit index out of range for numUnits=${numUnits} (got u=${u}, v=${v}).`
            );
        }
        if (s >= numSeriesIndices) {
            throw new Error(
                `Entry ${i}: s=${s} is out of range for numSeriesIndices=${numSeriesIndices}.`
            );
        }
    }

    // 3) Units set must be exactly {0..numUnits-1}
    if (units.size !== numUnits) {
        throw new Error(`Units must be size ${numUnits}; got ${units.size}.`);
    }

    // 4) Series set must be exactly {0..numSeriesIndices-1}
    if (series.size !== numSeriesIndices) {
        throw new Error(`Series indices must be size ${numSeriesIndices}; got ${series.size}.`);
    }

    return true;
}

/**
 * Build a **sparse CSR-2** comparison function from arbitrary (u,v,s,value) items.
 *
 * Semantics:
 * - Axis/order: rows are keyed by (s,u); within each row, columns are v in **ascending** order.
 * - Duplicates: if multiple entries share the same (s,u,v), the **last** one in `arr` wins.
 * - Nulls: entries where `algebra.isNull(value)` is true are **not stored** (bit remains 0).
 * - Output:
 *   - `eBits`: existence mask; for each row (s,u) a row of U bits over v.
 *   - `rowPtr`: CSR row pointers of length S*U + 1 (prefix sums of nnz per row).
 *   - `values`: compact array of all non-null values, packed row-major, ascending v per row.
 *
 * Complexity:
 * - Let N = arr.length, rows = S*U.
 * - We collect per-row Maps and then sort each row’s column keys: O(N + Σ k_r log k_r),
 *   where k_r is the number of distinct columns in row r.
 */
export function createBinaryCompFunc(
    arr: readonly CFCompData[],
    numUnits: CFUint32,
    numSeriesIndices: CFUint32
): CFCompFuncBinaryImpl {
    validateBinaryCompData(arr, numUnits, numSeriesIndices);
    const comps = arr as unknown as CFValidCompDataSet;

    const U = numUnits;
    const S = numSeriesIndices;
    const eWordsPerRow = Math.ceil(U / 32) as CFUint32;

    // Safe rows and rows*wordsPerRow are guaranteed by validateBinaryCompData.

    const rows = S * U;

    // Per-row maps: rowId -> (v -> V).
    const rowMaps: Map<number, CFIval>[] = new Array(rows);
    for (let r = 0; r < rows; r++)
        rowMaps[r] = new Map<number, CFIval>();

    for (let i = 0; i < comps.length; i++) {
        const [u, v, s, value] = comps[i];
        // No guards here: validateCompData ensures well-formed comparisons, and rowId < S*U*wordsPerRow.
        const rowId = s * U + u;
        rowMaps[rowId].set(v, value);
    }

    // First pass: build eBits and rowPtr, counting nnz with keys sorted ascending.
    const eBits = new Uint32Array(rows * eWordsPerRow);
    const rowPtr = new Uint32Array(rows + 1);
    let nnz = 0;

    for (let r = 0; r < rows; r++) {
        rowPtr[r] = nnz;

        const m = rowMaps[r];
        if (m.size === 0) continue;

        // Values, sorted by ascending 'v'.
        const vs = Array.from(m.keys()).sort((a, b) => a - b);
        for (let k = 0; k < vs.length; k++) {
            const v = vs[k];
            eBits[r * eWordsPerRow + (v >>> 5)] |= (1 << (v & 31));
        }
        nnz += vs.length;
    }
    rowPtr[rows] = nnz;

    // Second pass: pack values in the same order (row-major, ascending v per row).
    const values: CFIval[] = new Array(nnz);
    for (let r = 0; r < rows; r++) {
        const m = rowMaps[r];
        if (m.size === 0) continue;

        const start = rowPtr[r];
        const vs = Array.from(m.keys()).sort((a, b) => a - b);
        for (let k = 0; k < vs.length; k++) {
            const v = vs[k];
            values[start + k] = m.get(v)!;
        }
    }

    let pows = new Uint32Array([1, U, U*U]);

    return new CFCompFuncBinaryImpl(U, S, values, {eBits, eWordsPerRow, rowPtr}, pows);
}

export class CFCompFuncBinaryImpl extends CFFuncSparseImpl<CFUint32Two>
        implements CFCompFuncBinary {

    constructor(
        U: CFUint32,
        S: CFUint32,
        values: CFIval[],
        bitset: CFBitSet,
        pows: Uint32Array
    ) {
        super(2 as CFUint32Two, U, S, values, bitset, pows);
    }

    get = (u: number, v: number, s: number): CFIval | undefined => {
        if(!this.isValidUnit(u) || !this.isValidUnit(v) || !this.isValidSeriesIndex(s)) {
            return undefined;
        }
        return this.getUnsafe(u, v, s);
    }

    getUnsafe = (u: CFUnit, v: CFUnit, s: CFSeriesIndex): CFIval => {
        return getValueBitset(this.bitset, this.values, v as CFUint32,
            (s*this.NU + u) as CFUint32);
    }

    // ---- Existence ----
    E = (u: number, v: number, s: number): boolean => {
        if (!this.isValidUnit(u) || !this.isValidUnit(v) || !this.isValidSeriesIndex(s)) {
            throw new RangeError('index out of range');
        }
        return bitTestRow(this, u, v, s);
    }

    // ---- Reflexivity ----
    R = (u: CFUnit, s: CFSeriesIndex): boolean => {
        if(!this.isValidUnit(u) || !this.isValidSeriesIndex(s)) {
            return false;
        }
        return bitTestRow(this, u, u, s);
    }

    R_unsafe = (u: CFUnit, s: CFSeriesIndex): boolean => {
        return bitTestRow(this, u, u, s);
    }

    R_V = (units: CFUnit[], s: CFSeriesIndex): boolean => {
        if (!this.isValidSeriesIndex(s)) {
            return false;
        }
        for (const u of units) {
            if(!this.isValidUnit(u)) return false;
            if (!this.R_unsafe(u, s)) return false;
        }
        return true;
    }

    R_V_unsafe = (units: CFUnit[], s: CFSeriesIndex): boolean => {
        for (const u of units) {
            if (!bitTestRow(this, u, u, s)) return false;
        }
        return true;
    }

    R_FRAME = (s: CFSeriesIndex): boolean => {
        if(!this.isValidSeriesIndex(s)) {
            return false;
        }
        return this.R_FRAME_unsafe(s);
    }

    R_FRAME_unsafe = (s: CFSeriesIndex): boolean => {
        for (let u = 0; u < this.NU; u++) {
            if (!bitTestRow(this, u as CFUnit, u as CFUnit, s)) return false;
        }
        return true;
    }

    R_CF = (): boolean => {
        for (let s = 0; s < this.NS; s++) {
            if (!this.R_FRAME_unsafe(s as CFSeriesIndex)) return false;
        }
        return true;
    }

    // ---- Symmetry & left-symmetry ----
    LS = (u: CFUnit, v: CFUnit, s: CFSeriesIndex): boolean => {
        if (!this.isValidUnit(u) || !this.isValidUnit(v) || !this.isValidSeriesIndex(s)) {
            return false;
        }
        return !this.E(u, v, s) || this.E(v, u, s);
    }

    S = (u: CFUnit, v: CFUnit, s: CFSeriesIndex): boolean => {
        if (!this.isValidUnit(u) || !this.isValidUnit(v) || !this.isValidSeriesIndex(s)) {
            return false;
        }
        return this.S_unsafe(u, v, s);
    }

    S_unsafe = (u: CFUnit, v: CFUnit, s: CFSeriesIndex): boolean => {
        const eWordsPerRow = this.bitset.eWordsPerRow;
        const eBits = this.bitset.eBits;

        const sBase = s * this.NU;
        const base0 = (sBase + u) * eWordsPerRow;
        const b0 = ((eBits[base0 + (v >>> 5)] >>> (v & 31)) & 1) !== 0;
        const base1 = (sBase + v) * eWordsPerRow;
        const b1 = ((eBits[base1 + (u >>> 5)] >>> (u & 31)) & 1) !== 0;
        return b0 === b1;
    }

    S_V = (units: CFUnit[], s: CFSeriesIndex): boolean => {
        if (!this.isValidSeriesIndex(s)) return false;

        for (let u of units) {
            if(!this.isValidUnit(u)) return false;
        }
        return this.S_V_unsafe(units, s);
    }



    S_V_unsafe = (units: CFUnit[], s: CFSeriesIndex): boolean => {
        for (let j = 0; j < units.length; j++) {
            for (let k = j; k < units.length; k++) {
                const u = units[j], v = units[k];
                if (!this.S_unsafe(u, v, s)) return false;
            }
        }
        return true;
    }

    S_FRAME = (s: CFSeriesIndex): boolean => {
        if(!this.isValidSeriesIndex(s)) {
            return false;
        }
        return this.S_FRAME_unsafe(s);
    }

    S_FRAME_unsafe = (s: CFSeriesIndex): boolean => {
        for (let u = 0 as CFUnit; u < this.NU; u++) {
            for (let v = u; v < this.NU; v++) {
                if (!this.S_unsafe(u, v, s)) return false;
            }
        }
        return true;
    }

    S_CF = (): boolean => {
        for (let s = 0; s < this.NS; s++) {
            if(!this.S_FRAME_unsafe(s as CFSeriesIndex)) return false;
        }
        return true;
    }

    // ---- Transitivity ----
    T = (u: CFUnit, v: CFUnit, w: CFUnit, s: CFSeriesIndex): boolean => {
        if (!this.isValidUnit(u) || !this.isValidUnit(v) || !this.isValidUnit(w) || !this.isValidSeriesIndex(s)) {
            return false;
        }
        return this.T_unsafe(u, v, w, s);
    }

    T_unsafe = (u: CFUnit, v: CFUnit, w: CFUnit, s: CFSeriesIndex): boolean => {
        const eWordsPerRow = this.bitset.eWordsPerRow;
        const eBits = this.bitset.eBits;

        const sBase = s * this.NU;
        // (u, v)
        const base0 = (sBase + u) * eWordsPerRow;
        const b0 = ((eBits[base0 + (v >>> 5)] >>> (v & 31)) & 1) !== 0;
        // (v, w)
        const base1 = (sBase + v) * eWordsPerRow;
        const b1 = ((eBits[base1 + (w >>> 5)] >>> (w & 31)) & 1) !== 0;
        // (u, w)
        const base2 = (sBase + u) * eWordsPerRow;
        const b2 = ((eBits[base2 + (w >>> 5)] >>> (w & 31)) & 1) !== 0;

        const a = b0; // E(u,v,s)
        const b = b1; // E(v,w,s)
        const c = b2; // E(u,w,s)
        return !(a && b) || c;
    }

    T_V = (units: CFUnit[], s: CFSeriesIndex): boolean => {
        if (!this.isValidSeriesIndex(s)) {
            return false;
        }
        for (let u of units) {
            if(!this.isValidUnit(u)) return false;
        }
        return this.T_V_unsafe(units, s);
    }

    T_V_unsafe = (units: CFUnit[], s: CFSeriesIndex): boolean => {
        const eWordsPerRow = this.bitset.eWordsPerRow;
        const subsetMask = buildSubsetMask(eWordsPerRow, units);
        const tmpU = new Uint32Array(eWordsPerRow);
        const tmpV = new Uint32Array(eWordsPerRow);

        for (const u of units) {
            andRowWithSubsetInto(this, u, s, subsetMask, tmpU);
            if (!checkSubsetForBitset(this, s, tmpU, subsetMask, tmpU, tmpV)) return false;
        }
        return true;
    }

    T_FRAME = (s: CFSeriesIndex): boolean => {
        if(!this.isValidSeriesIndex(s)) {
            return false;
        }
        return this.T_FRAME_unsafe(s);
    }

    /**
     * Transitivity over the entire frame (all units 0..U-1) at series s:
     * ∀u,∀v ∈ R(u): R(v) ⊆ R(u), where rows are restricted to the frame mask.
     */
    T_FRAME_unsafe = (s: CFSeriesIndex): boolean => {
        const eWordsPerRow = this.bitset.eWordsPerRow;
        const mask = buildFullMask(eWordsPerRow, this.NU);
        const tmpU = new Uint32Array(eWordsPerRow);
        const tmpV = new Uint32Array(eWordsPerRow);

        for (let u = 0; u < this.NU; u++) {
            andRowWithSubsetInto(this, u as CFUnit, s, mask, tmpU);
            if (isZeroWords(tmpU)) continue;
            if (!checkSubsetForBitset(this, s, tmpU, mask, tmpU, tmpV)) return false;
        }
        return true;
    }

    T_CF = (): boolean => {
        for (let s = 0; s < this.NS; s++) {
            if(!this.T_FRAME(s as CFSeriesIndex)) return false;
        }
        return true;
    }

    // ---- ORT ----
    ORT_V = (units: CFUnit[], s: CFSeriesIndex): boolean => {
        if (!this.isValidSeriesIndex(s)) {
            return false;
        }
        return this.ORT_V_unsafe(units, s);
    }

    ORT_V_unsafe = (units: CFUnit[], s: CFSeriesIndex): boolean => {
        if (!this.R_V_unsafe(units, s)) return false;
        if (!this.S_V_unsafe(units, s)) return false;
        return this.T_V_unsafe(units, s);
    }

    ORT_FRAME = (s: CFSeriesIndex): boolean => {
        if (!this.isValidSeriesIndex(s)) {
            return false;
        }
        return this.ORT_FRAME_unsafe(s);
    }

    ORT_FRAME_unsafe = (s: CFSeriesIndex): boolean => {
        return this.R_FRAME_unsafe(s) && this.S_FRAME_unsafe(s) && this.T_FRAME_unsafe(s);
    }

    ORT_CF = (): boolean => {
        for (let s = 0; s < this.NS; s++) {
            if(!this.ORT_FRAME_unsafe(s as CFSeriesIndex)) return false;
        }
        return true;
    }

    // ---- Dimensional helpers ----
    DO = (s: CFSeriesIndex): CFReal | undefined => {
        if (!this.isValidSeriesIndex(s)) {
            console.error('CFCompFunc.DO: invalid series index');
            return undefined;
        }
        const units = Array.from({ length: this.NU }, (_, i) => i) as CFUnit[];
        const count = countFilteredSubsets(this.ORT_FRAME_unsafe, this.ORT_V_unsafe, units, s);
        if (count === undefined) {
            return undefined;
        }
        // Have to check size again here.
        const sizeBIG = ONE_BIGINT << BigInt(this.NU);
        if (sizeBIG > MAX_UINT32_BIGINT) {
            console.error('CFCompFunc.DO: powerset too large to count');
            return undefined;
        }
        return count / Number(sizeBIG) as CFReal; // Just division of two non-zero, safe, positive integers.
    }

    OSS_V = (units: CFUnit[], s: CFSeriesIndex): Generator<ReadonlySet<CFUnit>, void, unknown> | undefined => {
        if(!this.isValidSeriesIndex(s)) {
            console.error('CFCompFunc.OSS_V: invalid series index');
            return undefined;
        }
        for(const u of units) {
            if(!this.isValidUnit(u)) {
                console.error('CFCompFunc.OSS_V: invalid unit: ' + u);
                return undefined;
            }
        }
        return this.OSS_V_unsafe(units, s);
    }

    OSS_V_unsafe = (units: CFUnit[], s: CFSeriesIndex): Generator<ReadonlySet<CFUnit>, void, unknown> | undefined => {
        return filteredSubsetsGenerator(this.ORT_FRAME_unsafe, this.ORT_V_unsafe, units, s);
    }

    OSS_FRAME = (s: CFSeriesIndex): Generator<ReadonlySet<CFUnit>, void, unknown> | undefined => {
        if (!this.isValidSeriesIndex(s)) {
            console.error('CFCompFunc.OSS_FRAME: invalid series index');
            return undefined;
        }
        return this.OSS_FRAME_unsafe(s);
    }

    OSS_FRAME_unsafe = (s: CFSeriesIndex): Generator<ReadonlySet<CFUnit>, void, unknown> | undefined => {
        const units = Array.from({ length: this.NU }, (_, i) => i) as CFUnit[];
        return filteredSubsetsGenerator(this.ORT_FRAME_unsafe, this.ORT_V_unsafe, units, s);
    }

    OSS = (): Generator<ReadonlySet<CFUnit>, void, unknown>[] | undefined => {
        const frameData: Generator<ReadonlySet<CFUnit>, void, unknown>[] = new Array(this.NS);
        for (let s = 0; s < this.NS; s++) {
            const fd = this.OSS_FRAME(s as CFSeriesIndex);
            if (fd === undefined) return undefined;
            frameData[s] = fd;
        }
        return frameData;
    }

    // ---- basis ----
    B_FRAME = (s: CFSeriesIndex): CFBasis | undefined => {
        if (!this.isValidSeriesIndex(s)) return undefined;
        return this.B_FRAME_unsafe(s);
    }

    B_FRAME_unsafe = (s: CFSeriesIndex): CFBasis | undefined => {
        const U = (this.NU >>> 0);
        if (!this.ORT_FRAME_unsafe(s)) return undefined;

        // One representative per discovered class, plus the members (as Sets).
        const reps: CFUnit[] = [];
        const groups: Array<Set<CFUnit>> = [];

        for (let u= 0 as CFUnit; u < U; u++) {

            let j = 0;
            for (; j < reps.length; j++) {
                if (bitTestRow(this, u, reps[j], s)) {
                    groups[j]!.add(u);
                    break;
                }
            }

            if (j === reps.length) {
                reps.push(u);
                groups.push(new Set<CFUnit>([u]));
            }
        }

        return { cf: this, data: groups } as unknown as CFBasis;
    }

    B_CF = (): (CFBasis | undefined)[] => {
        const bases: (CFBasis | undefined)[] = new Array(this.NS);
        for (let s = 0; s < this.NS; s++) {
            bases[s] = this.B_FRAME_unsafe(s as CFSeriesIndex);
        }
        return bases;
    }

    VR = (u: CFUnit, s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VR_Error(this, u, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VR_V = (units: CFUnit[], s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VR_V_Error(this, units, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VR_FRAME = (s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VR_FRAME_Error(this, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VR_CF = (errTolerance: CFReal): boolean => {
        const err = VR_CF_Error(this);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VS = (u: CFUnit, v: CFUnit, s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VS_Error(this, u, v, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VS_V = (units: CFUnit[], s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VS_V_Error(this, units, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VS_FRAME = (s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VS_FRAME_Error(this, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VS_CF = (errTolerance: CFReal): boolean => {
        const err = VS_CF_Error(this);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VT = (u: CFUnit, v: CFUnit, w: CFUnit, s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VT_Error(this, u, v, w, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VT_V = (units: CFUnit[], s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VT_V_Error(this, units, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    // TODO optimize.
    VT_FRAME = (s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VT_FRAME_Error(this, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VT_CF = (errTolerance: CFReal): boolean => {
        const err = VT_CF_Error(this);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VRAT_V = (units: CFUnit[], s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VRAT_V_Error(this, units, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VRAT_FRAME = (s: CFSeriesIndex, errTolerance: CFReal): boolean => {
        const err = VRAT_FRAME_Error(this, s);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    VRAT_CF = (errTolerance: CFReal): boolean => {
        const err = VRAT_CF_Error(this);
        return err === undefined ? false : ALGEBRA_REAL.lte(err, errTolerance);
    }

    // Produce a U x U 0/1 adjacency matrix for a given series index `s`.
    adj = (s: CFSeriesIndex): CFBit[][] | undefined => {
        if (!this.isValidSeriesIndex(s)) {
            return undefined;
        }
        const eWordsPerRow = this.bitset.eWordsPerRow;
        const eBits = this.bitset.eBits;
        const U = this.NU;
        const matrix: CFBit[][] = new Array(U);
        for (let u = 0; u < U; u++) {
            const rowId = s * U + u;
            const base = rowId * eWordsPerRow;

            const row: CFBit[] = new Array(U);
            for (let v = 0; v < U; v++) {
                const wordIdx = v >>> 5;        // v / 32
                const bitIdx = v & 31;          // v % 32
                const word = eBits[base + wordIdx];
                row[v] = ((word >>> bitIdx) & 1) as CFBit;
            }
            matrix[u] = row;
        }

        return matrix;
    }

    toUnitFunc = (): CFUnitFuncSparse<CFUint32Two> => {
        return new CFUnitFuncSparseImpl(this.dim, this.NU, this.NS, this.values, this.bitset, this.pows);
    }
}

/**
 * Validate inputs for cf_createNAryCompFunc.
 * arr: Array of (u0, u1, ..., uN, s, x), where x is a value.
 *
 * Rules:
 *  1) At least one comparison must be provided (arr.length > 0).
 *  2) numUnits, numSeriesIndices, and dim, must all be 32-bit integers.
 *     numUnits and numSeriesIndices must be >= 1, and dim >= 2 (see (8) below).
 *  3) All u0, u1, ..., uN, and s are 32-bit unsigned integers.
 *  4) x satisfies algebra.isValid(x) and !algebra.isNull(x)
 *  5) units seen across u0, u1, ..., uN form exactly {0..numUnits-1}
 *  6) series indices seen form exactly {0..numSeriesIndices-1}
 *  7) no duplicate (u0, u1, ..., uN, s) entries
 *
 *  8) For now, we only allow 2-ary comparisons or higher.
 *
 * Throws Error on the first violation found.
 */
export function validateNAryCompData<T extends readonly CFCompDataN[] | readonly CFCompData[]>(
    arr: T,
    dim: CFDim,
    numUnits: CFUint32,
    numSeriesIndices: CFUint32
): arr is T & CFValidCompDataSet {
    if (arr.length === 0) {
        throw new Error(`At least one comparison must be provided (got 0).`);
    }
    if (dim === 0) {
        throw new Error(`Comparison functions with dimension 0 is not implemented (got 0).`);
    }
    if (dim === 2) {
        return validateBinaryCompData(
            arr as CFCompData[],
            numUnits,
            numSeriesIndices
        );
    }
    if (numUnits === 0) {
        throw new Error(`numUnits must be > 0 (got 0).`);
    }
    if (numSeriesIndices === 0) {
        throw new Error(
            `numSeriesIndices must be > 0 (got 0).`
        );
    }
    const biNumUnits = BigInt(numUnits);

    // Check that index calculations will not overflow (last term needed for bitset).
    const maxIdx = biNumUnits**BigInt(dim) * BigInt(numSeriesIndices) * (biNumUnits + 31n) / 32n;
    if (maxIdx > MAX_UINT32_BIGINT) {
        throw new Error(
            `numUnits^dim * numSeriesIndices must be a 32 bit unsigned integer. Got: ${maxIdx}).`
        );
    }
    const units = new Set<CFUnit>();
    const series = new Set<CFSeriesIndex>();

    // Track the first occurrence index for (u,v,s) to report duplicates
    // Also store position in arr to report the offending entry and previous entry.
    const seen = new Map<number, number>();

    for (let i = 0; i < arr.length; i++) {
        const c = arr[i];

        if(c.length !== dim + 2) {
            throw new Error(`Entry ${i}: length must be dim + 2 (got ${c.length}).`);
        }

        for (let j = 0; j < dim; j++) {
            const u = c[j];
            if(typeof u !== 'number') {
                throw new Error(`Entry ${i}: unit must be a number (got ${u}).`);
            }
            if (!isUint32(u)) {
                throw new Error(`Entry ${i}: u must be a 32 bit integer >= 0 (got ${u}).`);
            }
        }

        const s = c[dim];
        if(typeof s !== 'number') {
            throw new Error(`Entry ${i}: series must be a number (got ${s}).`);
        }
        if (!isUint32(s)) {
            throw new Error(`Entry ${i}: s must be a 32 bit integer >= 0 (got ${s}).`);
        }

        const value = c[dim + 1];
        if(!ALGEBRA_IVAL.isValue(value)) {
            throw new Error(`Entry ${i}: not a value .`);
        }
        // values can't be null.
        if(ALGEBRA_IVAL.isNull(value)) {
            throw new Error(`Entry ${i}: null value is not allowed.`);
        }

        // 5) no duplicate (u,v,s)
        {
            const powU: number[] = new Array(dim + 1);
            powU[0] = 1;
            for (let i = 0; i <= dim; i++) {
                powU[i + 1] = powU[i] * numUnits;
            }

            let idx = s*powU[dim];
            // fold units and series index.

            for (let k = 0; k < dim; k++) {
                idx += (c[k] as number) * powU[k];
            }

            const j = seen.get(idx);
            if (j !== undefined) {
                let str = `Duplicate mapping for (`;
                for (let k = 0; k < dim; k++) {
                    str += `${c[k]}, `;
                }
                str += `${s}). First at entry ${j}, duplicate at entry ${i}.`;
                throw new Error(str);
            }
            seen.set(idx, i);
        }

        // Collect sets
        for(let j = 0; j < dim; j++) {
            const u = c[j] as CFUnit;
            if (u >= numUnits ) {
                throw new Error(
                    `Entry ${i}: unit index out of range for numUnits=${numUnits} (unit ${j}: ${u}).`
                );
            }
            units.add(u as CFUnit);
        }

        if (s >= numSeriesIndices) {
            throw new Error(
                `Entry ${i}: s=${s} is out of range for numSeriesIndices=${numSeriesIndices}.`
            );
        }
        series.add(s);
    }

    // 3) Units set must be exactly {0..numUnits-1}
    if (units.size !== numUnits) {
        throw new Error(`Units must be size ${numUnits}; got ${units.size}.`);
    }

    // 4) Series set must be exactly {0..numSeriesIndices-1}
    if (series.size !== numSeriesIndices) {
        throw new Error(`Series indices must be size ${numSeriesIndices}; got ${series.size}.`);
    }
    return true;
}

/**
 * Build a **generic sparse CSR-n** comparison function from arbitrary
 * (u0, u1, ..., u_{dim-1}, s, value) items.
 *
 * Semantics (for dim >= 1):
 * - Let U = numUnits, S = numSeriesIndices.
 * - If dim === 1:
 *    - Rows are keyed by s in [0, S).
 *    - Columns are u0 in [0, U).
 * - If dim >= 2:
 *    - Rows are keyed by (s, u0, ..., u_{dim-2}).
 *      Concretely, rows are flattened as:
 *        rowsPerSeries = U^(dim-1)
 *        rowId = s * rowsPerSeries + (u0 * U^(dim-2) + ... + u_{dim-2})
 *    - Columns are u_{dim-1} in [0, U).
 *
 * - Duplicates: if multiple entries share the same (u*, s) tuple,
 *   the last one in `arr` wins.
 * - Nulls: assumed already rejected by validateNAryCompData.
 * - Output layout mirrors the binary case:
 *   - `eBits`: existence mask; for each row, a row of U bits over the
 *     last unit index (u_{dim-1} if dim > 1, or u0 if dim === 1).
 *   - `rowPtr`: CSR row pointers of length rows + 1.
 *   - `values`: compact array of all non-null values, packed row-major,
 *     ascending column index per row.
 *
 * Complexity:
 * - Let N = arr.length, rows = S * (dim === 1 ? 1 : U^(dim-1)).
 * - Per-row Maps and sorted keys: O(N + Σ k_r log k_r).
 */
export function createNAryCompFunc<Dim extends CFDimSparse>(
    arr: readonly CFCompDataN[] | readonly CFCompData[],
    dim: Dim,
    numUnits: CFUint32,
    numSeriesIndices: CFUint32
): CFCompFuncNAry<Dim> {

    validateNAryCompData(arr, dim, numUnits, numSeriesIndices);

    const comps = arr as ReadonlyArray<CFCompDataN>;
    const U = numUnits;
    const S = numSeriesIndices;

    // Number of rows per series:
    // - dim === 1 -> 1 row per series
    // - dim >= 2 -> U^(dim-1) rows per series, for the prefix (u0,...,u_{dim-2})
    let rowsPerSeries = 1;
    if (dim > 1) {
        for (let i = 1; i < dim; i++) {
            rowsPerSeries *= U;
        }
    }

    const rows = S * rowsPerSeries;
    const eWordsPerRow = Math.ceil(U / 32) as CFUint32;

    // Per-row maps: rowId -> (lastUnit -> V).
    const rowMaps: Map<number, CFIval>[] = new Array(rows);
    for (let r = 0; r < rows; r++) {
        rowMaps[r] = new Map<number, CFIval>();
    }

    // Populate rowMaps with the *last* value for each tuple.
    for (let i = 0; i < comps.length; i++) {
        const c = comps[i];

        // [u0, ..., u_{dim-1}, s, value]
        const s = c[dim] as number;
        const value = c[dim + 1] as unknown as CFIval;

        // Compute rowId and column (last unit index).
        let rowId: number;
        if (dim === 1) {
            // Only (u0, s, value); rows keyed by s.
            rowId = s;
        } else {
            // dim >= 2: rows keyed by (s, u0, ..., u_{dim-2}).
            // uRow = u0 * U^(dim-2) + ... + u_{dim-2}
            let uRow = 0;
            for (let k = 0; k < dim - 1; k++) {
                uRow = uRow * U + (c[k] as number);
            }
            rowId = s * rowsPerSeries + uRow;
        }

        const lastUnit = c[dim - 1] as number; // column index in [0, U)
        rowMaps[rowId].set(lastUnit, value);
    }

    // First pass: build eBits and rowPtr, counting nnz with columns sorted ascending.
    const eBits = new Uint32Array(rows * eWordsPerRow);
    const rowPtr = new Uint32Array(rows + 1);
    let nnz = 0;

    for (let r = 0; r < rows; r++) {
        rowPtr[r] = nnz;

        const m = rowMaps[r];
        if (m.size === 0) continue;

        const cols = Array.from(m.keys()).sort((a, b) => a - b);
        for (let k = 0; k < cols.length; k++) {
            const v = cols[k];
            eBits[r * eWordsPerRow + (v >>> 5)] |= (1 << (v & 31));
        }
        nnz += cols.length;
    }
    rowPtr[rows] = nnz;

    // Second pass: pack values in the same order (row-major, ascending column per row).
    const values: CFIval[] = new Array(nnz);
    for (let r = 0; r < rows; r++) {
        const m = rowMaps[r];
        if (m.size === 0) continue;

        const start = rowPtr[r];
        const cols = Array.from(m.keys()).sort((a, b) => a - b);
        for (let k = 0; k < cols.length; k++) {
            const v = cols[k];
            values[start + k] = m.get(v)!;
        }
    }

    const pows = generatePowerArray(dim, U);
    if(pows === undefined) {
        throw new Error('createBinaryCompFunc: failed to generate array of powers for indexing, overflow.');
    }
    return new CFCompFuncNAryImpl(dim, U, S, values, { eBits, eWordsPerRow, rowPtr }, pows);
}

export class CFCompFuncNAryImpl<Dim extends CFDimSparse> extends CFFuncSparseImpl<Dim>
        implements CFCompFuncNAry<Dim>
{
    constructor(
        dim: Dim,
        U: CFUint32,
        S: CFUint32,
        values: CFIval[],
        bitset: CFBitSet,
        pows: Uint32Array
    ) {
        super(dim, U, S, values, bitset, pows);
    }
}

export function createTernaryCompFunc(
    arr: CFCompDataN[],
    numUnits: CFUint32,
    numSeriesIndices: CFUint32
): CFCompFuncTernary {

    return createNAryCompFunc(
        arr,
        3 as CFUint32Three,
        numUnits,
        numSeriesIndices
    );
}

export class CFCompFuncTernaryImpl extends CFFuncSparseImpl<CFUint32Three> implements CFCompFuncTernary {

    constructor(
        U: CFUint32,
        S: CFUint32,
        values: CFIval[],
        bitset: CFBitSet,
        pows: Uint32Array
    ) {
        super(3 as CFUint32Three, U, S, values, bitset, pows);
    }

    get = (u: number, v: number, w: number, s: number): CFIval | undefined => {
        if(!this.isValidUnit(u) || !this.isValidUnit(v) || !this.isValidUnit(w) || !this.isValidSeriesIndex(s)) {
            return undefined;
        }
        return this.getUnsafe(u, v, w, s);
    }

    getUnsafe = (u: CFUnit, v: CFUnit, w: CFUnit, s: CFSeriesIndex): CFIval => {
        const pows = this.pows;
        const rowIdx = s*pows[2] + u*pows[1] + v as CFUint32;
        return getValueBitset(this.bitset, this.values, w, rowIdx);
    }

    E = (u: number, v: number, w: number, s: number): boolean => {
        const pows = this.pows;
        const rowIdx = s*pows[2] + u*pows[1] + v as CFUint32;
        const row = rowIdx*this.bitset.eWordsPerRow;
        const word = w >>> 5;
        const bit = 1 << (w & 31);
        return (this.bitset.eBits[row + word] & bit) !== 0;
    }
}
