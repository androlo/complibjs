/* -----------------------------------------
   Concrete algebra for intervals: CFIval = [lo, hi]
   Standard choices:
   - Order: subset (inclusion) partial order: x ⊆ y  <=>  y.lo <= x.lo && x.hi <= y.hi
   - Arithmetic: classic interval arithmetic (naïve hulls).
   - "null" is [0,0]; "one" is [1,1].
   - abs([a,b]) =
       [a>=0? a : 0, b<=0? -a : Math.max(-a,b)] specialized to cases:
         if b <= 0 -> [-b, -a]
         else if a >= 0 -> [a, b]
         else -> [0, Math.max(-a, b)]
   - principal(x) = midpoint encoded as [m,m]; error(x) = radius encoded as [r,r].
   - enorm(x) now equals mag(x) encoded as [m,m] for compatibility.
   ----------------------------------------- */
import {CFValueAlgebra, CFValueByteWriter} from "../value";
import {CFInt32, CFReal, CFRealOne, CFRealZero, CFUint32, isInt32} from "../types";
import {intPow} from "../math_utils";
import {ALGEBRA_REAL, CFAlgebraReal} from "../real_algebra";

/** Interval component selector. */

export type CFIval = readonly [lo: CFReal, hi: CFReal];
export type CFIvalOne = readonly [CFRealOne, CFRealOne];
export type CFIvalNull = readonly [CFRealZero, CFRealZero];

export class CFIvalByteWriter implements CFValueByteWriter<CFIval> {

    private readonly dv: DataView;

    constructor(bytes: Uint8Array) {
        this.dv = new DataView(bytes.buffer);
    }

    write(val: CFIval, pos: CFUint32): CFUint32 {
        if (pos + 16 > this.dv.byteLength) return 0 as CFUint32;
        this.dv.setFloat64(pos + 0, val[0], true);
        this.dv.setFloat64(pos + 8, val[1], true);
        return 16 as CFUint32;
    }

    writeUnsafe(val: CFIval, pos: CFUint32): void {
        this.dv.setFloat64(pos + 0, val[0], true);
        this.dv.setFloat64(pos + 8, val[1], true);
    }
}


/**
 * Interval arithmetic over closed real intervals [lo, hi], with lo <= hi.
 *
 * Representation:
 * - A value is a 2-tuple [lo, hi].
 * - [0, 0] is used as the "null" value (multiplicative annihilator).
 * - [1, 1] is the multiplicative identity, "one".
 *
 * Basic intent:
 * - Each operation produces an interval that *encloses* every possible exact result,
 *   assuming each operand can be any real number in its interval.
 * - This is the classic, dependency-agnostic interval arithmetic: repeated occurrences
 *   of the same interval are treated as independent, so results can be wider than
 *   mathematically minimal. Normal interval integer power computations are used, not
 *   repeated multiplication, meaning there is no dependency to consider.
 *
 * Core operations (classic IA):
 *
 * 1) Addition:
 *    [a, b] + [c, d] = [a + c, b + d]
 *
 * 2) Subtraction:
 *    [a, b] - [c, d] = [a - d, b - c]
 *
 * 3) Multiplication:
 *    [a, b] * [c, d] = [min(ac, ad, bc, bd), max(ac, ad, bc, bd)]
 *    This covers all sign combinations of the endpoints.
 *
 * 4) Division:
 *    [a, b] / [c, d]:
 *      - if 0 ∈ [c, d], the true result is not a single interval (it’s a union),
 *        so this implementation returns '[0, 0]' (total division).
 *      - otherwise, divide by inverting the divisor and multiplying:
 *          1 / [c, d] = [1/d, 1/c] (endpoints swapped if needed),
 *        then multiply.
 *
 * 5) Scalar multiply:
 *    s * [a, b] =
 *      - [sa, sb] if s >= 0
 *      - [sb, sa] if s < 0
 *    with special-casing for s = 0 and s = 1.
 *
 * 6) Absolute value:
 *    abs([a, b]) =
 *      - [-b, -a]      if b <= 0 (entirely nonpositive)
 *      - [a,  b]       if a >= 0 (entirely nonnegative)
 *      - [0, max(-a,b)] if interval straddles 0
 *
 * Powers:
 * - Integer powers use a specialized interval-aware rule that distinguishes
 *   odd vs. even exponents and handles negative / positive / crossing-zero
 *   intervals to keep results tight.
 * - Non-integer powers are only allowed on strictly positive intervals.
 *
 * Roots:
 * - nthRoot([a, b], n) mirrors the power logic:
 *   - n = 0: undefined
 *   - n = 1: identity, [1,1].
 *   - odd n: monotone on all reals → apply to both ends
 *   - even n: only intervals with a >= 0; if a < 0 (the interval contains negative values),
 *             return undefined.
 *
 * Domain errors, summary:
 * - Whenever the real-valued result is not representable as a single closed interval
 *   (e.g., division by an interval containing 0, even root of an interval containing
 *   negative values, non-integer power of a non-positive interval), the operation
 *   returns `undefined`.
 */
export class CFValueAlgebraIval implements CFValueAlgebra<CFIval, CFIvalNull, CFIvalOne> {
    readonly typeName = "Ival";
    readonly sizeInBytes = (val: CFIval) => 16 as CFUint32; // two Float64s
    protected  readonly nullVal = [0, 0] as unknown as CFIvalNull;
    protected  readonly oneVal = [1, 1] as unknown as CFIvalOne;

    toIval(a: number, b: number): CFIval | undefined {
        const x = [a, b];
        return this.isValue(x) ? x : undefined;
    }

    isValue = (x: unknown): x is CFIval => {
        return Array.isArray(x) && x.length === 2 && this.isValid(x as unknown as CFIval);
    }

    isValid = (x: CFIval): x is CFIval => {
        return Number.isFinite(x[0]) && Number.isFinite(x[1]) && x[0] <= x[1];
    }

    isNull = (x: CFIval): x is CFIvalNull => {
        return ALGEBRA_REAL.isZero(x[0]) && ALGEBRA_REAL.isZero(x[1]);
    }

    isOne = (x: CFIval): x is CFIvalOne => {
        return ALGEBRA_REAL.isOne(x[0]) && ALGEBRA_REAL.isOne(x[1]);
    }

    null = (): CFIvalNull => {
        return this.nullVal;
    }

    one = (): CFIvalOne => {
        return this.oneVal;
    }

    // ---------- Standard helpers ----------
    /** Width = hi - lo (>= 0). */
    width = (x: CFIval): number => {
        return x[1] - x[0]; // Since lo <= hi, this is a valid real.
    }

    // Metric
    /** sup-norm on endpoints (Hausdorff distance for intervals). */
    dist = (x: CFIval, y: CFIval): CFReal | undefined => {
        const sub1 = ALGEBRA_REAL.sub(x[0], y[0]);
        if (sub1 === undefined) return undefined;
        const sub2 = ALGEBRA_REAL.sub(x[1], y[1]);
        if (sub2 === undefined) return undefined;
        const d1 = ALGEBRA_REAL.abs(sub1);
        const d2 = ALGEBRA_REAL.abs(sub2);
        return Math.max(d1, d2) as CFReal;
    }

    // Equality / order (subset order), satisfies d(x, y) == 0
    eq = (x: CFIval, y: CFIval): boolean => {
        return ALGEBRA_REAL.eq(x[0], y[0]) && ALGEBRA_REAL.eq(x[1], y[1]);
    }

    // x contains y
    contains = (x: CFIval, y: CFIval): boolean => {
        return ALGEBRA_REAL.gte(y[0], x[0]) && ALGEBRA_REAL.lte(y[1], x[1]);
    }

    // Algebraic ops
    add = (x: CFIval, y: CFIval): CFIval => {
        const retLo = ALGEBRA_REAL.add(x[0], y[0]);
        const retHi = ALGEBRA_REAL.add(x[1], y[1]);
        if(retLo === undefined || retHi === undefined) return this.nullVal;
        return [retLo, retHi] as CFIval;
    }

    sub = (x: CFIval, y: CFIval): CFIval => {
        const retLo = ALGEBRA_REAL.sub(x[0], y[1]);
        const retHi = ALGEBRA_REAL.sub(x[1], y[0]);
        if(retLo === undefined || retHi === undefined) return this.nullVal;
        return [retLo, retHi] as CFIval;
    }

    neg = (x: CFIval): CFIval => {
        return [-x[1] as CFReal, -x[0] as CFReal] as CFIval;
    }

    mul = (x: CFIval, y: CFIval): CFIval => {
        const [a, b] = x;
        const [c, d] = y;
        const p1 = ALGEBRA_REAL.mul(a, c);
        const p2 = ALGEBRA_REAL.mul(a, d);
        const p3 = ALGEBRA_REAL.mul(b, c);
        const p4 = ALGEBRA_REAL.mul(b, d);
        if (p1 === undefined || p2 === undefined || p3 === undefined || p4 === undefined)
            return this.nullVal;

        return [Math.min(p1, p2, p3, p4) as CFReal, Math.max(p1, p2, p3, p4) as CFReal] as CFIval;
    }

    div = (x: CFIval, y: CFIval): CFIval => {
        const [c, d] = y;
        // If 0 in the denominator, the true result is a disjoint union.
        if (c <= 0 && d >= 0) return this.nullVal;
        // Invert y and multiply.
        const lo = ALGEBRA_REAL.inv(d);
        if (lo === undefined) return this.nullVal;
        const hi = ALGEBRA_REAL.inv(c);
        if (hi === undefined) return this.nullVal;
        const r: CFIval = [lo, hi];
        const invY: CFIval = ALGEBRA_REAL.lte(r[0], r[1]) ? r : [r[1], r[0]];
        return this.mul(x, invY);
    }

    // Total
    inv = (x: CFIval): CFIval => {
        const [a, b] = x;
        // If 0 in the denominator, the true result is a disjoint union.
        if (a <= 0 && b >= 0) return this.nullVal;

        const aInv = ALGEBRA_REAL.inv(a);
        const bInv = ALGEBRA_REAL.inv(b);
        if (aInv === undefined || bInv === undefined) return this.nullVal;

        const r: CFIval = [bInv, aInv];
        return ALGEBRA_REAL.lte(r[0], r[1]) ? r : [r[1], r[0]];
    }

    private smul = (s: CFReal, x: CFIval): CFIval => {
        if (s === 0) return this.nullVal;
        if (s === 1) return x;
        const v0 = ALGEBRA_REAL.mul(s , x[0]);
        const v1 = ALGEBRA_REAL.mul(s , x[1]);
        if (v0 === undefined || v1 === undefined) return this.nullVal;
        return ALGEBRA_REAL.gte(s, 0 as CFRealZero) ? [v0, v1] : [v1, v0];
    }

    smulLeft = (s: CFReal, v: CFIval): CFIval => {
        return this.smul(s, v);
    }

    smulRight = (v: CFIval, s: CFReal): CFIval => {
        return this.smul(s, v);
    }

    powInt = (x: CFIval, n: CFInt32): CFIval => {

        // n = 0 → x^0 = 1 (x === 0 also includes -0).
        // [0, 0]^0 = ?
        if (n === 0) {
            if (this.isNull(x)) return this.nullVal;
            return this.oneVal;
        }

        const [a, b] = x;

        // positive powers
        if (n > 0) {
            const isEven = (n % 2 === 0);

            const ap = intPow(a, n >>> 0 as CFUint32);
            const bp = intPow(b, n >>> 0 as CFUint32);

            if (ap === undefined || bp === undefined) return this.nullVal;

            if (!isEven) {
                // odd power: monotone on all reals
                return [ap, bp];
            }

            // even power
            if (b < 0) {
                // entirely negative: order flips
                return [bp, ap];
            } else if (a > 0) {
                // entirely positive: normal order
                return [ap, bp];
            } else {
                // crosses 0
                return [0 as CFRealZero, Math.max(ap, bp) as CFReal];
            }
        }

        // negative powers: x^n = 1 / (x^|n|)
        const m = -n as CFInt32; // m > 0 here
        const positivePower = this.powInt(x, m); // recurse on the positive case
        return (positivePower !== undefined) ? this.inv(positivePower) : this.nullVal;
    }

    pow = (x: CFIval, e: CFReal): CFIval => {
        // x^0 = 1, except [0, 0]^0 = 0
        if (e === 0) {
            if (this.isNull(x)) return this.nullVal;
            return this.oneVal;
        }

        // integer exponent → use the tighter integer version
        if (isInt32(e)) {
            return this.powInt(x, e);
        }

        const [a, b] = x;

        // non-integer exponent: we only support positive bases (real domain)
        if (a <= 0) return this.nullVal;

        // now 0 < a <= b
        const ap = ALGEBRA_REAL.pow(a, e);
        const bp = ALGEBRA_REAL.pow(b, e);
        if (ap === undefined || bp === undefined) return this.nullVal;

        if (e > 0) {
            // strictly increasing on (0, ∞)
            return [ap, bp];
        } else {
            // e < 0 → strictly decreasing on (0, ∞)
            // so lower = b^e, upper = a^e
            return [bp, ap];
        }
    }

    private nthRootScalar = (x: CFReal, n: CFUint32): CFReal | undefined => {

        if (x < 0 && (n % 2 === 0)) {
            // even root of negative: no real root
            return undefined;
        }
        if (x < 0) {
            // odd root of negative: preserve sign
            const v = ALGEBRA_REAL.pow(-x as CFReal, 1 / n as CFReal);
            if (v === undefined) return undefined;
            return -v as CFReal;
        }
        return ALGEBRA_REAL.pow(x, 1 / n as CFReal);
    }

    nthRoot = (x: CFIval, n: CFUint32): CFIval => {

        if (n === 0) {
            return this.nullVal;
        }
        if (n === 1) return x;

        const [a, b] = x;

        const ap = this.nthRootScalar(a, n);
        const bp = this.nthRootScalar(b, n);

        if (ap === undefined || bp === undefined) return this.nullVal;

        // n > 0 here
        const isEven = (n % 2 === 0);

        if (!isEven) {
            // odd root: monotone over all reals
            // safe to apply to both ends
            return [ap, bp];
        }

        // even root: domain is x >= 0
        if (b < 0) {
            // whole interval below 0 -> no real root
            return this.nullVal;
        } else if (a < 0) {
            // Interval contains 0.
            return this.nullVal;
        }

        return [ap, bp];
    }

    // Absolute value (interval)
    abs = (x: CFIval): CFIval => {
        const [a, b] = x;
        if (ALGEBRA_REAL.lte(b, 0 as CFRealZero)) return [-b as CFReal, -a as CFReal]; // entirely ≤ 0
        if (ALGEBRA_REAL.gte(a, 0 as CFRealZero)) return [a, b];                 // entirely ≥ 0
        return [0 as CFRealZero, Math.max(-a, b) as CFReal]; // straddles 0
    }

    // Serialization
    fromBytes = (bytes: Uint8Array): CFIval | undefined => {
        if (bytes.byteLength !== 16) return undefined;
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const lo = dv.getFloat64(0, true);
        const hi = dv.getFloat64(8, true);
        const v = [lo, hi];
        return this.isValue(v) ? v : undefined;
    }

    bytesWriter = (bytes: Uint8Array): CFIvalByteWriter => {
        return new CFIvalByteWriter(bytes);
    }

    // String rendering
    print = (v: CFIval): string => {
        return `[${v[0]}, ${v[1]}]`;
    }
}

export const ALGEBRA_IVAL = new CFValueAlgebraIval();