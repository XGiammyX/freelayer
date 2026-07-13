/**
 * RoomOS membership mutation events (TECH-20). Each accepted membership change
 * produces a versioned, operation-specific event carrying the RESULTING record
 * so replay is deterministic and total. Local, unsigned, unencrypted. Payloads
 * carry NO display name/email/phone/key/invite secret/identity proof/device
 * fingerprint/endpoint-risk report. The clock is injected at the creation
 * boundary only — reducers/replay never read time.
 */

import type { RoomLocalId, RoomMemberRef } from "../room-types";
import type { RoomLocalClock } from "../room-event-v1";
import { RoomMembershipError } from "./membership-errors";
import {
  FIRST_MEMBERSHIP_REVISION,
  nextRoomMembershipRevision,
  ROOM_MEMBERSHIP_SCHEMA_VERSION,
  type RoomMembershipId,
  type RoomMembershipRevision,
} from "./membership-ids";
import type { RoomMembershipCommandName, RoomMembershipCommandV1 } from "./membership-commands";
import type { RoomMembershipRoleV1 } from "./membership-roles";
import {
  assertMembershipTransition,
  type RoomMembershipRecordV1,
  type RoomMembershipStateV1,
} from "./membership-types";

export type RoomMembershipEventOperation =
  | "membership.owner_bootstrapped_placeholder.v1"
  | "membership.added_placeholder.v1"
  | "membership.role_changed_placeholder.v1"
  | "membership.suspended_local.v1"
  | "membership.reactivated_local.v1"
  | "membership.removed_tombstone.v1";

const COMMAND_TO_EVENT: Readonly<Record<RoomMembershipCommandName, RoomMembershipEventOperation>> =
  {
    "membership.bootstrap_local_owner_placeholder": "membership.owner_bootstrapped_placeholder.v1",
    "membership.add_local_placeholder": "membership.added_placeholder.v1",
    "membership.change_role": "membership.role_changed_placeholder.v1",
    "membership.suspend_local": "membership.suspended_local.v1",
    "membership.reactivate_local": "membership.reactivated_local.v1",
    "membership.remove_tombstone": "membership.removed_tombstone.v1",
  };

export interface RoomMembershipEventV1 {
  readonly schemaVersion: 1;
  readonly projectionVersion: 1;
  readonly membershipEventId: string;
  readonly roomId: RoomLocalId;
  readonly membershipId: RoomMembershipId;
  readonly memberRef: RoomMemberRef;
  readonly operation: RoomMembershipEventOperation;
  readonly localSequence: number;
  readonly createdAtLocal: string;
  readonly previousRole: RoomMembershipRoleV1 | null;
  readonly resultingRole: RoomMembershipRoleV1;
  readonly previousState: RoomMembershipStateV1 | null;
  readonly resultingState: RoomMembershipStateV1;
  readonly previousRevision: RoomMembershipRevision | null;
  readonly resultingRevision: RoomMembershipRevision;
  readonly record: RoomMembershipRecordV1;
}

function freeze<T>(v: T): T {
  return Object.freeze(v);
}

/** Apply a validated command to the current record (or undefined for create). */
export function buildResultingMembership(input: {
  current: RoomMembershipRecordV1 | undefined;
  command: RoomMembershipCommandV1;
  membershipId: RoomMembershipId;
  memberRef: RoomMemberRef;
  nowLocal: string;
}): {
  record: RoomMembershipRecordV1;
  previous: RoomMembershipRecordV1 | undefined;
} {
  const { current, command, membershipId, memberRef, nowLocal } = input;
  const cmd = command.command;

  if (
    cmd === "membership.bootstrap_local_owner_placeholder" ||
    cmd === "membership.add_local_placeholder"
  ) {
    if (current !== undefined) throw new RoomMembershipError("duplicate_active_membership");
    const role: RoomMembershipRoleV1 =
      cmd === "membership.bootstrap_local_owner_placeholder" ? "owner_placeholder" : command.role;
    const record: RoomMembershipRecordV1 = freeze({
      schemaVersion: 1,
      membershipId,
      roomId: command.roomId,
      memberRef,
      role,
      state: "active_local_unverified",
      revision: FIRST_MEMBERSHIP_REVISION,
      origin:
        cmd === "membership.bootstrap_local_owner_placeholder"
          ? "local_room_bootstrap"
          : "local_added_placeholder",
      verification: "unverified_placeholder",
      createdAtLocal: nowLocal,
      updatedAtLocal: nowLocal,
    });
    return { record, previous: undefined };
  }

  if (current === undefined) throw new RoomMembershipError("membership_not_found");
  const resultingRevision = nextRoomMembershipRevision(current.revision);
  const meta = { revision: resultingRevision, updatedAtLocal: nowLocal };

  switch (cmd) {
    case "membership.change_role":
      // Role change does not alter lifecycle state; must remain active.
      if (current.state !== "active_local_unverified") {
        throw new RoomMembershipError("invalid_lifecycle_transition");
      }
      return { record: freeze({ ...current, ...meta, role: command.newRole }), previous: current };
    case "membership.suspend_local":
      assertMembershipTransition(current.state, "suspended_local");
      return {
        record: freeze({ ...current, ...meta, state: "suspended_local" }),
        previous: current,
      };
    case "membership.reactivate_local":
      assertMembershipTransition(current.state, "active_local_unverified");
      return {
        record: freeze({ ...current, ...meta, state: "active_local_unverified" }),
        previous: current,
      };
    case "membership.remove_tombstone":
      assertMembershipTransition(current.state, "removed_tombstone");
      return {
        record: freeze({ ...current, ...meta, state: "removed_tombstone" }),
        previous: current,
      };
    default:
      throw new RoomMembershipError("unknown_command");
  }
}

export function createAcceptedRoomMembershipEventV1(input: {
  command: RoomMembershipCommandV1;
  built: { record: RoomMembershipRecordV1; previous: RoomMembershipRecordV1 | undefined };
  membershipEventId: string;
  localSequence: number;
  clock: RoomLocalClock;
}): RoomMembershipEventV1 {
  const { command, built } = input;
  const now = input.clock.nowLocalIso();
  const createdAtLocal = now.startsWith("local:") ? now : `local:${now}`;
  const { record, previous } = built;
  return freeze<RoomMembershipEventV1>({
    schemaVersion: ROOM_MEMBERSHIP_SCHEMA_VERSION,
    projectionVersion: 1,
    membershipEventId: input.membershipEventId,
    roomId: record.roomId,
    membershipId: record.membershipId,
    memberRef: record.memberRef,
    operation: COMMAND_TO_EVENT[command.command],
    localSequence: input.localSequence,
    createdAtLocal,
    previousRole: previous?.role ?? null,
    resultingRole: record.role,
    previousState: previous?.state ?? null,
    resultingState: record.state,
    previousRevision: previous?.revision ?? null,
    resultingRevision: record.revision,
    record,
  });
}
