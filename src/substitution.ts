import {CFReal, CFSeriesIndex, CFFuncSparse, CFDimSparse} from "./types";
import {bitsetEquals, bitsetEquals_s, jaccard, jaccard_s} from "./bit_utils";

export function substitutable<Dim extends CFDimSparse>(
    fu: CFFuncSparse<Dim>,
    fv: CFFuncSparse<Dim>,
    s?: CFSeriesIndex
): boolean {
    if(s !== undefined) {
        return bitsetEquals_s(fu, fv, s);
    }
    else {
        return bitsetEquals(fu, fv);
    }
}

export function degSub<Dim extends CFDimSparse>(
    fu: CFFuncSparse<Dim>,
    fv: CFFuncSparse<Dim>,
    s?: CFSeriesIndex
): CFReal | undefined {
    if(s !== undefined) {
        return jaccard_s(fu, fv, s);
    }
    else {
        return jaccard(fu, fv);
    }
}