import { describe, it, expect } from "vitest";

import {
    CFIval,
    createZeroDimFunc,
    createBinaryCompFunc,
    CFStorageTag,
    CFReal
} from "../src";
import {makeValidCFCompDataset} from "./utils/dataset_gen";

describe("createZeroDimUnitFunc", () => {

    it("creates a 0-D per-series function and reads by series index", () => {

        const base = makeValidCFCompDataset({
            maxUnitIndex: 1,
            maxSeriesIndex: 1,
            numComparisons: 2,
            loRange: [0.1,1],
            hiRange: [1,2]
        });

        const cf = createBinaryCompFunc(
            base.arr,
            base.numUnits,
            base.numSeriesIndices
        );

        // length should equal cf.numSeriesIndices (2 in this case)
        const values = [[1 as CFReal, 2 as CFReal], [2 as CFReal, 2 as CFReal]] as CFIval[];
        const z = createZeroDimFunc(cf.NU, cf.NS, values);

        expect(z.dim).toBe(0);
        expect(z.storage).toBe(CFStorageTag.Dense);
        expect(z.values.length).toBe(2);
    });
    
});
