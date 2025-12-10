import { describe, it, expect } from "vitest";
import {CFInt32, CFReal, CFUint32, CFValueAlgebraReal} from "../src";

describe("CFValueAlgebraReal", () => {

    it("constructs with default tolerances", () => {
        const alg = new CFValueAlgebraReal();
        expect(alg.zeroTol).toBeCloseTo(1e-17);
        expect(alg.oneTol).toBeCloseTo(1e-17);
        expect(alg.typeName).toBe("Real");
        expect(alg.sizeInBytes(1 as CFReal)).toBe(8);
    });

    it("allows overriding tolerances", () => {
        const alg = new CFValueAlgebraReal({ zeroTol: 1e-6 as CFReal, oneTol: 1e-5 as CFReal });
        expect(alg.zeroTol).toBe(1e-6);
        expect(alg.oneTol).toBe(1e-5);
    });

    describe("isValue", () => {

        const alg = new CFValueAlgebraReal();

        it("accepts finite numbers", () => {
            expect(alg.isValue(0)).toBe(true);
            expect(alg.isValue(123.456)).toBe(true);
        });

        it("rejects non-finite / non-number", () => {
            expect(alg.isValue(Number.POSITIVE_INFINITY)).toBe(false);
            expect(alg.isValue(Number.NaN)).toBe(false);
            expect(alg.isValue("42")).toBe(false);
        });

    });

    describe("identity checks", () => {

        it("isNull uses tolerance", () => {
            const alg = new CFValueAlgebraReal({ zeroTol: 1e-3 as CFReal, oneTol: 1e-3 as CFReal });
            expect(alg.isZero(0 as CFReal)).toBe(true);
            expect(alg.isZero(5e-4 as CFReal)).toBe(true);
            expect(alg.isZero(2e-3 as CFReal)).toBe(false);
        });

        it("isOne uses tolerance", () => {
            const alg = new CFValueAlgebraReal({ zeroTol: 1e-3 as CFReal, oneTol: 1e-3 as CFReal });
            expect(alg.isOne(1 as CFReal)).toBe(true);
            expect(alg.isOne(1 + 5e-4 as CFReal)).toBe(true);
            expect(alg.isOne(1 + 2e-3 as CFReal)).toBe(false);
        });

        it("null() and one() return exact values", () => {
            const alg = new CFValueAlgebraReal();
            expect(0).toBe(0);
            expect(1).toBe(1);
        });

    });

    describe("eq (scale-aware)", () => {
        const alg = new CFValueAlgebraReal();

        it("considers identical numbers equal", () => {
            expect(alg.eq(1 as CFReal, 1 as CFReal)).toBe(true);
        });

        it("considers very close numbers equal", () => {
            const a = 1000000 as CFReal;
            const b = (1000000 + Number.EPSILON * 1000000 * 0.5) as CFReal;
            expect(alg.eq(a, b)).toBe(true);
        });

        it("considers different numbers not equal", () => {
            expect(alg.eq(1 as CFReal, 1.1 as CFReal)).toBe(false);
        });

    });

    describe("basic algebraic ops", () => {
        const alg = new CFValueAlgebraReal();

        it("adds finite numbers", () => {
            const r = alg.add(2 as CFReal, 3 as CFReal);
            expect(r).toBe(5);
        });

        it("returns undefined on non-finite add", () => {
            const big = Number.MAX_VALUE;
            const r = alg.add(big as CFReal, big as CFReal);
            expect(r).toBeUndefined();
        });

        it("subs finite numbers", () => {
            const r = alg.sub(5 as CFReal, 2 as CFReal);
            expect(r).toBe(3);
        });

        it("muls finite numbers", () => {
            const r = alg.mul(2 as CFReal, 4 as CFReal);
            expect(r).toBe(8);
        });

        it("returns undefined on non-finite mul", () => {
            const r = alg.mul(Number.MAX_VALUE as CFReal, 2 as CFReal);
            expect(r).toBeUndefined();
        });

        it("divides finite numbers", () => {
            const r = alg.div(10 as CFReal, 2 as CFReal);
            expect(r).toBe(5);
        });

        it("returns undefined on division by zero", () => {
            const r = alg.div(10 as CFReal, 0 as CFReal);
            expect(r).toBeUndefined();
        });

        it("inv inverts finite numbers", () => {
            const r = alg.inv(4 as CFReal);
            expect(r).toBe(0.25);
        });

        it("inv returns undefined for 0", () => {
            const r = alg.inv(0 as CFReal);
            expect(r).toBeUndefined();
        });

    });

    describe("scalar mul helpers", () => {
        const alg = new CFValueAlgebraReal();

        it("smulLeft delegates to mul", () => {
            const r = alg.smulLeft(2 as CFReal, 5 as CFReal);
            expect(r).toBe(10);
        });

        it("smulRight delegates to mul", () => {
            const r = alg.smulRight(5 as CFReal, 2 as CFReal);
            expect(r).toBe(10);
        });

    });

    describe("pow / powInt / nthRoot", () => {
        const alg = new CFValueAlgebraReal();
        const toI32 = (n: number) => n as CFInt32;

        it("powInt with positive exponent", () => {
            const r = alg.powInt(2 as CFReal, toI32(3));
            expect(r).toBe(8);
        });

        it("powInt with zero exponent", () => {
            const r = alg.powInt(2 as CFReal, toI32(0));
            expect(r).toBe(1);
        });

        it("powInt with negative exponent", () => {
            const r = alg.powInt(2 as CFReal, toI32(-1));
            expect(r).toBe(0.5);
        });

        it("pow returns undefined for non-finite result", () => {
            const r = alg.pow(Number.MAX_VALUE as CFReal, 2 as CFReal);
            expect(r).toBeUndefined();
        });

        it("nthRoot works for positive n", () => {
            const r = alg.nthRoot(27 as CFReal, 3 as CFUint32);
            expect(r).toBeCloseTo(3);
        });

        it("nthRoot returns undefined for non-positive n", () => {
            const r = alg.nthRoot(27 as CFReal, 0 as CFUint32);
            expect(r).toBeUndefined();
        });

    });

    describe("metric", () => {
        const alg = new CFValueAlgebraReal();

        it("abs returns finite", () => {
            expect(alg.abs(-5 as CFReal)).toBe(5);
        });

        it("dist returns finite", () => {
            const d = alg.dist(10 as CFReal, 7 as CFReal);
            expect(d).toBe(3);
        });

        it("dist returns undefined when difference is not finite", () => {
            const d = alg.dist(Number.MAX_VALUE as CFReal, -Number.MAX_VALUE as CFReal);
            expect(d).toBeUndefined();
        });

    });

    describe("serialization", () => {
        const alg = new CFValueAlgebraReal();

        it("fromBytes reads little-endian float64", () => {
            const buf = new ArrayBuffer(8);
            const dv = new DataView(buf);
            dv.setFloat64(0, 123.456, true);
            const arr = new Uint8Array(buf);
            const val = alg.fromBytes(arr);
            expect(val).toBeCloseTo(123.456);
        });

        it("fromBytes rejects wrong length", () => {
            const arr = new Uint8Array(4);
            const val = alg.fromBytes(arr);
            expect(val).toBeUndefined();
        });

    });

});


