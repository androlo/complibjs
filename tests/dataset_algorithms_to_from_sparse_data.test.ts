import { describe, it, expect } from "vitest";
import { buildSparseDataPerSeries, sparseToCFCompData } from "../src/dataset_algorithms";

import {
  type CFValidCompDataSet,
  CFUint32
} from "../src";
import { CFGenOptions, makeValidCFCompDataset } from "./utils/dataset_gen";

describe("buildSparseDataPerSeries", () => {

  it("populates maps by [series][u].get(v) = interval", () => {
    const numSeriesIndices = 2;
    const numUnits = 3;

    const data: CFValidCompDataSet = [
      [0, 1, 0, [0.1, 0.2]] as any,
      [2, 0, 0, [0.3, 0.4]] as any,
      [1, 2, 1, [1.0, 2.0]] as any
    ];

    const perSeries = buildSparseDataPerSeries(data, numUnits, numSeriesIndices);

    expect(perSeries[0][0].get(1)).toEqual([0.1, 0.2]);
    expect(perSeries[0][2].get(0)).toEqual([0.3, 0.4]);
    expect(perSeries[1][1].get(2)).toEqual([1.0, 2.0]);
  });

  it("supports multiple v for the same (series, u)", () => {
    const data: CFValidCompDataSet = [
      [1, 0, 0, [5, 6]] as any,
      [1, 2, 0, [7, 8]] as any
    ];

    const perSeries = buildSparseDataPerSeries(data, 3, 1);

    const row = perSeries[0][1];
    expect(row.size).toBe(2);
    expect(row.get(0)).toEqual([5, 6]);
    expect(row.get(2)).toEqual([7, 8]);
  });

  it("sorts big dataset", () => {
    
    const opts: CFGenOptions = {
        maxUnitIndex: 25 as CFUint32,
        maxSeriesIndex: 4 as CFUint32,
        numComparisons: 1000 as CFUint32,
        loRange: [0, 100],
        hiRange: [101, 200],
        seed: 42 as CFUint32,
        diagonalBias: 'none',
        seriesDistribution: 'roundRobin'
    };

    const {arr, numUnits, numSeriesIndices} = makeValidCFCompDataset(opts);


    const perSeries = buildSparseDataPerSeries(arr as any, numUnits, numSeriesIndices);

    for (let i = 0; i < arr.length; i++) {
        const [u, v, s, iv] = arr[i];
        const storedIv = perSeries[s][u].get(v);
        expect(storedIv).not.toBeUndefined();
        expect(storedIv![0]).toBe(iv[0]);
        expect(storedIv![1]).toBe(iv[1]);
    }
    expect(perSeries.length).toBe(numSeriesIndices);

    let psCount = 0;
    for(let i = 0; i < perSeries.length; i++) {
        const pss = perSeries[i];
        for(let j = 0; j < pss.length; j++) {
            psCount += pss[j].size;
        }
    }
    expect(psCount).toBe(arr.length);

  });

});

describe("sparseToCFCompData", () => {
  
  it("reconstructs a dataset", () => {
    
    const opts: CFGenOptions = {
        maxUnitIndex: 8 as CFUint32,
        maxSeriesIndex: 4 as CFUint32,
        numComparisons: 100 as CFUint32,
        loRange: [0, 100],
        hiRange: [101, 200],
        seed: 42 as CFUint32,
        diagonalBias: 'none',
        seriesDistribution: 'roundRobin'
    };

    const {arr, numUnits, numSeriesIndices} = makeValidCFCompDataset(opts);

    const perSeries = buildSparseDataPerSeries(arr as any, numUnits, numSeriesIndices);
    const reconstructed = sparseToCFCompData(perSeries);
    expect(reconstructed.length).toBe(arr.length);

    let count = 0;

    for (let i = 0; i < arr.length; i++) {
      
      reconstructed.find((item) => { 
        const [u, v, s, iv] = item;
        const [ou, ov, os, oiv] = arr[i];
        if (u === ou && v === ov && s === os && iv[0] === oiv[0] && iv[1] === oiv[1]) {
            count++;
            return true;
        }
        return false;
      });
    }

    expect(count).toBe(arr.length);
  });

});
