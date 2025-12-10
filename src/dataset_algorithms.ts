import {
    CFComparison, CFCompData,
    CFSeriesIndex,
    CFUint32,
    CFUnit,
    CFValidCompDataSet
} from "./types";
import {ALGEBRA_IVAL, CFIval} from "./value_types/ival";
import {validateBinaryCompData} from "./compfunc";

export type RefFunc = () => CFIval;
export type SymFunc = (x: CFIval) => CFIval | undefined;
export type TransFunc = (x: CFIval, y: CFIval) => CFIval | undefined;
export type ValidateFunc = (generated: CFIval, existing: CFIval) => boolean;

export type CloseOptions = {
    refFunc?: RefFunc,
    symFunc?: SymFunc,
    transFunc?: TransFunc,
    validateFunc: ValidateFunc
};

// perSeries[s][u] = Map<v, V>
type SparseDataPerSeries = Array<Array<Map<number, CFIval>>>;

/**
 * Build sparse maps from the flat dataset.
 *
 * Assumes the dataset already passed your earlier validation
 * (bounds, non-null x, etc.).
 */
export function buildSparseDataPerSeries(
    data: CFValidCompDataSet,
    numUnits: number,
    numSeriesIndices: number
): SparseDataPerSeries {
    // This is only called internally, so it should technically work with empty datasets, even though
    // they are not allowed.

    // make per-series, per-unit maps
    const perSeries: SparseDataPerSeries = Array.from(
        { length: numSeriesIndices },
        () => Array.from({ length: numUnits }, () => new Map<number, CFIval>())
    );

    for (const [u, v, s, x] of data) {
        // we assume 0 <= u < numUnits, 0 <= v < numUnits, 0 <= s < numSeriesIndices
        const rowsForS = perSeries[s];
        const rowU = rowsForS[u];
        // assuming no duplicate (u, v, s) in the input — or if there is, last one wins
        rowU.set(v, x);
    }

    return perSeries;
}

export function sparseToCFCompData(
    perSeries: SparseDataPerSeries
): CFValidCompDataSet {
    const result: CFComparison[] = [];

    for (let s = 0; s < perSeries.length; s++) {
        const rowsForS = perSeries[s];
        for (let u = 0; u < rowsForS.length; u++) {
            const row = rowsForS[u];
            for (const [v, x] of row) {
                result.push([u, v, s, x] as unknown as CFComparison);
            }
        }
    }
    if(result.length === 0) {
        throw new Error("sparseToCFCompData: resulting dataset is empty.");
    }
    return result as CFValidCompDataSet;
}

// Check that refFunc() is not null and is fixed for symFunc and transFunc,
// i.e. r = refFunc() => r = symFunc(r) = transFunc(r, r).
function sanityCheckCloseOptions(opts: CloseOptions) {
    
    const { refFunc, symFunc, transFunc, validateFunc } = opts;

    if (refFunc) {
        const r = refFunc();

        if(ALGEBRA_IVAL.isNull(r)) {
            throw new Error("refFunc must not return null");
        }

        if (symFunc) {
            const sr = symFunc(r);
            if (sr === undefined) {
                throw new Error("symFunc must not return undefined");
            }
            if(ALGEBRA_IVAL.isNull(sr)) {
                throw new Error("symFunc must not return null");
            }
            if (!validateFunc(sr, r)) {
                throw new Error("symFunc incompatible with rFunc");
            }
        }

        if (transFunc) {
            const rr = transFunc(r, r);
            if (rr === undefined) {
                throw new Error("transFunc must not return undefined");
            }
            if(ALGEBRA_IVAL.isNull(rr)) {
                throw new Error("transFunc must not return null");
            }
            if (!validateFunc(rr, r)) {
                throw new Error("transFunc incompatible with rFunc");
            }
        }
    }
}

function closeReflexivity(
    rows: Array<Map<number, CFIval>>,
    s: CFSeriesIndex,
    rFunc: RefFunc,
    validateFunc: ValidateFunc,
    numUnits: CFUint32
) {
    for (let u = 0; u < numUnits; u++) {
        const r = rFunc();
        if (!rows[u].has(u)) {
            rows[u].set(u, r);
        } else {
            if (!validateFunc(r, rows[u].get(u)!)) {
                throw new Error(`reflexivity rule violated for (${u}, ${u}, ${s}).`);
            }
        }
    }
}

function closeSymmetry(
    rows: Array<Map<number, CFIval>>,
    s: CFSeriesIndex,
    sFunc: SymFunc,
    validateFunc: ValidateFunc,
    numUnits: CFUint32
) {

    for (let u = 0; u < numUnits; u++) {
        for (const [v, x] of rows[u]) {
            const y = sFunc(x);               // e.g. algebra.inv(x)
            if(y === undefined) {
                throw new Error(`symmetry rule returned undefined for (${u}, ${v}, ${s}).`);
            }
            if(ALGEBRA_IVAL.isNull(y)) {
                throw new Error(`symmetry rule returned null element for (${u}, ${v}, ${s}).`);
            }
            const revRow = rows[v];
            const existing = revRow.get(u);
            if (existing === undefined) {
                revRow.set(u, y);
            } else if (!validateFunc(y, existing)) {
                throw new Error(`symmetry rule violated for (${u}, ${v}, ${s}).`);
            }
        }
    }
}

function closeTransitivity(
    rows: Array<Map<number, CFIval>>,
    s: CFSeriesIndex,
    transFunc: TransFunc,
    validateFunc: ValidateFunc
): void {
    type Edge = { u: number; v: number; x: CFIval };

    // 1) init worklist with all existing edges
    const worklist: Edge[] = [];
    for (let u = 0; u < rows.length; u++) {
        const row = rows[u];
        for (const [v, x] of row) {
            worklist.push({ u, v, x });
        }
    }

    // 2) process until no new edges
    while (worklist.length > 0) {
        const { u, v, x } = worklist.pop()!;

        const rowFromV = rows[v];
        // for every edge v -> w with value y
        for (const [w, y] of rowFromV) {
            const z = transFunc(x, y); // candidate value for u -> w
            if(z === undefined) {
                throw new Error(`transFunc returned undefined for (${u} -> ${w}) (series ${s}).`);
            }
            if (ALGEBRA_IVAL.isNull(z)) {
                throw new Error(`transFunc returned null element for (${u} -> ${w}) (series ${s}).`);
            }
            const rowFromU = rows[u];
            const existing = rowFromU.get(w);

            if (existing === undefined) {
                // new edge discovered: add it and schedule it to combine further
                rowFromU.set(w, z);
                worklist.push({ u, v: w, x: z });
            } else {
                // edge already exists: must match our derived value
                if (!validateFunc(z, existing)) {
                    throw new Error(
                        `Transitivity conflict at (${u} -> ${w}) (series ${s}).`
                    );
                }
            }
        }
    }
}

export function processData(
    data: CFValidCompDataSet,
    numUnits: CFUint32,
    numSeriesIndices: CFUint32,
    opts: CloseOptions
): CFValidCompDataSet {
    const perSeries = buildSparseDataPerSeries(data, numUnits, numSeriesIndices);

    sanityCheckCloseOptions(opts);

    for (let s = 0 as CFSeriesIndex; s < numSeriesIndices; s++) {
        const rows = perSeries[s];

        if (opts.refFunc !== undefined) {
            // add [u, u, s, algebra.one()]
            closeReflexivity(rows, s, opts.refFunc, opts.validateFunc, numUnits);
        }

        if (opts.symFunc !== undefined) {
            // run the symmetry pass we discussed earlier
            closeSymmetry(rows, s, opts.symFunc, opts.validateFunc, numUnits);
        }

        if (opts.transFunc !== undefined) {
            closeTransitivity(rows, s, opts.transFunc, opts.validateFunc);
        }

    }

    const retData = sparseToCFCompData(perSeries);

    // Sanity check.
    validateBinaryCompData(retData as unknown as CFCompData[], numUnits, numSeriesIndices);
    return retData;
}

export function getStandardCloseOptions(): CloseOptions {
    // Use ONE for (d, d, s) and (m, m, s).
    const refFunc = () => ALGEBRA_IVAL.one();
    // For all (u, v, s), just invert its value for (v, u, s), meaning x -> [1,1]/x
    const symFunc = (x: CFIval) => ALGEBRA_IVAL.inv(x);
    // For all (u, v, s) and (v, w, s), just multiply their values for (u, w, s)
    const transFunc = (x: CFIval, y: CFIval) => ALGEBRA_IVAL.mul(x, y);

    // Validate if 'existing' is a subinterval of 'generated'.
    const validateFunc = (generated: CFIval, existing: CFIval) =>
        ALGEBRA_IVAL.contains(generated, existing);

    return {
        refFunc,
        symFunc,
        transFunc,
        validateFunc
    }
}


export interface UnitReindexResult {
    dataset: CFValidCompDataSet;
    unitMap: Map<CFUnit, CFUnit>;
}

export interface SeriesReindexResult {
    dataset: CFValidCompDataSet;
    seriesMap: Map<CFUnit, CFUnit>;
}

export interface ReindexResult {
    dataset: CFValidCompDataSet;
    unitMap: Map<CFUnit, CFUnit>;
    seriesMap: Map<CFUnit, CFUnit>;
}

/**
 * Filters a dataset to a subset of units (for both u and v) and re-indexes those units
 * to be contiguous {0, 1, ..., unitSubset.size - 1}.
 *
 * Returns a new dataset and a map oldUnit -> newUnit.
 *
 * Example: 'numUnits' is 5, and 'unitSubset' is {1, 2, 4}, and series indices the same as in the original.
 *          The function filters all data-points with 'u' and 'v' that are not in {1, 2, 4}. This creates
 *          a new dataset with newNumUnits 3. It will fail validation, as-is, because it does not
 *          contain unit 0, and 4 is outside the range {0, 1, 2} (newNumUnits = 3). The function will
 *          therefore map 1 -> 0, 2 -> 1, and 4 -> 2, to make the new unit set {0, 1, 2}. It then goes
 *          through the filtered dataset and re-maps all 'u' and 'v' in the data-points to use the new
 *          mappings.
 *
 *          So, if the original dataset contains [1, 4, s, x] it will pass the filter, since 1 and 4 are
 *          in the unit subset. In the re-indexing pass, it will be changed to [0, 2, s, x]. The
 *          reverse mapping is provided with the returned dataset, if needed.
 *
 *          The process to prune and re-index based on seriesSubset is similar. In the joint function,
 *          it does units first, then series.
 */
export function pruneUnits(
    dataset: CFValidCompDataSet,
    numUnits: CFUint32,
    unitSubset: Set<CFUint32>
): UnitReindexResult | undefined {
    // validate subset
    for (const u of unitSubset) {
        if (u < 0 || u >= numUnits) {
            console.error(`pruneUnits: unitSubset contains invalid unit ${u}`);
            return undefined;
        }
    }

    if (unitSubset.size === 0) {
        console.error("pruneUnits: unitSubset is empty.");
        return undefined;
    }

    // filter by units
    const filtered: CFComparison[] = [];
    for (const [u, v, s, x] of dataset) {
        if (!unitSubset.has(u) || !unitSubset.has(v)) {
            continue;
        }
        filtered.push([u, v, s, x] as unknown as CFComparison);
    }

    // build unit map (sorted, so smallest unit becomes 0, etc.)
    const sortedUnits = Array.from(unitSubset).sort((a, b) => a - b);
    const unitMap = new Map<CFUnit, CFUnit>();
    sortedUnits.forEach((oldId, newId) => unitMap.set(oldId, newId as CFUnit));

    // rebuild dataset with new u/v
    const reindexed: CFComparison[] = [];
    const seen = new Set<string>();

    for (const [u, v, s, x] of filtered) {
        const newU = unitMap.get(u);
        const newV = unitMap.get(v);

        if (newU === undefined || newV === undefined) {
            console.error("pruneUnits: unexpected missing unit mapping.");
            return undefined;
        }

        const key = `${newU}|${newV}|${s}`; // s unchanged here
        if (seen.has(key)) {
            console.error(`pruneUnits: duplicate (u,v,s) after reindexing: (${newU}, ${newV}, ${s})`);
            return undefined;
        }
        seen.add(key);

        reindexed.push([newU, newV, s, x] as unknown as CFComparison);
    }

    return {
        dataset: reindexed,
        unitMap,
    };
}

/**
 * Filters a dataset to a subset of series indices and reindexes them
 * to be contiguous {0, 1, ..., seriesSubset.size - 1}.
 *
 * Returns a new dataset and a map oldSeries -> newSeries.
 */
export function pruneSeries(
    dataset: CFValidCompDataSet,
    numSeriesIndices: CFUint32,
    seriesSubset: Set<CFUint32>
): SeriesReindexResult | undefined {
    // validate subset
    for (const s of seriesSubset) {
        if (s < 0 || s >= numSeriesIndices) {
            console.error(`pruneSeries: seriesSubset contains invalid series ${s}`);
            return undefined;
        }
    }

    if (seriesSubset.size === 0) {
        console.error("pruneSeries: seriesSubset is empty.");
        return undefined;
    }

    // filter by series
    const filtered: CFComparison[] = [];
    for (const [u, v, s, x] of dataset) {
        if (!seriesSubset.has(s)) {
            continue;
        }
        filtered.push([u, v, s, x] as unknown as CFComparison);
    }

    // build series map
    const sortedSeries = Array.from(seriesSubset).sort((a, b) => a - b);
    const seriesMap = new Map<CFSeriesIndex, CFSeriesIndex>();
    sortedSeries.forEach((oldId, newId) => seriesMap.set(oldId, newId as CFSeriesIndex));

    // rebuild with new s
    const reindexed: CFComparison[] = [];
    const seen = new Set<string>();

    for (const [u, v, s, x] of filtered) {
        const newS: CFSeriesIndex | undefined = seriesMap.get(s);

        if (newS === undefined) {
            console.error("pruneSeries: unexpected missing series mapping.");
            return undefined;
        }

        const key = `${u}|${v}|${newS}`;
        if (seen.has(key)) {
            console.error(
                `pruneSeries: duplicate (u,v,s) after reindexing: (${u}, ${v}, ${newS})`
            );
            return undefined;
        }
        seen.add(key);

        reindexed.push([u, v, newS, x] as unknown as CFComparison);
    }

    return {
        dataset: reindexed,
        seriesMap,
    };
}

/**
 * Prunes a dataset to subsets of units and series indices, and re-indexes both
 * so the resulting indices are contiguous (0..N).
 *
 * Steps:
 * 1. Run unit pruning/reindexing.
 * 2. Run series pruning/reindexing on the result of step 1.
 *
 * Returns the final dataset and both maps, or undefined on error.
 *
 * See docs for 'pruneUnits' for an example.
 */
export function pruneDataset(
    dataset: CFValidCompDataSet,
    numUnits: CFUint32,
    numSeriesIndices: CFUint32,
    unitSubset: Set<CFUnit>,
    seriesSubset: Set<CFSeriesIndex>
): ReindexResult | undefined {
    // first do units
    const unitsResult = pruneUnits(dataset, numUnits, unitSubset);
    if (!unitsResult) {
        return undefined;
    }

    // then do series on the unit-pruned dataset
    const seriesResult = pruneSeries(
        unitsResult.dataset,
        numSeriesIndices,
        seriesSubset
    );
    if (!seriesResult) {
        return undefined;
    }

    return {
        dataset: seriesResult.dataset,
        unitMap: unitsResult.unitMap,
        seriesMap: seriesResult.seriesMap,
    };
}
