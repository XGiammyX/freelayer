/**
 * Effective room-policy composition (TECH-22). Deterministic, PURE, deny-by-
 * default, STRICTEST-POLICY-WINS + DENY-OVERRIDES. No side effects, no logs, no
 * content in the result, no caller-controlled precedence, no first-match bypass,
 * no permit-overrides. Every layer contributes constraints; the strictest wins.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomLifecycleState, RoomLocalId } from "../room-types";
import type { RoomObjectSensitivity, RoomObjectV1 } from "../objects";
import type { RoomQueryViewClass } from "../query";
import type { RoomLocalCapabilityDescriptorV1, RoomMembershipRecordV1 } from "../membership";
import { devicePostureSatisfiesMinimumV1, type EffectiveDevicePostureV1 } from "./device-posture";
import {
  effectPermitsExecutionV1,
  foldStrictestEffectV1,
  type RoomComposedPolicyEffectV1,
  type RoomPolicyLayerV1,
} from "./policy-layers";
import { resolveProtectedPresentationStatusV1 } from "./protected-content";
import type { RoomPolicyDocumentV1, RoomPolicyRevision } from "./room-policy-document";

export interface RoomPolicyConstraintResultV1 {
  readonly layer: RoomPolicyLayerV1;
  readonly effect: RoomComposedPolicyEffectV1;
  readonly allowed: boolean;
  readonly reasonCode: string;
}

export type RoomPolicyConflictKindV1 =
  | "allow_conflicts_with_deny"
  | "retention_conflict"
  | "network_conflict"
  | "metadata_conflict"
  | "notification_conflict"
  | "posture_requirement_unmet"
  | "protected_presentation_unavailable"
  | "governance_loosen_attempt"
  | "unknown_policy_input";

export interface RoomPolicyConflictReportV1 {
  readonly kind: RoomPolicyConflictKindV1;
  readonly layers: readonly RoomPolicyLayerV1[];
  readonly effect: RoomComposedPolicyEffectV1;
  readonly reasonCode: string;
  readonly redacted: true;
}

export interface RoomPolicyCompositionInputV1 {
  readonly privacyMode: PrivacyMode;
  readonly effectiveDevicePosture: EffectiveDevicePostureV1;
  readonly roomPolicy: RoomPolicyDocumentV1;
  readonly roomLifecycle: RoomLifecycleState;
  readonly operation: string;
  readonly membership?: RoomMembershipRecordV1;
  readonly capability?: RoomLocalCapabilityDescriptorV1;
  readonly objectKind?: RoomObjectV1["kind"];
  readonly objectSensitivity?: RoomObjectSensitivity;
  readonly requestedView?: RoomQueryViewClass;
}

export interface EffectiveRoomPolicyV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly roomPolicyRevision: RoomPolicyRevision;
  readonly devicePostureSignalRevision: number;
  readonly allowed: boolean;
  readonly effect: RoomComposedPolicyEffectV1;
  readonly contentAllowed: boolean;
  readonly persistentStorageAllowed: boolean;
  readonly networkAllowed: boolean;
  readonly metadataAllowed: boolean;
  readonly notificationAllowed: boolean;
  readonly aiAllowed: boolean;
  readonly postureRequirementSatisfied: boolean;
  readonly protectedPresentationSatisfied: boolean;
  readonly winningConstraints: readonly RoomPolicyConstraintResultV1[];
  readonly reasonCodes: readonly string[];
}

const c = (
  layer: RoomPolicyLayerV1,
  effect: RoomComposedPolicyEffectV1,
  reasonCode: string,
): RoomPolicyConstraintResultV1 => ({
  layer,
  effect,
  allowed: effectPermitsExecutionV1(effect),
  reasonCode,
});

const CONTENT_OPS = /(create|update|redact|detail|search|content|mutate)/;

export function composeEffectiveRoomPolicyV1(
  input: RoomPolicyCompositionInputV1,
): EffectiveRoomPolicyV1 {
  const { privacyMode: mode, effectiveDevicePosture: posture, roomPolicy: rp } = input;
  const emergency = mode === "emergency";
  const strict = mode === "ghost" || mode === "bunker";
  const isContentOp = CONTENT_OPS.test(input.operation);

  const contentConstraints: RoomPolicyConstraintResultV1[] = [];

  // Emergency override: ordinary content operations denied.
  if (emergency && isContentOp) {
    contentConstraints.push(c("emergency_override", "deny", "emergency_mode"));
  }

  // Device posture: at_risk denies content; unmet minimum posture denies content.
  const postureRequirementSatisfied = devicePostureSatisfiesMinimumV1({
    effective: posture.effectivePosture,
    required: rp.minimumDevicePosture,
  });
  if (posture.effectivePosture === "at_risk" && isContentOp) {
    contentConstraints.push(c("device_posture", "deny", "device_at_risk"));
  }
  if (!postureRequirementSatisfied && isContentOp) {
    contentConstraints.push(c("device_posture", "deny", "posture_requirement_unmet"));
  }

  // Protected-content requirement: future-required denies content display.
  const protected_ = resolveProtectedPresentationStatusV1(rp.protectedContentRequirement);
  if (!protected_.requirementSatisfied && isContentOp) {
    contentConstraints.push(c("room_policy", "future_gate", protected_.reasonCode));
  }

  // Room-policy content shape: strict modes bias toward redaction; the content
  // op still requires the above gates to pass.
  if (strict && isContentOp && rp.protectedContentRequirement !== "none") {
    contentConstraints.push(c("privacy_mode", "redact", "strict_mode_redaction"));
  }
  if (contentConstraints.length === 0) {
    contentConstraints.push(c("room_policy", "allow", "content_permitted"));
  }

  const contentEffect = foldStrictestEffectV1(contentConstraints.map((x) => x.effect));
  const contentAllowed =
    effectPermitsExecutionV1(contentEffect) &&
    postureRequirementSatisfied &&
    protected_.requirementSatisfied;

  // Storage: never persistent plaintext; strict → null; else memory_only.
  const storageEffect: RoomComposedPolicyEffectV1 =
    rp.storage.maximumRetention === "null" || strict ? "null" : "memory_only";
  // Metadata: emergency/strict → coarsen/redact; else per document.
  const metadataEffect: RoomComposedPolicyEffectV1 = emergency
    ? "deny"
    : strict
      ? "coarsen"
      : rp.metadata.actorRefsAllowed
        ? "allow"
        : "coarsen";
  const notificationEffect: RoomComposedPolicyEffectV1 = rp.notifications.notificationAllowed
    ? "allow"
    : "deny";
  const aiEffect: RoomComposedPolicyEffectV1 =
    rp.ai.localAiAllowed && !strict && !emergency ? "allow" : "deny";

  const overallEffect = isContentOp
    ? contentEffect
    : foldStrictestEffectV1([contentEffect, storageEffect, metadataEffect]);

  const reasonCodes = Array.from(new Set(contentConstraints.map((x) => x.reasonCode)));

  return {
    schemaVersion: 1,
    roomId: rp.roomId,
    roomPolicyRevision: rp.revision,
    devicePostureSignalRevision: posture.signalRevision,
    allowed: contentAllowed && effectPermitsExecutionV1(overallEffect),
    effect: overallEffect,
    contentAllowed,
    persistentStorageAllowed: false, // structural — never in v1 (Gate F)
    networkAllowed: false, // structural — RoomOS is zero-network in v1
    metadataAllowed: effectPermitsExecutionV1(metadataEffect) && metadataEffect === "allow",
    notificationAllowed: notificationEffect === "allow",
    aiAllowed: aiEffect === "allow",
    postureRequirementSatisfied,
    protectedPresentationSatisfied: protected_.requirementSatisfied,
    winningConstraints: Object.freeze(contentConstraints),
    reasonCodes: Object.freeze(reasonCodes),
  };
}

/** Build a redacted conflict report (no room title / member ref / content). */
export function buildRoomPolicyConflictReportV1(input: {
  kind: RoomPolicyConflictKindV1;
  layers: readonly RoomPolicyLayerV1[];
  effect: RoomComposedPolicyEffectV1;
  reasonCode: string;
}): RoomPolicyConflictReportV1 {
  return Object.freeze({
    kind: input.kind,
    layers: Object.freeze([...input.layers]),
    effect: input.effect,
    reasonCode: input.reasonCode,
    redacted: true,
  });
}
