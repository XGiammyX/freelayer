/**
 * Privacy-regression (TECH-10): the allowed (memory-only, redacted) metadata
 * paths and the helper predicates. Complements metadata-policy.test.ts (which
 * concentrates on denials) so both sides of the matrix are exercised.
 */
import { describe, expect, it } from "vitest";
import {
  createRedactedAuditEvent,
  defaultMetadataSensitivity,
  evaluateNotificationPolicy,
  evaluatePresencePolicy,
  expectedMetadataCapability,
  expectedMetadataScope,
  isMetadataEventForbiddenInMode,
  isMetadataSinkNetworked,
  isMetadataSinkPersistent,
  redactMetadataPayload,
  resolveMetadataPolicy,
} from "@freelayer/privacy";

describe("Allowed metadata paths (memory-only, redacted)", () => {
  it("audit events are allowed and redacted in non-emergency modes", () => {
    for (const mode of ["standard", "private", "ghost", "bunker", "sovereign_room"] as const) {
      const p = resolveMetadataPolicy({ mode, event: "audit_event.write", sink: "audit" });
      expect(p.allowed, mode).toBe(true);
      expect(p.action, mode).toBe("redact");
      expect(p.persistentAllowed, mode).toBe(false);
      expect(p.networkAllowed, mode).toBe(false);
    }
  });

  it("emergency allows only a redacted wipe/revoke audit placeholder", () => {
    expect(
      resolveMetadataPolicy({ mode: "emergency", event: "audit_event.write", sink: "audit" })
        .allowed,
    ).toBe(true);
    expect(
      resolveMetadataPolicy({ mode: "emergency", event: "log.write", sink: "logs" }).allowed,
    ).toBe(false);
    expect(
      resolveMetadataPolicy({
        mode: "emergency",
        event: "capsule.spool_exists",
        sink: "local_memory",
      }).allowed,
    ).toBe(false);
  });

  it("non-sensitive logs allowed memory-only; sensitive logs denied", () => {
    expect(
      resolveMetadataPolicy({
        mode: "standard",
        event: "log.write",
        sink: "logs",
        sensitivity: "low",
      }).allowed,
    ).toBe(true);
    expect(
      resolveMetadataPolicy({
        mode: "standard",
        event: "log.write",
        sink: "logs",
        sensitivity: "critical",
      }).allowed,
    ).toBe(false);
  });

  it("spool existence allowed in memory; timestamp denied in strict modes", () => {
    expect(
      resolveMetadataPolicy({
        mode: "private",
        event: "capsule.spool_exists",
        sink: "local_memory",
      }).allowed,
    ).toBe(true);
    expect(
      resolveMetadataPolicy({
        mode: "ghost",
        event: "capsule.spool_timestamp",
        sink: "local_memory",
      }).allowed,
    ).toBe(false);
  });

  it("endpoint signals allowed memory-only in relaxed modes", () => {
    for (const event of [
      "screen.capture_detected",
      "device_risk.changed",
      "watermark.generated",
    ] as const) {
      const p = resolveMetadataPolicy({ mode: "standard", event, sink: "audit" });
      expect(p.allowed, event).toBe(true);
      expect(p.action, event).toBe("redact");
    }
  });

  it("protected reveal allowed memory-only in Standard, with a user-visible warning", () => {
    const p = resolveMetadataPolicy({
      mode: "standard",
      event: "protected_content.revealed",
      sink: "local_memory",
    });
    expect(p.allowed).toBe(true);
    expect(p.action).toBe("memory_only");
    expect(p.userVisibleWarningRequired).toBe(true);
  });

  it("preview existence allowed memory-only in Standard; denied in Private+", () => {
    expect(
      resolveMetadataPolicy({ mode: "standard", event: "preview.generated", sink: "cache" })
        .allowed,
    ).toBe(true);
    expect(
      resolveMetadataPolicy({ mode: "private", event: "preview.generated", sink: "cache" }).allowed,
    ).toBe(false);
    expect(
      resolveMetadataPolicy({ mode: "standard", event: "cache.exists", sink: "local_memory" })
        .allowed,
    ).toBe(true);
  });
});

describe("Helper predicates", () => {
  it("classifies persistent and networked sinks", () => {
    expect(isMetadataSinkPersistent("local_persistent_storage")).toBe(true);
    expect(isMetadataSinkPersistent("build_artifact")).toBe(true);
    expect(isMetadataSinkPersistent("local_memory")).toBe(false);
    expect(isMetadataSinkNetworked("network")).toBe(true);
    expect(isMetadataSinkNetworked("transport_envelope")).toBe(true);
    expect(isMetadataSinkNetworked("audit")).toBe(false);
  });

  it("isMetadataEventForbiddenInMode covers always-forbidden and mode-specific", () => {
    expect(isMetadataEventForbiddenInMode("standard", "link.preview")).toBe(true);
    expect(isMetadataEventForbiddenInMode("standard", "receipt.read")).toBe(true);
    expect(isMetadataEventForbiddenInMode("standard", "ai.prompt_exists")).toBe(true);
    expect(isMetadataEventForbiddenInMode("standard", "transport.poll")).toBe(true);
    expect(isMetadataEventForbiddenInMode("ghost", "protected_content.revealed")).toBe(true);
    expect(isMetadataEventForbiddenInMode("private", "preview.generated")).toBe(true);
    expect(isMetadataEventForbiddenInMode("standard", "audit_event.write")).toBe(false);
  });

  it("defaultMetadataSensitivity maps event families", () => {
    expect(defaultMetadataSensitivity("receipt.read")).toBe("relationship");
    expect(defaultMetadataSensitivity("link.preview")).toBe("content_adjacent");
    expect(defaultMetadataSensitivity("transport.size")).toBe("sensitive");
    expect(defaultMetadataSensitivity("protected_content.revealed")).toBe("critical");
    expect(defaultMetadataSensitivity("unknown")).toBe("unknown");
    expect(defaultMetadataSensitivity("capsule.spool_exists")).toBe("low");
  });

  it("expectedMetadataScope/Capability map events correctly", () => {
    expect(expectedMetadataScope("receipt.read", "transport_envelope")).toBe("receipt.emit");
    expect(expectedMetadataScope("typing.start", "transport_envelope")).toBe("typing.emit");
    expect(expectedMetadataScope("presence.online", "transport_envelope")).toBe("presence.emit");
    expect(expectedMetadataScope("notification.preview", "notification_system")).toBe(
      "notification.show",
    );
    expect(expectedMetadataScope("transport.size", "network")).toBe("metadata.network_expose");
    expect(expectedMetadataScope("device_risk.changed", "local_persistent_storage")).toBe(
      "metadata.store",
    );
    expect(expectedMetadataScope("device_risk.changed", "local_memory")).toBe("metadata.emit");
    expect(expectedMetadataCapability("link.preview")).toBe("linkPreviews");
    expect(expectedMetadataCapability("ai.cache_exists")).toBe("localAI");
    expect(expectedMetadataCapability("preview.generated")).toBe("mediaCache");
    expect(expectedMetadataCapability("audit_event.write")).toBe("persistence");
  });

  it("redaction keeps only numeric/boolean counters", () => {
    expect(redactMetadataPayload(5).safe).toEqual({ value: 5 });
    expect(redactMetadataPayload("secret").safe).toEqual({});
    expect(redactMetadataPayload([1, 2, 3]).safe).toEqual({});
    expect(redactMetadataPayload({ n: 2, ok: true, name: "x" }).safe).toEqual({ n: 2, ok: true });
  });

  it("createRedactedAuditEvent works without details", () => {
    const e = createRedactedAuditEvent({ kind: "k", category: "metadata", severity: "info" });
    expect(e.redacted).toBe(true);
    expect(e.details).toEqual({});
  });

  it("notification alias and presence offline resolve", () => {
    expect(evaluateNotificationPolicy({ mode: "standard", part: "preview" }).allowed).toBe(false);
    expect(evaluatePresencePolicy({ mode: "private", state: "offline" }).allowed).toBe(false);
  });
});
