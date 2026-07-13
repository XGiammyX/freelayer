/**
 * Sensitive-room admission (TECH-22). A deterministic LOCAL policy check that
 * gates content/mutation/governance access by the room's minimum device posture
 * + protected-content requirement. Because no Secure Device provider is
 * integrated, any room requiring `basic+` (or a future protected presentation)
 * DENIES content now — a redacted summary may still be permitted. No UI.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import {
  devicePostureSatisfiesMinimumV1,
  type DevicePosture,
  type EffectiveDevicePostureV1,
  type MinimumDevicePostureV1,
} from "./device-posture";
import { resolveProtectedPresentationStatusV1 } from "./protected-content";
import type { RoomPolicyDocumentV1 } from "./room-policy-document";

export type SensitiveRoomAdmissionActionV1 =
  | "room.open_summary"
  | "room.open_content"
  | "room.mutate_content"
  | "room.manage_membership"
  | "room.change_policy";

export interface SensitiveRoomAdmissionDecisionV1 {
  readonly allowed: boolean;
  readonly action: SensitiveRoomAdmissionActionV1;
  readonly effectivePosture: DevicePosture;
  readonly requiredPosture: MinimumDevicePostureV1;
  readonly protectedPresentationSatisfied: boolean;
  readonly reasonCode: string;
}

/** Actions that reveal or mutate room CONTENT (gated by posture + protection). */
const CONTENT_ACTIONS: ReadonlySet<SensitiveRoomAdmissionActionV1> = new Set([
  "room.open_content",
  "room.mutate_content",
]);

export function resolveSensitiveRoomAdmissionV1(input: {
  roomPolicy: RoomPolicyDocumentV1;
  effectiveDevicePosture: EffectiveDevicePostureV1;
  action: SensitiveRoomAdmissionActionV1;
  privacyMode: PrivacyMode;
}): SensitiveRoomAdmissionDecisionV1 {
  const { roomPolicy: rp, effectiveDevicePosture: posture, action } = input;
  const protected_ = resolveProtectedPresentationStatusV1(rp.protectedContentRequirement);
  const postureOk = devicePostureSatisfiesMinimumV1({
    effective: posture.effectivePosture,
    required: rp.minimumDevicePosture,
  });

  const base = {
    action,
    effectivePosture: posture.effectivePosture,
    requiredPosture: rp.minimumDevicePosture,
    protectedPresentationSatisfied: protected_.requirementSatisfied,
  };

  // A redacted summary is not gated by content protection (no content shown).
  if (action === "room.open_summary") {
    // Emergency still denies; at_risk still tightens content but a summary is
    // metadata-only. Allowed unless the room policy itself forbids everything.
    if (input.privacyMode === "emergency") {
      return { ...base, allowed: false, reasonCode: "emergency_mode" };
    }
    return { ...base, allowed: true, reasonCode: "summary_permitted" };
  }

  // Membership/governance are separately authorized elsewhere; admission here
  // does not grant them but must not be blocked purely by content protection.
  if (action === "room.manage_membership" || action === "room.change_policy") {
    if (posture.effectivePosture === "at_risk") {
      return { ...base, allowed: false, reasonCode: "device_at_risk" };
    }
    return { ...base, allowed: true, reasonCode: "separately_authorized" };
  }

  // Content actions: require posture + protected presentation + not at_risk.
  if (CONTENT_ACTIONS.has(action)) {
    if (input.privacyMode === "emergency") {
      return { ...base, allowed: false, reasonCode: "emergency_mode" };
    }
    if (posture.effectivePosture === "at_risk") {
      return { ...base, allowed: false, reasonCode: "device_at_risk" };
    }
    if (!postureOk) {
      return { ...base, allowed: false, reasonCode: "posture_requirement_unmet" };
    }
    if (!protected_.requirementSatisfied) {
      return { ...base, allowed: false, reasonCode: "protected_presentation_unavailable" };
    }
    return { ...base, allowed: true, reasonCode: "content_permitted" };
  }

  // Unknown action → deny.
  return { ...base, allowed: false, reasonCode: "unknown_action" };
}
