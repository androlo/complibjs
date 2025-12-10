import {
    ALGEBRA_IVAL,
    CFCompFuncBinary,
    CFCompData,
    CFIval,
    CFReal,
    CFSeriesIndex,
    CFUnit,
    CFValidCompDataSet,
    createBinaryCompFunc,
    createBaseUnitFunction,
    toUint32,
    validateBinaryCompData,
    getStandardCloseOptions,
    processData
} from "../src";

/**
 * Example:
 *
 * Here we will create unit functions for 'd' and 'm' in the running plank example.
 */
function datasetCompletion(): void {

    // We start with the plank example from the previous example, and complete the dataset.
    const d = 0 as CFUnit;
    const m = 1 as CFUnit;
    const s = 0 as CFSeriesIndex;

    // We will make the value a proper CFIval, as we will use it as such later.
    const val: CFIval = [1.99 as CFReal, 2.01 as CFReal];

    const dataSet: CFCompData[] = [[d, m, s, val]];

    const numUnits = toUint32(2)!;
    const numSeriesIndices = toUint32(1)!;

    const closeOpts = getStandardCloseOptions();

    // We must validate before completing the dataset.
    let completedDataSet: CFValidCompDataSet;

    if(validateBinaryCompData(dataSet, numUnits, numSeriesIndices)) {
        try {
            completedDataSet = processData(dataSet, numUnits, numSeriesIndices, closeOpts);
        } catch (e) {
            if (e instanceof Error) console.error("Error processing data:", e.message);
            return;
        }
    } else {
        throw new Error("Invalid data set! Should not happen!");
    }

    // Make the comparison function.
    let compFunc : CFCompFuncBinary;

    try {
        compFunc = createBinaryCompFunc(completedDataSet, numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // Now we have the compFunc. Let's create a base unit function for 'd', and one for 'm'.
    const fd = createBaseUnitFunction(compFunc, d);
    const fm = createBaseUnitFunction(compFunc, m);

    // To get a value from a unit function, we use 'f.get'. The same rules apply as for comparison
    // functions - if the unit or series index is out-of-bounds, the value is undefined.
    if(fd.get(5, 7) !== undefined){
        throw new Error("Base unit function for d returns values for out-of-bounds arguments");
    }

    // We should have fd(d, 0) = fm(m, 0) = [1, 1], since those evaluate to (d, d, 0) and (m, m, 0),
    // which has been completed using the 'one' value for reflexivity (standard completion).

    if(!ALGEBRA_IVAL.eq(fd.get(d, s)!, ALGEBRA_IVAL.one()) ){
        throw new Error("Base unit function for d has wrong value for argument d");
    }

    if(!ALGEBRA_IVAL.eq(fm.get(m, s)!, ALGEBRA_IVAL.one()) ){
        throw new Error("Base unit function for m has wrong value for argument m");
    }

    // Next, we started with the value [d, m, s, [1.99, 2.01]], thus, we need fd(m, s) = [1.99, 2.01].
    // (note that this is where 'val' must be of type CFIval, not just a 2D array of 'number').
    if(!ALGEBRA_IVAL.eq(fd.get(m, s)!, val)) {
        throw new Error("Base unit function for d has wrong value for argument m");
    }

    // Finally, for fm(d, 0), the default completion policy gives [1, 1]/[1.99, 2.01].
    if(!ALGEBRA_IVAL.eq(fm.get(d, s)!, ALGEBRA_IVAL.div(ALGEBRA_IVAL.one(), val)) ){
        throw new Error("Base unit function for m has wrong value for argument d");
    }

    // Next, let's multiply the two functions. Note that for addition, subtraction, multiplication,
    // and division, the unit function operands must both have the same dimension or the result is
    // undefined.
    const prod = fd.mul(fm);

    // Should not happen.
    if (prod === undefined) {
        throw new Error("Product of base unit functions is undefined!");
    }

    // This function should give prod(d, s) = fd(d, s) * fm(d, s). Since fd(d, s) = [1, 1],
    // we should have prod(d, s) = fm(d, s).
    if(!ALGEBRA_IVAL.eq(prod.get(d, s)!, fm.get(d, s)!) ){
        throw new Error("Product of base unit function product does not hold!");
    }

    // For the argument 'm': prod(m, s) = fd(m, s) * fm(m, s) = fd(m, s).
    if(!ALGEBRA_IVAL.eq(prod.get(m, s)!, fd.get(m, s)!) ){
        throw new Error("Product of base unit function product does not hold!");
    }

    // Now, let's scale one of the functions (can't cause dimensional mismatches so always returns a function).
    const sc = [3, 5] as [CFReal, CFReal];
    const sProd = fd.smul(sc);

    // Each of its values should now be scaled by [3, 5].
    if(!ALGEBRA_IVAL.eq(sProd.get(d, s)!, ALGEBRA_IVAL.mul(sc, fd.get(d, s)!) ) ){
        throw new Error("Scaled product of base unit function does not hold!");
    }
    if(!ALGEBRA_IVAL.eq(sProd.get(m, s)!, ALGEBRA_IVAL.mul(sc, fd.get(m, s)!) ) ){
        throw new Error("Scaled product of base unit function does not hold!");
    }

    // Let's build the tensor product next (can't cause dimensional mismatches so always returns a function).
    const tProd = fd.tmul(fm);

    // This function should take two arguments. Let's try for all possible combinations.
    const tdd = tProd.get(d, d, s)!;
    const tdm = tProd.get(d, m, s)!;
    const tmd = tProd.get(m, d, s)!;
    const tmm = tProd.get(m, m, s)!;

    // For readability, also get the values for fu and fm.
    const fdd = fd.get(d, s)!;
    const fdm = fd.get(m, s)!;
    const fmd = fm.get(d, s)!;
    const fmm = fm.get(m, s)!;

    // It is easy to work these products out, e.g., tdm = fd(d, s) * fm(d, s) = fm(d, s),
    // but we will test all values.

    if(!ALGEBRA_IVAL.eq(tdd, ALGEBRA_IVAL.mul(fdd, fmd))){
        throw new Error("Tensor product of base unit functions does not hold!");
    }

    if(!ALGEBRA_IVAL.eq(tdm, ALGEBRA_IVAL.mul(fdd, fmm))){
        throw new Error("Tensor product of base unit functions does not hold!");
    }

    if(!ALGEBRA_IVAL.eq(tmd, ALGEBRA_IVAL.mul(fdm, fmd))){
        throw new Error("Tensor product of base unit functions does not hold!");
    }

    if(!ALGEBRA_IVAL.eq(tmm, ALGEBRA_IVAL.mul(fdm, fmm))){
        throw new Error("Tensor product of base unit functions does not hold!");
    }

    // Finally, let's try subtraction of fd with itself.
    const sub = fd.sub(fd);

    // Should not happen.
    if(sub === undefined) {
        throw new Error("Subtraction of base unit functions is undefined!");
    }

    // The value for (d, s) should be [1, 1] - [1, 1] = [0, 0].
    if(!ALGEBRA_IVAL.isNull(sub.get(d, s)!)){
        throw new Error("Subtraction of base unit functions does not hold!");
    }

    // For (m, s) it gets more complicated because of how interval subtraction works. Generally:
    // I - I != [0, 0]. The reason is that the algebra does not eliminate errors, meaning I - I is
    // only [0, 0] when I is of the form [x, x]. Here, the result we will be [-e, e], where e is
    // the error for [1.99, 2.01], so e = 0.02 (floating point errors omitted).
    console.log("fd(m, s) - fd(m, s) = ", sub.get(m, s) );

    // That's the end of this example.
    console.log("Everything worked as expected!");

    return;
}

datasetCompletion();