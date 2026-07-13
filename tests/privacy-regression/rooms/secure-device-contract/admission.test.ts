/**
 * Privacy-regression (TECH-23): Secure Device admission CONTRACT. FreeLayer is
 * the future RATS Relying Party only; no provider is integrated; posture above
 * `unverified` cannot be established; `at_risk` can only restrict; assessments
 * are transient, evidence-free, provenance-checked; admission + session are
 * deterministic, fail-closed, and never replace membership/capability/
 * PolicyDecision. Covers §23 (1-28).
 */
import { describe, expect, it } from "vitest";
import {
  NullSecureDeviceProviderV1,
  assertSensitiveRoomSessionCurrentV1,
  buildProductionProviderStatusV1,
  checkAssessmentFreshnessV1,
  classifyProviderTransitionV1,
  createSensitiveRoomSessionV1,
  isAcceptedDevicePostureAssessmentV1,
  isStructurallyValidAssessmentV1,
  noProviderAssessmentV1,
  PROVIDER_RECOVERY_REQUIREMENT_V1,
  providerTrustedForElevationV1,
  resolveDevicePostureAssessmentV1,
  resolveSensitiveRoomAdmissionV1,
  SensitiveRoomAdmissionDeniedError,
  SensitiveRoomSessionStaleError,
  type MinimumDevicePostureV1,
  type SensitiveRoomAdmissionActionV1,
  type SensitiveRoomSessionCurrentContextV1,
} from "@freelayer/rooms";
import {
  atRiskAssessment,
  claimedHighAssurance,
  evidenceBearingObject,
  forgedAssessment,
  membership,
  NULL_CAPS,
  NULL_STATUS,
  providerStatus,
  requiring,
  roomPolicy,
  staleAssessment,
  unverifiedAssessment,
} from "../../../fixtures/secure-device-contract/v1/synthetic";

function admit(
  action: SensitiveRoomAdmissionActionV1,
  over?: Partial<Parameters<typeof resolveSensitiveRoomAdmissionV1>[0]>,
) {
  return resolveSensitiveRoomAdmissionV1({
    action,
    roomPolicy: roomPolicy("standard"),
    privacyMode: "standard",
    roomLifecycle: "active_local",
    membership: membership(),
    providerStatus: NULL_STATUS,
    providerCapabilities: NULL_CAPS,
    assessment: unverifiedAssessment(),
    ...over,
  });
}

describe("Null provider (§23: 1-4)", () => {
  const provider = new NullSecureDeviceProviderV1();

  it("reports not_integrated (1)", () => {
    expect(provider.status().lifecycle).toBe("not_integrated");
    expect(provider.status().trustedForPostureElevation).toBe(false);
  });

  it("is deterministic and side-effect-free (2)", () => {
    expect(provider.status()).toEqual(provider.status());
    expect(provider.capabilities()).toEqual(provider.capabilities());
    // Two assessments are structurally identical except identity (fresh objects).
    const a = provider.currentAssessment();
    const b = provider.currentAssessment();
    expect({ ...a }).toEqual({ ...b });
  });

  it("returns effective unverified (3)", () => {
    expect(provider.currentAssessment().effectivePosture).toBe("unverified");
  });

  it("no production trusted-elevation provider exists (4)", () => {
    expect(providerTrustedForElevationV1(NULL_STATUS)).toBe(false);
    // A future/ready lifecycle is coerced to unavailable by the production factory.
    const coerced = buildProductionProviderStatusV1("ready_future");
    expect(coerced.lifecycle).toBe("unavailable");
    expect(providerTrustedForElevationV1(coerced)).toBe(false);
  });
});

describe("Posture normalization (§23: 5-13)", () => {
  it("structural basic+ values do not elevate (5)", () => {
    for (const claim of ["basic", "hardened", "high_assurance", "managed_bunker"] as const) {
      const a = resolveDevicePostureAssessmentV1({
        reportedPosture: claim,
        source: "untrusted_local",
      });
      expect(a.effectivePosture).toBe("unverified");
    }
    expect(claimedHighAssurance().effectivePosture).toBe("unverified");
  });

  it("untrusted at_risk tightens (6)", () => {
    expect(atRiskAssessment().effectivePosture).toBe("at_risk");
  });

  it("missing assessment → unverified (7)", () => {
    expect(noProviderAssessmentV1().effectivePosture).toBe("unverified");
  });

  it("malformed/unknown assessments reject (8)", () => {
    expect(isAcceptedDevicePostureAssessmentV1(undefined)).toBe(false);
    expect(isAcceptedDevicePostureAssessmentV1({})).toBe(false);
    expect(isAcceptedDevicePostureAssessmentV1({ schemaVersion: 1 })).toBe(false);
    expect(isAcceptedDevicePostureAssessmentV1(forgedAssessment())).toBe(false);
  });

  it("stale assessment cannot elevate (9)", () => {
    const stale = staleAssessment();
    expect(checkAssessmentFreshnessV1({ assessment: stale }).fresh).toBe(false);
    const d = admit("room.content.read", {
      roomPolicy: roomPolicy("standard"),
      assessment: stale,
    });
    expect(d.outcome).toBe("deny_assessment_stale");
  });

  it("revision rollback rejects (10)", () => {
    const older = unverifiedAssessment(2);
    expect(checkAssessmentFreshnessV1({ assessment: older, priorRevision: 5 }).fresh).toBe(false);
    expect(
      classifyProviderTransitionV1({
        lifecycle: "not_integrated",
        effectivePosture: "unverified",
        freshness: "current_process_only",
        previousRevision: 5,
        nextRevision: 2,
      }).effect,
    ).toBe("reject_rollback");
  });

  it("raw evidence / identifiers / inventory reject (11-12)", () => {
    const bad = evidenceBearingObject();
    expect(isStructurallyValidAssessmentV1(bad)).toBe(false);
    expect(isAcceptedDevicePostureAssessmentV1(bad)).toBe(false);
  });

  it("a real assessment contains no evidence or identifiers (13)", () => {
    const keys = Object.keys(unverifiedAssessment());
    for (const forbidden of [
      "rawEvidence",
      "evidence",
      "deviceId",
      "serial",
      "installedApps",
      "packages",
      "measurementLog",
      "assessmentHistory",
      "osBuild",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
    const a = unverifiedAssessment();
    expect(a.rawEvidenceIncluded).toBe(false);
    expect(a.deviceIdentifiersIncluded).toBe(false);
    expect(a.telemetryEmitted).toBe(false);
    expect(a.deviceManagementPerformed).toBe(false);
  });
});

describe("Admission decisions (§23: 14-23)", () => {
  it("assessments/sessions are transient (14, 25)", () => {
    const d = admit("room.content.read");
    const session = createSensitiveRoomSessionV1({
      decision: d,
      privacyMode: "standard",
      protectedContentRequirement: "policy_redaction_only",
    });
    expect(session.persistence).toBe("forbidden");
    expect(session.crossRestartValidity).toBe(false);
  });

  it("normal unverified room permits content (15)", () => {
    const d = admit("room.content.read", {
      roomPolicy: requiring("unverified", "policy_redaction_only"),
    });
    expect(d.allowed).toBe(true);
    expect(d.outcome).toBe("allow");
  });

  it("every basic+ requirement denies current content access (16)", () => {
    for (const req of ["basic", "hardened", "high_assurance", "managed_bunker"] as const) {
      const min = req as MinimumDevicePostureV1;
      const d = admit("room.content.read", { roomPolicy: requiring(min) });
      expect(d.allowed, req).toBe(false);
      expect(["deny_minimum_posture", "deny_provider_unavailable"], req).toContain(d.outcome);
    }
  });

  it("at_risk denies read/mutate/search/export/copy/file/AI (17)", () => {
    for (const action of [
      "room.content.read",
      "room.content.mutate",
      "room.content.search",
      "room.content.export",
      "room.content.copy",
      "room.file.open",
      "room.local_ai.use",
    ] as const) {
      const d = admit(action, {
        roomPolicy: requiring("unverified", "policy_redaction_only"),
        assessment: atRiskAssessment(),
      });
      expect(d.allowed, action).toBe(false);
      expect(d.outcome, action).toBe("deny_posture_at_risk");
    }
  });

  it("redacted summary remains separately gated (18)", () => {
    // Content denied under a basic+ room, but the redacted summary is allowed.
    const content = admit("room.content.read", { roomPolicy: requiring("hardened") });
    expect(content.allowed).toBe(false);
    const summary = admit("room.summary.redacted", { roomPolicy: requiring("hardened") });
    expect(summary.allowed).toBe(true);
    expect(summary.outcome).toBe("allow_redacted_summary_only");
  });

  it("ScreenShield/ProtectedContent/Bunker requirements deny safely (19-20)", () => {
    const shield = admit("room.content.read", {
      roomPolicy: requiring("unverified", "screen_shield_future_required"),
    });
    expect(shield.allowed).toBe(false);
    expect(shield.outcome).toBe("deny_protected_presentation_unavailable");

    const secure = admit("room.content.read", {
      roomPolicy: requiring("unverified", "secure_device_future_required"),
    });
    expect(secure.allowed).toBe(false);

    const bunker = admit("room.content.read", {
      roomPolicy: requiring("unverified", "managed_bunker_future_required"),
    });
    expect(bunker.allowed).toBe(false);
    expect(bunker.outcome).toBe("deny_bunker_session_unavailable");
    // No silent downgrade: never an allow for a protected-required room.
    expect([shield, secure, bunker].every((d) => !d.allowed)).toBe(true);
  });

  it("admission does not replace membership/capability/PolicyDecision (21-22)", () => {
    // Suspended membership is screened out.
    const suspended = admit("room.content.read", {
      roomPolicy: requiring("unverified"),
      membership: membership("suspended_local"),
    });
    expect(suspended.outcome).toBe("deny_membership");
    // The decision is NOT a PolicyDecision (carries no id/sideEffect/verdict).
    const d = admit("room.content.read", { roomPolicy: requiring("unverified") });
    expect(d).not.toHaveProperty("id");
    expect(d).not.toHaveProperty("sideEffect");
    expect(d).not.toHaveProperty("verdict");
  });

  it("admission decision is deterministic and content-free (23)", () => {
    const a = admit("room.content.read", { roomPolicy: requiring("unverified") });
    const b = admit("room.content.read", { roomPolicy: requiring("unverified") });
    expect(a).toEqual(b);
    expect(a.redacted).toBe(true);
  });
});

describe("Session lifecycle (§23: 24-28)", () => {
  it("denied admission cannot create an admitted session (24)", () => {
    const denied = admit("room.content.read", { roomPolicy: requiring("hardened") });
    expect(denied.allowed).toBe(false);
    expect(() =>
      createSensitiveRoomSessionV1({
        decision: denied,
        privacyMode: "standard",
        protectedContentRequirement: "policy_redaction_only",
      }),
    ).toThrow(SensitiveRoomAdmissionDeniedError);
  });

  it("environment/policy/membership/mode/lifecycle/action changes invalidate (26, 28)", () => {
    const decision = admit("room.content.read", { roomPolicy: requiring("unverified") });
    const session = createSensitiveRoomSessionV1({
      decision,
      privacyMode: "standard",
      protectedContentRequirement: "policy_redaction_only",
      membershipRevision: membership().revision,
    });
    const current: SensitiveRoomSessionCurrentContextV1 = {
      assessmentRevision: session.assessmentRevision,
      roomPolicyRevision: session.roomPolicyRevision,
      membershipRevision: membership().revision,
      privacyMode: "standard",
      roomLifecycle: "active_local",
      effectivePosture: "unverified",
      providerLifecycle: "not_integrated",
      freshness: "current_process_only",
      protectedContentRequirement: "policy_redaction_only",
      action: "room.content.read",
    };
    // Baseline: still current.
    expect(() => assertSensitiveRoomSessionCurrentV1({ session, current })).not.toThrow();
    // Each mutation invalidates.
    const mutations: Array<Partial<SensitiveRoomSessionCurrentContextV1>> = [
      { assessmentRevision: current.assessmentRevision + 1 },
      { effectivePosture: "at_risk" },
      { providerLifecycle: "failed" },
      { freshness: "stale" },
      { privacyMode: "ghost" },
      { roomLifecycle: "archived_local" },
      { action: "room.content.mutate" },
      { protectedContentRequirement: "screen_shield_future_required" },
    ];
    for (const m of mutations) {
      expect(() =>
        assertSensitiveRoomSessionCurrentV1({ session, current: { ...current, ...m } }),
      ).toThrow(SensitiveRoomSessionStaleError);
    }
  });

  it("recovery requires fresh assessment/admission/authorization (27)", () => {
    expect(PROVIDER_RECOVERY_REQUIREMENT_V1.requiresFreshAssessment).toBe(true);
    expect(PROVIDER_RECOVERY_REQUIREMENT_V1.requiresFreshAdmission).toBe(true);
    expect(PROVIDER_RECOVERY_REQUIREMENT_V1.requiresFreshAuthorization).toBe(true);
    expect(PROVIDER_RECOVERY_REQUIREMENT_V1.restoresOldSession).toBe(false);
    expect(PROVIDER_RECOVERY_REQUIREMENT_V1.autoRevealsContent).toBe(false);
    expect(PROVIDER_RECOVERY_REQUIREMENT_V1.emitsBackgroundNotification).toBe(false);
    // A recovered (unavailable) provider invalidates rather than restores.
    expect(
      classifyProviderTransitionV1({
        lifecycle: "unavailable",
        effectivePosture: "unverified",
        freshness: "current_process_only",
      }).effect,
    ).toBe("invalidate_admission");
  });

  it("content denied while provider unavailable for a basic+ room", () => {
    const d = admit("room.content.read", {
      roomPolicy: requiring("hardened"),
      providerStatus: providerStatus("unavailable"),
    });
    expect(d.outcome).toBe("deny_provider_unavailable");
  });
});
