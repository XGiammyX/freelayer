/**
 * Pure object reducer + projection (TECH-18).
 *
 * The reducer is a PURE function of (current object, event): no clock, no id
 * generation, no storage/network/notification/AI/endpoint calls, no global
 * mutable state, no input mutation, no silent fallback. It returns a new
 * object; it never mutates `current` or `event`. Replay reproduces accepted
 * events deterministically.
 */

import type { RoomLocalId } from "../room-types";
import { cloneRoomProjection } from "../room-event-v1";
import { RoomObjectConcurrencyError, RoomObjectError } from "./object-errors";
import { ROOM_OBJECT_PROJECTION_VERSION, ROOM_OBJECT_SCHEMA_VERSION } from "./object-ids";
import type { RoomObjectEventV1 } from "./object-events";
import type { RoomObjectV1 } from "./object-types";

/**
 * Apply ONE accepted object event to the current object (or undefined for a
 * create). Enforces revision continuity so replay cannot skip an increment.
 */
export function reduceRoomObjectEventV1(
  current: RoomObjectV1 | undefined,
  event: RoomObjectEventV1,
): RoomObjectV1 {
  if (event.previousRevision === null) {
    if (current !== undefined) {
      throw new RoomObjectConcurrencyError("invalid_lifecycle_transition");
    }
  } else {
    if (current === undefined) throw new RoomObjectError("object_not_found");
    if (current.objectId !== event.objectId) throw new RoomObjectError("cross_object_reference");
    if (current.roomId !== event.roomId) throw new RoomObjectError("room_mismatch");
    if ((current.revision as number) !== (event.previousRevision as number)) {
      throw new RoomObjectConcurrencyError("stale_revision");
    }
    if (current.lifecycle === "deleted_tombstone") {
      throw new RoomObjectConcurrencyError("object_is_terminal");
    }
  }
  // The event carries the resulting object; clone so no shared reference leaks.
  return cloneRoomProjection(event.object);
}

// ---------------------------------------------------------------------------
// Object projection (a deterministic, immutable, per-room object collection)
// ---------------------------------------------------------------------------

export interface RoomObjectProjectionV1 {
  readonly schemaVersion: 1;
  readonly projectionVersion: 1;
  readonly roomId: RoomLocalId;
  /** Deterministic order: objects appear in first-creation order. */
  readonly objects: readonly RoomObjectV1[];
}

export function emptyRoomObjectProjection(roomId: RoomLocalId): RoomObjectProjectionV1 {
  return {
    schemaVersion: ROOM_OBJECT_SCHEMA_VERSION,
    projectionVersion: ROOM_OBJECT_PROJECTION_VERSION,
    roomId,
    objects: [],
  };
}

/** Apply one event to the projection, returning a NEW projection. */
export function applyObjectEventToProjectionV1(
  projection: RoomObjectProjectionV1,
  event: RoomObjectEventV1,
): RoomObjectProjectionV1 {
  if (event.roomId !== projection.roomId) {
    throw new RoomObjectError("room_mismatch");
  }
  const index = projection.objects.findIndex((o) => o.objectId === event.objectId);
  const current = index >= 0 ? projection.objects[index] : undefined;
  const next = reduceRoomObjectEventV1(current, event);

  if (index < 0) {
    return { ...projection, objects: [...projection.objects, next] };
  }
  const objects = projection.objects.slice();
  objects[index] = next;
  return { ...projection, objects };
}

export interface RoomObjectReplayResultV1 {
  readonly projection: RoomObjectProjectionV1;
  readonly appliedEventCount: number;
  readonly schemaVersion: 1;
  readonly projectionVersion: 1;
}

/**
 * Deterministic replay: validate contiguous ascending localSequence starting
 * at 1 and per-object revision continuity BEFORE applying any event — a
 * failure yields no partial projection. No sort/dedupe/skip/repair.
 */
export function replayRoomObjectEventsV1(input: {
  seed: RoomObjectProjectionV1;
  events: readonly RoomObjectEventV1[];
  expectedRoomId: RoomLocalId;
}): RoomObjectReplayResultV1 {
  const { seed, events, expectedRoomId } = input;
  if (seed.roomId !== expectedRoomId) throw new RoomObjectError("room_mismatch");

  if (events.length > 0 && events[0]!.localSequence !== 1) {
    throw new RoomObjectConcurrencyError("invalid_lifecycle_transition");
  }
  let previousSequence: number | undefined;
  for (const event of events) {
    if (event.roomId !== expectedRoomId) throw new RoomObjectError("room_mismatch");
    if (previousSequence !== undefined && event.localSequence !== previousSequence + 1) {
      throw new RoomObjectConcurrencyError("invalid_lifecycle_transition");
    }
    previousSequence = event.localSequence;
  }

  // Dry-run on a clone so a mid-stream failure produces no partial result.
  let dry = cloneRoomProjection(seed);
  for (const event of events) dry = applyObjectEventToProjectionV1(dry, event);

  let projection = cloneRoomProjection(seed);
  for (const event of events) projection = applyObjectEventToProjectionV1(projection, event);

  return {
    projection,
    appliedEventCount: events.length,
    schemaVersion: ROOM_OBJECT_SCHEMA_VERSION,
    projectionVersion: ROOM_OBJECT_PROJECTION_VERSION,
  };
}
