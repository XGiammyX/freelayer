/**
 * Room projection (TECH-16) — a simple, PURE, deterministic fold of events
 * into materialized state. This is NOT collaborative merge: no CRDT, no
 * conflict resolution, no total-ordering assumption (Gate H). Rebuildable by
 * construction; immutable throughout (new objects, never mutation).
 */

import { ROOM_OBJECT_KIND_META, type RoomMemberRef, type RoomObjectKind } from "./room-types";
import type { RoomOperationEvent } from "./room-events";
import type { RoomMaterializedState, RoomMemberSummary, RoomObjectSummary } from "./room-state";
import type { RoomPolicy } from "./room-policy";

const OBJECT_CREATING_OPERATIONS: Readonly<Record<string, RoomObjectKind>> = {
  "message.create_placeholder": "message",
  "note.create_placeholder": "note",
  "task.create_placeholder": "task",
  "decision.record_placeholder": "decision",
  "poll.create_placeholder": "poll",
  "file.attach_ref_placeholder": "file_ref",
  "ai.memory_ref_placeholder": "ai_memory_ref",
  "endpoint.hook_ref_placeholder": "endpoint_hook_ref",
};

function objectSummaryFor(event: RoomOperationEvent, kind: RoomObjectKind): RoomObjectSummary {
  const meta = ROOM_OBJECT_KIND_META[kind];
  return {
    id: `robj-${event.id}`,
    kind,
    redacted: true, // summaries NEVER carry content
    sensitivity: meta.sensitivity,
    storageClass: meta.dataClass,
  };
}

/**
 * Fold events over an initial state. Unknown operations are SKIPPED (the
 * barrier already denies them; projection stays total and fail-safe). Title
 * changes honor policy redaction. Content payloads never enter summaries.
 */
export function projectRoomState(
  initial: RoomMaterializedState,
  events: readonly RoomOperationEvent[],
  policy: RoomPolicy,
): RoomMaterializedState {
  let state = initial;

  for (const event of events) {
    if (event.roomId !== state.roomId) {
      continue; // wrong room — fail-safe skip
    }
    const next = { lastLocalUpdateAt: event.createdAtLocal };

    switch (event.operation) {
      case "room.rename": {
        // Rename payloads are content-adjacent; only non-redacting policies
        // may surface a title, and only from an explicit safe string payload.
        const title =
          !policy.redactTitles && typeof event.payload === "string" ? event.payload : undefined;
        state = {
          ...state,
          ...next,
          titleRedacted: policy.redactTitles,
          ...(title !== undefined ? { title } : {}),
        };
        break;
      }
      case "room.archive":
        state = { ...state, ...next, lifecycle: "archived_local" };
        break;
      case "room.lock":
        state = { ...state, ...next, lifecycle: "emergency_locked" };
        break;
      case "room.delete_tombstone":
        state = { ...state, ...next, lifecycle: "deleted_tombstone" };
        break;
      case "member.add_placeholder": {
        if (typeof event.payload === "string" || event.actor !== "local_unknown") {
          const ref = (
            typeof event.payload === "string" ? event.payload : event.actor
          ) as RoomMemberRef;
          const member: RoomMemberSummary = {
            ref,
            displayNameRedacted: true, // no display names exist in v1
            role: "member_placeholder",
          };
          if (!state.members.some((m) => m.ref === member.ref)) {
            state = { ...state, ...next, members: [...state.members, member] };
          }
        }
        break;
      }
      case "member.remove_placeholder": {
        if (typeof event.payload === "string") {
          state = {
            ...state,
            ...next,
            members: state.members.filter((m) => m.ref !== event.payload),
          };
        }
        break;
      }
      default: {
        const kind = OBJECT_CREATING_OPERATIONS[event.operation];
        if (kind !== undefined) {
          state = {
            ...state,
            ...next,
            objects: [...state.objects, objectSummaryFor(event, kind)],
          };
        }
        // Unknown / non-projecting operations (create, policy_update, audit)
        // leave object/member state unchanged.
        break;
      }
    }
  }

  return state;
}
