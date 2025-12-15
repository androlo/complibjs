/**
 * Example:
 *
 * A length observable "d" is the length of a wooden plank, and a meter observable "m" is the measuring stick.
 * Using the stick, we measure d to be about 2 meters, with an estimated error of ±1 cm.
 * That means the measured interval is from 1.99 m to 2.01 m.
 *
 * We assign integer unit labels: d = 0 and m = 1. We also use series index 0 (a single trial).
 *
 * In "comparison" form, this measurement is written as:
 *   f(0, 1, 0) = [1.99, 2.01]
 * or, using the readable names:
 *   f(d, m, 0) = [1.99, 2.01]
 *
 * Implicitly, this says: the function f takes the triple (0, 1, 0) and returns the interval [1.99, 2.01].
 *
 * This is what we are going to model here.
 *
 * Relevant chapters in the document: 3 and 4.
 */
import {
    CFCompFuncBinary,
    CFCompData,
    createBinaryCompFunc,
    toUint32,
    ALGEBRA_IVAL
} from "../src";

export function measurePlank(): void {

    // Define units and series indices.
    const d = toUint32(0);
    const m = toUint32(1);
    const s = toUint32(0);

    // 'toUint32' will return null if the input is not an unsigned 32-bit number.
    // Technically, the CFUint32 type is not needed to form a comparison data-point, but
    // we will use d, m, and s as unit and series index arguments to the comparison function
    // later, and its methods are a bit more picky.

    // Since 0 and 1 are obviously unsigned 32-bit ints, this should not happen.
    if (d === null || m === null || s === null) {
        console.error("Invalid unit or series index!");
        return;
    }

    // The value needs to be an array [number, number] (not just any 'number[]'), so we use 'as const'.
    const x = [1.99, 2.01] as const;

    // Create a data point from d, m, s, and x, using the CFCompData array-format.
    // CFCompData is the "dirty", non-validated version of a CFComparison.
    const dataPoint: CFCompData = [d, m, s, x]; // This becomes the comparison: (d, m, s) -> x.

    // The comparison function factory expects an array of data points as input. The factory
    // will accept the "dirty" CFCompData array because it automatically checks that all the
    // data-points are valid comparisons and throws on failure.
    const dataSet = [dataPoint];

    // Specify the number of units and series indices (required for a built-in sanity check).
    const numUnits = toUint32(2);
    const numSeriesIndices = toUint32(1);

    // Like with the units and series index, this should not happen.
    if (numUnits === null || numSeriesIndices === null) {
        console.error("Invalid number used for numUnits or numSeriesIndices!");
        return;
    }

    // Now, create a variable for the comparison function.
    let compFunc : CFCompFuncBinary;

    try {
        // Create a comparison function from the data.
        // This will fail if the data is not valid, so we call it inside a try-catch block.
        compFunc = createBinaryCompFunc(dataSet,  numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) {
            // This should never happen because the data is ok:
            // 1. All units are in [0, numUnits - 1], and all units in that range are present in the dataset
            //    (0 and 1 in this case).
            // 2. All series indices are in [0, numSeriesIndices - 1], and all series indices in that range
            //    are present in the dataset (0 in this case).
            // 3. There are no duplicate data points.
            // 4. The value is valid for the algebra (type [lo: number, hi: number], both numbers are finite,
            //    we don't have lo = hi = 0, and lo <= hi.
            console.error("Error creating comparison function:", e.message);
        }
        return;
    }

    // Now we try to evaluate the function at (d, m, s).
    const valueGot = compFunc.get(d, m, s);

    // Since we used valid units and series indices, the value should be present in the data.
    if (valueGot === undefined) {
        console.error("Value for (u, v, s) should not be undefined!");
        return;
    }

    // We should also not get the null element. We check using ALGEBRA_IVAL, which is a singleton of the
    // interval algebra. Another choice is to make our own "new CFValueAlgebraIval();"
    if (ALGEBRA_IVAL.isNull(valueGot)) {
        console.error("Value for (u, v, s) should not be the null element!");
        return;
    }

    // Print the value using the algebra's print method.
    console.log("Value got:", ALGEBRA_IVAL.print(valueGot));

    // A comparison function is defined on UxUxS, meaning we should be able to evaluate it at (m, d, s) as well,
    // but it should give us the null element.
    const nullValue = compFunc.get(m, d, s);

    // This should not be the case.
    if (nullValue === undefined) {
        console.error("Value for (m, d, s) should not be undefined!");
        return;
    }

    // This should also not be the case.
    if(!ALGEBRA_IVAL.isNull(nullValue)) {
        console.error("Value for (m, d, s) should be the null element!");
    }

    // Now we try and get a value outside the range by using the number 2 as a unit.
    // Note that with 'get', units and series indices do not have to be CFUint32 - they are
    // checked as part of the get function.
    const badValue = compFunc.get(2, m, s);

    if (badValue !== undefined) {
        console.error("Value for (2, m, s) should be undefined!");
    }

    // Finally, we have another function, 'getUnsafe', to get values. 'getUnsafe' requires the
    // units and series indices to be CFUint32 (using their aliases CFUnit and CFSeriesIndex
    // in the code), but it does not perform any bounds checks (e.g., u < numUnits). This is
    // useful when iterating over existing units and series indices, for example, as it avoids
    // having to check bounds for every get. If units or series indices are out-of-bounds,
    // the behavior of 'getUnsafe' is undefined.
    const unsafeValue = compFunc.getUnsafe(d, m, s);

    // Since we know that the value is present:
    if(unsafeValue === undefined){
        console.error("Value for (d, m, s) should not be undefined!");
    }


    console.log("Everything worked as expected!");

    return;
}

measurePlank();