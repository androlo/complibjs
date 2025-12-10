import {CFDim, CFUint32, CFUnit} from "./types";

/**
 * Iterator (generator) that can be used to iterate over all possible
 * combinations of `dim` units, each ranging from `0` to `U-1`. E.g.,
 * for `dim=3` and `U=2`, we get (0, 0, 0), (0, 0, 1), (0, 1, 0), ...
 * 
 * The iteration order is right first with carry. Also, a linear index
 * is yielded alongside each combination, corresponding to the
 * row-major order of the combinations. E.g., for `dim=3` and `U=2`:
 * (0, 0, 0) -> 0, (0, 0, 1) -> 1, (0, 1, 0) -> 2, ...
 * 
 * NOTE: the yielded unit array is mutable to avoid per-yield allocation.
 * Consumers must treat the yielded array as read-only, or it will lead 
 * to undefined behavior.
 */
export function* getUnitIterator(
    dim: CFDim,
    U: CFUint32
): IterableIterator<{ units: readonly CFUnit[]; lIdx: CFUint32 }> {
    if (dim <= 0 || U <= 0) return;

    const units = new Array<CFUnit>(dim).fill(0 as CFUnit);
    let lIdx = 0 as CFUint32;

    while (true) {
        // Yield current combination and its row-major linear index.
        yield { units, lIdx };

        // Odometer-style increment with carry from the rightmost position.
        let p = dim - 1;
        while (p >= 0) {
            units[p] = (units[p] + 1) as CFUnit;
            if (units[p] < U) break;       // no carry needed
            units[p] = 0 as CFUnit;        // reset and carry left
            p--;
        }
        if (p < 0) break;                // overflowed past leftmost -> done

        lIdx = (lIdx + 1) as CFUint32;   // next linear index
    }
}
