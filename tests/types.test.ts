// types.test.ts
import { describe, it, expect, expectTypeOf } from 'vitest';

import {
    isUint32,
    toUint32,
    CFUint32,
    isInt32,
    toInt32,
    CFInt32,
    isReal,
    toReal,
    CFReal,
    isBit,
    toBit,
    CFBit,
} from '../src';
import {MAX_INT32, MAX_UINT32, MIN_INT32} from "../src/math_utils";

describe('CFUint32', () => {
    
    describe('isUint32 (runtime)', () => {
        it('accepts valid unsigned 32-bit integers', () => {
            expect(isUint32(0)).toBe(true);
            expect(isUint32(1)).toBe(true);
            expect(isUint32(MAX_UINT32)).toBe(true); // 2^32 - 1
        });
    
        it('rejects invalid numbers', () => {
            expect(isUint32(-1)).toBe(false);
            expect(isUint32(1.5)).toBe(false);
            expect(isUint32(Number.NaN)).toBe(false);
            expect(isUint32(Number.POSITIVE_INFINITY)).toBe(false);
            expect(isUint32(Number.NEGATIVE_INFINITY)).toBe(false);
            expect(isUint32(-0)).toBe(false);
            // out of range
            expect(isUint32(MAX_UINT32 + 1)).toBe(false);
        });
    });
    
    describe('toUint32 (runtime)', () => {
        it('returns CFUint32 on valid input, null otherwise', () => {
            expect(toUint32(1234)).toBe(1234);
            expect(toUint32(0)).toBe(0);
            expect(toUint32(MAX_UINT32)).toBe(MAX_UINT32);
            expect(toUint32(-1)).toBeNull();
            expect(toUint32(3.14)).toBeNull();
            expect(toUint32(Number.NaN)).toBeNull();
            expect(toUint32(-0)).toBeNull();
        });
    });
    
    describe('Type shape', () => {
        it('CFUint32 narrows via isUint32', () => {
            const x: number = 42;
            if (isUint32(x)) {
                expectTypeOf(x).toEqualTypeOf<CFUint32>();
            } else {
                expectTypeOf(x).toEqualTypeOf<number>();
            }
        });
    
        it('function return types', () => {
            expectTypeOf(toUint32(0)).toEqualTypeOf<CFUint32 | null>();
        });
    });
});

describe('CFInt32', () => {

    describe('isInt32 (runtime)', () => {
        it('accepts valid signed 32-bit integers', () => {
            expect(isInt32(0)).toBe(true);
            expect(isInt32(-0)).toBe(true);
            expect(isInt32(1)).toBe(true);
            expect(isInt32(-1)).toBe(true);
            expect(isInt32(MAX_INT32)).toBe(true);
            expect(isInt32(MIN_INT32)).toBe(true);
        });

        it('rejects invalid numbers', () => {
            expect(isInt32(1.5)).toBe(false);
            expect(isInt32(Number.NaN)).toBe(false);
            expect(isInt32(Number.POSITIVE_INFINITY)).toBe(false);
            expect(isInt32(Number.NEGATIVE_INFINITY)).toBe(false);
            // out of range
            expect(isInt32(MAX_INT32 + 1)).toBe(false);
            expect(isInt32(MIN_INT32 - 1)).toBe(false);
        });
    });

    describe('toInt32 (runtime)', () => {
        it('returns CFInt32 on valid input, null otherwise', () => {
            expect(toInt32(1234)).toBe(1234);
            expect(toInt32(0)).toBe(0);
            expect(toInt32(MAX_UINT32)).toBeNull();
            expect(toInt32(-1)).toBe(-1);
            expect(toInt32(3.14)).toBeNull();
            expect(toInt32(Number.NaN)).toBeNull();
        });
    });

    describe('Type shape', () => {
        it('CFInt32 narrows via isInt32', () => {
            const x: number = 42;
            if (isInt32(x)) {
                expectTypeOf(x).toEqualTypeOf<CFInt32>();
            } else {
                expectTypeOf(x).toEqualTypeOf<number>();
            }
        });

        it('function return types', () => {
            expectTypeOf(toInt32(0)).toEqualTypeOf<CFInt32 | null>();
        });
    });
});

describe('CFReal', () => {

    describe('isReal (runtime)', () => {
        it('accepts valid signed 32-bit integers', () => {
            expect(isReal(0)).toBe(true);
            expect(isReal(-0)).toBe(true);
            expect(isReal(1)).toBe(true);
            expect(isReal(-1)).toBe(true);
            expect(isReal(0.0)).toBe(true);
            expect(isReal(0.2e5)).toBe(true);

        });

        it('rejects invalid numbers', () => {
            expect(isReal(Number.NaN)).toBe(false);
            expect(isReal(Number.POSITIVE_INFINITY)).toBe(false);
            expect(isReal(Number.NEGATIVE_INFINITY)).toBe(false);
        });
    });

    describe('toReal (runtime)', () => {
        it('returns CFReal on valid input, null otherwise', () => {
            expect(toReal(1234)).toBe(1234);
            expect(toReal(0)).toBe(0);
            expect(toReal(-1)).toBe(-1);
            expect(toReal(Number.NaN)).toBeNull();
            expect(toReal(Number.POSITIVE_INFINITY)).toBeNull();
            expect(toReal(Number.NEGATIVE_INFINITY)).toBeNull();
        });
    });

    describe('Type shape', () => {
        it('CFReal narrows via isReal', () => {
            const x: number = 42;
            if (isReal(x)) {
                expectTypeOf(x).toEqualTypeOf<CFReal>();
            } else {
                expectTypeOf(x).toEqualTypeOf<number>();
            }
        });

        it('function return types', () => {
            expectTypeOf(toReal(0)).toEqualTypeOf<CFReal | null>();
        });
    });
});

describe('CFBit', () => {

    describe('isBit (runtime)', () => {
        it('accepts 0 and 1', () => {
            expect(isBit(0)).toBe(true);
            expect(isBit(1)).toBe(true);

        });

        it('rejects invalid numbers', () => {
            expect(isBit(-0)).toBe(false);
            expect(isBit(2)).toBe(false);
            expect(isBit(-1)).toBe(false);
            expect(isBit(1.1)).toBe(false);
            expect(isBit(Number.NaN)).toBe(false);
            expect(isBit(Number.POSITIVE_INFINITY)).toBe(false);
            expect(isBit(Number.NEGATIVE_INFINITY)).toBe(false);
        });
    });

    describe('toBit (runtime)', () => {
        it('returns CFBit on valid input, null otherwise', () => {
            expect(toBit(0)).toBe(0);
            expect(toBit(1)).toBe(1);
            expect(toBit(-1)).toBeNull();
            expect(toBit(2.5)).toBeNull();
            expect(toBit(2)).toBeNull();
            expect(toBit(Number.NaN)).toBeNull();
            expect(toBit(Number.POSITIVE_INFINITY)).toBeNull();
            expect(toBit(Number.NEGATIVE_INFINITY)).toBeNull();
        });
    });

    describe('Type shape', () => {
        it('CFBit narrows via isBit', () => {
            const x: number = 42;
            if (isBit(x)) {
                expectTypeOf(x).toEqualTypeOf<CFBit>();
            } else {
                expectTypeOf(x).toEqualTypeOf<number>();
            }
        });

        it('function return types', () => {
            expectTypeOf(toBit(0)).toEqualTypeOf<CFBit | null>();
        });
    });
});