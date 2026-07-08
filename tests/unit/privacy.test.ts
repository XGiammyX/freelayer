import { describe, expect, it } from "vitest";
import {
  POLICY_CAPABILITIES,
  resolveStrictestPolicy,
  type PolicyProfile,
  type PolicyVerdict,
} from "@freelayer/privacy";

function profile(verdict: PolicyVerdict, overrides: Partial<Record<string, PolicyVerdict>> = {}) {
  const entries = POLICY_CAPABILITIES.map((cap) => [cap, overrides[cap] ?? verdict] as const);
  return Object.fromEntries(entries) as PolicyProfile;
}

describe("resolveStrictestPolicy", () => {
  it("allows a capability only when every profile allows it", () => {
    const resolved = resolveStrictestPolicy([profile("allowed"), profile("allowed")]);
    expect(resolved.persistence).toBe("allowed");
    expect(resolved.network).toBe("allowed");
  });

  it("denies a capability when any profile denies it (strictest wins)", () => {
    const device = profile("allowed", { localAI: "denied" });
    const room = profile("allowed", { readReceipts: "denied" });
    const resolved = resolveStrictestPolicy([device, room]);
    expect(resolved.localAI).toBe("denied");
    expect(resolved.readReceipts).toBe("denied");
    expect(resolved.persistence).toBe("allowed");
  });

  it("fails closed: with no profiles, everything is denied", () => {
    const resolved = resolveStrictestPolicy([]);
    for (const capability of POLICY_CAPABILITIES) {
      expect(resolved[capability]).toBe("denied");
    }
  });
});
