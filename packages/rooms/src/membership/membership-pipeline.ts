/**
 * The single policy-gated local membership mutation pipeline (TECH-20).
 *
 * All validation happens BEFORE any side effect: a failure produces no event,
 * no log entry, and no projection change. Bootstrap requires an exact bootstrap
 * decision + empty membership; other mutations require an authorization context
 * (current membership + current non-authoritative capability + authentic exact-
 * scope decision). The membership mutation and the membership-log append are
 * SEPARATE decisions. Owner-continuity is enforced. No network/notification/AI.
 */

import {
  evaluatePolicyMatrix,
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
} from "@freelayer/privacy";
import type { RoomLocalClock, RoomEventId, RoomLocalSequence } from "../room-event-v1";
import type { RoomPolicy } from "../room-policy";
import type { RoomMaterializedState } from "../room-state";
import type { RoomMemberRef } from "../room-types";
import {
  RoomLastOwnerContinuityError,
  RoomMembershipDecisionMismatchError,
  RoomMembershipError,
  RoomMembershipNotFoundError,
  RoomMembershipPolicyDeniedError,
  RoomMembershipRevisionError,
} from "./membership-errors";
import {
  ROOM_MEMBERSHIP_CAPABILITY,
  type RoomAuthorizationContextV1,
} from "./authorization-context";
import {
  validateRoomMembershipCommandV1,
  type RoomMembershipCommandV1,
} from "./membership-commands";
import {
  buildResultingMembership,
  createAcceptedRoomMembershipEventV1,
  type RoomMembershipEventV1,
} from "./membership-events";
import { InMemoryRoomMembershipLog, type RoomMembershipLog } from "./membership-log";
import { resolveRoomMembershipPolicyV1 } from "./membership-policy";
import { countActiveOwners, reduceRoomMembershipEventV1 } from "./membership-reducer";
import type { RoomMembershipId } from "./membership-ids";
import { assertRoomAuthorizationContextV1 } from "./authorization-context";
import type { RoomMembershipRecordV1 } from "./membership-types";

export interface ApplyRoomMembershipMutationResultV1 {
  readonly event: RoomMembershipEventV1;
  readonly nextState: RoomMaterializedState;
  readonly membership: RoomMembershipRecordV1;
  readonly retained: "memory" | "null";
}

const COMMAND_SIDE_EFFECT: Readonly<
  Record<RoomMembershipCommandV1["command"], PolicySideEffectScope>
> = {
  "membership.bootstrap_local_owner_placeholder": "room.membership.bootstrap",
  "membership.add_local_placeholder": "room.membership.add",
  "membership.change_role": "room.membership.change_role",
  "membership.suspend_local": "room.membership.suspend",
  "membership.reactivate_local": "room.membership.reactivate",
  "membership.remove_tombstone": "room.membership.remove",
};

const COMMAND_MATRIX_OP: Readonly<Record<RoomMembershipCommandV1["command"], string>> = {
  "membership.bootstrap_local_owner_placeholder": "room.membership.bootstrap",
  "membership.add_local_placeholder": "room.membership.add",
  "membership.change_role": "room.membership.change_role",
  "membership.suspend_local": "room.membership.suspend",
  "membership.reactivate_local": "room.membership.reactivate",
  "membership.remove_tombstone": "room.membership.remove",
};

function records(state: RoomMaterializedState): readonly RoomMembershipRecordV1[] {
  return state.membershipRecords ?? [];
}

/** Owner-continuity: an active local room must keep ≥1 active owner placeholder. */
function assertOwnerContinuity(
  current: readonly RoomMembershipRecordV1[],
  target: RoomMembershipRecordV1 | undefined,
  command: RoomMembershipCommandV1,
): void {
  if (target === undefined) return;
  const removesOwner =
    target.role === "owner_placeholder" &&
    target.state === "active_local_unverified" &&
    (command.command === "membership.suspend_local" ||
      command.command === "membership.remove_tombstone" ||
      (command.command === "membership.change_role" && command.newRole !== "owner_placeholder"));
  if (!removesOwner) return;
  if (countActiveOwners(current) <= 1) {
    throw new RoomLastOwnerContinuityError();
  }
}

export function applyLocalRoomMembershipMutationV1(input: {
  roomState: RoomMaterializedState;
  command: unknown;
  roomPolicy: RoomPolicy;
  authorization?: RoomAuthorizationContextV1;
  bootstrapDecision?: PolicyDecision;
  storageDecision: PolicyDecision;
  eventId: RoomEventId;
  localSequence: RoomLocalSequence;
  membershipId?: RoomMembershipId;
  clock: RoomLocalClock;
  operationLog?: RoomMembershipLog;
}): ApplyRoomMembershipMutationResultV1 {
  const { roomState, roomPolicy } = input;

  // 1. Validate command. 2. Room relationship.
  const command = validateRoomMembershipCommandV1(input.command);
  if (command.roomId !== roomState.roomId) throw new RoomMembershipError("room_mismatch");
  const current = records(roomState);
  const isBootstrapOrAdd =
    command.command === "membership.bootstrap_local_owner_placeholder" ||
    command.command === "membership.add_local_placeholder";

  // Locate the target for update commands.
  const target = isBootstrapOrAdd
    ? undefined
    : current.find(
        (r) => r.membershipId === (command as { membershipId: RoomMembershipId }).membershipId,
      );
  if (!isBootstrapOrAdd && target === undefined) throw new RoomMembershipNotFoundError();

  // 3. Membership policy. 4. Policy Matrix.
  const policy = resolveRoomMembershipPolicyV1({
    mode: command.mode,
    command: command.command,
    ...(target?.role !== undefined ? { currentRole: target.role } : {}),
    ...(command.command === "membership.change_role" ? { targetRole: command.newRole } : {}),
    roomPolicy,
    ...(target?.state !== undefined ? { membershipState: target.state } : {}),
    activeOwnerCount: countActiveOwners(current),
  });
  if (!policy.allowed) throw new RoomMembershipPolicyDeniedError(policy.reasonCode);
  const matrix = evaluatePolicyMatrix({
    mode: command.mode as never,
    domain: "room",
    operation: COMMAND_MATRIX_OP[command.command],
  });
  if (matrix.effect !== "memory_only") throw new RoomMembershipPolicyDeniedError(matrix.effect);

  // 5/6. Authorization.
  if (command.command === "membership.bootstrap_local_owner_placeholder") {
    if (!isPolicyDecision(input.bootstrapDecision)) {
      throw new RoomMembershipDecisionMismatchError("decision_missing");
    }
    if (
      input.bootstrapDecision.verdict !== "allowed" ||
      input.bootstrapDecision.capability !== ROOM_MEMBERSHIP_CAPABILITY ||
      input.bootstrapDecision.sideEffect !== "room.membership.bootstrap"
    ) {
      throw new RoomMembershipDecisionMismatchError();
    }
    if (current.length > 0) throw new RoomMembershipError("duplicate_active_membership");
  } else {
    if (input.authorization === undefined)
      throw new RoomMembershipDecisionMismatchError("decision_missing");
    assertRoomAuthorizationContextV1({
      context: input.authorization,
      currentMembership: input.authorization.membership,
      requiredCapability:
        command.command === "membership.add_local_placeholder"
          ? "room.membership.add_placeholder"
          : command.command === "membership.change_role"
            ? "room.membership.change_role"
            : command.command === "membership.suspend_local"
              ? "room.membership.suspend"
              : command.command === "membership.reactivate_local"
                ? "room.membership.reactivate"
                : "room.membership.remove_tombstone",
      requiredSideEffect: COMMAND_SIDE_EFFECT[command.command],
      roomId: roomState.roomId,
    });
    // The acting membership must be a current, active member of THIS room.
    const actor = current.find(
      (r) => r.membershipId === input.authorization!.membership.membershipId,
    );
    if (actor === undefined || actor.state !== "active_local_unverified") {
      throw new RoomMembershipPolicyDeniedError("actor_not_active");
    }
  }

  // 7. Expected revision (update commands).
  if (!isBootstrapOrAdd) {
    const expected = (command as { expectedRevision: number }).expectedRevision;
    const cur = target!.revision as number;
    if (expected < cur) throw new RoomMembershipRevisionError("stale_revision");
    if (expected > cur) throw new RoomMembershipRevisionError("future_revision");
  }

  // 8. Owner-continuity invariant.
  assertOwnerContinuity(current, target, command);

  // 9. Build event (injected clock/id). Dry-run is the build itself + reduce.
  const memberRef: RoomMemberRef = isBootstrapOrAdd
    ? (command as { memberRef: RoomMemberRef }).memberRef
    : target!.memberRef;
  const membershipId = isBootstrapOrAdd
    ? (input.membershipId ?? throwMissingId())
    : target!.membershipId;
  const built = buildResultingMembership({
    current: target,
    command,
    membershipId,
    memberRef,
    nowLocal: nowLocal(input.clock),
  });

  const log = input.operationLog ?? new InMemoryRoomMembershipLog(roomState.roomId);
  const localSequence = log.nextLocalSequence();
  const event = createAcceptedRoomMembershipEventV1({
    command,
    built,
    membershipEventId: input.eventId as unknown as string,
    localSequence,
    clock: input.clock,
  });

  // 10-12. Separate storage decision → append to memory/null log.
  const append = log.append(event, input.storageDecision);

  // 13. Pure reducer → next projection.
  const nextRecords = reduceRoomMembershipEventV1(current, event);
  const nextState: RoomMaterializedState = { ...roomState, membershipRecords: nextRecords };

  return {
    event,
    nextState,
    membership: built.record,
    retained: append.retained ? "memory" : "null",
  };
}

function throwMissingId(): never {
  throw new RoomMembershipError("invalid_membership_id");
}

function nowLocal(clock: RoomLocalClock): string {
  const now = clock.nowLocalIso();
  return now.startsWith("local:") ? now : `local:${now}`;
}
