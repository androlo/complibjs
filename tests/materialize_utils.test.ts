import {describe, it, expect} from "vitest";
import {genRand01ValueArray, makeValidCFCompDataset} from "./utils/dataset_gen";
import {
    ALGEBRA_IVAL,
    ALGEBRA_REAL, CFDim, CFDimSparse,
    CFIval,
    CFReal,
    CFSeriesIndex, CFUint32,
    CFUnit, CFUnitFuncDense, CFUnitFuncDenseImpl,
    createBinaryCompFunc,
    CFStorageTag
} from "../src";

import {
    measureDensitySparse,
    sparseToDense,
    measureDensityDense, denseToSparse
} from "../src/materialize";
import {generatePowerArray} from "../src/math_utils";

describe('sparseToDense', () => {
    it('should convert sparse to dense', () => {
        const {arr, numUnits, numSeriesIndices} = makeValidCFCompDataset({
            maxUnitIndex: 2 as CFUint32,          // U=3
            maxSeriesIndex: 1 as CFUint32,        // S=2
            numComparisons: 10 as CFUint32,
            loRange: [-5, 2],
            hiRange: [-1, 8],
            seed: 42 as CFUint32,
            diagonalBias: 'avoid',
            seriesDistribution: 'roundRobin',
        });

        const iMap: Map<number, CFIval> = new Map();
        for(let comp of arr) {
            iMap.set(comp[2]*numUnits*numUnits + comp[0]*numUnits + comp[1], comp[3] as CFIval);
        }

        const cf = createBinaryCompFunc(arr, numUnits, numSeriesIndices);
        const uf = cf.toUnitFunc();
        const df = sparseToDense(uf)!;
        expect(df.storage).toBe(CFStorageTag.Dense);
        expect(df.values.length).toBe(18);
        for(let s = 0 as CFSeriesIndex; s < numSeriesIndices; s++) {
            for(let u = 0 as CFUnit; u < numUnits; u++) {
                for(let v = 0 as CFUnit; v < numUnits; v++) {
                    const idx = s*numUnits*numUnits + u*numUnits + v;
                    const val = df.get(u, v, s)!;

                    if(iMap.has(idx)) {
                        expect(ALGEBRA_IVAL.eq(val, iMap.get(idx)!)).toBe(true);
                    } else {
                        expect(ALGEBRA_IVAL.isNull(val)).toBe(true);
                    }
                }
            }
        }
    });

    it('should convert dense to sparse', () => {

        const U = 5 as CFUint32;
        const S = 3 as CFUint32;
        const dim = 2 as CFDim;
        const size = U*U*S as CFUint32;
        const pows = generatePowerArray(dim + 1 as CFUint32, U)!;
        const values = genRand01ValueArray(size);
        const df = new CFUnitFuncDenseImpl(dim, U, S, values, pows);
        const sf = denseToSparse(df as CFUnitFuncDense<CFDimSparse>)!;
        expect(sf.storage).toBe(CFStorageTag.Sparse);

        let vCount = 0;
        for(let i = 0; i < values.length; i++) {
            if(!ALGEBRA_IVAL.isNull(values[i])) vCount++;
        }

        expect(sf.values.length).toBe(vCount);

        for(let s = 0 as CFSeriesIndex; s < S; s++) {
            for(let u = 0 as CFUnit; u < U; u++) {
                for(let v = 0 as CFUnit; v < U; v++) {
                    const sfVal = sf.get(u, v, s)!;
                    const dfVal = df.get(u, v, s)!;
                    expect(ALGEBRA_IVAL.eq(sfVal, dfVal)).toBe(true);
                }
            }
        }
    });
})

describe('measureDensitySparse', () => {
    it('should find the right density of a sparse function', () => {
        const {arr, numUnits, numSeriesIndices} = makeValidCFCompDataset({
            maxUnitIndex: 2 as CFUint32,          // U=3
            maxSeriesIndex: 1 as CFUint32,        // S=2
            numComparisons: 10 as CFUint32,
            loRange: [-5, 2],
            hiRange: [-1, 8],
            seed: 42 as CFUint32,
            diagonalBias: 'avoid',
            seriesDistribution: 'roundRobin',
        });
        const cf = createBinaryCompFunc(arr, numUnits, numSeriesIndices);
        const uf = cf.toUnitFunc();
        const ds = measureDensitySparse(uf)!;
        // There are 10 comparisons, and U*U*S = 18 values in total.
        const expDs = ALGEBRA_REAL.div(10 as CFReal, 18 as CFReal)!;
        expect(ALGEBRA_REAL.eq(ds, expDs)).toBe(true);
    });
})

describe('measureDensityDense', () => {
    it('should find the right density of a dense function', () => {
        const {arr, numUnits, numSeriesIndices} = makeValidCFCompDataset({
            maxUnitIndex: 2 as CFUint32,          // U=3
            maxSeriesIndex: 1 as CFUint32,        // S=2
            numComparisons: 10 as CFUint32,
            loRange: [-5, 2],
            hiRange: [-1, 8],
            seed: 42 as CFUint32,
            diagonalBias: 'avoid',
            seriesDistribution: 'roundRobin',
        });
        const cf = createBinaryCompFunc(arr, numUnits, numSeriesIndices);
        const uf = cf.toUnitFunc();
        const duf = sparseToDense(uf)!;
        const ds = measureDensityDense(duf)!;
        // There are 10 comparisons, and U*U*S = 18 values in total.
        const expDs = ALGEBRA_REAL.div(10 as CFReal, 18 as CFReal)!;
        expect(ALGEBRA_REAL.eq(ds, expDs)).toBe(true);
    });
})


