/**
 * Storage error taxonomy (TECH-05).
 *
 * REDACTION RULE: no error constructed here may ever contain a stored VALUE,
 * a key's content, or any request payload — only operation names, data
 * classes, modes, and policy reasons. This is enforced by construction:
 * factories accept only those fields (tests/security-regression/storage).
 */

import type { StorageDataClass } from "./dataClasses";
import type { StorageOperationKind } from "./operations";

interface StorageErrorContext {
  readonly operation: StorageOperationKind;
  readonly dataClass: StorageDataClass;
  readonly detail: string;
}

function describe(ctx: StorageErrorContext): string {
  return `${ctx.operation} on "${ctx.dataClass}" rejected: ${ctx.detail}`;
}

/** The resolved StoragePolicy denies this operation. */
export class StoragePolicyDeniedError extends Error {
  override readonly name = "StoragePolicyDeniedError";
  constructor(ctx: StorageErrorContext) {
    super(describe(ctx));
  }
}

/** The policy targets a backend that does not exist yet. */
export class StorageBackendNotImplementedError extends Error {
  override readonly name = "StorageBackendNotImplementedError";
  constructor() {
    super(
      "Encrypted persistent storage is not implemented yet. See docs/STORAGE_MODEL.md and docs/CRYPTO_DESIGN.md.",
    );
  }
}

/** The call tried to skip the barrier: missing/invalid/mismatched decision or backend. */
export class StorageBypassAttemptError extends Error {
  override readonly name = "StorageBypassAttemptError";
  constructor(detail: string) {
    super(`Storage bypass attempt rejected: ${detail}`);
  }
}

/** A persistent write was attempted where persistence is not allowed. */
export class ForbiddenPersistentWriteError extends Error {
  override readonly name = "ForbiddenPersistentWriteError";
  constructor(ctx: StorageErrorContext) {
    super(describe(ctx));
  }
}

/** A cache write was attempted where caching is denied. */
export class ForbiddenCacheWriteError extends Error {
  override readonly name = "ForbiddenCacheWriteError";
  constructor(ctx: StorageErrorContext) {
    super(describe(ctx));
  }
}

/** A debug/log artifact write violated the no-sensitive-artifacts rule. */
export class ForbiddenDebugArtifactError extends Error {
  override readonly name = "ForbiddenDebugArtifactError";
  constructor(ctx: StorageErrorContext) {
    super(describe(ctx));
  }
}

/** The storage key failed validation. Deliberately generic — never echoes the key. */
export class InvalidStorageKeyError extends Error {
  override readonly name = "InvalidStorageKeyError";
  constructor() {
    super("Invalid storage key.");
  }
}

/** The PolicyDecision exists but was issued for a different capability/side effect. */
export class StorageDecisionMismatchError extends Error {
  override readonly name = "StorageDecisionMismatchError";
  constructor(detail: string) {
    super(`Storage decision mismatch: ${detail}`);
  }
}

/** The value cannot be safely cloned; storing it by reference would leak. */
export class UnsupportedStorageValueError extends Error {
  override readonly name = "UnsupportedStorageValueError";
  constructor() {
    super("Unsupported storage value type.");
  }
}

/** Raised by leak-detection tooling when a sensitive value reaches an output channel. */
export class StorageSensitiveValueLeakError extends Error {
  override readonly name = "StorageSensitiveValueLeakError";
  constructor(channel: string) {
    super(`Sensitive value detected in ${channel}. This is a privacy bug.`);
  }
}
