import {describe, expect, it} from "vitest";
import {makeValidCFCompDataset} from "./utils/dataset_gen";
import {CFCompData, CFUint32, createBinaryCompFunc} from "../src";
import {bitTestRow} from "../src/bit_utils";

const generateIndices = (cf: CFCompData[], U: number): Set<number> => {
    const indices: Set<number> = new Set();
    for (const [u, v, s, [lo, hi]] of cf) {
        indices.add(s*U*U + u*U + v);
    }
    return indices;
}

describe('bitTestRow', () => {

    it('accepts a valid generated dataset', () => {
        const {arr, numUnits, numSeriesIndices} = makeValidCFCompDataset({
            maxUnitIndex: 7 as CFUint32,          // U=3
            maxSeriesIndex: 3 as CFUint32,        // S=2
            numComparisons: 17 as CFUint32,
            loRange: [-5, 2],
            hiRange: [-1, 8],
            seed: 42 as CFUint32,
            diagonalBias: 'avoid',
            seriesDistribution: 'roundRobin',
        });
        const cf = createBinaryCompFunc(arr, numUnits, numSeriesIndices);
        const indices = generateIndices(arr, numUnits);
        for(let u = 0; u < numUnits; u++) {
            for(let v = 0; v < numUnits; v++) {
                for(let s = 0; s < numUnits; s++) {
                    const bt = bitTestRow(cf, u as CFUint32, v as CFUint32, s as CFUint32);
                    const idx = s*numUnits*numUnits + u*numUnits + v;
                    expect(bt).toBe(indices.has(idx));
                }
            }
        }

        

    });

});
