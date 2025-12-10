// value.ts

import {CFInt32, CFReal, CFUint32} from "./types";

// Allows a CFValueAlgebra to write values into a byte array.
export interface CFValueByteWriter<V> {
    write(val: V, pos: CFUint32): CFUint32; // Returns the number of bytes written.
    writeUnsafe(val: V, pos: CFUint32): void; // No bounds check.
}

/**
 * Generic value algebra interface.
 */
export interface CFValueAlgebra<V, N extends V = V, O extends V = V> {
    /** Human-readable type name, e.g. "Ival", "Real" */
    readonly typeName: string;

    /** Serialized size in bytes. */
    readonly sizeInBytes: (val: V) => CFUint32;

    // Creation / identity
    isValue(x: unknown): x is V;
    isValid(x: V): x is V;
    isNull(x: V): x is N;
    isOne(x: V): x is O;
    null(): N;
    one(): O;

    // Abs
    abs(x: V): V;

    dist(x: V, y: V): CFReal | undefined;

    // Equality
    eq(x: V, y: V): boolean;

    // Algebraic ops
    add(x: V, y: V): V;
    sub(x: V, y: V): V;
    // NULL - x.
    neg(x: V): V;
    mul(x: V, y: V): V;
    div(x: V, y: V): V;
    inv(x: V): V;
    smulLeft(x: CFReal, v: V): V;
    smulRight(v: V, x: CFReal): V;
    powInt(v: V, n: CFInt32): V;
    pow(v: V, e: CFReal): V;
    nthRoot(v: V, n: CFUint32): V;

    // Serialization
    fromBytes(bytes: Uint8Array): V | undefined;

    bytesWriter(bytes: Uint8Array): CFValueByteWriter<V>;

    // String rendering
    print(val: V): string;
}
