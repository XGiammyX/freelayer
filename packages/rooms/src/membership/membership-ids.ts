/**
 * RoomOS membership identifiers + revision (TECH-20).
 *
 * Membership IDs are OPAQUE LOCAL references: no email/phone/alias/room title/
 * timestamp encoded, no authenticity claim (Gate G owns identity, Gate F owns
 * crypto). Revisions are POSITIVE LOCAL optimistic-concurrency counters — not
 * distributed clocks (Gate H), not tamper resistance (Gate F).
 */

import { RoomMembershipValidationError } from "./membership-errors";

export type RoomMembershipId = string & {
  readonly __roomMembershipId: unique symbol;
};

export type RoomMembershipRevision = number & {
  readonly __roomMembershipRevision: unique symbol;
};

export type RoomMembershipSchemaVersion = 1;
export const ROOM_MEMBERSHIP_SCHEMA_VERSION = 1 as const;

export const FIRST_MEMBERSHIP_REVISION = 1 as RoomMembershipRevision;
export const MAX_MEMBERSHIP_REVISION = Number.MAX_SAFE_INTEGER - 1;

const MEMBERSHIP_ID_RE = /^[a-z0-9][a-z0-9_-]{2,127}$/;

export function validateRoomMembershipId(input: string): RoomMembershipId {
  if (typeof input !== "string" || !MEMBERSHIP_ID_RE.test(input)) {
    throw new RoomMembershipValidationError("invalid_membership_id");
  }
  return input as RoomMembershipId;
}

export function isRoomMembershipId(input: unknown): input is RoomMembershipId {
  return typeof input === "string" && MEMBERSHIP_ID_RE.test(input);
}

export function validateRoomMembershipRevision(input: number): RoomMembershipRevision {
  if (
    typeof input !== "number" ||
    !Number.isSafeInteger(input) ||
    input < 1 ||
    input > MAX_MEMBERSHIP_REVISION
  ) {
    throw new RoomMembershipValidationError("invalid_revision");
  }
  return input as RoomMembershipRevision;
}

export function nextRoomMembershipRevision(
  current: RoomMembershipRevision,
): RoomMembershipRevision {
  const next = (current as number) + 1;
  if (next > MAX_MEMBERSHIP_REVISION) {
    throw new RoomMembershipValidationError("revision_overflow");
  }
  return next as RoomMembershipRevision;
}

/** Injected at the membership-creation boundary — never inside a reducer. */
export interface RoomMembershipIdGenerator {
  nextRoomMembershipId(): RoomMembershipId;
}
