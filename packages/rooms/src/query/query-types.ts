/**
 * RoomOS query taxonomy, view classes, filters, sorting, pagination, cursors
 * (TECH-19). All local, side-effect-free, read-only. No query language, no
 * SQL/GraphQL selection strings, no dynamic field paths, no regex, no semantic
 * queries, no remote query kinds.
 */

import type { RoomLocalId } from "../room-types";
import type {
  RoomDecisionStatus,
  RoomObjectId,
  RoomObjectLifecycle,
  RoomObjectV1,
  RoomPollStatus,
  RoomTaskStatus,
} from "../objects";

export type RoomQuerySchemaVersion = 1;
export const ROOM_QUERY_SCHEMA_VERSION = 1 as const;

export type RoomQueryKind =
  | "room.summary"
  | "room.objects.list"
  | "room.object.get"
  | "room.objects.search_plain_text"
  | "room.tasks.list"
  | "room.decisions.list"
  | "room.polls.list"
  | "room.file_refs.list"
  | "room.object_counts"
  | "unknown";

export const ROOM_QUERY_KINDS: readonly RoomQueryKind[] = [
  "room.summary",
  "room.objects.list",
  "room.object.get",
  "room.objects.search_plain_text",
  "room.tasks.list",
  "room.decisions.list",
  "room.polls.list",
  "room.file_refs.list",
  "room.object_counts",
  "unknown",
];

export type RoomQueryViewClass =
  | "room_summary_redacted"
  | "room_summary"
  | "object_summary_redacted"
  | "object_summary"
  | "object_detail_redacted"
  | "object_detail_content";

export const ROOM_QUERY_VIEW_CLASSES: readonly RoomQueryViewClass[] = [
  "room_summary_redacted",
  "room_summary",
  "object_summary_redacted",
  "object_summary",
  "object_detail_redacted",
  "object_detail_content",
];

// ---------------------------------------------------------------------------
// Structured filters (explicit fields only — no predicates, no regex)
// ---------------------------------------------------------------------------

export interface RoomObjectFilterV1 {
  readonly kinds?: readonly RoomObjectV1["kind"][];
  readonly lifecycles?: readonly RoomObjectLifecycle[];
  readonly redacted?: boolean;
  readonly taskStatuses?: readonly RoomTaskStatus[];
  readonly decisionStatuses?: readonly RoomDecisionStatus[];
  readonly pollStatuses?: readonly RoomPollStatus[];
  readonly exactTag?: string;
}

export const ROOM_OBJECT_FILTER_KEYS: readonly string[] = [
  "kinds",
  "lifecycles",
  "redacted",
  "taskStatuses",
  "decisionStatuses",
  "pollStatuses",
  "exactTag",
];

// ---------------------------------------------------------------------------
// Sorting (deterministic; object-id tie-breaker always applied)
// ---------------------------------------------------------------------------

export type RoomObjectSortV1 =
  "object_id_asc" | "created_local_asc" | "updated_local_desc" | "revision_desc";

export const ROOM_OBJECT_SORTS: readonly RoomObjectSortV1[] = [
  "object_id_asc",
  "created_local_asc",
  "updated_local_desc",
  "revision_desc",
];

/** Sorts whose primary key is a local timestamp (deniable in strict modes). */
export const TIMESTAMP_SORTS: readonly RoomObjectSortV1[] = [
  "created_local_asc",
  "updated_local_desc",
];

// ---------------------------------------------------------------------------
// Pagination + cursors (local/internal only — never authority, never persisted)
// ---------------------------------------------------------------------------

export const ROOM_QUERY_DEFAULT_LIMIT = 25;
export const ROOM_QUERY_MAX_LIMIT = 100;
export const ROOM_QUERY_SEARCH_MAX_LIMIT = 50;
export const ROOM_QUERY_SEARCH_MAX_TERM_BYTES = 256;

export interface RoomQueryCursorV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly sort: RoomObjectSortV1;
  readonly lastObjectId: RoomObjectId;
  readonly lastRevision?: number;
  readonly lastCreatedAtLocal?: string;
  readonly lastUpdatedAtLocal?: string;
}

export interface RoomQueryPageRequestV1 {
  readonly limit: number;
  readonly cursor?: RoomQueryCursorV1;
}
