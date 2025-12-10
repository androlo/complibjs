import {CFReal, CFUint32, isReal} from "./types";
import {rankInRow} from "./bit_utils";

export const MAX_UINT32 = 0xFFFFFFFF;
export const MIN_UINT32 = 0;
export const MAX_INT32 = 0x7FFFFFFF;
export const MIN_INT32 = -0x80000000;

export const MAX_UINT32_BIGINT = BigInt(MAX_UINT32);
export const ZERO_BIGINT = BigInt(0);
export const ONE_BIGINT = BigInt(1);
export const MAX_SAFE_INT_BIGINT = Number.MAX_SAFE_INTEGER;

// Unsigned integer power 'exp' of a real number 'base'.
// Returns undefined if the result overflows, and for 0^0.
export function intPow(base: CFReal, exp: CFUint32): CFReal | undefined {
    if (exp === 0) {
        if (base === 0) {
            return undefined;
        }
        return 1 as CFReal;
    }
    if (base === 0) {
        return 0 as CFReal;
    }
    let result = 1;
    let b = base as number;
    let e = exp;
    while (e > 0) {
        if (e & 1) {
            result *= b;
        }
        b *= b;
        e = e >> 1 as CFUint32;
    }
    return isReal(result) ? result : undefined;
}

/**
 * Generates powers [1, base, base^2, ..., base^length - 1] as an array.
 * @param length
 * @param base
 */
export function generatePowerArray(length: CFUint32, base: CFUint32) : Uint32Array | undefined {
    if (length === 0) return new Uint32Array(0);

    // Bounds check.
    const bigBase = BigInt(base);
    const bigLengthM1 = BigInt(length - 1);

    if (bigBase**bigLengthM1 >= MAX_UINT32_BIGINT) {
        console.error("generatePowerArray: array of powers overflows max uint32.");
        return undefined;
    }

    const result = new Uint32Array(length);
    result[0] = 1;
    for (let i = 0; i < length - 1; i++) {
        result[i + 1] = result[i] * base;
    }
    return result;
}

export function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
    if (a.size !== b.size) return false;

    const it = a.values();           // or a.keys()
    let step = it.next();
    while (!step.done) {
        const v = step.value;
        if (!b.has(v)) return false;
        step = it.next();
    }

    return true;
}

// S \ T - assumes T is a subset of S.
export function setDifference<T>(s: ReadonlySet<T>, t: ReadonlySet<T>): Set<T> {
    const result = new Set<T>(s);
    const it = t.values();
    let step = it.next();
    while (!step.done) {
        result.delete(step.value);
        step = it.next();
    }
    return result;
}

// S ∪ T
export function setUnion<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
    // start with the bigger one to do fewer inserts
    const [big, small] = a.size >= b.size ? [a, b] : [b, a];
    const result = new Set<T>(big);
    const it = small.values();
    let step = it.next();
    while (!step.done) {
        result.add(step.value);
        step = it.next();
    }
    return result;
}

// S ∩ T
export function setIntersection<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
    // iterate over the smaller set for efficiency
    const [small, other] = a.size <= b.size ? [a, b] : [b, a];
    const result = new Set<T>();
    const it = small.values();
    let step = it.next();
    while (!step.done) {
        const v = step.value;
        if (other.has(v)) {
            result.add(v);
        }
        step = it.next();
    }
    return result;
}

/**
 * Computes all permutations of (u, v, w). Auto-dedupe for equal permutations.
 *
 * For example, if (u != v, v != w, u != w), we get the full set:
 * [u, v, w],
 * [u, w, v],
 * [v, u, w],
 * [v, w, u],
 * [w, u, v],
 * [w, v, u]
 *
 * If (u == v, v == w, u == w), we get:
 * [u, u, u]
 *
 */
export function permutations3(
    u: CFUint32,
    v: CFUint32,
    w: CFUint32
): [CFUint32, CFUint32, CFUint32][] {
    const uv = (u === v);

    if (uv) {
        const uw = (u === w);
        if (uw) {
            // u == v == w: one distinct permutation
            return [[u, v, w]];
        }
        // u == v, v != w
        return [ [u, v, w], /* [u, u, w] */ [u, w, v], /* [u, w, u] */ [w, u, v], /* [w, u, u] */ ];
    }

    // u != v from here on
    const uw = (u === w)
    if (uw) {
        // u == w != v
        return [ [u, v, w] /* [u, v, u] */, [u, w, v] /* [u, u, v] */, [v, u, w] /* [v, u, u] */ ];
    }

    // u != v and u != w
    const vw = (v === w);
    if (vw) {
        // v == w != u
        return [ [u, v, w] /* [u, v, v] */, [v, u, w] /* [v, u, v] */, [v, w, u] /* [v, v, u] */ ];
    }

    // all distinct
    return [
        [u, v, w], [u, w, v], [v, u, w], [v, w, u], [w, u, v], [w, v, u],
    ];
}

/**
 * Find all rotations of (u, v, w). Auto-dedupe for equal permutations.
 */
export function rotations3(
    u: CFUint32,
    v: CFUint32,
    w: CFUint32
): [CFUint32, CFUint32, CFUint32][] {
    const p0: [CFUint32, CFUint32, CFUint32] = [u, v, w];
    const p1: [CFUint32, CFUint32, CFUint32] = [v, w, u];
    const p2: [CFUint32, CFUint32, CFUint32] = [w, u, v];

    // All equal → only one distinct cyclic permutation
    if (u === v && v === w) {
        return [p0];
    }

    // For patterns like (x, x, y) or all distinct, all 3 rotations are distinct
    return [p0, p1, p2];
}

/**
 * Find the (unique) permutations of xs and return as an array.
 */
export function permutationsN(
    xs: readonly CFUint32[]
): CFUint32[][] {
    const n = xs.length;

    if(n === 0) return [[]];

    // Group by value using a Map<CFUint32, number>
    const countsByValue = new Map<CFUint32, number>();
    for (const x of xs) {
        countsByValue.set(x, (countsByValue.get(x) ?? 0) + 1);
    }

    const values = Array.from(countsByValue.keys());          // distinct values
    const counts = values.map(v => countsByValue.get(v)!);    // multiplicities
    const m = values.length;                                  // number of distinct values

    const result: CFUint32[][] = [];
    const current = new Array<CFUint32>(n) as CFUint32[];

    function backtrack(pos: number): void {
        if (pos === n) {
            result.push(current.slice() as CFUint32[]);
            return;
        }

        for (let i = 0; i < m; i++) {
            if (counts[i] === 0) continue;

            counts[i]--;
            current[pos] = values[i];
            backtrack(pos + 1);
            counts[i]++;
        }
    }

    backtrack(0);
    return result;
}

/**
 * Find the (unique) rotations of xs and return as an array. Automatic dedupes.
 */
export function rotationsN(
    xs: readonly CFUint32[]
): CFUint32[][] {
    const n = xs.length;
    if (n === 0) return [[]];

    const result: CFUint32[][] = [];
    const seen = new Set<string>();

    for (let shift = 0; shift < n; shift++) {
        const rotated = new Array<CFUint32>(n) as CFUint32[];
        for (let i = 0; i < n; i++) {
            rotated[i] = xs[(i + shift) % n];
        }

        // Serialize rotation to dedup; CFUint32 is just a number, so join is fine
        const key = rotated.join(",");
        if (!seen.has(key)) {
            seen.add(key);
            result.push(rotated);
        }
    }

    return result;
}

/**
 * Find all unique permutations of 'xs' where only the elements in 'xs' with the corresponding
 * bit set are permutable. Flag 'onlyRotate' tells the function to only do rotations instead of
 * all permutations. Automatically dedupes.
 *
 * Each element of 'xs' should correspond to a bit in 'bitset'. To find the bit for a given element,
 * take its index in 'xs', i, and get the word index (i / 32) and bit index (i % 32) from that.
 *
 * This divides the input 'xs' into contiguous segments, i.e., contiguous 1's form a segment, and
 * so does contiguous 0's. For example, bits 11100110 (read right-to-left) and array
 * [a, b, c, d, e, f, g, h] would produce the following segments:
 * [a] (do not permute)
 * [b, c] (permute)
 * [d, e] (do not permute)
 * [f, g, h] (permute)
 *
 * Call the set of all permutations of [b, c] P1, and those of [f, g, h] P2. These are arrays of
 * (unique) permutations of the respective segments, as per permuteN([b, c]) and permuteN([f, g, h]).
 * For the "do not permute" groups, the sets are just Z0 = [[a]] and Z1 = [[d, e]].
 * The final result is then the cartesian product Z0 x P1 x Z1 x P2.
 *
 * For all bits 0, the return value is just [xs]. For all bits 1, the return value is
 * simply permuteN(xs).
 */
export function permutationsNWithBitset(
    xs: readonly CFUint32[],
    bitset: Uint32Array,
    onlyRotate: boolean = false
): CFUint32[][] {
    const n = xs.length;
    if (n === 0) return [[]];

    const permFunc = onlyRotate ? rotationsN : permutationsN;

    // Helper: check if bit 'i' is set ('i' corresponds to index in xs)
    function isBitSet(i: number): boolean {
        const wordIndex = i >>> 5;        // i / 32
        const bitIndex = i & 31;          // i % 32
        const word = bitset[wordIndex] ?? 0;
        return ((word >>> bitIndex) & 1) === 1;
    }

    const rank = rankInRow(bitset, 0 as CFUint32, n as CFUint32);

    // All zero bits -> only the identity permutation
    if (rank === 0) {
        // you *could* return xs as-is if you're ok with aliasing,
        // but this keeps the "fresh array" behavior:
        return [xs.slice() as CFUint32[]];
    }

    // All one bits -> full permutation of xs
    if (rank === n) {
        return permFunc(xs);
    }

    // Build contiguous segments with constant "permutable" flag
    type Segment = {
        start: number;
        length: number;
        permutable: boolean;
    };

    const segments: Segment[] = [];

    let currentStart = 0;
    let currentPermutable = isBitSet(0);

    for (let i = 1; i < n; i++) {
        const bit = isBitSet(i);
        if (bit === currentPermutable) continue;

        segments.push({
            start: currentStart,
            length: i - currentStart,
            permutable: currentPermutable,
        });

        currentStart = i;
        currentPermutable = bit;
    }

    segments.push({
        start: currentStart,
        length: n - currentStart,
        permutable: currentPermutable,
    });

    // We only need to store permutations for *permutable* segments.
    // Fixed segments can stay in place; we'll copy xs once into `current`
    // and never touch those indices again.

    type PermSegment = {
        start: number;
        length: number;
        perms: CFUint32[][];
    };

    const permSegments: PermSegment[] = [];

    for (const seg of segments) {
        if (!seg.permutable) continue;

        const slice = xs.slice(seg.start, seg.start + seg.length) as CFUint32[];
        const perms = permFunc(slice);
        permSegments.push({
            start: seg.start,
            length: seg.length,
            perms,
        });
    }

    const result: CFUint32[][] = [];
    // Start with the base array containing all elements in the original order.
    // Fixed segments will remain as-is.
    const current = xs.slice() as CFUint32[];

    function backtrack(segIndex: number): void {
        if (segIndex === permSegments.length) {
            result.push(current.slice() as CFUint32[]);
            return;
        }

        const seg = permSegments[segIndex];
        const { start, length, perms } = seg;

        for (const choice of perms) {
            for (let k = 0; k < length; k++) {
                current[start + k] = choice[k];
            }
            backtrack(segIndex + 1);
        }
    }

    backtrack(0);
    return result;
}

