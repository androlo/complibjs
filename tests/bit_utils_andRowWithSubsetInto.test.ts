import {describe, it, expect} from 'vitest';
import {CFCompData, CFUint32, createBinaryCompFunc, CFReal} from '../src';
import {andRowWithSubsetInto} from "../src/bit_utils";

function u32(...nums: number[]): Uint32Array {
    return new Uint32Array(nums.map(n => n >>> 0));
}

describe('andRowWithSubsetInto', () => {

    describe('basic functionality', () => {
        it('should AND a row with a subset mask containing all units', () => {
            // Create a simple 4-unit, 1-series CompFunc
            // Set bits for unit 0: [0,1,2]
            const data: CFCompData[] = [
                [0, 0, 0, [1 as CFReal, 1 as CFReal]],
                [0, 1, 0, [2 as CFReal, 2 as CFReal]],
                [0, 2, 0, [3 as CFReal, 3 as CFReal]],
            ];
            const cf = createBinaryCompFunc(data, 3 as CFUint32, 1 as CFUint32);

            // Mask for units [0,1,2,3] (all bits set)
            const mask = u32(0b1111); // bits 0-3 set
            const out = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out);

            // Row for (u=0, s=0) has bits [0,1,2] set
            // AND with mask 0b1111 should preserve all: 0b0111
            expect(out[0]).toBe(0b0111);
        });

        it('should AND a row with a subset mask containing only some units', () => {
            // Unit 0 relates to [0,1,2,3]
            const data: CFCompData[] = [
                [0, 0, 0, [1 as CFReal, 1 as CFReal]],
                [0, 1, 0, [2 as CFReal, 2 as CFReal]],
                [0, 2, 0, [3 as CFReal, 3 as CFReal]],
                [0, 3, 0, [4 as CFReal, 4 as CFReal]],
            ];
            const cf = createBinaryCompFunc(data, 4 as CFUint32, 1 as CFUint32);

            // Mask for units [1,3] only
            const mask = u32(0b01010); // bits 1 and 3 set
            const out = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out);

            // Row has bits [0,1,2,3] set (0b01111)
            // AND with mask 0b01010 should give 0b01010 (bits 1,3)
            expect(out[0]).toBe(0b01010);
        });

        it('should produce zero result when row and mask do not overlap', () => {
            // Unit 0 relates to [0,1,2]
            const data: CFCompData[] = [
                [0, 0, 0, [1 as CFReal, 1 as CFReal]],
                [0, 1, 0, [2 as CFReal, 2 as CFReal]],
                [0, 2, 0, [3 as CFReal, 3 as CFReal]],
            ];
            const cf = createBinaryCompFunc(data, 3 as CFUint32, 1 as CFUint32);

            // Mask for units [3,4,5] only - no overlap
            const mask = u32(0b111000); // bits 3,4,5 set
            const out = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out);

            // Row has bits [0,1,2], mask has bits [3,4,5]
            // No overlap, should be all zeros
            expect(out[0]).toBe(0);
        });

        it('should handle empty row (no bits set)', () => {
            // Unit 1 has no comparisons
            const data: CFCompData[] = [
                [0, 0, 0, [1 as CFReal, 1 as CFReal]],
                [0, 1, 0, [2 as CFReal, 2 as CFReal]],
            ];
            const cf = createBinaryCompFunc(data, 2 as CFUint32, 1 as CFUint32);

            const mask = u32(0b111); // all units
            const out = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 1 as CFUint32, 0 as CFUint32, mask, out);

            // Row for unit 1 is empty
            expect(out[0]).toBe(0);
        });

        it('should handle empty mask (no bits set)', () => {
            const data: CFCompData[] = [
                [0, 0, 0, [1 as CFReal, 1 as CFReal]],
                [0, 1, 0, [2 as CFReal, 2 as CFReal]],
                [0, 2, 0, [3 as CFReal, 3 as CFReal]],
            ];
            const cf = createBinaryCompFunc(data, 3 as CFUint32, 1 as CFUint32);

            const mask = u32(0); // no bits set
            const out = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out);

            // Empty mask ANDed with anything gives 0
            expect(out[0]).toBe(0);
        });
    });

    describe('multiple series', () => {
        it('should correctly AND rows from different series indices', () => {
            // Different patterns in different series
            const data: CFCompData[] = [
                // Series 0: unit 0 -> [0,1]
                [0, 0, 0, [1 as CFReal, 1 as CFReal]],
                [0, 1, 0, [2 as CFReal, 2 as CFReal]],
                // Series 1: unit 0 -> [2,3]
                [0, 2, 1, [3 as CFReal, 3 as CFReal]],
                [0, 3, 1, [4 as CFReal, 4 as CFReal]],
            ];
            const cf = createBinaryCompFunc(data, 4 as CFUint32, 2 as CFUint32);

            const mask = u32(0b1111); // all units
            const out0 = new Uint32Array(cf.bitset.eWordsPerRow);
            const out1 = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out0);
            andRowWithSubsetInto(cf, 0 as CFUint32, 1 as CFUint32, mask, out1);

            // Series 0: bits [0,1] -> 0b0011
            expect(out0[0]).toBe(0b0011);
            // Series 1: bits [2,3] -> 0b1100
            expect(out1[0]).toBe(0b1100);
        });

        it('should AND with subset mask across different series', () => {
            const data: CFCompData[] = [
                [0, 0, 0, [1 as CFReal, 1 as CFReal]], [0, 1, 0, [2 as CFReal, 2 as CFReal]],
                [0, 2, 0, [3 as CFReal, 3 as CFReal]], [0, 0, 1, [1 as CFReal, 1 as CFReal]],
                [0, 1, 1, [2 as CFReal, 2 as CFReal]], [0, 3, 1, [4 as CFReal, 4 as CFReal]],
            ];
            const cf = createBinaryCompFunc(data, 4 as CFUint32, 2 as CFUint32);

            // Mask for units [1,2] only
            const mask = u32(0b00110);
            const out0 = new Uint32Array(cf.bitset.eWordsPerRow);
            const out1 = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out0);
            andRowWithSubsetInto(cf, 0 as CFUint32, 1 as CFUint32, mask, out1);

            // Series 0: bits [0,1,2] & mask [1,2] -> 0b00110
            expect(out0[0]).toBe(0b00110);
            // Series 1: bits [0,1,3] & mask [1,2] -> 0b00010
            expect(out1[0]).toBe(0b00010);
        });
    });

    describe('multi-word rows (> 32 units)', () => {
        it('should handle units spanning multiple words', () => {
            // Create a function with 40 units (needs 2 words)

            let data: CFCompData[] = [];
            for (let i = 0; i < 40; i++) {
                data.push([0, i, 0, [1 as CFReal, 1 as CFReal]]);
            }
            const cf = createBinaryCompFunc(data, 40 as CFUint32, 1 as CFUint32);

            // Mask with bits in both words
            const mask = u32(0xFFFF0000, 0x0000000F); // upper half of word 0, lower 4 bits of word 1
            const out = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out);

            expect(out[0]).toBe(0xFFFF0000);
            expect(out[1]).toBe(0x0000000F);
        });


        it('should handle 96 units (3 words)', () => {
            let data: CFCompData[] = [];
            for (let i = 0; i < 96; i++) {
                data.push([0, i, 0, [1 as CFReal, 1 as CFReal]]);
            }
            const cf = createBinaryCompFunc(data, 96 as CFUint32, 1 as CFUint32);

            // Mask selecting middle word only
            const mask = u32(0, 0xFFFFFFFF, 0);
            const out = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out);

            expect(out[0]).toBe(0);
            expect(out[1]).toBe(0xFFFFFFFF);
            expect(out[2]).toBe(0);
        });
    });

    describe('different units in same series', () => {
        it('should correctly isolate different unit rows', () => {
            // Multiple units with different patterns
            const data: CFCompData[] = [
                [0, 0, 0, [1 as CFReal, 1 as CFReal]], [0, 1, 0, [2 as CFReal, 2 as CFReal]],
                [0, 2, 0, [3 as CFReal, 3 as CFReal]], [1, 1, 0, [4 as CFReal, 4 as CFReal]],
                [1, 2, 0, [5 as CFReal, 5 as CFReal]], [1, 3, 0, [6 as CFReal, 6 as CFReal]],
                [2, 0, 0, [7 as CFReal, 7 as CFReal]], [2, 3, 0, [8 as CFReal, 8 as CFReal]],
            ];
            const cf = createBinaryCompFunc(data, 4 as CFUint32, 1 as CFUint32);

            const mask = u32(0b1111);
            const out0 = new Uint32Array(cf.bitset.eWordsPerRow);
            const out1 = new Uint32Array(cf.bitset.eWordsPerRow);
            const out2 = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out0);
            andRowWithSubsetInto(cf, 1 as CFUint32, 0 as CFUint32, mask, out1);
            andRowWithSubsetInto(cf, 2 as CFUint32, 0 as CFUint32, mask, out2);

            expect(out0[0]).toBe(0b0111);  // bits [0,1,2]
            expect(out1[0]).toBe(0b1110);  // bits [1,2,3]
            expect(out2[0]).toBe(0b1001);  // bits [0,3]
        });

        it('should apply different masks to different units', () => {
            const data: CFCompData[] = [
                [0, 0, 0, [1 as CFReal, 1 as CFReal]], [0, 1, 0, [2 as CFReal, 2 as CFReal]],
                [0, 2, 0, [3 as CFReal, 3 as CFReal]], [0, 3, 0, [4 as CFReal, 4 as CFReal]],
                [1, 0, 0, [5 as CFReal, 5 as CFReal]], [1, 1, 0, [6 as CFReal, 6 as CFReal]],
                [1, 2, 0, [7 as CFReal, 7 as CFReal]], [1, 3, 0, [8 as CFReal, 8 as CFReal]],
            ];
            const cf = createBinaryCompFunc(data, 4 as CFUint32, 1 as CFUint32);

            // Different masks
            const mask1 = u32(0b0011);  // units [0,1]
            const mask2 = u32(0b1100);  // units [2,3]

            const out0_mask1 = new Uint32Array(cf.bitset.eWordsPerRow);
            const out1_mask2 = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask1, out0_mask1);
            andRowWithSubsetInto(cf, 1 as CFUint32, 0 as CFUint32, mask2, out1_mask2);

            // Unit 0 has [0,1,2,3], masked with [0,1] -> 0b0011
            expect(out0_mask1[0]).toBe(0b0011);
            // Unit 1 has [0,1,2,3], masked with [2,3] -> 0b1100
            expect(out1_mask2[0]).toBe(0b1100);
        });
    });

    describe('edge cases', () => {
        it('should handle single unit', () => {
            const data: CFCompData[] = [
                [0, 0, 0, [1 as CFReal, 1 as CFReal]],
            ];
            const cf = createBinaryCompFunc(data, 1 as CFUint32, 1 as CFUint32);

            const mask = u32(1);
            const out = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out);

            expect(out[0]).toBe(1);
        });

        it('should handle maximum units in a word (32)', () => {
            // Create all reflexive comparisons for 32 units
            const data: CFCompData[] = [];
            for (let i = 0; i < 32; i++) {
                data.push([0, i, 0, [1 as CFReal, 1 as CFReal]]);
            }
            const cf = createBinaryCompFunc(data, 32 as CFUint32, 1 as CFUint32);

            const mask = u32(0xFFFFFFFF);
            const out = new Uint32Array(cf.bitset.eWordsPerRow);

            andRowWithSubsetInto(cf, 0 as CFUint32, 0 as CFUint32, mask, out);

            // All 32 bits should be set
            expect(out[0]).toBe(0xFFFFFFFF);
        });

    });
});