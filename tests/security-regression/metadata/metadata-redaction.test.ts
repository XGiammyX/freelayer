/**
 * Security-regression (TECH-10): the Metadata Firewall must not leak. Errors,
 * redacted audit events, and redacted payloads never carry content,
 * identifiers, endpoints, or the sensitive sentinel — verified with the shared
 * sentinel harness (tests/helpers/sentinel.ts).
 */
import { describe, expect, it } from "vitest";
import {
  assertMetadataOperationAllowed,
  assertNoSensitiveMetadataPayload,
  createRedactedAuditEvent,
  expectedMetadataCapability,
  expectedMetadataScope,
  issuePolicyDecision,
  redactMetadataPayload,
  resolveMetadataPolicy,
  type MetadataOperationRequest,
  type PolicyDecision,
} from "@freelayer/privacy";
import {
  assertOutputDoesNotContainSentinel,
  captureConsoleOutput,
  SENTINEL,
} from "../../helpers/sentinel";

function errorText(fn: () => void): string {
  try {
    fn();
  } catch (error: unknown) {
    return error instanceof Error
      ? `${error.name}: ${error.message} ${error.stack ?? ""}`
      : String(error);
  }
  throw new Error("expected the operation to throw");
}

describe("Metadata payload redaction (test 26)", () => {
  it("removes content strings, keeping only numeric/boolean counters", () => {
    const redacted = redactMetadataPayload({
      room: "project-alpha",
      contact: "Alice",
      body: SENTINEL,
      count: 3,
      muted: true,
    });
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("project-alpha");
    expect(serialized).not.toContain("Alice");
    expect(serialized).not.toContain(SENTINEL);
    expect(redacted.safe).toEqual({ count: 3, muted: true });
  });

  it("rejects sensitive payloads at the assertion boundary", () => {
    expect(() => assertNoSensitiveMetadataPayload({ room: "project-alpha" })).toThrow();
    expect(() => assertNoSensitiveMetadataPayload(SENTINEL)).toThrow();
    expect(() => assertNoSensitiveMetadataPayload({ count: 2, ok: true })).not.toThrow();
    expect(() => assertNoSensitiveMetadataPayload(undefined)).not.toThrow();
  });
});

describe("Errors never leak payload / identifiers / sentinel", () => {
  it("a denied metadata op throws a sentinel-free, identifier-free error (test 27)", () => {
    const request: MetadataOperationRequest = {
      event: "typing.start",
      sink: "transport_envelope",
      sensitivity: "relationship",
      reason: "typing in project-alpha",
      payload: { room: "project-alpha", secret: SENTINEL },
    };
    const policy = resolveMetadataPolicy({
      mode: "private",
      event: "typing.start",
      sink: "transport_envelope",
    });
    const decision = issuePolicyDecision(
      expectedMetadataCapability("typing.start"),
      "allowed",
      "private",
      expectedMetadataScope("typing.start", "transport_envelope"),
    );
    const text = errorText(() => assertMetadataOperationAllowed(request, decision, policy));
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain("project-alpha");
    expect(text).not.toContain("Alice");
  });

  it("bypass/mismatch errors are generic", () => {
    const request: MetadataOperationRequest = {
      event: "audit_event.write",
      sink: "audit",
      sensitivity: "low",
      reason: "audit",
    };
    const policy = resolveMetadataPolicy({
      mode: "private",
      event: "audit_event.write",
      sink: "audit",
    });
    const forged = {
      id: "pd-forged",
      capability: "persistence",
      sideEffect: "metadata.audit",
      verdict: "allowed",
      mode: "private",
      issuedAtLogical: 1,
    } as unknown as PolicyDecision;
    const text = errorText(() => assertMetadataOperationAllowed(request, forged, policy));
    expect(text).toContain("bypass");
    expect(text).not.toContain(SENTINEL);
  });
});

describe("Redacted audit event (test 28)", () => {
  it("drops non-scalar/string details and never contains the sentinel", () => {
    const event = createRedactedAuditEvent({
      kind: "metadata.denied",
      category: "metadata",
      severity: "warning",
      details: {
        room: "project-alpha",
        note: SENTINEL,
        attempts: 2,
        blocked: true,
      },
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).not.toContain("project-alpha");
    expect(event.details).toEqual({ attempts: 2, blocked: true });
    expect(event.redacted).toBe(true);
    // Coarse logical label, never an exact timestamp.
    expect(event.createdAtLocal.startsWith("logical:")).toBe(true);
  });
});

describe("Sentinel never reaches console (test 29)", () => {
  it("metadata operations do not print the sentinel", async () => {
    const output = await captureConsoleOutput(() => {
      redactMetadataPayload({ body: SENTINEL, count: 1 });
      createRedactedAuditEvent({
        kind: "metadata.denied",
        category: "metadata",
        severity: "info",
        details: { note: SENTINEL },
      });
      resolveMetadataPolicy({ mode: "ghost", event: "receipt.read", sink: "transport_envelope" });
    });
    assertOutputDoesNotContainSentinel(output);
  });
});

describe("Decision authenticity (existing WeakSet provenance)", () => {
  it("rejects a forged decision and accepts a genuine one", () => {
    const request: MetadataOperationRequest = {
      event: "audit_event.write",
      sink: "audit",
      sensitivity: "low",
      reason: "audit",
    };
    const policy = resolveMetadataPolicy({
      mode: "private",
      event: "audit_event.write",
      sink: "audit",
    });
    const genuine = issuePolicyDecision("persistence", "allowed", "private", "metadata.audit");
    expect(() => assertMetadataOperationAllowed(request, genuine, policy)).not.toThrow();

    const forged = { ...genuine } as PolicyDecision;
    expect(() => assertMetadataOperationAllowed(request, forged, policy)).toThrow(/bypass/i);
  });
});
