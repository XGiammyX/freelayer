/**
 * Metadata Firewall helpers (TECH-10): classification predicates, payload
 * safety, and the redacted audit-event factory. Deliberately simple — this is
 * NOT anonymization, only enough hygiene to keep sensitive data out of
 * metadata sinks (docs/METADATA_MODEL.md).
 */

import { MetadataBypassAttemptError } from "./metadataErrors";
import {
  AI_METADATA_EVENTS,
  APPLICATION_SIGNAL_EVENTS,
  DERIVED_PREVIEW_EVENTS,
  EXTERNAL_FETCH_EVENTS,
  METADATA_EVENT_KINDS,
  METADATA_SINKS,
  NETWORK_METADATA_EVENTS,
  NETWORKED_SINKS,
  NOTIFICATION_EVENTS,
  PERSISTENT_SINKS,
  type MetadataEventKind,
  type MetadataSensitivity,
  type MetadataSink,
  type RedactedAuditEvent,
  type RedactedMetadataPayload,
} from "./metadataTypes";
import type { PrivacyMode } from "./index";

/** A safe metadata scalar string: short, lowercase, slug-like. */
const SAFE_SLUG = /^[a-z0-9_.:-]{0,32}$/;

const STRICT_MODES: readonly PrivacyMode[] = ["ghost", "bunker"];
const PRIVATE_PLUS_MODES: readonly PrivacyMode[] = [
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

export function isKnownMetadataEvent(event: MetadataEventKind): boolean {
  return event !== "unknown" && METADATA_EVENT_KINDS.includes(event);
}

export function isKnownMetadataSink(sink: MetadataSink): boolean {
  return sink !== "unknown" && METADATA_SINKS.includes(sink);
}

export function isMetadataSinkPersistent(sink: MetadataSink): boolean {
  return PERSISTENT_SINKS.includes(sink);
}

export function isMetadataSinkNetworked(sink: MetadataSink): boolean {
  return NETWORKED_SINKS.includes(sink);
}

/**
 * Whether an event is categorically forbidden in a mode, regardless of sink.
 * Used for fast checks and the guardrail; the full resolver is authoritative.
 */
export function isMetadataEventForbiddenInMode(
  mode: PrivacyMode,
  event: MetadataEventKind,
): boolean {
  // Always forbidden, every mode.
  if (
    EXTERNAL_FETCH_EVENTS.includes(event) ||
    NOTIFICATION_EVENTS.includes(event) ||
    APPLICATION_SIGNAL_EVENTS.includes(event) ||
    AI_METADATA_EVENTS.includes(event) ||
    event === "crash_report.create"
  ) {
    return true;
  }
  // Network-exposed metadata is forbidden in v0 (no network) and always in
  // offline/emergency/strict modes.
  if (NETWORK_METADATA_EVENTS.includes(event)) {
    return true;
  }
  // Derived previews/caches are content-adjacent: forbidden in Private+ and
  // strict/sealed contexts (aligns with StoragePolicy preview/thumbnail deny).
  if (DERIVED_PREVIEW_EVENTS.includes(event) && PRIVATE_PLUS_MODES.includes(mode)) {
    return true;
  }
  // Protected-reveal is denied outright in strict modes.
  if (event === "protected_content.revealed" && STRICT_MODES.includes(mode)) {
    return true;
  }
  return false;
}

/**
 * A metadata VALUE may only be a finite number or a boolean. Strings are never
 * safe: a slug-shaped string ("project-alpha") is indistinguishable from a room
 * or contact name, so all categorization is carried by the typed event kind —
 * never by free-form payload text.
 */
function isSafeScalar(value: unknown): value is number | boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return typeof value === "boolean";
}

/**
 * Throw if a payload carries anything beyond safe counters/flags. Rejects ALL
 * strings (possible content/identifiers/sentinels), nested structures, arrays,
 * and non-scalars. The error never echoes the payload.
 */
export function assertNoSensitiveMetadataPayload(payload: unknown): void {
  if (payload === undefined || payload === null) {
    return;
  }
  if (isSafeScalar(payload)) {
    return;
  }
  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new MetadataBypassAttemptError("payload is not a flat object of numeric/boolean fields");
  }
  for (const value of Object.values(payload as Record<string, unknown>)) {
    if (value !== null && !isSafeScalar(value)) {
      throw new MetadataBypassAttemptError("payload contains non-safe metadata values");
    }
  }
}

/**
 * Reduce any payload to safe counter/flag fields only. Removes every string
 * (content) and nested value. Never throws — unsafe input yields an empty set.
 */
export function redactMetadataPayload(payload: unknown): RedactedMetadataPayload {
  const safe: Record<string, string | number | boolean> = {};
  if (isSafeScalar(payload)) {
    safe["value"] = payload;
  } else if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (SAFE_SLUG.test(key) && isSafeScalar(value)) {
        safe[key] = value;
      }
    }
  }
  return { redacted: true, safe };
}

let auditSeq = 0;

/**
 * Build a redacted audit event. `details` is filtered to safe scalars (plus
 * explicit nulls); anything else is dropped. `createdAtLocal` is a coarse
 * logical label, never trusted time and never an exact timestamp.
 */
export function createRedactedAuditEvent(input: {
  readonly kind: string;
  readonly category: RedactedAuditEvent["category"];
  readonly severity: RedactedAuditEvent["severity"];
  readonly details?: Record<string, unknown>;
}): RedactedAuditEvent {
  auditSeq += 1;
  const details: Record<string, string | number | boolean | null> = {};
  if (input.details !== undefined) {
    for (const [key, value] of Object.entries(input.details)) {
      if (!SAFE_SLUG.test(key)) {
        continue;
      }
      if (value === null || isSafeScalar(value)) {
        details[key] = value;
      }
    }
  }
  return {
    kind: input.kind,
    category: input.category,
    severity: input.severity,
    createdAtLocal: `logical:${auditSeq}`,
    redacted: true,
    details,
  };
}

export function defaultMetadataSensitivity(event: MetadataEventKind): MetadataSensitivity {
  if (APPLICATION_SIGNAL_EVENTS.includes(event)) {
    return "relationship";
  }
  if (EXTERNAL_FETCH_EVENTS.includes(event) || DERIVED_PREVIEW_EVENTS.includes(event)) {
    return "content_adjacent";
  }
  if (NETWORK_METADATA_EVENTS.includes(event)) {
    return "sensitive";
  }
  if (AI_METADATA_EVENTS.includes(event)) {
    return "content_adjacent";
  }
  if (NOTIFICATION_EVENTS.includes(event)) {
    return "sensitive";
  }
  if (event === "protected_content.revealed" || event === "watermark.generated") {
    return "critical";
  }
  if (event === "crash_report.create" || event === "log.write") {
    return "sensitive";
  }
  if (event === "unknown") {
    return "unknown";
  }
  return "low";
}
