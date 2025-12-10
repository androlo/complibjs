import { describe, it, expect } from "vitest";

import {
    ALGEBRA_IVAL,
    CFCompData,
    CFIval,
    CFReal,
    CFUint32,
    CFUnit,
    createBinaryCompFunc,
    CFStorageTag,
} from "../src";
import {createBaseUnitFunction, createBaseUnitFunctionInverse} from "../src";
import {CFGenOptions, makeValidCFCompDataset} from "./utils/dataset_gen";

const comps: CFCompData[] = [
    [0, 0, 0, [1 as CFReal, 1 as CFReal]],
    [1, 0, 0, [0.5 as CFReal, 0.5 as CFReal]],
    [0, 1, 0, [2 as CFReal, 2 as CFReal]],
    [1, 1, 0, [1 as CFReal, 1 as CFReal]],
    [0, 0, 1, [1 as CFReal, 1 as CFReal]],
    [1, 0, 1, [0.25 as CFReal, 0.25 as CFReal]],
    [0, 1, 1, [4 as CFReal, 4 as CFReal]],
    [1, 1, 1, [1 as CFReal, 1 as CFReal]],
];

const compsU: CFIval[] = [
    [1 as CFReal, 1 as CFReal], // 0,0,0
    [2 as CFReal, 2 as CFReal], // 0,1,0
    [1 as CFReal, 1 as CFReal], // 0,0,1
    [4 as CFReal, 4 as CFReal]  // 0,1,1
];

const compsUInv: CFIval[] = [
    [1 as CFReal, 1 as CFReal],         // 0,0,0
    [0.5 as CFReal, 0.5 as CFReal],     // 1,0,0
    [1 as CFReal, 1 as CFReal],         // 0,0,1
    [0.25 as CFReal, 0.25 as CFReal]    // 1,0,1
];

describe("createBaseUnitFunc", () => {

    it("creates a base unit function from unit '0' in compfunc", () => {

        const cf = createBinaryCompFunc(comps, 2 as CFUint32, 2 as CFUint32);
        const uBase: CFUnit = 0 as CFUnit;

        const fu = createBaseUnitFunction(cf, uBase);

        expect(fu.dim).toBe(1);
        expect(fu.storage).toBe(CFStorageTag.Sparse);

        expect(fu.bitset.eWordsPerRow).toBe(1);
        expect(fu.bitset.eBits.length).toBe(2);
        expect(fu.bitset.eBits).to.deep.equal(Uint32Array.from([3, 3])); // Bits 0 and 1 set in both rows.
        expect(fu.bitset.rowPtr.length).toBe(3);
        expect(fu.bitset.rowPtr).to.deep.equal(Uint32Array.from([0, 2, 4]));

        for(let s = 0; s < 2; s++) {
            for(let u = 0; u < 2; u++) {
                let val = fu.get(u as CFUint32, s as CFUint32)!;
                expect(val).to.not.be.null;
                expect(ALGEBRA_IVAL.eq(val, compsU[s*2 + u])).to.be.true;
            }
        }

    });

    it("creates a base unit function inverse from unit '0' in compfunc", () => {

        const cf = createBinaryCompFunc(comps, 2 as CFUint32, 2 as CFUint32);
        const uBase: CFUnit = 0 as CFUnit;

        const fui = createBaseUnitFunctionInverse(cf, uBase);

        expect(fui.dim).toBe(1);
        expect(fui.storage).toBe(CFStorageTag.Sparse);

        expect(fui.bitset.eWordsPerRow).toBe(1);
        expect(fui.bitset.eBits.length).toBe(2);
        expect(fui.bitset.eBits).to.deep.equal(Uint32Array.from([3, 3])); // Bits 0 and 1 set in both rows.
        expect(fui.bitset.rowPtr.length).toBe(3);
        expect(fui.bitset.rowPtr).to.deep.equal(Uint32Array.from([0, 2, 4]));

        for(let s = 0; s < 2; s++) {
            for(let u = 0; u < 2; u++) {
                let val = fui.get(u as CFUint32, s as CFUint32)!;
                expect(val).to.not.be.null;
                expect(ALGEBRA_IVAL.eq(val, compsUInv[s*2 + u])).to.be.true;
            }
        }

    });

    function extractValueFromDataset(data: CFCompData[], u: number, v: number, s: number): CFIval {
        const fU = data.filter(comp => comp[0] === u);
        if (fU.length === 0) {
            return [0 as CFReal, 0 as CFReal] as CFIval;
        }
        const fV = fU.filter(comp => comp[1] === v);
        if (fV.length === 0) {
            return [0 as CFReal, 0 as CFReal] as CFIval;
        }
        const fS = fV.filter(comp => comp[2] === s);
        if (fS.length === 0) {
            return [0 as CFReal, 0 as CFReal] as CFIval;
        }
        if (fS.length > 1) {
            throw new Error("Duplicate comparison found");
        }
        return fS[0][3] as CFIval;
    }

    it("creates a base unit function from all units in compfunc", () => {

        const datasets = [
            //{maxUnitIndex: 3, maxSeriesIndex: 2, numComparisons: 12, loRange: [0.1, 1], hiRange: [1, 2] },
            {maxUnitIndex: 12, maxSeriesIndex: 5, numComparisons: 56, loRange: [0.1, 1], hiRange: [1, 2] }
        ];

        for(let i = 0; i < datasets.length; i++) {
            const base = makeValidCFCompDataset(datasets[i] as CFGenOptions);
            const cf = createBinaryCompFunc(base.arr, base.numUnits, base.numSeriesIndices);

            for(let u = 0; u < base.numUnits; u++) {
                const uBase: CFUnit = u as CFUnit;

                const fu = createBaseUnitFunction(cf, uBase);

                expect(fu.dim).toBe(1);
                expect(fu.storage).toBe(CFStorageTag.Sparse);

                for(let s = 0; s < base.numSeriesIndices; s++) {
                    for(let u = 0; u < base.numUnits; u++) {
                        let val = fu.get(u as CFUint32, s as CFUint32)!;
                        let exp = extractValueFromDataset(base.arr, uBase, u, s);

                        expect(ALGEBRA_IVAL.eq(val, exp)).to.be.true;
                    }
                }
            }
        }

    });

    it("creates a base unit function inverse from all units in compfunc", () => {

        const datasets = [
            {maxUnitIndex: 56, maxSeriesIndex: 2, numComparisons: 100, loRange: [0.1, 1], hiRange: [1, 2] }
        ];

        for(let i = 0; i < datasets.length; i++) {
            const base = makeValidCFCompDataset(datasets[i] as CFGenOptions);
            const cf = createBinaryCompFunc(base.arr, base.numUnits, base.numSeriesIndices);

            for(let u = 0; u < base.numUnits; u++) {
                const uBase: CFUnit = u as CFUnit;

                const fui = createBaseUnitFunctionInverse(cf, uBase);

                expect(fui.dim).toBe(1);
                expect(fui.storage).toBe(CFStorageTag.Sparse);

                for(let s = 0; s < base.numSeriesIndices; s++) {
                    for(let u = 0; u < base.numUnits; u++) {
                        let val = fui.get(u as CFUint32, s as CFUint32)!;
                        let exp = extractValueFromDataset(base.arr, u, uBase, s);
                        expect(ALGEBRA_IVAL.eq(val, exp)).to.be.true;
                    }
                }
            }

        }

    });

});
