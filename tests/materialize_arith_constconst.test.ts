import {describe, expect, it, beforeAll} from "vitest";
import {
    ALGEBRA_IVAL,
    CFBinOpType,
    CFDim,
    CFIval,
    CFUint32,
    CFUint32One,
    CFUint32Two,
    createConstUnitFunc,
    CFStorageTag
} from "../src";
import {materializeConstConst} from "../src/materialize";

// ============================================================================
// materializeConstConst — const ⊕ const
// ============================================================================

describe('materializeConstConst (const ⊕ const)', () => {
    const U = 1 as CFUint32;
    const S = 1 as CFUint32;

    const c = (dim: CFDim, val: CFIval) => createConstUnitFunc(dim, U, S, val);

    it('preserves left shape (dim/NU/NS) and returns Const', () => {
        const left = c(2 as CFUint32Two, [2, 3] as any);
        const right = c(2 as CFUint32Two, [4, 5] as any);

        const out = materializeConstConst(left, right, ALGEBRA_IVAL.add, CFBinOpType.Left);
        expect(out.storage).toBe(CFStorageTag.Const);
        expect(out.dim).toBe(left.dim);
        expect(out.NU).toBe(left.NU);
        expect(out.NS).toBe(left.NS);

        const expected = ALGEBRA_IVAL.add(left.value, right.value);
        expect(ALGEBRA_IVAL.eq(out.value, expected)).toBe(true);
    });

    describe('Add (commutative)', () => {
        it('Left/Right opType yield the same value', () => {
            const a = c(1 as CFUint32One, [2, 3] as any);
            const b = c(1 as CFUint32One, [4, 6] as any);

            const left = materializeConstConst(a, b, ALGEBRA_IVAL.add, CFBinOpType.Left);
            const right = materializeConstConst(a, b, ALGEBRA_IVAL.add, CFBinOpType.Right);

            const expected = ALGEBRA_IVAL.add(a.value, b.value);
            expect(ALGEBRA_IVAL.eq(left.value, expected)).toBe(true);
            expect(ALGEBRA_IVAL.eq(right.value, expected)).toBe(true);
        });

        it('null + x = x; x + null = x (total arithmetic)', () => {
            const z = c(1 as CFUint32One, ALGEBRA_IVAL.null());
            const x = c(1 as CFUint32One, [7, 8] as any);

            const l = materializeConstConst(z, x, ALGEBRA_IVAL.add, CFBinOpType.Left);
            const r = materializeConstConst(x, z, ALGEBRA_IVAL.add, CFBinOpType.Left);

            expect(ALGEBRA_IVAL.eq(l.value, x.value)).toBe(true);
            expect(ALGEBRA_IVAL.eq(r.value, x.value)).toBe(true);
        });
    });

    describe('Sub (non-commutative)', () => {
        it('Left: a - b; Right: b - a', () => {
            const a = c(1 as CFUint32One, [5, 9] as any);
            const b = c(1 as CFUint32One, [2, 3] as any);

            const left = materializeConstConst(a, b, ALGEBRA_IVAL.sub, CFBinOpType.Left);
            const right = materializeConstConst(a, b, ALGEBRA_IVAL.sub, CFBinOpType.Right);

            const expectedL = ALGEBRA_IVAL.sub(a.value, b.value);
            const expectedR = ALGEBRA_IVAL.sub(b.value, a.value);

            expect(ALGEBRA_IVAL.eq(left.value, expectedL)).toBe(true);
            expect(ALGEBRA_IVAL.eq(right.value, expectedR)).toBe(true);
        });

        it('a - 0 = a; 0 - a = -a (total arithmetic)', () => {
            const a = c(1 as CFUint32One, [2, 5] as any);
            const z = c(1 as CFUint32One, ALGEBRA_IVAL.null());

            const aMinus0 = materializeConstConst(a, z, ALGEBRA_IVAL.sub, CFBinOpType.Left);
            expect(ALGEBRA_IVAL.eq(aMinus0.value, a.value)).toBe(true);

            const zeroMinusA = materializeConstConst(z, a, ALGEBRA_IVAL.sub, CFBinOpType.Left);
            const negA = ALGEBRA_IVAL.mul([-1, -1] as any, a.value);
            expect(ALGEBRA_IVAL.eq(zeroMinusA.value, negA)).toBe(true);
        });
    });

    describe('Mul (commutative)', () => {
        it('Left/Right opType yield the same value', () => {
            const a = c(2 as CFUint32Two, [2, 4] as any);
            const b = c(2 as CFUint32Two, [3, 3] as any);

            const left = materializeConstConst(a, b, ALGEBRA_IVAL.mul, CFBinOpType.Left);
            const right = materializeConstConst(a, b, ALGEBRA_IVAL.mul, CFBinOpType.Right);

            const expected = ALGEBRA_IVAL.mul(a.value, b.value);
            expect(ALGEBRA_IVAL.eq(left.value, expected)).toBe(true);
            expect(ALGEBRA_IVAL.eq(right.value, expected)).toBe(true);
        });

        it('0 * x = 0; x * 0 = 0 (total arithmetic)', () => {
            const z = c(1 as CFUint32One, ALGEBRA_IVAL.null());
            const x = c(1 as CFUint32One, [7, 8] as any);

            const l = materializeConstConst(z, x, ALGEBRA_IVAL.mul, CFBinOpType.Left);
            const r = materializeConstConst(x, z, ALGEBRA_IVAL.mul, CFBinOpType.Left);

            expect(ALGEBRA_IVAL.isNull(l.value)).toBe(true);
            expect(ALGEBRA_IVAL.isNull(r.value)).toBe(true);
        });
    });

    describe('Div (non-commutative)', () => {
        it('Left: a / b; Right: b / a', () => {
            const a = c(1 as CFUint32One, [6, 12] as any);
            const b = c(1 as CFUint32One, [2, 3] as any);

            const left = materializeConstConst(a, b, ALGEBRA_IVAL.div, CFBinOpType.Left);
            const right = materializeConstConst(a, b, ALGEBRA_IVAL.div, CFBinOpType.Right);

            const expectedL = ALGEBRA_IVAL.div(a.value, b.value);
            const expectedR = ALGEBRA_IVAL.div(b.value, a.value);

            expect(ALGEBRA_IVAL.eq(left.value, expectedL)).toBe(true);
            expect(ALGEBRA_IVAL.eq(right.value, expectedR)).toBe(true);
        });

        it('0 / x = 0, and x / 0 = 0 (total division)', () => {
            const z = c(1 as CFUint32One, ALGEBRA_IVAL.null());
            const x = c(1 as CFUint32One, [7, 8] as any);

            const zeroOverX = materializeConstConst(z, x, ALGEBRA_IVAL.div, CFBinOpType.Left);
            expect(ALGEBRA_IVAL.isNull(zeroOverX.value)).toBe(true);

            const xOverZero = materializeConstConst(x, z, ALGEBRA_IVAL.div, CFBinOpType.Left);
            expect(ALGEBRA_IVAL.isNull(xOverZero.value)).toBe(true);
        });
    });

    describe('Stability with large values (overflow → null)', () => {
        it('add overflow yields null (if ALGEBRA_IVAL.add does)', () => {
            const huge = [Number.MAX_VALUE, Number.MAX_VALUE] as any as CFIval;
            const a = c(1 as CFUint32One, huge);
            const b = c(1 as CFUint32One, huge);
            const out = materializeConstConst(a, b, ALGEBRA_IVAL.add, CFBinOpType.Left);
            // In your system, overflow should totalize to null
            expect(ALGEBRA_IVAL.isNull(out.value)).toBe(true);
        });
    });
});