/**
 * A number of n-ary unit relations that can be applied to certain comparison functions of dimension >= 2.
 */
import {CFSeriesIndex, CFFuncSparse, CFUint32, CFUnit, CFCompFuncTernary, CFDimSparse} from "./types";
import {permutations3, permutationsN, permutationsNWithBitset, rotations3, rotationsN} from "./math_utils";

/** Reflexivity */

export function R_Ternary(
    compFunc: CFCompFuncTernary,
    u: CFUnit,
    s: CFSeriesIndex
): boolean {
    if(compFunc.dim !== 3) {
        throw new Error("R_Ternary can only be applied to ternary functions.");
    }
    return compFunc.E(u, u, u, s);
}

export function R_NAry(
    compFunc: CFFuncSparse<CFDimSparse>,
    u: CFUnit,
    s: CFSeriesIndex
): boolean {
    const arr = new Array(compFunc.dim).fill(u) as CFUnit[];
    return compFunc.E(...arr, s);
}

/**
 * Existence of at least one comparison that contains the unit u. This is guaranteed because of
 * how the dataset is validated before constructing a function but is added nonetheless.
 *
 * Complexity is O(numUnits^3)
 */
export function R_Ternary_Existential(
    compFunc: CFCompFuncTernary,
    u: CFUnit,
    s: CFSeriesIndex
): boolean {

    if(compFunc.dim !== 3) {
        throw new Error("R_Ternary can only be applied to ternary functions.");
    }

    for(let i = 0; i < compFunc.NU; i++) {
        for(let j = 0; j < compFunc.NS; j++) {
            if(compFunc.E(u, i, j, s) || compFunc.E(i, u, j, s) || compFunc.E(i, j, u, s)) return true;
        }
    }
    return false;
}

/**
 * Existence of at least one comparison that contains the unit u. This is guaranteed because of
 * how the dataset is validated before constructing a function but is added nonetheless.
 *
 * Complexity is O(numUnits^dim)
 */
export function R_NAry_Existential(
    compFunc: CFFuncSparse<CFDimSparse>,
    u: CFUnit,
    s: CFSeriesIndex
): boolean {
    const dim = compFunc.dim;
    const U = compFunc.NU;
    const tuple = new Array(dim).fill(0);

    function dfs(pos: number): boolean {
        if (pos === dim) {
            if (tuple.includes(u)) {
                return compFunc.E(...tuple, s);
            }
            return false;
        }

        for (let i = 0; i < U; i++) {
            tuple[pos] = i;
            if (dfs(pos + 1)) return true; // propagate success upward
        }
        return false;
    }

    return dfs(0);
}

/** Symmetry */

/**
 * Every permutation of (u, v, w) exists for s.
 */
export function S_Ternary_Perm(
    compFunc: CFCompFuncTernary,
    u: CFUnit,
    v: CFUnit,
    w: CFUnit,
    s: CFSeriesIndex
): boolean {

    if(compFunc.dim !== 3) {
        throw new Error("R_Ternary can only be applied to ternary functions.");
    }

    const perms = permutations3(u, v, w);
    for(const p of perms) {
        if(!compFunc.E(p[0], p[1], p[2], s)) return false;
    }
    return true;
}

/**
 * Every permutation of (u0, u1, ..., uN) exists for s.
 * Here "idx" is expected as [ u0, u1, ..., uN, s]
 */
export function S_NAry_Perm(
    compFunc: CFFuncSparse<CFDimSparse>,
    ...idx: CFUint32[]
): boolean {
    const s = idx.at(-1) as CFSeriesIndex;
    const units = idx.slice(0, -1) as CFUnit[];
    const perms = permutationsN(units);
    for(const p of perms) {
        if(!compFunc.E(...p, s)) return false;
    }
    return true;
}

/**
 * Every rotation of (u, v, w) exists for s.
 */
export function S_Ternary_Rotational(
    compFunc: CFCompFuncTernary,
    u: CFUnit,
    v: CFUnit,
    w: CFUnit,
    s: CFSeriesIndex
): boolean {

    if(compFunc.dim !== 3) {
        throw new Error("R_Ternary can only be applied to ternary functions.");
    }

    const perms = rotations3(u, v, w);
    for(const p of perms) {
        if(!compFunc.E(p[0], p[1], p[2], s)) return false;
    }
    return true;
}

/**
 * Every rotation of (u0, u1, ..., uN) exists for s.
 * Here "idx" is expected as [ u0, u1, ..., uN, s]
 */
export function S_NAry_Rotational(
    compFunc: CFFuncSparse<CFDimSparse>,
    ...idx: CFUint32[]
): boolean {
    const s = idx.at(-1) as CFSeriesIndex;
    const units = idx.slice(0, -1) as CFUnit[];
    const perms = rotationsN(units);
    for(const p of perms) {
        if(!compFunc.E(...p, s)) return false;
    }
    return true;
}

/**
 * Every permutation of (u, v, w) that passes the bitset filter exists for s.
 * For specifics about the bitset filter, see the documentation for permutationsNWithBitset.
 *
 * The "onlyRotate" param should be set to true if only rotations of the subgroups are allowed.
 */
export function S_Ternary_FilteredPerm(
    compFunc: CFCompFuncTernary,
    bitset: Uint32Array,
    onlyRotate: boolean = false,
    u: CFUnit,
    v: CFUnit,
    w: CFUnit,
    s: CFSeriesIndex,
): boolean {

    if(compFunc.dim !== 3) {
        throw new Error("R_Ternary can only be applied to ternary functions.");
    }

    const perms = permutationsNWithBitset([u, v, w], bitset, onlyRotate);
    for(const p of perms) {
        if(!compFunc.E(p[0], p[1], p[2], s)) return false;
    }
    return true;
}

/**
 * Same as for S_Ternary_FilteredPerm, but for n-ary relations.
 */
export function S_NAry_FilteredPerm(
    compFunc: CFFuncSparse<CFDimSparse>,
    bitset: Uint32Array,
    onlyRotate: boolean = false,
    ...idx: CFUint32[]
): boolean {
    const s = idx.at(-1) as CFSeriesIndex;
    const units = idx.slice(0, -1) as CFUnit[];
    const perms = permutationsNWithBitset(units, bitset, onlyRotate);
    for(const p of perms) {
        if(!compFunc.E(...p, s)) return false;
    }
    return true;
}
