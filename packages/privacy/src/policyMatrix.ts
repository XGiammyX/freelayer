/**
 * Policy Matrix v1 — the canonical mode × domain × operation table (TECH-13).
 *
 * One canonical policy matrix. Default deny. Deny overrides allow. Strictest
 * policy wins. Undefined behavior is a bug (fails closed).
 *
 * The compact SPECS below expand to one rule per mode. They must stay in
 * agreement with the concrete policy engines (Storage/Network/Metadata/
 * LinkPreview/ExternalAsset/Notification) — enforced by
 * tests/privacy-regression/policy-matrix/ — and mirrored verbatim in
 * docs/policy-matrix.v1.json (sync test) for the zero-dependency validator
 * scripts/validate-policy-matrix.mjs.
 *
 * v1 invariants: NOTHING persists and NOTHING egresses — every rule has
 * persistentAllowed=false and networkAllowed=false. No eval, no DSL, no
 * external policy runtime.
 */

import type { PrivacyMode } from "./index";
import {
  ALLOWING_EFFECTS,
  MAJOR_POLICY_DOMAINS,
  POLICY_DOMAINS,
  POLICY_EFFECT_STRICTNESS,
  type PolicyEffect,
  type PolicyMatrixDecision,
  type PolicyMatrixEvaluationInput,
  type PolicyMatrixRule,
  type PolicyMatrixSpec,
} from "./policyMatrixTypes";

export const POLICY_MATRIX_VERSION = "1.0.0";

const MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

// Shorthand effect-override builders used repeatedly below.
const STRICT_DENY = { ghost: "deny", bunker: "deny" } as const;
const OFFLINE_EMERGENCY_DENY = { offline_capsule: "deny", emergency: "deny" } as const;
const EMERGENCY_DENY = { emergency: "deny" } as const;

/**
 * The canonical spec table. Every privacy-relevant behavior FreeLayer models
 * has a row; anything not listed here fails closed at evaluation time and is
 * treated as an undocumented-behavior bug (docs/PBOM.md).
 */
export const POLICY_MATRIX_SPECS: readonly PolicyMatrixSpec[] = [
  // ---------------- STORAGE ----------------
  {
    id: "storage.content_persistent_write",
    domain: "storage",
    operation: "storage.write.persistent",
    sink: "local_persistent_storage",
    dataClass: "message_content",
    effect: "deny",
    effectOverrides: { standard: "future_gate" },
    reasonCode: "persistent_storage_forbidden",
    reasonOverrides: { standard: "encrypted_storage_not_implemented" },
    rationale:
      "No implemented persistent backend exists; Standard targets the future encrypted backend and fails hard until Gate F.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md", "docs/CRYPTO_DESIGN.md"],
  },
  {
    id: "storage.content_memory_write",
    domain: "storage",
    operation: "storage.write.memory",
    sink: "local_memory",
    dataClass: "message_content",
    effect: "memory_only",
    effectOverrides: { standard: "future_gate", emergency: "deny" },
    reasonCode: "strict_mode",
    reasonOverrides: {
      standard: "encrypted_storage_not_implemented",
      emergency: "emergency_mode",
    },
    rationale:
      "Content lives in memory only; Standard content targets the unimplemented encrypted backend (no silent memory fallback); Emergency denies normal writes.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md"],
  },
  {
    id: "storage.key_material_write",
    domain: "storage",
    operation: "storage.write.key_material",
    dataClass: "identity_key_material",
    effect: "future_gate",
    reasonCode: "crypto_not_implemented",
    rationale: "Key material is never storable until the encrypted backend passes Gate F review.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md", "docs/CRYPTO_DESIGN.md"],
  },
  {
    id: "storage.capsule_spool_memory",
    domain: "storage",
    operation: "storage.write.capsule_spool",
    sink: "local_memory",
    dataClass: "capsule_spool",
    effect: "memory_only",
    effectOverrides: EMERGENCY_DENY,
    reasonCode: "default_deny",
    reasonOverrides: { emergency: "emergency_mode" },
    rationale: "Capsule spool is memory-only active state; nothing persists in v1.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md"],
  },
  {
    id: "storage.preview_cache_write",
    domain: "storage",
    operation: "storage.write.preview_cache",
    sink: "cache",
    dataClass: "preview_cache",
    effect: "deny",
    effectOverrides: { standard: "memory_only" },
    reasonCode: "metadata_forbidden",
    reasonOverrides: { standard: "default_deny" },
    shieldTightened: true,
    rationale:
      "Preview caches are content-adjacent; denied in Private+ and sealed shield; Standard may hold a memory-only cache.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md", "docs/METADATA_MODEL.md"],
  },
  {
    id: "storage.thumbnail_cache_write",
    domain: "storage",
    operation: "storage.write.thumbnail_cache",
    sink: "cache",
    dataClass: "thumbnail_cache",
    effect: "deny",
    effectOverrides: { standard: "memory_only" },
    reasonCode: "metadata_forbidden",
    reasonOverrides: { standard: "default_deny" },
    shieldTightened: true,
    rationale: "Thumbnails are derived content; same policy as preview caches.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md"],
  },
  {
    id: "storage.ai_cache_write",
    domain: "storage",
    operation: "storage.write.ai_cache",
    sink: "ai",
    dataClass: "ai_output_cache",
    effect: "deny",
    reasonCode: "ai_forbidden",
    rationale: "AI caches are content in disguise; denied everywhere until Gate I.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md", "docs/LOCAL_AI.md"],
  },
  {
    id: "storage.audit_event_write",
    domain: "storage",
    operation: "storage.write.audit_event",
    sink: "audit",
    effect: "redact",
    reasonCode: "default_deny",
    rationale:
      "Audit events are redacted (no content/identifiers) and memory-only; Emergency keeps only a redacted wipe/revoke placeholder.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md", "docs/METADATA_MODEL.md"],
  },
  {
    id: "storage.debug_artifact_write",
    domain: "storage",
    operation: "storage.write.debug_artifact",
    dataClass: "debug_artifact",
    effect: "deny",
    reasonCode: "default_deny",
    rationale: "Debug artifacts are denied everywhere in v1.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md"],
  },
  {
    id: "storage.protected_reveal_persistence",
    domain: "storage",
    operation: "storage.write.protected_reveal_state",
    sink: "local_persistent_storage",
    dataClass: "protected_content_reveal_state",
    effect: "deny",
    reasonCode: "persistent_storage_forbidden",
    shieldTightened: true,
    rationale: "Protected reveal state never persists; behavioral metadata.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md", "docs/ENDPOINT_DEFENSE_MODEL.md"],
  },
  {
    id: "storage.notification_content_storage",
    domain: "storage",
    operation: "storage.write.notification_content",
    effect: "deny",
    reasonCode: "persistent_storage_forbidden",
    rationale: "Notification content storage is born denied (recorded TECH-10 decision).",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md", "docs/PRIVACY_MODEL.md"],
  },
  {
    id: "storage.encrypted_persistent_backend",
    domain: "storage",
    operation: "storage.backend.encrypted_persistent",
    effect: "future_gate",
    reasonCode: "encrypted_storage_not_implemented",
    rationale: "The encrypted persistent backend is a placeholder that throws until Gate F.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md", "docs/IMPLEMENTATION_GATES.md"],
  },

  // ---------------- NETWORK ----------------
  {
    id: "network.arbitrary_request",
    domain: "network",
    operation: "network.request",
    transport: "http",
    effect: "deny",
    reasonCode: "network_forbidden",
    rationale: "Direct HTTP is forbidden until an approved transport exists.",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md"],
  },
  {
    id: "network.relay_transport_send",
    domain: "network",
    operation: "transport.send",
    transport: "relay",
    effect: "require_user_action",
    effectOverrides: { ...STRICT_DENY, ...OFFLINE_EMERGENCY_DENY },
    reasonCode: "deferred_gate",
    reasonOverrides: {
      ghost: "strict_mode",
      bunker: "strict_mode",
      offline_capsule: "offline_capsule_mode",
      emergency: "emergency_mode",
    },
    rationale:
      "Relay send is a user-initiated approved-transport PLACEHOLDER (no network implemented); strict/offline/emergency deny.",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md"],
  },
  {
    id: "network.websocket_connect",
    domain: "network",
    operation: "network.connect.websocket",
    transport: "websocket",
    effect: "deny",
    reasonCode: "network_forbidden",
    rationale: "Persistent bidirectional channels are forbidden.",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md"],
  },
  {
    id: "network.webrtc_connect",
    domain: "network",
    operation: "network.connect.webrtc",
    transport: "webrtc",
    effect: "deny",
    reasonCode: "network_forbidden",
    rationale:
      "Direct peer connections expose IP (ICE/STUN); denied pending explicit future policy.",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md", "docs/METADATA_MODEL.md"],
  },
  {
    id: "network.lan_discovery",
    domain: "network",
    operation: "transport.discovery",
    transport: "lan",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "LAN discovery broadcasts presence metadata; denied by default.",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md"],
  },
  {
    id: "network.external_asset_fetch",
    domain: "network",
    operation: "asset.fetch",
    effect: "deny",
    reasonCode: "external_asset_forbidden",
    rationale: "Remote assets are network side effects; forbidden (ADR-0008).",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md", "docs/NO_EXTERNAL_ASSETS_POLICY.md"],
  },
  {
    id: "network.link_preview_fetch",
    domain: "network",
    operation: "link.preview",
    effect: "deny",
    reasonCode: "link_preview_forbidden",
    rationale: "Automatic link previews leak URL/IP/timing; forbidden.",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md", "docs/METADATA_MODEL.md"],
  },
  {
    id: "network.telemetry_send",
    domain: "network",
    operation: "telemetry.send",
    effect: "deny",
    reasonCode: "telemetry_forbidden",
    rationale: "Telemetry is forbidden in every mode, forever (ADR-0008).",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md", "docs/PBOM.md"],
  },
  {
    id: "network.remote_ai_request",
    domain: "network",
    operation: "ai.remote_request",
    effect: "deny",
    reasonCode: "ai_forbidden",
    rationale: "Remote AI requests are forbidden; AI is local-only by design (Gate I).",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md", "docs/LOCAL_AI.md"],
  },
  {
    id: "network.update_check",
    domain: "network",
    operation: "update.check",
    effect: "deny",
    reasonCode: "network_forbidden",
    rationale: "Automatic update checks are denied; manual/future only.",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md"],
  },
  {
    id: "network.push_subscribe",
    domain: "network",
    operation: "notification.push_subscribe",
    effect: "deny",
    reasonCode: "push_forbidden",
    rationale: "Push needs a push service + subscription metadata; no infrastructure by default.",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md", "docs/PRIVACY_MODEL.md"],
  },
  {
    id: "network.service_worker_network",
    domain: "network",
    operation: "service_worker.network",
    effect: "deny",
    reasonCode: "network_forbidden",
    rationale:
      "Service workers add background network/cache surface; none exists and none is allowed.",
    testCoverage: "covered",
    docsRefs: ["docs/NETWORK_MODEL.md"],
  },

  // ---------------- METADATA ----------------
  {
    id: "metadata.read_receipt",
    domain: "metadata",
    operation: "receipt.read",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale:
      "Read receipts are relationship metadata; off by default, denied in Private+ (v1 denies all).",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md", "docs/PRIVACY_MODEL.md"],
  },
  {
    id: "metadata.delivery_receipt",
    domain: "metadata",
    operation: "receipt.delivery",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale:
      "Delivery acks must later be sealed capsule content, not transport-visible plaintext.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.typing_indicator",
    domain: "metadata",
    operation: "typing.start",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Typing indicators reveal real-time activity.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.presence",
    domain: "metadata",
    operation: "presence.online",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Presence/online status reveals availability patterns.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.last_seen",
    domain: "metadata",
    operation: "presence.last_seen",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Last-seen is retained availability metadata.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.room_activity",
    domain: "metadata",
    operation: "room.activity",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Room-activity signals enable room/contact-graph inference.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.transport_timing",
    domain: "metadata",
    operation: "transport.send_timing",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Send/receive timing is network metadata; denied in v1 (no network).",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md", "docs/NETWORK_MODEL.md"],
  },
  {
    id: "metadata.transport_size",
    domain: "metadata",
    operation: "transport.size",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Message/capsule size is correlatable metadata; padding is future CapsuleNet work.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.relay_choice",
    domain: "metadata",
    operation: "relay.choice",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Relay choice reveals infrastructure relationships.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.link_preview_metadata",
    domain: "metadata",
    operation: "link.preview",
    effect: "deny",
    reasonCode: "link_preview_forbidden",
    rationale: "Preview existence/URL interest is content-adjacent metadata.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.external_asset_metadata",
    domain: "metadata",
    operation: "asset.remote_fetch",
    effect: "deny",
    reasonCode: "external_asset_forbidden",
    rationale: "Asset-fetch requests leak IP/timing/interest.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.audit_event",
    domain: "metadata",
    operation: "audit_event.write",
    sink: "audit",
    effect: "redact",
    reasonCode: "default_deny",
    rationale: "Audit events exist only redacted (numeric/boolean details) and memory-only.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.log_write",
    domain: "metadata",
    operation: "log.write",
    sink: "logs",
    effect: "redact",
    effectOverrides: EMERGENCY_DENY,
    reasonCode: "default_deny",
    reasonOverrides: { emergency: "emergency_mode" },
    rationale: "Only non-sensitive, memory-only logs; Emergency denies normal logging.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "metadata.ai_metadata",
    domain: "metadata",
    operation: "ai.prompt_exists",
    effect: "deny",
    reasonCode: "ai_forbidden",
    rationale: "AI prompt/cache/summary existence is metadata; denied (Gate I).",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md", "docs/LOCAL_AI.md"],
  },
  {
    id: "metadata.screen_capture_event",
    domain: "metadata",
    operation: "screen.capture_detected",
    effect: "redact",
    effectOverrides: EMERGENCY_DENY,
    reasonCode: "default_deny",
    reasonOverrides: { emergency: "emergency_mode" },
    rationale: "Capture-detected signals are memory-only and redacted (never plaintext).",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md", "docs/ENDPOINT_DEFENSE_MODEL.md"],
  },
  {
    id: "metadata.protected_reveal",
    domain: "metadata",
    operation: "protected_content.revealed",
    effect: "memory_only",
    effectOverrides: { ...STRICT_DENY, emergency: "deny" },
    reasonCode: "default_deny",
    reasonOverrides: { ghost: "strict_mode", bunker: "strict_mode", emergency: "emergency_mode" },
    shieldTightened: true,
    rationale: "Reveal state is memory-only where allowed; strict modes and sealed shield deny it.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md", "docs/ENDPOINT_DEFENSE_MODEL.md"],
  },
  {
    id: "metadata.notification_metadata",
    domain: "metadata",
    operation: "notification.preview",
    sink: "notification_system",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Notification previews/badges are activity metadata.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md", "docs/PRIVACY_MODEL.md"],
  },

  // ---------------- LINK PREVIEW ----------------
  {
    id: "link_preview.automatic_preview",
    domain: "link_preview",
    operation: "preview.automatic",
    effect: "deny",
    reasonCode: "link_preview_forbidden",
    rationale:
      "Automatic previews are denied in every mode; one auto-fetch leaks URL/IP/UA/timing.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "link_preview.opengraph_fetch",
    domain: "link_preview",
    operation: "preview.opengraph_fetch",
    effect: "deny",
    reasonCode: "link_preview_forbidden",
    rationale: "OpenGraph fetching parses remote pages; denied.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "link_preview.favicon_fetch",
    domain: "link_preview",
    operation: "preview.favicon_fetch",
    effect: "deny",
    reasonCode: "link_preview_forbidden",
    rationale: "Favicon fetches leak browsing interest.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "link_preview.preview_cache",
    domain: "link_preview",
    operation: "preview.cache_write",
    sink: "cache",
    effect: "deny",
    reasonCode: "link_preview_forbidden",
    shieldTightened: true,
    rationale: "A preview cache would persist URL/title/image; denied.",
    testCoverage: "covered",
    docsRefs: ["docs/STORAGE_MODEL.md", "docs/METADATA_MODEL.md"],
  },
  {
    id: "link_preview.plain_text_url_display",
    domain: "link_preview",
    operation: "preview.plain_text_display",
    effect: "redact",
    reasonCode: "default_deny",
    rationale:
      "URLs render only as redacted plain text (domain-only, no query/credentials); sealed shield collapses to a generic label.",
    testCoverage: "covered",
    docsRefs: ["docs/METADATA_MODEL.md"],
  },
  {
    id: "link_preview.user_initiated_preview",
    domain: "link_preview",
    operation: "preview.user_initiated",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale: "A safe user-initiated preview is a future research/design gate; not implemented.",
    testCoverage: "deferred",
    docsRefs: ["docs/research/LINK_PREVIEW_EXTERNAL_ASSET_BLOCKING_RESEARCH.md"],
  },

  // ---------------- EXTERNAL ASSET ----------------
  ...(
    [
      "remote_image",
      "remote_avatar",
      "remote_font",
      "remote_script",
      "remote_stylesheet",
      "remote_css_url",
      "tracking_pixel",
      "iframe",
      "preconnect",
      "dns_prefetch",
      "preload",
      "prefetch",
    ] as const
  ).map((kind): PolicyMatrixSpec => ({
    id: `external_asset.${kind}`,
    domain: "external_asset",
    operation: `asset.${kind}`,
    effect: "deny",
    reasonCode: "external_asset_forbidden",
    rationale: `External asset kind "${kind}" is forbidden in every mode (ADR-0008); assets travel as capsule content, never remote URLs.`,
    testCoverage: "covered",
    docsRefs: ["docs/NO_EXTERNAL_ASSETS_POLICY.md", "docs/METADATA_MODEL.md"],
  })),

  // ---------------- NOTIFICATION ----------------
  {
    id: "notification.permission_request",
    domain: "notification",
    operation: "notification.permission_request",
    effect: "require_user_action",
    reasonCode: "default_deny",
    rationale:
      "Permission prompts are side effects; never automatic (future explicit user action).",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },
  {
    id: "notification.generic_in_app",
    domain: "notification",
    operation: "notification.show.in_app_generic",
    sink: "in_app",
    effect: "memory_only",
    effectOverrides: { ...STRICT_DENY, ...OFFLINE_EMERGENCY_DENY },
    reasonCode: "default_deny",
    reasonOverrides: {
      ghost: "strict_mode",
      bunker: "strict_mode",
      offline_capsule: "offline_capsule_mode",
      emergency: "emergency_mode",
    },
    rationale:
      "The only allowed notification: a generic, content-free, memory-only in-app indicator (Standard/Private/Sovereign).",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },
  {
    id: "notification.message_preview",
    domain: "notification",
    operation: "notification.show.message_preview",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Message previews in notifications are denied in every mode.",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },
  {
    id: "notification.room_name",
    domain: "notification",
    operation: "notification.show.room_name",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Room names in notifications leak context; denied.",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },
  {
    id: "notification.sender_alias",
    domain: "notification",
    operation: "notification.show.sender_alias",
    effect: "deny",
    reasonCode: "metadata_forbidden",
    rationale: "Sender aliases in notifications leak relationships; denied.",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },
  {
    id: "notification.badge_count",
    domain: "notification",
    operation: "notification.badge.count",
    sink: "app_badge",
    effect: "not_implemented",
    reasonCode: "metadata_forbidden",
    rationale:
      "Badge counts are activity metadata; not implemented, denied in strict modes forever.",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md", "docs/METADATA_MODEL.md"],
  },
  {
    id: "notification.badge_dot",
    domain: "notification",
    operation: "notification.badge.dot",
    sink: "app_badge",
    effect: "not_implemented",
    reasonCode: "metadata_forbidden",
    rationale: "Even a contentless badge dot reveals activity.",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },
  {
    id: "notification.sound",
    domain: "notification",
    operation: "notification.sound",
    sink: "sound",
    effect: "not_implemented",
    reasonCode: "metadata_forbidden",
    rationale: "Notification sound reveals timing/activity patterns.",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },
  {
    id: "notification.vibration",
    domain: "notification",
    operation: "notification.vibration",
    sink: "vibration",
    effect: "not_implemented",
    reasonCode: "metadata_forbidden",
    rationale: "Vibration reveals timing/activity patterns.",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },
  {
    id: "notification.push_subscribe",
    domain: "notification",
    operation: "notification.push_subscribe",
    sink: "push_service",
    effect: "future_gate",
    reasonCode: "push_forbidden",
    rationale: "Push subscription requires infrastructure + an ADR gate; denied in every mode.",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md", "docs/NETWORK_MODEL.md"],
  },
  {
    id: "notification.push_receive",
    domain: "notification",
    operation: "notification.push_receive",
    sink: "push_service",
    effect: "future_gate",
    reasonCode: "push_forbidden",
    rationale: "Push receive is denied until the push gate opens (if ever).",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },
  {
    id: "notification.service_worker_show",
    domain: "notification",
    operation: "notification.service_worker_show",
    sink: "service_worker",
    effect: "future_gate",
    reasonCode: "push_forbidden",
    rationale: "Service-worker notifications are denied; no service worker exists.",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },
  {
    id: "notification.audit_event",
    domain: "notification",
    operation: "notification.audit",
    sink: "audit",
    effect: "redact",
    reasonCode: "default_deny",
    rationale: "Notification denials are auditable only as redacted events (no title/body/names).",
    testCoverage: "covered",
    docsRefs: ["docs/PRIVACY_MODEL.md"],
  },

  // ---------------- AI ----------------
  {
    id: "ai.local_request",
    domain: "ai",
    operation: "ai.local_request",
    effect: "future_gate",
    effectOverrides: { ghost: "deny", bunker: "deny", emergency: "deny" },
    reasonCode: "deferred_gate",
    reasonOverrides: { ghost: "ai_forbidden", bunker: "ai_forbidden", emergency: "emergency_mode" },
    rationale: "Local AI is future-gated (Gate I) and denied outright in Ghost/Bunker/Emergency.",
    testCoverage: "covered",
    docsRefs: ["docs/LOCAL_AI.md"],
  },
  {
    id: "ai.remote_request",
    domain: "ai",
    operation: "ai.remote_request",
    effect: "deny",
    reasonCode: "ai_forbidden",
    rationale: "Remote AI is forbidden in every mode; AI is local-only by design.",
    testCoverage: "covered",
    docsRefs: ["docs/LOCAL_AI.md"],
  },
  {
    id: "ai.prompt_cache",
    domain: "ai",
    operation: "ai.prompt_cache_write",
    dataClass: "ai_prompt_cache",
    effect: "deny",
    reasonCode: "ai_forbidden",
    rationale: "AI prompt caches are denied everywhere in v1.",
    testCoverage: "covered",
    docsRefs: ["docs/LOCAL_AI.md", "docs/STORAGE_MODEL.md"],
  },
  {
    id: "ai.embedding_index",
    domain: "ai",
    operation: "ai.embedding_index_write",
    dataClass: "ai_embedding_index",
    effect: "deny",
    reasonCode: "ai_forbidden",
    rationale: "Embedding indexes are content-derived; denied.",
    testCoverage: "covered",
    docsRefs: ["docs/LOCAL_AI.md"],
  },
  {
    id: "ai.output_cache",
    domain: "ai",
    operation: "ai.output_cache_write",
    dataClass: "ai_output_cache",
    effect: "deny",
    reasonCode: "ai_forbidden",
    rationale: "AI output caches are denied.",
    testCoverage: "covered",
    docsRefs: ["docs/LOCAL_AI.md"],
  },
  {
    id: "ai.summary_notification",
    domain: "ai",
    operation: "ai.summary_notification",
    effect: "deny",
    reasonCode: "ai_forbidden",
    rationale: "AI summaries never reach notifications by default.",
    testCoverage: "covered",
    docsRefs: ["docs/LOCAL_AI.md", "docs/PRIVACY_MODEL.md"],
  },
  {
    id: "ai.audit_event",
    domain: "ai",
    operation: "ai.audit",
    sink: "audit",
    effect: "redact",
    reasonCode: "default_deny",
    rationale: "AI-policy denials are auditable only as redacted events.",
    testCoverage: "partial",
    docsRefs: ["docs/LOCAL_AI.md"],
  },

  // ---------------- ENDPOINT / SCREENSHIELD ----------------
  {
    id: "endpoint.protected_reveal",
    domain: "endpoint",
    operation: "protected_content.reveal",
    effect: "memory_only",
    effectOverrides: { ...STRICT_DENY, emergency: "deny" },
    reasonCode: "default_deny",
    reasonOverrides: { ghost: "strict_mode", bunker: "strict_mode", emergency: "emergency_mode" },
    shieldTightened: true,
    rationale:
      "Protected reveal is memory-only where allowed; strict modes and sealed shield deny.",
    testCoverage: "covered",
    docsRefs: ["docs/ENDPOINT_DEFENSE_MODEL.md", "docs/METADATA_MODEL.md"],
  },
  {
    id: "endpoint.reveal_persistence",
    domain: "endpoint",
    operation: "protected_content.reveal_persist",
    sink: "local_persistent_storage",
    effect: "deny",
    reasonCode: "persistent_storage_forbidden",
    shieldTightened: true,
    rationale: "Reveal history never persists.",
    testCoverage: "covered",
    docsRefs: ["docs/ENDPOINT_DEFENSE_MODEL.md"],
  },
  {
    id: "endpoint.screen_capture_audit",
    domain: "endpoint",
    operation: "screen.capture_audit",
    sink: "audit",
    effect: "redact",
    effectOverrides: EMERGENCY_DENY,
    reasonCode: "default_deny",
    reasonOverrides: { emergency: "emergency_mode" },
    rationale: "Capture audits are redacted and memory-only; never plaintext.",
    testCoverage: "covered",
    docsRefs: ["docs/ENDPOINT_DEFENSE_MODEL.md"],
  },
  {
    id: "endpoint.watermark_canary_state",
    domain: "endpoint",
    operation: "watermark.state_write",
    dataClass: "watermark_canary_state",
    effect: "redact",
    effectOverrides: EMERGENCY_DENY,
    reasonCode: "default_deny",
    reasonOverrides: { emergency: "emergency_mode" },
    rationale: "Watermark/canary state is memory-only and must never contain raw identity/content.",
    testCoverage: "covered",
    docsRefs: ["docs/ENDPOINT_DEFENSE_MODEL.md"],
  },
  {
    id: "endpoint.clipboard_copy",
    domain: "endpoint",
    operation: "clipboard.copy_protected",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale: "The Clipboard Firewall is TECH-EDL-05; until designed, protected copy is gated.",
    testCoverage: "deferred",
    docsRefs: ["docs/ENDPOINT_DEFENSE_MODEL.md", "docs/ROADMAP.md"],
  },
  {
    id: "endpoint.secure_input",
    domain: "endpoint",
    operation: "input.secure_field",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale: "Secure input firewall is TECH-EDL-06; future-gated.",
    testCoverage: "deferred",
    docsRefs: ["docs/ENDPOINT_DEFENSE_MODEL.md"],
  },
  {
    id: "endpoint.task_switcher_preview",
    domain: "endpoint",
    operation: "display.task_switcher_preview",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale: "Task-switcher preview hiding is platform work (TECH-EDL); future-gated.",
    testCoverage: "deferred",
    docsRefs: ["docs/ENDPOINT_DEFENSE_MODEL.md", "docs/PLATFORM_LIMITATIONS.md"],
  },
  {
    id: "endpoint.screenshot_blocking",
    domain: "endpoint",
    operation: "display.screenshot_blocking",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale:
      "Screenshot-blocking capability is per-platform and honest-limits work; future-gated.",
    testCoverage: "deferred",
    docsRefs: ["docs/SCREENSHIELD.md", "docs/PLATFORM_LIMITATIONS.md"],
  },

  // ---------------- DEFERRED DOMAINS ----------------
  {
    id: "crypto.operation",
    domain: "crypto",
    operation: "crypto.any",
    effect: "future_gate",
    reasonCode: "crypto_not_implemented",
    rationale: "No cryptography is written or claimed until CRYPTO_DESIGN passes Gate F review.",
    testCoverage: "covered",
    docsRefs: ["docs/CRYPTO_DESIGN.md", "docs/IMPLEMENTATION_GATES.md"],
  },
  {
    id: "capsule.wire_format",
    domain: "capsule",
    operation: "capsule.wire_format",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale: "Capsule wire format + hostile-input parser are Gate E work.",
    testCoverage: "deferred",
    docsRefs: ["docs/CAPSULENET.md", "docs/IMPLEMENTATION_GATES.md"],
  },
  {
    id: "capsule.transport",
    domain: "capsule",
    operation: "capsule.transport_send",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale: "Real capsule transports arrive with Gate D/E; only Noop/Mock exist.",
    testCoverage: "deferred",
    docsRefs: ["docs/CAPSULENET.md", "docs/NETWORK_MODEL.md"],
  },
  {
    id: "room.sync",
    domain: "room",
    operation: "room.sync",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale: "Room sync model (event-log vs CRDT) is Gate H work.",
    testCoverage: "deferred",
    docsRefs: ["docs/SOVEREIGN_ROOMS.md", "docs/IMPLEMENTATION_GATES.md"],
  },
  // ---- RoomOS foundation (TECH-16): local, memory-only state transitions.
  //      Persistence and sync stay gated; emergency denies normal mutation. ----
  {
    id: "room.create_local",
    domain: "room",
    operation: "room.create",
    sink: "local_memory",
    effect: "memory_only",
    effectOverrides: EMERGENCY_DENY,
    reasonCode: "default_deny",
    reasonOverrides: { emergency: "emergency_mode" },
    rationale: "Local room creation is a memory-only state transition; Emergency denies.",
    testCoverage: "covered",
    docsRefs: ["docs/SOVEREIGN_ROOMS.md"],
  },
  {
    id: "room.mutate_local",
    domain: "room",
    operation: "room.mutate",
    sink: "local_memory",
    effect: "memory_only",
    effectOverrides: EMERGENCY_DENY,
    reasonCode: "default_deny",
    reasonOverrides: { emergency: "emergency_mode" },
    rationale:
      "Placeholder object mutations (message/note/task/decision/poll/member refs) are memory-only; Emergency denies.",
    testCoverage: "covered",
    docsRefs: ["docs/SOVEREIGN_ROOMS.md"],
  },
  {
    id: "room.lifecycle_update",
    domain: "room",
    operation: "room.lifecycle_update",
    sink: "local_memory",
    effect: "memory_only",
    reasonCode: "default_deny",
    rationale:
      "Lifecycle transitions (rename/archive/lock/tombstone) are memory-only; allowed in Emergency for the lock/wipe direction.",
    testCoverage: "covered",
    docsRefs: ["docs/SOVEREIGN_ROOMS.md"],
  },
  {
    id: "room.policy_update_local",
    domain: "room",
    operation: "room.policy_update",
    sink: "local_memory",
    effect: "memory_only",
    effectOverrides: EMERGENCY_DENY,
    reasonCode: "default_deny",
    reasonOverrides: { emergency: "emergency_mode" },
    rationale: "Room policy updates compose tighten-only and live in memory.",
    testCoverage: "covered",
    docsRefs: ["docs/SOVEREIGN_ROOMS.md", "docs/POLICY_MATRIX.md"],
  },
  {
    id: "room.operation_log_append",
    domain: "room",
    operation: "room.operation_log.append",
    sink: "local_memory",
    effect: "memory_only",
    effectOverrides: EMERGENCY_DENY,
    reasonCode: "default_deny",
    reasonOverrides: { emergency: "emergency_mode" },
    rationale: "The event-sourced operation log is a memory-only placeholder in v1.",
    testCoverage: "covered",
    docsRefs: ["docs/SOVEREIGN_ROOMS.md", "docs/STORAGE_MODEL.md"],
  },
  {
    id: "room.operation_log_persist",
    domain: "room",
    operation: "room.operation_log.persist",
    sink: "local_persistent_storage",
    dataClass: "room_operation_log",
    effect: "deny",
    reasonCode: "persistent_storage_forbidden",
    rationale:
      "Operation-log persistence is denied until the encrypted backend exists (Gate F); Ghost/Bunker deny forever.",
    testCoverage: "covered",
    docsRefs: ["docs/SOVEREIGN_ROOMS.md", "docs/STORAGE_MODEL.md"],
  },
  {
    id: "room.projection_local",
    domain: "room",
    operation: "room.project",
    sink: "local_memory",
    effect: "memory_only",
    effectOverrides: EMERGENCY_DENY,
    reasonCode: "default_deny",
    reasonOverrides: { emergency: "emergency_mode" },
    rationale: "Materialized projection is derived, rebuildable, memory-only.",
    testCoverage: "covered",
    docsRefs: ["docs/SOVEREIGN_ROOMS.md"],
  },
  {
    id: "room.projection_persist",
    domain: "room",
    operation: "room.project.persist",
    sink: "local_persistent_storage",
    dataClass: "materialized_room_state",
    effect: "deny",
    reasonCode: "persistent_storage_forbidden",
    rationale: "Projection persistence is denied until the encrypted backend exists (Gate F).",
    testCoverage: "covered",
    docsRefs: ["docs/SOVEREIGN_ROOMS.md", "docs/STORAGE_MODEL.md"],
  },
  {
    id: "room.audit_append",
    domain: "room",
    operation: "room.audit",
    sink: "audit",
    effect: "redact",
    reasonCode: "default_deny",
    rationale:
      "Room audit events exist only redacted (no titles/member names/content) and memory-only.",
    testCoverage: "covered",
    docsRefs: ["docs/SOVEREIGN_ROOMS.md", "docs/METADATA_MODEL.md"],
  },
  {
    id: "identity.invite",
    domain: "identity",
    operation: "identity.invite",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale: "Identity model (invites/verification/recovery) is Gate G work.",
    testCoverage: "deferred",
    docsRefs: ["docs/IMPLEMENTATION_GATES.md"],
  },
  {
    id: "identity.verification",
    domain: "identity",
    operation: "identity.verification",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale: "QR/short-code verification is designed at Gate G.",
    testCoverage: "deferred",
    docsRefs: ["docs/IMPLEMENTATION_GATES.md"],
  },
  {
    id: "endpoint.tauri_desktop_permissions",
    domain: "endpoint",
    operation: "desktop.tauri_permissions",
    effect: "future_gate",
    reasonCode: "deferred_gate",
    rationale:
      "The Tauri shell is a placeholder with a zero permission surface until Phase 9 hardening.",
    testCoverage: "covered",
    docsRefs: ["docs/audits/TAURI_NOTIFICATION_PERMISSION_AUDIT.md", "docs/ROADMAP.md"],
  },
];

// ---------------------------------------------------------------------------
// Expansion: one spec → one rule per mode.
// ---------------------------------------------------------------------------

function isAllowingEffect(effect: PolicyEffect): boolean {
  return ALLOWING_EFFECTS.includes(effect);
}

export function expandPolicyMatrixSpecs(
  specs: readonly PolicyMatrixSpec[],
): readonly PolicyMatrixRule[] {
  const rules: PolicyMatrixRule[] = [];
  for (const spec of specs) {
    for (const mode of MODES) {
      const effect = spec.effectOverrides?.[mode] ?? spec.effect;
      const reasonCode = spec.reasonOverrides?.[mode] ?? spec.reasonCode;
      rules.push({
        id: `${spec.id}:${mode}`,
        domain: spec.domain,
        mode,
        operation: spec.operation,
        ...(spec.sink !== undefined ? { sink: spec.sink } : {}),
        ...(spec.transport !== undefined ? { transport: spec.transport } : {}),
        ...(spec.dataClass !== undefined ? { dataClass: spec.dataClass } : {}),
        effect,
        allowed: isAllowingEffect(effect),
        // v1 invariants: nothing persists, nothing egresses — ever.
        persistentAllowed: false,
        networkAllowed: false,
        requiresUserAction: effect === "require_user_action",
        reasonCode,
        rationale: spec.rationale,
        testCoverage: spec.testCoverage,
        docsRefs: spec.docsRefs,
      });
    }
  }
  return rules;
}

export const POLICY_MATRIX_RULES: readonly PolicyMatrixRule[] =
  expandPolicyMatrixSpecs(POLICY_MATRIX_SPECS);

/** Spec ids whose ScreenShield sealed/bunker (or critical risk) tighten to deny. */
const SHIELD_TIGHTENED_SPEC_IDS: ReadonlySet<string> = new Set(
  POLICY_MATRIX_SPECS.filter((s) => s.shieldTightened === true).map((s) => s.id),
);

// Fast lookup: domain|operation|mode → rule. The validator forbids duplicates.
const RULE_INDEX: ReadonlyMap<string, PolicyMatrixRule> = new Map(
  POLICY_MATRIX_RULES.map((rule) => [`${rule.domain}|${rule.operation}|${rule.mode}`, rule]),
);

// ---------------------------------------------------------------------------
// Composition: deny overrides allow; strictest policy wins.
// ---------------------------------------------------------------------------

function strictnessIndex(effect: PolicyEffect): number {
  const index = POLICY_EFFECT_STRICTNESS.indexOf(effect);
  // Unknown effect (unsound cast/drift) is treated as strictest: deny.
  return index === -1 ? 0 : index;
}

export function isEffectStricterThan(a: PolicyEffect, b: PolicyEffect): boolean {
  return strictnessIndex(a) < strictnessIndex(b);
}

export function combinePolicyEffects(effects: readonly PolicyEffect[]): PolicyEffect {
  if (effects.length === 0) {
    return "deny"; // no effects → fail closed
  }
  return effects.reduce((strictest, effect) =>
    isEffectStricterThan(effect, strictest) ? effect : strictest,
  );
}

export function applyStrictestPolicy(
  decisions: readonly PolicyMatrixDecision[],
): PolicyMatrixDecision {
  if (decisions.length === 0) {
    return {
      ruleId: "unmatched",
      domain: "unknown",
      mode: "standard",
      effect: "deny",
      allowed: false,
      persistentAllowed: false,
      networkAllowed: false,
      requiresUserAction: false,
      reasonCode: "unknown_input",
      rationale: "No decisions to combine: fail closed.",
    };
  }
  const strictest = decisions.reduce((current, decision) =>
    isEffectStricterThan(decision.effect, current.effect) ? decision : current,
  );
  // Deny overrides allow: allowed only if EVERY decision allows.
  const allowed = decisions.every((d) => d.allowed) && strictest.allowed;
  return {
    ...strictest,
    allowed,
    persistentAllowed: decisions.every((d) => d.persistentAllowed),
    networkAllowed: decisions.every((d) => d.networkAllowed),
  };
}

// ---------------------------------------------------------------------------
// Evaluation: fail closed, tighten-only composition.
// ---------------------------------------------------------------------------

function denyDecision(
  input: PolicyMatrixEvaluationInput,
  reasonCode: PolicyMatrixDecision["reasonCode"],
  rationale: string,
): PolicyMatrixDecision {
  return {
    ruleId: "unmatched",
    domain: POLICY_DOMAINS.includes(input.domain) ? input.domain : "unknown",
    mode: input.mode,
    effect: "deny",
    allowed: false,
    persistentAllowed: false,
    networkAllowed: false,
    requiresUserAction: false,
    reasonCode,
    rationale,
  };
}

export function evaluatePolicyMatrix(input: PolicyMatrixEvaluationInput): PolicyMatrixDecision {
  const rule = RULE_INDEX.get(`${input.domain}|${input.operation}|${input.mode}`);

  // FAIL CLOSED: unknown mode/domain/operation (or any unindexed combination).
  if (rule === undefined) {
    return denyDecision(input, "unknown_input", "No matrix rule for this input: fail closed.");
  }

  let effect = rule.effect;
  let allowed = rule.allowed;
  let reasonCode = rule.reasonCode;
  let rationale = rule.rationale;

  // ScreenShield sealed/bunker and critical device risk TIGHTEN shield-marked rows.
  const shield = input.screenShieldLevel ?? "off";
  const risk = input.deviceRiskLevel ?? "unknown";
  const specId = rule.id.slice(0, rule.id.lastIndexOf(":"));
  if (
    SHIELD_TIGHTENED_SPEC_IDS.has(specId) &&
    (shield === "sealed" || shield === "bunker" || risk === "critical")
  ) {
    effect = "deny";
    allowed = false;
    reasonCode = "screen_shield_strict";
    rationale = "ScreenShield/device-risk tightening: shield-sensitive behavior denied.";
  }

  // Room policy composes TIGHTEN-ONLY: it may force a stricter effect or deny;
  // any loosening attempt is ignored.
  const room = input.roomPolicy;
  if (room !== undefined) {
    if (room.allowed === false && allowed) {
      effect = "deny";
      allowed = false;
      reasonCode = "room_policy_stricter";
      rationale = "Room policy tightened the device baseline (strictest wins).";
    } else if (room.effect !== undefined && isEffectStricterThan(room.effect, effect)) {
      effect = room.effect;
      allowed = allowed && ALLOWING_EFFECTS.includes(room.effect);
      reasonCode = "room_policy_stricter";
      rationale = "Room policy tightened the device baseline (strictest wins).";
    }
  }

  return {
    ruleId: rule.id,
    domain: rule.domain,
    mode: rule.mode,
    effect,
    allowed,
    persistentAllowed: false,
    networkAllowed: false,
    requiresUserAction: rule.requiresUserAction,
    reasonCode,
    rationale,
  };
}

/** All rules for one mode (used by docs/tests). */
export function policyMatrixRulesForMode(mode: PrivacyMode): readonly PolicyMatrixRule[] {
  return POLICY_MATRIX_RULES.filter((rule) => rule.mode === mode);
}

/** Sanity export used by validators/tests. */
export const POLICY_MATRIX_SUMMARY = {
  version: POLICY_MATRIX_VERSION,
  specCount: POLICY_MATRIX_SPECS.length,
  ruleCount: POLICY_MATRIX_RULES.length,
  modes: MODES,
  majorDomains: MAJOR_POLICY_DOMAINS,
} as const;
