import {
    CFBitSet,
    CFDimSparse,
    CFFuncSparse,
    CFInt32,
    CFReal,
    CFSeriesIndex,
    CFUint32, CFUint32Two,
    CFUnit,
    isReal
} from "./types";
import {MAX_UINT32} from "./math_utils";
import {ALGEBRA_IVAL, CFIval} from "./value_types/ival";
import {ReadonlyUint32Array} from "./readonly_u32array";

export interface BitSetReader {
    /** Index of the current 1-bit, or -1 if not positioned, or bitLen if exhausted */
    pos: number;

    /** Advance to the next 1-bit strictly after current pos. Returns true if found. */
    next(): boolean;

    /** Set the current position. next() will search from pos + 1. */
    seek(target: number): void;
}

export class BitSetReaderImpl implements BitSetReader {
    pos: CFInt32 = -1 as CFInt32;
    private readonly bitLen: CFUint32;

    constructor(private readonly bits: Uint32Array) {
        this.bitLen = bits.length << 5 as CFUint32; // bits.length * 32
    }

    next(): boolean {
        const nWords = this.bits.length as CFUint32;
        let scanPos = this.pos + 1 as CFUint32;

        while (scanPos < this.bitLen) {
            const wordIndex = scanPos >>> 5 as CFUint32;
            if (wordIndex >= nWords) {
                this.pos = this.bitLen as number as CFInt32;
                return false;
            }

            // Mask out bits below scanPos in this word
            const bitOffset = scanPos & 31 as CFUint32;
            let word = this.bits[wordIndex] as CFUint32;
            if (bitOffset !== 0) {
                const maskBelow = ((1 << bitOffset) - 1) >>> 0 as CFUint32;
                word = (word & ~maskBelow) as CFUint32;
            }

            if (word === 0) {
                // Skip to the start of the next word
                scanPos = (wordIndex + 1) << 5 as CFUint32;
                continue;
            }

            // Isolate least-significant 1-bit and get its bit index
            const lsb = word & -word as CFUint32;
            const offset = 31 - Math.clz32(lsb) as CFUint32; // ctz via clz
            this.pos = ((wordIndex << 5) + offset) as CFInt32;
            return true;
        }

        this.pos = this.bitLen as number as CFInt32;
        return false;
    }

    seek(target: CFInt32): void {
        if (target < -1) {
            this.pos = -1 as CFInt32;
        } else if (target > this.bitLen) {
            this.pos = this.bitLen as number as CFInt32;
        } else {
            this.pos = target;
        }
    }
}

/**
 * Helper: advance reader and return index of next 1-bit,
 * or +Infinity if there is none.
 *
 * NOTE: reader.pos is the index of the bit we just found.
 */
function nextIndex(r: BitSetReader): number {
    return r.next() ? r.pos : Number.POSITIVE_INFINITY;
}

/**
 * Scan positions where either bitset has a 1 (A OR B).
 * Calls `visit(index, hasA, hasB)` for each such position.
 */
export function bitsetScanOr(
    readerA: BitSetReader,
    readerB: BitSetReader,
    visit: (index: CFUint32, hasA: boolean, hasB: boolean) => boolean
): boolean {
    let iA = nextIndex(readerA);
    let iB = nextIndex(readerB);

    const INF = Number.POSITIVE_INFINITY;

    while (iA !== INF || iB !== INF) {
        const index = Math.min(iA, iB) as CFUint32;

        const hasA = iA === index;
        const hasB = iB === index;

        // At least one side must have a 1 here
        if(!visit(index, hasA, hasB)) return false;

        if (hasA) iA = nextIndex(readerA);
        if (hasB) iB = nextIndex(readerB);
    }
    return true;
}

/**
 * Scan positions where both bitsets have a 1 (A AND B).
 * Calls `visit(index)` for each common 1-bit.
 */
export function bitsetScanAnd(
    readerA: BitSetReader,
    readerB: BitSetReader,
    visit: (index: CFUint32) => boolean
): boolean {
    let iA = nextIndex(readerA);
    let iB = nextIndex(readerB);

    const INF = Number.POSITIVE_INFINITY;

    while (iA !== INF && iB !== INF) {
        if (iA === iB) {
            // Common 1-bit
            if(!visit(iA as CFUint32)) return false;

            iA = nextIndex(readerA);
            iB = nextIndex(readerB);
        } else if (iA < iB) {
            // A is behind; advance A to catch up
            iA = nextIndex(readerA);
        } else {
            // B is behind; advance B to catch up
            iB = nextIndex(readerB);
        }
    }
    return true;
}

/** Bit range [start, end) for a given row. */
function rowBitBounds(row: number, eWordsPerRow: number) {
    const start = row * eWordsPerRow * 32;
    const end   = start + eWordsPerRow * 32;
    return { start, end };
}

/**
 * Create a row-local iterator for set-bit unit positions in [0, NU).
 * It uses BitSetReader to walk only this row’s range.
 *
 * Usage:
 *   const it = rowSetIterator(reader, row, eWordsPerRow, NU);
 *   let u = it.next(); while (u !== INF) { ...; u = it.next(); }
 */
export function rowSetIterator(
    reader: BitSetReaderImpl,
    row: CFUint32,
    eWordsPerRow: CFUint32,
    NU: CFUint32
) {
    const { start, end } = rowBitBounds(row, eWordsPerRow);
    // position reader just before the row so next() lands in this row
    reader.seek((start - 1) as CFInt32);

    let nextIdx: number | undefined;
    const INF = Number.POSITIVE_INFINITY;

    const advance = () => {
        if (!reader.next()) { nextIdx = INF; return; }
        const idx = reader.pos as number;                   // absolute bit index
        if (idx >= end) { nextIdx = INF; return; }
        const local = idx - start;                  // row-local [0 .. eWords*32)
        // skip tail bits >= NU
        nextIdx = local < NU ? local : advanceAndReturn();
    };

    const advanceAndReturn = (): number => { advance(); return nextIdx!; };

    // prime the iterator
    advance();

    return {
        /** next logical unit position uLast in [0, NU), or +Infinity if none */
        next(): number { const out = nextIdx!; advance(); return out; },
        INF,
    };
}

/**
 * popcount of a 32-bit integer.
 * https://graphics.stanford.edu/~seander/bithacks.html#CountBitsSetParallel
 */
export function popcnt32(x: CFUint32): CFUint32 {

    let y: number = x >>> 0;

    y = (y - ((y >>> 1) & 0x55555555)) >>> 0;
    y = ((y & 0x33333333) + ((y >>> 2) & 0x33333333)) >>> 0;
    y = ((y + (y >>> 4)) & 0x0F0F0F0F) >>> 0;

    return (Math.imul(y, 0x01010101) >>> 24) as CFUint32;
}

/** Count trailing zeros in a nonzero 32-bit word. (0..31). */
export function ctz32(x: CFUint32): number {
    // index of bit = 31 - clz32(x).
    return 31 - Math.clz32(x);
}

/**
 * Computes the rank (number of set bits) in a row up to a specified column.
 * Unsafe, internal - no bounds checks on eBits.
 *
 * @param {Uint32Array} eBits - The bit array representing the data.
 * @param {CFUint32} rowWordBase - The base index of the row in the bit array.
 * @param {CFUint32} col - The column index up to which the rank is calculated (0..col-1)
 * @return {CFUint32} The number of set bits from the beginning of the row to the specified column.
 */
export function rankInRow(eBits: ReadonlyUint32Array, rowWordBase: CFUint32, col: CFUint32): CFUint32 {
    if (col === 0) return 0 as CFUint32;

    const w = col >>> 5;   // number of full words
    const b = col & 31;    // bits in tail of last word

    // popcount of full words before w
    let r = 0 as CFUint32;
    for (let i = 0; i < w; i++) {
        r = r + popcnt32(eBits[rowWordBase + i] as CFUint32) as CFUint32;
    }

    // on word boundary, we're done (no extra access)
    if (b === 0) return r;

    const word = eBits[rowWordBase + w];
    const mask = MAX_UINT32 >>> (32 - b); // b != 0 here
    return r + popcnt32((word & mask) as CFUint32) as CFUint32;
}

// Test if bit `v` is set in row `u` for series index `s`.
// Unsafe, internal - no bounds checks on s or u.
export function bitTestRow(c: CFFuncSparse<CFUint32Two>, u: CFUnit, v: CFUnit, s: CFSeriesIndex): boolean {
    // The base is ensured to not overflow when u and s are valid for c.
    const base = (s * c.NU + u) * c.bitset.eWordsPerRow;
    return ((c.bitset.eBits[base + (v >>> 5)] >>> (v & 31)) & 1) !== 0;
}


// Build a bitmask for 'units'
export function buildSubsetMask<V>(eWordsPerRow: CFUint32, units: CFUint32[]) {
    const mask = new Uint32Array(eWordsPerRow);
    for (const v of units) {
        mask[v >>> 5] |= (1 << (v & 31));
    }
    return mask;
}

// Build a bitmask with bits 0..numUnits-1 set
export function buildFullMask<V>(eWordsPerRow: CFUint32, numUnits: CFUint32): Uint32Array {
    const m = new Uint32Array(eWordsPerRow);
    // set full 32-bit words
    let full = (numUnits / 32) | 0;
    for (let w = 0; w < full; w++) m[w] = MAX_UINT32;
    // set tail bits if any
    const tail = numUnits & 31;
    if (tail) m[full] = (1 << tail) - 1;
    return m;
}

/**
 * Checks if all elements in the given Uint32Array are zero.
 *
 * @param {Uint32Array} A - The array of unsigned 32-bit integers to be checked.
 * @return {boolean} Returns true if all elements in the array are zero; otherwise, returns false.
 */
export function isZeroWords(A: Uint32Array): boolean {
    for (let i = 0; i < A.length; i++) if (A[i] !== 0) return false;
    return true;
}

/**
 * Performs a logical AND operation between a specified row (determined by unit and series index)
 * and a subset represented by a mask, storing the result into the output array.
 *
 * @param {CFFuncSparse} c - The function.
 * @param {CFUnit} u - The unit index specifying the row to operate on.
 * @param {CFSeriesIndex} s - The series index specifying the row to operate on.
 * @param {Uint32Array} subsetMask - The bitmask array representing the subset to AND the row with.
 * @param {Uint32Array} out - The array where the resulting AND operation will be stored.
 * @return {void} Does not return a value. The result is stored in the `out` parameter.
 */
export function andRowWithSubsetInto(
    c: CFFuncSparse<CFDimSparse>,
    u: CFUnit,
    s: CFSeriesIndex,
    subsetMask: Uint32Array,
    out: Uint32Array
): void {
    const eWordsPerRow = c.bitset.eWordsPerRow;
    const eBits = c.bitset.eBits;

    // Get position 0 for the row.
    const base = (s*c.NU + u)*eWordsPerRow;
    for (let w = 0; w < eWordsPerRow; w++) {
        out[w] = eBits[base + w] & subsetMask[w];
    }
}

// Check if A is a subset of B in terms of set bits.
export function isSubsetWords(A: Uint32Array, B: Uint32Array): boolean {
    // return A ⊆ B
    for (let w = 0; w < A.length; w++) {
        // x & ~y will be true if x has a set bit that is not set in y,
        // so in math terms, 'b' in A, but 'b' not in B. If this never
        // happens, then all bits set in A (if any) are also set in B.
        if ((A[w] & ~B[w]) !== 0) return false;
    }
    return true;
}

/**
 * Checks whether a condition holds true for a subset defined by a bitset, using provided parameters.
 *
 * @param {CFFuncSparse} c - A function.
 * @param {CFSeriesIndex} s - The series index.
 * @param {Uint32Array} bitset - A bitset where the set bits represent candidate values to evaluate.
 * @param {Uint32Array} subsetMask - A mask used to apply constraints to rows during the check.
 * @param {Uint32Array} lhsRow - The "U row" that has already been computed for comparison.
 * @param {Uint32Array} scratch - A temporary array used as the "V row" during calculations.
 * @return {boolean} Returns true if the condition holds for the subset, otherwise false.
 */
export function checkSubsetForBitset(
    c: CFFuncSparse<CFDimSparse>,
    s: CFSeriesIndex,
    bitset: Uint32Array,         // the set bits represent candidate v’s
    subsetMask: Uint32Array,     // mask to apply to rows
    lhsRow: Uint32Array,         // “U row” (already computed)
    scratch: Uint32Array,        // temp for “V row”
): boolean {
    for (let w = 0; w < bitset.length; w++) {
        let word = bitset[w];
        while (word !== 0) {
            const t = word & -word;
            const b = Math.clz32(t) ^ 31;       // 0..31
            const v = ((w << 5) | b) as CFUnit; // treat bit index as unit id
            andRowWithSubsetInto(c, v, s, subsetMask, scratch);
            if (!isSubsetWords(scratch, lhsRow)) return false;
            word ^= t;
        }
    }
    return true;
}

/** Get the value for unit 'u' with flattened base position 'rowIdx' for the bitset.
 * Bit = 0 returns null.
 *
 * Internal, unsafe (assumes all inputs are good)
 *
 *  For a tuple (u0, u1, ..., um, s), linearize for (s, u1, u2, ..., u(m - 1)) and pass um as 'u'.
 */
export function getValueBitset(
    bs: CFBitSet,
    values: readonly CFIval[],
    u: CFUnit,
    rowIdx: CFUint32
): CFIval {
    const rowBase = rowIdx * bs.eWordsPerRow;
    const word = bs.eBits[rowBase + (u >>> 5)];
    if ((word & (1 << (u & 31))) === 0) return ALGEBRA_IVAL.null();

    // rank within row → compact index
    const rank = rankInRow(bs.eBits, rowBase as CFUint32, u);
    const idx = bs.rowPtr[rowIdx] + rank;
    return values[idx];
}

export function bitsetEquals_s<Dim extends CFDimSparse>(
    fu: CFFuncSparse<Dim>,
    fv: CFFuncSparse<Dim>,
    s: CFSeriesIndex
): boolean {
    if(fu.dim !== fv.dim) return false;
    const pows = fu.pows;
    const W = fu.bitset.eWordsPerRow;
    const baseRow = s*pows[fu.dim]*W;
    const rowEnd = (s + 1)*pows[fu.dim]*W;
    const eBU = fu.bitset.eBits;
    const eBV = fv.bitset.eBits;

    for(let w = baseRow; w < rowEnd; w++) {
        if(eBU[w] !== eBV[w]) return false;
    }
    return true;
}

export function bitsetEquals<Dim extends CFDimSparse>(
    fu: CFFuncSparse<Dim>,
    fv: CFFuncSparse<Dim>,
    onlyBitVals: boolean = true,
): boolean {
    if(fu.dim !== fv.dim) return false;

    if(!onlyBitVals) {
        // eWordsPerRow and rowPtr for sanity.
        if (fu.bitset.eWordsPerRow !== fv.bitset.eWordsPerRow) return false;
        const rowPtrU = fu.bitset.rowPtr;
        const rowPtrV = fv.bitset.rowPtr;
        if (rowPtrU.length !== rowPtrV.length) return false;
        for(let w = 0; w < rowPtrU.length; w++) {
            if(rowPtrU[w] !== rowPtrV[w]) return false;
        }
    }

    // Bitset values.
    const eBU = fu.bitset.eBits;
    const eBV = fv.bitset.eBits;
    for(let w = 0; w < eBU.length; w++) {
        if(eBU[w] !== eBV[w]) return false;
    }
    return true;
}

export function jaccard_s<Dim extends CFDimSparse>(
    fu: CFFuncSparse<Dim>,
    fv: CFFuncSparse<Dim>,
    s: CFSeriesIndex
): CFReal | undefined {
    if (fu.dim !== fv.dim) return undefined;
    const pows = fu.pows;
    const W = fu.bitset.eWordsPerRow;
    const baseRow = s*pows[fu.dim]*W;
    const rowEnd = s*pows[fu.dim + 1]*W;
    const bsU = fu.bitset;
    const bsV = fv.bitset;

    let countI = 0;
    let countU = 0;

    for(let w = baseRow; w < rowEnd; w++) {
        const wu = bsU.eBits[w] >>> 0;
        const wv = bsV.eBits[w] >>> 0;
        const and = wu & wv;
        const or = wu | wv;
        countI += popcnt32(and as CFUint32);
        countU += popcnt32(or as CFUint32);
    }

    const jacc = countI / countU;
    return isReal(jacc) ? jacc : undefined;
}

export function jaccard<Dim extends CFDimSparse>(
    fu: CFFuncSparse<Dim>,
    fv: CFFuncSparse<Dim>
): CFReal | undefined {
    if (fu.dim !== fv.dim) return undefined;
    const bsU = fu.bitset;
    const bsV = fv.bitset;

    let countI = 0;
    let countU = 0;

    // U^dim * S * eWordsPerRow
    const rowEnd = fu.pows[fu.dim]*fu.NS*fu.bitset.eWordsPerRow;
    for(let w = 0; w < rowEnd; w++) {
        const wu = bsU.eBits[w] >>> 0;
        const wv = bsV.eBits[w] >>> 0;
        const and = wu & wv;
        const or = wu | wv;
        countI += popcnt32(and as CFUint32);
        countU += popcnt32(or as CFUint32);
    }

    const jacc = countI / countU;
    return isReal(jacc) ? jacc : undefined;
}

