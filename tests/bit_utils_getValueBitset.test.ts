import {describe, expect, it} from "vitest";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {
    ALGEBRA_IVAL,
    CFCompData,
    CFIval,
    CFUint32,
    CFUnit,
    createBinaryCompFunc,
    createBaseUnitFunction,
    createBaseUnitFunctionInverse
} from "../src";
import {getValueBitset} from "../src/bit_utils";

const generateMap = (cf: CFCompData[], U: number): Map<number, CFIval> => {
    const cMap: Map<number, CFIval> = new Map();
    for (const [u, v, s, x] of cf) {
        cMap.set(s*U*U + u*U + v, x as CFIval);
    }
    return cMap;
}

const generateMapFilteredU = (cf: CFCompData[], base: number, U: number) => {
    const cMap: Map<number, CFIval> = new Map();
    for (const [u, v, s, x] of cf) {
        if(u === base) {
            cMap.set(s * U + v, x as CFIval);
        }
    }
    return cMap;
}

const generateMapFilteredV = (cf: CFCompData[], base: number, U: number) => {
    const cMap: Map<number, CFIval> = new Map();
    for (const [u, v, s, x] of cf) {
        if(v === base) {
            cMap.set(s * U + u, x as CFIval);
        }
    }
    return cMap;
}

describe('getValueBitset', () => {

    it('gets correct values for a valid generated dataset from comparison function', () => {
        const {arr, numUnits, numSeriesIndices} = makeValidCFCompDataset({
            maxUnitIndex: 7,          // U=3
            maxSeriesIndex: 3,        // S=2
            numComparisons: 17,
            loRange: [-5, 2],
            hiRange: [-1, 8],
            seed: 42,
            diagonalBias: 'avoid',
            seriesDistribution: 'roundRobin',
        });
        const cf = createBinaryCompFunc(arr, numUnits, numSeriesIndices);
        const cMap = generateMap(arr, numUnits);
        for(let u = 0; u < numUnits; u++) {
            for(let v = 0; v < numUnits; v++) {
                for(let s = 0; s < numSeriesIndices; s++) {
                    const valBS: CFIval = getValueBitset(cf.bitset, cf.values, v as CFUint32, s*cf.NU + u as CFUint32);
                    const idx = s*numUnits*numUnits + u*numUnits + v;
                    if(cMap.has(idx)) {
                        expect(ALGEBRA_IVAL.isValid(valBS)).toBe(true);
                        expect(!ALGEBRA_IVAL.isNull(valBS)).toBe(true);
                        expect(ALGEBRA_IVAL.eq(valBS, cMap.get(idx)!)).toBe(true);
                    } else {
                        expect(ALGEBRA_IVAL.isNull(valBS)).toBe(true);
                    }
                }
            }
        }

    });

    it('gets correct values for a valid generated dataset from base unit function', () => {
        const {arr, numUnits, numSeriesIndices} = makeValidCFCompDataset({
            maxUnitIndex: 7,          // U=3
            maxSeriesIndex: 3,        // S=2
            numComparisons: 17,
            loRange: [-5, 2],
            hiRange: [-1, 8],
            seed: 42,
            diagonalBias: 'avoid',
            seriesDistribution: 'roundRobin',
        });

        const cf = createBinaryCompFunc(arr, numUnits, numSeriesIndices);
        for(let u = 0; u < numUnits; u++) {
        const cMap = generateMapFilteredU(arr, u, numUnits);
        const uFunc = createBaseUnitFunction(cf, u as CFUnit);
            for(let v = 0; v < numUnits; v++) {
                for(let s = 0; s < numSeriesIndices; s++) {
                    const valBS: CFIval = getValueBitset(uFunc.bitset, uFunc.values, v as CFUint32, s as CFUint32);
                    const idx = s*numUnits + v;
                    if(cMap.has(idx)) {
                        expect(ALGEBRA_IVAL.isValid(valBS)).toBe(true);
                        expect(!ALGEBRA_IVAL.isNull(valBS)).toBe(true);
                        expect(ALGEBRA_IVAL.eq(valBS, cMap.get(idx)!)).toBe(true);
                    } else {
                        expect(ALGEBRA_IVAL.isNull(valBS)).toBe(true);
                    }
                }
            }
        }
    });

    it('gets correct values for a valid generated dataset from base unit function inverse', () => {
        const {arr, numUnits, numSeriesIndices} = makeValidCFCompDataset({
            maxUnitIndex: 7,
            maxSeriesIndex: 3,
            numComparisons: 17,
            loRange: [-5, 2],
            hiRange: [-1, 8],
            seed: 42,
            diagonalBias: 'avoid',
            seriesDistribution: 'roundRobin',
        });

        const cf = createBinaryCompFunc(arr, numUnits, numSeriesIndices);
        for(let v = 0; v < numUnits; v++) {
            const cMap = generateMapFilteredV(arr, v, numUnits);
            const uFunc = createBaseUnitFunctionInverse(cf, v as CFUint32);
            for (let u = 0; u < numUnits; u++) {
                for (let s = 0; s < numSeriesIndices; s++) {
                    const valBS: CFIval = getValueBitset(uFunc.bitset, uFunc.values, u as CFUint32, s as CFUint32);
                    const idx = s * numUnits + u;
                    if (cMap.has(idx)) {
                        expect(ALGEBRA_IVAL.isValid(valBS)).toBe(true);
                        expect(!ALGEBRA_IVAL.isNull(valBS)).toBe(true);
                        expect(ALGEBRA_IVAL.eq(valBS, cMap.get(idx)!)).toBe(true);
                    } else {
                        expect(ALGEBRA_IVAL.isNull(valBS)).toBe(true);
                    }
                }
            }
        }
    });

});