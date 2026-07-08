/**
 * Storage operation results (TECH-06). Explicit result objects instead of
 * bare values, so callers always know which backend acted and list output is
 * structurally metadata-only.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { StorageBackendKind } from "./backends";
import type { StorageDataClass } from "./dataClasses";
import type { StorageSensitivity } from "./operations";

export interface StorageWriteResult {
  readonly ok: true;
  readonly backend: StorageBackendKind;
  readonly dataClass: StorageDataClass;
}

export interface StorageReadResult {
  readonly ok: true;
  readonly backend: StorageBackendKind;
  readonly dataClass: StorageDataClass;
  readonly found: boolean;
  readonly value?: unknown;
}

export interface StorageDeleteResult {
  readonly ok: true;
  readonly backend: StorageBackendKind;
  readonly dataClass: StorageDataClass;
}

export interface StorageClearResult {
  readonly ok: true;
  readonly backend: StorageBackendKind;
}

/**
 * List entries are METADATA ONLY — never stored values. Timestamps are
 * local wall-clock strings ("AtLocal"): ordering hints, not trusted time.
 */
export interface StorageListEntry {
  readonly key: string;
  readonly dataClass: StorageDataClass;
  readonly sensitivity: StorageSensitivity;
  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
  readonly policyMode: PrivacyMode;
}

export interface StorageListResult {
  readonly ok: true;
  readonly backend: StorageBackendKind;
  readonly entries: readonly StorageListEntry[];
}
