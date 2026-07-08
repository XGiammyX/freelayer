/**
 * Storage operation kinds, sensitivity levels, and request shapes (TECH-05).
 *
 * Sensitivity rules (docs/STORAGE_MODEL.md):
 * - message/document/file content        → "content"
 * - AI/cache/thumbnail/preview artifacts → "derived_content"
 * - keys and trust roots                 → "key_material"
 * - logs and audit events                → "security_event" or "sensitive_metadata"
 * - screen-capture events                → "sensitive_metadata" / "security_event"
 * - protected reveal state               → "sensitive_metadata"
 */

import type { StorageDataClass } from "./dataClasses";

export type StorageOperationKind =
  | "storage.write"
  | "storage.read"
  | "storage.delete"
  | "storage.list"
  | "storage.clear"
  | "storage.export"
  | "storage.import"
  | "storage.cache.write"
  | "storage.cache.read"
  | "storage.audit.write";

export type StorageSensitivity =
  | "public_project_metadata"
  | "local_settings"
  | "metadata"
  | "sensitive_metadata"
  | "content"
  | "derived_content"
  | "key_material"
  | "security_event";

/** Sensitivities whose plaintext must never reach a persistent backend. */
export const PLAINTEXT_RESTRICTED_SENSITIVITIES: readonly StorageSensitivity[] = [
  "content",
  "derived_content",
  "key_material",
];

export interface StorageWriteRequest {
  readonly operation: "storage.write" | "storage.cache.write" | "storage.audit.write";
  readonly dataClass: StorageDataClass;
  readonly key: string;
  readonly value: unknown;
  readonly sensitivity: StorageSensitivity;
  /** Human-readable, NON-SENSITIVE justification for audit purposes. */
  readonly reason: string;
}

export interface StorageReadRequest {
  readonly operation: "storage.read" | "storage.cache.read";
  readonly dataClass: StorageDataClass;
  readonly key: string;
  readonly reason: string;
}

export interface StorageDeleteRequest {
  readonly operation: "storage.delete";
  readonly dataClass: StorageDataClass;
  readonly key: string;
  readonly reason: string;
}

export interface StorageListRequest {
  readonly operation: "storage.list";
  readonly dataClass: StorageDataClass;
  readonly reason: string;
}

export interface StorageClearRequest {
  readonly operation: "storage.clear";
  /** Omitted = clear everything this provider holds. */
  readonly dataClass?: StorageDataClass;
  readonly reason: string;
}
