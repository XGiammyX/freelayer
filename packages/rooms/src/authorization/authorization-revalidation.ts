/**
 * Execution-time authorization revalidation (TECH-21).
 *
 * The FINAL local gate: a prepared context is revalidated against CURRENT state
 * + an authentic exact-scope PolicyDecision immediately before the side effect.
 * An earlier successful `prepareRoomAuthorizationV1` is NOT sufficient — any
 * change to membership revision, role, room policy revision, privacy mode, room
 * lifecycle, or the bound operation/object/view/target invalidates it. The
 * context is never auto-refreshed; the caller must prepare again.
 */

import { isPolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { ROOM_CAPABILITY } from "../room-policy";
import type { RoomPolicy } from "../room-policy";
import type { RoomMaterializedState } from "../room-state";
import type { RoomObjectId, RoomObjectV1 } from "../objects";
import type { RoomQueryViewClass } from "../query";
import {
  assertRoomCapabilityDescriptorCurrentV1,
  type RoomCapabilityNameV1,
  type RoomMembershipRecordV1,
} from "../membership";
import {
  resolveEffectiveDevicePostureV1,
  type DevicePostureSignalV1,
} from "../policy-composition/device-posture";
import {
  AuthorizationObjectBindingError,
  AuthorizationOperationBindingError,
  AuthorizationRevisionMismatchError,
  AuthorizationTargetBindingError,
  AuthorizationViewBindingError,
  MembershipRemovedError,
  MembershipSuspendedError,
  PreparedAuthorizationStaleError,
  PrivacyModeRevisionMismatchError,
  RoleCapabilityRevokedError,
  RoomAuthorizationError,
  RoomPolicyRevisionMismatchError,
} from "./authorization-errors";
import { roomPolicyRevisionOfV1 } from "./authorization-revision";
import type { PreparedRoomAuthorizationV1 } from "./prepared-authorization";

export function assertPreparedRoomAuthorizationCurrentV1(input: {
  prepared: PreparedRoomAuthorizationV1;
  currentRoomState: RoomMaterializedState;
  currentMembership: RoomMembershipRecordV1;
  currentRoomPolicy: RoomPolicy;
  decision: PolicyDecision;
  actualRequiredCapability: RoomCapabilityNameV1;
  actualSideEffect: string;
  actualObjectId?: RoomObjectId;
  actualObjectKind?: RoomObjectV1["kind"];
  actualRequestedView?: RoomQueryViewClass;
  actualTargetMembership?: RoomMembershipRecordV1;
  /** Current device-posture signal (TECH-22). A posture change invalidates. */
  currentDevicePostureSignal?: DevicePostureSignalV1;
}): void {
  const { prepared, currentRoomState: rs, currentMembership: m, currentRoomPolicy } = input;

  // 1. Structurally valid + non-authoritative.
  if (prepared.schemaVersion !== 1 || prepared.authoritative !== false) {
    throw new PreparedAuthorizationStaleError("structure");
  }
  // 2. Room matches (room changes always reject).
  if (prepared.roomId !== rs.roomId || prepared.revision.roomId !== rs.roomId) {
    throw new AuthorizationRevisionMismatchError("room");
  }
  // 3-4. Current membership exists in the projection and its ID matches.
  const inProjection = (rs.membershipRecords ?? []).find(
    (r) => r.membershipId === prepared.membershipId,
  );
  if (inProjection === undefined || m.membershipId !== prepared.membershipId) {
    throw new MembershipRemovedError();
  }
  // 5. Member ref matches.
  if (m.memberRef !== prepared.memberRef)
    throw new AuthorizationRevisionMismatchError("member_ref");
  // 6. Membership active.
  if (m.state === "removed_tombstone") throw new MembershipRemovedError();
  if (m.state !== "active_local_unverified") throw new MembershipSuspendedError();
  // 7. Membership revision matches.
  if ((m.revision as number) !== (prepared.revision.membershipRevision as number)) {
    throw new AuthorizationRevisionMismatchError("membership_revision");
  }
  // 8. Role still matches the descriptor's source role.
  if (m.role !== prepared.capability.sourceRole) throw new RoleCapabilityRevokedError();
  // 9. Room-policy revision matches.
  if (roomPolicyRevisionOfV1(rs, currentRoomPolicy) !== prepared.revision.roomPolicyRevision) {
    throw new RoomPolicyRevisionMismatchError();
  }
  // 10. Privacy mode matches.
  if (rs.mode !== prepared.revision.privacyMode) throw new PrivacyModeRevisionMismatchError();
  // 11. Room lifecycle matches.
  if (rs.lifecycle !== prepared.revision.roomLifecycle) {
    throw new AuthorizationRevisionMismatchError("lifecycle");
  }
  // 11b. Device posture matches (TECH-22). Any change (esp. → at_risk)
  // invalidates; posture improvement also requires fresh authorization.
  {
    const currentPosture = resolveEffectiveDevicePostureV1(input.currentDevicePostureSignal);
    if (
      currentPosture.effectivePosture !== prepared.revision.effectiveDevicePosture ||
      currentPosture.signalRevision !== prepared.revision.devicePostureSignalRevision
    ) {
      throw new AuthorizationRevisionMismatchError("device_posture");
    }
  }
  // 12. Capability descriptor remains current (defence in depth).
  assertRoomCapabilityDescriptorCurrentV1({
    descriptor: prepared.capability,
    currentMembership: m,
  });

  // 13. Capability scope matches the ACTUAL object / view / target.
  if (prepared.objectId !== input.actualObjectId) throw new AuthorizationObjectBindingError();
  if (prepared.objectKind !== input.actualObjectKind) throw new AuthorizationObjectBindingError();
  if (prepared.requestedView !== input.actualRequestedView)
    throw new AuthorizationViewBindingError();
  if (prepared.targetMembershipId !== input.actualTargetMembership?.membershipId) {
    throw new AuthorizationTargetBindingError();
  }
  if (
    prepared.targetMembershipRevision !== undefined &&
    (prepared.targetMembershipRevision as number) !==
      (input.actualTargetMembership?.revision as number)
  ) {
    throw new AuthorizationTargetBindingError();
  }

  // 14. Required operation matches.
  if (
    prepared.requiredCapability !== input.actualRequiredCapability ||
    prepared.requiredSideEffect !== input.actualSideEffect
  ) {
    throw new AuthorizationOperationBindingError();
  }

  // 15-16. Authentic PolicyDecision with the EXACT side-effect scope.
  if (!isPolicyDecision(input.decision)) throw new RoomAuthorizationError("decision_missing");
  if (input.decision.verdict !== "allowed")
    throw new RoomAuthorizationError("decision_mismatch", "verdict");
  if (input.decision.capability !== ROOM_CAPABILITY)
    throw new RoomAuthorizationError("decision_mismatch");
  if (input.decision.sideEffect !== input.actualSideEffect) {
    throw new RoomAuthorizationError("decision_mismatch");
  }
}
