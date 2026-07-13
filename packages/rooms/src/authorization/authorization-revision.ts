/**
 * Local authorization revision inputs (TECH-21).
 *
 * A narrow LOCAL fence — NOT a global authorization service, trusted timestamp,
 * cryptographic integrity claim, global ordering, or distributed-consistency
 * token. It captures the local room/membership/policy state that a prepared
 * authorization is bound to, so any relevant local change invalidates it before
 * the next protected operation executes.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomLifecycleState, RoomLocalId } from "../room-types";
import type { RoomPolicy } from "../room-policy";
import type { RoomMaterializedState } from "../room-state";
import type {
  RoomMembershipId,
  RoomMembershipRecordV1,
  RoomMembershipRevision,
} from "../membership";
import type { DevicePosture } from "../policy-composition/device-posture";

export interface RoomAuthorizationRevisionV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly membershipId: RoomMembershipId;
  readonly membershipRevision: RoomMembershipRevision;
  readonly roomPolicyRevision: number;
  readonly roomLifecycle: RoomLifecycleState;
  readonly privacyMode: PrivacyMode;
  // TECH-22: bind the effective device posture + signal revision so a posture
  // change (esp. → at_risk) invalidates a prepared authorization.
  readonly effectiveDevicePosture: DevicePosture;
  readonly devicePostureSignalRevision: number;
}

/**
 * Derive a deterministic local policy-revision fingerprint from the tightening-
 * relevant RoomPolicy flags + mode. Tightening flips a bit → a different value,
 * which invalidates prepared contexts. Used only when the room state carries no
 * explicit `policyRevision`. This is a LOCAL fingerprint, not a global version.
 */
export function computeRoomPolicyFingerprintV1(policy: RoomPolicy): number {
  const bits = [
    policy.allowLocalContentMutation,
    policy.allowPersistentProjection,
    policy.allowOperationLogPersistence,
    policy.allowNetworkSync,
    policy.allowMetadataSignals,
    policy.allowNotifications,
    policy.allowLocalAI,
    policy.redactTitles,
  ];
  // Fold booleans into a small non-negative integer (0..255). Deterministic,
  // local, and stable across identical policies.
  let value = 0;
  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i]) value |= 1 << i;
  }
  return value;
}

/** The current local policy revision: explicit counter if present, else fingerprint. */
export function roomPolicyRevisionOfV1(
  roomState: RoomMaterializedState,
  policy: RoomPolicy,
): number {
  return roomState.policyRevision ?? computeRoomPolicyFingerprintV1(policy);
}

/** Build the authorization-revision fence for a room + membership at a moment. */
export function roomAuthorizationRevisionV1(input: {
  roomState: RoomMaterializedState;
  membership: RoomMembershipRecordV1;
  roomPolicy: RoomPolicy;
  effectiveDevicePosture?: DevicePosture;
  devicePostureSignalRevision?: number;
}): RoomAuthorizationRevisionV1 {
  const { roomState, membership, roomPolicy } = input;
  return {
    schemaVersion: 1,
    roomId: roomState.roomId,
    membershipId: membership.membershipId,
    membershipRevision: membership.revision,
    roomPolicyRevision: roomPolicyRevisionOfV1(roomState, roomPolicy),
    roomLifecycle: roomState.lifecycle,
    privacyMode: roomState.mode,
    // No posture signal → conservative default: unverified, revision 0.
    effectiveDevicePosture: input.effectiveDevicePosture ?? "unverified",
    devicePostureSignalRevision: input.devicePostureSignalRevision ?? 0,
  };
}

/** True iff two revision fences describe the exact same local authorization state. */
export function roomAuthorizationRevisionEqualV1(
  a: RoomAuthorizationRevisionV1,
  b: RoomAuthorizationRevisionV1,
): boolean {
  return (
    a.roomId === b.roomId &&
    a.membershipId === b.membershipId &&
    (a.membershipRevision as number) === (b.membershipRevision as number) &&
    a.roomPolicyRevision === b.roomPolicyRevision &&
    a.roomLifecycle === b.roomLifecycle &&
    a.privacyMode === b.privacyMode &&
    a.effectiveDevicePosture === b.effectiveDevicePosture &&
    a.devicePostureSignalRevision === b.devicePostureSignalRevision
  );
}
