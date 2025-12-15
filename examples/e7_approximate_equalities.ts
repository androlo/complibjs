import {
    ALGEBRA_IVAL,
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

/**
 * Example:
 *
 * Here we will look at an example of how approximate equality can be used to sort units into groups
 * in which each unit can be replaced by another. As a simple example, if we have
 * f(u, v, s) ~ f(u, w, s) for some units u, v, and w, there is reason to suspect that w and v are
 * replaceable - but are they?
 *
 * This example will use orthogonality and value rationality (from the last example) to help make
 * a few predictions.
 */
export function approximateEqualities(): void {

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
        [d0, m, i0, [1.49, 1.51]], // The first and second comparison has equal values.
        [d0, d1, i0, [1.49, 1.51]],
        [t, s, i0, [1.0, 1.01]],
        [d0, m, i1, [3.29, 3.31]], // That is not the case for frame 1.
        [d0, d1, i1, [0.41, 0.44]],
        [t, s, i1, [2, 2.01]]
    ]

    const numUnits = toUint32(5)!;
    const numSeriesIndices = toUint32(2)!;

    // We do not complete this dataset.


    let compFunc : CFCompFuncBinary;

    try {
        compFunc = createBinaryCompFunc(dataSet, numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // Start by concluding that f(d0, m, i0) and f(d0, d1, i0) are in fact equal.
    const v_d0_m = compFunc.get(d0, m, i0)!; // Cheating with '!'.
    const v_d0_d1 = compFunc.get(d0, d1, i0)!;

    if(!ALGEBRA_IVAL.eq(v_d0_m, v_d0_d1)){
        throw new Error("Values for d0 and d1 are not equal!");
    }

    // Does this mean m and d1 are replaceable? Let's check f(m, d1, 0) and f(d1, m, 0) first.
    const v_m_d1 = compFunc.get(m, d1, i0)!;
    const v_d1_m = compFunc.get(d1, m, i0)!;
    if(!ALGEBRA_IVAL.eq(v_m_d1, v_d1_m)){
        throw new Error("Values for m and d1 are not equal!");
    }

    // Looking good! Except:
    if(!ALGEBRA_IVAL.isNull(v_m_d1) || !ALGEBRA_IVAL.isNull(v_d1_m)){
        throw new Error("Values for m and d1 are not null!");
    }

    // They are both null. This is because we did not provide those comparisons. Thus, even though
    // f(d0, m, 0) and f(d0, d1, 0) are equal, we cannot conclude that m and d0 are replaceable.


    // Now we create a new comparison function from a SI-completed dataset.
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

    try {
        compFunc = createBinaryCompFunc(completedDataSet, numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // This will fill out the dataset with f(d0, m, 0) and f(d0, d1, 0). So, let's check them now.
    const v_m_d1_cpl = compFunc.get(m, d1, i0)!;
    const v_d1_m_cpl = compFunc.get(d1, m, i0)!;
    if(!ALGEBRA_IVAL.eq(v_m_d1_cpl, v_d1_m_cpl)){
        throw new Error("Values for m and d1 are not equal!");
    }

    // Looking good again, however, this time:
    if(ALGEBRA_IVAL.isNull(v_m_d1_cpl) || ALGEBRA_IVAL.isNull(v_d1_m_cpl)){
        throw new Error("One of the values for m and d1 are null!");
    }

    // They are not null! So, what are they?
    console.log("Values for f(m, d1, 0) and f(d1, m, 0) are:", v_m_d1_cpl, v_d1_m_cpl);

    // Values for f(m, d1, 0) and f(d1, m, 0) are: ~[ 0.99, 1.01 ] and ~[ 0.99, 1.01 ]
    // So, pretty close to one. They are also, in fact, strictly equal. But how come?

    // The reason we get this equality is because of the completion algorithm. In the original
    // dataset we have:
    //
    // [d0, m, i0, [1.49, 1.51]]
    // [d0, d1, i0, [1.49, 1.51]]
    //
    // This gives us no direct relation between d1 and m. The algorithm will create it as such:
    // 1. Reflexivity runs first: d1 and m are different units, so this does not help.
    // 2. Symmetry runs second: There is no f(d1, m, 0) or f(m, d1, 0) to compute symmetry from,
    //    so this does nothing.
    // 3. Transitivity runs last, and it can detect:
    //    a) We have f(d1, d0, 0) from symmetry with f(d0, d1, 0), which is in the original dataset.
    //       this makes f(d1, d0, 0) = [1,1]/f(d0, d1, 0) = [1, 1]/[1.49, 1.51] ~ [0.66, 0.67].
    //    b) We have f(d0, m, 0) in the original dataset.
    //    c) Thus, f(d1, m, 0) = f(d1, d0, 0)*f(d0, m, 0) = [0.66, 0.67]*[1.49, 1.51] ~ [0.99, 1.01].

    // Thus, the value-rationality imposed by the SI-compliant completion algorithm leads to this
    // equality. This makes sense from a practical point of view too: if we have a distance measured
    // in two different units, and the values are very close, then we can expect the two measurement
    // units to be very similar, i.e., the ratios of their lengths should be close to 1.

    // We can also look at this as ratios:
    // Suppose a, b, c > 0. If a/b = a/c, then c = b.
    //
    // With error:
    //   |a/b − a/c| <= ε
    // Using a common denominator: a/b − a/c = a(c − b)/(bc):
    //   |c − b|a/(bc) <= ε => |c − b| <= ε(bc/a).
    // Thus, if ε is very small, then |c - b| will be small, and for ε = 0 we get b = c.

    console.log("Everything worked as expected!");
    return;
}

approximateEqualities();