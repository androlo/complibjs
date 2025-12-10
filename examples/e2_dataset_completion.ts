import {
    CFCompFuncBinary,
    CFCompData,
    CFSeriesIndex,
    CFUnit,
    CFValidCompDataSet,
    createBinaryCompFunc,
    toUint32,
    validateBinaryCompData,
    getStandardCloseOptions,
    processData
} from "../src";

/**
 * Example:
 *
 * Here we will automatically complete a dataset with computed comparisons.
 */
function datasetCompletion(): void {

    // We start with the plank example from the previous example, without dataset completion.
    // Here we will cheat and do casts. Sound math is very important, so we shouldn't go
    // too far off the reservation, but for integer literals it is, of course, fine.
    const d = 0 as CFUnit; // CFUnit is just an alias for CFUint32.
    const m = 1 as CFUnit;
    const s = 0 as CFSeriesIndex; // CFSeriesIndex is just an alias for CFUint32.

    const val = [1.99, 2.01] as const;

    const dataSet: CFCompData[] = [[d, m, s, val]];

    const numUnits = toUint32(2)!;
    const numSeriesIndices = toUint32(1)!;

    let compFunc : CFCompFuncBinary;

    try {
        compFunc = createBinaryCompFunc(dataSet, numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // Now we have the compFunc; let's look at some of its features.

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
    // For this, we will use a standard fill where (d, d, 0) and (m, m, 0) are added with
    // values [1, 1], and (m, d, 0) becomes [1, 1]/[1.99, 2.01].
    const closeOpts = getStandardCloseOptions();

    // We also need to validate the data-set first. This is done automatically when creating
    // comparison functions, meaning an array of CFCompData will do, but here we need explicit
    // validation. Thus, we need 'validateBinaryCompData' to cast it into a CFComparison array.

    let completedDataSet: CFValidCompDataSet;

    // completedDataSet = processData(dataSet, numUnits, numSeriesIndices, closeOpts); <- Does not work.

    if(validateBinaryCompData(dataSet, numUnits, numSeriesIndices)) {
        try {
            completedDataSet = processData(dataSet, numUnits, numSeriesIndices, closeOpts); // <-- Works
        } catch (e) {
            // Should not happen.
            if (e instanceof Error) console.error("Error processing data:", e.message);
            return;
        }
    } else {
        throw new Error("Invalid data set! Should not happen!");
    }

    // Now we create a comparison function from the completed dataset. Note that we are simply re-using
    // the variable 'compFunc' - we're not modifying the original comparison function.
    // Also, createBinaryCompFunc will accept a pre-validated array, but it will still re-validate.
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

    // With orthogonality, we must also have a basis.
    const basis = compFunc.B_FRAME(s);

    // The basis should be {{d, m}}, since we only have one base class which contains both 'd' and 'm'.


    // Finally, we print the values.
    console.log("Everything worked as expected!");
    console.log("Original dataset:");
    console.log(JSON.stringify(dataSet, null, 0));
    console.log("Completed dataset:");
    console.log(JSON.stringify(completedDataSet, null, 0));
    console.log("Basis:");
    console.log(JSON.stringify(basis, null, 0));

    return;
}

datasetCompletion();