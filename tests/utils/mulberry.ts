// ---------- PRNG ----------
import {CFReal, CFUint32} from "../../src";

// Random uint32 in [0, 2^32)
export function mulberry32_uint32(seed: CFUint32 ) {
    let t = seed >>> 0;
    return function rand(): CFUint32  {
        t = (t + 0x6D2B79F5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), t | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return (r ^ (r >>> 14)) >>> 0 as CFUint32;
    };
}

// Random uint32 in [0, N)
export function mulberry32_uint32_N(seed: CFUint32) {
    let t = seed >>> 0;
    return function rand(N: CFUint32): CFUint32  {
        t = (t + 0x6D2B79F5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), t | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) % N as CFUint32;
    };
}

// Random real in [0, 1)
export function mulberry32_Real01(seed: CFUint32) {
    let t = seed >>> 0;
    return function rand(): CFReal  {
        t = (t + 0x6D2B79F5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), t | 1);                    
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296 as CFReal; 
    };
}