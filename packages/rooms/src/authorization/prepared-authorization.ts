/**
 * Prepared authorization context (TECH-21).
 *
 * A `PreparedRoomAuthorizationV1` is NOT authorization to execute — it is a
 * structured, defensively-cloned INPUT bound to the significant operation data
 * that MUST be revalidated against current state + an authentic PolicyDecision
 * immediately before the side effect. It is never a bearer token, never
 * serialized, never persisted, never cached across a relevant revision change.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomPolicy } from "../room-policy";
import type { RoomMaterializedState } from "../room-state";
import type { RoomObjectId, RoomObjectV1 } from "../objects";
import type { RoomQueryViewClass } from "../query";
import type { RoomLocalId, RoomMemberRef } from "../room-types";
import {
  resolveRoomLocalCapabilityV1,
  type RoomCapabilityNameV1,
  type RoomLocalCapabilityDescriptorV1,
  type RoomMembershipId,
  type RoomMembershipRecordV1,
  type RoomMembershipRevision,
} from "../membership";
import { RoomAuthorizationError } from "./authorization-errors";
import {
  roomAuthorizationRevisionV1,
  type RoomAuthorizationRevisionV1,
} from "./authorization-revision";

export interface PreparedRoomAuthorizationV1 {
  readonly schemaVersion: 1;
  readonly revision: RoomAuthorizationRevisionV1;
  readonly membershipId: RoomMembershipId;
  readonly memberRef: RoomMemberRef;
  readonly capability: RoomLocalCapabilityDescriptorV1;
  readonly requiredCapability: RoomCapabilityNameV1;
  readonly requiredSideEffect: string;
  readonly roomId: RoomLocalId;
  readonly objectId?: RoomObjectId;
  readonly objectKind?: RoomObjectV1["kind"];
  readonly requestedView?: RoomQueryViewClass;
  readonly targetMembershipId?: RoomMembershipId;
  readonly targetMembershipRevision?: RoomMembershipRevision;
  readonly authoritative: false;
  readonly persistence: "forbidden";
  readonly serialization: "forbidden";
}

/**
 * Prepare an authorization context from the CURRENT local projection. No side
 * effect, default-deny, active membership required, every significant field
 * bound. Preparation does NOT consume or replace the PolicyDecision — the final
 * revalidation still requires an authentic exact-scope decision.
 */
export function prepareRoomAuthorizationV1(input: {
  roomState: RoomMaterializedState;
  membership: RoomMembershipRecordV1;
  requestedCapability: RoomCapabilityNameV1;
  requiredSideEffect: string;
  roomPolicy: RoomPolicy;
  objectId?: RoomObjectId;
  objectKind?: RoomObjectV1["kind"];
  requestedView?: RoomQueryViewClass;
  targetMembership?: RoomMembershipRecordV1;
  deviceRiskLevel?: "low" | "medium" | "high" | "critical" | "unknown";
}): PreparedRoomAuthorizationV1 {
  const { roomState, membership, roomPolicy } = input;

  // Actor membership must be the CURRENT active record for this room.
  const current = (roomState.membershipRecords ?? []).find(
    (r) => r.membershipId === membership.membershipId,
  );
  if (current === undefined || current.state !== "active_local_unverified") {
    throw new RoomAuthorizationError("membership_suspended", "actor_not_active");
  }

  const resolution = resolveRoomLocalCapabilityV1({
    membership: current,
    requestedCapability: input.requestedCapability,
    mode: roomState.mode as PrivacyMode,
    roomPolicy,
    ...(input.objectKind !== undefined ? { objectKind: input.objectKind } : {}),
    ...(input.objectId !== undefined ? { objectId: input.objectId } : {}),
    ...(input.requestedView !== undefined ? { requestedView: input.requestedView } : {}),
    ...(input.deviceRiskLevel !== undefined ? { deviceRiskLevel: input.deviceRiskLevel } : {}),
  });
  if (!resolution.allowed) {
    throw new RoomAuthorizationError("role_capability_revoked", resolution.reasonCode);
  }

  const prepared: PreparedRoomAuthorizationV1 = {
    schemaVersion: 1,
    revision: roomAuthorizationRevisionV1({ roomState, membership: current, roomPolicy }),
    membershipId: current.membershipId,
    memberRef: current.memberRef,
    capability: resolution.descriptor,
    requiredCapability: input.requestedCapability,
    requiredSideEffect: input.requiredSideEffect,
    roomId: roomState.roomId,
    authoritative: false,
    persistence: "forbidden",
    serialization: "forbidden",
    ...(input.objectId !== undefined ? { objectId: input.objectId } : {}),
    ...(input.objectKind !== undefined ? { objectKind: input.objectKind } : {}),
    ...(input.requestedView !== undefined ? { requestedView: input.requestedView } : {}),
    ...(input.targetMembership !== undefined
      ? {
          targetMembershipId: input.targetMembership.membershipId,
          targetMembershipRevision: input.targetMembership.revision,
        }
      : {}),
  };
  return Object.freeze(prepared);
}
