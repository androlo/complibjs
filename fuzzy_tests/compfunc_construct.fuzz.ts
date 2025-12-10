import {CFGenOptions} from "../tests/utils/dataset_gen";
import {CFGen} from "./utils/cfgen";
import {MAX_UINT32} from "../src/math_utils";

type CompFuncConstructFuzzOptions = {
    "validateCompFunc": boolean,
    "createCompFunc": boolean
}

const cfgen = new CFGen();

export function fuzz_validateBinaryCompFunc(trials: number = 100, numUnitsMax: number = 10, numSeriesMax: number = 10) {
    
    console.log(`fuzz_validateBinaryCompFunc: Running ${trials} trial(s) with max units ${numUnitsMax} and max series ${numSeriesMax}`);
    
    for(let i = 0; i < trials; i++) {

        const U = Math.floor(Math.random() * numUnitsMax) + 1;
        const S = Math.floor(Math.random() * numSeriesMax) + 1;
        const maxVal = Math.max(U, S);
        const numComps = Math.floor(maxVal + (U*U*S - maxVal)*Math.random());
        const rand = Math.random();
        const dd = rand > 0.7 ? 'prefer' : rand > 0.4 ? 'avoid' : 'none';

        const low = 0, mid = Math.random()*MAX_UINT32, high = MAX_UINT32;

        const opts: CFGenOptions = {
            maxUnitIndex: U - 1,
            maxSeriesIndex: S - 1,
            numComparisons: numComps,
            loRange: [low, mid],
            hiRange: [mid, high],
            seed: Math.floor(Math.random() * MAX_UINT32),
            diagonalBias: dd,
            seriesDistribution: 'roundRobin'
        };

        cfgen.validateBinaryCompData(opts);
    }
    console.log(`fuzz_validateBinaryCompFunc: Done.`);
}

export function fuzz_createBinaryCompFunc(trials: number = 100, numUnitsMax: number = 10, numSeriesMax: number = 10) {

    console.log(`fuzz_createBinaryCompFunc: Running ${trials} trial(s) with max units ${numUnitsMax} and max series ${numSeriesMax}`);
    
    for(let i = 0; i < trials; i++) {
        console.log(`fuzz_createBinaryCompFunc: trial ${i+1}`);

        const U = Math.floor(Math.random() * numUnitsMax) + 1;
        const S = Math.floor(Math.random() * numSeriesMax) + 1;
        const maxVal = Math.max(U, S);
        const numComps = Math.floor(maxVal + (U*U*S - maxVal)*Math.random());
        let dd: 'avoid' | 'prefer' = 'avoid';
        if (Math.random() > 0.7) {
            dd = 'prefer';
        }
        const low = 0, mid = Math.random()*MAX_UINT32, high = MAX_UINT32;
        const opts: CFGenOptions = {
            maxUnitIndex: U - 1,
            maxSeriesIndex: S - 1,
            numComparisons: numComps,
            loRange: [low, mid],
            hiRange: [mid, high],
            seed: Math.floor(Math.random() * MAX_UINT32),
            diagonalBias: dd,
            seriesDistribution: 'roundRobin'
        };

        const {cf, cfo, cfr} = cfgen.genBinaryCompFunc(opts);
        cfgen.checkBinaryCompFunc(cf, cfo, cfr);
    }
    console.log(`fuzz_validateBinaryCompFunc: Done.`);
}

function run(opts: CompFuncConstructFuzzOptions = {
    validateCompFunc: true,
    createCompFunc: true
}) {
    fuzz_createBinaryCompFunc(100, 100, 100);
}

run();
