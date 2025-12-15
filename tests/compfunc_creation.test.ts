import { describe, it, expect } from 'vitest';
import { makeValidCFCompDataset, mutators } from './utils/dataset_gen';
import {
    CFCompFuncBinary,
    CFCompData,
    CFUint32,
    createBinaryCompFunc,
    validateBinaryCompData,
    CFUint32Three,
    ALGEBRA_IVAL
} from "../src";
import {validateNAryCompData} from "../src";

function checkCompFunc(cf: CFCompFuncBinary, arr: CFCompData[]) {
    for(let comp of arr) {
        expect(cf.getUnsafe(comp[0] as CFUint32, comp[1] as CFUint32, comp[2] as CFUint32)).to.deep.equal(comp[3]);
    }
}

describe('binary validator success', () => {
    it('accepts a valid generated dataset', () => {
        const { arr, numUnits, numSeriesIndices } = makeValidCFCompDataset({
            maxUnitIndex: 2 as CFUint32,          // U=3
            maxSeriesIndex: 1 as CFUint32,        // S=2
            numComparisons: 10 as CFUint32,
            loRange: [-5, 2],
            hiRange: [-1, 8],
            seed: 42 as CFUint32,
            diagonalBias: 'avoid',
            seriesDistribution: 'roundRobin',
        });
        expect(() => validateBinaryCompData(arr, numUnits, numSeriesIndices)).not.toThrow();
    });
});

describe('correctly produced binary comparison functions', () => {
    it('accepts a valid generated dataset', () => {
        const { arr, numUnits, numSeriesIndices } = makeValidCFCompDataset({
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
        checkCompFunc(cf, arr);
    });

    it('runs createBinaryCompFunc for a few generated datasets', () => {
        // Try a few sizes / seeds
        const cases = [
            { maxUnitIndex: 0, numComparisons: 1, seed: 11 },
            { maxUnitIndex: 5, numComparisons: 12, seed: 42 },
            { maxUnitIndex: 7, numComparisons: 15, seed: 99 },
            { maxUnitIndex: 14, numComparisons: 43, seed: 31 },
            { maxUnitIndex: 55, numComparisons: 112, seed: 67 },
        ];

        for (const { maxUnitIndex, numComparisons, seed } of cases) {
            const gen = makeValidCFCompDataset({
                maxUnitIndex: maxUnitIndex as CFUint32,
                maxSeriesIndex: 0 as CFUint32,             // S=1 (series index 0)
                numComparisons: numComparisons as CFUint32,
                loRange: [0, 1],               // keep simple, avoid negatives for now
                hiRange: [1, 5],               // ensures lo <= hi and avoids [0,0] most of the time
                seed: seed as CFUint32,
                diagonalBias: 'prefer',        // improve odds of (u,u,0)
                seriesDistribution: 'roundRobin',
            });

            const { arr, numUnits, numSeriesIndices } = gen; // numSeriesIndices will be 1

            const cf = createBinaryCompFunc(arr, numUnits, numSeriesIndices);
            checkCompFunc(cf, arr);
        }
    });


});

describe('binary validator failures (one rule per test)', () => {
    it('Rule 1: empty array', () => {
        const base = makeValidCFCompDataset({
            maxUnitIndex: 1 as CFUint32,
            maxSeriesIndex: 0 as CFUint32,
            numComparisons: 2 as CFUint32,
            loRange: [0.1,1],
            hiRange: [1,2]
        });
        const bad = mutators.makeEmptyArray(base.arr);
        expect(() => validateBinaryCompData(bad, base.numUnits, base.numSeriesIndices)).toThrow(/at least one/i);
    });

    it('Rule 5: missing a unit index', () => {
        const base = makeValidCFCompDataset({
            maxUnitIndex: 3 as CFUint32,
            maxSeriesIndex: 1 as CFUint32,
            numComparisons: 12 as CFUint32,
            loRange: [0.1,1],
            hiRange: [1,2]
        });
        const bad = mutators.dropUnitIndex(base.arr, 2);
        expect(() => validateBinaryCompData(bad, base.numUnits - 1 as CFUint32, base.numSeriesIndices)).toThrow(/unit index out of range/i);
    });

    it('Rule 7: duplicate (u,v,s)', () => {
        const base = makeValidCFCompDataset({
            maxUnitIndex: 2 as CFUint32,
            maxSeriesIndex: 2 as CFUint32,
            numComparisons: 12 as CFUint32,
            loRange: [0.1,1],
            hiRange: [1,2]
        });
        const bad = mutators.insertDuplicateTriple(base.arr);
        expect(() => validateBinaryCompData(bad, base.numUnits, base.numSeriesIndices)).toThrow(/duplicate/i);
    });


});

describe('validateNAryCompData (n-ary, dim > 2)', () => {
    it('throws when no comparisons are provided', () => {
        const arr: any[] = [];

        expect(() =>
            validateNAryCompData(arr, 3 as CFUint32Three, 2 as CFUint32, 2 as CFUint32),
        ).toThrow(/At least one comparison/);
    });

    it('accepts a simple valid 3-ary dataset', () => {
        const dim = 3 as CFUint32Three;
        const numUnits = 2 as CFUint32;          // units {0,1}
        const numSeriesIndices = 2 as CFUint32;  // series {0,1}

        // [u0, u1, u2, s, value]
        const arr: any = [
            [0, 0, 0, 0, ALGEBRA_IVAL.one()], // uses unit 0, series 0
            [1, 1, 1, 1, ALGEBRA_IVAL.one()], // uses unit 1, series 1
        ];

        expect(() =>
            validateNAryCompData(arr, dim, numUnits, numSeriesIndices),
        ).not.toThrow();
    });

    it('throws when an entry has wrong length (not dim + 2)', () => {
        const dim = 3 as CFUint32Three;
        const numUnits = 2 as CFUint32;
        const numSeriesIndices = 2 as CFUint32;

        const arr: any = [
            [0, 0, 0, 0, ALGEBRA_IVAL.one()],
            // Missing value -> length 4 instead of 5
            [1, 1, 1, 1],
        ];

        expect(() =>
            validateNAryCompData(arr, dim, numUnits, numSeriesIndices),
        ).toThrow(/length must be dim \+ 2/);
    });

    it('throws when a unit index is not a number', () => {
        const dim = 3 as CFUint32Three;
        const numUnits = 2 as CFUint32;
        const numSeriesIndices = 2 as CFUint32;

        const arr: any = [
            // u1 is a string here
            [0, 'not-a-number', 0, 0, ALGEBRA_IVAL.one()],
        ];

        expect(() =>
            validateNAryCompData(arr, dim, numUnits, numSeriesIndices),
        ).toThrow(/unit must be a number/);
    });

    it('throws when a unit index is out of range', () => {
        const dim = 3 as CFUint32Three;
        const numUnits = 2 as CFUint32;
        const numSeriesIndices = 1 as CFUint32;

        const arr: any = [
            [0, 0, 2, 0, ALGEBRA_IVAL.one()], // u2 = 2 >= numUnits (=2) → out of range
        ];

        expect(() =>
            validateNAryCompData(arr, dim, numUnits, numSeriesIndices),
        ).toThrow(/unit index out of range/);
    });

    it('throws when a series index is out of range', () => {
        const dim = 3 as CFUint32Three;
        const numUnits = 2 as CFUint32;
        const numSeriesIndices = 1 as CFUint32;

        const arr: any = [
            [0, 0, 0, 1, ALGEBRA_IVAL.one()], // s = 1, but numSeriesIndices = 1 → out of range
        ];

        expect(() =>
            validateNAryCompData(arr, dim, numUnits, numSeriesIndices),
        ).toThrow(/s=1 is out of range/);
    });

    it('throws when a value is not accepted by algebra.isValue', () => {
        const dim = 3 as CFUint32Three;
        const numUnits = 2 as CFUint32;
        const numSeriesIndices = 1 as CFUint32;

        const arr: any = [
            [0, 0, 0, 0, 'not-a-number'], // algebra.isValue should reject this
        ];

        expect(() =>
            validateNAryCompData(arr, dim, numUnits, numSeriesIndices),
        ).toThrow(/not a value/);
    });

    it('throws when a value is considered null by the algebra', () => {
        const dim = 3 as CFUint32Three;
        const numUnits = 2 as CFUint32;
        const numSeriesIndices = 1 as CFUint32;

        const arr: any = [
            [0, 0, 0, 0, ALGEBRA_IVAL.null()],
        ];

        expect(() =>
            validateNAryCompData(arr, dim, numUnits, numSeriesIndices),
        ).toThrow(/null value is not allowed/);
    });

    it('throws on duplicate (u0, ..., uN, s)', () => {
        const dim = 3 as CFUint32Three;
        const numUnits = 3 as CFUint32;
        const numSeriesIndices = 2 as CFUint32;

        const arr: any = [
            [0, 1, 2, 0, ALGEBRA_IVAL.one()],
            // Same (u0,u1,u2,s) tuple, different value -> should be rejected
            [0, 1, 2, 0, ALGEBRA_IVAL.one()],
        ];

        expect(() =>
            validateNAryCompData(arr, dim, numUnits, numSeriesIndices),
        ).toThrow(/Duplicate mapping for/);
    });

    it('throws when units set does not cover all {0..numUnits-1}', () => {
        const dim = 3 as CFUint32Three;
        const numUnits = 3 as CFUint32;
        const numSeriesIndices = 1 as CFUint32;

        // Only using units 0 and 1, never 2
        const arr: any = [
            [0, 0, 0, 0, ALGEBRA_IVAL.one()],
            [1, 1, 1, 0, ALGEBRA_IVAL.one()],
        ];

        expect(() =>
            validateNAryCompData(arr, dim, numUnits, numSeriesIndices),
        ).toThrow(/Units must be size 3; got 2/);
    });

    it('throws when series set does not cover all {0..numSeriesIndices-1}', () => {
        const dim = 3 as CFUint32Three;
        const numUnits = 2 as CFUint32;
        const numSeriesIndices = 2 as CFUint32;

        // Only using series 0
        const arr: any = [
            [0, 0, 0, 0, ALGEBRA_IVAL.one()],
            [1, 1, 1, 0, ALGEBRA_IVAL.one()],
        ];

        expect(() =>
            validateNAryCompData(arr, dim, numUnits, numSeriesIndices),
        ).toThrow(/Series indices must be size 2; got 1./);
    });
});
