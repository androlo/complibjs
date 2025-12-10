import {CFBasis, CFCompFuncBinary, CFDimData, CFOrderedBasis, CFUnit} from "./types";
import {setsEqual} from "./math_utils";

export function dimensionsEqual(U1: Set<CFUnit>, U2: Set<CFUnit>){
    if(U1.size !== U2.size) return false;
    for(const u of U1) {
        if(!U2.has(u)) return false;
    }
    return true;
}

/**
 * Checks a 'orderedDimensions' CFDimData against a CFBasis to see if all dimensions are present
 * in the basis. Returns a proper CFOrderedBasis if all checks pass, undefined otherwise.
 */
export function toOrderedBasisOnBasis(basis: CFBasis, orderedDimensions: Set<CFUnit>[]): CFOrderedBasis | undefined {
    const basisSets = basis.data;
    for(const dim of orderedDimensions) {
        let found = false;
        for(const basisSet of basisSets) {
            if(setsEqual(dim, basisSet)) {
                found = true;
                break;
            }
        }
        if (!found) return undefined;
    }

    return {
        basis,
        orderedBasis: orderedDimensions
    } as unknown as CFOrderedBasis;
}