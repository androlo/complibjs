import {
    CFCompData,
    CFCompFuncBinary,
    CFIval,
    CFUint32,
    createBinaryCompFunc,
    toUint32,
    CFComparison,
    validateBinaryCompData,
    ALGEBRA_IVAL,
    CloseOptions,
    processData
} from "../src";

/**
 * Example:
 *
 * Here we will automatically complete a dataset with computed comparisons to make it SI compatible.
 */
export function datasetCompletionAdvanced(): void {

    // We start with the plank example from the previous example, without dataset completion.
    const d = toUint32(0)!; // We cheat and use '!' here because we know the value is non-null.
    const m = toUint32(1)!;
    const s = toUint32(0)!;
    const val = [1.99, 2.01] as const;

    const dataSet: CFCompData[] = [[d, m, s, val]];
    const numUnits = 2 as CFUint32, numSeriesIndices = 1 as CFUint32;

    let compFunc : CFCompFuncBinary;

    try {
        compFunc = createBinaryCompFunc(dataSet, numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // Now we have the compFunc; let's first look at some of its features.

    // We should not have reflexivity of either unit, nor frame 0, nor the entire comparison function
    // (which is the same as frame 0).
    if(compFunc.R(d, s) || compFunc.R(m, s) || compFunc.R_FRAME(s) ||  compFunc.R_CF() ){
        throw new Error("Reflexivity holds!");
    }

    // We should also not have symmetry.
    if(compFunc.S(d, m, s) || compFunc.S_FRAME(s) || compFunc.S_CF() ){
        throw new Error("Symmetry holds!");
    }

    // We should have transitivity. The reason is that transitivity checks all units for:
    // E(u, v, s) && E(v, w, s) => E(u, w, s).
    // In this case, U = {d, m}, and we only have one comparison, (d, m, s), so one of the two
    // existence checks in the conjunction must always be false, meaning the implication is always true.
    if (!(compFunc.T_FRAME(s) && compFunc.T_CF())){
        throw new Error("Transitivity does not hold!");
    }

    // Since we don't have reflexivity, symmetry, and transitivity, there is no orthogonality.
    if (compFunc.ORT_FRAME(s) || compFunc.ORT_CF()){
        throw new Error("Orthogonality holds!");
    }

    // Next, we will complement the dataset to make it reflexive, symmetric, and transitive.
    // For this, we will use the following functions:

    // Use ONE for (d, d, s) and (m, m, s).
    const refFunc = () => ALGEBRA_IVAL.one();
    // For all (u, v, s), just invert its value for (v, u, s), meaning x -> [1,1]/x
    const symFunc = (x: CFIval) => ALGEBRA_IVAL.inv(x);
    // For all (u, v, s) and (v, w, s), just multiply their values for (u, w, s)
    const transFunc = (x: CFIval, y: CFIval) => ALGEBRA_IVAL.mul(x, y);

    // Next is a validator function. This is used when one of the above functions is used to generate
    // a value, but there is already a value in place. For example, symFunc will cover keys of
    // the form (u, u, s) as well. Since 'refFunc' has already produced those, we need to check
    // that the value from symFunc "agrees" with the existing value - in which case we just leave
    // it. For intervals, we will do this by checking that the existing value is a subinterval of
    // the one we generated.
    //
    // This check makes sense because ref, sym, and trans are increasingly complex and are run in
    // that order. ref produces no error ([1, 1] has error 0), sym does [1, 1]/[a, b] which may have
    // error only in the denominator, and trans does [a, b]*[c, d], which may have error in both terms.
    // This is important because the generator functions overlap, e.g., symFunc (u, v) -> (v, u) will
    // run for pairs (u, u) as well. Thus, in terms of minimizing unnecessary error propagation:
    //      existing > refValue > symValue > transValue
    //
    // The golden rule is: more math -> more error.

    const EPS = 1e-7; // Admit a small floating point error.

    const validateFunc = (generated: CFIval, existing: CFIval) => {
        const [gMin, gMax] = generated;
        const [eMin, eMax] = existing;
        return (gMin <= eMin + EPS) && (gMax >= eMax - EPS);
    };

    // Now we bundle these functions up into an object. If refFunc, symFunc, or transFunc is undefined,
    // then the corresponding rule is not applied. Note also that even though we had transitivity for
    // the original dataset, we may not have it for the new one unless we add the transFunc to ensure
    // it. If we run either refFunc or symFunc, we will get more comparisons in the set, and
    // transitivity may not hold "automatically" for the new set - which is why we run all three.
    const closeOpts: CloseOptions = {
        refFunc,
        symFunc,
        transFunc,
        validateFunc
    };

    // Note that these are standard functions for intervals and exist as a pre-packaged bundle as well:
    // const processOpts = getStandardCloseOptions();

    // Get the complemented dataset.

    let completedDataSet: CFComparison[];
    if (validateBinaryCompData(dataSet, numUnits, numSeriesIndices)) {
        try {
            completedDataSet = processData(dataSet, numUnits, numSeriesIndices, closeOpts);
        } catch (e) {
            // Should not happen.
            if (e instanceof Error) console.error("Error processing data:", e.message);
            return;
        }
    } else {
        throw new Error("Invalid data set! Should not happen!");
    }

    // Now create a comparison function from the completed dataset.
    try {
        compFunc = createBinaryCompFunc(completedDataSet, numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // Let's check the same properties as before.

    // We should have reflexivity.
    if(!(compFunc.R(d, s) && compFunc.R(m, s) && compFunc.R_FRAME(s) && compFunc.R_CF())){
        throw new Error("Reflexivity does not hold!");
    }

    // We should have symmetry.
    if(!(compFunc.S(d, m, s) && compFunc.S_FRAME(s) && compFunc.S_CF()) ){
        throw new Error("Symmetry does not hold!");
    }

    // We should have transitivity.
    if (!(compFunc.T_FRAME(s) && compFunc.T_CF())){
        throw new Error("Transitivity does not hold!");
    }

    // And orthogonality.
    if (!(compFunc.ORT_FRAME(s) && compFunc.ORT_CF())){
        throw new Error("Orthogonality does not hold!");
    }

    console.log("Everything worked as expected!");
    console.log("Original dataset:");
    console.log(JSON.stringify(dataSet, null, 0));
    console.log("Completed dataset:");
    console.log(JSON.stringify(completedDataSet, null, 0));

    return;
}

datasetCompletionAdvanced();