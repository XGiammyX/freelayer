import { describe, expect, it } from "vitest";
import { issuePolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { PolicyBypassError, ForbiddenSideEffectError } from "@freelayer/security";
import { MemoryStorageProvider, NullStorageProvider } from "@freelayer/storage";

const allowed = () => issuePolicyDecision("persistence", "allowed", "standard");

const request = {
  dataClass: "settings" as const,
  key: "test-key",
  value: new Uint8Array([1, 2, 3]),
};

describe("NullStorageProvider", () => {
  it("stores nothing: reads return null even after a policy-approved write", async () => {
    const provider = new NullStorageProvider();
    await provider.write(request, allowed());
    const read = await provider.read({ dataClass: "settings", key: "test-key" }, allowed());
    expect(read).toBeNull();
  });
});

describe("MemoryStorageProvider", () => {
  it("holds values in memory within one instance", async () => {
    const provider = new MemoryStorageProvider();
    await provider.write(request, allowed());
    const read = await provider.read({ dataClass: "settings", key: "test-key" }, allowed());
    expect(read).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("does not persist across instance recreation", async () => {
    const first = new MemoryStorageProvider();
    await first.write(request, allowed());
    const second = new MemoryStorageProvider();
    const read = await second.read({ dataClass: "settings", key: "test-key" }, allowed());
    expect(read).toBeNull();
  });

  it("rejects calls without a valid PolicyDecision (anti-bypass)", async () => {
    const provider = new MemoryStorageProvider();
    const forged = { verdict: "allowed" } as unknown as PolicyDecision;
    await expect(provider.write(request, forged)).rejects.toBeInstanceOf(PolicyBypassError);
  });

  it("rejects a decision issued for the wrong capability", async () => {
    const provider = new MemoryStorageProvider();
    const wrongCapability = issuePolicyDecision("network", "allowed", "standard");
    await expect(provider.write(request, wrongCapability)).rejects.toBeInstanceOf(
      PolicyBypassError,
    );
  });

  it("rejects a denied decision (policy forbids the side effect)", async () => {
    const provider = new MemoryStorageProvider();
    const denied = issuePolicyDecision("persistence", "denied", "ghost");
    await expect(provider.write(request, denied)).rejects.toBeInstanceOf(ForbiddenSideEffectError);
  });
});
