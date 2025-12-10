import { describe, it, expect } from "vitest";

import {
    ALGEBRA_IVAL,
    CFCompFuncBinary,
    CFSeriesIndex,
    CFUint32Two,
    CFUnit,
    createBinaryCompFunc,
    createConstUnitFunc,
    createNullUnitFunc,
    CFStorageTag,
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";

function getCompFunc(): CFCompFuncBinary {
    const base = makeValidCFCompDataset({
        maxUnitIndex: 1,
        maxSeriesIndex: 1,
        numComparisons: 2,
        loRange: [0.1,1],
        hiRange: [1,2]
    });
    return createBinaryCompFunc(base.arr, base.numUnits, base.numSeriesIndices);
}

describe("createConstUnitFunc", () => {

    it("creates a constant (non-null) unit function with the requested dim.", () => {

        const cf = getCompFunc();
        const cVal = ALGEBRA_IVAL.one();
        const f = createConstUnitFunc(2 as CFUint32Two, cf.NU, cf.NS, cVal);

        expect(f.dim).toBe(2);
        expect(f.storage).toBe(CFStorageTag.Const);
        expect(f.isZero).to.be.false;
        expect(ALGEBRA_IVAL.eq(f.value, cVal)).to.be.true;
        expect(ALGEBRA_IVAL.eq(f.get(0 as CFUnit, 0 as CFUnit, 0 as CFSeriesIndex)!, cVal)).to.be.true;
    });

    it("creates a constant (null) unit function with the requested dim.", () => {

        const cf = getCompFunc();
        const cVal = ALGEBRA_IVAL.null();
        const f = createConstUnitFunc(2 as CFUint32Two, cf.NU, cf.NS, cVal);

        expect(f.dim).toBe(2);
        expect(f.storage).toBe(CFStorageTag.Const);
        expect(f.isZero).to.be.true;
        expect(f.isOne).to.be.false;
        expect(ALGEBRA_IVAL.eq(f.value, cVal)).to.be.true;
    });

    it("creates a null unit function with the requested dim.", () => {

        const cf = getCompFunc();
        const f = createNullUnitFunc(2 as CFUint32Two,  cf.NU, cf.NS);

        expect(f.dim).toBe(2);
        expect(f.storage).toBe(CFStorageTag.Const);
        expect(f.isZero).to.be.true;
        expect(f.isOne).to.be.false;
        expect(ALGEBRA_IVAL.isNull(f.value)).to.be.true;
    });

});
