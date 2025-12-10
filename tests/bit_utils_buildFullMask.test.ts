// tests/buildFullMask.test.ts
import { describe, it, expect } from 'vitest';
import {buildFullMask} from "../src/bit_utils";

const u32 = (...ns: number[]) => new Uint32Array(ns.map(n => n >>> 0));

describe('buildFullMask', () => {
    it('returns all zeros when numUnits = 0', () => {
        expect(buildFullMask(0 as any, 0 as any)).toEqual(new Uint32Array(0));
        expect(buildFullMask(1 as any, 0 as any)).toEqual(u32(0));
        expect(buildFullMask(3 as any, 0 as any)).toEqual(u32(0, 0, 0));
    });

    it('fills exactly one full word (numUnits = 32)', () => {
        expect(buildFullMask(1 as any, 32 as any)).toEqual(u32(0xffffffff));
        // extra capacity should remain zeroed
        expect(buildFullMask(3 as any, 32 as any)).toEqual(u32(0xffffffff, 0, 0));
    });

    it('handles small tails (numUnits = 1..31)', () => {
        for (let n = 1; n < 32; n++) {
            const expected = (1 << n) - 1; // note: 1<<31 produces a signed int; Uint32Array stores it as uint
            expect(buildFullMask(1 as any, n as any)).toEqual(u32(expected));
        }
    });

    it('tail at 31 bits gives 0x7fffffff', () => {
        // (1<<31) - 1 becomes -2147483649 as a signed 32-bit int, which Uint32 coerces to 0x7fffffff
        expect(buildFullMask(1 as any, 31 as any)).toEqual(u32(0x7fffffff));
    });

    it('multiple full words + tail', () => {
        // 2 full words (64) + tail(5) => [FFFFFFFF, FFFFFFFF, 0000001F, 00000000]
        expect(buildFullMask(4 as any, 69 as any)).toEqual(
            u32(0xffffffff, 0xffffffff, 0x1f, 0x00000000)
        );
    });

    it('exact multi-word boundary (numUnits = k*32)', () => {
        expect(buildFullMask(3 as any, 64 as any)).toEqual(
            u32(0xffffffff, 0xffffffff, 0x00000000)
        );
        expect(buildFullMask(3 as any, 96 as any)).toEqual(
            u32(0xffffffff, 0xffffffff, 0xffffffff)
        );
    });

    it('oversized numUnits saturates available words (no throw)', () => {
        // capacity = 2 words = 64 bits; ask for way more
        expect(buildFullMask(2 as any, 1000 as any)).toEqual(
            u32(0xffffffff, 0xffffffff)
        );
        // tail beyond capacity is silently dropped (typed arrays ignore OOB writes)
        expect(buildFullMask(2 as any, 65 as any)).toEqual(
            u32(0xffffffff, 0xffffffff)
        );
    });

    it('eWordsPerRow = 0 returns empty array and ignores writes', () => {
        const m = buildFullMask(0 as any, 123 as any);
        expect(m.length).toBe(0);
    });
});
