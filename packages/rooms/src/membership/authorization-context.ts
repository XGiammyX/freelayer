/**
 * RoomOS authorization context (TECH-20). Ties together a CURRENT membership,
 * a CURRENT non-authoritative capability descriptor, and an AUTHENTIC exact-
 * scope PolicyDecision. A forged descriptor without an authentic decision must
 * fail; the descriptor NEVER authorizes on its own — only the decision does.
 */

import { isPolicyDecision, type PolicyCapability, type PolicyDecision } from "@freelayer/privacy";
import { ROOM_CAPABILITY } from "../room-policy";
import type { RoomLocalId } from "../room-types";
import type { RoomObjectId, RoomObjectV1 } from "../objects";
import type { RoomQueryViewClass } from "../query";
import {
  RoomCapabilityDeniedError,
  RoomCapabilityScopeError,
  RoomMembershipDecisionMismatchError,
} from "./membership-errors";
import type { RoomCapabilityNameV1, RoomLocalCapabilityDescriptorV1 } from "./capability-types";
import { assertRoomCapabilityDescriptorCurrentV1 } from "./capability-attenuation";
import type { RoomMembershipRecordV1 } from "./membership-types";

export const ROOM_MEMBERSHIP_CAPABILITY: PolicyCapability = ROOM_CAPABILITY;

export interface RoomAuthorizationContextV1 {
  readonly membership: RoomMembershipRecordV1;
  readonly capability: RoomLocalCapabilityDescriptorV1;
  readonly decision: PolicyDecision;
}

/**
 * Verify a membership-scoped operation is authorized. Order matters: the
 * capability is checked for CURRENCY and SCOPE, but the AUTHENTIC PolicyDecision
 * (WeakSet provenance + exact side-effect scope) is what actually authorizes.
 */
export function assertRoomAuthorizationContextV1(input: {
  context: RoomAuthorizationContextV1;
  currentMembership: RoomMembershipRecordV1;
  requiredCapability: RoomCapabilityNameV1;
  requiredSideEffect: PolicyDecision["sideEffect"];
  roomId: RoomLocalId;
  objectId?: RoomObjectId;
  objectKind?: RoomObjectV1["kind"];
  requestedView?: RoomQueryViewClass;
}): void {
  const { context, currentMembership } = input;

  // 1-2. Membership + descriptor currency (active, same room/member/id, same
  // revision + role). Stale/suspended/removed → reject.
  assertRoomCapabilityDescriptorCurrentV1({
    descriptor: context.capability,
    currentMembership,
  });

  // 3. Capability scope matches the operation.
  if (context.capability.capability !== input.requiredCapability) {
    throw new RoomCapabilityDeniedError("capability_mismatch");
  }
  if (context.capability.roomId !== input.roomId || currentMembership.roomId !== input.roomId) {
    throw new RoomCapabilityScopeError();
  }
  // Object / view constraints on the descriptor must match the operation.
  if (
    context.capability.exactObjectId !== undefined &&
    context.capability.exactObjectId !== input.objectId
  ) {
    throw new RoomCapabilityScopeError();
  }
  if (
    context.capability.objectKinds !== undefined &&
    input.objectKind !== undefined &&
    !context.capability.objectKinds.includes(input.objectKind)
  ) {
    throw new RoomCapabilityScopeError();
  }

  // 4-5. Authentic PolicyDecision with the EXACT side-effect scope. The
  // descriptor is NEVER treated as authority by itself (7).
  if (!isPolicyDecision(context.decision)) {
    throw new RoomMembershipDecisionMismatchError("decision_missing");
  }
  if (context.decision.verdict !== "allowed") {
    throw new RoomMembershipDecisionMismatchError("verdict_denied");
  }
  if (context.decision.capability !== ROOM_MEMBERSHIP_CAPABILITY) {
    throw new RoomMembershipDecisionMismatchError();
  }
  if (context.decision.sideEffect !== input.requiredSideEffect) {
    throw new RoomMembershipDecisionMismatchError();
  }
}
