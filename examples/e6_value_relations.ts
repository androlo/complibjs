import {
    CFCompData,
    CFCompFuncBinary,
    CFUint32,
    CFValidCompDataSet,
    createBinaryCompFunc,
    getStandardCloseOptions,
    processData,
    toUint32,
    validateBinaryCompData
} from "../src";
import {
    VR_FRAME_Error,
    VRAT_V_Error,
    VS_FRAME_Error,
    VS_V_Error,
    VT_FRAME_Error,
    VT_V_Error
} from "../src/vrel";

/**
 * Example:
 *
 * Here we will look at the values of comparisons. The previous examples showed relations
 * such as reflexivity, symmetry, and transitivity. Those are all existence-based, meaning
 * they only care about whether values exist or not. Here we will use relations that care
 * about what the values are.
 */
function valueRelations(): void {

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

    // With the fixtures in place, we now look at the value relations, starting with reflexivity.
    // We get the minimum error for reflexivity by calling CF_FRAME_Error (minimum meaning the
    // smallest error 'err' that yields VR(compFunc, U, s, err) = true.
    const errRef = VR_FRAME_Error(compFunc, i0);

    // The error can be undefined, e.g., because of distance function over/underflow. Should not happen here.
    if(errRef === undefined) {
        throw new Error("Reflexivity error is undefined!");
    }

    console.log("Reflexivity error for frame 0:", errRef);

    // The error is 0, because the standard completion algorithm sets all values (u, u, s) to [1, 1].
    if(errRef !== 0){
        throw new Error("Reflexivity error is not 0!");
    }

    // Now value symmetry.
    const errSym = VS_FRAME_Error(compFunc, i0);

    if(errSym === undefined) {
        throw new Error("Symmetry error is undefined!");
    }

    console.log("Symmetry error for frame 0:", errSym);

    // As we can see here, the error is 1, which is very big. This is because we are testing for
    // symmetry for null values too. The formula is dist( f(u, v, s)*f(v, u, s), [1, 1] ). Thus,
    // for null values we get dist ( [0, 0], [1, 1] ). Let's constrain our test to only "length"
    // units.
    const errSymLen = VS_V_Error(compFunc, [d0, d1, m], i0);

    if(errSymLen === undefined) {
        throw new Error("Symmetry error for length units is undefined!");
    }

    console.log("Symmetry error for length units in frame 0:", errSymLen);

    // The error is now ~0.11, which makes good sense, since the symmetry closure algorithm
    // adds f(v, u, s) = [1, 1] / x, for f(u, v, s) = x, which produces some error.

    // Finally, value transitivity.
    const errTrans = VT_FRAME_Error(compFunc, i0);

    if(errTrans === undefined) {
        throw new Error("Transitivity error is undefined!");
    }

    console.log("Transitivity error for frame 0:", errTrans);

    // Pretty large error: ~4.87. This is for the same reason as for symmetry. The formula is:
    // dist( f(u, v, i)*f(v, w, i), f(u, w, i) ). Take as an example the triple (d0, t, m).
    // The value for f(d0, t, i) is null, and so is f(t, m, i), but f(d0, m, i) is [3.29, 3.31],
    // yielding an error close to 3.3: d([0, 0], [3.29, 3.31]).

    // Let's try only for lengths.
    const errTransLen = VT_V_Error(compFunc, [d0, d1, m], i0);
    if(errTransLen === undefined) {
        throw new Error("Transitivity error for length units is undefined!");
    }
    console.log("Transitivity error for length units in frame 0:", errTransLen);

    // The new value is much better, ~0.15. In relation to the sizes of the values, we have reasonable
    // errors for the length units in all cases.

    // Finally, value rationality will only hold for the largest error between VR, VS, and VT. For
    // the length units, that is the transitivity error; thus,  we should have:
    // VRAT(f, {d0, d1, m}, s, errTransLen).

    // Let's verify. Also, note that this calls VRAT_V as a method from compFunc, since it is just
    // value rationality as per the framework specification. It returns a boolean, not an error.
    const vRatLen = compFunc.VRAT_V([d0, d1, m], i0, errTransLen);

    // Should not happen.
    if(!!vRatLen) {
        throw new Error("Value rationality for length units is false!");
    }

    // Finally, let's check the "time" error:
    const errRatTime = VRAT_V_Error(compFunc, [t, s], i0);
    if(errRatTime === undefined) {
        throw new Error("Value rationality error for time units is undefined!");
    }

    console.log("Value rationality error for time units in frame 0:", errRatTime);

    // The error for the time units is 0.01, which is sensible.

    console.log("Everything worked as expected!");

    return;
}

valueRelations();