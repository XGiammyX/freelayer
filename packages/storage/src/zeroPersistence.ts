/**
 * Zero-persistence assertion layer (TECH-07).
 *
 * Turns "Ghost/Bunker write nothing persistent" into callable, testable
 * invariants. Everything here FAILS CLOSED: unknown backends count as
 * persistent, and assertions throw redacted errors.
 *
 * Honest scope: application-level invariants — not forensic guarantees
 * (docs/research/ZERO_PERSISTENCE_RESEARCH.md).
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { StorageBackendKind } from "./backends";
import type { StorageDataClass } from "./dataClasses";
import type { StoragePolicy } from "./policy";
import { ForbiddenPersistentWriteError, StorageBypassAttemptError } from "./errors";

/**
 * Modes in which FreeLayer code must perform no persistent writes.
 * Emergency counts for NORMAL writes — delete/clear remain possible as the
 * wipe direction (docs/STORAGE_MODEL.md).
 */
export function isZeroPersistenceMode(mode: PrivacyMode): boolean {
  return mode === "ghost" || mode === "bunker" || mode === "emergency";
}

/** Guard for strict-mode-only code paths: throws if the mode is not zero-persistence. */
export function assertZeroPersistentWriteMode(mode: PrivacyMode): void {
  if (!isZeroPersistenceMode(mode)) {
    throw new StorageBypassAttemptError(
      `mode "${mode}" is not a zero-persistence mode; strict-mode path invoked incorrectly`,
    );
  }
}

/**
 * Single source of truth for "is this backend persistent?".
 * FAILS CLOSED: any backend kind this function does not recognize is treated
 * as persistent (and therefore denied in strict modes).
 */
export function isPersistentBackend(kind: StorageBackendKind): boolean {
  switch (kind) {
    case "memory_only":
    case "null":
      return false;
    case "encrypted_persistent_placeholder":
      return true;
    default: {
      // Unknown/future backend reached at runtime via unsound casts: deny.
      return true;
    }
  }
}

/** Throws if the resolved policy selected a persistent backend or permits persistence. */
export function assertNoPersistentBackendSelected(policy: StoragePolicy): void {
  if (isPersistentBackend(policy.backend)) {
    throw new ForbiddenPersistentWriteError({
      operation: "storage.write",
      dataClass: policy.dataClass,
      detail: `persistent backend "${policy.backend}" selected where none is allowed`,
    });
  }
  if (policy.persistentAllowed) {
    throw new ForbiddenPersistentWriteError({
      operation: "storage.write",
      dataClass: policy.dataClass,
      detail: "policy permits persistence where none is allowed",
    });
  }
}

/**
 * Combined strict-mode invariant: in a zero-persistence mode, the resolved
 * policy and the acting backend must both be non-persistent and coherent.
 */
export function assertNoPersistentWriteAllowed(input: {
  readonly mode: PrivacyMode;
  readonly dataClass: StorageDataClass;
  readonly policy: StoragePolicy;
  readonly backend: StorageBackendKind;
}): void {
  if (!isZeroPersistenceMode(input.mode)) {
    return; // invariant applies to strict modes only
  }
  assertNoPersistentBackendSelected(input.policy);
  if (isPersistentBackend(input.backend)) {
    throw new ForbiddenPersistentWriteError({
      operation: "storage.write",
      dataClass: input.dataClass,
      detail: `persistent backend "${input.backend}" cannot act in mode "${input.mode}"`,
    });
  }
  if (input.policy.backend !== input.backend) {
    throw new StorageBypassAttemptError(
      `policy backend "${input.policy.backend}" does not match acting backend "${input.backend}"`,
    );
  }
}
