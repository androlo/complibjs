
// Predicate over a subset (downward-closed / monotone):
import {CFSeriesIndex, CFUnit} from "./types";
import {MAX_SAFE_INT_BIGINT} from "./math_utils";

/**
 * Count subsets of `set` that satisfy a downward-closed predicate.
 *
 * Assumptions:
 * - predicatePartial returns true/false for the *current partial subset*
 * - If it returns false for a partial subset, all supersets also fail (downward-closed)
 * - predicateTotal(s) means: the *whole* set passes ⇒ every subset passes
 */
export function countFilteredSubsets(
    predicateTotal: (s: CFSeriesIndex) => boolean,
    predicatePartial: (cur: CFUnit[], s: CFSeriesIndex) => boolean,
    units: CFUnit[],
    s: CFSeriesIndex
): number | undefined {
    // 1) compute theoretical max.
    const max = 1n << BigInt(units.length);
    const maxIsSafe = max <= MAX_SAFE_INT_BIGINT;

    // 2) fast path: whole frame passes
    if (predicateTotal(s)) {
        if (!maxIsSafe) {
            console.error("countFilteredSubsets: powerset too large to count.");
            return undefined;
        }
        // 2^n fits — return as number
        return Math.pow(2, units.length);
    }

    // 3) general path
    if (maxIsSafe) {
        // even in the worst case (no pruning), the count fits,
        // so we can do a fast DFS with no per-leaf bound checks
        return countPrunedUnsafe(predicatePartial, units, s);
    } else {
        // worst case doesn't fit → we must guard increments
        return countPrunedSafe(predicatePartial, units, s);
    }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// no per-leaf bound checks — fastest version
function countPrunedUnsafe(
    predicatePartial: (cur: CFUnit[], s: CFSeriesIndex) => boolean,
    units: CFUnit[],
    s: CFSeriesIndex
): number {
    let count = 0;
    const cur: CFUnit[] = [];

    const dfs = (i: number) => {
        if (!predicatePartial(cur, s)) return;

        if (i === units.length) {
            count++;
            return;
        }

        // exclude
        dfs(i + 1);

        // include
        cur.push(units[i]);
        dfs(i + 1);
        cur.pop();
    };

    dfs(0);
    return count;
}

// per-leaf bound checks — only used when 2^n won't fit
function countPrunedSafe(
    predicatePartial: (cur: CFUnit[], s: CFSeriesIndex) => boolean,
    units: CFUnit[],
    s: CFSeriesIndex
): number | undefined {
    let count = 0;
    const cur: CFUnit[] = [];

    // return true = continue, false = abort whole search
    const dfs = (i: number): boolean => {
        if (!predicatePartial(cur, s)) return true;

        if (i === units.length) {
            if (count === Number.MAX_SAFE_INTEGER) {
                console.error(
                    "countFilteredSubsets: count would exceed Number.MAX_SAFE_INTEGER during  DFS",
                    { setLen: units.length, s }
                );
                return false;
            }
            count++;
            return true;
        }

        // exclude
        if (!dfs(i + 1)) return false;

        // include
        cur.push(units[i]);
        const ok = dfs(i + 1);
        cur.pop();
        return ok;
    };

    const finished = dfs(0);
    if (!finished) return undefined;
    return count;
}

/**
 * Generator that yields all subsets of `set` that satisfy the
 * downward-closed predicate.
 *
 * Usage:
 *   for (const subset of filteredSubsetsGenerator(compFunc, set, s)) {
 *     // subset is CFUnit[]
 *   }
 */
export function filteredSubsetsGenerator(
    predicateTotal: (s: CFSeriesIndex) => boolean,
    predicatePartial: (cur: CFUnit[], s: CFSeriesIndex) => boolean,
    units: CFUnit[],
    s: CFSeriesIndex
): Generator<ReadonlySet<CFUnit>, void, unknown> {

    // If the whole frame passes, we can just yield the full powerset without
    // calling the predicate for every node.
    if (predicateTotal(s)) {
        return fullPowersetGenerator(units);
    }

    return prunedGenerator(predicatePartial, units, s);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Full powerset generator (used in the fast path).
 */
function* fullPowersetGenerator(set: CFUnit[]): Generator<ReadonlySet<CFUnit>, void, unknown> {
    const cur: CFUnit[] = [];

    function* dfs(i: number): Generator<ReadonlySet<CFUnit>, void, unknown> {
        if (i === set.length) {
            yield new Set<CFUnit>(cur.slice());
            return;
        }

        // exclude
        yield* dfs(i + 1);

        // include
        cur.push(set[i]);
        yield* dfs(i + 1);
        cur.pop();
    }

    yield* dfs(0);
}

/**
 * Pruned generator: only yields subsets that pass compFunc.ORT_V_unsafe(cur, s).
 */
function* prunedGenerator(
    predicatePartial: (cur: CFUnit[], s: CFSeriesIndex) => boolean,
    units: CFUnit[],
    s: CFSeriesIndex
): Generator<Set<CFUnit>, void, unknown> {
    const cur: CFUnit[] = [];

    function* dfs(i: number): Generator<Set<CFUnit>, void, unknown> {
        // prune failing partials
        if (!predicatePartial(cur, s)) return;

        if (i === units.length) {
            // yield a copy so consumer can't mutate our working buffer
            yield new Set<CFUnit>(cur.slice());
            return;
        }

        // exclude
        yield* dfs(i + 1);

        // include
        cur.push(units[i]);
        yield* dfs(i + 1);
        cur.pop();
    }

    yield* dfs(0);
}
