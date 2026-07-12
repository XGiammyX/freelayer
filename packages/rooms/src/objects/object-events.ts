/**
 * RoomOS object mutation events (TECH-18).
 *
 * Each accepted mutation produces a versioned, operation-specific event that
 * carries the RESULTING object state so replay is deterministic and total. No
 * generic patch event exists. The clock is injected at the creation boundary
 * only — reducers/replay never read time. Events carry no network metadata, no
 * crypto fields, no endpoint-monitoring data.
 *
 * A RoomObjectEventV1 is a versioned RoomOS event, structurally parallel to the
 * TECH-17 operation-log event but carrying object content; it lives in a
 * dedicated object log so the TECH-17 content-free event union stays stable.
 */

import type { RoomLocalId, RoomMemberRef } from "../room-types";
import type { RoomLocalClock } from "../room-event-v1";
import { RoomObjectError } from "./object-errors";
import {
  FIRST_OBJECT_REVISION,
  nextRoomObjectRevision,
  ROOM_OBJECT_PROJECTION_VERSION,
  ROOM_OBJECT_SCHEMA_VERSION,
  type RoomObjectId,
  type RoomObjectRevision,
} from "./object-ids";
import {
  assertDecisionStatusTransition,
  assertObjectLifecycleAllows,
  assertPollDraftEditable,
  assertPollStatusTransition,
  assertTaskStatusTransition,
} from "./object-lifecycle";
import { objectMutationClass } from "./object-policy";
import type { RoomObjectCommandName, RoomObjectMutationCommandV1 } from "./object-commands";
import type {
  RoomDecisionObjectV1,
  RoomFileRefObjectV1,
  RoomMessageObjectV1,
  RoomNoteObjectV1,
  RoomObjectLifecycle,
  RoomObjectV1,
  RoomPollObjectV1,
  RoomTaskObjectV1,
} from "./object-types";

export type RoomObjectEventOperation =
  | "message.created.v1"
  | "message.edited.v1"
  | "message.redacted.v1"
  | "note.created.v1"
  | "note.content_updated.v1"
  | "note.tags_updated.v1"
  | "task.created.v1"
  | "task.content_updated.v1"
  | "task.status_updated.v1"
  | "decision.created.v1"
  | "decision.status_resolved.v1"
  | "poll.created.v1"
  | "poll.draft_updated.v1"
  | "poll.opened_placeholder.v1"
  | "poll.closed_placeholder.v1"
  | "file_ref.created_placeholder.v1"
  | "file_ref.metadata_updated.v1"
  | "room_object.archived.v1"
  | "room_object.redacted.v1"
  | "room_object.tombstoned.v1";

const COMMAND_TO_EVENT: Readonly<Record<RoomObjectCommandName, RoomObjectEventOperation>> = {
  "message.create": "message.created.v1",
  "message.edit": "message.edited.v1",
  "message.redact": "message.redacted.v1",
  "note.create": "note.created.v1",
  "note.update_content": "note.content_updated.v1",
  "note.update_tags": "note.tags_updated.v1",
  "task.create": "task.created.v1",
  "task.update_content": "task.content_updated.v1",
  "task.update_status": "task.status_updated.v1",
  "decision.create": "decision.created.v1",
  "decision.resolve": "decision.status_resolved.v1",
  "poll.create": "poll.created.v1",
  "poll.update_draft": "poll.draft_updated.v1",
  "poll.open_placeholder": "poll.opened_placeholder.v1",
  "poll.close_placeholder": "poll.closed_placeholder.v1",
  "file_ref.create_placeholder": "file_ref.created_placeholder.v1",
  "file_ref.update_metadata": "file_ref.metadata_updated.v1",
  "object.archive": "room_object.archived.v1",
  "object.redact": "room_object.redacted.v1",
  "object.tombstone": "room_object.tombstoned.v1",
};

export function commandToEventOperation(command: RoomObjectCommandName): RoomObjectEventOperation {
  return COMMAND_TO_EVENT[command];
}

export interface RoomObjectEventV1 {
  readonly schemaVersion: 1;
  readonly projectionVersion: 1;
  readonly objectEventId: string;
  readonly roomId: RoomLocalId;
  readonly objectId: RoomObjectId;
  readonly kind: RoomObjectV1["kind"];
  readonly operation: RoomObjectEventOperation;
  readonly localSequence: number;
  readonly actor: RoomMemberRef | "local_unknown";
  readonly createdAtLocal: string;
  readonly previousRevision: RoomObjectRevision | null;
  readonly resultingRevision: RoomObjectRevision;
  readonly resultingLifecycle: RoomObjectLifecycle;
  /** The resulting object after the mutation (content null when redacted). */
  readonly object: RoomObjectV1;
}

// ---------------------------------------------------------------------------
// Resulting-object construction (creation boundary; injected clock)
// ---------------------------------------------------------------------------

/**
 * Build the resulting object by applying a validated command to the current
 * object. Pure aside from the injected clock; enforces status/lifecycle rules.
 */
export function buildResultingObject(input: {
  current: RoomObjectV1 | undefined;
  command: RoomObjectMutationCommandV1;
  nowLocal: string;
}): {
  object: RoomObjectV1;
  previousRevision: RoomObjectRevision | null;
  resultingRevision: RoomObjectRevision;
} {
  const { current, command, nowLocal } = input;
  const cls = objectMutationClass(command.command);

  if (cls === "create") {
    if (current !== undefined) throw new RoomObjectError("invalid_lifecycle_transition");
    const object = buildCreatedObject(command, nowLocal);
    return { object, previousRevision: null, resultingRevision: FIRST_OBJECT_REVISION };
  }

  if (current === undefined) throw new RoomObjectError("object_not_found");
  const previousRevision = current.revision;
  const resultingRevision = nextRoomObjectRevision(previousRevision);
  const meta = {
    updatedAtLocal: nowLocal,
    updatedBy: command.actorRef,
    revision: resultingRevision,
  };

  if (cls === "archive") {
    assertObjectLifecycleAllows(current.lifecycle, "archive");
    return {
      object: freeze({ ...current, ...meta, lifecycle: "archived" }),
      previousRevision,
      resultingRevision,
    };
  }
  if (cls === "redact") {
    assertObjectLifecycleAllows(current.lifecycle, "redact");
    return {
      object: freeze({ ...current, ...meta, lifecycle: "redacted", redacted: true, content: null }),
      previousRevision,
      resultingRevision,
    };
  }
  if (cls === "tombstone") {
    assertObjectLifecycleAllows(current.lifecycle, "tombstone");
    return {
      object: freeze({
        ...current,
        ...meta,
        lifecycle: "deleted_tombstone",
        redacted: true,
        content: null,
      }),
      previousRevision,
      resultingRevision,
    };
  }

  // content_update — active only.
  assertObjectLifecycleAllows(current.lifecycle, "content_update");
  const object = applyContentUpdate(current, command, meta);
  return { object, previousRevision, resultingRevision };
}

type Meta = {
  updatedAtLocal: string;
  updatedBy: RoomMemberRef | "local_unknown";
  revision: RoomObjectRevision;
};

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function buildCreatedObject(command: RoomObjectMutationCommandV1, now: string): RoomObjectV1 {
  const base = {
    schemaVersion: 1 as const,
    projectionVersion: 1 as const,
    objectId: command.objectId,
    roomId: command.roomId,
    revision: FIRST_OBJECT_REVISION,
    lifecycle: "active" as const,
    createdAtLocal: now,
    updatedAtLocal: now,
    createdBy: command.actorRef,
    updatedBy: command.actorRef,
    redacted: false,
  };
  switch (command.command) {
    case "message.create":
      return freeze<RoomMessageObjectV1>({
        ...base,
        kind: "message",
        sensitivity: "content",
        content: {
          body: command.body,
          ...(command.replyToObjectId !== undefined
            ? { replyToObjectId: command.replyToObjectId }
            : {}),
          edited: false,
        },
      });
    case "note.create":
      return freeze<RoomNoteObjectV1>({
        ...base,
        kind: "note",
        sensitivity: "content",
        content: {
          ...(command.title !== undefined ? { title: command.title } : {}),
          body: command.body,
          tags: command.tags,
        },
      });
    case "task.create":
      return freeze<RoomTaskObjectV1>({
        ...base,
        kind: "task",
        sensitivity: "content",
        content: {
          title: command.title,
          ...(command.description !== undefined ? { description: command.description } : {}),
          status: "todo",
          assigneeRefs: command.assigneeRefs,
          ...(command.dueAtLocal !== undefined ? { dueAtLocal: command.dueAtLocal } : {}),
          tags: command.tags,
        },
      });
    case "decision.create":
      return freeze<RoomDecisionObjectV1>({
        ...base,
        kind: "decision",
        sensitivity: "content",
        content: {
          statement: command.statement,
          ...(command.rationale !== undefined ? { rationale: command.rationale } : {}),
          status: "proposed",
        },
      });
    case "poll.create":
      return freeze<RoomPollObjectV1>({
        ...base,
        kind: "poll",
        sensitivity: "content",
        content: {
          question: command.question,
          options: command.options,
          status: "draft",
          voteCapability: "not_implemented_gate_g_h",
        },
      });
    case "file_ref.create_placeholder":
      return freeze<RoomFileRefObjectV1>({
        ...base,
        kind: "file_ref",
        sensitivity: "relationship",
        content: {
          localRefId: command.localRefId,
          ...(command.displayName !== undefined ? { displayName: command.displayName } : {}),
          ...(command.mediaType !== undefined ? { mediaType: command.mediaType } : {}),
          ...(command.sizeBytes !== undefined ? { sizeBytes: command.sizeBytes } : {}),
          availability: "reference_only_not_resolved",
        },
      });
    default:
      throw new RoomObjectError("unknown_command");
  }
}

function applyContentUpdate(
  current: RoomObjectV1,
  command: RoomObjectMutationCommandV1,
  meta: Meta,
): RoomObjectV1 {
  if (current.content === null) {
    // Redacted objects have no content to update.
    throw new RoomObjectError("invalid_lifecycle_transition");
  }
  switch (command.command) {
    case "message.edit": {
      const c = current as RoomMessageObjectV1;
      return freeze<RoomMessageObjectV1>({
        ...c,
        ...meta,
        content: { ...c.content!, body: command.body, edited: true },
      });
    }
    case "note.update_content": {
      const c = current as RoomNoteObjectV1;
      return freeze<RoomNoteObjectV1>({
        ...c,
        ...meta,
        content: {
          ...c.content!,
          ...(command.title !== undefined ? { title: command.title } : {}),
          body: command.body,
        },
      });
    }
    case "note.update_tags": {
      const c = current as RoomNoteObjectV1;
      return freeze<RoomNoteObjectV1>({
        ...c,
        ...meta,
        content: { ...c.content!, tags: command.tags },
      });
    }
    case "task.update_content": {
      const c = current as RoomTaskObjectV1;
      return freeze<RoomTaskObjectV1>({
        ...c,
        ...meta,
        content: {
          ...c.content!,
          title: command.title,
          ...(command.description !== undefined ? { description: command.description } : {}),
          assigneeRefs: command.assigneeRefs,
          ...(command.dueAtLocal !== undefined ? { dueAtLocal: command.dueAtLocal } : {}),
          tags: command.tags,
        },
      });
    }
    case "task.update_status": {
      const c = current as RoomTaskObjectV1;
      assertTaskStatusTransition(c.content!.status, command.status);
      return freeze<RoomTaskObjectV1>({
        ...c,
        ...meta,
        content: { ...c.content!, status: command.status },
      });
    }
    case "decision.resolve": {
      const c = current as RoomDecisionObjectV1;
      assertDecisionStatusTransition(c.content!.status, command.status);
      return freeze<RoomDecisionObjectV1>({
        ...c,
        ...meta,
        content: {
          ...c.content!,
          status: command.status,
          ...(command.statement !== undefined ? { statement: command.statement } : {}),
          ...(command.rationale !== undefined ? { rationale: command.rationale } : {}),
          ...(command.supersedesObjectId !== undefined
            ? { supersedesObjectId: command.supersedesObjectId }
            : {}),
        },
      });
    }
    case "poll.update_draft": {
      const c = current as RoomPollObjectV1;
      assertPollDraftEditable(c.content!.status);
      return freeze<RoomPollObjectV1>({
        ...c,
        ...meta,
        content: { ...c.content!, question: command.question, options: command.options },
      });
    }
    case "poll.open_placeholder": {
      const c = current as RoomPollObjectV1;
      assertPollStatusTransition(c.content!.status, "open_local_placeholder");
      return freeze<RoomPollObjectV1>({
        ...c,
        ...meta,
        content: { ...c.content!, status: "open_local_placeholder" },
      });
    }
    case "poll.close_placeholder": {
      const c = current as RoomPollObjectV1;
      assertPollStatusTransition(c.content!.status, "closed_local_placeholder");
      return freeze<RoomPollObjectV1>({
        ...c,
        ...meta,
        content: { ...c.content!, status: "closed_local_placeholder" },
      });
    }
    case "file_ref.update_metadata": {
      const c = current as RoomFileRefObjectV1;
      return freeze<RoomFileRefObjectV1>({
        ...c,
        ...meta,
        content: {
          ...c.content!,
          ...(command.displayName !== undefined ? { displayName: command.displayName } : {}),
          ...(command.mediaType !== undefined ? { mediaType: command.mediaType } : {}),
          ...(command.sizeBytes !== undefined ? { sizeBytes: command.sizeBytes } : {}),
        },
      });
    }
    default:
      throw new RoomObjectError("unknown_command");
  }
}

/** Build an accepted object event from a validated command + built object. */
export function createAcceptedRoomObjectEventV1(input: {
  command: RoomObjectMutationCommandV1;
  built: {
    object: RoomObjectV1;
    previousRevision: RoomObjectRevision | null;
    resultingRevision: RoomObjectRevision;
  };
  objectEventId: string;
  localSequence: number;
  clock: RoomLocalClock;
}): RoomObjectEventV1 {
  const { command, built } = input;
  const now = input.clock.nowLocalIso();
  const createdAtLocal = now.startsWith("local:") ? now : `local:${now}`;
  return Object.freeze<RoomObjectEventV1>({
    schemaVersion: ROOM_OBJECT_SCHEMA_VERSION,
    projectionVersion: ROOM_OBJECT_PROJECTION_VERSION,
    objectEventId: input.objectEventId,
    roomId: command.roomId,
    objectId: command.objectId,
    kind: built.object.kind,
    operation: commandToEventOperation(command.command),
    localSequence: input.localSequence,
    actor: command.actorRef,
    createdAtLocal,
    previousRevision: built.previousRevision,
    resultingRevision: built.resultingRevision,
    resultingLifecycle: built.object.lifecycle,
    object: built.object,
  });
}
