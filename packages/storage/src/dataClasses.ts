/**
 * Storage data classes (TECH-05). Every write belongs to exactly one class;
 * the class — never the feature — determines backend, persistence, and cache
 * behavior via the policy matrix (docs/STORAGE_MODEL.md).
 *
 * Notes that are rules:
 * - AI caches are CONTENT-DERIVED and must inherit the strictest policy of
 *   their source content (ADR-0005, ADR-0007).
 * - Endpoint/ScreenShield artifacts (reveal state, capture audit, device
 *   risk) may be sensitive even when they contain no message content —
 *   they are behavioral metadata (docs/ENDPOINT_DEFENSE_MODEL.md).
 * - Thumbnails/previews are derived content and must never bypass policy.
 * - The clipboard is NOT storage, but clipboard-related events are
 *   leakage-relevant and must never contain plaintext content.
 * - Logs and debug artifacts must never include sensitive content.
 */

export const STORAGE_DATA_CLASSES = [
  "identity_key_material",
  "device_key_material",
  "room_key_material",
  "trust_notebook",
  "room_operation_log",
  "materialized_room_state",
  "message_content",
  "document_content",
  "file_blob",
  "capsule_spool",
  "capsule_inbox",
  "capsule_quarantine",
  "bundle_export",
  "settings",
  "contact_aliases",
  "room_aliases",
  "cache",
  "media_cache",
  "preview_cache",
  "thumbnail_cache",
  "ai_prompt_cache",
  "ai_embedding_index",
  "ai_output_cache",
  "endpoint_redaction_state",
  "protected_content_reveal_state",
  "screen_capture_audit_event",
  "device_risk_state",
  "watermark_canary_state",
  "logs",
  "debug_artifact",
] as const;

export type StorageDataClass = (typeof STORAGE_DATA_CLASSES)[number];

/** Key material and trust roots — never storable without reviewed encryption. */
export const KEY_MATERIAL_CLASSES: readonly StorageDataClass[] = [
  "identity_key_material",
  "device_key_material",
  "room_key_material",
  "trust_notebook",
];

/** Primary content: rooms, messages, documents, files, capsules. */
export const CONTENT_CLASSES: readonly StorageDataClass[] = [
  "room_operation_log",
  "materialized_room_state",
  "message_content",
  "document_content",
  "file_blob",
  "capsule_spool",
  "capsule_inbox",
  "capsule_quarantine",
  "bundle_export",
];

/** Derived caches (non-AI). Expendable by definition; policy-inherited. */
export const CACHE_CLASSES: readonly StorageDataClass[] = [
  "cache",
  "media_cache",
  "preview_cache",
  "thumbnail_cache",
];

/** AI-derived caches — content in disguise; denied everywhere in v0 (Gate I). */
export const AI_CACHE_CLASSES: readonly StorageDataClass[] = [
  "ai_prompt_cache",
  "ai_embedding_index",
  "ai_output_cache",
];

/** Endpoint Defense / ScreenShield artifacts (ADR-0012 storage hooks). */
export const ENDPOINT_CLASSES: readonly StorageDataClass[] = [
  "endpoint_redaction_state",
  "protected_content_reveal_state",
  "screen_capture_audit_event",
  "device_risk_state",
  "watermark_canary_state",
];

/** Local configuration and aliases. */
export const SETTINGS_CLASSES: readonly StorageDataClass[] = [
  "settings",
  "contact_aliases",
  "room_aliases",
];
