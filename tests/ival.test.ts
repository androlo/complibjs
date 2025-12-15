import { describe, it, expect, beforeEach } from 'vitest';

import {ALGEBRA_IVAL, CFInt32, CFIval, CFReal, CFUint32, CFValueAlgebraIval, CFValueAlgebraReal} from "../src"; // adjust paths/types as needed

describe("CFValueAlgebraIval", () => {
    let realAlg: CFValueAlgebraReal;
    let ivalAlg: CFValueAlgebraIval;

    // Helper to construct an interval with type assertion.
    const ival = (a: number, b: number): CFIval =>
        [a as CFReal, b as CFReal] as CFIval;

    beforeEach(() => {
        realAlg = new CFValueAlgebraReal();
        ivalAlg = new CFValueAlgebraIval();
    });

    // -------------------------------------------------------------------------
    // Basic invariants & predicates
    // -------------------------------------------------------------------------

    it("has correct typeName flag", () => {
        expect(ivalAlg.typeName).toBe("Ival");
    });

    it("recognizes valid and invalid interval values", () => {
        const x = ival(1, 2);
        const bad1 = [2, 1] as unknown as CFIval; // lo > hi
        const bad2 = [Number.NEGATIVE_INFINITY, 0] as unknown as CFIval;

        expect(ivalAlg.isValue(x)).toBe(true);
        expect(ivalAlg.isValue(bad1)).toBe(false);
        expect(ivalAlg.isValue(bad2)).toBe(false);
    });

    it("recognizes null and one intervals", () => {
        const zero = ival(0, 0);
        const one = ival(1, 1);
        const other = ival(1, 2);

        expect(ivalAlg.isNull(zero)).toBe(true);
        expect(ivalAlg.isOne(one)).toBe(true);

        expect(ivalAlg.isNull(other)).toBe(false);
        expect(ivalAlg.isOne(other)).toBe(false);
    });

    it("computes width and distance correctly", () => {
        const x = ival(1, 4);
        const y = ival(2, 5);

        expect(ivalAlg.width(x)).toBe(3);

        const d = ivalAlg.dist(x, y);
        // endpoints differ by 1 and 1 ⇒ sup distance = 1
        expect(d).toBe(1);
    });

    // -------------------------------------------------------------------------
    // Equality / containment
    // -------------------------------------------------------------------------

    it("checks interval equality and containment", () => {
        const x = ival(1, 3);
        const y = ival(1, 3);
        const z = ival(2, 2);

        expect(ivalAlg.eq(x, y)).toBe(true);
        expect(ivalAlg.eq(x, z)).toBe(false);

        // x = [1,3] contains z = [2,2]
        expect(ivalAlg.contains(x, z)).toBe(true);
        // but z does not contain x
        expect(ivalAlg.contains(z, x)).toBe(false);
    });

    // -------------------------------------------------------------------------
    // Basic algebraic ops: add, sub, mul
    // -------------------------------------------------------------------------

    it("adds and subtracts intervals using classic IA rules", () => {
        const x = ival(1, 2);
        const y = ival(3, 5);

        // [1,2] + [3,5] = [4,7]
        const sum = ivalAlg.add(x, y)!;
        expect(sum).toEqual(ival(4, 7));

        // [1,2] - [3,5] = [1-5, 2-3] = [-4, -1]
        const diff = ivalAlg.sub(x, y)!;
        expect(diff).toEqual(ival(-4, -1));
    });

    it("multiplies intervals and covers all sign combinations", () => {
        const x = ival(-1, 2);
        const y = ival(3, 4);

        // Products: -1*3=-3, -1*4=-4, 2*3=6, 2*4=8 ⇒ [min=-4, max=8]
        const prod = ivalAlg.mul(x, y)!;
        expect(prod).toEqual(ival(-4, 8));
    });

    // -------------------------------------------------------------------------
    // Division / inversion (with strict zero-domain rules)
    // -------------------------------------------------------------------------

    it("divides intervals when denominator does not contain zero", () => {
        const x = ival(2, 4);
        const y = ival(1, 2); // no zero inside

        const q = ivalAlg.div(x, y);
        expect(q).toBeDefined();

        expect(q).toEqual(ival(1, 4));
    });

    it("returns null element when dividing by an interval containing zero", () => {
        const x = ival(1, 2);
        const y = ival(-1, 1); // contains 0

        const q = ivalAlg.div(x, y);
        expect(ALGEBRA_IVAL.isNull(q)).toBe(true);
    });

    it("inverts intervals away from zero and returns null element if interval contains zero", () => {
        const x = ival(1, 2);
        const invX = ivalAlg.inv(x);
        // 1/[1,2] = [1/2, 1]
        expect(invX).toEqual(ival(0.5, 1));

        const crossing = ival(-1, 1);
        expect(ALGEBRA_IVAL.isNull(ivalAlg.inv(crossing))).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Scalar multiplication
    // -------------------------------------------------------------------------

    it("handles scalar multiplication with positive, negative and zero scalars", () => {
        const x = ival(1, 3);

        const s1 = ivalAlg.smulLeft(2 as CFReal, x)!;    // 2*[1,3] = [2,6]
        expect(s1).toEqual(ival(2, 6));

        const s2 = ivalAlg.smulLeft(-2 as CFReal, x)!;   // -2*[1,3] = [-6,-2]
        expect(s2).toEqual(ival(-6, -2));

        const s0 = ivalAlg.smulLeft(0 as CFReal, x)!;    // 0*[1,3] = [0,0] (null)
        expect(ivalAlg.isNull(s0)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Absolute value
    // -------------------------------------------------------------------------

    it("computes interval absolute value correctly", () => {
        const neg = ival(-4, -2);
        const pos = ival(1, 3);
        const cross = ival(-2, 5);

        // entirely nonpositive: [-4,-2] → [2,4]
        expect(ivalAlg.abs(neg)).toEqual(ival(2, 4));

        // entirely nonnegative: [1,3] → [1,3]
        expect(ivalAlg.abs(pos)).toEqual(ival(1, 3));

        // straddles zero: [-2,5] → [0, max(2,5)] = [0,5]
        expect(ivalAlg.abs(cross)).toEqual(ival(0, 5));
    });

    // -------------------------------------------------------------------------
    // Integer powers (powInt)
    // -------------------------------------------------------------------------

    it("applies odd integer powers monotonically over all reals", () => {
        const x = ival(-2, 3);
        const n = 3 as CFInt32;

        const res = ivalAlg.powInt(x, n)!;
        // scalar cube: [-2,3]^3 = [-8,27]
        expect(res).toEqual(ival(-8, 27));
    });

    it("applies even integer powers with correct shape for negative / positive / crossing intervals", () => {
        const neg = ival(-3, -1); // entirely negative
        const pos = ival(1, 3);   // entirely positive
        const cross = ival(-2, 3); // crosses zero
        const n = 2 as CFInt32;

        const rNeg = ivalAlg.powInt(neg, n)!;   // [-3,-1]^2 = [1,9] (note: endpoints flipped, then sorted)
        const rPos = ivalAlg.powInt(pos, n)!;   // [1,3]^2 = [1,9]
        const rCross = ivalAlg.powInt(cross, n)!; // [-2,3]^2 = [0,max(4,9)] = [0,9]

        expect(rNeg).toEqual(ival(1, 9));
        expect(rPos).toEqual(ival(1, 9));
        expect(rCross).toEqual(ival(0, 9));
    });

    it("returns null element for negative integer powers when interval contains zero", () => {
        const x = ival(-1, 1); // contains zero
        const n = -1 as CFInt32;

        const res = ivalAlg.powInt(x, n);
        expect(ALGEBRA_IVAL.isNull(res)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Real powers (pow) — integer vs non-integer behavior
    // -------------------------------------------------------------------------

    it("delegates integer exponents in pow(...) to powInt and supports negative / crossing intervals for odd exponents", () => {
        const x = ival(-2, 3);
        const e = 3 as CFReal; // integer exponent

        const viaPow = ivalAlg.pow(x, e)!;
        const viaPowInt = ivalAlg.powInt(x, 3 as CFInt32)!;

        expect(viaPow).toEqual(viaPowInt);
        expect(viaPow).toEqual(ival(-8, 27));
    });

    it("only allows non-integer powers on strictly positive intervals", () => {
        const positive = ival(1, 4);
        const crossing = ival(-1, 4);
        const nonPositive = ival(-3, -1);

        const e = 0.5 as CFReal; // sqrt-like non-integer power

        // strictly positive: OK
        const rPos = ivalAlg.pow(positive, e)!;
        // scalar: [1,4]^(0.5) = [1,2]
        expect(rPos).toEqual(ival(1, 2));

        // crossing zero: null
        expect(ALGEBRA_IVAL.isNull(ivalAlg.pow(crossing, e))).toBe(true);

        // negative-only: null
        expect(ALGEBRA_IVAL.isNull(ivalAlg.pow(nonPositive, e))).toBe(true);
    });

    // -------------------------------------------------------------------------
    // nthRoot
    // -------------------------------------------------------------------------

    it("nthRoot with odd n is defined on all reals", () => {
        const x = ival(-8, 27);
        const n = 3 as CFUint32;

        const r = ivalAlg.nthRoot(x, n)!;
        // cube root: [-8,27] -> [-2,3]
        expect(r).toEqual(ival(-2, 3));
    });

    it("nthRoot with even n is only defined when interval does not contain negative values", () => {
        const positive = ival(1, 9);
        const zeroToPos = ival(0, 9);
        const crossing = ival(-1, 9);
        const negative = ival(-4, -1);

        const n = 2 as CFUint32;

        // [1,9] -> [1,3]
        expect(ivalAlg.nthRoot(positive, n)).toEqual(ival(1, 3));

        // [0,9] -> [0,3]
        expect(ivalAlg.nthRoot(zeroToPos, n)).toEqual(ival(0, 3));

        // crosses zero: null
        expect(ALGEBRA_IVAL.isNull(ivalAlg.nthRoot(crossing, n))).toBe(true);

        // entirely negative: null
        expect(ALGEBRA_IVAL.isNull(ivalAlg.nthRoot(negative, n))).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Serialization / print
    // -------------------------------------------------------------------------

    it("serializes and deserializes intervals using fromBytes / sizeInBytes", () => {
        const x = ival(1.5, 2.5);
        const bytes = new Uint8Array(ivalAlg.sizeInBytes(x));

        const writer = ivalAlg.bytesWriter(bytes);
        const written = writer.write(x, 0 as CFUint32);
        expect(written).toBe(ivalAlg.sizeInBytes(x));

        const roundTrip = ivalAlg.fromBytes(bytes)!;
        expect(roundTrip).toEqual(x);
    });

    it("prints intervals in [lo, hi] format", () => {
        const x = ival(1.5, 2.5);
        expect(ivalAlg.print(x)).toBe("[1.5, 2.5]");
    });

    // TODO

    it("TODO: add more tests for contains(...) edge cases", () => {
        // e.g. intervals that share endpoints, degenerate intervals [a,a], etc.
        // expect(...).toBe(...);
    });

    it("TODO: add more tests for behaviour with extremely small / large numbers", () => {
        // e.g. near Number.MIN_VALUE / MAX_VALUE, or subnormal region if relevant
        // expect(...).toBe(...);
    });

    it("TODO: add more tests for powInt(...) with large exponents", () => {
        // e.g. verify that overflow/undefined is handled as you expect in realAlg
        // expect(...).toBe(...);
    });

    it("TODO: add more tests for nthRoot(...) with higher orders (n > 2)", () => {
        // e.g. 4th roots, 5th roots, etc.
        // expect(...).toBe(...);
    });
});
