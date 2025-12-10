import {
    CFCompFuncBinary,
    CFComparison,
    CFUint32,
    createBinaryCompFunc,
    createBaseUnitFunction,
    CFBaseUnitFunc,
    degSub,
    substitutable,
    pruneDataset
} from "../src";

import {makeValidCFCompDataset} from "../tests/utils/dataset_gen";

/**
 * Example: substitutability on non-orthogonal comparison functions
 *
 * This example explores how substitutability behaves when the underlying comparison
 * function is not orthogonal, and how this lets us generalize the usual notion of
 * commensurability.
 *
 * For an orthogonal comparison function, we have:
 *   - A set of base classes.
 *   - Base unit functions defined on those classes.
 *   - Rules for when two unit functions are substitutable.
 *
 * In this setting:
 *   - If two base unit functions are defined on the same base class, they are
 *     substitutable; otherwise they are not.
 *   - The converse also holds: every pair of substitutable base unit functions
 *     must come from the same base class, and every non-substitutable pair must
 *     come from different base classes.
 *
 * This gives a one-to-one correspondence between base classes and (equivalence
 * classes of) base unit functions, so we can talk about dimensionality purely
 * in terms of substitutability. For example, let f be an orthogonal comparison
 * function with three base classes, and let { f_a, f_b, f_c } be base unit
 * functions, each from a different base class. Each of these is substitutable
 * with all other functions in its own base class, but they are mutually
 * non-substitutable with each other (orthogonal).
 *
 * Any one-dimensional unit function on f, obtained by algebraic operations on
 * unit functions, will then be substitutable to exactly one of f_a, f_b, or f_c
 * (unless the operations are invalid or yield null values). Since substitutability
 * extends to multidimensional unit functions as well (tensor products of base
 * unit functions), we can pick one representative function from each base class
 * and use them as bases for all unit functions on that comparison function.
 *
 * However, base unit functions also exist on non-orthogonal comparison
 * functions, and they too may or may not be mutually substitutable. In some
 * cases we can still find sets of functions that behave “somewhat orthogonally”
 * with respect to substitutability and use them to span (part of) the unit
 * functions on such a comparison function.
 *
 * This file walks through an example of that situation and attaches a concrete
 * physical interpretation to make the construction more intuitive.
 */
function substitutability(): void {

    const numUnits = 7 as CFUint32;
    const numSeriesIndices = 1 as CFUint32;

    // We start with a valid dataset from tests\utils\dataset_gen.ts.
    const gen = makeValidCFCompDataset({
        maxUnitIndex: numUnits - 1,
        maxSeriesIndex: numSeriesIndices - 1,
        numComparisons: 47,
        loRange: [0.1, 1],
        hiRange: [1, 5],
        seed: 123456789,
        diagonalBias: 'none', // We don't want special focus on comparisons (u, u, 0).
        seriesDistribution: 'roundRobin',
    });

    // Fixed seed, so the dataset is deterministic. It looks like this:
    console.log(gen.arr);
    /**
     * [
     *   [ 0, 1, 0, [ 0.33201166945509614, 4.883088446222246 ] ],
     *   [ 1, 2, 0, [ 0.8067952128592879, 1.8246583193540573 ] ],
     *   [ 2, 3, 0, [ 0.37276469871867446, 3.988264188170433 ] ],
     *   [ 3, 4, 0, [ 0.8008602868765593, 2.1380385160446167 ] ],
     *   [ 4, 5, 0, [ 0.11488324149977416, 1.6458587693050504 ] ],
     *   [ 5, 6, 0, [ 0.4293108242331073, 2.723430217243731 ] ],
     *   [ 6, 0, 0, [ 0.6107399891829118, 1.708322730846703 ] ],
     *   [ 3, 5, 0, [ 0.6358937189215794, 2.6811922695487738 ] ],
     *   [ 5, 5, 0, [ 0.14754845001734795, 2.57244582939893 ] ],
     *   [ 5, 2, 0, [ 0.5258181978249923, 4.058477280661464 ] ],
     *   [ 5, 1, 0, [ 0.9172770081553608, 2.8262222073972225 ] ],
     *   [ 2, 1, 0, [ 0.2308832285925746, 1.8733194768428802 ] ],
     *   [ 4, 2, 0, [ 0.24257136990781875, 4.014981255866587 ] ],
     *   [ 6, 6, 0, [ 0.4252595612546429, 2.0168049158528447 ] ],
     *   [ 3, 2, 0, [ 0.6129399889847263, 1.9084835834801197 ] ],
     *   [ 2, 6, 0, [ 0.2735358789563179, 3.886520658619702 ] ],
     *   [ 6, 2, 0, [ 0.4895730606513098, 1.6259095501154661 ] ],
     *   [ 1, 5, 0, [ 0.9443232758669182, 4.506862010806799 ] ],
     *   [ 5, 4, 0, [ 0.4377286916365847, 2.655184085480869 ] ],
     *   [ 6, 4, 0, [ 0.15350653247442098, 2.56502952799201 ] ],
     *   [ 6, 3, 0, [ 0.46744205243885517, 1.0989629067480564 ] ],
     *   [ 4, 6, 0, [ 0.6586173052666708, 1.8738419190049171 ] ],
     *   [ 1, 6, 0, [ 0.40803852293174714, 1.1489534731954336 ] ],
     *   [ 0, 0, 0, [ 0.46610816873144356, 4.008982612751424 ] ],
     *   [ 1, 3, 0, [ 0.9532831894233823, 4.488079427741468 ] ],
     *   [ 3, 3, 0, [ 0.3890491528203711, 2.0643156971782446 ] ],
     *   [ 0, 6, 0, [ 0.8997664509341121, 4.2667316403239965 ] ],
     *   [ 5, 3, 0, [ 0.3783632237231359, 1.9501956449821591 ] ],
     *   [ 6, 1, 0, [ 0.9746099274139851, 3.1943195024505258 ] ],
     *   [ 4, 4, 0, [ 0.8548573455074802, 4.208025245927274 ] ],
     *   [ 0, 2, 0, [ 0.5310159111162648, 2.1983325434848666 ] ],
     *   [ 2, 5, 0, [ 0.2029123648768291, 3.7863691188395023 ] ],
     *   [ 2, 0, 0, [ 0.8644941310631111, 3.1860069474205375 ] ],
     *   [ 2, 4, 0, [ 0.5648233695654199, 4.509953203611076 ] ],
     *   [ 0, 3, 0, [ 0.2887267635436729, 2.4852411346510053 ] ],
     *   [ 4, 0, 0, [ 0.5765978038311005, 4.324253366328776 ] ],
     *   [ 1, 4, 0, [ 0.13715678565204145, 4.230334065854549 ] ],
     *   [ 4, 3, 0, [ 0.9524454397847876, 4.599137608893216 ] ],
     *   [ 6, 5, 0, [ 0.10689597697928549, 2.8708974570035934 ] ],
     *   [ 2, 2, 0, [ 0.7996908309636638, 1.2923087924718857 ] ],
     *   [ 0, 5, 0, [ 0.2593675417127088, 2.112125356681645 ] ],
     *   [ 3, 6, 0, [ 0.7666619578609243, 4.399559769779444 ] ],
     *   [ 0, 4, 0, [ 0.6861545875901356, 2.902697375975549 ] ],
     *   [ 3, 0, 0, [ 0.2607291791588068, 3.502578324638307 ] ],
     *   [ 1, 0, 0, [ 0.10631350260227919, 3.3223619032651186 ] ],
     *   [ 4, 1, 0, [ 0.37756915972568095, 1.0713452529162169 ] ],
     *   [ 1, 1, 0, [ 0.7460970640415325, 4.79499124083668 ] ]
     * ]
     */

    const dataSet: CFComparison[] = gen.arr; // Valid dataset from generator.

    let compFunc : CFCompFuncBinary;

    try {
        compFunc = createBinaryCompFunc(dataSet,numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // Now we focus on units 0 and 1.
    const u = 0 as CFUint32;
    const v = 1 as CFUint32;

    // Create base unit functions:
    const fu = createBaseUnitFunction(compFunc, u);
    const fv = createBaseUnitFunction(compFunc, v);

    // Are they substitutable?
    const isSubUV = substitutable(fu, fv);
    console.log(`Unit functions ${u} and ${v} are substitutable: ${isSubUV}`);

    // Yes, they are.

    // The next question is: how many substitutable functions are in there?
    // Let's create all possible base unit functions.
    const ufs: CFBaseUnitFunc[] = new Array(numUnits);
    for (let i = 0; i < numUnits; i++) {
        ufs[i] = createBaseUnitFunction(compFunc, i as CFUint32);
    }

    // Since substitutability is an equivalence relation, we can simplify the search.
    for (let i = 1; i < numUnits; i++) {
        const sub = substitutable(ufs[0]!, ufs[i]!);
        if (sub) {
            console.log(`Unit function ${i} is substitutable with ${u}`);
        }
    }
    // 0 and 1, 0 and 2, 0 and 4, 0 and 6.
    // Thus, also 1 and 2, 4 and 6, etc.

    // Knowing only this, let's filter the dataset to only include these units.
    let prunedDataSetResult = pruneDataset(
        dataSet,
        numUnits,
        numSeriesIndices,
        new Set([0, 1, 2, 4, 6] as CFUint32[]), // Use this set to prune the dataset.
        new Set([0] as CFUint32[]) // Use the same series indices (only 0).
    );

    // The pruning should work.
    if (prunedDataSetResult === undefined) {
        throw new Error("Pruning failed.");
    }

    // There are 5 units in the pruned dataset. Since X = {0, 1, 2, 4, 6} is not a unit set,
    // the dataset and unit set will be re-indexed, i.e., U = {0, 1, 2, 3, 4}.
    console.log("Unit mapping before->after pruning:");
    console.log(prunedDataSetResult.unitMap);

    // Now make a new comparison function:
    try {
        compFunc = createBinaryCompFunc(prunedDataSetResult.dataset, 5 as CFUint32, 1 as CFUint32);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // If all base unit functions are substitutable, maybe we have an orthogonal comparison function?
    // Maybe the unit set {0, 1, 2, 4, 6} is an orthogonal subset of the original U?
    if (compFunc.ORT_FRAME(0 as CFUint32)) {
        console.log("The unit set {0, 1, 2, 4, 6} is an orthogonal subset of the original U.");
    } else {
        throw new Error("The units {0, 1, 2, 4, 6} are not an orthogonal subset of the original U.");
    }

    // This is indeed the case. But what about the other units? Are they perhaps mutually orthogonal?
    // These are the units 3 and 5.
    const sub35 = substitutable(ufs[3]!, ufs[5]!);
    console.log(`Unit function 3 is substitutable with unit function 5: ${sub35}`);

    // No, they are not. What is the degree?
    const degSub35 = degSub(ufs[3]!, ufs[5]!)!; // Cheating here.
    console.log(`Degree of substitution between unit functions 3 and 5: ${degSub35}`);

    // About 0.71. Thus, we did not have an orthogonal comparison function to begin with.
    // That would have been the case if the degree here was 0 - in which case the base
    // classes would have been {{0, 1, 2, 4, 6}, {3}, {5}}, but now, 3 and 5 are not
    // completely separate.

    // Finally, let's just check where the difference is coming from.
    const f3 = ufs[3]!;
    const f5 = ufs[5]!;
    for (let u = 0 as CFUint32; u < numUnits; u++) {
        const ex = f3.E(u, 0);
        const ey = f5.E(u, 0);
        console.log(
            `f3 and f5 are both non-null or null for unit ${u}: ${ex === ey}`
        )
    }

    // 5 out of 7 are the same, they only differ for unit arguments 0 and 1 (hence 0.71428... = 5 / 7)
    // What if we remove those two units?

    prunedDataSetResult = pruneDataset(
        dataSet,
        numUnits,
        numSeriesIndices,
        new Set([2, 3, 4, 5, 6] as CFUint32[]),
        new Set([0] as CFUint32[])
    )!;

    try {
        compFunc = createBinaryCompFunc(prunedDataSetResult.dataset, 5 as CFUint32, 1 as CFUint32);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    if (compFunc.ORT_FRAME(0 as CFUint32)) {
        console.log("The unit set {2, 3, 4, 5, 6} is an orthogonal subset of the original U.");
    }

    // We now have orthogonality! The reason: f3 and f5 are now orthogonal (degree of substitutability
    // is 0) For the remaining units - their base unit functions were substitutable even with units
    // 1 and 0 in the set, so the subset of those functions that excludes f0 and f1 (with the remaining
    // ones having fewer arguments) are still orthogonal.

    // Thus we have used substitutability to find two different orthogonal subsets of this comparison
    // function.

    console.log("Everything worked as expected!");
    return;
}

substitutability();