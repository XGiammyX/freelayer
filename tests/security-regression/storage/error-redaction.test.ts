/**
 * Security-regression: storage errors never leak stored values, and the
 * sensitive-payload rules hold (docs/STORAGE_MODEL.md; no-plaintext-logging
 * hard constraint).
 */
import { describe, expect, it } from "vitest";
import { issuePolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import {
  assertStorageWriteAllowed,
  ForbiddenDebugArtifactError,
  MemoryStorageProvider,
  resolveStoragePolicy,
  StoragePolicyDeniedError,
  type StorageWriteRequest,
} from "@freelayer/storage";

const SECRET = "TOP-SECRET-VALUE-9f8e7d";

const attempt = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error: unknown) {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  throw new Error("expected the call to throw");
};

describe("Error redaction", () => {
  it("bypass-attempt errors do not include the sensitive value", async () => {
    const provider = new MemoryStorageProvider();
    const forged = {} as unknown as PolicyDecision;
    const request: StorageWriteRequest = {
      operation: "storage.write",
      dataClass: "message_content",
      key: SECRET,
      value: SECRET,
      sensitivity: "content",
      reason: "redaction test",
    };
    const policy = resolveStoragePolicy({
      mode: "private",
      dataClass: "message_content",
      sensitivity: "content",
    });
    let message = "";
    try {
      await provider.write(request, forged, policy);
    } catch (error: unknown) {
      message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    expect(message).not.toBe("");
    expect(message).not.toContain(SECRET);
  });

  it("persistent/cache/policy denial errors do not include the sensitive value", () => {
    const decision = issuePolicyDecision("persistence", "allowed", "ghost", "storage.write");
    const policy = resolveStoragePolicy({
      mode: "ghost",
      dataClass: "preview_cache",
      sensitivity: "derived_content",
    });
    const request: StorageWriteRequest = {
      operation: "storage.write",
      dataClass: "preview_cache",
      key: SECRET,
      value: SECRET,
      sensitivity: "derived_content",
      reason: "redaction test",
    };
    const message = attempt(() => assertStorageWriteAllowed(request, decision, policy));
    expect(message).not.toContain(SECRET);
  });
});

describe("Key material protection", () => {
  it("key material cannot be written to the memory provider (no key-material policy exists)", () => {
    for (const mode of ["standard", "private", "ghost", "bunker"] as const) {
      const policy = resolveStoragePolicy({
        mode,
        dataClass: "identity_key_material",
        sensitivity: "key_material",
      });
      expect(policy.allowWrite).toBe(false);
    }
  });

  it("key material persistent storage is denied because encryption is not implemented", () => {
    const decision = issuePolicyDecision("persistence", "allowed", "standard", "storage.write");
    const policy = resolveStoragePolicy({
      mode: "standard",
      dataClass: "identity_key_material",
      sensitivity: "key_material",
    });
    const request: StorageWriteRequest = {
      operation: "storage.write",
      dataClass: "identity_key_material",
      key: "root",
      value: SECRET,
      sensitivity: "key_material",
      reason: "redaction test",
    };
    const message = attempt(() => assertStorageWriteAllowed(request, decision, policy));
    expect(message).toContain("StoragePolicyDeniedError");
    expect(message).not.toContain(SECRET);
  });
});

describe("Debug artifacts and audit events", () => {
  it("debug artifact writes are denied for content", () => {
    const decision = issuePolicyDecision("persistence", "allowed", "standard", "storage.write");
    const policy = resolveStoragePolicy({
      mode: "standard",
      dataClass: "debug_artifact",
      sensitivity: "content",
    });
    const request: StorageWriteRequest = {
      operation: "storage.write",
      dataClass: "debug_artifact",
      key: "dump",
      value: SECRET,
      sensitivity: "content",
      reason: "redaction test",
    };
    expect(() => assertStorageWriteAllowed(request, decision, policy)).toThrow(
      StoragePolicyDeniedError,
    );
  });

  it("audit events must never contain plaintext content", () => {
    const decision = issuePolicyDecision(
      "persistence",
      "allowed",
      "private",
      "storage.audit.write",
    );
    const policy = resolveStoragePolicy({
      mode: "private",
      dataClass: "screen_capture_audit_event",
      sensitivity: "content",
    });
    const request: StorageWriteRequest = {
      operation: "storage.audit.write",
      dataClass: "screen_capture_audit_event",
      key: "evt-1",
      value: SECRET,
      sensitivity: "content",
      reason: "redaction test",
    };
    const message = attempt(() => assertStorageWriteAllowed(request, decision, policy));
    expect(message).toContain("ForbiddenDebugArtifactError");
    expect(message).not.toContain(SECRET);
  });

  it("audit events with security_event sensitivity are accepted in memory", () => {
    const decision = issuePolicyDecision(
      "persistence",
      "allowed",
      "private",
      "storage.audit.write",
    );
    const policy = resolveStoragePolicy({
      mode: "private",
      dataClass: "screen_capture_audit_event",
      sensitivity: "security_event",
    });
    const request: StorageWriteRequest = {
      operation: "storage.audit.write",
      dataClass: "screen_capture_audit_event",
      key: "evt-2",
      value: "[redacted:capture-event]",
      sensitivity: "security_event",
      reason: "redaction test",
    };
    expect(() => assertStorageWriteAllowed(request, decision, policy)).not.toThrow();
  });
});
