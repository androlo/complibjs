import { describe, it, expect } from 'vitest';
import * as prand from 'pure-rand';
import {CFUint32, isUint32} from '../src';
import {popcnt32} from "../src/bit_utils";
import {RandomGenerator} from "pure-rand";

export const rng = (seed: number): RandomGenerator =>
    prand.xoroshiro128plus(seed >>> 0);

export const nextU32 = (rGen: RandomGenerator) =>
    prand.unsafeUniformIntDistribution(0, 0xFFFFFFFF, rGen) >>> 0;

// Naive reference popcount (straightforward loop)
function popcnt32_ref(n: number): number {
    let x = n >>> 0; // force unsigned
    let cnt = 0;
    for (let i = 0; i < 32; i++) {
        cnt += (x >>> i) & 1;
    }
    return cnt;
}

function popcnt32_test(n: number ): CFUint32 {
    if (!isUint32(n)) {
        throw new Error('Invalid uint32 to popcnt32_test (programmer error):' + n);
    }
    return popcnt32(n);
}

describe('popcnt32', () => {
    it('handles trivial values', () => {
        expect(popcnt32_test(0x00000000)).toBe(0);
        expect(popcnt32_test(0x00000001)).toBe(1);
        expect(popcnt32_test(0xFFFFFFFF >>> 0)).toBe(32);
        expect(popcnt32_test(0x80000000 >>> 0)).toBe(1);
    });

    it('matches reference on common bit patterns', () => {
        const cases = [
            0xAAAAAAAA, // 1010...
            0x55555555, // 0101...
            0xF0F0F0F0,
            0x0F0F0F0F,
            0x00FF00FF,
            0xFF00FF00,
            0x33333333,
            0xCCCCCCCC,
            0xDEADBEEF >>> 0,
            0xCAFEBABE >>> 0,
            0x01234567,
            0x89ABCDEF >>> 0,
        ];
        for (const x of cases) {
            expect(popcnt32_test(x >>> 0)).toBe(popcnt32_ref(x));
        }
    });

    it('is correct for all single-bit values', () => {
        for (let i = 0; i < 32; i++) {
            const x = (1 << i) >>> 0;
            expect(popcnt32_test(x)).toBe(1);
        }
    });

    it('is correct for a range of small Hamming weights (two/three bits)', () => {
        // Two bits
        for (let i = 0; i < 32; i++) {
            for (let j = i + 1; j < 32; j++) {
                const x = ((1 << i) | (1 << j)) >>> 0;
                expect(popcnt32_test(x)).toBe(2);
            }
        }
        // Three bits (sample a subset to keep test time reasonable)
        let checked = 0;
        for (let i = 0; i < 32; i++) {
            for (let j = i + 1; j < 32; j++) {
                for (let k = j + 1; k < 32; k++) {
                    const x = ((1 << i) | (1 << j) | (1 << k)) >>> 0;
                    expect(popcnt32_test(x)).toBe(3);
                    checked++;
                    if (checked > 500) break;
                }
                if (checked > 500) break;
            }
            if (checked > 500) break;
        }
    });

    it('satisfies popcnt(~x) = 32 - popcnt(x)', () => {
        const r = rng(0xB17B1B5);
        for (let t = 0; t < 2000; t++) {
            const x = nextU32(r) >>> 0;
            const a = popcnt32_test(x);
            const b = popcnt32_test(~x >>> 0);
            expect(a + b).toBe(32);
        }
    });

    it('returns integers in [0, 32] for random inputs', () => {
        const r = rng(0x12345678);
        for (let t = 0; t < 5000; t++) {
            const x = nextU32(r) >>> 0;
            const got = popcnt32_test(x);
            expect(Number.isInteger(got)).toBe(true);
            expect(got).toBeGreaterThanOrEqual(0);
            expect(got).toBeLessThanOrEqual(32);
        }
    });

    it('matches references on a random fuzz set', () => {
        const r = rng(0xFEEDBEEF);
        for (let t = 0; t < 1000; t++) {
            const x = nextU32(r) >>> 0;
            expect(popcnt32_test(x)).toBe(popcnt32_ref(x));
        }
    });

});

