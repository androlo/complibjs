import {describe, expect, it} from "vitest";
import {isZeroWords} from "../src/bit_utils";

function u32(...nums: number[]): Uint32Array {
    return new Uint32Array(nums.map(n => n >>> 0));
}

describe("isZeroWords", () => {
    it("should return true for an empty array", () => {
        const array = u32();
        expect(isZeroWords(array)).toBe(true);
    });

    it("should return true for an array with all elements as zero", () => {
        const array = u32(0, 0, 0, 0);
        expect(isZeroWords(array)).toBe(true);
    });

    it("should return false for an array with at least one non-zero element", () => {
        const array = u32(0, 0, 1, 0);
        expect(isZeroWords(array)).toBe(false);
    });

    it("should return false for an array with all non-zero elements", () => {
        const array = u32(1, 2, 3, 4);
        expect(isZeroWords(array)).toBe(false);
    });

    it("should handle a large array with all zeros", () => {
        const array = new Uint32Array(1000).fill(0);
        expect(isZeroWords(array)).toBe(true);
    });

    it("should handle a large array with one non-zero element", () => {
        const array = new Uint32Array(1000).fill(0);
        array[999] = 1;
        expect(isZeroWords(array)).toBe(false);
    });
});