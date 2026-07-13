/**
 * Synthetic Secure Device contract fixtures (TECH-23) — SYNTHETIC posture states
 * ONLY. Never a real attestation token, device identifier, serial, OS
 * fingerprint, or app inventory. Used by the privacy/security regression suites.
 */

import {
  buildProductionProviderStatusV1,
  createRoomLocalId,
  NOT_INTEGRATED_CAPABILITIES,
  resolveDevicePostureAssessmentV1,
  resolveRoomPolicyDocumentDefaultsV1,
  validateRoomMemberRef,
  validateRoomMembershipId,
  validateRoomMembershipRevision,
  type DevicePostureAssessmentV1,
  type MinimumDevicePostureV1,
  type ProtectedContentRequirementV1,
  type RoomLocalCapabilityDescriptorV1,
  type RoomMembershipRecordV1,
  type RoomMembershipStateV1,
  type RoomPolicyDocumentV1,
  type SecureDeviceProviderLifecycleV1,
} from "@freelayer/rooms";
import type { PrivacyMode } from "@freelayer/privacy";

export const SECURE_DEVICE_SENTINEL = "FREELAYER_SECURE_DEVICE_CONTRACT_SENTINEL_DO_NOT_LEAK";

export const ROOM_ID = createRoomLocalId("room-secure-device-01");

export function roomPolicy(
  mode: PrivacyMode = "standard",
  over?: Partial<RoomPolicyDocumentV1>,
): RoomPolicyDocumentV1 {
  return { ...resolveRoomPolicyDocumentDefaultsV1({ roomId: ROOM_ID, mode }), ...over };
}

export function requiring(
  minimumDevicePosture: MinimumDevicePostureV1,
  protectedContentRequirement: ProtectedContentRequirementV1 = "policy_redaction_only",
): RoomPolicyDocumentV1 {
  return roomPolicy("standard", { minimumDevicePosture, protectedContentRequirement });
}

export function membership(
  state: RoomMembershipStateV1 = "active_local_unverified",
  revision = 1,
): RoomMembershipRecordV1 {
  return {
    schemaVersion: 1,
    membershipId: validateRoomMembershipId("mem-secure-01"),
    roomId: ROOM_ID,
    memberRef: validateRoomMemberRef("member-01"),
    role: "owner_placeholder",
    state,
    revision: validateRoomMembershipRevision(revision),
    origin: "local_room_bootstrap",
    verification: "unverified_placeholder",
    createdAtLocal: "local:0",
    updatedAtLocal: "local:0",
  };
}

/** The Null (no-provider) status + capabilities. */
export const NULL_STATUS = buildProductionProviderStatusV1("not_integrated");
export const NULL_CAPS = NOT_INTEGRATED_CAPABILITIES;

export function providerStatus(lifecycle: SecureDeviceProviderLifecycleV1) {
  return buildProductionProviderStatusV1(lifecycle);
}

/** A registered, accepted, transient unverified assessment. */
export function unverifiedAssessment(revision = 1): DevicePostureAssessmentV1 {
  return resolveDevicePostureAssessmentV1({
    reportedPosture: "unverified",
    source: "no_provider",
    assessmentRevision: revision,
    freshness: "current_process_only",
  });
}

/** A registered assessment whose UNTRUSTED report is `at_risk` (tightening). */
export function atRiskAssessment(revision = 1): DevicePostureAssessmentV1 {
  return resolveDevicePostureAssessmentV1({
    reportedPosture: "at_risk",
    source: "untrusted_local",
    assessmentRevision: revision,
    freshness: "current_process_only",
  });
}

/** A registered assessment claiming `high_assurance` — MUST NOT elevate. */
export function claimedHighAssurance(revision = 1): DevicePostureAssessmentV1 {
  return resolveDevicePostureAssessmentV1({
    reportedPosture: "high_assurance",
    source: "untrusted_local",
    assessmentRevision: revision,
    freshness: "current_process_only",
  });
}

/** A registered but STALE assessment. */
export function staleAssessment(revision = 1): DevicePostureAssessmentV1 {
  return resolveDevicePostureAssessmentV1({
    reportedPosture: "unverified",
    source: "no_provider",
    assessmentRevision: revision,
    freshness: "stale",
  });
}

/** A hand-forged, NON-registered "assessment" claiming elevation (not accepted). */
export function forgedAssessment(over?: Record<string, unknown>): DevicePostureAssessmentV1 {
  return {
    schemaVersion: 1,
    contractVersion: 1,
    assessmentRevision: 9,
    reportedPosture: "managed_bunker",
    effectivePosture: "managed_bunker",
    source: "secure_device_future_provider",
    providerLifecycle: "ready_future",
    freshness: "current_process_only",
    trustedForElevation: false,
    mayTighten: true,
    rawEvidenceIncluded: false,
    deviceIdentifiersIncluded: false,
    deviceManagementPerformed: false,
    telemetryEmitted: false,
    reasonCodes: ["forged"],
    ...over,
  } as DevicePostureAssessmentV1;
}

/** A forged assessment that ALSO smuggles raw evidence / identifiers. */
export function evidenceBearingObject(): unknown {
  return {
    schemaVersion: 1,
    contractVersion: 1,
    assessmentRevision: 1,
    reportedPosture: "high_assurance",
    effectivePosture: "high_assurance",
    source: "secure_device_future_provider",
    providerLifecycle: "ready_future",
    freshness: "current_process_only",
    trustedForElevation: false,
    mayTighten: true,
    rawEvidenceIncluded: false,
    deviceIdentifiersIncluded: false,
    deviceManagementPerformed: false,
    telemetryEmitted: false,
    reasonCodes: [],
    // Forbidden smuggled fields:
    rawEvidence: "MIIB...attestation",
    deviceId: "serial-123",
    installedApps: ["com.example.app"],
    measurementLog: [1, 2, 3],
  };
}

export function capabilityFor(
  capability: RoomLocalCapabilityDescriptorV1["capability"],
  membershipRevision = 1,
): RoomLocalCapabilityDescriptorV1 {
  return {
    schemaVersion: 1,
    roomId: ROOM_ID,
    memberRef: validateRoomMemberRef("member-01"),
    membershipId: validateRoomMembershipId("mem-secure-01"),
    membershipRevision: validateRoomMembershipRevision(membershipRevision),
    capability,
    sourceRole: "owner_placeholder",
    authoritative: false,
    serialization: "forbidden",
    delegation: "not_implemented",
    persistence: "forbidden",
  };
}
