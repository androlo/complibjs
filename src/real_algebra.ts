/* -----------------------------------------
   Concrete algebra for real machine-numbers (double precision floats): CFReal = number
   Notes:
   - Valid values are finite numbers (no NaN/±Infinity).
   - Division by zero / inverse of zero returns undefined.
   - Invalid roots and powers (e.g., 0^0, square root of negatives) return undefined.
   - Overflow and other errors lead to undefined results (returns undefined).
   ----------------------------------------- */
import { CFInt32, CFReal, CFUint32 } from "./types";
import { intPow } from "./math_utils";

export class CFAlgebraReal {
    readonly typeName = "Real";
    readonly sizeInBytes = (_x: CFReal) => 8 as CFUint32; // one Float64

    zeroTol = 1e-15 as CFReal;
    oneTol = 1e-15 as CFReal;

    // Small helper to log and return undefined in a typed way.
    private err<T>(method: string, reason: string): T | undefined {
        // Keep message short per request
        console.error(`[CF.Real ${method}] ${reason}`);
        return undefined;
    }

    // Tolerances for isNull and isOne can be set at construction time, or later.
    // There are default values for both.
    constructor(tolerances?: { zeroTol: CFReal; oneTol: CFReal }) {
        if (tolerances) {
            this.zeroTol = tolerances.zeroTol;
            this.oneTol = tolerances.oneTol;
        }
    }

    isZero(x: CFReal): boolean { return Math.abs(x) <= this.zeroTol; }
    isOne(x: CFReal): boolean { return Math.abs(x - 1) <= this.oneTol; }

    // Creation / identity
    isValue(x: unknown): x is CFReal {
        return typeof x === "number" && Number.isFinite(x);
    }

    // Metric
    abs(x: CFReal): CFReal {
        return Math.abs(x) as CFReal;
    }

    dist(x: CFReal, y: CFReal): CFReal | undefined {
        const d = Math.abs(x - y);
        return Number.isFinite(d) ? (d as CFReal) : this.err("dist", "overflow in |x - y|");
    }

    // Equality and comparisons.
    eq(x: CFReal, y: CFReal): boolean {
        const diff = Math.abs(x - y);
        const scale = Math.max(1, Math.abs(x), Math.abs(y));
        return diff <= Number.EPSILON * scale;
    }

    lt(x: CFReal, y: CFReal): boolean {
        // strictly less, but tolerant to "almost equal"
        return !this.eq(x, y) && x < y;
    }

    lte(x: CFReal, y: CFReal): boolean {
        // less or equal with tolerance
        return this.eq(x, y) || x < y;
    }

    gt(x: CFReal, y: CFReal): boolean {
        return !this.eq(x, y) && x > y;
    }

    gte(x: CFReal, y: CFReal): boolean {
        return this.eq(x, y) || x > y;
    }

    // Algebraic ops
    add(x: CFReal, y: CFReal): CFReal | undefined {
        const z = x + y;
        return Number.isFinite(z) ? (z as CFReal) : this.err("add", "overflow/NaN");
    }

    sub(x: CFReal, y: CFReal): CFReal | undefined {
        const z = x - y;
        return Number.isFinite(z) ? (z as CFReal) : this.err("sub", "overflow/NaN");
    }

    neg(x: CFReal): CFReal {
        return (-x) as CFReal;
    }

    mul(x: CFReal, y: CFReal): CFReal | undefined {
        const z = x * y;
        return Number.isFinite(z) ? (z as CFReal) : this.err("mul", "overflow/NaN");
    }

    div(x: CFReal, y: CFReal): CFReal | undefined {
        if (y === 0) return this.err("div", "divide by zero");
        const z = x / y;
        return Number.isFinite(z) ? (z as CFReal) : this.err("div", "overflow/NaN");
    }

    inv(x: CFReal): CFReal | undefined {
        if (x === 0) return this.err("inv", "inverse of zero");
        const z = 1 / x;
        return Number.isFinite(z) ? (z as CFReal) : this.err("inv", "overflow to ±Infinity");
    }

    smulLeft(s: CFReal, x: CFReal): CFReal | undefined { return this.mul(s, x); }
    smulRight(x: CFReal, s: CFReal): CFReal | undefined { return this.mul(x, s); }

    powInt(x: CFReal, n: CFInt32): CFReal | undefined {
        if (x === 0 && n === 0) return this.err("powInt", "0^0 undefined");
        if (n === 0) return 1 as CFReal;

        let y: number | undefined;
        if (n > 0) {
            y = intPow(x, (n >>> 0) as CFUint32);
            if (y === undefined) return this.err("powInt", "overflow in intPow");
        } else {
            const pow = intPow(x, ((-n) >>> 0) as CFUint32);
            if (pow === undefined) return this.err("powInt", "overflow in intPow");
            y = 1 / pow;
        }
        return Number.isFinite(y!) ? (y as CFReal) : this.err("powInt", "overflow/NaN");
    }

    pow(x: CFReal, e: CFReal): CFReal | undefined {
        if (x === 0 && e === 0) return this.err("pow", "0^0 undefined");
        const y = Math.pow(x, e);
        return Number.isFinite(y) ? (y as CFReal) : this.err("pow", "overflow/NaN");
    }

    nthRoot(x: CFReal, n: CFUint32): CFReal | undefined {
        if (n === 0) return this.err("nthRoot", "0-th root undefined");
        if (n === 1) return x;
        const y = Math.pow(x, 1 / n);
        return Number.isFinite(y) ? (y as CFReal) : this.err("nthRoot", "overflow/NaN");
    }

    // Serialization
    fromBytes(bytes: Uint8Array): CFReal | undefined {
        if (bytes.byteLength !== 8) return this.err("fromBytes", "expected 8 bytes");
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const v = dv.getFloat64(0, true);
        return this.isValue(v) ? v : this.err("fromBytes", "decoded non-finite");
    }
}

export const ALGEBRA_REAL = new CFAlgebraReal();
