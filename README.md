# complibjs

_A TypeScript/JavaScript implementation of the [Comparison Framework](https://github.com/androlo/comparison_framework) - a framework for processing measurement data._

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#concepts">Concepts</a> •
  <a href="#unit-function-storage-types">Storage Types</a> •
  <a href="#immutability--performance">Immutability & Performance</a> •
  <a href="#examples">Examples</a> •
  <a href="#faq">FAQ</a>
</p>


---

## Installation

Using a package manager:

```bash
npm install complibjs
# or
pnpm add complibjs
# or
yarn add complibjs
```

Or pull the repository directly if you prefer a local workspace setup.

---

## Usage

The best way to learn how the library works is by looking at the examples. They are very well documented, start simple, and cover most use cases.

## Concepts

### Object Orientation

The library uses idiomatic TypeScript OOP. Many concepts are expressed as classes and **generics** are used to keep types precise.

### Branded Types

Opaque types aren’t a native TS feature, so the library uses **brands** to encode intent at compile‑time:

- `CFUint32` is runtime‑`number` but _intended_ to be a 32‑bit unsigned safe integer.
- Callers enforce this by validation (e.g., `isUint32(x)`) or _explicit casts_ where appropriate.

This reduces runtime guards in the core and encourages callers to make intent explicit.

### Floating‑Point Numbers (`CFReal`)

Bare JS numbers are wrapped in the `CFReal` brand and operated on by `CFAlgebraReal`:

- All values must satisfy `Number.isFinite(x)`.
- Relations (equality, ≤, …) are **approximate** with configurable precision.
- Algebraic ops that yield invalid results (NaN, ±∞, undefined intervals) produce `undefined`.

### Value Types: Intervals (`CFIval`)

While the value algebra is generic, the reference implementation uses **intervals** for performance and clarity. Intervals and their algebra is defined in `CFValueAlgebraIval`.

### Unit Functions

Unit functions (including comparison functions) map `(...units, s)` to a **value**. They are composed into expression trees rather than eagerly evaluated. Algebraic nodes (e.g., `arith`, `tensor`) point to children and the operator, so a call to `.get(u, s)` computes a value on demand. When appropriate, `.materialize()` flattens a tree to a storage‑backed structure for faster repeated queries.

---

## Unit Function Storage Types

Basic unit function (leaf) types come in three flavors: **const**, **dense**, and **sparse**.

### `const`

- Has a **dimension**, `dim`, which is the number of unit arguments.  
- Returns the same value for all inputs, stored in its `value` field.

### `dense`

- Stores a linearized array `values: CFIval[]`.
- Each entry corresponds to a tuple `(u₀, u₁, …, u_{dim−1}, s)`.
- With `U` units and dimension `dim`, the index is:

  ```text
  index = s*U^dim + u0*U^(dim-1) + u1*U^(dim-2) + ... + u_{dim-2}*U + u_{dim-1}
  ```

### `sparse` (CSR + Bitset)

- Backed by a compact **bitset** and **row pointers**.
- For a tuple (excluding the last unit index):
  ```text
  idx = s*U^(dim-1) + u0*U^(dim-2) + ... + u_{dim-3}*U + u_{dim-2}
  row = idx * wordsPerRow
  wordsPerRow = ceil(U / 32)
  word = floor(u_{dim-1} / 32)
  bit  = u_{dim-1} % 32
  ```
- A bit value of **1** means a **non‑null** value is present in `values`; **0** means absent.  
  This invariant is preserved through all bitset transforms.
- `rowPtr[i + 1] - rowPtr[i]` equals the **rank(i)** (count of set bits up to row end).

---

## Expression Trees & Materialization

Operations create **nodes** rather than new tables. Example:

```ts
const ufSum = fu.add(fv);
// Later:
const v = ufSum.get(u, s); // computes fu.get(u, s) + fv.get(u, s)
```

When a subgraph is compact enough or repeatedly queried, call:

```ts
const flat = ufSum.materialize(); // produces a storage-backed UF (e.g., sparse)
```

`flat.get` becomes a direct lookup with no per‑call arithmetic.

---

## Immutability & Performance

All values (intervals) and unit functions are **immutable**.

- ✅ Safety & predictability.
- ⚠️ Overhead: more allocations and GC churn vs. in‑place mutation.

The overhead is considered acceptable for an educational library.

---

## Examples

Run examples directly from the repo root:

```bash
npx ts-node examples/e1_measuring_a_plank.ts
```

Browse the examples to see:
- Available functions and their signatures
- How to build and compose unit functions
- How branded types and algebras interact
- Practical applications of the Comparison Framework

---

## License

MIT. See `LICENSE.txt` file.
