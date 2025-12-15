
import {describe, expect, it} from "vitest";
import {isSubsetWords} from "../src/bit_utils";

function u32(...nums: number[]): Uint32Array {
    return new Uint32Array(nums.map(n => n >>> 0));
}

describe("isSubsetWords", () => {
    it("should return true when A is an empty subset of B", () => {
        const A = u32(0, 0, 0);
        const B = u32(0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF);
        expect(isSubsetWords(A, B)).toBe(true);
    });

    it("should return true when A is a proper subset of B", () => {
        const A = u32(0b0001, 0b0010);
        const B = u32(0b0011, 0b1010);
        expect(isSubsetWords(A, B)).toBe(true);
    });

    it("should return true when A is equal to B", () => {
        const A = u32(0xF0F0F0F0, 0x12345678);
        const B = u32(0xF0F0F0F0, 0x12345678);
        expect(isSubsetWords(A, B)).toBe(true);
    });

    it("should return false when A is not a subset of B", () => {
        const A = u32(0b0101, 0b1100);
        const B = u32(0b0011, 0b1000);
        expect(isSubsetWords(A, B)).toBe(false);
    });

    it("should return false when A has bits outside of B", () => {
        const A = u32(0b1111, 0b0001);
        const B = u32(0b0000, 0b0000);
        expect(isSubsetWords(A, B)).toBe(false);
    });

    it("should return true for two empty arrays", () => {
        const A = u32();
        const B = u32();
        expect(isSubsetWords(A, B)).toBe(true);
    });
});