/**
 * Storage backend kinds and their honest capabilities (TECH-05).
 *
 * `encrypted_persistent_placeholder` exists ONLY so policy can express future
 * behavior — any attempt to use it throws. Real encrypted persistence is
 * blocked until crypto design review (ADR-0004, Gates C/F).
 */

export type StorageBackendKind = "encrypted_persistent_placeholder" | "memory_only" | "null";

export interface StorageBackendCapability {
  readonly kind: StorageBackendKind;
  readonly persistent: boolean;
  readonly encrypted: boolean;
  readonly implemented: boolean;
  readonly description: string;
}

/**
 * Honest capability table. Memory-only is NOT forensic protection: the OS may
 * swap process memory to disk, and nothing here claims otherwise
 * (docs/STORAGE_MODEL.md — honest destruction limits).
 */
export const STORAGE_BACKEND_CAPABILITIES: Readonly<
  Record<StorageBackendKind, StorageBackendCapability>
> = {
  encrypted_persistent_placeholder: {
    kind: "encrypted_persistent_placeholder",
    persistent: true,
    encrypted: false, // intended true; NOT implemented, so claimed false
    implemented: false,
    description:
      "Future encrypted-at-rest backend. Not implemented; every use throws. Blocked by crypto review (Gate F).",
  },
  memory_only: {
    kind: "memory_only",
    persistent: false,
    encrypted: false,
    implemented: true,
    description:
      "Process-memory storage. Gone at exit; no application-layer disk writes. Not a forensic guarantee — the OS may swap memory.",
  },
  null: {
    kind: "null",
    persistent: false,
    encrypted: false,
    implemented: true,
    description: "Accepts policy-approved writes and stores nothing; reads return empty.",
  },
} as const;
