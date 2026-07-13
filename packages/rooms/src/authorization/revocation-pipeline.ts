/**
 * Local membership revocation pipeline (TECH-21). RESTRICTIVE operations
 * (suspend / remove tombstone / role downgrade) with execution-time prepared-
 * authorization revalidation. A restrictive command may NOT carry an expansive
 * target state (no escalation smuggling). No partial effects on failure. Local
 * only — invalidation applies to the current local projection, not remote
 * copies or distributed state.
 */

import type { PolicyDecision } from "@freelayer/privacy";
import type { RoomLocalClock, RoomEventId, RoomLocalSequence } from "../room-event-v1";
import type { RoomPolicy } from "../room-policy";
import type { RoomMaterializedState } from "../room-state";
import {
  applyLocalRoomMembershipMutationV1,
  type ChangeLocalMemberRoleCommandV1,
  type RemoveLocalMembershipTombstoneCommandV1,
  type RoomAuthorizationContextV1,
  type RoomMembershipEventV1,
  type RoomMembershipLog,
  type RoomMembershipRecordV1,
  type RoomMembershipRevision,
  type SuspendLocalMembershipCommandV1,
  validateRoomMembershipCommandV1,
} from "../membership";
import {
  MembershipRemovedError,
  RestrictiveOperationEscalationError,
  RoomAuthorizationError,
} from "./authorization-errors";
import { assertPreparedRoomAuthorizationCurrentV1 } from "./authorization-revalidation";
import { classifyMembershipChangeDirectionV1 } from "./role-authority";
import type { PreparedRoomAuthorizationV1 } from "./prepared-authorization";

type RevocationCommandV1 =
  | SuspendLocalMembershipCommandV1
  | RemoveLocalMembershipTombstoneCommandV1
  | ChangeLocalMemberRoleCommandV1;

export interface ApplyLocalMembershipRevocationResultV1 {
  readonly event: RoomMembershipEventV1;
  readonly nextState: RoomMaterializedState;
  readonly membership: RoomMembershipRecordV1;
  readonly invalidatedMembershipRevision: RoomMembershipRevision;
  readonly retained: "memory" | "null";
}

const COMMAND_CAPABILITY = {
  "membership.suspend_local": "room.membership.suspend",
  "membership.remove_tombstone": "room.membership.remove_tombstone",
  "membership.change_role": "room.membership.change_role",
} as const;
const COMMAND_SIDE_EFFECT = {
  "membership.suspend_local": "room.membership.suspend",
  "membership.remove_tombstone": "room.membership.remove",
  "membership.change_role": "room.membership.change_role",
} as const;

export function applyLocalMembershipRevocationV1(input: {
  roomState: RoomMaterializedState;
  command: RevocationCommandV1;
  preparedAuthorization: PreparedRoomAuthorizationV1;
  decision: PolicyDecision;
  storageDecision: PolicyDecision;
  roomPolicy: RoomPolicy;
  eventId: RoomEventId;
  localSequence: RoomLocalSequence;
  clock: RoomLocalClock;
  operationLog: RoomMembershipLog;
}): ApplyLocalMembershipRevocationResultV1 {
  const { roomState, roomPolicy, preparedAuthorization: prepared } = input;

  // 1. Validate command (defensive; input is typed but comes from a boundary).
  const command = validateRoomMembershipCommandV1(input.command) as RevocationCommandV1;

  // 2-3. Load current actor + target membership.
  const records = roomState.membershipRecords ?? [];
  const actor = records.find((r) => r.membershipId === prepared.membershipId);
  const target = records.find((r) => r.membershipId === command.membershipId);
  if (actor === undefined) throw new MembershipRemovedError();
  if (target === undefined) throw new RoomAuthorizationError("authorization_target_binding");

  // 4-5. Classify direction — this pipeline is for RESTRICTIVE/neutral ops only.
  const direction = classifyMembershipChangeDirectionV1(command, target);
  if (direction === "expansive" || direction === "unknown") {
    throw new RestrictiveOperationEscalationError(direction);
  }

  // 6-7. Execution-time revalidation of the prepared authorization + decision.
  assertPreparedRoomAuthorizationCurrentV1({
    prepared,
    currentRoomState: roomState,
    currentMembership: actor,
    currentRoomPolicy: roomPolicy,
    decision: input.decision,
    actualRequiredCapability: COMMAND_CAPABILITY[command.command],
    actualSideEffect: COMMAND_SIDE_EFFECT[command.command],
    actualTargetMembership: target,
  });

  const invalidatedMembershipRevision = target.revision;

  // 8-16. Delegate to the TECH-20 membership pipeline (owner continuity,
  // expected revision, event, separate storage decision, log, pure reducer).
  const authorization: RoomAuthorizationContextV1 = {
    membership: actor,
    capability: prepared.capability,
    decision: input.decision,
  };
  const result = applyLocalRoomMembershipMutationV1({
    roomState,
    command,
    roomPolicy,
    authorization,
    storageDecision: input.storageDecision,
    eventId: input.eventId,
    localSequence: input.localSequence,
    clock: input.clock,
    operationLog: input.operationLog,
  });

  return {
    event: result.event,
    nextState: result.nextState,
    membership: result.membership,
    invalidatedMembershipRevision,
    retained: result.retained,
  };
}
