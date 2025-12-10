import {
    CFCompFuncBinary,
    CFDim,
    CFReal,
    CFSeriesIndex, CFUint32, CFUnit,
    CFUnitFunc
} from "./types";
import {ALGEBRA_IVAL, CFIval} from "./value_types/ival";
import {ALGEBRA_REAL} from "./real_algebra";
import {getUnitIterator} from "./ufunc_iter";
import {aI} from "vitest/dist/chunks/reporters.d.D-el0219";
import {createConstUnitFunc} from "./ufunc";



export function approxEqual(a: CFIval, b: CFIval, err: CFReal): boolean {
    const dist = ALGEBRA_IVAL.dist(a, b);
    if (dist === undefined) return false;
    return ALGEBRA_REAL.lte(dist, err);
}

export function minimumError(a: CFIval, b: CFIval): CFReal | undefined {
    return ALGEBRA_IVAL.dist(a, b);
}

/**
 * Minimum error for two unit functions and a given series index. The minimum error
 * is the greatest distance between point-wise values of the two functions at the
 * specified series index. Thus, the minimum error is the smallest error within
 * which the two functions are approximately equal.
 *
 * The function allows values instead of functions to be used, as per the framework
 * specification: if both arguments are values, the result is the minimum error between
 * values, and if only one is a value, the result is the minimum error between the value
 * and the (other) function.
 *
 * This function does not consider null values special but will compare distances between
 * null and non-null values. The 'onlyNonNull' parameter can be used to skip null values.
 *
 * The return value 'undefined' is returned when two functions with different domains are
 * used, and when the distance function produces an undefined value.
 */
export function minimumErrorFuncs<Dim extends CFDim>(
    a: CFUnitFunc<Dim> | CFIval,
    b: CFUnitFunc<Dim> | CFIval,
    s: CFSeriesIndex,
    onlyNonNull: boolean = false
): CFReal | undefined {
    const aIsVal = ALGEBRA_IVAL.isValue(a);
    const bIsVal = ALGEBRA_IVAL.isValue(b);
    if (aIsVal && bIsVal) {
        return minimumError(a as CFIval, b as CFIval);
    }
    let fa: CFUnitFunc<Dim>;
    let fb: CFUnitFunc<Dim>;
    if (aIsVal) {
        fb = b as CFUnitFunc<Dim>;
        fa = createConstUnitFunc(fb.dim, fb.NU, fb.NS, a as CFIval);
    } else if (bIsVal) {
        fa = a as CFUnitFunc<Dim>;
        fb = createConstUnitFunc(fa.dim, fa.NU, fa.NS, b as CFIval);
    } else {
        fa = a as CFUnitFunc<Dim>;
        fb = b as CFUnitFunc<Dim>;
        if (!fa.equalDomains(fb)) return undefined;
    }

    const itA = getUnitIterator(fa.dim, fa.NU);
    let minVal = 0 as CFReal;

    for (const e of itA) {
        const valA = fa.getUnsafe(...e.units, s)!;
        const valB = fb.getUnsafe(...e.units, s)!;
        if(onlyNonNull) {
            if(ALGEBRA_IVAL.isNull(valA) || ALGEBRA_IVAL.isNull(valB)) continue;
        }
        const err = ALGEBRA_IVAL.dist(valA, valB);
        if (err === undefined) return undefined;
        if (err > minVal) minVal = err;
    }
    return minVal;
}

export function VR_Error(cf: CFCompFuncBinary, u: CFUnit, s: CFSeriesIndex): CFReal | undefined {
    return ALGEBRA_IVAL.dist(cf.getUnsafe(u, u, s), ALGEBRA_IVAL.one());
}

export function VR_V_Error(cf: CFCompFuncBinary, units: CFUnit[], s: CFSeriesIndex): CFReal | undefined {
    let err = 0 as CFReal;
    for (let i = 0 as CFUnit; i < units.length; i++) {
        const u = units[i];
        const e = VR_Error(cf, u, s);
        if (e === undefined) return undefined;
        if (ALGEBRA_REAL.gt(e, err)) err = e;
    }
    return err;
}

export function VR_FRAME_Error(cf: CFCompFuncBinary, s: CFSeriesIndex): CFReal | undefined {
    let err = 0 as CFReal;
    for (let u = 0 as CFUnit; u < cf.NU; u++) {
        const e = VR_Error(cf,u, s);
        if (e === undefined) return undefined;
        if (ALGEBRA_REAL.gt(e, err)) err = e;
    }
    return err;
}

export function VR_CF_Error(cf: CFCompFuncBinary): CFReal | undefined {
    let err = 0 as CFReal;
    for(let s = 0 as CFSeriesIndex; s < cf.NS; s++) {
        const e = VR_FRAME_Error(cf, s);
        if (e === undefined) return undefined;
        if (ALGEBRA_REAL.gt(e, err)) err = e;
    }
    return err;
}

export function VS_Error(
    cf: CFCompFuncBinary, 
    u: CFUnit, 
    v: CFUnit, 
    s: CFSeriesIndex
): CFReal | undefined {
    const valL = cf.getUnsafe(u, v, s);
    const valR = cf.getUnsafe(v, u, s);
    const prod = ALGEBRA_IVAL.mul(valL, valR);
    return ALGEBRA_IVAL.dist(prod, ALGEBRA_IVAL.one());
}

export function VS_V_Error(
    cf: CFCompFuncBinary, 
    units: CFUnit[], 
    s: CFSeriesIndex
): CFReal | undefined {
    let err = 0 as CFReal;
    for(let i = 0 as CFUnit; i < units.length; i++) {
        const u = units[i];
        for(let j = i as CFUint32; j < units.length; j++) {
            const v = units[j];
            const e = VS_Error(cf, u, v, s);
            if (e === undefined) return undefined;
            if (ALGEBRA_REAL.gt(e, err)) err = e;
        }
    }
    return err;
}

export function VS_FRAME_Error(cf: CFCompFuncBinary, s: CFSeriesIndex): CFReal | undefined {
    let err = 0 as CFReal;
    for (let u = 0 as CFUnit; u < cf.NU; u++) {
        for(let v = u as CFUint32; v < cf.NU; v++) {
            const e = VS_Error(cf, u, v, s);
            if (e === undefined) return undefined;
            if (ALGEBRA_REAL.gt(e, err)) err = e;
        }
    }
    return err;
}

export function VS_CF_Error(cf: CFCompFuncBinary): CFReal | undefined {
    let err = 0 as CFReal;
    for(let s = 0 as CFSeriesIndex; s < cf.NS; s++) {
        const e = VS_FRAME_Error(cf, s);
        if (e === undefined) return undefined;
        if (ALGEBRA_REAL.gt(e, err)) err = e;
    }
    return err;
}

export function VT_Error(
    cf: CFCompFuncBinary, 
    u: CFUnit, 
    v: CFUnit, 
    w: CFUnit, 
    s: CFSeriesIndex
): CFReal | undefined {
    const valL = cf.getUnsafe(u, v, s);
    const valR = cf.getUnsafe(v, w, s);
    const valT = cf.getUnsafe(u, w, s);
    return ALGEBRA_IVAL.dist(ALGEBRA_IVAL.mul(valL, valR), valT);
}

// TODO optimize.
export function VT_V_Error(
    cf: CFCompFuncBinary, 
    units: CFUnit[], 
    s: CFSeriesIndex
): CFReal | undefined {
    let err = 0 as CFReal;
    for(let i = 0 as CFUnit; i < units.length; i++) {
        const u = units[i];
        for(let j = i as CFUint32; j < units.length; j++) {
            const v = units[j];
            for(let k = j as CFUint32; k < units.length; k++) {
                const w = units[k];
                const e = VT_Error(cf, u, v, w, s);
                if (e === undefined) return undefined;
                if (ALGEBRA_REAL.gt(e, err)) err = e;
            }
        }
    }
    return err;
}

// TODO optimize.
export function VT_FRAME_Error(cf: CFCompFuncBinary, s: CFSeriesIndex): CFReal | undefined {
    let err = 0 as CFReal;
    for (let u = 0 as CFUnit; u < cf.NU; u++) {
        for(let v = 0 as CFUint32; v < cf.NU; v++) {
            const valL = cf.getUnsafe(u, v, s);

            for(let w = 0 as CFUint32; w < cf.NU; w++) {
                const valR = cf.getUnsafe(v, w, s);
                const valT = cf.getUnsafe(u, w, s);
                const e = ALGEBRA_IVAL.dist(ALGEBRA_IVAL.mul(valL, valR), valT);
                if (e === undefined) return undefined;
                if (ALGEBRA_REAL.gt(e, err)) err = e;
            }
        }
    }
    return err;
}

export function VT_CF_Error(cf: CFCompFuncBinary): CFReal | undefined {
    let err = 0 as CFReal;
    for(let s = 0 as CFSeriesIndex; s < cf.NS; s++) {
        const e = VT_FRAME_Error(cf, s);
        if (e === undefined) return undefined;
        if (ALGEBRA_REAL.gt(e, err)) err = e;
    }
    return err;
}

export function VRAT_V_Error(
    cf: CFCompFuncBinary, 
    units: CFUnit[], 
    s: CFSeriesIndex
): CFReal | undefined {

    const eR = VR_V_Error(cf, units, s);
    if (eR === undefined) return undefined;
    const eS = VS_V_Error(cf, units, s);
    if (eS === undefined) return undefined;
    const eT = VT_V_Error(cf, units, s);
    if (eT === undefined) return undefined;

    const err = ALGEBRA_REAL.gt(eR, eS) ? eR : eS;
    return ALGEBRA_REAL.gt(err, eT) ? err : eT;
}

export function VRAT_FRAME_Error(
    cf: CFCompFuncBinary, 
    s: CFSeriesIndex
): CFReal | undefined {

    const eR = VR_FRAME_Error(cf, s);
    if (eR === undefined) return undefined;
    const eS = VS_FRAME_Error(cf, s);
    if (eS === undefined) return undefined;
    const eT = VT_FRAME_Error(cf, s);
    if (eT === undefined) return undefined;

    const err = ALGEBRA_REAL.gt(eR, eS) ? eR : eS;
    return ALGEBRA_REAL.gt(err, eT) ? err : eT;
}

export function VRAT_CF_Error(cf: CFCompFuncBinary): CFReal | undefined {
    let err = 0 as CFReal;
    for(let s = 0 as CFSeriesIndex; s < cf.NS; s++) {
        const e = VRAT_FRAME_Error(cf, s);
        if (e === undefined) return undefined;
        if (ALGEBRA_REAL.gt(e, err)) err = e;
    }
    return err;
}
