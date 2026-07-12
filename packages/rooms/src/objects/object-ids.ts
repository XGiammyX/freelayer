/**
 * RoomOS object identifiers + revisions (TECH-18).
 *
 * Object IDs are OPAQUE LOCAL identifiers: they encode no room title, no member
 * ref, no content, no timestamp, and confer NO authority and NO authenticity
 * (Gate G owns identity; Gate F owns crypto). Revisions are POSITIVE LOCAL
 * optimistic-concurrency counters scoped to one object — not timestamps, not
 * global, not causal ordering, not distributed version vectors (Gate H), not
 * tamper resistance (Gate F).
 */

import { RoomObjectValidationError } from "./object-errors";

export type RoomObjectId = string & {
  readonly __roomObjectId: unique symbol;
};

export type RoomObjectRevision = number & {
  readonly __roomObjectRevision: unique symbol;
};

export type RoomObjectSchemaVersion = 1;

export const ROOM_OBJECT_SCHEMA_VERSION = 1 as const;
export const ROOM_OBJECT_PROJECTION_VERSION = 1 as const;

/** The first materialized revision of a freshly created object. */
export const FIRST_OBJECT_REVISION = 1 as RoomObjectRevision;

/** Overflow guard — revisions never approach this. Keeps increments safe. */
export const MAX_OBJECT_REVISION = Number.MAX_SAFE_INTEGER - 1;

/** Opaque slug: lowercase alnum + `_-`, 3–128 chars. No content, no path. */
const OBJECT_ID_RE = /^[a-z0-9][a-z0-9_-]{2,127}$/;

export function validateRoomObjectId(input: string): RoomObjectId {
  if (typeof input !== "string" || !OBJECT_ID_RE.test(input)) {
    throw new RoomObjectValidationError("invalid_object_id");
  }
  return input as RoomObjectId;
}

export function isRoomObjectId(input: unknown): input is RoomObjectId {
  return typeof input === "string" && OBJECT_ID_RE.test(input);
}

export function validateRoomObjectRevision(input: number): RoomObjectRevision {
  if (
    typeof input !== "number" ||
    !Number.isSafeInteger(input) ||
    input < 1 ||
    input > MAX_OBJECT_REVISION
  ) {
    throw new RoomObjectValidationError("invalid_object_revision");
  }
  return input as RoomObjectRevision;
}

/** Increment by exactly one; reject at the overflow ceiling. */
export function nextRoomObjectRevision(current: RoomObjectRevision): RoomObjectRevision {
  const next = (current as number) + 1;
  if (next > MAX_OBJECT_REVISION) {
    throw new RoomObjectValidationError("revision_overflow");
  }
  return next as RoomObjectRevision;
}

/** Injected at the creation boundary — never called inside a reducer. */
export interface RoomObjectIdGenerator {
  nextRoomObjectId(): RoomObjectId;
}
