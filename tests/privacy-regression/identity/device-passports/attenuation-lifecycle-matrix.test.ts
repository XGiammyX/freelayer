/**
 * Privacy-regression (TECH-ID-08 §38): Device Passport attenuation + lifecycle
 * matrix over request/passport lifecycle × approver/root eligibility × authority
 * epoch × scope × capability × privacy mode. Proves a draft may be approved ONLY
 * for an eligible root, an unchanged epoch/revision/process/candidate, a still-
 * covering grant, and no posture/policy tightening — everything else fails closed.
 */
import { describe, expect, it } from "vitest";
import {
  assertDevicePassportDraftCurrentV1,
  DevicePassportRootEpochMismatchError,
  DevicePassportScopeEscalationError,
  resolveDevicePassportGrantV1,
  resolveDevicePassportPolicyV1,
} from "@freelayer/identity";
import type { PrivacyMode } from "@freelayer/privacy";
import {
  approver,
  personaScope,
  preparedDraft,
  readOnlyScope,
  rootScope,
} from "../../../fixtures/device-passports/v1/helpers";

const DRAFT = () => preparedDraft().state.passports[0]!;

describe("Draft stale-context matrix", () => {
  // label, approver override, extra assert input, expected-ok
  const rows: ReadonlyArray<
    readonly [string, Parameters<typeof approver>[0], Record<string, unknown>, boolean]
  > = [
    ["eligible approver + fresh context", {}, {}, true],
    ["root not approval-eligible", { rootApprovalEligible: false }, {}, false],
    ["authority epoch drift", { rootAuthorityEpoch: 2 as never }, {}, false],
    ["process restart", {}, { currentProcessEpoch: "proc-2" }, false],
    ["DevicePosture at risk", {}, { postureAtRisk: true }, false],
    ["policy tightened", {}, { policyStricter: true }, false],
    ["candidate substitution", {}, { expectedCandidateDeviceRef: "dev-other" }, false],
  ];
  it.each(rows)("%s", (_label, approverOver, extra, ok) => {
    const current = DRAFT();
    const run = () =>
      assertDevicePassportDraftCurrentV1({
        current,
        approver: approver(approverOver),
        nowLocal: "local:1000",
        currentProcessEpoch: "proc-1",
        storedProcessEpoch: "proc-1",
        ...extra,
      });
    if (ok) expect(run).not.toThrow();
    else expect(run).toThrow();
  });

  it("an epoch drift surfaces as a root-epoch mismatch specifically", () => {
    expect(() =>
      assertDevicePassportDraftCurrentV1({
        current: DRAFT(),
        approver: approver({ rootAuthorityEpoch: 5 as never }),
        nowLocal: "local:1000",
        currentProcessEpoch: "proc-1",
        storedProcessEpoch: "proc-1",
      }),
    ).toThrow(DevicePassportRootEpochMismatchError);
  });
});

describe("Grant attenuation matrix", () => {
  const policy = resolveDevicePassportPolicyV1({ mode: "standard", operation: "passport.prepare" });
  function grantFor(requestedScope: ReturnType<typeof personaScope>, caps: readonly string[]) {
    const request = {
      requestedScope,
      requestedCapabilities: caps as never,
    } as never;
    return resolveDevicePassportGrantV1({ request, approver: approver(), policy });
  }

  it("persona approver: persona/relationship/read-only requests attenuate; root request escalates", () => {
    // persona request under persona max → persona.
    expect(grantFor(personaScope(), ["identity.summary.read"]).grantedScope.kind).toBe("persona");
    // read-only request → read-only (narrower).
    expect(grantFor(readOnlyScope(), []).grantedScope.kind).toBe("read_only");
    // root request under persona max → escalation.
    expect(() => grantFor(rootScope(), [])).toThrow(DevicePassportScopeEscalationError);
    // capabilities are the intersection of requested ∩ approver.
    expect(
      grantFor(personaScope(), ["identity.summary.read", "identity.device.revoke"])
        .grantedCapabilities,
    ).toEqual(["identity.summary.read"]);
  });
});

describe("Privacy-mode matrix", () => {
  const MODES: readonly PrivacyMode[] = [
    "standard",
    "private",
    "ghost",
    "bunker",
    "offline_capsule",
    "emergency",
    "sovereign_room",
  ];
  it("expansive prepare/approve deny only in Bunker/Emergency; restrictive revoke everywhere", () => {
    for (const mode of MODES) {
      const prepare = resolveDevicePassportPolicyV1({
        mode,
        operation: "passport.prepare",
      }).allowed;
      const revoke = resolveDevicePassportPolicyV1({ mode, operation: "passport.revoke" }).allowed;
      const issue = resolveDevicePassportPolicyV1({
        mode,
        operation: "passport.issue_signed_future",
      }).allowed;
      expect(prepare, `prepare:${mode}`).toBe(mode !== "bunker" && mode !== "emergency");
      expect(revoke, `revoke:${mode}`).toBe(true);
      expect(issue, `issue:${mode}`).toBe(false);
    }
  });
});
