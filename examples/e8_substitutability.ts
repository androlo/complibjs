import {
    CFCompFuncBinary,
    CFComparison,
    CFCompData,
    CFReal,
    CFUint32,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createBaseUnitFunctionInverse,
    toUint32,
    validateBinaryCompData,
    processData,
    getStandardCloseOptions,
    degSub,
    substitutable,
    ALGEBRA_REAL
} from "../src";

/**
 * Example:
 *
 * Here we will look at substitutability, and how we can equate it with orthogonality. We will also
 * look at how it works on non-orthogonal comparison functions.
 */
function substitutability(): void {

    // We start with the dataset from e4 - orthogonal substructure.

    // We first define the dataset.
    // d0 - a distance
    // d1 - another distance
    // m - the meter
    // t - a time
    // s - the second.
    const [d0, d1, m, t, s] = [0, 1, 2, 3, 4] as CFUint32[];

    // Series indices (using 'i' since 's' means a second here).
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
        throw new Error("Validating completed dataset failed - this should not happen!");
    }

    let compFunc : CFCompFuncBinary;

    try {
        compFunc = createBinaryCompFunc(completedDataSet, numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // Quick sanity check - the function should be orthogonal on both frames.
    if(!compFunc.ORT_CF()){
        throw new Error("CompFunc is not orthogonal!");
    }

    // Now we want to check the substitutability of unit functions. Let's create one for d0, one for d1,
    // and one for t.
    const fd0 = createBaseUnitFunction(compFunc, d0);
    const fd1 = createBaseUnitFunction(compFunc, d1);
    const ft = createBaseUnitFunction(compFunc, t);

    // The theorem on base unit functions and substitutability promises that fd0 and fd1
    // are substitutable. Let's check.
    const isSubDist = substitutable(fd0, fd1);
    if(!isSubDist){
        throw new Error("fd0 and fd1 are not substitutable!");
    }
    // The theorem also promises that base unit functions taken from different base classes are
    // not substitutable.
    const isSubDistTime = substitutable(fd0, ft);
    if(isSubDistTime){
        throw new Error("fd0 and ft are substitutable!");
    }

    // Next, we go on to compute degree of substitutability. It should be 1 for fd0 and fd1,
    // and 0 for ft0 and ft.
    const dSubDist = degSub(fd0, fd1);

    // We may have overflow and such, so we need to check that we got an actual value.
    if(dSubDist === undefined){
        throw new Error("Degree of substitutability for fd0 and fd1 is undefined!");
    }

    // Even though it should be fine to use !== here, since the quota is 0, we'll use
    // a safer check.

    if(!ALGEBRA_REAL.eq(dSubDist, 1 as CFReal)){
        throw new Error("Degree of substitutability is not 1 for fd0 and fd1!");
    }

    // Now, for distance and time.
    const dSubDistTime = degSub(fd0, ft);

    if(dSubDistTime === undefined){
        throw new Error("Degree of substitutability for fd0 and ft is undefined!");
    }

    if(!ALGEBRA_REAL.eq(dSubDistTime, 0 as CFReal)){
        throw new Error("Degree of substitutability is not 0 for fd0 and ft!");
    }

    // We will do a quick check for base unit function inverses as well.
    const fd0Inv = createBaseUnitFunctionInverse(compFunc, d0);
    const fd1Inv = createBaseUnitFunctionInverse(compFunc, d1);
    const ftInv = createBaseUnitFunctionInverse(compFunc, t);

    const isSubDistInv = substitutable(fd0Inv, fd1Inv);
    if(!isSubDistInv) {
        throw new Error("fd0Inv and fd1Inv are not substitutable!");
    }

    const isSubDistTimeInv = substitutable(fd0Inv, ftInv);
    if(isSubDistTimeInv){
        throw new Error("fd0Inv and ftInv are substitutable!");
    }

    // And one for a base unit function and its inverse.
    const isSubDistWithInv = substitutable(fd0, fd0Inv);
    if(!isSubDistWithInv){
        throw new Error("fd0 and fd0Inv are not substitutable!");
    }

    // (omitting the degree of substitutability for these checks.)

    // Finally, let's check on the equivalence theorem. We need the meter for this.
    const fm = createBaseUnitFunction(compFunc, m);

    const v_fd0_fd0 = substitutable(fd0, fd0);

    const v_fd0_fd1= substitutable(fd0, fd1);
    const v_fd1_fd0 = substitutable(fd1, fd0);

    const v_fd1_m = substitutable(fd1, fm);
    const v_fd0_m = substitutable(fd0, fm);

    // Reflexivity:
    if (!v_fd0_fd0) {
        throw new Error("fd0 and fd0 are not substitutable!");
    }

    // (left) Symmetry:
    if (v_fd0_fd1 && !v_fd1_fd0) {
        throw new Error("fd0 and fd1 are substitutable, but fd1 and fd0 are not!");
    }

    // Transitivity:
    if (v_fd0_fd1 && v_fd1_m && !v_fd0_m) {
        throw new Error("Transitivity failed!");
    }

    // This is it for now. In the next example, we will look at a few examples of base unit functions
    // on non-orthogonal comparison functions.

    console.log("Everything worked as expected!");
    return;
}

substitutability();