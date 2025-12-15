
import {
    ALGEBRA_IVAL,
    CFComparison,
    CFCompData,
    CFIval,
    CFReal,
    CFSeriesIndex,
    CFUint32,
    CFUnit,
    CFValidCompDataSet,
    isUint32
} from "../../src";
import {mulberry32_Real01, mulberry32_uint32_N} from "./mulberry";

export type CFGenOptions = {
    maxUnitIndex: CFUint32;              // U - 1
    maxSeriesIndex: CFUint32;            // S - 1
    numComparisons: CFUint32;            // >= max(U,S)
    loRange: [number, number];
    hiRange: [number, number];
    seed?: CFUint32;
    // Inclination to generate comparisons (u, u, s).
    diagonalBias?: 'none' | 'prefer' | 'avoid';
    // round-robin to spread out
    seriesDistribution?: 'roundRobin' | 'uniform';
};

export type CFGenResult = {
    arr: CFValidCompDataSet;
    numUnits: CFUint32;
    numSeriesIndices: CFUint32;
};

const DEFAULTS: Required<Pick<CFGenOptions, 'diagonalBias' | 'seriesDistribution'>> = {
    diagonalBias: 'none',
    seriesDistribution: 'roundRobin',
};

export function makeValidCFCompDataset(opts: CFGenOptions): CFGenResult {
    const diagonalBias = opts.diagonalBias ?? DEFAULTS.diagonalBias;
    const seriesDistribution = opts.seriesDistribution ?? DEFAULTS.seriesDistribution;

    if(opts.seed && (opts.seed !== (opts.seed >>> 0))) throw new Error(`Invalid seed: ${opts.seed}`);

    const U = (opts.maxUnitIndex | 0) + 1;
    if (!isUint32(U)) throw new Error(`Invalid maxUnitIndex: ${U}`);

    const S = (opts.maxSeriesIndex | 0) + 1;
    if (!isUint32(S)) throw new Error(`Invalid maxSeriesIndex: ${S}`);

    const N = opts.numComparisons | 0;
    // N is > 0 since max(U,S) >= 1
    if (N < Math.max(U, S)) {
        throw new Error(`numComparisons=${N} is too small to cover sets; need at least ${Math.max(U, S)}`);
    }

    const MAX = U * U * S;

    if (N > MAX) {
        throw new Error(`numComparisons=${N} exceeds unique space (${MAX}) for U=${U}, S=${S}`);
    }

    const [loMin, loMax] = opts.loRange;
    const [hiMin, hiMax] = opts.hiRange;

    if (!(Number.isFinite(loMin) && Number.isFinite(loMax) && loMin <= loMax)) {
        throw new Error(`Invalid loRange: [${loMin}, ${loMax}]`);
    }
    if (!(Number.isFinite(hiMin) && Number.isFinite(hiMax) && hiMin <= hiMax)) {
        throw new Error(`Invalid hiRange: [${hiMin}, ${hiMax}]`);
    }
    if (loMin === 0 && loMax === 0 && hiMin === 0 && hiMax === 0) {
        throw new Error('Ranges force intervals to [0,0]; cannot generate valid data');
    }

    const seed = (opts.seed ?? 123456789) >>> 0 as CFUint32; // Checked validity at the top.
    const rand = mulberry32_Real01(seed);
    const randInt = mulberry32_uint32_N(~seed as CFUint32); // Mix it up.

    // Dense occupancy bitset
    const pack = (u: number, v: number, s: number) =>
        ((u * U + v) * S + s) | 0;
    const used = new Uint8Array(MAX);

    const has = (u: number, v: number, s: number) =>
        used[pack(u, v, s)] !== 0;

    const mark = (u: number, v: number, s: number) =>
    { used[pack(u, v, s)] = 1; };

    const arr: CFComparison[] = [];
    const usedPerS = new Int32Array(S); // how many (u,v) we already took per series

    // Biased permutation for (u,v)
    function makeUVOrder(): Int32Array {
        const total = U * U;
        const diag: number[] = [];
        const off: number[] = [];

        for (let u = 0; u < U; u++) {
            for (let v = 0; v < U; v++) {
                const p = u * U + v;
                if (u === v) diag.push(p); else off.push(p);
            }
        }

        const fy = (a: number[]) => {
            for (let i = a.length - 1; i > 0; i--) {
                const j = randInt(i + 1 as CFUint32);
                const t = a[i]; a[i] = a[j]; a[j] = t;
            }
        };

        if (diagonalBias === 'none') {
            const all = new Int32Array(total);
            for (let i = 0; i < total; i++) all[i] = i;
            for (let i = total - 1; i > 0; i--) {
                const j = randInt(i + 1 as CFUint32);
                const t = all[i]; all[i] = all[j]; all[j] = t;
            }
            return all;
        } else {
            fy(diag);
            fy(off);
            const out = new Int32Array(total);
            if (diagonalBias === 'prefer') {
                // Put some diagonals sooner, then off-diagonals
                let i = 0, d = 0, o = 0;
                const chunkD = Math.max(1, Math.floor(U / 4));
                const chunkO = Math.max(1, Math.floor((U * (U - 1)) / Math.max(1, 4 * U)));
                while (i < total && (d < diag.length || o < off.length)) {
                    for (let c = 0; c < chunkD && d < diag.length; c++) out[i++] = diag[d++];
                    for (let c = 0; c < chunkO && o < off.length; c++) out[i++] = off[o++];
                }
                while (d < diag.length) out[i++] = diag[d++];
                while (o < off.length) out[i++] = off[o++];
            } else { // 'avoid'
                let i = 0;
                for (let k = 0; k < off.length; k++) out[i++] = off[k];
                for (let k = 0; k < diag.length; k++) out[i++] = diag[k];
            }
            return out;
        }
    }

    // Precompute order per series and per-series cursor
    const perS_Order: Int32Array[] = new Array(S);
    for (let s = 0; s < S; s++) perS_Order[s] = makeUVOrder();
    const perS_Cursor = new Int32Array(S); // zeros

    const nextUniqueUVForSeries = (s: number): [number, number] => {
        const order = perS_Order[s];
        let idx = perS_Cursor[s] | 0;
        const limit = order.length;
        while (idx < limit) {
            const p = order[idx++];
            const u = (p / U) | 0;
            const v = p - u * U;
            if (!has(u, v, s)) {
                perS_Cursor[s] = idx;
                return [u, v];
            }
        }
        // If we get here, the series is full: no unused (u,v) remain
        throw new Error(`Series ${s}: exhausted unique (u,v) pairs`);
    };

    const pushTriple = (u: number, v: number, s: number) => {
        arr.push([u, v, s, sampleInterval(rand, loMin, loMax, hiMin, hiMax)] as unknown as CFComparison);
        mark(u, v, s);
        usedPerS[s] += 1;
    };

    // ---- 1) Skeleton: cover units and ensure every series index appears ----
    for (let i = 0; i < U; i++) {
        const s = i % S; // works for both distributions as a starter
        const u = i;
        const v = (i + 1) % U;
        if (!has(u, v, s)) pushTriple(u, v, s);
    }

    // Ensure each series appears at least once
    const seenSeries = new Uint32Array(S);
    for (let i = 0; i < arr.length; i++) seenSeries[arr[i][2]] = 1;
    for (let s = 0; s < S; s++) {
        if (!seenSeries[s]) {
            // only add if series has capacity
            if (usedPerS[s] < U * U) {
                const [u, v] = nextUniqueUVForSeries(s);
                pushTriple(u, v, s);
                seenSeries[s] = 1;
            } else {
                throw new Error(`Series ${s} has no capacity left to satisfy coverage`);
            }
        }
    }

    // ---- 2) Fill remaining, respecting per-series capacity ----
    const capacity = (s: number) => U * U - usedPerS[s];

    if (seriesDistribution === 'uniform') {
        let remaining = N - arr.length;
        // fair, capacity-aware round-robin
        // (keeps distribution even without overfilling any series)
        let s = 0;
        // quick sanity: global capacity must suffice
        let totalCap = 0;
        for (let i = 0; i < S; i++) totalCap += capacity(i);
        if (remaining > totalCap) {
            throw new Error(`Not enough remaining capacity to reach N=${N} (this should not happen)`);
        }

        while (remaining > 0) {
            // find next series with capacity
            let checked = 0;
            while (checked < S && capacity(s) === 0) { s = (s + 1) % S; checked++; }
            if (checked === S) break; // no capacity anywhere (shouldn't happen given check above)

            const [u, v] = nextUniqueUVForSeries(s);
            pushTriple(u, v, s);
            remaining--;
            s = (s + 1) % S;
        }
    } else { // 'roundRobin'
        let s = arr.length % S;
        while (arr.length < N) {
            // skip full series
            let checked = 0;
            while (checked < S && capacity(s) === 0) { s = (s + 1) % S; checked++; }
            if (checked === S) {
                // No capacity left anywhere; cannot proceed further
                break;
            }
            const [u, v] = nextUniqueUVForSeries(s);
            pushTriple(u, v, s);
            s = (s + 1) % S;
        }
    }

    if (arr.length !== N) {
        throw new Error(`Could only generate ${arr.length} of ${N} comparisons (capacity exhausted unevenly)`);
    }

    return { arr: arr as unknown as CFValidCompDataSet, numUnits: U as CFUint32, numSeriesIndices: S as CFUint32 };
}

// Helper: sample interval with lo <= hi, reject [0,0]
export function sampleInterval(
    rand: () => number,
    loMin: number,
    loMax: number,
    hiMin: number,
    hiMax: number
): CFIval {
    for (let tries = 0; tries < 1000; tries++) {
        const lo = loMin + (loMax - loMin) * rand();
        const hiLower = Math.max(lo, hiMin);
        const hi = hiLower + (hiMax - hiLower) * rand();
        if (!(lo === 0 && hi === 0)) return [lo as CFReal, hi as CFReal];
    }
    // If we somehow can't avoid [0,0], throw — likely misconfigured ranges.
    throw new Error('Could not sample a non-[0,0] interval from provided ranges.');
}

// ---------- Mutators: each returns a new array that breaks exactly one rule ----------
export const mutators = {
    // Rule 1: empty array
    makeEmptyArray(arr: CFComparison[]): CFComparison[] {
        return [];
    },

    // Rule 2: invalid sizes (helpers return the altered numbers)
    setNumUnitsInvalid(_current: number, to = 0): number {
        return to;
    },

    setNumSeriesIndicesInvalid(_current: number, to = 0): number {
        return to;
    },

    // Rule 3: invalid u/v/s
    injectNonIntegerU(arr: CFComparison[], at = 0, value = 1.5): CFCompData[] {
        const out: CFCompData[] = arr.slice() as unknown as CFCompData[];
        const [_, v, s, x] = out[at] ?? 
        [0 as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex, [1 as CFReal, 2 as CFReal] as CFIval];
        out[at] = [value, v, s, x];
        return out;
    },

    injectNegativeV(arr: CFCompData[], at = 0): CFCompData[] {
        const out = arr.slice();
        const [u, _, s, x] = out[at] ?? [0, 0, 0, [1 as CFReal, 2 as CFReal]];
        out[at] = [u, -1, s, x];
        return out;
    },

    injectOutOfRangeS(arr: CFCompData[], S: number, at = 0, toValue = S): CFCompData[] {
        const out = arr.slice();
        const [u, v, _, x] = out[at] ?? [0, 0, 0, [1 as CFReal, 2 as CFReal]];
        out[at] = [u, v, toValue, x];
        return out;
    },

    // Rule 4: bad intervals
    makeIntervalZero(arr: CFCompData[], count = 1): CFCompData[] {
        const out = arr.slice();
        for (let i = 0; i < out.length && i < count; i++) {
            const [u, v, s] = out[i];
            out[i] = [u, v, s, [0 as CFReal, 0 as CFReal]];
        }
        return out;
    },

    makeIntervalReversed(arr: CFCompData[], at = 0): CFCompData[] {
        const out = arr.slice();
        const [u, v, s, [lo, hi]] = out[at];
        const lo2 = Math.max(lo, hi) as CFReal;
        const hi2 = Math.min(lo, hi) - 1 as CFReal; // ensure lo2 > hi2
        out[at] = [u, v, s, [lo2, hi2]];
        return out;
    },

    // Rule 5: units set wrong
    dropUnitIndex(arr: CFCompData[], missingUnit: number): CFCompData[] {
        const out = arr.filter(([u, v]) => u !== missingUnit && v !== missingUnit);
        if (out.length === 0) {
            throw new Error('dropUnitIndex: Cannot drop unit index, would result in empty dataset');
        }
        return out;
    },

    addExtraUnitIndex(arr: CFCompData[], U: number, extraUnit = U): CFCompData[] {
        const [u0, v0, s0] = arr[0];
        return arr.concat([[extraUnit, v0, s0, arr[0][3]]]);
    },

    // Rule 6: series set wrong
    dropSeriesIndex(arr: CFCompData[], missingS: number): CFCompData[] {
        const out = arr.filter(([,, s]) => s !== missingS);
        return out.length > 0 ? out : arr.slice(1);
    },

    addExtraSeriesIndex(arr: CFCompData[], S: number, extraS = S): CFCompData[] {
        const [u0, v0] = arr[0];
        return arr.concat([[u0, v0, extraS, arr[0][3]]]);
    },

    // Rule 7: duplicates
    insertDuplicateTriple(arr: CFCompData[], pickIndex = 0): CFCompData[] {
        const base = arr[pickIndex % arr.length];
        // Push an exact duplicate of (u,v,s); interval can be same or different
        return arr.concat([[base[0], base[1], base[2], base[3]]]);
    },
};

export function genRand01ValueArray(len: CFUint32): CFIval[] {
    const out: CFIval[] = new Array(len);
    for (let i = 0; i < len; i++) {
        out[i] = Math.random() < 0.5 ? ALGEBRA_IVAL.one() : ALGEBRA_IVAL.null();
    }
    return out;
}