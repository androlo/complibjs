import {
    CFDim,
    CFIval,
    CFReal,
    CFUint32,
    CFUnitFuncDense,
    CFUnitFuncDenseImpl
} from "../../src";
import {mulberry32_Real01} from "./mulberry";
import {generatePowerArray} from "../../src/math_utils";

export type CFDenseGenOptions<Dim> = {
    dim: Dim,
    numUnits: CFUint32;
    numSeriesIndices: CFUint32;
    loRange: [number, number];
    hiRange: [number, number];
    allowNull?: boolean;
    seed?: CFUint32;
};

export function genDefaultDenseOpts<Dim extends CFDim>(dim: Dim, U: CFUint32, S: CFUint32): CFDenseGenOptions<Dim> {
    return {
        dim,
        numUnits: U,
        numSeriesIndices: S,
        loRange: [0, 24334],
        hiRange: [24334, 892140],
        allowNull: false,
        seed: 123456789 as CFUint32
    };
}

export function makeValidUnitFuncDense<Dim extends CFDim>(opts: CFDenseGenOptions<Dim>): CFUnitFuncDense<Dim> | undefined {
    const dim = opts.dim;
    const U = opts.numUnits;
    const S = opts.numSeriesIndices;

    const pows = generatePowerArray(dim + 1 as CFUint32, U);
    if (pows === undefined) return undefined;
    const numVals = S * pows[dim];

    const [loMin, loMax] = opts.loRange;
    const [hiMin, hiMax] = opts.hiRange;

    if (!(Number.isFinite(loMin) && Number.isFinite(loMax) && loMin <= loMax)) {
        throw new Error(`Invalid loRange: [${loMin}, ${loMax}]`);
    }
    if (!(Number.isFinite(hiMin) && Number.isFinite(hiMax) && hiMin <= hiMax)) {
        throw new Error(`Invalid hiRange: [${hiMin}, ${hiMax}]`);
    }
    // If both ranges force [0,0], bail early
    if (loMin === 0 && loMax === 0 && hiMin === 0 && hiMax === 0) {
        throw new Error('Ranges force intervals to [0,0]; cannot generate valid data');
    }

    const rand = mulberry32_Real01(opts.seed ? ((opts.seed) >>> 0) as CFUint32 : 123456789 as CFUint32);

    const newVals = new Array<CFIval>(numVals);
    for (let i = 0; i < numVals; i++) {
        newVals[i] = sampleInterval(rand, loMin, loMax, hiMin, hiMax);
    }

    return new CFUnitFuncDenseImpl(dim, U, S, newVals, pows);
}

// Helper: sample interval with lo <= hi, reject [0,0]
function sampleInterval(
    rand: () => number,
    loMin: number,
    loMax: number,
    hiMin: number,
    hiMax: number,
    allowNull = false
): CFIval {
    if (allowNull) {
        const lo = loMin + (loMax - loMin) * rand();
        const hiLower = Math.max(lo, hiMin);
        const hi = hiLower + (hiMax - hiLower) * rand();
        return [lo as CFReal, hi as CFReal];
    }
    for (let tries = 0; tries < 1000; tries++) {
        const lo = loMin + (loMax - loMin) * rand();
        const hiLower = Math.max(lo, hiMin);
        const hi = hiLower + (hiMax - hiLower) * rand();
        if (!(lo === 0 && hi === 0)) return [lo as CFReal, hi as CFReal];
    }
    // If we somehow can't avoid [0,0], throw — likely misconfigured ranges.
    throw new Error('Could not sample a non-[0,0] interval from provided ranges.');
}

// Inject up to 'amount' null values into the given dense unit function (non mutating).
// If the provided unit function has any null values, they will not be replaced with
// new null values, so if no domain errors are encountered, the returned unit function
// will have 'amount' null values added.
export function injectNullIntoDense<Dim extends CFDim>(
    uf: CFUnitFuncDense<Dim>,
    amount: CFUint32,
    seed?: CFUint32
): {uf: CFUnitFuncDense<Dim>; nullsInjected: CFUint32} {
    const len = uf.values.length;
    if (amount === 0 || len === 0) return {uf, nullsInjected: 0 as CFUint32};

    // Collect indices that are currently non-null (so we truly *add* nulls)
    const nonNullIdx: number[] = [];
    for (let i = 0; i < len; i++) {
        const v = uf.values[i]!;
        // null is represented as [0,0]
        if (!(v[0] === 0 && v[1] === 0)) nonNullIdx.push(i);
    }

    if (nonNullIdx.length === 0) {
        // Already all nulls — nothing to inject
        return {uf, nullsInjected: 0 as CFUint32};
    }

    // Number of indices we’ll actually null out
    const k = Math.min(amount as number, nonNullIdx.length);

    const seedVal = seed ? seed >>> 0 as CFUint32 : 123456789 as CFUint32;
    const rnd = mulberry32_Real01((seedVal >>> 0) as CFUint32);

    // Partial Fisher–Yates to choose k distinct positions from nonNullIdx
    for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rnd() * (nonNullIdx.length - i));
        const tmp = nonNullIdx[i];
        nonNullIdx[i] = nonNullIdx[j];
        nonNullIdx[j] = tmp;
    }

    // Copy values and set chosen positions to null
    const newVals = uf.values.slice();
    for (let i = 0; i < k; i++) {
        const idx = nonNullIdx[i];
        newVals[idx] = [0 as CFReal, 0 as CFReal] as CFIval;
    }

    // Return a new dense with identical shape/pows but modified values
    return {uf: new CFUnitFuncDenseImpl(uf.dim, uf.NU, uf.NS, newVals, uf.pows), nullsInjected: k as CFUint32};
}

// Same as injectNullIntoDense, but doesn't care about the number of nulls actually added.
export function injectNullDontCareHowManyWasAdded<Dim extends CFDim>(
    uf: CFUnitFuncDense<Dim>,
    amount: CFUint32,
    seed?: CFUint32
): CFUnitFuncDense<Dim>{
    return injectNullIntoDense(uf, amount, seed).uf;
}

// Inject 'amount' null values into the given dense unit function (non mutating).
// The provided unit function may not have any null values. Guarantees that the
// returned unit function will have 'amount' null values.
export function injectNullNoExisting<Dim extends CFDim>(
    uf: CFUnitFuncDense<Dim>,
    amount: CFUint32,
    seed?: CFUint32
): CFUnitFuncDense<Dim> {
    const len = uf.values.length;
    if (amount === 0 || len === 0) return uf;

    // Clamp to the array length (can't inject more nulls than entries)
    const k = Math.min(amount as number, len);

    const seedVal = seed ? seed >>> 0 as CFUint32 : 123456789 as CFUint32;
    const rnd = mulberry32_Real01((seedVal >>> 0) as CFUint32);

    // Choose k distinct indices via partial Fisher–Yates over [0..len-1]
    // We only store the front k picks to avoid allocating a full index array.
    const picks = new Array<number>(k);
    // We'll simulate the range [0..n-1] by mapping each position to a value.
    const map = new Map<number, number>(); // position -> current value

    const take = (i: number): number => (map.get(i) ?? i);

    let n = len;
    for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rnd() * (n - i)); // uniform in [i..n-1]
        const vi = take(i);
        const vj = take(j);
        // swap(i, j)
        map.set(i, vj);
        map.set(j, vi);
        picks[i] = vj;
    }

    // Produce a new values array and null-out the chosen positions
    const newVals = uf.values.slice();
    for (let i = 0; i < k; i++) {
        const idx = picks[i]!;
        newVals[idx] = [0 as CFReal, 0 as CFReal] as CFIval;
    }

    // Return a new dense with identical shape/pows but modified values
    return new CFUnitFuncDenseImpl(uf.dim, uf.NU, uf.NS, newVals, uf.pows);
}