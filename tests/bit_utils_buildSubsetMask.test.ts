// tests/buildSubsetMask.test.ts
import { describe, it, expect } from 'vitest';
import {buildSubsetMask} from "../src/bit_utils";

// handy ctor
const u32 = (...ns: number[]) => new Uint32Array(ns.map(n => n >>> 0));

describe('buildSubsetMask', () => {
    it('returns a zeroed mask of the requested length', () => {
        expect(buildSubsetMask(1 as any, [] as any)).toEqual(u32(0));
        expect(buildSubsetMask(3 as any, [] as any)).toEqual(u32(0, 0, 0));
    });

    it('sets bits within a single word', () => {
        const mask = buildSubsetMask(1 as any, [0, 1, 2, 5] as any);
        // bits 0,1,2,5 -> 0b0010_0111 = 0x27
        expect(mask).toEqual(u32(0x27));
    });

    it('handles bit 31 correctly (1<<31 → 0x80000000 in Uint32)', () => {
        const mask = buildSubsetMask(1 as any, [31] as any);
        expect(mask).toEqual(u32(0x80000000));
    });

    it('sets bits across multiple words', () => {
        // indices: 0, 31 (word 0), 32, 63 (word 1), 64+2=66 (word 2, bit 2)
        const units = [0, 31, 32, 63, 66] as any;
        const mask = buildSubsetMask(3 as any, units);
        expect(mask).toEqual(u32(
            0x80000001, // bits 0 and 31
            0x80000001, // bits 0 and 31
            0x00000004  // bit 2
        ));
    });

    it('is idempotent for duplicates and does not depend on order', () => {
        const a = buildSubsetMask(2 as any, [1, 1, 33, 32, 0] as any);
        const b = buildSubsetMask(2 as any, [32, 0, 1, 33, 1] as any);
        // word0: bits 0 and 1 -> 0b11 = 3
        // word1: bits 0 and 1 (33==1 in word1) -> 3
        expect(a).toEqual(u32(3, 3));
        expect(b).toEqual(a);
    });

    it('ignores out-of-range indices (>= eWordsPerRow * 32) without throwing', () => {
        const eWordsPerRow = 2; // 64 bits valid
        const units = [0, 63, 64, 1000] as any; // 64 & 1000 are OOB
        const mask = buildSubsetMask(eWordsPerRow as any, units);
        expect(mask).toEqual(u32(
            0x00000001, // bit 0
            0x80000000  // bit 63
        ));
    });

    it('works with eWordsPerRow = 0 (returns empty array, no throw)', () => {
        const mask = buildSubsetMask(0 as any, [0, 1, 31, 32] as any);
        expect(mask.length).toBe(0);
    });

    it('random spot-check vs. a simple reference (in-range only)', () => {
        const eWordsPerRow = 4; // 128 bits
        const mask = buildSubsetMask(eWordsPerRow as any, [
            0, 1, 2, 31, 32, 33, 63, 64, 95, 96, 127
        ] as any);

        const expected = new Uint32Array(eWordsPerRow);
        const set = (i: number) => {
            const w = i >>> 5;
            const b = i & 31;
            expected[w] = (expected[w] | (1 << b)) >>> 0;
        };
        [0,1,2,31,32,33,63,64,95,96,127].forEach(set);

        expect(mask).toEqual(expected);
    });
});
