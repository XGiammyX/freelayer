/**
 * Privacy-regression: the write barrier rejects everything it must
 * (docs/STORAGE_MODEL.md — write barrier; ADR-0002/0005).
 */
import { describe, expect, it } from "vitest";
import { issuePolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import {
  assertStorageWriteAllowed,
  MemoryStorageProvider,
  resolveStoragePolicy,
  StorageBackendNotImplementedError,
  StorageBypassAttemptError,
  StorageDecisionMismatchError,
  StoragePolicyDeniedError,
  type StorageWriteRequest,
} from "@freelayer/storage";

const memoryWrite = (): StorageWriteRequest => ({
  operation: "storage.write",
  dataClass: "message_content",
  key: "k",
  value: "v",
  sensitivity: "content",
  reason: "regression test",
});

const privateContentPolicy = () =>
  resolveStoragePolicy({ mode: "private", dataClass: "message_content", sensitivity: "content" });

describe("Write barrier — decision requirements", () => {
  it("requires a PolicyDecision (forged objects are bypass attempts)", async () => {
    const provider = new MemoryStorageProvider();
    const forged = { verdict: "allowed" } as unknown as PolicyDecision;
    await expect(
      provider.write(memoryWrite(), forged, privateContentPolicy()),
    ).rejects.toBeInstanceOf(StorageBypassAttemptError);
  });

  it("rejects a denied decision", () => {
    const denied = issuePolicyDecision("persistence", "denied", "private", "storage.write");
    expect(() => assertStorageWriteAllowed(memoryWrite(), denied, privateContentPolicy())).toThrow(
      StoragePolicyDeniedError,
    );
  });

  it("rejects a decision scoped to a different side effect", () => {
    const wrongScope = issuePolicyDecision("persistence", "allowed", "private", "storage.read");
    expect(() =>
      assertStorageWriteAllowed(memoryWrite(), wrongScope, privateContentPolicy()),
    ).toThrow(StorageDecisionMismatchError);
  });

  it("rejects a decision with the wrong capability", () => {
    const wrongCapability = issuePolicyDecision("network", "allowed", "private", "storage.write");
    expect(() =>
      assertStorageWriteAllowed(memoryWrite(), wrongCapability, privateContentPolicy()),
    ).toThrow(StorageDecisionMismatchError);
  });

  it("does not accept generic decisions for storage operations", () => {
    const generic = issuePolicyDecision("persistence", "allowed", "private", "generic");
    expect(() => assertStorageWriteAllowed(memoryWrite(), generic, privateContentPolicy())).toThrow(
      StorageDecisionMismatchError,
    );
  });
});

describe("Write barrier — policy enforcement", () => {
  it("denies writes when the resolved policy denies them (Ghost + AI cache)", () => {
    const decision = issuePolicyDecision("persistence", "allowed", "ghost", "storage.write");
    const policy = resolveStoragePolicy({
      mode: "ghost",
      dataClass: "ai_prompt_cache",
      sensitivity: "derived_content",
    });
    const request: StorageWriteRequest = {
      operation: "storage.write",
      dataClass: "ai_prompt_cache",
      key: "k",
      value: "v",
      sensitivity: "derived_content",
      reason: "regression test",
    };
    expect(() => assertStorageWriteAllowed(request, decision, policy)).toThrow(
      StoragePolicyDeniedError,
    );
  });

  it("denies cache writes when caching is denied (Bunker cache via cache.write)", () => {
    const decision = issuePolicyDecision("mediaCache", "allowed", "bunker", "storage.cache.write");
    const policy = resolveStoragePolicy({
      mode: "bunker",
      dataClass: "media_cache",
      sensitivity: "derived_content",
    });
    const request: StorageWriteRequest = {
      operation: "storage.cache.write",
      dataClass: "media_cache",
      key: "k",
      value: "v",
      sensitivity: "derived_content",
      reason: "regression test",
    };
    // allowWrite=false throws PolicyDenied first; both are hard denials.
    expect(() => assertStorageWriteAllowed(request, decision, policy)).toThrow(/rejected|denied/i);
  });

  it("cache write against an allowing mode still requires allowCache (sealed ScreenShield)", () => {
    const decision = issuePolicyDecision(
      "mediaCache",
      "allowed",
      "standard",
      "storage.cache.write",
    );
    const policyAllowing = resolveStoragePolicy({
      mode: "standard",
      dataClass: "media_cache",
      sensitivity: "derived_content",
    });
    expect(policyAllowing.allowCache).toBe(true);
    const sealed = resolveStoragePolicy({
      mode: "standard",
      dataClass: "media_cache",
      sensitivity: "derived_content",
      screenShieldLevel: "sealed",
    });
    const request: StorageWriteRequest = {
      operation: "storage.cache.write",
      dataClass: "media_cache",
      key: "k",
      value: "v",
      sensitivity: "derived_content",
      reason: "regression test",
    };
    expect(() => assertStorageWriteAllowed(request, decision, sealed)).toThrow(
      StoragePolicyDeniedError,
    );
    expect(sealed.allowCache).toBe(false);
  });

  it("standard-mode content writes fail hard: encrypted backend is not implemented", () => {
    const decision = issuePolicyDecision("persistence", "allowed", "standard", "storage.write");
    const policy = resolveStoragePolicy({
      mode: "standard",
      dataClass: "message_content",
      sensitivity: "content",
    });
    expect(() => assertStorageWriteAllowed(memoryWrite(), decision, policy)).toThrow(
      StorageBackendNotImplementedError,
    );
  });
});
