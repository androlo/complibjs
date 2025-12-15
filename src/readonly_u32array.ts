// 1) Mutators
type MutableUint32Methods = "set" | "fill" | "copyWithin" | "reverse" | "sort";

// 2) Props
type HiddenProps = "buffer" | "subarray" | "slice" | "map" | "filter" | "toSorted" | "toReversed" | "with";

export type ReadonlyUint32Array =
    & Omit<Uint32Array, MutableUint32Methods | HiddenProps /* | "byteOffset" | "byteLength" */>
    & {
    // prevent writes like ro[i] = 1
    readonly [n: number]: number;

    // keep operations closed over the readonly type
    subarray(begin?: number, end?: number): ReadonlyUint32Array;
    slice(start?: number, end?: number): ReadonlyUint32Array;

    map(
        callbackfn: (value: number, index: number, array: ReadonlyUint32Array) => number,
        thisArg?: any
    ): ReadonlyUint32Array;

    filter(
        callbackfn: (value: number, index: number, array: ReadonlyUint32Array) => boolean,
        thisArg?: any
    ): ReadonlyUint32Array;

    // ES2023+ non-mutating methods available on typed arrays
    toSorted(compareFn?: (a: number, b: number) => number): ReadonlyUint32Array;
    toReversed(): ReadonlyUint32Array;
    with(index: number, value: number): ReadonlyUint32Array;

    // make callbacks see the readonly array
    forEach(
        callbackfn: (value: number, index: number, array: ReadonlyUint32Array) => void,
        thisArg?: any
    ): void;
    every(
        callbackfn: (value: number, index: number, array: ReadonlyUint32Array) => boolean,
        thisArg?: any
    ): boolean;
    some(
        callbackfn: (value: number, index: number, array: ReadonlyUint32Array) => boolean,
        thisArg?: any
    ): boolean;
    reduce(
        callbackfn: (
            prev: number,
            curr: number,
            index: number,
            array: ReadonlyUint32Array
        ) => number,
        initialValue?: number
    ): number;
    reduceRight(
        callbackfn: (
            prev: number,
            curr: number,
            index: number,
            array: ReadonlyUint32Array
        ) => number,
        initialValue?: number
    ): number;
};

// Optional helper to get the type without runtime cost:
export const asReadonly = (view: Uint32Array) =>
    view as unknown as ReadonlyUint32Array;