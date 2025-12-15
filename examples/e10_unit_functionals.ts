/**
 * Example:
 *
 * Here we will look at unit functionals, and some of their properties.
 */
import {
    ALGEBRA_IVAL,
    CFComparison,
    CFCompData,
    CFCompFuncBinary, CFDim, 
    CFIval, CFReal,
    CFUint32,
    CFUint32One,
    CFUint32Two,
    CFUnitFunc,
    createBinaryCompFunc,
    CFFunctionalStorageType,
    getStandardCloseOptions,
    createBaseUnitFunction,
    createConstUnitFunc,
    processData,
    toUint32,
    CFUFuncDomain,
    validateBinaryCompData
} from "../src";
import {CFUnitFunctionalAbstract, makeConstUnitFunctional} from "../src/ufunctional";

// This becomes important later.
class LinearComboUnitFunctional<UFDim extends CFDim> extends CFUnitFunctionalAbstract<
    CFUint32Two,
    CFFunctionalStorageType.Custom,
    UFDim
> {

    // We store intervals 'c0' and 'c1' to use in our computations.
    constructor(
        CFUFuncDomain: CFUFuncDomain<UFDim>,
        public readonly c0: CFIval,
        public readonly c1: CFIval
    ) {
        // We must pass dimension, storage type, and CFUFuncDomain to the constructor of the abstract class.
        // This functional takes 2 unit function arguments, so dimension is 2.
        // It can be set to accept any possible dimension for unit functions, so CFUFuncDomain has
        // generic type argument UFDim.
        super(2 as CFUint32Two, CFFunctionalStorageType.Custom, CFUFuncDomain);
    }

    // we only implement getUnsafe. 'get' is implemented in the abstract class; it checks that the
    // 'funcs' parameter number matches the dimension of the unit functional, and that each function
    // argument domain is equal to CFUFuncDomain (dimension, number of units, and number of series indices).
    getUnsafe(...funcs: CFUnitFunc<CFUint32One>[]): CFUnitFunc<CFUint32One> | undefined {
        const f0 = funcs[0]!;
        const f1 = funcs[1]!;
        return f0.smul(this.c0).add(f1.smul(this.c1))!;
    }
}

export function unitFunctionals(): void {
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
    let completedDataSet: readonly CFComparison[];
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

    // With a comparison function in place, we start by creating a few base unit functions.
    // These are of the length units d0, d1, and m.
    const fd0 = createBaseUnitFunction(compFunc, d0);
    const fd1 = createBaseUnitFunction(compFunc, d1);
    const fm = createBaseUnitFunction(compFunc, m);

    // Now we create constant unit functionals from these functions (i.e., functionals that return these
    // functions no matter the arguments). Let's set the dimension to 0 and dirty cast it to CFUint32.
    const ufld0 = makeConstUnitFunctional(0 as CFUint32, fd0);

    // The dimension of the unit functional is "how many unit function arguments does it take", which is
    // different from the dimension of the unit function itself, which determines how many unit
    // arguments it takes.

    // Let's evaluate it:
    const ufld0Val = ufld0.get() as CFUnitFunc<CFUint32One>;

    // The reason we cast here is that the return type of get() is CFUnitFunc<CFDim>, which is a
    // general dimension - we will assert that it is in fact 1.

    // The function we got by evaluating ufld0 should be fd0.
    if(!fd0.equals(ufld0Val)) {
        throw new Error("Unit functional did not return the same function as the original!");
    }

    // Nice, we're still here. But what if we try to violate the dimension by passing in one or more
    // unit functions as arguments?
    const tryExceedDimVal = ufld0.get(fd1);

    // The return-value should be undefined.
    if(tryExceedDimVal !== undefined) {
        throw new Error("Unit functional did not return undefined when it should have!");
    }

    // Next, we can make a functional take any number of function arguments. Let's make it take 5.
    const ufld0_2D = makeConstUnitFunctional(5 as CFUint32, fd0);

    // Now we have to pass five arguments, but since ufld0 is const, it will still always return fd0.
    // This is the same as with a constant unit function that returns the same value for all
    // possible unit arguments, except its return value is an interval and not a function.
    const ufld0_2D_val = ufld0_2D.get(fd1, fd1, fd1, fd1, fd1) as CFUnitFunc<CFUint32One>;

    // The function we got by evaluating ufld0 should be fd0.
    if(!fd0.equals(ufld0_2D_val)) {
        throw new Error("Unit functional did not return the same function as the original!");
    }

    // Let's do some inlining. 'get' will return d0, so we should be able to call it
    // immediately. Let's pass (d0, i0) to fd0 - should be [1, 1], since it's f(d0, d0, i0):
    const testVal = ufld0.get()!.get(d0, i0)!;

    console.log("Test value for f(d0, d0, 0):", testVal);
    if(!ALGEBRA_IVAL.isOne(testVal)) {
        throw new Error("Test value for f(d0, d0, 0) was not [1, 1]!");
    }

    // Now we create another constant unit functional from d1 that also takes 0 arguments.
    const ufld1 = makeConstUnitFunctional(0 as CFUint32, fd1);

    // We should be able to add it with ufld0.
    const sumufl = ufld0.add(ufld1);

    // When calling 'get', we should get 'fd0 + fd1'. Let's create it using addition to check.
    const sumd0d1 = fd0.add(fd1)!;

    const sumd0d1_from_functional = sumufl.get()! as CFUnitFunc<CFUint32One>;
    if(!sumd0d1.equals(sumd0d1_from_functional)) {
        throw new Error("Sum of unit functionals did not equal the sum of the original functions!");
    }

    // This covers constant unit functionals. But what if we want to have a unit functional actually
    // do something with its arguments, like taking two unit functions f0 and f1 as arguments, and
    // computing c0*f0 + c1*f1 for some constants (intervals) c0 and c1?

    // The answer is we have to program that function ourselves by extending an abstract class.
    // There are a few basic unit functionals available (integer powers, etc.), but let's
    // make one from scratch. The class can be found at the top of this file. Take a brief look at it.

    // Next, we need a way to instantiate it. This includes setting up the unit function domain object,
    // which can get tedious, so there is a ready-to-use factory function at the bottom of this file.
    // Take a look at that too.

    // Let's prepare two intervals and set the unit function dimension of 1 so that we can use our base
    // unit functions.
    const c0: CFIval = [1 as CFReal, 2 as CFReal];
    const c1: CFIval = [3 as CFReal, 4 as CFReal];

    const lcufl = getLinearComboUFL(
        compFunc,
        1 as CFUint32One,
        c0,
        c1
    );

    // Now, when we pass fd0 and fd1 in, we should get the linear combination of them!
    const flincomb = lcufl.get(fd0, fd1)!;

    // For argument 'm' and series index 0, this should yield [1, 2]*f(d0, m, 0) + [3, 4]*f(d1, m, 0).
    const val = flincomb.get(d0, i0)!;

    console.log("Linear combination value:", val);

    console.log("fd0(d0, 0):", fd0.get(d0, i0)!);
    console.log("fd1(d0, 0):", fd1.get(d0, i0)!);
    console.log("Manually computed linear combination:",
        ALGEBRA_IVAL.add(
            ALGEBRA_IVAL.mul(fd0.get(d0, i0)!, c0),
            ALGEBRA_IVAL.mul(fd1.get(d0, i0)!, c1)
        )
    );

    // Before finishing, let's square-root the lcufl functional and get the value.
    const lcufl2 = lcufl.nthRoot(2 as CFUint32);
    console.log("Square-root:", lcufl2.get(fd0, fd1)!.get(d0, i0)!);

    console.log("Everything worked as expected!");

    return;
}

unitFunctionals();

// Takes the domain from the comparison function cf, and returns a new LinearComboUnitFunctional
// that accepts 'ufDim'-dimensional unit function arguments. Also, stores c0 and c1 to form the
// linear combination.
function getLinearComboUFL<UFDim extends CFDim>(
    cf: CFCompFuncBinary,
    ufDim: UFDim,
    c0: CFIval,
    c1: CFIval
): LinearComboUnitFunctional<UFDim> {
    // A quirk is that we have to generate a "-1" function to use in negations. This is to avoid
    // unnecessary allocations. It is also passed along with each algebraic operation (add, mul, etc.),
    // but has to be generated for "root" functionals such as this and 'const'.

    const ufNegOne = createConstUnitFunc(
        ufDim,
        cf.NU,
        cf.NS,
        [-1, -1] as any
    );

    // Create the domain.
    const ufd = {
        dim: ufDim,
        NU: cf.NU,
        NS: cf.NS,
        uFuncNegOne: ufNegOne
    };

    return new LinearComboUnitFunctional(ufd, c0, c1);
}