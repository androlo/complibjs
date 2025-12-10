import {
    ALGEBRA_IVAL,
    arithOpToString,
    binOpTypeToString,
    CF_MAX_DIM,
    CFArithOp,
    CFBinOpType,
    CFDim,
    CFDimSparse,
    CFSeriesIndex,
    CFStorageTag,
    CFUint32,
    CFUnitFunc,
    CFUnitFuncConst,
    CFUnitFuncDense,
    createConstUnitFunc,
    storageTagToString
} from "../src";
import {mulberry32_Real01} from "../tests/utils/mulberry";
import {MAX_UINT32} from "../src/math_utils";
import {denseToSparse, getBinOp} from "../src/materialize";
import { CFDenseGenOptions, injectNullDontCareHowManyWasAdded, makeValidUnitFuncDense } from "../tests/utils/dense_gen";
import { getUnitIterator } from "../src/ufunc_iter";
import { printIntegerTuple } from "../src/presentation";

const LOOP_MAX = 10;

const sArithOp = (x: number) => {
    if (x > 0.75) return CFArithOp.Add;
    if (x > 0.5) return CFArithOp.Mul;
    if (x > 0.25) return CFArithOp.Sub;
    return CFArithOp.Div;
}

export function fuzz_ArithConstConst(trials: number = 100, numUnitsMax: number = 10, numSeriesMax: number = 10) {

    const rSeed = Math.floor(Math.random() * MAX_UINT32) as CFUint32;
    const rand = mulberry32_Real01(rSeed);

    for (let t = 0; t < trials; t++) {

        console.log(`Fuzz test trial ${t + 1}/${trials}`);
        const U = Math.floor(rand() * numUnitsMax) + 1 as CFUint32;
        const S = Math.floor(rand() * numSeriesMax) + 1 as CFUint32;
        const dim = Math.floor(rand() * CF_MAX_DIM) + 1 as CFDim;

        const cFuncs: CFUnitFuncConst<CFDim>[] = new Array<CFUnitFuncConst<CFDim>>(LOOP_MAX);

        for (let i = 0; i < LOOP_MAX; i++) {
            const ival = [rand()*100, 100 + rand()*100] as any;
            cFuncs[i] = createConstUnitFunc(dim, U, S, ival);
        }

        let res: CFUnitFunc<CFDim> = cFuncs[0];

        for (let i = 1; i < LOOP_MAX; i++) {
            const arithOp = sArithOp(rand());
            const opType = (rand() > 0.5) ? CFBinOpType.Left : CFBinOpType.Right;
            const binOp = getBinOp(arithOp);
            let resTmp: CFUnitFunc<CFDim> | undefined;
            switch(arithOp) {
                case CFArithOp.Add:
                    resTmp = res.add(cFuncs[i], opType);
                    break;
                case CFArithOp.Mul:
                    resTmp = res.mul(cFuncs[i], opType);
                    break;
                case CFArithOp.Sub:
                    resTmp = res.sub(cFuncs[i], opType);
                    break;
                case CFArithOp.Div:
                    resTmp = res.div(cFuncs[i], opType);
                    break;
                    default:
                        throw new Error(
                            `fuzz_ArithConstConst: Invalid arithmetic operation: ${arithOpToString(arithOp)} (should never happen)`);
            }
            if (resTmp === undefined) {
                console.info(`fuzz_ArithConstConst: Failed to compute arithmetic operation ${arithOpToString(arithOp)} on: 
                ${res} 
                
                and: 
                
                ${cFuncs[i]}
                `);
                break;
            }
            if(resTmp.storage !== CFStorageTag.Const) {
                throw new Error(`fuzz_ArithConstConst: Product of arithmetic operations is not a constant.: 
                ${JSON.stringify(res)} 
                
                and: 
                
                ${JSON.stringify(cFuncs[i])}
                
                Operation: ${arithOpToString(arithOp)}
                Operation Type: ${binOpTypeToString(opType)}
                numUnitsMax: ${numUnitsMax}
                numSeriesMax: ${numSeriesMax}
                Seed: ${rSeed}
                `);
            }

            const compVal = opType === CFBinOpType.Left ? binOp(res.value, cFuncs[i].value) : binOp(cFuncs[i].value, res.value);

            if (compVal === undefined) {
                console.info(`fuzz_ArithConstConst: Failed to manually compute arithmetic operation ${arithOpToString(arithOp)} on: 
                ${ALGEBRA_IVAL.print(res.value)} 
                
                and: 
                
                ${ALGEBRA_IVAL.print(cFuncs[i].value)}
                
                Operation: ${arithOpToString(arithOp)}
                Operation Type: ${binOpTypeToString(opType)}
                numUnitsMax: ${numUnitsMax}
                numSeriesMax: ${numSeriesMax}
                Seed: ${rSeed}
                `);
                break;
            }
            if(!ALGEBRA_IVAL.eq(resTmp.value, compVal)) {
                throw new Error(`fuzz_ArithConstConst: Arithmetic operation ${arithOp} failed to produce correct value for:
                ${ALGEBRA_IVAL.print(res.value)} 
                
                and: 
                
                ${ALGEBRA_IVAL.print(cFuncs[i].value)}
                
                actual result: ${ALGEBRA_IVAL.print(resTmp.value)}
                expected result: ${ALGEBRA_IVAL.print(compVal)}
                
                Operation: ${arithOpToString(arithOp)}
                Operation Type: ${binOpTypeToString(opType)}
                numUnitsMax: ${numUnitsMax}
                numSeriesMax: ${numSeriesMax}
                Seed: ${rSeed}
                `)
            }
            res = resTmp;

        }

    }
}

export function fuzz_ArithConstDense(trials: number = 100, maxDim: CFDim, numUnitsMax: number = 10, numSeriesMax: number = 10) {

    const rSeed = Math.floor(Math.random() * MAX_UINT32) as CFUint32;
    const rand = mulberry32_Real01(rSeed);

    for (let t = 0; t < trials; t++) {

        console.log(`Fuzz test trial ${t + 1}/${trials}`);
        const U = Math.floor(rand() * numUnitsMax) + 1 as CFUint32;
        const S = Math.floor(rand() * numSeriesMax) + 1 as CFUint32;
        const dim = Math.floor(rand() * maxDim) + 1 as CFDim;

        const arithOp = sArithOp(rand());
        const opType = (rand() > 0.5) ? CFBinOpType.Left : CFBinOpType.Right;
        const binOp = getBinOp(arithOp);
        let res: CFUnitFunc<CFDim> | undefined;
        const cFunc = createConstUnitFunc(dim, U, S, [rand()*100, 100 + rand()*100] as any);
        const dOpts: CFDenseGenOptions<CFDim> = {
            dim,
            numUnits: U,
            numSeriesIndices: S,
            loRange: [-100_000, 100_000],
            hiRange: [100_000, 2_750_000],
            allowNull: true,
            seed: rSeed
        }
        const dFunc = makeValidUnitFuncDense(dOpts);
        if (dFunc === undefined) {
            throw new Error(`fuzz_ArithConstDense: Failed to generate valid dense function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        switch(arithOp) {
            case CFArithOp.Add:
                res = cFunc.add(dFunc, opType);
                break;
            case CFArithOp.Mul:
                res = cFunc.mul(dFunc, opType);
                break;
            case CFArithOp.Sub:
                res = cFunc.sub(dFunc, opType);
                break;
            case CFArithOp.Div:
                res = cFunc.div(dFunc, opType);
                break;
                default:
                    throw new Error(
                        `fuzz_ArithConstDense: Invalid arithmetic operation: ${arithOp} (should never happen)`);
        }
        // If successful, should always produce dense.
        if (res === undefined) {
            console.info(`fuzz_ArithConstDense: Failed to compute arithmetic operation ${arithOpToString(arithOp)}`);
            break;
        }

        for(let s = 0 as CFSeriesIndex; s < S; s++) {
            const iter = getUnitIterator(dim, U);

            for(const ir of iter) {
                const dIdx = s*dFunc.pows[dim] + ir.lIdx; // linear index into dense function
                const dVal = dFunc.values[dIdx];
                const resVal = res.getUnsafe(...ir.units, s)!;
                const compVal = opType === CFBinOpType.Left ? binOp(cFunc.value, dVal) : binOp(dVal, cFunc.value);

                if (compVal === undefined) {
                    console.info(`fuzz_ArithConstConst: Failed to manually compute arithmetic operation ${arithOp} on: 
                    ${ALGEBRA_IVAL.print(cFunc.value)} 
                    
                    and: 
                    
                    ${ALGEBRA_IVAL.print(dVal)}

                    for units: ${printIntegerTuple(ir.units)}
                    Operation: ${arithOpToString(arithOp)}
                    Operation Type: ${binOpTypeToString(opType)}
                    Dense function options: ${JSON.stringify(dOpts)}
                    `);
                    break;
                }

                if(!ALGEBRA_IVAL.eq(resVal, compVal)) {
                    const argTup = ir.units.concat([s]);
                    
                    throw new Error(`fuzz_ArithConstConst: Arithmetic operation ${arithOpToString(arithOp)} failed to produce correct value.
                    
                    actual result: ${ALGEBRA_IVAL.print(resVal)}
                    expected result: ${ALGEBRA_IVAL.print(compVal)}
                    const operand: ${ALGEBRA_IVAL.print(cFunc.value)}
                    dense operand: ${ALGEBRA_IVAL.print(dVal)}
                    linear index in dense operand: ${dIdx}
                    argument: ${printIntegerTuple(argTup)}
                    Operation: ${arithOpToString(arithOp)}
                    Operation Type: ${binOpTypeToString(opType)}
                    Result type: ${storageTagToString(res.storage)}
                    Dense function options: ${JSON.stringify(dOpts)}
                    `)
                }
            }
        }
    }
}

export function fuzz_ArithConstSparse(trials: number = 100, maxDim: CFDim, numUnitsMax: number = 10, numSeriesMax: number = 10) {

    const rSeed = Math.floor(Math.random() * MAX_UINT32) as CFUint32;
    const rand = mulberry32_Real01(rSeed);

    for (let t = 0; t < trials; t++) {

        console.log(`Fuzz test trial ${t + 1}/${trials}`);
        const U = Math.floor(rand() * numUnitsMax) + 1 as CFUint32;
        const S = Math.floor(rand() * numSeriesMax) + 1 as CFUint32;
        const dim = Math.floor(rand() * maxDim) + 1 as CFDim;

        const arithOp = sArithOp(rand());
        const opType = (rand() > 0.5) ? CFBinOpType.Left : CFBinOpType.Right;
        const binOp = getBinOp(arithOp);
        let res: CFUnitFunc<CFDim> | undefined;
        const cFunc = createConstUnitFunc(dim, U, S, [rand()*100, 100 + rand()*100] as any);
        
        const dOpts: CFDenseGenOptions<CFDim> = {
            dim,
            numUnits: U,
            numSeriesIndices: S,
            loRange: [-100_000, 100_000],
            hiRange: [100_000, 2_750_000],
            allowNull: true,
            seed: rSeed
        }
        
        const dFunc = makeValidUnitFuncDense(dOpts);
        if (dFunc === undefined) {
            throw new Error(`fuzz_ArithConstSparse: Failed to generate valid dense function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        const dFuncNullInj = injectNullDontCareHowManyWasAdded(dFunc, Math.floor(dFunc.values.length * rand() * 0.1) as CFUint32, rSeed);

        const sFunc = denseToSparse(dFuncNullInj as CFUnitFuncDense<CFDimSparse>);

        if (sFunc === undefined) {
            throw new Error(`fuzz_ArithConstSparse: Failed to convert dense to sparse function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        switch(arithOp) {
            case CFArithOp.Add:
                res = cFunc.add(sFunc, opType);
                break;
            case CFArithOp.Mul:
                res = cFunc.mul(sFunc, opType);
                break;
            case CFArithOp.Sub:
                res = cFunc.sub(sFunc, opType);
                break;
            case CFArithOp.Div:
                res = cFunc.div(sFunc, opType);
                break;
                default:
                    throw new Error(
                        `fuzz_ArithConstSparse: Invalid arithmetic operation: ${arithOp} (should never happen)`);
        }
        // If successful, should always produce dense.
        if (res === undefined) {
            console.info(`fuzz_ArithConstSparse: Failed to compute arithmetic operation ${arithOpToString(arithOp)}`);
            break;
        }

        for(let s = 0 as CFSeriesIndex; s < S; s++) {
            const iter = getUnitIterator(dim, U);

            for(const ir of iter) {
                const sVal = sFunc.getUnsafe(...ir.units, s)!;
                const resVal = res.getUnsafe(...ir.units, s)!;
                const compVal = opType === CFBinOpType.Left ? binOp(cFunc.value, sVal) : binOp(sVal, cFunc.value);

                if (compVal === undefined) {
                    console.info(`fuzz_ArithConstSparse: Failed to manually compute arithmetic operation ${arithOp} on: 
                    ${ALGEBRA_IVAL.print(cFunc.value)} 
                    
                    and: 
                    
                    ${ALGEBRA_IVAL.print(sVal)}

                    for units: ${printIntegerTuple(ir.units)}
                    Operation: ${arithOpToString(arithOp)}
                    Operation Type: ${binOpTypeToString(opType)}
                    Base dense function options: ${JSON.stringify(dOpts)}
                    `);
                    break;
                }

                if(!ALGEBRA_IVAL.eq(resVal, compVal)) {
                    const argTup = ir.units.concat([s]);
                    
                    throw new Error(`fuzz_ArithConstSparse: Arithmetic operation ${arithOpToString(arithOp)} failed to produce correct value.
                    
                    actual result: ${ALGEBRA_IVAL.print(resVal)}
                    expected result: ${ALGEBRA_IVAL.print(compVal)}
                    const operand: ${ALGEBRA_IVAL.print(cFunc.value)}
                    sparse operand: ${ALGEBRA_IVAL.print(sVal)}
                    argument: ${printIntegerTuple(argTup)}
                    Operation: ${arithOpToString(arithOp)}
                    Operation Type: ${binOpTypeToString(opType)}
                    Result type: ${storageTagToString(res.storage)}
                    Base dense function options: ${JSON.stringify(dOpts)}
                    `)
                }
            }
        }
    }
}

export function fuzz_ArithDenseSparse(trials: number = 100, maxDim: CFDim, numUnitsMax: number = 10, numSeriesMax: number = 10) {

    const rSeed = Math.floor(Math.random() * MAX_UINT32) as CFUint32;
    const rand = mulberry32_Real01(rSeed);

    for (let t = 0; t < trials; t++) {

        console.log(`Fuzz test trial ${t + 1}/${trials}`);
        const U = Math.floor(rand() * numUnitsMax) + 1 as CFUint32;
        const S = Math.floor(rand() * numSeriesMax) + 1 as CFUint32;
        const dim = Math.floor(rand() * maxDim) + 1 as CFDim;

        const arithOp = sArithOp(rand());
        const opType = (rand() > 0.5) ? CFBinOpType.Left : CFBinOpType.Right;
        const binOp = getBinOp(arithOp);
        let res: CFUnitFunc<CFDim> | undefined;
        
        const dOpts: CFDenseGenOptions<CFDim> = {
            dim,
            numUnits: U,
            numSeriesIndices: S,
            loRange: [-100_000, 100_000],
            hiRange: [100_000, 2_750_000],
            allowNull: true,
            seed: rSeed
        }
        
        const dFunc = makeValidUnitFuncDense(dOpts);
        if (dFunc === undefined) {
            throw new Error(`fuzz_ArithDenseSparse: Failed to generate valid dense function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        const dFunc2 = makeValidUnitFuncDense(dOpts);
        if (dFunc2 === undefined) {
            throw new Error(`fuzz_ArithDenseSparse: Failed to generate valid dense function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        const dFunc2NullInj = injectNullDontCareHowManyWasAdded(
            dFunc2, 
            Math.floor(dFunc2.values.length * rand() * 0.1) as CFUint32, 
            rSeed
        );

        const sFunc = denseToSparse(dFunc2NullInj as CFUnitFuncDense<CFDimSparse>);

        if (sFunc === undefined) {
            throw new Error(`fuzz_ArithDenseSparse: Failed to convert dense to sparse function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        switch(arithOp) {
            case CFArithOp.Add:
                res = dFunc.add(sFunc, opType);
                break;
            case CFArithOp.Mul:
                res = dFunc.mul(sFunc, opType);
                break;
            case CFArithOp.Sub:
                res = dFunc.sub(sFunc, opType);
                break;
            case CFArithOp.Div:
                res = dFunc.div(sFunc, opType);
                break;
                default:
                    throw new Error(
                        `fuzz_ArithDenseSparse: Invalid arithmetic operation: ${arithOp} (should never happen)`);
        }

        // If successful, should always produce dense.
        if (res === undefined) {
            console.info(`fuzz_ArithDenseSparse: Failed to compute arithmetic operation ${arithOpToString(arithOp)}`);
            break;
        }

        for(let s = 0 as CFSeriesIndex; s < S; s++) {
            const iter = getUnitIterator(dim, U);

            for(const ir of iter) {
                const dVal = dFunc.getUnsafe(...ir.units, s)!;
                const sVal = sFunc.getUnsafe(...ir.units, s)!;
                const resVal = res.getUnsafe(...ir.units, s)!;
                const compVal = opType === CFBinOpType.Left ? binOp(dVal, sVal) : binOp(sVal, dVal);

                if (compVal === undefined) {
                    console.info(`fuzz_ArithDenseSparse: Failed to manually compute arithmetic operation ${arithOp} on: 
                    ${ALGEBRA_IVAL.print(dVal)} 
                    
                    and: 
                    
                    ${ALGEBRA_IVAL.print(sVal)}

                    for units: ${printIntegerTuple(ir.units)}
                    Operation: ${arithOpToString(arithOp)}
                    Operation Type: ${binOpTypeToString(opType)}
                    Base dense function options: ${JSON.stringify(dOpts)}
                    `);
                    break;
                }

                if(!ALGEBRA_IVAL.eq(resVal, compVal)) {
                    const argTup = ir.units.concat([s]);
                    
                    throw new Error(`fuzz_ArithConstSparse: Arithmetic operation ${arithOpToString(arithOp)} failed to produce correct value.
                    
                    actual result: ${ALGEBRA_IVAL.print(resVal)}
                    expected result: ${ALGEBRA_IVAL.print(compVal)}
                    dense operand: ${ALGEBRA_IVAL.print(dVal)}
                    sparse operand: ${ALGEBRA_IVAL.print(sVal)}
                    argument: ${printIntegerTuple(argTup)}
                    Operation: ${arithOpToString(arithOp)}
                    Operation Type: ${binOpTypeToString(opType)}
                    Result type: ${storageTagToString(res.storage)}
                    Base dense function options: ${JSON.stringify(dOpts)}
                    `)
                }
            }
        }
    }
}

export function fuzz_ArithDenseDense(trials: number = 100, maxDim: CFDim, numUnitsMax: number = 10, numSeriesMax: number = 10) {

    const rSeed = Math.floor(Math.random() * MAX_UINT32) as CFUint32;
    const rand = mulberry32_Real01(rSeed);

    for (let t = 0; t < trials; t++) {

        console.log(`Fuzz test trial ${t + 1}/${trials}`);
        const U = Math.floor(rand() * numUnitsMax) + 1 as CFUint32;
        const S = Math.floor(rand() * numSeriesMax) + 1 as CFUint32;
        const dim = Math.floor(rand() * maxDim) + 1 as CFDim;

        const arithOp = sArithOp(rand());
        const opType = (rand() > 0.5) ? CFBinOpType.Left : CFBinOpType.Right;
        const binOp = getBinOp(arithOp);
        let res: CFUnitFunc<CFDim> | undefined;
        
        const dOpts: CFDenseGenOptions<CFDim> = {
            dim,
            numUnits: U,
            numSeriesIndices: S,
            loRange: [-100_000, 100_000],
            hiRange: [100_000, 2_750_000],
            allowNull: true,
            seed: rSeed
        }
        
        const dFunc = makeValidUnitFuncDense(dOpts);
        if (dFunc === undefined) {
            throw new Error(`fuzz_ArithDenseDense: Failed to generate valid dense function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        const dFunc2 = makeValidUnitFuncDense(dOpts);
        if (dFunc2 === undefined) {
            throw new Error(`fuzz_ArithDenseDense: Failed to generate valid dense function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        switch(arithOp) {
            case CFArithOp.Add:
                res = dFunc.add(dFunc2, opType);
                break;
            case CFArithOp.Mul:
                res = dFunc.mul(dFunc2, opType);
                break;
            case CFArithOp.Sub:
                res = dFunc.sub(dFunc2, opType);
                break;
            case CFArithOp.Div:
                res = dFunc.div(dFunc2, opType);
                break;
                default:
                    throw new Error(
                        `fuzz_ArithDenseDense: Invalid arithmetic operation: ${arithOp} (should never happen)`);
        }
        // If successful, should always produce dense.
        if (res === undefined) {
            console.info(`fuzz_ArithDenseDense: Failed to compute arithmetic operation ${arithOpToString(arithOp)}`);
            break;
        }

        for(let s = 0 as CFSeriesIndex; s < S; s++) {
            const iter = getUnitIterator(dim, U);

            for(const ir of iter) {
                const dVal = dFunc.getUnsafe(...ir.units, s)!;
                const dVal2 = dFunc2.getUnsafe(...ir.units, s)!;
                const resVal = res.getUnsafe(...ir.units, s)!;
                const compVal = opType === CFBinOpType.Left ? binOp(dVal, dVal2) : binOp(dVal2, dVal);

                if (compVal === undefined) {
                    console.info(`fuzz_ArithDenseDense: Failed to manually compute arithmetic operation ${arithOp} on: 
                    ${ALGEBRA_IVAL.print(dVal)}
                    
                    and: 
                    
                    ${ALGEBRA_IVAL.print(dVal2)}

                    for units: ${printIntegerTuple(ir.units)}
                    Operation: ${arithOpToString(arithOp)}
                    Operation Type: ${binOpTypeToString(opType)}
                    Base dense function options: ${JSON.stringify(dOpts)}
                    `);
                    break;
                }

                if(!ALGEBRA_IVAL.eq(resVal, compVal)) {
                    const argTup = ir.units.concat([s]);
                    
                    throw new Error(`fuzz_ArithDenseDense: Arithmetic operation ${arithOpToString(arithOp)} failed to produce correct value.
                    
                    actual result: ${ALGEBRA_IVAL.print(resVal)}
                    expected result: ${ALGEBRA_IVAL.print(compVal)}
                    dense operand: ${ALGEBRA_IVAL.print(dVal)}
                    other dense operand: ${ALGEBRA_IVAL.print(dVal2)}
                    argument: ${printIntegerTuple(argTup)}
                    Operation: ${arithOpToString(arithOp)}
                    Operation Type: ${binOpTypeToString(opType)}
                    Result type: ${storageTagToString(res.storage)}
                    Base dense function options: ${JSON.stringify(dOpts)}
                    `)
                }
            }
        }
    }
}

export function fuzz_ArithSparseSparse(trials: number = 100, maxDim: CFDim, numUnitsMax: number = 10, numSeriesMax: number = 10) {

    const rSeed = Math.floor(Math.random() * MAX_UINT32) as CFUint32;
    const rand = mulberry32_Real01(rSeed);

    for (let t = 0; t < trials; t++) {

        console.log(`Fuzz test trial ${t + 1}/${trials}`);
        const U = Math.floor(rand() * numUnitsMax) + 1 as CFUint32;
        const S = Math.floor(rand() * numSeriesMax) + 1 as CFUint32;
        const dim = Math.floor(rand() * maxDim) + 1 as CFDim;

        const arithOp = sArithOp(rand());
        const opType = (rand() > 0.5) ? CFBinOpType.Left : CFBinOpType.Right;
        const binOp = getBinOp(arithOp);
        let res: CFUnitFunc<CFDim> | undefined;
        
        const dOpts: CFDenseGenOptions<CFDim> = {
            dim,
            numUnits: U,
            numSeriesIndices: S,
            loRange: [-100_000, 100_000],
            hiRange: [100_000, 2_750_000],
            allowNull: true,
            seed: rSeed
        }
        
        const dFunc = makeValidUnitFuncDense(dOpts);
        if (dFunc === undefined) {
            throw new Error(`fuzz_ArithDenseSparse: Failed to generate valid dense function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        const dFuncNullInj = injectNullDontCareHowManyWasAdded(
            dFunc, 
            Math.floor(dFunc.values.length * rand() * 0.1) as CFUint32, 
            rSeed
        );

        const sFunc = denseToSparse(dFuncNullInj as CFUnitFuncDense<CFDimSparse>);
        if (sFunc === undefined) {
            throw new Error(`fuzz_ArithDenseSparse: Failed to convert dense to sparse function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        const dFunc2 = makeValidUnitFuncDense(dOpts);
        if (dFunc2 === undefined) {
            throw new Error(`fuzz_ArithDenseSparse: Failed to generate valid dense function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        const dFunc2NullInj = injectNullDontCareHowManyWasAdded(
            dFunc2, 
            Math.floor(dFunc2.values.length * rand() * 0.1) as CFUint32, 
            rSeed
        );

        const sFunc2 = denseToSparse(dFunc2NullInj as CFUnitFuncDense<CFDimSparse>);

        if (sFunc2 === undefined) {
            throw new Error(`fuzz_ArithDenseSparse: Failed to convert dense to sparse function with options: 
            ${JSON.stringify(dOpts)}
            `);
        }

        switch(arithOp) {
            case CFArithOp.Add:
                res = sFunc.add(sFunc2, opType);
                break;
            case CFArithOp.Mul:
                res = sFunc.mul(sFunc2, opType);
                break;
            case CFArithOp.Sub:
                res = sFunc.sub(sFunc2, opType);
                break;
            case CFArithOp.Div:
                res = sFunc.div(sFunc2, opType);
                break;
                default:
                    throw new Error(
                        `fuzz_ArithDenseSparse: Invalid arithmetic operation: ${arithOp} (should never happen)`);
        }

        // If successful, should always produce dense.
        if (res === undefined) {
            console.info(`fuzz_ArithDenseSparse: Failed to compute arithmetic operation ${arithOpToString(arithOp)}`);
            break;
        }

        for(let s = 0 as CFSeriesIndex; s < S; s++) {
            const iter = getUnitIterator(dim, U);

            for(const ir of iter) {
                const sVal = sFunc.getUnsafe(...ir.units, s)!;
                const sVal2 = sFunc2.getUnsafe(...ir.units, s)!;
                const resVal = res.getUnsafe(...ir.units, s)!;
                const compVal = opType === CFBinOpType.Left ? binOp(sVal, sVal2) : binOp(sVal2, sVal);

                if (compVal === undefined) {
                    console.info(`fuzz_ArithDenseSparse: Failed to manually compute arithmetic operation ${arithOp} on: 
                    ${ALGEBRA_IVAL.print(sVal)} 
                    
                    and: 
                    
                    ${ALGEBRA_IVAL.print(sVal2)}

                    for units: ${printIntegerTuple(ir.units)}
                    Operation: ${arithOpToString(arithOp)}
                    Operation Type: ${binOpTypeToString(opType)}
                    Base dense function options: ${JSON.stringify(dOpts)}
                    `);
                    break;
                }

                if(!ALGEBRA_IVAL.eq(resVal, compVal)) {
                    const argTup = ir.units.concat([s]);
                    
                    throw new Error(`fuzz_ArithConstSparse: Arithmetic operation ${arithOpToString(arithOp)} failed to produce correct value.
                    
                    actual result: ${ALGEBRA_IVAL.print(resVal)}
                    expected result: ${ALGEBRA_IVAL.print(compVal)}
                    sparse operand: ${ALGEBRA_IVAL.print(sVal)}
                    other sparse operand: ${ALGEBRA_IVAL.print(sVal2)}
                    argument: ${printIntegerTuple(argTup)}
                    Operation: ${arithOpToString(arithOp)}
                    Operation Type: ${binOpTypeToString(opType)}
                    Result type: ${storageTagToString(res.storage)}
                    Base dense function options: ${JSON.stringify(dOpts)}
                    `)
                }

            }
        }
    }
}

function run() {
    console.log("Running fuzz tests for arithmetic operations.");
    fuzz_ArithSparseSparse(10, 2 as CFDim, 100, 10);
    console.log("Fuzz tests for arithmetic operations completed.");
}

run();