/**
 * MetadataPolicy v0 — the mode × event × sink matrix (TECH-10).
 *
 * Resolution principles, in order:
 *   1. DEFAULT DENY — anything not explicitly allowed is denied.
 *   2. STRICTEST WINS — room policy composes tighten-only.
 *   3. NOTHING PERSISTS, NOTHING EGRESSES — in v0 no metadata may reach a
 *      persistent or networked sink; the ceiling is memory-only, redacted.
 *
 * Explicit and boring: predicates over event category / sink / mode, no rule
 * engine — mirroring resolveStoragePolicy / resolveNetworkPolicy
 * (docs/METADATA_MODEL.md). No behavior, no I/O; this only decides.
 */

import type { PrivacyMode } from "./index";
import {
  AI_METADATA_EVENTS,
  APPLICATION_SIGNAL_EVENTS,
  DERIVED_PREVIEW_EVENTS,
  EXTERNAL_FETCH_EVENTS,
  NETWORK_METADATA_EVENTS,
  NOTIFICATION_EVENTS,
  type MetadataAction,
  type MetadataPolicy,
  type MetadataPolicyInput,
} from "./metadataTypes";
import {
  defaultMetadataSensitivity,
  isKnownMetadataEvent,
  isKnownMetadataSink,
  isMetadataSinkNetworked,
  isMetadataSinkPersistent,
} from "./metadataHelpers";

const KNOWN_MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

const STRICT_MODES: readonly PrivacyMode[] = ["ghost", "bunker"];

interface Draft {
  action: MetadataAction;
  allowed: boolean;
  persistentAllowed: boolean;
  networkAllowed: boolean;
  userVisibleWarningRequired: boolean;
  reasons: string[];
}

/** In v0 nothing metadata-shaped persists or egresses; every allow is memory-only. */
function allow(action: MetadataAction, reason: string, warn = false): Draft {
  return {
    action,
    allowed: true,
    persistentAllowed: false,
    networkAllowed: false,
    userVisibleWarningRequired: warn,
    reasons: [reason],
  };
}

function deny(reason: string, action: MetadataAction = "deny"): Draft {
  return {
    action,
    allowed: false,
    persistentAllowed: false,
    networkAllowed: false,
    userVisibleWarningRequired: false,
    reasons: [reason],
  };
}

export function resolveMetadataPolicy(input: MetadataPolicyInput): MetadataPolicy {
  const { mode, event, sink } = input;
  const sensitivity = input.sensitivity ?? defaultMetadataSensitivity(event);
  const shield = input.screenShieldLevel ?? "off";
  const strict = STRICT_MODES.includes(mode);
  const sealed = shield === "sealed" || shield === "bunker";

  const finalize = (draft: Draft): MetadataPolicy => {
    // Room composition: TIGHTEN ONLY (strictest wins).
    const room = input.roomPolicy;
    let allowed = draft.allowed;
    let warn = draft.userVisibleWarningRequired;
    const reasons = [...draft.reasons];
    if (room !== undefined) {
      allowed = allowed && (room.allowed ?? true);
      warn = warn || (room.userVisibleWarningRequired ?? false);
      reasons.push("room policy composed (tighten-only)");
    }
    return {
      mode,
      event,
      sink,
      sensitivity,
      action: allowed ? draft.action : draft.action === "null" ? "null" : "deny",
      allowed,
      // v0 invariant: no metadata persistence, no metadata egress, ever.
      persistentAllowed: false,
      networkAllowed: false,
      userVisibleWarningRequired: warn,
      reason: reasons.join("; "),
    };
  };

  // ---- FAIL CLOSED: unknown mode, event, or sink ----
  if (!KNOWN_MODES.includes(mode) || !isKnownMetadataEvent(event) || !isKnownMetadataSink(sink)) {
    return finalize(deny("unknown mode/event/sink: fail closed", "null"));
  }

  const persistent = isMetadataSinkPersistent(sink) || input.storageContext?.persistent === true;
  const networked = isMetadataSinkNetworked(sink);

  // ---- Always-forbidden events (every mode) ----
  if (EXTERNAL_FETCH_EVENTS.includes(event)) {
    return finalize(
      deny("external assets / link previews / remote navigation forbidden (ADR-0008)"),
    );
  }
  if (event === "crash_report.create") {
    return finalize(deny("crash reporting forbidden (ADR-0008)"));
  }
  if (AI_METADATA_EVENTS.includes(event)) {
    return finalize(
      deny(strict ? `${mode}: AI metadata denied` : "AI metadata denied in v0 (Gate I)"),
    );
  }
  if (APPLICATION_SIGNAL_EVENTS.includes(event)) {
    return finalize(
      deny("receipts/typing/presence/last-seen off by default; denied in Private+ (v0 denies all)"),
    );
  }
  if (NOTIFICATION_EVENTS.includes(event)) {
    return finalize(
      deny(
        strict
          ? `${mode}: notification metadata denied`
          : "notifications not implemented; content denied in strict modes",
      ),
    );
  }

  // ---- Network-exposed metadata: denied in v0 (no network exists) ----
  if (networked || NETWORK_METADATA_EVENTS.includes(event)) {
    return finalize(
      deny("network-exposed metadata denied (no network in v0; offline/strict deny)"),
    );
  }

  // ---- Persistent sinks: no metadata persistence in v0 ----
  if (persistent) {
    return finalize(deny("persistent metadata sink denied (no metadata persistence in v0)"));
  }

  // ---- Emergency: deny normal generation; only a redacted wipe/revoke audit ----
  if (mode === "emergency") {
    if (
      event === "audit_event.write" &&
      (sink === "audit" || sink === "logs" || sink === "local_memory")
    ) {
      return finalize(allow("redact", "emergency: redacted wipe/revoke audit placeholder only"));
    }
    return finalize(deny("emergency: normal metadata generation denied"));
  }

  // ---- Derived previews/caches: content-adjacent (align with StoragePolicy) ----
  if (DERIVED_PREVIEW_EVENTS.includes(event)) {
    if (strict || sealed) {
      return finalize(deny(`${mode}/shield: preview/cache metadata denied in strict/sealed`));
    }
    if ((event === "preview.generated" || event === "thumbnail.generated") && mode !== "standard") {
      return finalize(
        deny(`${mode}: preview/thumbnail generation metadata denied (content-adjacent)`),
      );
    }
    if (sink === "local_memory" || sink === "cache" || sink === "ui") {
      return finalize(allow("memory_only", `${mode}: derived-artifact existence memory-only`));
    }
    return finalize(deny("derived-artifact metadata only to memory/cache/ui sink"));
  }

  // ---- Protected content reveal state ----
  if (event === "protected_content.revealed") {
    if (strict || sealed) {
      return finalize(deny(`${mode}/shield: protected reveal state denied`));
    }
    if (sink === "local_memory" || sink === "ui") {
      return finalize(
        allow("memory_only", `${mode}: reveal state memory-only, never persisted`, true),
      );
    }
    return finalize(deny("protected reveal state only to memory/ui sink"));
  }

  // ---- Other endpoint/ScreenShield signals: memory-only, redacted ----
  if (
    event === "screen.capture_detected" ||
    event === "device_risk.changed" ||
    event === "watermark.generated"
  ) {
    if (sink === "local_memory" || sink === "audit" || sink === "ui") {
      return finalize(allow("redact", `${mode}: endpoint signal memory-only, redacted`));
    }
    return finalize(deny("endpoint metadata only to memory/audit/ui sink"));
  }

  // ---- Capsule spool existence/timestamp ----
  if (event === "capsule.spool_exists" || event === "capsule.spool_timestamp") {
    if (event === "capsule.spool_timestamp" && strict) {
      return finalize(deny(`${mode}: capsule spool timestamps not retained`));
    }
    if (sink === "local_memory") {
      return finalize(allow("memory_only", `${mode}: spool existence memory-only`));
    }
    return finalize(deny("spool metadata only to memory sink"));
  }

  // ---- Logs and audit events: redacted, memory-only ----
  if (event === "audit_event.write") {
    if (sink === "audit" || sink === "logs" || sink === "local_memory") {
      return finalize(allow("redact", `${mode}: redacted audit event, memory-only`));
    }
    return finalize(deny("audit events only to audit/logs/memory sink"));
  }
  if (event === "log.write") {
    if (
      (sink === "logs" || sink === "local_memory") &&
      (sensitivity === "public" || sensitivity === "low")
    ) {
      return finalize(allow("redact", `${mode}: non-sensitive log, memory-only`));
    }
    return finalize(deny("logs must be non-sensitive metadata and memory-only"));
  }

  return finalize(deny("no rule matched: default deny"));
}
