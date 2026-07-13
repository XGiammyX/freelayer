/**
 * Transient sensitive-room admission SESSION (TECH-23). This is NOT a UI session,
 * an OS/profile session, Bunker Session Mode, capture protection, or a persistent
 * token. It is an in-memory, current-process-only record that a specific
 * admission decision was granted, bound to the exact revisions it depended on.
 * It is NEVER persisted and NEVER survives a restart. Any relevant change
 * INVALIDATES it — it is never silently refreshed or restored.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomLifecycleState, RoomLocalId } from "../room-types";
import type { RoomMembershipRevision } from "../membership/membership-ids";
import type { DevicePosture } from "../policy-composition/device-posture";
import type { ProtectedContentRequirementV1 } from "../policy-composition/protected-content";
import type { RoomPolicyRevision } from "../policy-composition/room-policy-document";
import type { SecureDeviceProviderLifecycleV1 } from "./secure-device-provider";
import type { DevicePostureAssessmentFreshnessV1 } from "./posture-assessment";
import {
  SensitiveRoomAdmissionDeniedError,
  SensitiveRoomSessionStaleError,
} from "./secure-device-errors";
import type {
  SensitiveRoomAdmissionActionV1,
  SensitiveRoomAdmissionDecisionV1,
} from "./sensitive-room-admission";

export type SensitiveRoomSessionStateV1 =
  "closed" | "redacted_summary_only" | "content_admitted_current_process" | "invalidated";

export interface SensitiveRoomSessionV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly state: SensitiveRoomSessionStateV1;
  readonly admissionAction: SensitiveRoomAdmissionActionV1;
  readonly assessmentRevision: number;
  readonly roomPolicyRevision: RoomPolicyRevision;
  readonly membershipRevision?: RoomMembershipRevision;
  readonly privacyMode: PrivacyMode;
  readonly protectedContentRequirement: ProtectedContentRequirementV1;
  readonly persistence: "forbidden";
  readonly crossRestartValidity: false;
}

/**
 * Create a transient session from an admission decision. A DENIED decision
 * cannot create an admitted session — it throws a content-free denial. An
 * allowed decision yields either a content or redacted-summary session.
 */
export function createSensitiveRoomSessionV1(input: {
  decision: SensitiveRoomAdmissionDecisionV1;
  privacyMode: PrivacyMode;
  protectedContentRequirement: ProtectedContentRequirementV1;
  membershipRevision?: RoomMembershipRevision;
}): SensitiveRoomSessionV1 {
  const { decision } = input;
  if (!decision.allowed) {
    throw new SensitiveRoomAdmissionDeniedError(decision.outcome);
  }
  const state: SensitiveRoomSessionStateV1 =
    decision.outcome === "allow_redacted_summary_only"
      ? "redacted_summary_only"
      : "content_admitted_current_process";

  return {
    schemaVersion: 1,
    roomId: decision.roomId,
    state,
    admissionAction: decision.action,
    assessmentRevision: decision.assessmentRevision,
    roomPolicyRevision: decision.roomPolicyRevision,
    // `exactOptionalPropertyTypes`: only include when actually present.
    ...(input.membershipRevision !== undefined
      ? { membershipRevision: input.membershipRevision }
      : {}),
    privacyMode: input.privacyMode,
    protectedContentRequirement: input.protectedContentRequirement,
    persistence: "forbidden",
    crossRestartValidity: false,
  };
}

export interface SensitiveRoomSessionCurrentContextV1 {
  readonly assessmentRevision: number;
  readonly roomPolicyRevision: RoomPolicyRevision;
  readonly membershipRevision?: RoomMembershipRevision;
  readonly privacyMode: PrivacyMode;
  readonly roomLifecycle: RoomLifecycleState;
  readonly effectivePosture: DevicePosture;
  readonly providerLifecycle: SecureDeviceProviderLifecycleV1;
  readonly freshness: DevicePostureAssessmentFreshnessV1;
  readonly protectedContentRequirement: ProtectedContentRequirementV1;
  /** The action the caller is about to perform (must match the admitted one). */
  readonly action: SensitiveRoomAdmissionActionV1;
}

/**
 * Assert a session is still valid for the current process state. Throws a
 * content-free {@link SensitiveRoomSessionStaleError} on ANY invalidating
 * change. Never mutates, never refreshes, never restores.
 */
export function assertSensitiveRoomSessionCurrentV1(input: {
  session: SensitiveRoomSessionV1;
  current: SensitiveRoomSessionCurrentContextV1;
}): void {
  const { session, current } = input;
  const fail = (reason: string): never => {
    throw new SensitiveRoomSessionStaleError(reason);
  };

  if (session.state === "closed" || session.state === "invalidated") fail("session_not_open");

  // Requested action must match the admitted action.
  if (current.action !== session.admissionAction) fail("action_changed");

  // Assessment / policy / membership / mode revisions must match.
  if (current.assessmentRevision !== session.assessmentRevision)
    fail("assessment_revision_changed");
  if ((current.roomPolicyRevision as number) !== (session.roomPolicyRevision as number)) {
    fail("room_policy_revision_changed");
  }
  if (
    session.membershipRevision !== undefined &&
    (current.membershipRevision as number | undefined) !== (session.membershipRevision as number)
  ) {
    fail("membership_revision_changed");
  }
  if (current.privacyMode !== session.privacyMode) fail("privacy_mode_changed");
  if (current.protectedContentRequirement !== session.protectedContentRequirement) {
    fail("protected_content_requirement_changed");
  }

  // Environmental invalidation.
  if (current.effectivePosture === "at_risk") fail("device_at_risk");
  if (current.providerLifecycle === "unavailable" || current.providerLifecycle === "failed") {
    fail("provider_unavailable");
  }
  if (current.freshness === "stale") fail("assessment_stale");

  // A content session requires the room to remain active.
  if (
    session.state === "content_admitted_current_process" &&
    current.roomLifecycle !== "active_local"
  ) {
    fail("room_lifecycle_changed");
  }
}

/** Return an explicitly invalidated copy of a session (never resurrectable). */
export function invalidateSensitiveRoomSessionV1(
  session: SensitiveRoomSessionV1,
): SensitiveRoomSessionV1 {
  return { ...session, state: "invalidated" };
}
