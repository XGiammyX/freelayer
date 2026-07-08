/**
 * Value cloning at provider boundaries (TECH-06).
 *
 * JavaScript stores objects by reference: without cloning, a caller mutating
 * an object after write (or after read) would silently mutate provider state.
 * `structuredClone` deep-copies data; values it cannot handle (functions, DOM
 * nodes, symbols, and anything throwing DataCloneError) are REJECTED rather
 * than stored by reference — a reference leak is worse than a failed write.
 *
 * Documented limitations: property descriptors/getters are dropped and class
 * instances round-trip as plain data (structured-clone semantics); cloning
 * protects against accidental aliasing, not against a compromised process
 * reading memory, and nothing here prevents OS swap.
 */

import { UnsupportedStorageValueError } from "./errors";

export function cloneStorageValue(value: unknown): unknown {
  if (typeof value === "function" || typeof value === "symbol") {
    throw new UnsupportedStorageValueError();
  }
  try {
    return structuredClone(value);
  } catch {
    throw new UnsupportedStorageValueError();
  }
}
