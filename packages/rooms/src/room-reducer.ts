/**
 * Pure projection reducer + deterministic replay (TECH-17).
 *
 * A projection is a PURE function of seed state plus validated ordered events:
 * no clock, no randomness, no id generation, no storage/network/notification/
 * AI/endpoint calls, no global mutable state, no input mutation. Exhaustive
 * switching — unknown operations FAIL (no silent default).
 *
 * Replay reconstructs previously ACCEPTED internal events. It must NOT re-run
 * current write authorization for historical events (that would make replay
 * nondeterministic under policy change). Access to the event SOURCE is
 * policy-controlled at the log boundary; replay itself authorizes no new side
 * effects. External event ingestion remains Gate E.
 */

import { ROOM_OBJECT_KIND_META, type RoomLocalId, type RoomMemberRef } from "./room-types";
import type { RoomMaterializedState, RoomMemberSummary, RoomObjectSummary } from "./room-state";
import {
  cloneRoomProjection,
  ROOM_EVENT_SCHEMA_VERSION,
  ROOM_PROJECTION_VERSION,
  validateRoomOperationEventV1,
  type RoomObjectPlaceholderCreatedPayloadV1,
  type RoomOperationEventV1,
} from "./room-event-v1";
import { assertValidRoomLifecycleTransition } from "./room-lifecycle";
import {
  RoomDuplicateEventError,
  RoomEventOrderError,
  RoomEventRoomMismatchError,
  RoomProjectionError,
  RoomReplayError,
  RoomSequenceConflictError,
  RoomSequenceGapError,
} from "./room-log-errors";

function objectSummaryFromPayload(
  payload: RoomObjectPlaceholderCreatedPayloadV1,
): RoomObjectSummary {
  const meta = ROOM_OBJECT_KIND_META[payload.kind];
  return {
    id: payload.objectId,
    kind: payload.kind,
    redacted: true, // summaries NEVER carry content
    sensitivity: meta.sensitivity,
    storageClass: meta.dataClass,
  };
}

/**
 * Apply ONE validated event to state. Pure; returns a new object; the event's
 * lifecycle transition is enforced here so replay cannot skip it.
 */
export function reduceRoomOperationEventV1(
  current: RoomMaterializedState,
  event: RoomOperationEventV1,
): RoomMaterializedState {
  if (event.roomId !== current.roomId) {
    throw new RoomEventRoomMismatchError();
  }
  assertValidRoomLifecycleTransition({
    current: current.lifecycle,
    operation: event.operation,
    ...(event.operation === "room.archive" ||
    event.operation === "room.lock" ||
    event.operation === "room.delete_tombstone"
      ? { target: event.payload.target }
      : {}),
  });

  const next = { lastLocalUpdateAt: event.createdAtLocal };

  switch (event.operation) {
    case "room.create":
      return {
        ...current,
        ...next,
        lifecycle: "active_local",
        kind: event.payload.kind,
        titleRedacted: current.policy.redactTitles && event.payload.title !== undefined,
        ...(event.payload.title !== undefined && !current.policy.redactTitles
          ? { title: event.payload.title }
          : {}),
      };
    case "room.rename": {
      // Redaction is policy-aware and already encoded at event-acceptance
      // time; the reducer only honors the projection policy it is given.
      if (current.policy.redactTitles) {
        return { ...current, ...next, titleRedacted: true };
      }
      return { ...current, ...next, titleRedacted: false, title: event.payload.title };
    }
    case "room.archive":
      return { ...current, ...next, lifecycle: "archived_local" };
    case "room.lock":
      return { ...current, ...next, lifecycle: event.payload.target };
    case "room.delete_tombstone":
      return {
        ...current,
        ...next,
        lifecycle: "deleted_tombstone",
        // Visible summaries are removed at tombstone; the in-memory log may
        // still hold prior placeholder events until cleared — this is NOT
        // forensic deletion and is never described as such.
        titleRedacted: true,
        members: [],
        objects: [],
      };
    case "room.policy_update":
      // Restrictive revision metadata only; RoomPolicy objects compose
      // tighten-only at the policy layer, not here.
      return { ...current, ...next };
    case "member.add_placeholder": {
      const member: RoomMemberSummary = {
        ref: event.payload.memberRef as RoomMemberRef,
        displayNameRedacted: true, // no display names exist in v1
        role: event.payload.role,
      };
      if (current.members.some((m) => m.ref === member.ref)) {
        return { ...current, ...next };
      }
      return { ...current, ...next, members: [...current.members, member] };
    }
    case "member.remove_placeholder":
      return {
        ...current,
        ...next,
        members: current.members.filter((m) => m.ref !== event.payload.memberRef),
      };
    case "message.create_placeholder":
    case "note.create_placeholder":
    case "task.create_placeholder":
    case "decision.record_placeholder":
    case "poll.create_placeholder":
    case "file.attach_ref_placeholder":
    case "ai.memory_ref_placeholder":
    case "endpoint.hook_ref_placeholder":
      return {
        ...current,
        ...next,
        objects: [...current.objects, objectSummaryFromPayload(event.payload)],
      };
    case "audit.append_redacted":
      return { ...current, ...next };
    default: {
      // Exhaustiveness: unknown operations FAIL — no silent fallback.
      const unreachable: never = event;
      throw new RoomProjectionError(
        `unsupported operation in projection v${ROOM_PROJECTION_VERSION}: ${String(
          (unreachable as { operation?: unknown }).operation,
        )}`,
      );
    }
  }
}

export interface RoomReplayResult {
  readonly state: RoomMaterializedState;
  readonly appliedEventCount: number;
  readonly firstLocalSequence?: number;
  readonly lastLocalSequence?: number;
  readonly schemaVersion: typeof ROOM_EVENT_SCHEMA_VERSION;
  readonly projectionVersion: typeof ROOM_PROJECTION_VERSION;
}

/**
 * Deterministic replay: validate ALL events (structure, room, uniqueness,
 * contiguous ascending local sequence, lifecycle transitions) BEFORE applying
 * any — a failure produces no partial result. No sorting, no deduplication,
 * no skipping, no repair. Timestamps never influence ordering.
 */
export function replayRoomOperationEventsV1(input: {
  readonly seed: RoomMaterializedState;
  readonly events: readonly RoomOperationEventV1[];
  readonly expectedRoomId: RoomLocalId;
}): RoomReplayResult {
  const { seed, events, expectedRoomId } = input;
  if (seed.roomId !== expectedRoomId) {
    throw new RoomReplayError("room_mismatch");
  }

  // ---- Phase 1: validate everything; touch nothing. ----
  // No snapshots exist (future gate): a complete local replay starts at 1.
  if (events.length > 0 && (events[0] as { localSequence?: unknown }).localSequence !== 1) {
    throw new RoomSequenceGapError();
  }
  const seenIds = new Set<string>();
  let previousSequence: number | undefined;
  const validated: RoomOperationEventV1[] = [];
  for (const raw of events) {
    const event = validateRoomOperationEventV1(raw); // clones defensively
    if (event.roomId !== expectedRoomId) {
      throw new RoomEventRoomMismatchError();
    }
    if (seenIds.has(event.eventId)) {
      throw new RoomDuplicateEventError();
    }
    seenIds.add(event.eventId);
    const sequence = event.localSequence as number;
    if (previousSequence !== undefined) {
      if (sequence === previousSequence) throw new RoomSequenceConflictError();
      if (sequence < previousSequence) throw new RoomEventOrderError();
      if (sequence !== previousSequence + 1) throw new RoomSequenceGapError();
    }
    previousSequence = sequence;
    validated.push(event);
  }

  // Lifecycle pre-pass on a cloned seed so failure yields NO partial result.
  let dryRun = cloneRoomProjection(seed);
  for (const event of validated) {
    dryRun = reduceRoomOperationEventV1(dryRun, event);
  }

  // ---- Phase 2: apply on a fresh clone (deterministic, side-effect-free). ----
  let state = cloneRoomProjection(seed);
  for (const event of validated) {
    state = reduceRoomOperationEventV1(state, event);
  }

  const first = validated[0]?.localSequence as number | undefined;
  const last = previousSequence;
  return {
    state,
    appliedEventCount: validated.length,
    ...(first !== undefined ? { firstLocalSequence: first } : {}),
    ...(last !== undefined ? { lastLocalSequence: last } : {}),
    schemaVersion: ROOM_EVENT_SCHEMA_VERSION,
    projectionVersion: ROOM_PROJECTION_VERSION,
  };
}
