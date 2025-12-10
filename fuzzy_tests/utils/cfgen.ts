import {
    ALGEBRA_IVAL,
    CFCompFuncBinary,
    CFIval,
    CFUint32,
    createBinaryCompFunc,
    validateBinaryCompData
} from "../../src";

import {CFGenOptions, CFGenResult, makeValidCFCompDataset} from "../../tests/utils/dataset_gen";

export class CFGen {

    checkBinaryCompFunc(cf: CFCompFuncBinary, cfo: CFGenOptions, cfr: CFGenResult) {
        const arr = cfr.arr;

        for(let comp of arr) {
            const cfVal = cf.getUnsafe(comp[0] as CFUint32, comp[1] as CFUint32, comp[2] as CFUint32);
            if(!ALGEBRA_IVAL.eq(cfVal, comp[3] as CFIval)) {
                throw new Error(`checkCompFunc: Comparison function failed to produce correct value.
                Context:
                comparison data key: ${comp[0]}, ${comp[1]}, ${comp[2]}
                value: ${ALGEBRA_IVAL.print(comp[3] as CFIval)}
                comparison function value: ${ALGEBRA_IVAL.print(cfVal)}
                gen options:
                
                ${JSON.stringify(cfo)}`);
            }
        }
    }

    genBinaryCompFunc(cfo: CFGenOptions) {
        const cfr = makeValidCFCompDataset(cfo);
        try {
            const cf = createBinaryCompFunc(cfr.arr, cfr.numUnits, cfr.numSeriesIndices);
            return {cf, cfo, cfr};
        } catch (e: any) {
            throw new Error(`validateBinaryCompData: Validation failed.
                Context:
                message: ${e.message}
                gen options:
                
                ${JSON.stringify(cfo)}`);
        }
    }

    validateBinaryCompData(cfo: CFGenOptions) {

        const cfr = makeValidCFCompDataset(cfo);
        try {
            validateBinaryCompData(cfr.arr, cfr.numUnits, cfr.numSeriesIndices);
        } catch (e: any) {
            throw new Error(`validateBinaryCompData: Validation failed.
                Context:
                message: ${e.message}
                gen options:
                
                ${JSON.stringify(cfo)}`);
        }
    }

}

