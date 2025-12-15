import {
    ALGEBRA_IVAL,
    CFCompFuncBinary,
    CFCompData,
    CFReal,
    CFUint32,
    createBinaryCompFunc,
    toUint32,
    validateBinaryCompData,
    getStandardCloseOptions,
    processData,
    pruneSeries,
    pruneUnits,
    CFValidCompDataSet
} from "../src";

import {print2DAdj} from "../src/presentation";

/**
 *  Example:
 *
 *  The purpose of this example is to show a slightly more advanced dataset and to look at orthogonal
 *  substructures.
 *
 *  We start with a toy experiment where two distances are measured against the meter, and a time
 *  against the second. Two groups of measurements are made.
 */
export function orthogonalSubstructure(): void {
    // We first define the dataset.
    // d0 - a distance
    // d1 - another distance
    // m - the meter
    // t - a time
    // s - the second.
    const [d0, d1, m, t, s] = [0, 1, 2, 3, 4] as CFUint32[];

    // Series indices (using 'i' since 's' means "a second" here).
    const i0 = toUint32(0)!, i1 = toUint32(1)!;

    const dataSet: CFCompData[] = [
        [d0, m, i0, [1.49, 1.51]],
        [d1, m, i0, [0.31, 0.34]],
        [t, s, i0, [1.0, 1.01]],
        [d0, m, i1, [3.29, 3.31]],
        [d1, m, i1, [0.41, 0.44]],
        [t, s, i1, [2, 2.01]],
    ]

    const numUnits = toUint32(5)!;
    const numSeriesIndices = toUint32(2)!;

    // We make the standard SI completion.
    const closeOpts = getStandardCloseOptions();

    let completedDataSet: CFValidCompDataSet;
    if(validateBinaryCompData(dataSet, numUnits, numSeriesIndices)){
        try {
            completedDataSet = processData(dataSet, numUnits, numSeriesIndices, closeOpts);
        } catch (e) {
            // Should not happen.
            if (e instanceof Error) console.error("Error processing data:", e.message);
            return;
        }
    } else {
        throw new Error("Validating completed dataset failed - this should not happen!");
    }

    let compFunc : CFCompFuncBinary;

    try {
        compFunc = createBinaryCompFunc(completedDataSet, numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // Sanity check - the function should be orthogonal on both frames.
    if(!compFunc.ORT_CF()){
        throw new Error("CompFunc is not orthogonal!");
    }

    // Print the 0/1 adjacency matrix for the first frame (the second is the same). It should
    // be a typical SI compatible block diagonal matrix.
    console.log("Adjacency matrix for frame 0:");
    console.log(print2DAdj(compFunc.adj(i0)!, ["d0", "d1", "m", "t", "s"]));

    // Get the degree of orthogonality for the first frame.
    const degO = compFunc.DO(i0);

    // Since we have orthogonality, the degree of orthogonality should be 1.
    if(degO !== 1){
        throw new Error("Degree of orthogonality is not 1!");
    }

    // We should also be able to check the different orthogonal subsets - which
    // in this case is every subset of the units. The OSS(_X) functions returns
    // a generator that yields the orthogonal subsets.
    const oss = compFunc.OSS_FRAME(i0);

    // Should not happen.
    if(oss === undefined){
        throw new Error("Orthogonal subsets are undefined!");
    }

    // Print a couple of the subsets.
    console.log("");
    for(let i = 0; i < 7; i++) {
        const setIt = oss.next();
        // Should not happen.
        if(setIt.done){
            throw new Error("Orthogonal subsets are exhausted!");
        }
        console.log("Orthogonal subset " + i + ":");
        console.log(setIt.value);
    }

    // Now we take an orthogonal subset and check if it is in fact orthogonal.
    // Start by getting another subset iterator-result from the generator.
    const subsetIt = oss.next();

    // This should not happen (compFunc is orthogonal, number of orthogonal subsets is 2^numUnits = 32).
    if (subsetIt.done) {
        throw new Error("Orthogonal subsets are exhausted!");
    }

    // Get the subset itself from the iterator-result.
    const subset = subsetIt.value as Set<CFUint32>;

    console.log("Subset:");
    console.log(Array.from(subset));

    // We will use a utility function to generate a new, filtered dataset based on 'subset'.
    // The function 'pruneUnits' requires a validated dataset as input, but 'completedDataSet'
    // was returned as a valid dataset from the function 'processData', into which we passed
    // our manually validated original 'dataSet'.
    let newDataRet = pruneUnits(completedDataSet, numUnits, subset);

    // This filtering should be fine - the subset is a valid subset of the units.
    if (newDataRet === undefined) {
        throw new Error("Filtered dataset is undefined!");
    }

    // Get the filtered dataset from the result - also a valid set, generated from our
    // valid 'completedDataSet'.
    const filteredDataSet = newDataRet.dataset;

    // The new number of units is the size of the subset.
    const newNumUnits = subset.size as CFUint32;

    // Create a new comparison function from the filtered dataset.
    try {
        compFunc = createBinaryCompFunc(filteredDataSet, newNumUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // It should be orthogonal.
    if(!compFunc.ORT_CF()){
        throw new Error("Filtered comparison function is not orthogonal!");
    }

    // Finally, the prune function re-indexes units so that they are of the form {0, 1, 2, ... }. This is
    // necessary because a subset can be, for example, {1, 3} - which is not a valid unit set.
    // The pruneUnits function also returns a map from the original units to the new units, so we can
    // use it to see what the new unit indices are.
    const unitMap = newDataRet.unitMap;

    // The subset happens to be {2, 3, 4}, or {m, t, s} in terms of the named original units.
    const newT = unitMap.get(t)!;
    const newS = unitMap.get(s)!;

    const val = compFunc.get(newT, newS, i0)!

    // 'val' should be [1.0, 1.01], as per the original data-point for [t, s, i0]
    if(!ALGEBRA_IVAL.eq(val, [1.0 as CFReal, 1.01 as CFReal])){
        throw new Error("Filtered comparison function has wrong value for [t, s, i0]");
    }

    // Finally, we can also reduce a data-set to a single frame by filtering based on series index.
    const frame0 = pruneSeries(completedDataSet, numSeriesIndices, new Set([i0]))!;

    try {
        compFunc = createBinaryCompFunc(frame0.dataset, numUnits, 1 as CFUint32); // numSeriesIndices = 1
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    const valFrame0 = compFunc.get(t, s, i0)!

    // This should (again) be [1.0, 1.01], as per the original data-point for [t, s, i0]

    if(!ALGEBRA_IVAL.eq(valFrame0, [1.0 as CFReal, 1.01 as CFReal])){
        throw new Error("Filtered comparison function has wrong value for [t, s, i0]");
    }

    console.log("Everything worked as expected!");

    return;
}

orthogonalSubstructure();