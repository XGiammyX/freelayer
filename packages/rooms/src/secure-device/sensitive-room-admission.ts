/**
 * Sensitive-room admission (TECH-23) — the canonical, deterministic, fail-closed
 * LOCAL gate that decides whether a specific action may reveal/mutate/manage a
 * sensitive room GIVEN the room policy, Privacy Mode, lifecycle, membership/
 * capability eligibility, the Secure Device provider state, and a normalized
 * posture assessment. It NEVER replaces membership, capability, or PolicyDecision
 * — it is an ADDITIONAL gate resolved immediately before authorization/execution.
 *
 * Because no Secure Device provider is integrated, any room requiring `basic+`
 * (or a future protected presentation / managed-Bunker) DENIES content now; a
 * redacted summary may still be separately permitted. Unknown actions/outcomes
 * fail closed. The decision is REDACTED: no content, no raw evidence, no
 * identifiers — codes only.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomLifecycleState, RoomLocalId } from "../room-types";
import type { RoomMembershipRecordV1 } from "../membership/membership-types";
import type { RoomLocalCapabilityDescriptorV1 } from "../membership/capability-types";
import {
  devicePostureSatisfiesMinimumV1,
  type DevicePosture,
  type MinimumDevicePostureV1,
} from "../policy-composition/device-posture";
import { resolveProtectedPresentationStatusV1 } from "../policy-composition/protected-content";
import type {
  RoomPolicyDocumentV1,
  RoomPolicyRevision,
} from "../policy-composition/room-policy-document";
import {
  isAcceptedDevicePostureAssessmentV1,
  type DevicePostureAssessmentV1,
} from "./posture-assessment";
import {
  providerTrustedForElevationV1,
  type SecureDeviceCapabilitiesV1,
  type SecureDeviceProviderStatusV1,
} from "./secure-device-provider";

export type SensitiveRoomAdmissionActionV1 =
  | "room.summary.redacted"
  | "room.summary.full"
  | "room.content.read"
  | "room.content.mutate"
  | "room.content.search"
  | "room.content.export"
  | "room.content.copy"
  | "room.file.open"
  | "room.local_ai.use"
  | "room.membership.manage"
  | "room.policy.manage";

export const SENSITIVE_ROOM_ADMISSION_ACTIONS: readonly SensitiveRoomAdmissionActionV1[] = [
  "room.summary.redacted",
  "room.summary.full",
  "room.content.read",
  "room.content.mutate",
  "room.content.search",
  "room.content.export",
  "room.content.copy",
  "room.file.open",
  "room.local_ai.use",
  "room.membership.manage",
  "room.policy.manage",
];

export type SensitiveRoomAdmissionOutcomeV1 =
  | "allow"
  | "allow_redacted_summary_only"
  | "deny_policy"
  | "deny_posture_unverified"
  | "deny_posture_at_risk"
  | "deny_provider_unavailable"
  | "deny_assessment_stale"
  | "deny_minimum_posture"
  | "deny_protected_presentation_unavailable"
  | "deny_bunker_session_unavailable"
  | "deny_membership"
  | "deny_authorization"
  | "deny_not_implemented";

const ALLOWING_OUTCOMES: ReadonlySet<SensitiveRoomAdmissionOutcomeV1> = new Set([
  "allow",
  "allow_redacted_summary_only",
]);

export interface SensitiveRoomAdmissionDecisionV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly action: SensitiveRoomAdmissionActionV1;
  readonly outcome: SensitiveRoomAdmissionOutcomeV1;
  readonly allowed: boolean;
  readonly effectivePosture: DevicePosture;
  readonly requiredPosture: MinimumDevicePostureV1;
  readonly assessmentRevision: number;
  readonly roomPolicyRevision: RoomPolicyRevision;
  readonly protectedPresentationSatisfied: boolean;
  readonly bunkerSessionSatisfied: boolean;
  readonly redacted: true;
  readonly reasonCodes: readonly string[];
}

// Action classification.
const CONTENT_ACTIONS: ReadonlySet<SensitiveRoomAdmissionActionV1> = new Set([
  "room.summary.full",
  "room.content.read",
  "room.content.mutate",
  "room.content.search",
  "room.content.export",
  "room.content.copy",
  "room.file.open",
  "room.local_ai.use",
]);
/** Content-revealing actions whose feature is NOT implemented (future-gated). */
const FUTURE_GATE_ACTIONS: ReadonlySet<SensitiveRoomAdmissionActionV1> = new Set([
  "room.content.export",
  "room.content.copy",
  "room.file.open",
  "room.local_ai.use",
]);
const MANAGE_ACTIONS: ReadonlySet<SensitiveRoomAdmissionActionV1> = new Set([
  "room.membership.manage",
  "room.policy.manage",
]);

/** Lifecycles in which a room may reveal content at all. */
const CONTENT_LIFECYCLES: ReadonlySet<RoomLifecycleState> = new Set<RoomLifecycleState>([
  "active_local",
]);
/** Lifecycles in which even a redacted summary is refused. */
const NO_SUMMARY_LIFECYCLES: ReadonlySet<RoomLifecycleState> = new Set<RoomLifecycleState>([
  "emergency_locked",
  "deleted_tombstone",
  "unknown",
]);

export function resolveSensitiveRoomAdmissionV1(input: {
  action: SensitiveRoomAdmissionActionV1;
  roomPolicy: RoomPolicyDocumentV1;
  privacyMode: PrivacyMode;
  roomLifecycle: RoomLifecycleState;
  membership?: RoomMembershipRecordV1;
  capability?: RoomLocalCapabilityDescriptorV1;
  providerStatus: SecureDeviceProviderStatusV1;
  providerCapabilities: SecureDeviceCapabilitiesV1;
  assessment: DevicePostureAssessmentV1;
}): SensitiveRoomAdmissionDecisionV1 {
  const { action, roomPolicy: rp, privacyMode, roomLifecycle, membership, capability } = input;

  const requiredPosture = rp.minimumDevicePosture;
  const protectedStatus = resolveProtectedPresentationStatusV1(rp.protectedContentRequirement);
  const bunkerSessionSatisfied =
    rp.protectedContentRequirement !== "managed_bunker_future_required";

  // (5) Assessment provenance. A forged / evidence-bearing / non-issued object
  // is not trusted — posture is treated as `unverified` (fail closed).
  const accepted = isAcceptedDevicePostureAssessmentV1(input.assessment);

  // (6) Reduce untrusted elevation → unverified. No provider is trusted for
  // elevation in core, so anything above `unverified` (except `at_risk`) is
  // clamped to `unverified` regardless of what the assessment claims.
  const trustedElevation = providerTrustedForElevationV1(input.providerStatus);
  const rawEffective: DevicePosture = accepted ? input.assessment.effectivePosture : "unverified";
  const effectivePosture: DevicePosture =
    rawEffective === "at_risk"
      ? "at_risk"
      : trustedElevation && rawEffective !== "unverified"
        ? rawEffective // unreachable in core (no trusted provider) — honest branch
        : "unverified";

  const assessmentRevision = accepted ? input.assessment.assessmentRevision : 0;

  const base = {
    schemaVersion: 1 as const,
    roomId: rp.roomId,
    action,
    effectivePosture,
    requiredPosture,
    assessmentRevision,
    roomPolicyRevision: rp.revision,
    protectedPresentationSatisfied: protectedStatus.requirementSatisfied,
    bunkerSessionSatisfied,
    redacted: true as const,
  };

  const decide = (
    outcome: SensitiveRoomAdmissionOutcomeV1,
    reasonCodes: readonly string[],
  ): SensitiveRoomAdmissionDecisionV1 => ({
    ...base,
    outcome,
    allowed: ALLOWING_OUTCOMES.has(outcome),
    reasonCodes,
  });

  // (1) Validate the action.
  if (!SENSITIVE_ROOM_ADMISSION_ACTIONS.includes(action)) {
    return decide("deny_policy", ["unknown_action"]);
  }

  // (2) Global policy + Privacy Mode. Emergency denies everything but a refusal.
  if (privacyMode === "emergency") {
    return decide("deny_policy", ["emergency_mode"]);
  }

  // (3) Lifecycle.
  if (NO_SUMMARY_LIFECYCLES.has(roomLifecycle)) {
    return decide("deny_policy", ["room_lifecycle_locked"]);
  }

  // (4) Membership / capability eligibility (does NOT grant — only screens out
  // obviously-revoked local authority; real authorization is separate).
  if (membership !== undefined && membership.state !== "active_local_unverified") {
    return decide("deny_membership", ["membership_not_active"]);
  }
  if (
    membership !== undefined &&
    capability !== undefined &&
    (capability.membershipRevision as number) !== (membership.revision as number)
  ) {
    return decide("deny_authorization", ["capability_stale"]);
  }

  // ----- Redacted summary: metadata-only, not gated by content protection. ----
  if (action === "room.summary.redacted") {
    return decide("allow_redacted_summary_only", ["redacted_summary_permitted"]);
  }

  // ----- Membership / policy management: separately authorized elsewhere. -----
  if (MANAGE_ACTIONS.has(action)) {
    if (effectivePosture === "at_risk") {
      return decide("deny_posture_at_risk", ["device_at_risk"]);
    }
    return decide("allow", ["separately_authorized"]);
  }

  // ----- Content-revealing / mutating / extracting actions. -----
  if (CONTENT_ACTIONS.has(action)) {
    // Content may only be revealed while the room is active.
    if (!CONTENT_LIFECYCLES.has(roomLifecycle)) {
      return decide("deny_policy", ["room_not_active"]);
    }
    // (7) at_risk denies all content actions.
    if (effectivePosture === "at_risk") {
      return decide("deny_posture_at_risk", ["device_at_risk"]);
    }

    // A room that only requires `unverified` can proceed on posture grounds.
    const needsProvider = requiredPosture !== "unverified";

    // (8) Provider lifecycle — a room requiring `basic+` needs a trusted, ready
    // provider that does not exist in core.
    if (needsProvider) {
      if (
        input.providerStatus.lifecycle === "failed" ||
        input.providerStatus.lifecycle === "unavailable"
      ) {
        return decide("deny_provider_unavailable", ["provider_unavailable"]);
      }
      if (!trustedElevation) {
        // not_integrated (or any future/degraded state core cannot trust).
        return decide("deny_minimum_posture", ["no_provider_for_required_posture"]);
      }
    }

    // (9) Freshness.
    if (accepted && input.assessment.freshness === "stale") {
      return decide("deny_assessment_stale", ["assessment_stale"]);
    }
    if (!accepted) {
      // No accepted assessment → cannot establish any posture beyond unverified.
      if (needsProvider) {
        return decide("deny_posture_unverified", ["assessment_not_accepted"]);
      }
    }

    // (10) Minimum posture.
    if (
      !devicePostureSatisfiesMinimumV1({ effective: effectivePosture, required: requiredPosture })
    ) {
      return decide(
        requiredPosture === "unverified" ? "deny_posture_unverified" : "deny_minimum_posture",
        ["posture_requirement_unmet"],
      );
    }

    // (11) Protected presentation.
    if (!protectedStatus.requirementSatisfied) {
      if (rp.protectedContentRequirement === "managed_bunker_future_required") {
        // (12) Bunker Session requirement.
        return decide("deny_bunker_session_unavailable", ["bunker_session_unavailable"]);
      }
      return decide("deny_protected_presentation_unavailable", [
        "protected_presentation_unavailable",
      ]);
    }

    // (13) Action-specific constraints: export/copy/file/AI are NOT implemented.
    if (FUTURE_GATE_ACTIONS.has(action)) {
      return decide("deny_not_implemented", ["action_not_implemented"]);
    }

    // (14) Permit content.
    return decide("allow", ["content_permitted"]);
  }

  // Fail closed on any unclassified action.
  return decide("deny_policy", ["unknown_action"]);
}
