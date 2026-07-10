/**
 * Metadata Firewall taxonomy (TECH-10). Types + constants only — no behavior.
 *
 * The Metadata Firewall treats metadata as sensitive data: every
 * metadata-producing behavior is classified so that policy can deny, redact,
 * coarsen, delay or memory-scope it. This is an APP-LEVEL boundary, not
 * anonymity and not defense against a global passive adversary
 * (docs/METADATA_MODEL.md, docs/audits/TECH_10_METADATA_THREAT_MODEL.md).
 *
 * Boundary note (scripts/check-boundaries.mjs): @freelayer/privacy may import
 * ONLY @freelayer/security. It must not import @freelayer/transports or
 * @freelayer/storage (that would invert the dependency direction). The
 * network/storage context types below are therefore self-contained MIRRORS of
 * the canonical vocabularies in those packages; privacy-regression tests import
 * all three packages and assert the mirrors and the policies stay in agreement.
 */

import type { PrivacyMode } from "./index";

/** Every metadata-producing signal the app can be asked to emit/record. */
export type MetadataEventKind =
  | "receipt.read"
  | "receipt.delivery"
  | "typing.start"
  | "typing.stop"
  | "presence.online"
  | "presence.offline"
  | "presence.last_seen"
  | "room.activity"
  | "notification.preview"
  | "notification.badge"
  | "notification.sound"
  | "link.preview"
  | "asset.remote_fetch"
  | "avatar.remote_fetch"
  | "external.navigation"
  | "transport.poll"
  | "transport.send_timing"
  | "transport.receive_timing"
  | "transport.size"
  | "relay.choice"
  | "lan.discovery"
  | "webrtc.ice_candidate"
  | "capsule.spool_exists"
  | "capsule.spool_timestamp"
  | "cache.exists"
  | "preview.generated"
  | "thumbnail.generated"
  | "log.write"
  | "crash_report.create"
  | "audit_event.write"
  | "ai.prompt_exists"
  | "ai.cache_exists"
  | "ai.summary_exists"
  | "screen.capture_detected"
  | "protected_content.revealed"
  | "device_risk.changed"
  | "watermark.generated"
  | "unknown";

export const METADATA_EVENT_KINDS: readonly MetadataEventKind[] = [
  "receipt.read",
  "receipt.delivery",
  "typing.start",
  "typing.stop",
  "presence.online",
  "presence.offline",
  "presence.last_seen",
  "room.activity",
  "notification.preview",
  "notification.badge",
  "notification.sound",
  "link.preview",
  "asset.remote_fetch",
  "avatar.remote_fetch",
  "external.navigation",
  "transport.poll",
  "transport.send_timing",
  "transport.receive_timing",
  "transport.size",
  "relay.choice",
  "lan.discovery",
  "webrtc.ice_candidate",
  "capsule.spool_exists",
  "capsule.spool_timestamp",
  "cache.exists",
  "preview.generated",
  "thumbnail.generated",
  "log.write",
  "crash_report.create",
  "audit_event.write",
  "ai.prompt_exists",
  "ai.cache_exists",
  "ai.summary_exists",
  "screen.capture_detected",
  "protected_content.revealed",
  "device_risk.changed",
  "watermark.generated",
  "unknown",
];

/** Where a metadata signal would land. */
export type MetadataSink =
  | "local_memory"
  | "local_persistent_storage"
  | "network"
  | "transport_envelope"
  | "notification_system"
  | "ui"
  | "logs"
  | "audit"
  | "cache"
  | "ai"
  | "build_artifact"
  | "unknown";

export const METADATA_SINKS: readonly MetadataSink[] = [
  "local_memory",
  "local_persistent_storage",
  "network",
  "transport_envelope",
  "notification_system",
  "ui",
  "logs",
  "audit",
  "cache",
  "ai",
  "build_artifact",
  "unknown",
];

export type MetadataSensitivity =
  "public" | "low" | "sensitive" | "relationship" | "content_adjacent" | "critical" | "unknown";

export type MetadataAction =
  | "allow"
  | "deny"
  | "redact"
  | "coarsen"
  | "delay"
  | "batch"
  | "require_user_action"
  | "memory_only"
  | "null";

/** Mirror of @freelayer/transports TransportClass (see boundary note above). */
export type MetadataTransportClass =
  | "relay"
  | "qr"
  | "file"
  | "usb"
  | "lan"
  | "external_app"
  | "email"
  | "websocket"
  | "webrtc"
  | "http"
  | "tor_proxy"
  | "unknown";

/** Mirror of @freelayer/transports MetadataExposureLevel. */
export type MetadataExposureLevel = "none" | "local_only" | "low" | "medium" | "high" | "unknown";

/** Mirror of @freelayer/storage StorageDataClass (see boundary note above). */
export type MetadataStorageDataClass =
  | "identity_key_material"
  | "device_key_material"
  | "room_key_material"
  | "trust_notebook"
  | "room_operation_log"
  | "materialized_room_state"
  | "message_content"
  | "document_content"
  | "file_blob"
  | "capsule_spool"
  | "capsule_inbox"
  | "capsule_quarantine"
  | "bundle_export"
  | "settings"
  | "contact_aliases"
  | "room_aliases"
  | "cache"
  | "media_cache"
  | "preview_cache"
  | "thumbnail_cache"
  | "ai_prompt_cache"
  | "ai_embedding_index"
  | "ai_output_cache"
  | "endpoint_redaction_state"
  | "protected_content_reveal_state"
  | "screen_capture_audit_event"
  | "device_risk_state"
  | "watermark_canary_state"
  | "logs"
  | "debug_artifact";

export type MetadataScreenShieldLevel = "off" | "standard" | "protected" | "sealed" | "bunker";
export type MetadataDeviceRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

/** The resolved metadata policy for one (mode, event, sink) triple. */
export interface MetadataPolicy {
  readonly mode: PrivacyMode;
  readonly event: MetadataEventKind;
  readonly sink: MetadataSink;
  readonly sensitivity: MetadataSensitivity;
  readonly action: MetadataAction;
  readonly allowed: boolean;
  readonly persistentAllowed: boolean;
  readonly networkAllowed: boolean;
  readonly userVisibleWarningRequired: boolean;
  readonly reason: string;
}

export interface MetadataPolicyInput {
  readonly mode: PrivacyMode;
  readonly event: MetadataEventKind;
  readonly sink: MetadataSink;
  readonly sensitivity?: MetadataSensitivity;
  /** Room policy may TIGHTEN only; loosening attempts are ignored. */
  readonly roomPolicy?: Partial<MetadataPolicy>;
  readonly networkContext?: {
    readonly transportClass?: MetadataTransportClass;
    readonly metadataExposure?: MetadataExposureLevel;
  };
  readonly storageContext?: {
    readonly dataClass?: MetadataStorageDataClass;
    readonly persistent?: boolean;
  };
  readonly screenShieldLevel?: MetadataScreenShieldLevel;
  readonly deviceRiskLevel?: MetadataDeviceRiskLevel;
}

/**
 * A concrete metadata operation. `payload` is intentionally `unknown` and MUST
 * NOT be serialized, logged, thrown, or written to audit without redaction —
 * the barrier and helpers enforce this (docs/METADATA_MODEL.md).
 */
export interface MetadataOperationRequest {
  readonly event: MetadataEventKind;
  readonly sink: MetadataSink;
  readonly sensitivity: MetadataSensitivity;
  /** Non-sensitive justification for audit. Never contains payload/identifiers. */
  readonly reason: string;
  readonly payload?: unknown;
}

export interface MetadataDecisionContext {
  readonly request: MetadataOperationRequest;
  readonly policy: MetadataPolicy;
  // PolicyDecision imported where used to avoid a needless type import here.
  readonly decision: import("./index").PolicyDecision;
}

/** The only representation of a metadata payload permitted to leave the module. */
export interface RedactedMetadataPayload {
  readonly redacted: true;
  /** Safe category/count fields only (short slugs, numbers, booleans). */
  readonly safe: Record<string, string | number | boolean>;
}

/** A redacted audit event. `details` carries only non-sensitive scalars. */
export interface RedactedAuditEvent {
  readonly kind: string;
  readonly category: "policy" | "storage" | "network" | "metadata" | "security";
  readonly severity: "info" | "warning" | "critical";
  /** Coarse/local ordering label, never trusted time and never exact where policy forbids. */
  readonly createdAtLocal: string;
  readonly redacted: true;
  readonly details?: Record<string, string | number | boolean | null>;
}

// ---- Event category groups (used by the resolver and helpers) ----

/** Receipts, typing, presence, last-seen, room activity — relationship signals. */
export const APPLICATION_SIGNAL_EVENTS: readonly MetadataEventKind[] = [
  "receipt.read",
  "receipt.delivery",
  "typing.start",
  "typing.stop",
  "presence.online",
  "presence.offline",
  "presence.last_seen",
  "room.activity",
];

export const NOTIFICATION_EVENTS: readonly MetadataEventKind[] = [
  "notification.preview",
  "notification.badge",
  "notification.sound",
];

/** External-asset / link-preview / remote navigation — always forbidden (ADR-0008). */
export const EXTERNAL_FETCH_EVENTS: readonly MetadataEventKind[] = [
  "link.preview",
  "asset.remote_fetch",
  "avatar.remote_fetch",
  "external.navigation",
];

/** Derived visual artifacts — content-adjacent (align with StoragePolicy caches). */
export const DERIVED_PREVIEW_EVENTS: readonly MetadataEventKind[] = [
  "cache.exists",
  "preview.generated",
  "thumbnail.generated",
];

/** Network-exposed metadata (timing/size/relay/IP). */
export const NETWORK_METADATA_EVENTS: readonly MetadataEventKind[] = [
  "transport.poll",
  "transport.send_timing",
  "transport.receive_timing",
  "transport.size",
  "relay.choice",
  "lan.discovery",
  "webrtc.ice_candidate",
];

export const AI_METADATA_EVENTS: readonly MetadataEventKind[] = [
  "ai.prompt_exists",
  "ai.cache_exists",
  "ai.summary_exists",
];

export const ENDPOINT_METADATA_EVENTS: readonly MetadataEventKind[] = [
  "screen.capture_detected",
  "protected_content.revealed",
  "device_risk.changed",
  "watermark.generated",
];

/** Sinks that persist by nature. Metadata never persists in v0. */
export const PERSISTENT_SINKS: readonly MetadataSink[] = [
  "local_persistent_storage",
  "build_artifact",
];

/** Sinks that expose metadata over the network. */
export const NETWORKED_SINKS: readonly MetadataSink[] = ["network", "transport_envelope"];
