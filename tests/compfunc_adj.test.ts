// tests/compfunc.adj.spec.ts
import { describe, it, expect } from 'vitest';
import { createBinaryCompFunc } from '../src';
import type {
    CFIval,
    CFUint32,
    CFSeriesIndex,
    CFUnit,
    CFBit,
} from '../src';

describe('CFCompFuncBinaryImpl: adj(s) → CFBit[][]', () => {
    // Small deterministic fixture: U=3, S=2
    // s=0 has: (0,0), (0,2), (1,0)
    // s=1 has: (2,1)
    const U = 3 as CFUint32;
    const S = 2 as CFUint32;

    const data: Array<[number, number, number, CFIval]> = [
        [0, 0, 0, [1, 1] as unknown as CFIval],
        [0, 2, 0, [1, 1] as unknown as CFIval],
        [1, 0, 0, [1, 1] as unknown as CFIval],
        [2, 1, 1, [1, 1] as unknown as CFIval],
    ];

    const cf = createBinaryCompFunc(data, U, S);

    it('returns the U×U 0/1 adjacency matrix for s=0', () => {
        const m0 = cf.adj(0 as CFSeriesIndex)!;
        // shape
        expect(Array.isArray(m0)).toBe(true);
        expect(m0.length).toBe(U as unknown as number);
        m0.forEach(row => expect(row.length).toBe(U as unknown as number));

        // values: s=0 → rows by u, cols by v
        // u=0: v={0,2} present
        // u=1: v={0} present
        // u=2: none
        const expected0: CFBit[][] = [
            [1, 0, 1],
            [1, 0, 0],
            [0, 0, 0],
        ] as unknown as CFBit[][];
        expect(m0).toEqual(expected0);
    });

    it('returns the U×U 0/1 adjacency matrix for s=1', () => {
        const m1 = cf.adj(1 as CFSeriesIndex)!;
        const expected1: CFBit[][] = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 1, 0], // only (2,1) present
        ] as unknown as CFBit[][];
        expect(m1).toEqual(expected1);
    });

    it('returns undefined for out-of-range series index', () => {
        expect(cf.adj(-1 as unknown as CFSeriesIndex)).toBeUndefined();
        expect(cf.adj(S as unknown as CFSeriesIndex)).toBeUndefined();
    });

    it('matrix entries are CFBit (0 or 1) only', () => {
        const m0 = cf.adj(0 as CFSeriesIndex)!;
        for (const row of m0) {
            for (const x of row) {
                expect(x === (0 as CFBit) || x === (1 as CFBit)).toBe(true);
            }
        }
    });
});
