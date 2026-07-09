/**
 * StoragePolicy v0 — the data-class × mode matrix (TECH-05).
 *
 * Resolution principles, in order:
 *   1. DEFAULT DENY — a class/mode pair nothing explicitly allows is denied.
 *   2. STRICTEST WINS — room policy, device risk, and ScreenShield level can
 *      only tighten the device-mode baseline, never loosen it.
 *   3. NO UNIMPLEMENTED PERSISTENCE — the encrypted persistent backend is a
 *      placeholder; policies may point at it (future intent), but the write
 *      barrier converts any actual use into a hard "not implemented" error.
 *
 * The matrix is deliberately explicit and boring: simple predicates over the
 * class groups in dataClasses.ts, no clever abstraction (docs/STORAGE_MODEL.md).
 */

import type { PrivacyMode } from "@freelayer/privacy";
import {
  AI_CACHE_CLASSES,
  CACHE_CLASSES,
  CONTENT_CLASSES,
  ENDPOINT_CLASSES,
  KEY_MATERIAL_CLASSES,
  SETTINGS_CLASSES,
  STORAGE_DATA_CLASSES,
  type StorageDataClass,
} from "./dataClasses";
import type { StorageBackendKind } from "./backends";
import type { StorageSensitivity } from "./operations";

export type DeviceRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
export type ScreenShieldLevel = "off" | "standard" | "protected" | "sealed" | "bunker";

export interface StoragePolicy {
  readonly mode: PrivacyMode;
  readonly dataClass: StorageDataClass;
  readonly backend: StorageBackendKind;
  readonly allowWrite: boolean;
  readonly allowRead: boolean;
  readonly allowDelete: boolean;
  readonly allowList: boolean;
  readonly allowExport: boolean;
  readonly allowCache: boolean;
  readonly allowDebugArtifacts: boolean;
  readonly plaintextAllowed: boolean;
  readonly persistentAllowed: boolean;
  readonly reason: string;
}

export interface StoragePolicyInput {
  readonly mode: PrivacyMode;
  readonly dataClass: StorageDataClass;
  readonly sensitivity: StorageSensitivity;
  /** Room policy may TIGHTEN only; loosening attempts are ignored. */
  readonly roomPolicy?: Partial<StoragePolicy>;
  readonly deviceRiskLevel?: DeviceRiskLevel;
  readonly screenShieldLevel?: ScreenShieldLevel;
}

const includes = (group: readonly StorageDataClass[], dataClass: StorageDataClass): boolean =>
  group.includes(dataClass);

/** Backends ordered strict → permissive; tightening may only move left. */
const BACKEND_STRICTNESS: readonly StorageBackendKind[] = [
  "null",
  "memory_only",
  "encrypted_persistent_placeholder",
];

function stricterBackend(a: StorageBackendKind, b: StorageBackendKind): StorageBackendKind {
  return BACKEND_STRICTNESS.indexOf(a) <= BACKEND_STRICTNESS.indexOf(b) ? a : b;
}

interface MutablePolicy {
  backend: StorageBackendKind;
  allowWrite: boolean;
  allowRead: boolean;
  allowDelete: boolean;
  allowList: boolean;
  allowExport: boolean;
  allowCache: boolean;
  allowDebugArtifacts: boolean;
  plaintextAllowed: boolean;
  persistentAllowed: boolean;
  reasons: string[];
}

function deny(p: MutablePolicy, reason: string): void {
  p.allowWrite = false;
  p.allowRead = false;
  p.allowCache = false;
  p.reasons.push(reason);
}

const KNOWN_MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

export function resolveStoragePolicy(input: StoragePolicyInput): StoragePolicy {
  const { mode, dataClass, sensitivity } = input;
  const risk: DeviceRiskLevel = input.deviceRiskLevel ?? "unknown";
  const shield: ScreenShieldLevel = input.screenShieldLevel ?? "off";

  // FAIL CLOSED (TECH-07): an unknown data class or unknown mode — reachable
  // at runtime only via unsound casts or future drift — resolves to a full
  // deny on the null backend, never to an accidental allowance.
  if (!STORAGE_DATA_CLASSES.includes(dataClass) || !KNOWN_MODES.includes(mode)) {
    return {
      mode,
      dataClass,
      backend: "null",
      allowWrite: false,
      allowRead: false,
      allowDelete: false,
      allowList: false,
      allowExport: false,
      allowCache: false,
      allowDebugArtifacts: false,
      plaintextAllowed: false,
      persistentAllowed: false,
      reason: "unknown data class or mode: fail closed (deny everything)",
    };
  }

  // ---- Start from DEFAULT DENY. Every allowance below is explicit. ----
  const p: MutablePolicy = {
    backend: "null",
    allowWrite: false,
    allowRead: false,
    allowDelete: true, // deleting data is the one operation privacy favors
    allowList: false,
    allowExport: false,
    allowCache: false,
    allowDebugArtifacts: false, // denied everywhere in v0
    plaintextAllowed: false,
    persistentAllowed: false,
    reasons: ["default deny"],
  };

  // ---- Mode baselines ----
  switch (mode) {
    case "emergency":
      // Null backend; no normal writes/reads. Delete stays possible (wipe direction).
      p.backend = "null";
      p.reasons.push("emergency: null backend, wipe-oriented");
      break;

    case "ghost":
    case "bunker": {
      // Memory-only for necessary active state; nothing persistent, ever.
      p.backend = "memory_only";
      p.persistentAllowed = false;
      const strict = mode === "bunker";
      if (includes(KEY_MATERIAL_CLASSES, dataClass)) {
        p.reasons.push(`${mode}: key material requires reviewed encryption (none exists)`);
      } else if (includes(AI_CACHE_CLASSES, dataClass)) {
        p.reasons.push(`${mode}: AI caches denied (ADR-0007)`);
      } else if (dataClass === "preview_cache" || dataClass === "thumbnail_cache") {
        p.reasons.push(`${mode}: preview/thumbnail caches denied`);
      } else if (strict && includes(CACHE_CLASSES, dataClass)) {
        p.reasons.push("bunker: cache writes denied");
      } else if (dataClass === "debug_artifact") {
        p.reasons.push(`${mode}: debug artifacts denied`);
      } else if (dataClass === "protected_content_reveal_state" && strict) {
        p.reasons.push("bunker: reveal history denied");
      } else {
        p.allowWrite = true;
        p.allowRead = true;
        p.allowList = true;
        p.allowCache = !strict && dataClass === "cache" && false; // caches stay denied in v0
        p.plaintextAllowed = true; // memory only; not persisted
        p.reasons.push(`${mode}: memory-only active state`);
      }
      break;
    }

    case "standard":
    case "private":
    case "offline_capsule":
    case "sovereign_room": {
      // sovereign_room baseline == private-strictness; room policy composes below.
      const privateish = mode !== "standard";
      if (includes(KEY_MATERIAL_CLASSES, dataClass)) {
        // Keys are never storable until the encrypted backend exists and is
        // reviewed. Not in memory either — key handling needs Gate F review.
        p.backend = "encrypted_persistent_placeholder";
        p.reasons.push("key material requires encrypted storage (not implemented, Gate F)");
      } else if (includes(AI_CACHE_CLASSES, dataClass)) {
        p.reasons.push("AI caches require AIPolicy (Gate I); denied in v0");
      } else if (includes(CONTENT_CLASSES, dataClass)) {
        if (mode === "standard") {
          // Standard intends encrypted persistence for content — which does
          // not exist. Policy points at the placeholder; writes fail hard at
          // the barrier until Gate F. (Tests use private/offline for memory.)
          p.backend = "encrypted_persistent_placeholder";
          p.allowWrite = true;
          p.allowRead = true;
          p.allowList = true;
          p.allowExport = dataClass === "bundle_export";
          p.persistentAllowed = false; // nothing implemented may persist
          p.reasons.push("standard: content targets future encrypted backend (not implemented)");
        } else {
          p.backend = "memory_only";
          p.allowWrite = true;
          p.allowRead = true;
          p.allowList = true;
          p.allowExport = dataClass === "bundle_export";
          p.plaintextAllowed = true; // memory only
          p.reasons.push(`${mode}: content memory-only in current implementation`);
        }
      } else if (includes(SETTINGS_CLASSES, dataClass)) {
        p.backend = "memory_only";
        p.allowWrite = true;
        p.allowRead = true;
        p.allowList = true;
        p.plaintextAllowed = true;
        p.reasons.push("settings: memory-only now, encrypted persistent later");
      } else if (includes(CACHE_CLASSES, dataClass)) {
        const previewish = dataClass === "preview_cache" || dataClass === "thumbnail_cache";
        if (privateish && previewish) {
          p.reasons.push(`${mode}: preview/thumbnail caches denied by default`);
        } else {
          p.backend = "memory_only";
          p.allowWrite = true;
          p.allowRead = true;
          p.allowCache = true;
          p.plaintextAllowed = true;
          p.reasons.push(`${mode}: cache memory-only`);
        }
      } else if (includes(ENDPOINT_CLASSES, dataClass)) {
        p.backend = "memory_only";
        p.allowWrite = true;
        p.allowRead = true;
        p.allowList = true;
        p.plaintextAllowed = sensitivity !== "content" && sensitivity !== "key_material";
        p.reasons.push(`${mode}: endpoint state memory-only`);
      } else if (dataClass === "logs") {
        // Logs may exist in memory, but never with sensitive payloads — the
        // barrier enforces the sensitivity side of this.
        p.backend = "memory_only";
        p.allowWrite =
          sensitivity === "metadata" ||
          sensitivity === "sensitive_metadata" ||
          sensitivity === "security_event" ||
          sensitivity === "public_project_metadata" ||
          sensitivity === "local_settings";
        p.allowRead = p.allowWrite;
        p.reasons.push("logs: memory-only, non-content sensitivities only");
      } else if (dataClass === "debug_artifact") {
        p.reasons.push("debug artifacts denied in v0");
      }
      break;
    }
  }

  // ---- ScreenShield tightening (ADR-0012 hooks): sealed/bunker levels deny
  //      derived visual caches and reveal history regardless of mode. ----
  if (shield === "sealed" || shield === "bunker") {
    if (includes(CACHE_CLASSES, dataClass) || includes(AI_CACHE_CLASSES, dataClass)) {
      deny(p, `screenshield ${shield}: cache/preview/thumbnail writes denied`);
    }
    if (dataClass === "protected_content_reveal_state") {
      deny(p, `screenshield ${shield}: reveal history denied`);
    }
    p.persistentAllowed = false;
  }

  // ---- Device risk tightening: high/critical deny reveal-state persistence
  //      and (critical) exports of protected material. ----
  if ((risk === "high" || risk === "critical") && dataClass === "protected_content_reveal_state") {
    deny(p, `device risk ${risk}: reveal state not stored`);
  }
  if (risk === "critical") {
    p.allowExport = false;
    p.reasons.push("device risk critical: exports denied");
  }

  // ---- Room policy composition: TIGHTEN ONLY. A room may deny what the
  //      device allows; it can never allow what the device denies. ----
  const room = input.roomPolicy;
  if (room !== undefined) {
    p.allowWrite = p.allowWrite && (room.allowWrite ?? true);
    p.allowRead = p.allowRead && (room.allowRead ?? true);
    p.allowDelete = p.allowDelete && (room.allowDelete ?? true);
    p.allowList = p.allowList && (room.allowList ?? true);
    p.allowExport = p.allowExport && (room.allowExport ?? true);
    p.allowCache = p.allowCache && (room.allowCache ?? true);
    p.allowDebugArtifacts = p.allowDebugArtifacts && (room.allowDebugArtifacts ?? true);
    p.plaintextAllowed = p.plaintextAllowed && (room.plaintextAllowed ?? true);
    p.persistentAllowed = p.persistentAllowed && (room.persistentAllowed ?? true);
    if (room.backend !== undefined) {
      p.backend = stricterBackend(room.backend, p.backend);
    }
    p.reasons.push("room policy composed (tighten-only)");
  }

  // ---- Final invariant: nothing may claim persistence in v0 — no
  //      implemented persistent backend exists. ----
  if (p.backend !== "encrypted_persistent_placeholder") {
    p.persistentAllowed = false;
  }

  return {
    mode,
    dataClass,
    backend: p.backend,
    allowWrite: p.allowWrite,
    allowRead: p.allowRead,
    allowDelete: p.allowDelete,
    allowList: p.allowList,
    allowExport: p.allowExport,
    allowCache: p.allowCache,
    allowDebugArtifacts: p.allowDebugArtifacts,
    plaintextAllowed: p.plaintextAllowed,
    persistentAllowed: p.persistentAllowed,
    reason: p.reasons.join("; "),
  };
}
