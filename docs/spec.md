# complibjs specification

## Types

Types are generally found in `types.ts`. Brands are generally of the form
```declare const XXXBrand: unique symbol;```

and appear in types as
```type XXX = SomeType & { readonly [XXXBrand]: "XXX" };```

### Numbers

#### CFUint32 (Brand)

```type CFUint32 = number & { readonly [CFUint32Brand]: "CFUint32" };```

Assumed to be a 32 bit unsigned integer. Checked using:
```function isUint32(n: number): n is CFUint32```

Safe constructor:
```function toUint32(n: number): CFUint32 | null```

Returns `null` on failure.

##### Constants

11 constants: `CFUint32Zero` (0) to `CFUint32Ten` (10), e.g.,
```type CFUint32One = 1 & { readonly [CFUint32Brand]: "CFUint32" };```

##### Derived Types

`CFDimSparse` is a union of `CFUint32One` to `CFUint32Ten`.

`CFDim` is a union of `CFUint32Zero` and `CFDimSparse`.

##### Aliases

`CFUnit` and `CFSeriesIndex`.

#### CFInt32 (Brand)

```type CFInt32 = number & { readonly [CFInt32Brand]: "CFInt32" };```

Assumed to be a 32 bit signed integer. Checked using:
```function isInt32(n: number): n is CFInt32```

Safe constructor:
```function toInt32(n: number): CFInt32 | null```

Returns `null` on failure.

##### Constants

11 constants: `CFInt32Zero` (0) to `CFUInt32Ten` (10), e.g.,
```type CFInt32One = 1 & { readonly [CFInt32Brand]: "CFInt32" };```

#### CFReal (Brand)

```type CFReal = number & { readonly [CFRealBrand]: "CFReal" };```

Assumed to be a finite double (passes `Number.isFinite`).

The `CFReal` type is designed to be used with `class CFAlgebraReal`. See docs in numbers section.

##### Constants

`CFRealZero` (0) and `CFRealOne` (1).

#### CFBit (Brand)

```type CFBit = (0 | 1) & { readonly [CFBitBrand]: "CFBit" };```

Assumed to be 0 or 1. Checked using:
```function isBit(n: number): n is CFBit```

Safe constructor:
```function toBit(n: number): CFBit | null```

### Intervals

```type CFIval = readonly [lo: CFReal, hi: CFReal];```

Fixed-size two-element array of doubles.

The `CFIval` type is designed to be used with `class CFValueAlgebraIval`. See docs in numbers section.

### Comparisons

#### CFComparison (Brand)

```
type CFComparison = readonly [u: CFUnit, v: CFUnit, s: CFSeriesIndex, value: CFIval] &
    { readonly [CFComparisonBrand]: "CFComparison" };
```

2-dimensional comparison.

#### CFComparisonN (Brand)

```
type CFComparisonN = readonly [...units: readonly CFUnit[], s: CFSeriesIndex, value: CFIval] &
    { readonly [CFComparisonNBrand]: "CFComparisonN" };
```

n-dimensional comparison.

#### CFCompData

```type CFCompData = readonly [u: number, v: number, s: number, value: readonly [number, number]];```

Format for 2-dimensional comparison function in-data. Is converted to `CFComparison` after checks.

#### CFCompDataN

```type CFCompDataN =readonly [...idx: readonly number[], value: readonly [number, number]];```

Format for n-dimensional comparison function in-data. Is converted to `CFComparisonN` after checks.

### Arrays

#### ReadonlyUint32Array

Readonly version of [Uint32Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array).

#### CFValidCompDataSet (Brand)

```type CFValidCompDataSet = [CFComparison, ...CFComparison[]];```

Array of valid 2-dimensional comparison data. Converted to `CFValidCompDataSet` after validation (see below).

Has at least one element.

Checker:
```
function validateBinaryCompData(
    arr: CFCompData[],
    numUnits: CFUint32,
    numSeriesIndices: CFUint32
): arr is CFValidCompDataSet
```

##### Rules

- The number of elements is greater than `0`.
- The number of different units found as `u` or `v` in all `CFCompData` is `numUnits`.
- Every unit in `U = {0, 1, 2, ..., numUnits - 1}` is found as either `u` or `v` in at least one `CFCompData`.
- The number of different series indices found as `s` in all `CFCompData` is `numSeriesIndices`.
- Every series index in `S = {0, 1, 2, ..., numSeriesIndices - 1}` is found as `s` in at least one `CFCompData`.
- Any combination `(u, v, s)`, for `u, v in U` and `s in S` is found in at most one `CFCompData` (no key duplicates).
- Every value `[x, y]` is of the interval type, satisfying `[x, y] != [0, 0]`, and `x <= y`.

#### CFValidCompDataSetN (Brand)

```type CFValidCompDataSetN = [CFComparisonN, ...CFComparisonN[]];```

Array of valid n-dimensional comparison data. Converted to `CFValidCompDataSet` after validation (see below).

Has at least one element.

Checker:
```
export function createNAryCompFunc<Dim extends CFDimSparse>(
    arr: CFCompDataN[] | CFCompData[],
    dim: Dim,
    numUnits: CFUint32,
    numSeriesIndices: CFUint32
): CFCompFuncNAry<Dim>
```

##### Rules

- The number of elements is greater than `0`.
- The number of different units found in any unit slot in all `CFCompDataN` is `numUnits`.
- Every unit in `U = {0, 1, 2, ..., numUnits - 1}` is found in a unit slot of at least one `CFCompData`.
- The number of different series indices found as `s` in all `CFCompData` is `numSeriesIndices`.
- Every series index in `S = {0, 1, 2, ..., numSeriesIndices - 1}` is found as `s` in at least one `CFCompData`.
- Any combination `(u_0, u_1, ..., u_{n - 1}, s)`, for `u_0, u_1, ..., u_{n - 1} in U` and `s in S` is found in at most one `CFCompData` (no key duplicates).
- Every value `[x, y]` is of the interval type, satisfying `[x, y] != [0, 0]`, and `x <= y`.

#### CFDimData

```type CFDimData = readonly ReadonlySet<CFUnit>[];```

An array of sets of units.

### Basic Structs

#### CFBasis (Brand)

```
type CFBasis = {
    readonly cf: CFCompFuncBinary,
    readonly data: CFDimData
}  & { readonly [CFBasisBrand]: "CFBasis" };
```

Struct used to store the basis of a comparison function as `CFDimData`, and a reference to the comparison function itself (see below for info on the `CFCompFuncBinary` type).

#### CFOrderedBasis (Brand)

```
export type CFOrderedBasis = {
    readonly basis: CFBasis,
    readonly orderedBasis: CFDimData;
} & { readonly [CFOrderedBasisBrand]: "CFOrderedBasis" };
```

Struct used to store an ordered basis built from the basis of a comparison function. Keeps a reference to the basis as a `CFBasis`.

If `V` is an element of `orderedBasis`, then `V` is also an element of `basis.data`.

## Comparison Functions

TODO