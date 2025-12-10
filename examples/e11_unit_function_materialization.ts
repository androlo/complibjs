/**
 * Example:
 *
 * Here we will look at some advanced features of unit functions, especially materialization.
 *
 * A brief explainer:
 *
 * When unit function algebra is performed, the resulting functions are stored in a tree-like
 * structure. Materialization is the process of flattening that tree.
 *
 * For example, comparison functions are stored as sparse CSR matrices backed by bitsets. When a base
 * unit function is created from a comparison function, it becomes a sparse matrix as well, as it is
 * just a subset of the comparison function. When 'get' or 'getUnsafe' is called on that function,
 * it will simply consult its bitset and value-array to find the right value. Moreover, the type
 * 'sparse' is one of three basic leaf types, the other two being 'dense' and 'const' - leaf meaning
 * they store their own values.
 *
 * By contrast, when two base unit functions are multiplied, fu and fv, the product is not a new sparse
 * matrix, but a special node type that stores the two functions 'fu' and 'fv', as well as an
 * enum value saying which operation to perform (Add, Sub, Mul, or Div). When 'get', or 'getUnsafe' is
 * called on that function, for some argument (u, s), it will return fu(u, s) * fv(u, s), by performing
 * the multiplication in-place.
 *
 * This is often more practical than generating an entire new unit function for each multiplication done.
 * However, sometimes we may want to avoid performing one or more arithmetic operations for every get -
 * like when checking every value on an entire frame. That is when materialization is useful.
 *
 * Calling .materialize() on a base unit function will (recursively) convert the tree into a leaf type
 * (dense, sparse, or const), depending on what the tree contains. Thus, for the example product of
 * 'fu' and 'fv', the materialized form will be a sparse matrix of the same size as fu and fv, with its
 * own bitset and values - where the value for (u, s) is stored as fu(u, s) * fv(u, s), as expected.
 * Also, calling .materialize() on a leaf unit function will only return the function itself.
 *
 * Finally, there are several branch node types, for tensor products, powers, etc., but they all work
 * the same way as the one for arithmetic, in that they keep functions as children and add a new level
 * of nesting to the tree.
 *
 * WARNING:
 *
 * Running this file may take several seconds to complete, as it does a lot of computations.
 */
import {CFGenOptions, makeValidCFCompDataset} from "../tests/utils/dataset_gen";
import {
    CFArithOp,
    CFCompFuncBinary,
    CFDim,
    CFSeriesIndex,
    CFStorageTag,
    CFUint32Two,
    CFUnit,
    CFUnitFunc,
    createBinaryCompFunc,
    createBaseUnitFunction, createOneUnitFunc, ALGEBRA_IVAL
} from "../src";
import {performance} from "node:perf_hooks";

function unitFunctionMaterialization(): void {

    // Here we will use an auto generator to create a comparison function with a significant
    // number of comparisons - 1001 units and one frame, 500'000 comparisons.
    const opts: CFGenOptions = {
        maxUnitIndex: 1000,
        maxSeriesIndex: 0,
        numComparisons: 500_000,
        loRange: [0, 1],
        hiRange: [1, 2],
        seed: 0x12345678,
        diagonalBias: 'none',
        seriesDistribution: 'uniform'
    };

    const dsResult = makeValidCFCompDataset(opts);
    const dataSet = dsResult.arr;
    const numUnits = dsResult.numUnits;
    const numSeriesIndices = dsResult.numSeriesIndices;

    let compFunc : CFCompFuncBinary;

    try {
        compFunc = createBinaryCompFunc(dataSet, numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // Create a few (one-dimensional) base unit functions.
    const buf0 = createBaseUnitFunction(compFunc, 0 as CFUnit);
    const buf1 = createBaseUnitFunction(compFunc, 1 as CFUnit);
    const buf2 = createBaseUnitFunction(compFunc, 2 as CFUnit);
    const buf3 = createBaseUnitFunction(compFunc, 3 as CFUnit);

    // Take tensor products, then multiply. Note that tp01 and tp23 are both two-dimensional.

    const tp01 = buf0.tmul(buf1);
    if (tp01 === undefined) throw new Error("Tensor product failed for buf0 and buf1!");

    const tp23 = buf2.tmul(buf3) as CFUnitFunc<CFUint32Two>; // Nudge type for tensor op (cannot infer dimension automatically).
    if (tp23 === undefined) throw new Error("Tensor product failed for buf2 and buf3!");

    // The multiplication is valid, since tp01 and tp23 are both of the same dimension.
    const uf = tp01.mul(tp23);

    if (uf === undefined) throw new Error("Multiplication failed for tp01 and tp23!");

    // Our function 'uf' is now a function that takes arguments (u, v, s). Now we will try fetching all values
    // from a given frame - frame 0 - by use of this function.
    const getAllVals = (uft: CFUnitFunc<CFDim>): number => {
        let checksum = 0;
        for (let u = 0 as CFUnit; u < numUnits; u++) {
            for(let v = 0 as CFUnit; v < numUnits; v++) {
                // We will use 'getUnsafe' to avoid redundant bounds checks.
                const val = uft.getUnsafe(u, v, 0 as CFSeriesIndex);
                // "do something" stuff for avoiding compiler shenanigans.
                const x = (val?.[0] ?? 0) | 0;
                const y = (val?.[1] ?? 0) | 0;
                checksum = ((checksum << 5) - checksum) ^ x;
                checksum = ((checksum << 5) - checksum) ^ y;
            }
        }
        return checksum;
    }

    const warmup = 3; // More perf stuff.
    for (let i = 0; i < warmup; i++) getAllVals(uf);

    // Test getting all values in frame 0 and do some simple busy work for 'uf'.
    const t0 = performance.now();
    const csUf = getAllVals(uf);
    const t1 = performance.now();

    console.log(`Getting all values in frame 0 for tree took ${(t1 - t0).toFixed(3)} ms`);

    // Now we materialize. Let's check how long it takes also, without any optimization tricks.
    const t0toMat = performance.now();
    const ufMat = uf.materialize();
    // Note that materialization can fail, so it may return undefined.
    if (ufMat === undefined) throw new Error("Materialization failed!");
    const t1toMat = performance.now();

    console.log(`Materializing 'uf' took ${(t1toMat - t0toMat).toFixed(3)} ms`);

    // Test getting all values in frame 0 and do some simple busy work for 'ufMat'.
    const t0m = performance.now();
    const csUfMat = getAllVals(ufMat);
    const t1m = performance.now();

    console.log(`Getting all values in frame 0 for materialized took ${(t1m - t0m).toFixed(3)} ms`);

    // Finally, some more profiling busy-work...
    if (csUf === 42) console.log("hi");
    if (csUfMat === 75) console.log("hello");

    // The time will obviously be different on different machines, but these are some values
    // the author got on his machine:

    // Getting all values in frame 0 for tree took 361.411 ms
    // Materializing 'uf' took 171.881 ms
    // Getting all values in frame 0 for materialized took 26.608 ms

    // So, was it worth it? In this case - yes. The materialization time is a bit unprecise, given
    // the setup, but if we are going to read many values, it is clear that materialization changes
    // the game - it's an order of magnitude faster in this case. And, there are other benefits too.
    // For example, we also get direct access to the data, which in the case of sparse matrices
    // gives us a very fast way of doing existence checks through the bitset.

    // But - let's not get too excited. How do we know that materializing even gives us the correct
    // values? We haven't actually seen any of them, so how do we know that the "materialized"
    // version is even the same as the non-materialized one. We need proof.
    for(let u = 0 as CFUnit; u < numUnits; u++) {
        for(let v = 0 as CFUnit; v < numUnits; v++) {
            const valT = uf.getUnsafe(u, v, 0 as CFSeriesIndex);
            const valM = ufMat.getUnsafe(u, v, 0 as CFSeriesIndex);
            // Checking approximate equality with floating-point tolerance is not enough here.
            // In terms of the values, these functions are supposed to be identical. We need
            // strict, bit-for-bit equality.
            if (valT === undefined || valM === undefined) {
                throw new Error("FRAUD!!");
            }
            if (valT[0] !== valM[0] || valT[1] !== valM[1]) {
                throw new Error("FRAUD!!");
            }
        }
    }

    // Finally, we will just quickly look at the anatomy of 'uf' (the tree) and the materialized form,
    // to see what's actually going on.

    // 'uf' was the product (buf0 x buf1) * (buf2 x buf3) - the product of two tensor products.
    // Additionally, the operands are all one-dimensional and sparse (base unit functions).
    // We should first find a multiplication node at the top.
    if (uf.storage !== CFStorageTag.Arith || uf.arithOp !== CFArithOp.Mul)
        throw new Error("Invalid arithmetic operation!");

    const left = uf.left as CFUnitFunc<CFUint32Two>;
    const right = uf.right as CFUnitFunc<CFUint32Two>;

    // These should be tensor products:
    if(left.storage !== CFStorageTag.Tensor || right.storage !== CFStorageTag.Tensor)
        throw new Error("Invalid tensor product operation!");
    if(left.dim !== right.dim || left.dim !== 2 as CFDim)
        throw new Error("Dimensions of tensor products are not both 2!");

    // Finally, for each of the two terms, their operands should just be equal to the bufN functions.
    if(left.left.equals(buf0) !== true || left.right.equals(buf1) !== true) {
        throw new Error("Invalid tensor product left operands!");
    }
    if(right.left.equals(buf2) !== true || right.right.equals(buf3) !== true) {
        throw new Error("Invalid tensor product right operands!");
    }

    // The materialized 'ufMat' function should be sparse.
    if(ufMat.storage !== CFStorageTag.Sparse)
        throw new Error("Invalid storage tag for materialized function!");

    // Note that we cannot test equality for 'uf' and 'ufMat', and the reason is simple:
    // Equality does not check value equality unless the two functions tested are of the same type.
    // If a function is sparse and another is a tensor, they are not equal. There are ways of comparing
    // non-equal functions too, by transforming functions to the same format: materialization is an example
    // of one such transformation (in this case, arith node to sparse), and there are also conversion
    // utility functions like 'sparseToDense', and 'denseToSparse'.

    // Before we end this, let's look at one exception to this tree rule. We first create a constant
    // unit function that has the value ONE ([1, 1]) for all arguments. We make its dimension '3',
    // meaning it takes arguments (u, v, w, s), and we set the number of units and series indices to
    // be the same as the comparison function.
    const constUF = createOneUnitFunc(2 as CFDim, compFunc.NU, compFunc.NS);

    // We can check that the value of this constant function is indeed [1, 1].
    if(!ALGEBRA_IVAL.isOne(constUF.value)) {
        throw new Error("Constant function value is not [1, 1]!");
    }

    // Now we take the materialized 'ufMat' and multiply it with this constant function.
    const cMul = constUF.mul(ufMat);
    if(cMul === undefined) {
        throw new Error("Multiplication failed for constant and materialized function!");
    }

    // The result should be an arith function, but this is one of many exceptions: constants are often
    // folded, and other optimization is also used to avoid deepening the tree. In this case, since
    // 'ufMat' is sparse, the function returned by 'mul' is just a sparse function that is the same as
    // 'ufMat' but each value in its value storage is multiplied by constUF.value. However, sometimes
    // multiplication and other ops fail, because of overflow and such, in which case the operation will
    // return undefined. That will not happen here though, since it's not even doing any multiplication!
    // [1, 1] * I = I * [1, 1] = I, for all real intervals I, so constUF.mul(ufMat) = ufMat.
    if (!cMul.equals(ufMat)) {
        throw new Error("Constant multiplication failed!");
    }

    console.log("Everything worked as expected!");
    return;
}

unitFunctionMaterialization();