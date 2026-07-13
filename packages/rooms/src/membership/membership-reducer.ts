/**
 * Pure membership reducer + projection (TECH-20). PURE: no clock/id/storage/
 * network/notification/AI/endpoint, no global state, no input mutation, no
 * silent fallback. One active record per room/member pair; membership IDs
 * unique; deterministic order (first-appearance); tombstones never resurrect.
 */

import type { RoomLocalId } from "../room-types";
import { cloneRoomProjection } from "../room-event-v1";
import { RoomMembershipDuplicateError, RoomMembershipError } from "./membership-errors";
import type { RoomMembershipEventV1 } from "./membership-events";
import type { RoomMembershipRecordV1 } from "./membership-types";

/** Apply one accepted membership event to the record set, returning a NEW set. */
export function reduceRoomMembershipEventV1(
  current: readonly RoomMembershipRecordV1[],
  event: RoomMembershipEventV1,
): readonly RoomMembershipRecordV1[] {
  const index = current.findIndex((r) => r.membershipId === event.membershipId);

  if (event.previousRevision === null) {
    // Creation (bootstrap/add): the membership id must be new AND no ACTIVE
    // record may already exist for this room/member pair.
    if (index >= 0) throw new RoomMembershipError("duplicate_active_membership");
    const activeDuplicate = current.some(
      (r) =>
        r.roomId === event.roomId &&
        r.memberRef === event.memberRef &&
        r.state === "active_local_unverified",
    );
    if (activeDuplicate) throw new RoomMembershipDuplicateError();
    return [...current, cloneRoomProjection(event.record)];
  }

  if (index < 0) throw new RoomMembershipError("membership_not_found");
  const existing = current[index]!;
  if (existing.roomId !== event.roomId) throw new RoomMembershipError("room_mismatch");
  if ((existing.revision as number) !== (event.previousRevision as number)) {
    throw new RoomMembershipError("stale_revision");
  }
  if (existing.state === "removed_tombstone") {
    throw new RoomMembershipError("membership_terminal");
  }
  const next = current.slice();
  next[index] = cloneRoomProjection(event.record);
  return next;
}

export interface RoomMembershipProjectionV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly records: readonly RoomMembershipRecordV1[];
}

export function emptyRoomMembershipProjection(roomId: RoomLocalId): RoomMembershipProjectionV1 {
  return { schemaVersion: 1, roomId, records: [] };
}

export function countActiveOwners(records: readonly RoomMembershipRecordV1[]): number {
  return records.filter(
    (r) => r.role === "owner_placeholder" && r.state === "active_local_unverified",
  ).length;
}

/** Deterministic replay (validate contiguous sequence then apply). */
export function replayRoomMembershipEventsV1(input: {
  seed: readonly RoomMembershipRecordV1[];
  events: readonly RoomMembershipEventV1[];
}): readonly RoomMembershipRecordV1[] {
  let previousSequence: number | undefined;
  for (const event of input.events) {
    if (previousSequence !== undefined && event.localSequence !== previousSequence + 1) {
      throw new RoomMembershipError("invalid_lifecycle_transition");
    }
    previousSequence = event.localSequence;
  }
  let records = cloneRoomProjection(input.seed) as readonly RoomMembershipRecordV1[];
  for (const event of input.events) records = reduceRoomMembershipEventV1(records, event);
  return records;
}
