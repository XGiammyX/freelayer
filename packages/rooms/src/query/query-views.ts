/**
 * Privacy-safe view + result types (TECH-19). Summaries NEVER carry content;
 * detail views carry content only when policy explicitly allows it, and never
 * imply capture protection. All views are metadata-minimized per policy.
 */

import type { RoomKind, RoomLifecycleState, RoomLocalId } from "../room-types";
import type {
  RoomObjectId,
  RoomObjectLifecycle,
  RoomObjectSensitivity,
  RoomObjectV1,
} from "../objects";
import type { RoomQueryCursorV1 } from "./query-types";

export interface RoomSummaryViewV1 {
  readonly schemaVersion: 1;
  readonly roomId?: RoomLocalId;
  readonly kind: RoomKind;
  readonly lifecycle: RoomLifecycleState;
  readonly mode: string;
  readonly title?: string;
  readonly redacted: boolean;
  readonly objectCount?: number;
}

export interface RoomObjectSummaryViewV1 {
  readonly schemaVersion: 1;
  readonly objectId?: RoomObjectId;
  readonly kind: RoomObjectV1["kind"];
  readonly lifecycle: RoomObjectLifecycle;
  readonly revision?: number;
  readonly sensitivity?: RoomObjectSensitivity;
  readonly redacted: boolean;
  readonly contentPresent?: boolean;
  readonly createdAtLocal?: string;
  readonly updatedAtLocal?: string;
}

export interface RoomObjectDetailViewV1 {
  readonly schemaVersion: 1;
  readonly object: RoomObjectV1 | null;
  readonly redacted: boolean;
  readonly redactionReason?: string;
}

// ---------------------------------------------------------------------------
// Query result union (one result shape per query kind)
// ---------------------------------------------------------------------------

export interface RoomQueryPageInfoV1 {
  readonly returnedCount: number;
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor?: RoomQueryCursorV1;
}

export interface RoomSummaryQueryResultV1 {
  readonly result: "room.summary";
  readonly view: RoomSummaryViewV1;
}
export interface RoomObjectListQueryResultV1 {
  readonly result: "room.objects.list";
  readonly items: readonly RoomObjectSummaryViewV1[];
  readonly page: RoomQueryPageInfoV1;
}
export interface RoomObjectDetailQueryResultV1 {
  readonly result: "room.object.get";
  readonly detail: RoomObjectDetailViewV1;
}
export interface RoomObjectSearchQueryResultV1 {
  readonly result: "room.objects.search_plain_text";
  readonly items: readonly RoomObjectSummaryViewV1[];
  readonly page: RoomQueryPageInfoV1;
}
export interface RoomTaskListQueryResultV1 {
  readonly result: "room.tasks.list";
  readonly items: readonly RoomObjectSummaryViewV1[];
  readonly page: RoomQueryPageInfoV1;
}
export interface RoomDecisionListQueryResultV1 {
  readonly result: "room.decisions.list";
  readonly items: readonly RoomObjectSummaryViewV1[];
  readonly page: RoomQueryPageInfoV1;
}
export interface RoomPollListQueryResultV1 {
  readonly result: "room.polls.list";
  readonly items: readonly RoomObjectSummaryViewV1[];
  readonly page: RoomQueryPageInfoV1;
}
export interface RoomFileRefListQueryResultV1 {
  readonly result: "room.file_refs.list";
  readonly items: readonly RoomObjectSummaryViewV1[];
  readonly page: RoomQueryPageInfoV1;
}
export interface RoomObjectCountQueryResultV1 {
  readonly result: "room.object_counts";
  /** Absent when counts are policy-denied (strict modes). */
  readonly totalCount?: number;
  readonly countsAvailable: boolean;
}

export type RoomQueryResultV1 =
  | RoomSummaryQueryResultV1
  | RoomObjectListQueryResultV1
  | RoomObjectDetailQueryResultV1
  | RoomObjectSearchQueryResultV1
  | RoomTaskListQueryResultV1
  | RoomDecisionListQueryResultV1
  | RoomPollListQueryResultV1
  | RoomFileRefListQueryResultV1
  | RoomObjectCountQueryResultV1;
