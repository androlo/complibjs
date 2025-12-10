// @ts-nocheck
/* eslint-disable */
import {
    CFArithOp,
    CFBinOpType,
    CFBitSet,
    CFDim,
    CFDimSparse,
    CFInt32,
    CFReal,
    CFUint32,
    CFUnitFunc,
    CFUnitFuncConst,
    CFUnitFuncDense,
    CFUnitFuncLeaf,
    CFUnitFuncSparse,
    CFPowOp,
    CFStorageTag,
    toReal,
    Add
} from "./types";

import {ALGEBRA_IVAL, CFIval} from "./value_types/ival";

import {BitSetReaderImpl, bitsetScanOr} from "./bit_utils";

import {
    CFUnitFuncConstImpl,
    CFUnitFuncDenseImpl,
    CFUnitFuncSparseImpl,
    createConstUnitFunc,
    createNullUnitFunc
} from "./ufunc";

import {generatePowerArray, MAX_UINT32_BIGINT} from "./math_utils";
import { A } from "vitest/dist/chunks/worker.d.BFk-vvBU";

/********************* Helpers *********************/

export function getBinOp(arithOp: CFArithOp): (a: CFIval, b: CFIval) => CFIval {
    switch (arithOp) {
        case CFArithOp.Add: return (a: CFIval, b: CFIval) => ALGEBRA_IVAL.add(a, b);
        case CFArithOp.Sub: return (a: CFIval, b: CFIval) => ALGEBRA_IVAL.sub(a, b);
        case CFArithOp.Mul: return (a: CFIval, b: CFIval) => ALGEBRA_IVAL.mul(a, b);
        case CFArithOp.Div: return (a: CFIval, b: CFIval) => ALGEBRA_IVAL.div(a, b);
    }
}

export function getPowOp(opType: CFPowOp) {
    switch (opType) {
        case CFPowOp.Int: return (b: CFIval, e: number) => ALGEBRA_IVAL.powInt(b, e as CFInt32);
        case CFPowOp.Real: return (b: CFIval, e: number) => ALGEBRA_IVAL.pow(b, e as CFReal);
        case CFPowOp.NthRoot: return (b: CFIval, e: number) => ALGEBRA_IVAL.nthRoot(b, e as CFUint32);
    }
}

// Density of a SPARSE unit function: 1 - nnz / (NS * U^dim)
export function measureDensitySparse<Dim extends CFDimSparse>(
    fs: CFUnitFuncSparse<Dim>
): CFReal | undefined {
    const dim = fs.dim;

    // TODO look at check for overflow in sparse - should be ok.
    const total = fs.NS * fs.pows[dim]; // S * U^dim (U^(dim - 1)*U)

    // nnz is last entry of CSR rowPtr
    const rowPtr = fs.bitset.rowPtr;
    const nnz = rowPtr.at(-1); // CSR invariant

    let density = toReal(nnz / total);
    if (density === null) return undefined;
    if (density < 0) density = 0 as CFReal;
    if (density > 1) density = 1 as CFReal;
    return density;
}

// Density of a CONST unit function:
// - if value is null → density = 0
// - else → density = 1
export function measureDensityConst<Dim extends CFDim>(
    fu: CFUnitFuncConst<Dim>
): CFReal {
    return ALGEBRA_IVAL.isNull(fu.value) ? 0 as CFReal : 1 as CFReal;
}

// Density of a DENSE unit function: nnz / total
export function measureDensityDense<Dim extends CFDim>(
    fd: CFUnitFuncDense<Dim>
): CFReal | undefined {
    const total = fd.values.length;              // should be NS * U^dim

    let nnz = 0;
    const vals = fd.values;
    for (let i = 0; i < total; i++) {
        if (!ALGEBRA_IVAL.isNull(vals[i])) nnz++;
    }
    let density = toReal(nnz / total);
    if (density === null) return undefined;
    if (density < 0) density = 0 as CFReal;
    if (density > 1) density = 1 as CFReal;
    return density;
}

/**
 * Measure the density of a unit function. Returns undefined for anything
 * other than const, dense, or sparse.
 *
 * Density is the ratio of non-zero values to the total number of values.
 *
 */
export function measureDensity<Dim extends CFDim>(
    fu: CFUnitFunc<Dim>
): CFReal | undefined {
    if (fu.storage === CFStorageTag.Const) return measureDensityConst(fu);
    if (fu.storage === CFStorageTag.Dense) return measureDensityDense(fu);
    if (fu.storage === CFStorageTag.Sparse) return measureDensitySparse(fu);
    return undefined;
}

/********************* Conversion *********************/

// Dense -> Sparse (0 dim not allowed)
export function denseToSparse<Dim extends CFDimSparse>(
    fd: CFUnitFuncDense<Dim>
): CFUnitFuncSparse<Dim> | undefined {

    const NU = fd.NU;
    const NS = fd.NS;
    const dim = fd.dim;

    // pows[k] = U^k (k = 0..dim)
    const pows = generatePowerArray(dim + 1 as CFUint32, NU);
    if (!pows) return undefined;

    const rowsPerFrame = pows[dim - 1];   // U^(dim-1)
    const frameSize    = pows[dim];       // U^dim
    const wordsPerRow  = Math.ceil(NU / 32) as CFUint32;

    const totalRows = NS * rowsPerFrame;
    const bigTotalWords = BigInt(totalRows) * BigInt(wordsPerRow);
    if (bigTotalWords > MAX_UINT32_BIGINT) return undefined;

    const dVals = fd.values;

    // --- First pass: count nnz to size values array --------------------------
    let totalNNZ = 0;
    for (let s = 0; s < NS; s++) {
        const base = s * frameSize;
        for (let rl = 0; rl < rowsPerFrame; rl++) {
            const rowBase = base + rl * NU;
            for (let k = 0; k < NU; k++) {
                const v = dVals[rowBase + k];
                if (!ALGEBRA_IVAL.isNull(v)) totalNNZ++;
            }
        }
    }

    // --- Allocate outputs -----------------------------------------------------
    const eBits   = new Uint32Array(totalRows * wordsPerRow); // zero-init
    const rowPtr  = new Uint32Array(totalRows + 1);
    const values  = new Array<CFIval>(totalNNZ);

    // --- Second pass: fill CSR + bits + values -------------------------------
    let outRow = 0;
    let outValPtr = 0;

    for (let s = 0; s < NS; s++) {
        const base = s * frameSize;

        for (let rl = 0; rl < rowsPerFrame; rl++) {
            const rowBase = base + rl * NU;
            const bitOff  = outRow * wordsPerRow;

            for (let k = 0; k < NU; k++) {
                const v = dVals[rowBase + k];
                if (!ALGEBRA_IVAL.isNull(v)) {
                    // set bit
                    const w = (k >>> 5) | 0;           // k / 32
                    const b = k & 31;                  // k % 32
                    eBits[bitOff + w] |= (1 << b) >>> 0;

                    // push value (row-major CSR order)
                    values[outValPtr++] = v;
                }
            }

            rowPtr[outRow + 1] = outValPtr;
            outRow++;
        }
    }

    const bitset = { eBits, eWordsPerRow: wordsPerRow, rowPtr };
    const newPows = generatePowerArray(dim + 1 as CFUint32, NU)!;

    return new CFUnitFuncSparseImpl(
        dim as Dim,
        NU,
        NS,
        values,
        bitset,
        newPows
    );
}

// Sparse -> Dense
export function sparseToDense<Dim extends CFDimSparse>(
    fs: CFUnitFuncSparse<Dim>
): CFUnitFuncDense<Dim> | undefined {

    const NU = fs.NU;
    const NS = fs.NS;
    const dim = fs.dim;

    // pows[k] = U^k (k = 0..dim)
    const pows = generatePowerArray(dim + 1 as CFUint32, NU);
    if (!pows) return undefined;

    const rowsPerFrame = pows[dim - 1];  // U^(dim-1)  (requires dim >= 1)
    const frameSize    = pows[dim];      // U^dim
    const totalSize    = NS * frameSize;

    // --- Allocate dense and fill with nulls ----------------------------------
    const values = new Array<CFIval>(totalSize);
    const nullV = ALGEBRA_IVAL.null();
    for (let i = 0; i < totalSize; i++) values[i] = nullV;

    // --- Local sparse views ---------------------------------------------------
    const sVals       = fs.values;
    const sRowPtr     = fs.bitset.rowPtr;
    const sBits       = fs.bitset.eBits;
    const wordsPerRow = fs.bitset.eWordsPerRow;

    // --- Expand ---------------------------------------------------------------
    for (let s = 0; s < NS; s++) {
        const baseDense = s * frameSize;
        const baseRows  = s * rowsPerFrame;

        for (let rl = 0; rl < rowsPerFrame; rl++) {
            const row = baseRows + rl;

            let vp = sRowPtr[row];                 // pointer into sVals
            const bitOff = row * wordsPerRow;
            const denseRowBase = baseDense + rl * NU;

            let k = 0;
            for (let w = 0; w < wordsPerRow; w++) {
                let word = sBits[bitOff + w];

                for (let b = 0; b < 32 && k < NU; b++, k++) {
                    if ((word & 1) !== 0) {
                        values[denseRowBase + k] = sVals[vp++];
                    }
                    word >>>= 1;
                }
            }
        }
    }

    const newPows = generatePowerArray(dim + 1 as CFUint32, NU)!;

    return new CFUnitFuncDenseImpl(
        dim as Dim,
        NU,
        NS,
        values,
        newPows
    );
}


/********************* Helpers *********************/

function rowBitBounds(row: number, eWordsPerRow: number) {
    const start = row * eWordsPerRow * 32;
    const end   = start + eWordsPerRow * 32;
    return { start, end };
}

/** Iterate set unit positions uLast in [0, NU) for a given row using BitSetReaderImpl. */
function rowSetIterator(
    reader: BitSetReaderImpl,
    row: number,
    eWordsPerRow: number,
    NU: number
) {
    const { start, end } = rowBitBounds(row, eWordsPerRow);
    reader.seek((start - 1) as CFInt32); // prime just before row so next() enters this row

    const INF = Number.POSITIVE_INFINITY;

    const advanceOnce = (): number => {
        if (!reader.next()) return INF;
        const idx = reader.pos as number;
        if (idx >= end) return INF;
        const local = idx - start;
        return local < NU ? local : INF; // ignore tail bits >= NU
    };

    let nextLocal = advanceOnce();

    return {
        next(): number {
            const out = nextLocal;
            if (out === INF) return out;
            nextLocal = advanceOnce();
            return out;
        },
        INF,
    };
}

/********************* Tensor Operations *********************/

// TODO should never be called.
export function materializeTensorConstConst(
    fu: CFUnitFuncConst<CFDim>,
    fv: CFUnitFuncConst<CFDim>
): CFUnitFuncLeaf<CFDim> | undefined {
    return new CFUnitFuncConstImpl(newDim, fu.NU, fv.NS, ALGEBRA_IVAL.mul(fu.value, fv.value));
}

/********************* Tensor: sparse ⊗ const ************************/

/**
 * Left is sparse (dimS ≥ 1), right is const (dimC ≥ 0).
 *
 * If dimC == 0 → error (should never happen).
 * If dimC > 0 → the last unit of the RESULT is the right's last unit.
 *               Each left row expands to NU * U^(dimC-1) rows where each nonzero
 *               left entry produces a full-bit row with NU repeated values scaled
 *               by the constant.
 */
export function materializeTensorSparseConst(
    fs: CFUnitFuncSparse<CFDimSparse>,   // left: sparse
    fc: CFUnitFuncConst<CFDim>,  // right: const (dimC can be 0)
): CFUnitFuncSparse<CFDimSparse> | undefined {
    // TODO use helpers to read bitsets

    const dimS = fs.dim as number; // ≥ 1
    const dimC = fc.dim as number; // ≥ 0
    const NU   = fs.NU;
    const NS   = fs.NS;

    // Special case: dimC == 0 → should not happen.
    if (dimC === 0) {
        throw new Error('materializeSparseConst: dim of const == 0');
    }

    // New dimension and powers
    const newDim = (dimS + dimC) as CFDim;
    const newPows = generatePowerArray((newDim + 1) as CFUint32, NU);
    if (!newPows) return undefined;

    // Row accounting
    const rowsL = fs.bitset.rowPtr.length - 1;        // = U^(dimS-1) * S
    const rowsConstPrefix = newPows[dimC - 1];        // = U^(dimC-1)
    const newRows = rowsL * NU * rowsConstPrefix;     // = S*U^(dimS-1) * NU * U^(dimC-1) = S*U^(newDim-1)

    const wordsPerRow = fs.bitset.eWordsPerRow;

    // Capacity guard
    const bigTotalWords = BigInt(newRows) * BigInt(wordsPerRow);
    if (bigTotalWords > MAX_UINT32_BIGINT) return undefined;

    // Allocate output
    const newBits   = new Uint32Array(newRows * wordsPerRow);
    const newRowPtr = new Uint32Array(newRows + 1);
    const newValues: CFIval[] = [];

    // Precompute a row of "full ones" (only first NU bits set)
    const fullRowBits = new Uint32Array(wordsPerRow);
    if (wordsPerRow > 0) {
        for (let w = 0; w < wordsPerRow - 1; w++) fullRowBits[w] = 0xFFFFFFFF >>> 0;
        // last word: set the first NU % 32 bits (for NU = 0 this is 32).
        const rem = NU & 31;
        fullRowBits[wordsPerRow - 1] = (rem === 0) ? 0xFFFFFFFF >>> 0 : ((1 << rem) - 1) >>> 0;
    }

    // Readers & aliases
    const reader = new BitSetReaderImpl(fs.bitset.eBits);
    const rowPtrL = fs.bitset.rowPtr;
    const valsL   = fs.values;
    const cVal    = fc.value;

    // Expand each left row → NU * rowsConstPrefix rows
    let outRow = 0;
    for (let rowL = 0; rowL < rowsL; rowL++) {
        // start/end index into left values for this row
        let vp = rowPtrL[rowL];
        const vpEnd = rowPtrL[rowL + 1];

        // iterator for set unit positions in this row
        const it = rowSetIterator(reader, rowL, wordsPerRow, NU);
        let nextSet = it.next(); // uLast where left is set, or INF

        for (let k = 0; k < NU; k++) {
            const hasVal = (nextSet === k);
            // only read left value when bit is set
            const leftVal = hasVal ? valsL[vp++]! : undefined;

            // For each right-prefix row slot, output a row
            for (let rr = 0; rr < rowsConstPrefix; rr++) {
                newRowPtr[outRow] = newValues.length; // begin this row

                if (hasVal) {
                    const vScaled = ALGEBRA_IVAL.mul(cVal, leftVal!);
                    if (!ALGEBRA_IVAL.isNull(vScaled)) {
                        const dstOff = outRow * wordsPerRow;
                        newBits.set(fullRowBits, dstOff);
                        // push NU copies in order 0..NU-1
                        for (let j = 0; j < NU; j++) newValues.push(vScaled);
                    }
                }
                outRow++;
            }

            if (hasVal) {
                nextSet = it.next();
            }
        }

        // sanity: consumed exactly the row's nnz
        if (vp !== vpEnd) throw new Error('row nnz mismatch');
    }

    // terminal pointer
    newRowPtr[newRows] = newValues.length;

    const newBitSet: CFBitSet = {
        eBits: newBits,
        eWordsPerRow: wordsPerRow,
        rowPtr: newRowPtr,
    };

    return new CFUnitFuncSparseImpl(
        newDim as CFDimSparse,
        NU,
        NS,
        newValues,
        newBitSet,
        newPows
    );
}

export function materializeTensorConstSparse(
    fc: CFUnitFuncConst<CFDim>,     // left: const (dimC ≥ 0)
    fs: CFUnitFuncSparse<CFDimSparse>,      // right: sparse (dimS ≥ 1)
): CFUnitFuncSparse<CFDimSparse> | undefined {

    const dimC = fc.dim as number; // ≥ 0
    const dimS = fs.dim as number; // ≥ 1
    const NU   = fs.NU;
    const NS   = fs.NS;

    // Special case: dimC == 0 → scalar multiplication, same shape as fs.
    if (dimC === 0) {
        throw new Error('materializeConstSparse: dim of const == 0');
    }

    // New dimension and powers for the result
    const newDim = (dimC + dimS) as CFDim;
    const newPows = generatePowerArray((newDim + 1) as CFUint32, NU);
    if (!newPows) return undefined;

    // Right sparse geometry
    const rowsR = fs.bitset.rowPtr.length - 1; // = U^(dimS-1) * S
    const wordsPerRow = fs.bitset.eWordsPerRow;

    // How many rows each right row expands into: U^dimC
    const expandFactor = newPows[dimC];        // = U^dimC
    const newRows = rowsR * expandFactor;      // = S*U^(dimS-1) * U^dimC = S*U^(newDim-1)

    // Capacity guard
    const bigTotalWords = BigInt(newRows) * BigInt(wordsPerRow);
    if (bigTotalWords > MAX_UINT32_BIGINT) return undefined;

    // Output allocations
    const newBits   = new Uint32Array(newRows * wordsPerRow);
    const newRowPtr = new Uint32Array(newRows + 1);
    const newValues: CFIval[] = [];

    // Set up to scan right bitset row-by-row
    const reader = new BitSetReaderImpl(fs.bitset.eBits);
    const rowPtrR = fs.bitset.rowPtr;
    const valsR   = fs.values;
    const cVal    = fc.value;

    // Process each right row, then replicate it expandFactor times
    let outRow = 0;
    for (let rowR = 0; rowR < rowsR; rowR++) {
        // Gather this row's (filtered) bits and scaled values first
        const rowBits = new Uint32Array(wordsPerRow);
        const rowVals: CFIval[] = [];

        let vp = rowPtrR[rowR]; // consume right values as we visit set bits
        const it = rowSetIterator(reader, rowR, wordsPerRow, NU);
        for (let u = it.next(); u !== it.INF; u = it.next()) {
            const vR = valsR[vp++]!;
            const vScaled = ALGEBRA_IVAL.mul(cVal, vR);
            if (!ALGEBRA_IVAL.isNull(vScaled)) {
                const wordIndex = (u >>> 5);
                const bitMask   = (1 << (u & 31)) >>> 0;
                rowBits[wordIndex] |= bitMask;
                rowVals.push(vScaled);
            }
        }

        // Now replicate this row expandFactor times
        for (let t = 0; t < expandFactor; t++) {
            newRowPtr[outRow] = newValues.length;
            if (rowVals.length > 0) {
                newBits.set(rowBits, outRow * wordsPerRow);
                // Append values in the same per-row order
                for (let i = 0; i < rowVals.length; i++) {
                    newValues.push(rowVals[i]!);
                }
            }
            outRow++;
        }
    }

    // terminal pointer
    newRowPtr[newRows] = newValues.length;

    const newBitSet: CFBitSet = {
        eBits: newBits,
        eWordsPerRow: wordsPerRow,
        rowPtr: newRowPtr,
    };

    return new CFUnitFuncSparseImpl(
        newDim as CFDimSparse,
        NU,
        NS,
        newValues,
        newBitSet,
        newPows
    );
}




/********************* Tensor: dense ⊗ sparse ************************/
/**
 * Left: Dense (dimD ≥ 0)
 * Right: Sparse (dimS ≥ 1)
 * Result: Sparse with the last unit coming from the RIGHT operand (sparse).
 *
 * Rows per series in the result: U^(dimD) * U^(dimS-1) = U^(dimD+dimS-1)
 * (We enumerate all left unit combinations; for each, we replicate each right row.)
 */
export function materializeTensorDenseSparse(
    fd: CFUnitFuncDense<CFDim>,    // left dense
    fs: CFUnitFuncSparse<CFDimSparse>,   // right sparse
): CFUnitFuncSparse<CFDimSparse> | undefined {

    if (fd.NU !== fs.NU || fd.NS !== fs.NS) return undefined;

    const dimD = fd.dim as number; // ≥ 0
    const dimS = fs.dim as number; // ≥ 1
    const NU   = fd.NU;
    const NS   = fd.NS;

    const newDim = (dimD + dimS) as CFDim;
    const newPows = generatePowerArray((newDim + 1) as CFUint32, NU);
    if (!newPows) return undefined;

    const wordsPerRow = fs.bitset.eWordsPerRow;
    const rowsR_total = fs.bitset.rowPtr.length - 1;         // = S * U^(dimS-1)
    const rowsR_perS  = rowsR_total / NS | 0;                // = U^(dimS-1)
    const lenL_perS   = Math.pow(NU as number, dimD) | 0;    // = U^dimD
    const newRows     = NS * lenL_perS * rowsR_perS;         // = S*U^(dimD+dimS-1)

    // capacity guard
    const bigTotalWords = BigInt(newRows) * BigInt(wordsPerRow);
    if (bigTotalWords > MAX_UINT32_BIGINT) return undefined;

    const newBits   = new Uint32Array(newRows * wordsPerRow);
    const newRowPtr = new Uint32Array(newRows + 1);
    const newVals: CFIval[] = [];

    const reader = new BitSetReaderImpl(fs.bitset.eBits);
    const rowPtrR = fs.bitset.rowPtr;
    const valsR   = fs.values;

    let outRow = 0;
    for (let s = 0; s < NS; s++) {
        const L_base = s * lenL_perS;
        const R_row_base = s * rowsR_perS;

        for (let iL = 0; iL < lenL_perS; iL++) {
            const leftVal = fd.values[L_base + iL]!;

            for (let r = 0; r < rowsR_perS; r++) {
                const rowR = R_row_base + r;
                newRowPtr[outRow] = newVals.length;

                // scan right row
                const it = rowSetIterator(reader, rowR, wordsPerRow, NU);
                let vp = rowPtrR[rowR];
                for (let u = it.next(); u !== it.INF; u = it.next()) {
                    const vR = valsR[vp++]!;
                    const v = ALGEBRA_IVAL.mul(leftVal, vR);
                    if (!ALGEBRA_IVAL.isNull(v)) {
                        const wordIndex = (outRow * wordsPerRow) + (u >>> 5);
                        const bitMask   = (1 << (u & 31)) >>> 0;
                        newBits[wordIndex] |= bitMask;
                        newVals.push(v);
                    }
                }

                outRow++;
            }
        }
    }
    newRowPtr[newRows] = newVals.length;

    const newBitSet: CFBitSet = {
        eBits: newBits,
        eWordsPerRow: wordsPerRow,
        rowPtr: newRowPtr,
    };

    return new CFUnitFuncSparseImpl(
        newDim as CFDimSparse,
        NU,
        NS,
        newVals,
        newBitSet,
        newPows
    );
}


/********************* Tensor: sparse ⊗ dense ************************/
/**
 * Left:  Sparse (dimS ≥ 1)
 * Right: Dense  (dimD ≥ 0)
 * Result: Dense with last unit coming from the RIGHT operand (dense).
 *
 * Rows per series in result: U^(dimS-1) * U * U^(dimD-1) = U^(dimS+dimD-1)
 * We expand each left row by iterating left last-unit k=0..U-1, and for each,
 * we replicate across right prefix rows; each output row has NU entries (dense last unit).
 */
export function materializeTensorSparseDense(
    fs: CFUnitFuncSparse<CFDim>,   // left sparse
    fd: CFUnitFuncDense<CFDimDense>,    // right dense
): CFUnitFuncDense<CFDim> | undefined {

    if (fs.NU !== fd.NU || fs.NS !== fd.NS) return undefined;

    const dimS = fs.dim as number; // ≥1
    const dimD = fd.dim as number; // ≥0
    const NU   = fs.NU;
    const NS   = fs.NS;

    const newDim = (dimS + dimD) as CFDim;
    const newPows = generatePowerArray((newDim + 1) as CFUint32, NU);
    if (!newPows) return undefined;

    // geometry
    const wordsPerRowL = fs.bitset.eWordsPerRow;
    const rowsL_total  = fs.bitset.rowPtr.length - 1; // = S*U^(dimS-1)
    const rowsL_perS   = rowsL_total / NS | 0;        // = U^(dimS-1)
    const rowsRprefix_perS = Math.pow(NU as number, Math.max(dimD - 1, 0)) | 0; // = U^(dimD-1)
    const newRows      = NS * rowsL_perS * NU * rowsRprefix_perS;               // = S*U^(newDim-1)
    const outLen       = newRows * NU; // each row dense across last unit

    const outVals = new Array<CFIval>(outLen);

    // right dense per-series block
    const lenR_perS = Math.pow(NU as number, dimD) | 0; // U^dimD

    // We’ll build a per-row map of left last-unit values for quick access.
    const reader = new BitSetReaderImpl(fs.bitset.eBits);
    const rowPtrL = fs.bitset.rowPtr;
    const valsL   = fs.values;

    let w = 0;
    for (let s = 0; s < NS; s++) {
        const R_base = s * lenR_perS;

        for (let rL = 0; rL < rowsL_perS; rL++) {
            const rowL = s * rowsL_perS + rL;

            // Build map: k -> leftVal (or undefined)
            const leftValsRow: (CFIval | undefined)[] = new Array(NU).fill(undefined);
            let vp = rowPtrL[rowL];
            const it = rowSetIterator(reader, rowL, wordsPerRowL, NU);
            for (let k = it.next(); k !== it.INF; k = it.next()) {
                leftValsRow[k] = valsL[vp++]!;
            }

            // For each left last-unit k and right prefix row rp, emit a dense row
            for (let k = 0; k < NU; k++) {
                const leftVal = leftValsRow[k] ?? ALGEBRA_IVAL.null();

                for (let rp = 0; rp < rowsRprefix_perS; rp++) {
                    const rightRowBase = R_base + rp * NU; // start index for ur = 0..NU-1
                    for (let ur = 0; ur < NU; ur++) {
                        const vR = fd.values[rightRowBase + ur]!;
                        outVals[w++] = ALGEBRA_IVAL.mul(leftVal, vR);
                    }
                }
            }
        }
    }

    return new CFUnitFuncDenseImpl(newDim, NU, NS, outVals, newPows);
}

/********************* Tensor: dense ⊗ const ************************/
/**
 * Left is Dense (dimD ≥ 0), right is Const (dimC ≥ 0).
 * Result is Dense with dim = dimD + dimC.
 *
 * Layout (Dense): for (u_0, ..., u_{dim-1}, s)
 * Tensor index mapping:
 *   idx_out = s*U^(dimD+dimC) + idxL*U^dimC + idxR
 * Where:
 *   idxL ∈ [0 .. U^dimD - 1]   : linear index in left units
 *   idxR ∈ [0 .. U^dimC - 1]   : linear index in right units
 */
export function materializeTensorDenseConst(
    fd: CFUnitFuncDense<CFDim>,    // left: dense
    fc: CFUnitFuncConst<CFDim>,   // right: const
): CFUnitFuncDense<CFDim> | undefined {

    const dimD = fd.dim as number; // ≥ 0
    const dimC = fc.dim as number; // ≥ 0
    const NU   = fd.NU;
    const NS   = fd.NS;

    const newDim = (dimD + dimC) as CFDim;
    const newPows = generatePowerArray((newDim + 1) as CFUint32, NU);
    if (!newPows) return undefined;

    // Number of right combinations per left entry: U^dimC
    const powsC = generatePowerArray((dimC + 1) as CFUint32, NU)!;
    const repR = powsC[dimC];                   // = U^dimC
    const lenL = fd.values.length;              // = NS * U^dimD
    const outLen = lenL * repR;                 // = NS * U^(dimD+dimC)

    const outVals = new Array<CFIval>(outLen);
    let w = 0;

    // For each left dense entry, replicate across all right unit combinations
    for (let i = 0; i < lenL; i++) {
        const vScaled = ALGEBRA_IVAL.mul(fd.values[i]!, fc.value);
        for (let j = 0; j < repR; j++) {
            outVals[w++] = vScaled;
        }
    }

    return new CFUnitFuncDenseImpl(newDim, NU, NS, outVals, newPows);
}


/********************* Tensor: const ⊗ dense ************************/
/**
 * Left is Const (dimC ≥ 0), right is Dense (dimD ≥ 0).
 * Result is Dense with dim = dimC + dimD.
 *
 * Layout (Dense): for (u_left..., u_right..., s)
 * Tensor index mapping:
 *   idx_out = s*U^(dimC+dimD) + idxL*U^dimD + idxR
 * We implement by repeating each right series-block `U^dimC` times, scaled by the const.
 */
export function materializeTensorConstDense(
    fc: CFUnitFuncConst<CFDim>,   // left: const
    fd: CFUnitFuncDense<CFDim>,    // right: dense
): CFUnitFuncDense<CFDim> | undefined {

    const dimC = fc.dim as number; // ≥ 0
    const dimD = fd.dim as number; // ≥ 0
    const NU   = fd.NU;
    const NS   = fd.NS;

    const newDim = (dimC + dimD) as CFDim;
    const newPows = generatePowerArray((newDim + 1) as CFUint32, NU);
    if (!newPows) return undefined;

    // One const: we still need to expand shape, so we must build the new Dense.
    // Repetition count for the left side (how many left unit combinations):
    const powsC = generatePowerArray((dimC + 1) as CFUint32, NU)!;
    const repL = powsC[dimC];                      // = U^dimC

    const lenR = fd.values.length;                 // = NS * U^dimD
    const blockR = powsC[0] /* 1 */;               // just clarity; series block len = U^dimD
    const lenPerSeriesR = lenR / NS;               // U^dimD
    const outLen = lenR * repL;                    // = NS * U^(dimC+dimD)

    const outVals = new Array<CFIval>(outLen);
    let w = 0;

    // For each series s: repeat the right series-block repL times
    for (let s = 0; s < NS; s++) {
        const base = s * lenPerSeriesR;
        for (let l = 0; l < repL; l++) {
            // copy scaled right block
            for (let i = 0; i < lenPerSeriesR; i++) {
                outVals[w++] = ALGEBRA_IVAL.mul(fc.value, fd.values[base + i]!);
            }
        }
    }

    return new CFUnitFuncDenseImpl(newDim, NU, NS, outVals, newPows);
}


/********************* Tensor: dense ⊗ dense ************************/
/**
 * Left is Dense (dimL ≥ 0), right is Dense (dimR ≥ 0).
 * Result is Dense with dim = dimL + dimR.
 *
 * For each series s, if L_s has length U^dimL and R_s has length U^dimR,
 * the output series has length U^(dimL+dimR), with entries:
 *   out[s, idxL, idxR] = L[s, idxL] * R[s, idxR]
 * in row-major order over (left units..., right units...).
 */
export function materializeTensorDenseDense(
    fl: CFUnitFuncDense<CFDim>,
    fr: CFUnitFuncDense<CFDim>,
): CFUnitFuncDense<CFDim> | undefined {
    // Domain guards (for dev)
    if (fl.NU !== fr.NU || fl.NS !== fr.NS)
        throw new Error("materializeTensorDenseDense: incompatible NU/NS.");

    const dimL = fl.dim as number;
    const dimR = fr.dim as number;
    const NU   = fl.NU;
    const NS   = fl.NS;

    const newDim = (dimL + dimR) as CFDim;
    const newPows = generatePowerArray((newDim + 1) as CFUint32, NU);
    if (!newPows) return undefined;

    // Per-series block sizes
    const lenL = Math.pow(NU as number, dimL) | 0; // U^dimL
    const lenR = Math.pow(NU as number, dimR) | 0; // U^dimR
    const outLenPerSeries = lenL * lenR;           // U^(dimL+dimR)
    const outLen = outLenPerSeries * (NS as number);

    const outVals = new Array<CFIval>(outLen);
    let w = 0;

    // For each series s, emit outer-product block
    for (let s = 0; s < NS; s++) {
        const baseL = s * lenL;
        const baseR = s * lenR;

        for (let iL = 0; iL < lenL; iL++) {
            const vL = fl.values[baseL + iL]!;
            for (let iR = 0; iR < lenR; iR++) {
                const vR = fr.values[baseR + iR]!;
                outVals[w++] = ALGEBRA_IVAL.mul(vL, vR);
            }
        }
    }

    return new CFUnitFuncDenseImpl(newDim, NU, NS, outVals, newPows);
}


/********************* Tensor: sparse ⊗ sparse ************************/
/**
 * Left:  Sparse (dimL ≥ 1)
 * Right: Sparse (dimR ≥ 1)
 * Result: Sparse with last unit coming from the RIGHT operand.
 *
 * Rows per series: U^(dimL-1) * U * U^(dimR-1) = U^(dimL+dimR-1)
 * For each left row, we build a map of last-unit k → left value (if any),
 * then for each right row we scan its set bits and multiply; nulls are dropped.
 */
export function materializeTensorSparseSparse(
    fl: CFUnitFuncSparse<CFDimSparse>,
    fr: CFUnitFuncSparse<CFDimSparse>,
): CFUnitFuncSparse<CFDimSparse> | undefined {

    if (fl.NU !== fr.NU || fl.NS !== fr.NS) return undefined;

    const dimL = fl.dim as number; // ≥1
    const dimR = fr.dim as number; // ≥1
    const NU   = fl.NU;
    const NS   = fl.NS;

    const newDim = (dimL + dimR) as CFDim;
    const newPows = generatePowerArray((newDim + 1) as CFUint32, NU);
    if (!newPows) return undefined;

    const wordsPerRowR = fr.bitset.eWordsPerRow;      // last unit from RIGHT
    const rowsL_total  = fl.bitset.rowPtr.length - 1; // = S*U^(dimL-1)
    const rowsR_total  = fr.bitset.rowPtr.length - 1; // = S*U^(dimR-1)
    const rowsL_perS   = rowsL_total / NS | 0;        // = U^(dimL-1)
    const rowsR_perS   = rowsR_total / NS | 0;        // = U^(dimR-1)
    const newRows      = NS * rowsL_perS * NU * rowsR_perS;

    // capacity guard
    const bigTotalWords = BigInt(newRows) * BigInt(wordsPerRowR);
    if (bigTotalWords > MAX_UINT32_BIGINT) return undefined;

    const newBits   = new Uint32Array(newRows * wordsPerRowR);
    const newRowPtr = new Uint32Array(newRows + 1);
    const newVals: CFIval[] = [];

    // Readers and aliases
    const readerL = new BitSetReaderImpl(fl.bitset.eBits);
    const rowPtrL = fl.bitset.rowPtr;
    const valsL   = fl.values;

    const readerR = new BitSetReaderImpl(fr.bitset.eBits);
    const rowPtrR = fr.bitset.rowPtr;
    const valsR   = fr.values;

    let outRow = 0;
    for (let s = 0; s < NS; s++) {
        const L_row_base = s * rowsL_perS;
        const R_row_base = s * rowsR_perS;

        for (let rL = 0; rL < rowsL_perS; rL++) {
            const rowL = L_row_base + rL;

            // Build left map: k → leftVal (if any)
            const leftValsRow: (CFIval | undefined)[] = new Array(NU).fill(undefined);
            let vpL = rowPtrL[rowL];
            const itL = rowSetIterator(readerL, rowL, fl.bitset.eWordsPerRow, NU);
            for (let k = itL.next(); k !== itL.INF; k = itL.next()) {
                leftValsRow[k] = valsL[vpL++]!;
            }

            for (let k = 0; k < NU; k++) {
                const leftVal = leftValsRow[k] ?? ALGEBRA_IVAL.null();

                for (let rR = 0; rR < rowsR_perS; rR++) {
                    const rowR = R_row_base + rR;
                    newRowPtr[outRow] = newVals.length;

                    // scan right row; multiply with leftVal; filter nulls
                    let vpR = rowPtrR[rowR];
                    const itR = rowSetIterator(readerR, rowR, wordsPerRowR, NU);
                    for (let u = itR.next(); u !== itR.INF; u = itR.next()) {
                        const vR = valsR[vpR++]!;
                        const v = ALGEBRA_IVAL.mul(leftVal, vR);
                        if (!ALGEBRA_IVAL.isNull(v)) {
                            const wordIndex = (outRow * wordsPerRowR) + (u >>> 5);
                            const bitMask   = (1 << (u & 31)) >>> 0;
                            newBits[wordIndex] |= bitMask;
                            newVals.push(v);
                        }
                    }

                    outRow++;
                }
            }
        }
    }

    newRowPtr[newRows] = newVals.length;

    const newBitSet: CFBitSet = {
        eBits: newBits,
        eWordsPerRow: wordsPerRowR,
        rowPtr: newRowPtr,
    };

    return new CFUnitFuncSparseImpl(
        newDim as CFDimSparse,
        NU,
        NS,
        newVals,
        newBitSet,
        newPows
    );
}

/********************* Exponentiation *********************/

export function materializeExpRootLeaf<Dim extends CFDim>(
    baseM: CFUnitFuncLeaf<Dim>,
    exp: number,
    opType: CFPowOp
): CFUnitFuncLeaf<Dim> | undefined {
    const CFPowOp = getPowOp(opType);

    if (baseM.storage === CFStorageTag.Const) {
        const cVal = baseM.value;
        const pow = CFPowOp(cVal, exp as CFInt32);
        if (ALGEBRA_IVAL.isNull(pow)) {
            return createNullUnitFunc(baseM.dim, baseM.NU, baseM.NS);
        }
        return new CFUnitFuncConstImpl(baseM.dim, baseM.NU, baseM.NS, pow);
    }

    if (baseM.storage === CFStorageTag.Sparse) {
        // Transform each existing nnz; if the result is null, drop it and clear the bit.
        const { eBits, eWordsPerRow, rowPtr } = baseM.bitset;
        const rows = rowPtr.length - 1;

        const newBits = new Uint32Array(eBits.length);
        const newRowPtr = new Uint32Array(rowPtr.length);
        const newVals: CFIval[] = [];

        let nnzInRow = 0;
        let currIdx = 0; // walks baseM.values (one per set bit)

        for (let row = 0; row < rows; row++) {
            newRowPtr[row] = newVals.length;
            const base = row * eWordsPerRow;

            for (let w = 0; w < eWordsPerRow; w++) {
                const word = eBits[base + w];
                if (word === 0) continue;

                // iterate set bits in 'word'
                for (let wv = word >>> 0; wv !== 0; wv &= (wv - 1)) {
                    const bit = wv & -wv;
                    const offset = 31 - Math.clz32(bit);
                    const uLast = (w << 5) | offset;

                    const oldVal = baseM.values[currIdx++]!;
                    const powVal = CFPowOp(oldVal, exp as CFInt32);

                    if (!ALGEBRA_IVAL.isNull(powVal)) {
                        newBits[base + w] |= bit >>> 0;
                        newVals.push(powVal);
                        nnzInRow++;
                    }
                }
            }
            nnzInRow = 0;
        }
        // terminal pointer
        newRowPtr[rows] = newVals.length;

        const bitset: CFBitSet = { eWordsPerRow, eBits: newBits, rowPtr: newRowPtr };
        return new CFUnitFuncSparseImpl(baseM.dim, baseM.NU, baseM.NS, newVals, bitset, baseM.pows);
    }

    if (baseM.storage === CFStorageTag.Dense) {
        const newVals = new Array<CFIval>(baseM.values.length);
        for (let i = 0; i < baseM.values.length; i++) {
            newVals[i] = CFPowOp(baseM.values[i], exp as CFInt32);
        }
        return new CFUnitFuncDenseImpl(baseM.dim, baseM.NU, baseM.NS, newVals, baseM.pows);
    }

    // no-op for other storages
}

/********************* Arithmetic *********************/

// Materialize a sparse function with a sparse function.
export function materializeSparseSparse<Dim extends CFDimSparse>(
    ufl : CFUnitFuncSparse<Dim>,
    ufr : CFUnitFuncSparse<Dim>,
    arithOp: CFArithOp,
    opType: CFBinOpType = CFBinOpType.Left,
): CFUnitFuncSparse<Dim> {

    let binOp = getBinOp(arithOp);

    const eBitsL = ufl.bitset.eBits;
    const valuesL = ufl.values;
    const brL = new BitSetReaderImpl(eBitsL);

    const eBitsR = ufr.bitset.eBits;
    const valuesR = ufr.values;
    const brR = new BitSetReaderImpl(eBitsR);

    const eWordsPerRow = ufl.bitset.eWordsPerRow;

    const newBits = new Uint32Array(eBitsL.length);
    const newRowPtr = new Uint32Array(ufl.bitset.rowPtr.length);
    // Will store the total rank for row 'i' in rowRankCounts[i].
    const rowRankCounts = new Uint32Array(ufl.bitset.rowPtr.length - 1);
    const newVals: CFIval[] = [];

    // Current total rank for each original bitset (number of 1s).
    // Will be used to index into their value sets.
    let currRankL = 0 as CFUint32;
    let currRankR = 0 as CFUint32;

    // To advance the ranks in both unit function bitsets properly, we have to use 'or'
    // (stop at every position where either the left or the right bitset is 1).
    bitsetScanOr(brL, brR, (bitPos, hasL, hasR) => {

        const wordIdx = bitPos >>> 5 as CFUint32; // Which word (position in Uint32Array).
        const row = Math.floor(wordIdx / eWordsPerRow) as CFUint32; // Which row (eWordsPerRow words per row).
        const bit = bitPos & 31 as CFUint32; // Which bit.

        // TODO This arithmetic is redundant for Mul and Div.
        let lVal = hasL ? valuesL[currRankL++]! : ALGEBRA_IVAL.null();
        let rVal = hasR ? valuesR[currRankR++]! : ALGEBRA_IVAL.null();

        const val = opType === CFBinOpType.Left ? binOp(lVal, rVal) : binOp(rVal, lVal);

        if(!ALGEBRA_IVAL.isNull(val)) {
            // Populate the new bitset
            const mask = (1 << bit) >>> 0;
            newBits[wordIdx] |= mask;
            newVals.push(val);
            // Add 1 to the appropriate row's rank count.
            rowRankCounts[row]++;
        }
        return true;
    });

    // Now form the row pointer for CSR.
    // rp(i + 1) - rp(i) = rank(i), rp(0) = 0
    for(let row = 0; row < rowRankCounts.length; row ++) {
        newRowPtr[row + 1] = newRowPtr[row] + rowRankCounts[row];
    }

    // We now have all the stuff we need.
    const bitset: CFBitSet = {
        eWordsPerRow,
        eBits: newBits,
        rowPtr: newRowPtr
    }
    return new CFUnitFuncSparseImpl(ufl.dim, ufl.NU, ufl.NS, newVals, bitset, ufr.pows);
}

// Materialize a dense function with a sparse function.
export function materializeDenseSparse<Dim extends CFDimSparse>(
    ufl : CFUnitFuncDense<Dim>,
    ufr : CFUnitFuncSparse<Dim>,
    binOp: (a: CFIval, b: CFIval) => CFIval,
    opType: CFBinOpType = CFBinOpType.Left,
): CFUnitFuncDense<Dim> {
    const { eBits, eWordsPerRow, rowPtr } = ufr.bitset;
    const rows = rowPtr.length - 1;   // = U^(dim-1) * S
    const NU = ufr.NU;

    const newValues = new Array<CFIval>(ufl.values.length);
    let currSparseIdx = 0 as CFUint32; // walks sparse values (row-major)

    for (let row = 0; row < rows; row++) {
        const base = row * eWordsPerRow;

        for (let uLast = 0; uLast < NU; uLast++) {
            const wIndex = uLast >>> 5;
            const mask   = 1 << (uLast & 31);
            const word   = eBits[base + wIndex];

            const dVal = ufl.values[row * NU + uLast]!;
            const sVal = (word & mask) === 0
                ? ALGEBRA_IVAL.null()
                : ufr.values[currSparseIdx++]!;

            const out = opType === CFBinOpType.Left
                ? binOp(dVal, sVal)
                : binOp(sVal, dVal);

            newValues[row * NU + uLast] = out;
        }
    }

    // Same dense geometry as left; NS is guaranteed equal by your pipeline.
    return new CFUnitFuncDenseImpl(ufl.dim, ufl.NU, ufl.NS, newValues, ufl.pows);
}

// Materialize a dense function with a dense function.
export function materializeDenseDense<Dim extends CFDim>(
    ufl : CFUnitFuncDense<Dim>,
    ufr : CFUnitFuncDense<Dim>,
    binOp: (a: CFIval, b: CFIval) => CFIval,
    opType: CFBinOpType = CFBinOpType.Left
): CFUnitFuncDense<Dim> {
    const len = ufl.values.length;
    const newVals = new Array<CFIval>(len);
    for(let i = 0; i < len; i ++) {
        const lVal = ufl.values[i];
        const rVal = ufr.values[i];
        newVals[i] = opType === CFBinOpType.Left ? binOp(lVal, rVal) : binOp(rVal, lVal);
    }
    return new CFUnitFuncDenseImpl(ufl.dim, ufl.NU, ufl.NS, newVals, ufr.pows);
}

// Materialize a constant function with a dense function.
export function materializeConstDense<Dim extends CFDim>(
    ufl : CFUnitFuncConst<Dim>,
    ufr : CFUnitFuncDense<Dim>,
    binOp: (a: CFIval, b: CFIval) => CFIval,
    opType: CFBinOpType = CFBinOpType.Left
): CFUnitFuncDense<Dim> {
    const cVal = ufl.value;
    const rLen = ufr.values.length;
    const newVals = new Array<CFIval>(rLen);
    for(let i = 0; i < rLen; i ++) {
        const val = opType === CFBinOpType.Left ? binOp(cVal, ufr.values[i]) : binOp(ufr.values[i], cVal);
        newVals[i] = val;
    }
    return new CFUnitFuncDenseImpl(ufl.dim, ufl.NU, ufl.NS, newVals, ufr.pows);
}

export function materializeConstSparseAddSub<Dim extends CFDimSparse>(
    ufl : CFUnitFuncConst<Dim>,
    ufr : CFUnitFuncSparse<Dim>,
    binOp: (a: CFIval, b: CFIval) => CFIval,
    opType: CFBinOpType = CFBinOpType.Left,
): CFUnitFuncDense<Dim> {
    const { eBits, eWordsPerRow, rowPtr } = ufr.bitset;
    const rows = rowPtr.length - 1;     // = U^(dim-1) * S
    const NU   = ufr.NU;

    const newValues = new Array<CFIval>(rows * NU);
    const cVal = ufl.value;

    // single reader reused across rows (cheap; it maintains an index)
    const reader = new BitSetReaderImpl(eBits);

    let currSparseIdx = 0; // walks ufr.values one-per-set-bit in row-major order

    for (let row = 0; row < rows; row++) {
        const it = rowSetIterator(reader, row, eWordsPerRow, NU);
        let nextSet = it.next(); // first set uLast or INF

        for (let uLast = 0; uLast < NU; uLast++) {
            const sVal =
                (uLast === nextSet)
                    ? ufr.values[currSparseIdx++]!
                    : ALGEBRA_IVAL.null();

            if (uLast === nextSet) nextSet = it.next();

            const newVal = opType === CFBinOpType.Left
                ? binOp(cVal, sVal)
                : binOp(sVal, cVal);

            newValues[row * NU + uLast] = newVal;
        }
    }

    // Dense pows: copy sparse pows and append *NS
    const newPows = new Uint32Array(ufr.pows.length + 1);
    newPows.set(ufr.pows);
    newPows[ufr.pows.length] = newPows[ufr.pows.length - 1] * ufr.NS;

    return new CFUnitFuncDenseImpl(ufl.dim, ufl.NU, ufr.NS, newValues, newPows);
}

// Materialize a constant function with a sparse function, mul or div.
export function materializeConstSparseMulDiv<Dim extends CFDimSparse>(
    ufl : CFUnitFuncConst<Dim>,
    ufr : CFUnitFuncSparse<Dim>,
    binOp: (a: CFIval, b: CFIval) => CFIval,
    opType: CFBinOpType = CFBinOpType.Left,
): CFUnitFuncSparse<Dim> {
    const { eBits, eWordsPerRow, rowPtr } = ufr.bitset;
    const rows = rowPtr.length - 1;
    const NU   = ufr.NU;

    const newBits = new Uint32Array(eBits.length);
    const newRowPtr = new Uint32Array(rowPtr.length);
    const newVals: CFIval[] = [];

    const reader = new BitSetReaderImpl(eBits);
    let currSparseIdx = 0;

    for (let row = 0; row < rows; row++) {
        newRowPtr[row] = newVals.length;
        const it = rowSetIterator(reader, row, eWordsPerRow, NU);
        let u = it.next();

        while (u !== it.INF) {
            const oldVal = ufr.values[currSparseIdx++]!;
            const v = opType === CFBinOpType.Left
                ? binOp(ufl.value, oldVal)
                : binOp(oldVal, ufl.value);

            if (!ALGEBRA_IVAL.isNull(v)) {
                // set bit at (row,u)
                const wordIndex = (row * eWordsPerRow) + (u >>> 5);
                const bitMask   = (1 << (u & 31)) >>> 0;
                newBits[wordIndex] |= bitMask;
                newVals.push(v);
            }
            u = it.next();
        }
    }
    newRowPtr[rows] = newVals.length;

    const bitset: CFBitSet = { eWordsPerRow, eBits: newBits, rowPtr: newRowPtr };
    return new CFUnitFuncSparseImpl(ufl.dim, ufl.NU, ufl.NS, newVals, bitset, ufr.pows);
}

export function materializeConstConst<Dim extends CFDim>(
    ufl : CFUnitFuncConst<Dim>,
    ufr : CFUnitFuncConst<Dim>,
    binOp: (a: CFIval, b: CFIval) => CFIval,
    opType: CFBinOpType = CFBinOpType.Left
): CFUnitFuncConst<Dim> {
    const val = opType === CFBinOpType.Left ?
        binOp(ufl.value, ufr.value) : binOp(ufr.value, ufl.value);
    return createConstUnitFunc(ufl.dim, ufl.NU, ufl.NS, val);
}

export function materializeUFunc<Dim extends CFDim>(uf: CFUnitFunc<Dim>):
    CFUnitFuncLeaf<CFDim> | undefined {
    // Leaf nodes are already materialized.
    if (uf.storage === CFStorageTag.Const ||
        uf.storage === CFStorageTag.Dense ||
        uf.storage === CFStorageTag.Sparse
    ) return uf;

    if(uf.storage === CFStorageTag.PowInt) {
        const baseM = materializeUFunc(uf.base);
        if(baseM === undefined) return undefined;
        return materializeExpRootLeaf(baseM, uf.exp, CFPowOp.Int);
    }
    if(uf.storage === CFStorageTag.PowReal) {
        const baseM = materializeUFunc(uf.base);
        if(baseM === undefined) return undefined;
        return materializeExpRootLeaf(baseM, uf.exp, CFPowOp.Real);
    }
    if(uf.storage === CFStorageTag.NthRoot) {
        const baseM = materializeUFunc(uf.base);
        if(baseM === undefined) return undefined;
        return materializeExpRootLeaf(baseM, uf.exp, CFPowOp.NthRoot);
    }

    // TODO remember pre-materialize const x sparse etc. for dim(const) = 0 (just multiplication)
    if(uf.storage === CFStorageTag.Tensor) {
        const leftM = materializeUFunc(uf.left);
        if(leftM === undefined) return undefined;
        const rightM = materializeUFunc(uf.right);
        if(rightM === undefined) return undefined;
        if (leftM.storage === CFStorageTag.Const) {
            if (rightM.storage === CFStorageTag.Const) {
                return materializeTensorConstConst(leftM, rightM, uf.opType);
            }
            if(rightM.storage === CFStorageTag.Dense) {
                if(uf.opType === CFBinOpType.Left) {
                    return materializeTensorConstDense(leftM, rightM);
                } else {
                    return materializeTensorDenseConst(rightM, leftM);
                }
            }
            if(rightM.storage === CFStorageTag.Sparse) {
                if(uf.opType === CFBinOpType.Left) {
                    return materializeTensorConstSparse(leftM as CFUnitFuncConst<CFDimSparse>, rightM);
                } else {
                    return materializeTensorSparseConst(rightM, leftM as CFUnitFuncConst<CFDimSparse>);
                }
            }
        }
        if(leftM.storage === CFStorageTag.Dense) {
            if(rightM.storage === CFStorageTag.Const) {
                if(uf.opType === CFBinOpType.Left) {
                    return materializeTensorDenseConst(leftM, rightM);
                } else {
                    return materializeTensorConstDense(rightM, leftM);
                }
            }
            if(rightM.storage === CFStorageTag.Dense) {
                if(uf.opType === CFBinOpType.Left) {
                    return materializeTensorDenseDense(leftM, rightM);
                } else {
                    return materializeTensorDenseDense(rightM, leftM);
                }
            }
            if(rightM.storage === CFStorageTag.Sparse) {
                if(uf.opType === CFBinOpType.Left) {
                    return materializeTensorDenseSparse(leftM as CFUnitFuncDense<CFDimSparse>, rightM);
                } else {
                    return materializeTensorSparseDense(rightM, leftM as CFUnitFuncDense<CFDimSparse>);
                }
            }
        }
        if(leftM.storage === CFStorageTag.Sparse) {
            if(rightM.storage === CFStorageTag.Const) {
                if(uf.opType === CFBinOpType.Left) {
                    return materializeTensorSparseConst(leftM, rightM as CFUnitFuncConst<CFDimSparse>);
                } else {
                    return materializeTensorConstSparse(rightM as CFUnitFuncConst<CFDimSparse>, leftM);
                }
            }
            if(rightM.storage === CFStorageTag.Dense) {
                if(uf.opType === CFBinOpType.Left) {
                    return materializeTensorSparseDense(leftM, rightM as CFUnitFuncDense<CFDimSparse>);
                } else {
                    return materializeTensorDenseSparse(rightM as CFUnitFuncDense<CFDimSparse>, leftM);
                }
            }
            if(rightM.storage === CFStorageTag.Sparse) {
                if(uf.opType === CFBinOpType.Left) {
                    return materializeTensorSparseSparse(leftM, rightM);
                } else {
                    return materializeTensorSparseSparse(rightM, leftM);
                }
            }
        }
    }

    if(uf.storage === CFStorageTag.Arith) {

        // Materialize leafs.
        const leftM = materializeUFunc(uf.left);
        if (leftM === undefined) return undefined;
        const rightM = materializeUFunc(uf.right);
        if (rightM === undefined) return undefined;

        if(leftM.storage === CFStorageTag.Const) {
            if(rightM.storage === CFStorageTag.Const) {
                return materializeConstConst(leftM, rightM, getBinOp(uf.arithOp), uf.opType);
            } else if(rightM.storage === CFStorageTag.Sparse) {
                // Add and Sub yield dense, Mul and Div yield sparse, so separate.
                if (uf.arithOp === CFArithOp.Add || uf.arithOp === CFArithOp.Sub) {
                    return materializeConstSparseAddSub(leftM as CFUnitFuncConst<CFDimSparse>, rightM, getBinOp(uf.arithOp), uf.opType);
                } else {
                    return materializeConstSparseMulDiv(leftM as CFUnitFuncConst<CFDimSparse>, rightM, getBinOp(uf.arithOp), uf.opType);
                }
            } else if (rightM.storage === CFStorageTag.Dense) {
                return materializeConstDense(leftM, rightM, getBinOp(uf.arithOp), uf.opType);
            }
        }
        else if(leftM.storage === CFStorageTag.Dense) {
            if(rightM.storage === CFStorageTag.Const) {
                return materializeConstDense(rightM, leftM, getBinOp(uf.arithOp), uf.opType);
            } else if(rightM.storage === CFStorageTag.Sparse) {
                return materializeDenseSparse(leftM as CFUnitFuncDense<CFDimSparse>, rightM, getBinOp(uf.arithOp), uf.opType);
            } else if (rightM.storage === CFStorageTag.Dense) {
                return materializeDenseDense(leftM, rightM, getBinOp(uf.arithOp), uf.opType);
            }
        }
        else if(leftM.storage === CFStorageTag.Sparse) {
            if(rightM.storage === CFStorageTag.Const) {
                if (uf.arithOp === CFArithOp.Add || uf.arithOp === CFArithOp.Sub) {
                    return materializeConstSparseAddSub(rightM as CFUnitFuncConst<CFDimSparse>, leftM, getBinOp(uf.arithOp),
                        uf.opType === CFBinOpType.Left ? CFBinOpType.Right : CFBinOpType.Left);
                } else {
                    return materializeConstSparseMulDiv(rightM as CFUnitFuncConst<CFDimSparse>, leftM, getBinOp(uf.arithOp),
                        uf.opType === CFBinOpType.Left ? CFBinOpType.Right : CFBinOpType.Left);
                }
            }
            if(rightM.storage === CFStorageTag.Dense) {
                return materializeDenseSparse(rightM as CFUnitFuncDense<CFDimSparse>, leftM, getBinOp(uf.arithOp),
                    uf.opType === CFBinOpType.Left ? CFBinOpType.Right : CFBinOpType.Left);
            }
            if(rightM.storage === CFStorageTag.Sparse) {
                return materializeSparseSparse(leftM, rightM, uf.arithOp, uf.opType);
            }

        }
    }
}