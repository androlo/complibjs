// tests/rankInRow.test.ts
import { describe, it, expect } from 'vitest';
import {rankInRow} from "../src/bit_utils";
import {mulberry32_uint32} from "./utils/mulberry";
import {asReadonly, CFUint32, ReadonlyUint32Array, toUint32} from "../src";

const TEST_SEED = 0xBADC0DE as CFUint32;

const rand = mulberry32_uint32(TEST_SEED);

const zero = 0 as CFUint32;
const one = 1 as CFUint32;

/**
 * Slow reference: count set bits up to bit index `col` (exclusive),
 * scanning bit-by-bit across words starting at `rowWordBase`.
 */
function rankInRowSlow(eBits: ReadonlyUint32Array, rowWordBase: number, col: number): number {
    if (col === 0) return 0;
    let cnt = 0;
    for (let i = 0; i < col; i++) {
        const w = i >>> 5;
        const b = i & 31;
        const word = eBits[rowWordBase + w] >>> 0;
        cnt += (word >>> b) & 1;
    }
    return cnt;
}

/**
 * Helper to create a Uint32Array from an array of 32-bit unsigned numbers.
 */
function u32(...nums: number[]): ReadonlyUint32Array {
    return asReadonly(new Uint32Array(nums.map(n => n >>> 0)));
}

describe('rankInRow', () => {
    it('returns 0 when col === 0, regardless of bits', () => {
        const arr = u32(0xffffffff, 0x12345678);
        expect(rankInRow(arr, zero, zero)).toBe(0);
        expect(rankInRow(arr, one, zero)).toBe(0);
    });

    it('handles a single word with various partial tail lengths (b !== 0)', () => {
        // word: 0b...01011011 (0x5B) -> 6 bits set in lower 8
        const arr = u32(0x0000005b);
        // col = 1..8, compare to slow reference
        for (let col = 1; col <= 31; col++) {
            expect(rankInRow(arr, zero, col as CFUint32)).toBe(rankInRowSlow(arr, 0, col));
        }
    });

    it('handles exact word boundaries (b === 0) without requiring an extra word', () => {
        // Only one word present; calling with col=32 should NOT need to read arr[1].
        const arr = u32(0xf0f0f0f0); // popcount = 16
        expect(rankInRow(arr, zero, toUint32(32)!)).toBe(16);

        // Two words present; col = 64 sums both words fully
        const arr2 = u32(0xffffffff, 0x0f0f0f0f); // 32 + 8 = 40
        expect(rankInRow(arr2, zero, toUint32(64)!)).toBe(48);

        // Also test that col being multiple of 32 with extra zero words is fine
        const arr3 = u32(0xffffffff, 0xffffffff, 0x00000000);
        expect(rankInRow(arr3, zero, toUint32(64)!)).toBe(64);
    });

    it('sums multiple full words + partial tail correctly', () => {
        // Two words, then take a tail into the third
        const arr = u32(0xffffffff, 0x00000000, 0b1011); // 32 + 0 + tail
        // up to 64 -> 32
        expect(rankInRow(arr, zero, toUint32(64)!)).toBe(32);
        // 65 -> includes LSB of third word (=1) => 33
        expect(rankInRow(arr, zero, toUint32(65)!)).toBe(33);
        // 66 -> bits 0..1 of third word: 0b11 -> +2 => 34
        expect(rankInRow(arr, zero, toUint32(66)!)).toBe(34);
        // 68 -> bits 0..3 of third word: 0b1011 -> +3 => 35
        expect(rankInRow(arr, zero, toUint32(68)!)).toBe(35);
    });

    it('respects rowWordBase offsets', () => {
        const arr = u32(
            0x12345678,        // junk before
            0xffffffff,        // row base
            0x0f0f0f0f,        // next
            0xdeadbeef         // junk after
        );
        // From base: first 32 bits -> 32
        expect(rankInRow(arr, one, toUint32(32)!)).toBe(32);
        // 48 bits from base -> 32 + popcount(lower 16 bits of 0x0f0f0f0f = 4*4) = 48?
        // Careful: 0x0f0f0f0f has 16 bits set total; lower 16 bits have 8 set.
        expect(rankInRow(arr, one, toUint32(48)!)).toBe(32 + 8);
        // All 64 bits from base -> 32 + 16 = 48
        expect(rankInRow(arr, one, toUint32(64)!)).toBe(48);
    });

    it('matches a slow bit-by-bit reference across many random rows and columns (seeded)', () => {

        // Build a buffer with 8 "rows", each row 5 words (160 bits)
        const ROWS = 8;
        const WORDS_PER_ROW = 5;
        const arr = new Uint32Array(ROWS * WORDS_PER_ROW);

        for (let i = 0; i < arr.length; i++) {
            // deterministic random 32-bit value
            arr[i] = rand() >>> 0;
        }

        for (let row = 0; row < ROWS; row++) {
            const base = row * WORDS_PER_ROW as CFUint32;
            // test a variety of columns, including boundaries and random picks
            const interestingCols = new Set<CFUint32>([
                0, 1, 2, 3, 7, 8, 15, 16, 31, 32, 33, 47, 48, 63, 64, 95, 96, 127, 128, 159, 160
            ] as CFUint32[]);
            // add some random columns
            for (let k = 0; k < 20; k++) {
                interestingCols.add((rand() % (WORDS_PER_ROW * 32 + 1)) >>> 0 as CFUint32);
            }
            const rArr = asReadonly(arr);
            interestingCols.forEach((col) => {
                const expected = rankInRowSlow(rArr, base, col);
                const got = rankInRow(rArr, base, col);
                expect(got).toBe(expected);
            });
        }
    });

    it('works when the tail mask would include all bits of the word (b = 31)', () => {
        // If b=31, mask should have 31 low bits set.
        const arr = u32(0xffffffff);
        // col = 31 -> counts bits 0..30 => 31
    expect(rankInRow(arr, zero, toUint32(31)!)).toBe(31);
    });

    it('works with zeroed arrays and large cols', () => {
        const arr = asReadonly(new Uint32Array(10));

        expect(rankInRow(arr, zero, zero)).toBe(0);
        expect(rankInRow(arr, zero, one)).toBe(0);
        expect(rankInRow(arr, zero, toUint32(320)!)).toBe(0);
    });

    it('does not depend on values before rowWordBase', () => {
        const arr = u32(0xffffffff, 0x00000000); // first word full of 1s, but base will skip it
        expect(rankInRow(arr, one, toUint32(32)!)).toBe(0);
    });
});