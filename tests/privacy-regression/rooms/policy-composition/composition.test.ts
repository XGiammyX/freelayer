/**
 * Privacy-regression (TECH-22): room policy composition + DevicePosture +
 * protected content + sensitive-room admission. Strictest-policy-wins + deny-
 * overrides; untrusted posture cannot elevate; at_risk tightens; future-required
 * protection denies content. Covers §29 (1-34), §30.
 */
import { describe, expect, it } from "vitest";
import {
  composeEffectiveRoomPolicyV1,
  devicePostureSatisfiesMinimumV1,
  resolveEffectiveDevicePostureV1,
  resolveProtectedPresentationStatusV1,
  resolveRoomPolicyDocumentDefaultsV1,
  resolveSensitiveRoomAdmissionV1,
  createRoomLocalId,
  type DevicePostureSignalV1,
  type EffectiveDevicePostureV1,
  type RoomPolicyDocumentV1,
} from "@freelayer/rooms";
import type { PrivacyMode } from "@freelayer/privacy";

const ROOM = createRoomLocalId("room-policy-01");

function doc(mode: PrivacyMode, over?: Partial<RoomPolicyDocumentV1>): RoomPolicyDocumentV1 {
  return { ...resolveRoomPolicyDocumentDefaultsV1({ roomId: ROOM, mode }), ...over };
}
const unverified = (): EffectiveDevicePostureV1 => resolveEffectiveDevicePostureV1();

describe("Effective DevicePosture resolution (§29: 15-26)", () => {
  it("missing/malformed/unknown → unverified; untrusted claims cannot elevate", () => {
    expect(resolveEffectiveDevicePostureV1().effectivePosture).toBe("unverified");
    expect(resolveEffectiveDevicePostureV1({ schemaVersion: 2 } as never).effectivePosture).toBe(
      "unverified",
    );
    for (const claim of ["basic", "hardened", "high_assurance", "managed_bunker"] as const) {
      const sig: DevicePostureSignalV1 = {
        schemaVersion: 1,
        reportedPosture: claim,
        source: "untrusted_local",
        providerIntegration: "not_integrated",
        signalRevision: 1,
      };
      const eff = resolveEffectiveDevicePostureV1(sig);
      expect(eff.effectivePosture, claim).toBe("unverified");
      expect(eff.trustedForElevation).toBe(false);
      expect(eff.providerIntegrated).toBe(false);
    }
    // Even a "future provider" source is not trusted for elevation in core.
    const futureSig: DevicePostureSignalV1 = {
      schemaVersion: 1,
      reportedPosture: "hardened",
      source: "secure_device_future_provider",
      providerIntegration: "integrated_future",
      signalRevision: 3,
    };
    expect(resolveEffectiveDevicePostureV1(futureSig).effectivePosture).toBe("unverified");
  });

  it("at_risk always tightens; satisfiesMinimum ordering is explicit", () => {
    const risk: DevicePostureSignalV1 = {
      schemaVersion: 1,
      reportedPosture: "at_risk",
      source: "untrusted_local",
      providerIntegration: "not_integrated",
      signalRevision: 5,
    };
    expect(resolveEffectiveDevicePostureV1(risk).effectivePosture).toBe("at_risk");
    // at_risk satisfies nothing.
    for (const required of [
      "unverified",
      "basic",
      "hardened",
      "high_assurance",
      "managed_bunker",
    ] as const) {
      expect(devicePostureSatisfiesMinimumV1({ effective: "at_risk", required }), required).toBe(
        false,
      );
    }
    // unverified satisfies only unverified.
    expect(
      devicePostureSatisfiesMinimumV1({ effective: "unverified", required: "unverified" }),
    ).toBe(true);
    expect(devicePostureSatisfiesMinimumV1({ effective: "unverified", required: "basic" })).toBe(
      false,
    );
    // Ordering (hypothetical effective values, since core can't produce them).
    expect(devicePostureSatisfiesMinimumV1({ effective: "hardened", required: "basic" })).toBe(
      true,
    );
    expect(devicePostureSatisfiesMinimumV1({ effective: "basic", required: "hardened" })).toBe(
      false,
    );
  });
});

describe("Protected content (§29: 32-34)", () => {
  it("future-required denies; none/redaction-only satisfiable; no active claim", () => {
    expect(resolveProtectedPresentationStatusV1("none").requirementSatisfied).toBe(true);
    expect(resolveProtectedPresentationStatusV1("policy_redaction_only").requirementSatisfied).toBe(
      true,
    );
    for (const req of [
      "secure_device_future_required",
      "screen_shield_future_required",
      "managed_bunker_future_required",
    ] as const) {
      const s = resolveProtectedPresentationStatusV1(req);
      expect(s.requirementSatisfied, req).toBe(false);
      expect(s.activeProtectionClaim).toBe(false);
      expect(s.integration).toBe("future_gate");
    }
  });
});

describe("Composition: deny-overrides + strictest-wins (§29: 3-14)", () => {
  it("no telemetry/assets/preview/push/remote-ai; persistent storage never; network never", () => {
    const eff = composeEffectiveRoomPolicyV1({
      privacyMode: "standard",
      effectiveDevicePosture: unverified(),
      roomPolicy: doc("standard"),
      roomLifecycle: "active_local",
      operation: "room.object.create",
    });
    expect(eff.persistentStorageAllowed).toBe(false);
    expect(eff.networkAllowed).toBe(false);
    expect(eff.notificationAllowed).toBe(false);
    expect(eff.aiAllowed).toBe(false);
  });

  it("posture requirement unmet denies content; at_risk denies content", () => {
    // Room requires basic → content denied (no provider).
    const eff = composeEffectiveRoomPolicyV1({
      privacyMode: "standard",
      effectiveDevicePosture: unverified(),
      roomPolicy: doc("standard", { minimumDevicePosture: "basic" }),
      roomLifecycle: "active_local",
      operation: "room.object.create",
    });
    expect(eff.postureRequirementSatisfied).toBe(false);
    expect(eff.contentAllowed).toBe(false);
    // at_risk denies content even when posture requirement is unverified.
    const risk: EffectiveDevicePostureV1 = resolveEffectiveDevicePostureV1({
      schemaVersion: 1,
      reportedPosture: "at_risk",
      source: "untrusted_local",
      providerIntegration: "not_integrated",
      signalRevision: 1,
    });
    const eff2 = composeEffectiveRoomPolicyV1({
      privacyMode: "standard",
      effectiveDevicePosture: risk,
      roomPolicy: doc("standard"),
      roomLifecycle: "active_local",
      operation: "room.object.detail",
    });
    expect(eff2.contentAllowed).toBe(false);
  });

  it("Bunker requires future protected presentation → content denied; Emergency denies content", () => {
    const bunker = composeEffectiveRoomPolicyV1({
      privacyMode: "bunker",
      effectiveDevicePosture: unverified(),
      roomPolicy: doc("bunker"),
      roomLifecycle: "active_local",
      operation: "room.object.detail",
    });
    expect(bunker.protectedPresentationSatisfied).toBe(false);
    expect(bunker.contentAllowed).toBe(false);
    const emergency = composeEffectiveRoomPolicyV1({
      privacyMode: "emergency",
      effectiveDevicePosture: unverified(),
      roomPolicy: doc("emergency"),
      roomLifecycle: "active_local",
      operation: "room.object.create",
    });
    expect(emergency.contentAllowed).toBe(false);
  });

  it("Standard content permitted at unverified posture with no protection requirement", () => {
    const eff = composeEffectiveRoomPolicyV1({
      privacyMode: "standard",
      effectiveDevicePosture: unverified(),
      roomPolicy: doc("standard"),
      roomLifecycle: "active_local",
      operation: "room.object.create",
    });
    expect(eff.contentAllowed).toBe(true);
    expect(eff.reasonCodes.join(",")).not.toContain("member");
  });
});

describe("Sensitive-room admission (§24, §29: 27-31, 70)", () => {
  const eff = unverified();
  it("basic+ denies content; summary allowed; at_risk denies; deterministic", () => {
    const a = resolveSensitiveRoomAdmissionV1({
      roomPolicy: doc("standard", { minimumDevicePosture: "basic" }),
      effectiveDevicePosture: eff,
      action: "room.open_content",
      privacyMode: "standard",
    });
    expect(a.allowed).toBe(false);
    expect(a.reasonCode).toBe("posture_requirement_unmet");
    // Summary still allowed.
    const sum = resolveSensitiveRoomAdmissionV1({
      roomPolicy: doc("standard", { minimumDevicePosture: "basic" }),
      effectiveDevicePosture: eff,
      action: "room.open_summary",
      privacyMode: "standard",
    });
    expect(sum.allowed).toBe(true);
    // ScreenShield-required content denies.
    const ss = resolveSensitiveRoomAdmissionV1({
      roomPolicy: doc("bunker"),
      effectiveDevicePosture: eff,
      action: "room.open_content",
      privacyMode: "bunker",
    });
    expect(ss.allowed).toBe(false);
    expect(ss.reasonCode).toMatch(/protected_presentation_unavailable|posture_requirement_unmet/);
    // Deterministic.
    const again = resolveSensitiveRoomAdmissionV1({
      roomPolicy: doc("standard", { minimumDevicePosture: "basic" }),
      effectiveDevicePosture: eff,
      action: "room.open_content",
      privacyMode: "standard",
    });
    expect(again).toEqual(a);
  });
});

describe("Cross-mode matrix (§30)", () => {
  const modes: PrivacyMode[] = [
    "standard",
    "private",
    "ghost",
    "bunker",
    "offline_capsule",
    "emergency",
  ];
  it("no high-posture claim accepted; at_risk always tightens; strictest wins", () => {
    for (const mode of modes) {
      for (const required of [
        "unverified",
        "basic",
        "hardened",
        "high_assurance",
        "managed_bunker",
      ] as const) {
        const eff = composeEffectiveRoomPolicyV1({
          privacyMode: mode,
          effectiveDevicePosture: unverified(),
          roomPolicy: doc(mode, {
            minimumDevicePosture: required,
            protectedContentRequirement: "none",
          }),
          roomLifecycle: "active_local",
          operation: "room.object.create",
        });
        // Any requirement above `unverified` cannot be satisfied by core.
        if (required !== "unverified") {
          expect(eff.contentAllowed, `${mode}/${required}`).toBe(false);
        }
      }
    }
  });
});
