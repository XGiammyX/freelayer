/**
 * RoomOS Object Model v1 (TECH-18) — concrete LOCAL room objects.
 *
 * These are local data objects only. A message object is NOT sent, encrypted,
 * synchronized, or delivered. Notes/tasks/decisions/polls are not collaborative
 * documents. File refs hold NO bytes, path, or URL. Member/assignee refs are
 * Gate-G placeholders, never authenticated identities. Poll voting is Gate-G/H.
 * Content is plain text only; no persistence (Gate F); no CRDT (Gate H).
 */

import type { RoomLocalId, RoomMemberRef } from "../room-types";
import type { RoomObjectId, RoomObjectRevision } from "./object-ids";
import type { RoomPlainTextV1 } from "./object-validation";

export type RoomObjectKindV1 = "message" | "note" | "task" | "decision" | "poll" | "file_ref";

export const ROOM_OBJECT_KINDS_V1: readonly RoomObjectKindV1[] = [
  "message",
  "note",
  "task",
  "decision",
  "poll",
  "file_ref",
];

export type RoomObjectLifecycle = "active" | "archived" | "redacted" | "deleted_tombstone";

export type RoomObjectSensitivity = "low" | "sensitive" | "relationship" | "content" | "critical";

export interface RoomObjectBaseV1 {
  readonly schemaVersion: 1;
  readonly projectionVersion: 1;
  readonly objectId: RoomObjectId;
  readonly roomId: RoomLocalId;
  readonly kind: RoomObjectKindV1;
  readonly revision: RoomObjectRevision;
  readonly lifecycle: RoomObjectLifecycle;
  readonly sensitivity: RoomObjectSensitivity;
  /** LOCAL labels only ("local:" prefix) — never trusted time. */
  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
  /** Placeholder actor refs — no authorization is inferred from them. */
  readonly createdBy: RoomMemberRef | "local_unknown";
  readonly updatedBy: RoomMemberRef | "local_unknown";
  readonly redacted: boolean;
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

export interface RoomMessageObjectV1 extends RoomObjectBaseV1 {
  readonly kind: "message";
  readonly sensitivity: "content" | "critical";
  readonly content: {
    readonly body: RoomPlainTextV1;
    readonly replyToObjectId?: RoomObjectId;
    readonly edited: boolean;
  } | null;
}

// ---------------------------------------------------------------------------
// Note
// ---------------------------------------------------------------------------

export interface RoomNoteObjectV1 extends RoomObjectBaseV1 {
  readonly kind: "note";
  readonly sensitivity: "content" | "critical";
  readonly content: {
    readonly title?: RoomPlainTextV1;
    readonly body: RoomPlainTextV1;
    readonly tags: readonly string[];
  } | null;
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export type RoomTaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export const ROOM_TASK_STATUSES: readonly RoomTaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "cancelled",
];

export interface RoomTaskObjectV1 extends RoomObjectBaseV1 {
  readonly kind: "task";
  readonly sensitivity: "content" | "critical";
  readonly content: {
    readonly title: RoomPlainTextV1;
    readonly description?: RoomPlainTextV1;
    readonly status: RoomTaskStatus;
    readonly assigneeRefs: readonly RoomMemberRef[];
    readonly dueAtLocal?: string;
    readonly tags: readonly string[];
  } | null;
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export type RoomDecisionStatus = "proposed" | "accepted" | "rejected" | "superseded";

export const ROOM_DECISION_STATUSES: readonly RoomDecisionStatus[] = [
  "proposed",
  "accepted",
  "rejected",
  "superseded",
];

export interface RoomDecisionObjectV1 extends RoomObjectBaseV1 {
  readonly kind: "decision";
  readonly sensitivity: "content" | "critical";
  readonly content: {
    readonly statement: RoomPlainTextV1;
    readonly rationale?: RoomPlainTextV1;
    readonly status: RoomDecisionStatus;
    readonly supersedesObjectId?: RoomObjectId;
  } | null;
}

// ---------------------------------------------------------------------------
// Poll (definition only — NO voting, tallies, or voter identity in v1)
// ---------------------------------------------------------------------------

export type RoomPollStatus = "draft" | "open_local_placeholder" | "closed_local_placeholder";

export const ROOM_POLL_STATUSES: readonly RoomPollStatus[] = [
  "draft",
  "open_local_placeholder",
  "closed_local_placeholder",
];

export interface RoomPollOptionV1 {
  readonly optionId: string;
  readonly label: RoomPlainTextV1;
}

export interface RoomPollObjectV1 extends RoomObjectBaseV1 {
  readonly kind: "poll";
  readonly sensitivity: "content" | "critical";
  readonly content: {
    readonly question: RoomPlainTextV1;
    readonly options: readonly RoomPollOptionV1[];
    readonly status: RoomPollStatus;
    /** Voting is not implemented and remains identity/sync-gated. */
    readonly voteCapability: "not_implemented_gate_g_h";
  } | null;
}

// ---------------------------------------------------------------------------
// File reference (reference/metadata only — NO bytes, path, or URL)
// ---------------------------------------------------------------------------

export interface RoomFileRefObjectV1 extends RoomObjectBaseV1 {
  readonly kind: "file_ref";
  readonly sensitivity: "relationship" | "content" | "critical";
  readonly content: {
    readonly localRefId: string;
    readonly displayName?: RoomPlainTextV1;
    readonly mediaType?: string;
    readonly sizeBytes?: number;
    readonly availability: "reference_only_not_resolved";
  } | null;
}

// ---------------------------------------------------------------------------
// Union + metadata-only summary
// ---------------------------------------------------------------------------

export type RoomObjectV1 =
  | RoomMessageObjectV1
  | RoomNoteObjectV1
  | RoomTaskObjectV1
  | RoomDecisionObjectV1
  | RoomPollObjectV1
  | RoomFileRefObjectV1;

export interface RoomObjectSummaryV1 {
  readonly schemaVersion: 1;
  readonly objectId: RoomObjectId;
  readonly roomId: RoomLocalId;
  readonly kind: RoomObjectKindV1;
  /** Suppressed (undefined) when MetadataPolicy denies activity signals. */
  readonly revision?: RoomObjectRevision;
  readonly lifecycle: RoomObjectLifecycle;
  readonly sensitivity: RoomObjectSensitivity;
  readonly redacted: boolean;
  /** Suppressed (undefined) under strict metadata policy. Never the content. */
  readonly contentPresent?: boolean;
}
