/**
 * Security-regression (stabilize/harden): PolicyDecision authenticity.
 *
 * The decision registry is a module-private WeakSet — only objects returned by
 * issuePolicyDecision are authentic. A forged object with every correct field
 * is rejected, closing the "forgeable Symbol.for mark" limitation documented
 * since TECH-05.
 */
import { describe, expect, it } from "vitest";
import { isPolicyDecision, issuePolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { MemoryStorageProvider, resolveStoragePolicy } from "@freelayer/storage";
import { StorageBypassAttemptError } from "@freelayer/storage";

describe("PolicyDecision authenticity (unforgeable)", () => {
  it("accepts a genuine decision from the factory", () => {
    const real = issuePolicyDecision("persistence", "allowed", "private", "storage.write");
    expect(isPolicyDecision(real)).toBe(true);
  });

  it("rejects a forged object that copies every field of a real decision", () => {
    const real = issuePolicyDecision("persistence", "allowed", "private", "storage.write");
    // Structurally identical forgery — same id, capability, scope, verdict, mode.
    const forged = { ...real } as PolicyDecision;
    expect(isPolicyDecision(forged)).toBe(false);
  });

  it("rejects a hand-built look-alike", () => {
    const forged = {
      id: "pd-999",
      capability: "persistence",
      sideEffect: "storage.write",
      verdict: "allowed",
      mode: "private",
      issuedAtLogical: 999,
    } as unknown as PolicyDecision;
    expect(isPolicyDecision(forged)).toBe(false);
  });

  it("the storage barrier rejects a structurally-perfect forgery", async () => {
    const real = issuePolicyDecision("persistence", "allowed", "private", "storage.write");
    const forged = { ...real } as PolicyDecision;
    const provider = new MemoryStorageProvider();
    const policy = resolveStoragePolicy({
      mode: "private",
      dataClass: "message_content",
      sensitivity: "content",
    });
    await expect(
      provider.write(
        {
          operation: "storage.write",
          dataClass: "message_content",
          key: "k",
          value: "v",
          sensitivity: "content",
          reason: "forgery test",
        },
        forged,
        policy,
      ),
    ).rejects.toBeInstanceOf(StorageBypassAttemptError);
  });

  it("non-objects are rejected", () => {
    expect(isPolicyDecision(null)).toBe(false);
    expect(isPolicyDecision(undefined)).toBe(false);
    expect(isPolicyDecision("pd-1")).toBe(false);
    expect(isPolicyDecision(42)).toBe(false);
  });
});
