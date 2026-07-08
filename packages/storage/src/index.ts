/**
 * @freelayer/storage — storage policy engine scaffolding (write barrier).
 *
 * Every write API in this package requires a PolicyDecision — this is the
 * write barrier from docs/STORAGE_MODEL.md, locked by ADR-0005. Calls without
 * a valid decision throw PolicyBypassError. This catches accidental bypass;
 * mechanical (compile-time) enforcement is tracked at Gate A/B.
 *
 * Forbidden here and everywhere (see docs/STORAGE_MODEL.md write barrier):
 * direct use of browser-local storage APIs, browser databases, page caches,
 * service-worker caches, SQLite, or the filesystem. The only providers in
 * Prompt 03 are memory-only and null. Encrypted persistence arrives after
 * crypto review (Gates C/F).
 */

import { isPolicyDecision, type PolicyDecision, type PolicyCapability } from "@freelayer/privacy";
import { ForbiddenSideEffectError, PolicyBypassError } from "@freelayer/security";

export type StorageBackendKind = "encrypted_persistent" | "memory_only" | "null";

/** Data classes from docs/STORAGE_MODEL.md — every write belongs to exactly one. */
export const STORAGE_DATA_CLASSES = [
  "identity_key_material",
  "room_operation_log",
  "materialized_room_state",
  "document_content",
  "file_blob",
  "capsule_spool",
  "cache",
  "ai_derived_cache",
  "settings",
  "logs",
  "debug_artifact",
] as const;

export type StorageDataClass = (typeof STORAGE_DATA_CLASSES)[number];

export interface StorageWriteRequest {
  readonly dataClass: StorageDataClass;
  readonly key: string;
  readonly value: Uint8Array;
}

export interface StorageReadRequest {
  readonly dataClass: StorageDataClass;
  readonly key: string;
}

/** All operations require a PolicyDecision issued by core (ADR-0002/0005). */
export interface StorageProvider {
  readonly backendKind: StorageBackendKind;
  write(request: StorageWriteRequest, decision: PolicyDecision): Promise<void>;
  read(request: StorageReadRequest, decision: PolicyDecision): Promise<Uint8Array | null>;
  wipeAll(decision: PolicyDecision): Promise<void>;
}

/** Reject calls that lack a valid, allowing decision for the right capability. */
function requireDecision(decision: PolicyDecision, capability: PolicyCapability): void {
  if (!isPolicyDecision(decision)) {
    throw new PolicyBypassError(
      "Storage call without a valid PolicyDecision. Side effects must go through core (ADR-0002).",
    );
  }
  if (decision.capability !== capability) {
    throw new PolicyBypassError(
      `Storage call carried a decision for capability "${decision.capability}", expected "${capability}".`,
    );
  }
  if (decision.verdict !== "allowed") {
    throw new ForbiddenSideEffectError("Active policy denies this storage operation.");
  }
}

/** In-memory provider. State lives only in this instance; nothing survives recreation. */
export class MemoryStorageProvider implements StorageProvider {
  readonly backendKind: StorageBackendKind = "memory_only";
  private readonly entries = new Map<string, Uint8Array>();

  private static keyOf(dataClass: StorageDataClass, key: string): string {
    return `${dataClass}/${key}`;
  }

  // Methods are async so policy-guard failures surface as rejections — the
  // contract a Promise-returning API promises — never as synchronous throws.
  async write(request: StorageWriteRequest, decision: PolicyDecision): Promise<void> {
    requireDecision(decision, "persistence");
    this.entries.set(MemoryStorageProvider.keyOf(request.dataClass, request.key), request.value);
  }

  async read(request: StorageReadRequest, decision: PolicyDecision): Promise<Uint8Array | null> {
    requireDecision(decision, "persistence");
    const value = this.entries.get(MemoryStorageProvider.keyOf(request.dataClass, request.key));
    return value ?? null;
  }

  async wipeAll(decision: PolicyDecision): Promise<void> {
    requireDecision(decision, "persistence");
    this.entries.clear();
  }
}

/** Null provider: accepts (policy-approved) writes, stores nothing, reads return null. */
export class NullStorageProvider implements StorageProvider {
  readonly backendKind: StorageBackendKind = "null";

  async write(_request: StorageWriteRequest, decision: PolicyDecision): Promise<void> {
    requireDecision(decision, "persistence");
  }

  async read(_request: StorageReadRequest, decision: PolicyDecision): Promise<Uint8Array | null> {
    requireDecision(decision, "persistence");
    return null;
  }

  async wipeAll(decision: PolicyDecision): Promise<void> {
    requireDecision(decision, "persistence");
  }
}
