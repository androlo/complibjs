import {
    CFCompFuncBinary,
    CFComparison,
    CFUint32,
    createBinaryCompFunc,
    createBaseUnitFunction,
    CFBaseUnitFunc,
    degSub,
    substitutable,
    pruneDataset,
    CFValidCompDataSet
} from "../src";

import {print2DAdj} from "../src/presentation";

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
export function substitutabilityNonOrthogonal(): void {

    const numUnits = 7 as CFUint32;
    const numSeriesIndices = 1 as CFUint32;

    // We start with a valid dataset from tests\utils\dataset_gen.ts.
    const gen = makeValidCFCompDataset({
        maxUnitIndex: numUnits - 1 as CFUint32,
        maxSeriesIndex: numSeriesIndices - 1 as CFUint32,
        numComparisons: 47 as CFUint32,
        loRange: [0.1, 1],
        hiRange: [1, 5],
        seed: 123456789 as CFUint32,
        diagonalBias: 'none', // We don't want special focus on comparisons (u, u, 0).
        seriesDistribution: 'roundRobin',
    });

    /** Fixed seed, so the dataset is deterministic. It looks like this:
    [
        [ 0, 1, 0, [ 0.33201166945509614, 4.883088446222246 ] ],
        [ 1, 2, 0, [ 0.8067952128592879, 1.8246583193540573 ] ],
        [ 2, 3, 0, [ 0.37276469871867446, 3.988264188170433 ] ],
        [ 3, 4, 0, [ 0.8008602868765593, 2.1380385160446167 ] ],
        [ 4, 5, 0, [ 0.11488324149977416, 1.6458587693050504 ] ],
        [ 5, 6, 0, [ 0.4293108242331073, 2.723430217243731 ] ],
        [ 6, 0, 0, [ 0.6107399891829118, 1.708322730846703 ] ],
        [ 1, 5, 0, [ 0.5451535127591342, 4.271623915992677 ] ],
        [ 4, 4, 0, [ 0.6358937189215794, 2.6811922695487738 ] ],
        [ 6, 6, 0, [ 0.8052156893070788, 4.3522876389324665 ] ],
        [ 5, 2, 0, [ 0.14754845001734795, 2.57244582939893 ] ],
        [ 6, 4, 0, [ 0.7732287779217586, 2.6994152925908566 ] ],
        [ 5, 3, 0, [ 0.5258181978249923, 4.058477280661464 ] ],
        [ 3, 6, 0, [ 0.3600014974363148, 3.2726546432822943 ] ],
        [ 0, 3, 0, [ 0.8523457002593204, 1.7623348692432046 ] ],
        [ 3, 0, 0, [ 0.9172770081553608, 2.8262222073972225 ] ],
        [ 4, 3, 0, [ 0.35904268650338056, 2.076433563604951 ] ],
        [ 3, 3, 0, [ 0.2308832285925746, 1.8733194768428802 ] ],
        [ 1, 4, 0, [ 0.12692376074846834, 1.6959990467876196 ] ],
        [ 6, 3, 0, [ 0.799583156616427, 4.544986343942583 ] ],
        [ 4, 6, 0, [ 0.4149012216599658, 2.9873491106554866 ] ],
        [ 4, 0, 0, [ 0.3617157768458128, 1.7045042049139738 ] ],
        [ 5, 5, 0, [ 0.6956577381584793, 2.4083299105986953 ] ],
        [ 0, 4, 0, [ 0.24257136990781875, 4.014981255866587 ] ],
        [ 4, 2, 0, [ 0.8381071182666346, 4.101951841264963 ] ],
        [ 3, 2, 0, [ 0.8987842471571639, 4.853179247118533 ] ],
        [ 6, 1, 0, [ 0.4252595612546429, 2.0168049158528447 ] ],
        [ 6, 2, 0, [ 0.5894664322724567, 2.357982726767659 ] ],
        [ 2, 4, 0, [ 0.6129399889847263, 1.9084835834801197 ] ],
        [ 5, 4, 0, [ 0.477551210206002, 4.507189719006419 ] ],
        [ 1, 3, 0, [ 0.2735358789563179, 3.886520658619702 ] ],
        [ 0, 2, 0, [ 0.9798181363148615, 2.5394800575450063 ] ],
        [ 2, 6, 0, [ 0.4895730606513098, 1.6259095501154661 ] ],
        [ 5, 1, 0, [ 0.23620948863681407, 4.36674131359905 ] ],
        [ 1, 0, 0, [ 0.9443232758669182, 4.506862010806799 ] ],
        [ 6, 5, 0, [ 0.7618148400913924, 3.425424194894731 ] ],
        [ 3, 1, 0, [ 0.4377286916365847, 2.655184085480869 ] ],
        [ 1, 6, 0, [ 0.6080814483575523, 2.300467910245061 ] ],
        [ 1, 1, 0, [ 0.550566007080488, 4.160652770660818 ] ],
        [ 3, 5, 0, [ 0.9140818861778826, 3.54092488437891 ] ],
        [ 0, 5, 0, [ 0.15350653247442098, 2.56502952799201 ] ],
        [ 2, 5, 0, [ 0.8885860482230783, 2.952179224230349 ] ],
        [ 2, 2, 0, [ 0.46744205243885517, 1.0989629067480564 ] ],
        [ 4, 1, 0, [ 0.3038341128267348, 4.036030148155987 ] ],
        [ 0, 6, 0, [ 0.8232277376810089, 4.200122385285795 ] ],
        [ 0, 0, 0, [ 0.9613372520543635, 2.5548888482153416 ] ],
        [ 5, 0, 0, [ 0.6231164352037013, 4.922250256873667 ] ]
    ]
    */

    const dataSet: CFValidCompDataSet = gen.arr; // Valid dataset from generator.

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
            console.log(`Unit function ${0} is substitutable with ${i}`);
        }
    }
    // 0 is substitutable with 1, 3, 4, 5, and 6.
    // Thus, from equivalence of substitutability, we can substitute 1 with 3, 4 with 6, and so on.

    // Knowing only this, let's filter the dataset to only include these units (i.e., exclude the unit 2).
    let prunedDataSetResult = pruneDataset(
        dataSet,
        numUnits,
        numSeriesIndices,
        new Set([0, 1, 3, 4, 5, 6] as CFUint32[]), // Use this set to prune the dataset.
        new Set([0] as CFUint32[]) // Use the same series indices (only 0).
    );

    // The pruning should work.
    if (prunedDataSetResult === undefined) {
        throw new Error("Pruning failed.");
    }

    // There are 6 units in the pruned dataset. Since X = {0, 1, 3, 4, 5, 6} is not a unit set,
    // the dataset and unit set will be re-indexed, i.e., U = {0, 1, 2, 3, 4, 5}.
    console.log("Unit mapping before->after pruning:");
    console.log(prunedDataSetResult.unitMap);

    // Now make a new comparison function:
    try {
        compFunc = createBinaryCompFunc(prunedDataSetResult.dataset, 6 as CFUint32, 1 as CFUint32);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }
    
    // If all base unit functions are substitutable, maybe we have an orthogonal comparison function?
    // Maybe the unit set {0, 1, 2, 3, 4, 5} is an orthogonal subset of the original U?
    if (compFunc.ORT_FRAME(0 as CFUint32)) {
        console.log("The unit set {0, 1, 2, 3, 4, 5} is an orthogonal subset of the original U.");
    } else {
        throw new Error("The unit set {0, 1, 2, 3, 4, 5} is not an orthogonal subset of the original U.");
    }

    // Thus, in this case, when we took the units for which all the base unit functions were orthogonal,
    // that set of units were an orthogonal subset of the original unit set.

    console.log("Everything worked as expected!");
    return;
}

substitutabilityNonOrthogonal();