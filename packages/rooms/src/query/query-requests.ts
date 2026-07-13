/**
 * RoomOS query request types (TECH-19) — a discriminated union keyed on
 * `query`. No arbitrary requested fields, no field-selection arrays, no
 * dynamic property paths.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomLocalId } from "../room-types";
import type { RoomObjectId, RoomObjectV1 } from "../objects";
import type {
  RoomObjectFilterV1,
  RoomObjectSortV1,
  RoomQueryKind,
  RoomQueryPageRequestV1,
  RoomQueryViewClass,
} from "./query-types";

export interface RoomQueryRequestBaseV1 {
  readonly schemaVersion: 1;
  readonly query: RoomQueryKind;
  readonly roomId: RoomLocalId;
  readonly requestedView: RoomQueryViewClass;
  readonly mode: PrivacyMode;
  /** Non-sensitive justification code. Never a term/title/content. */
  readonly reason: string;
}

export interface GetRoomSummaryQueryV1 extends RoomQueryRequestBaseV1 {
  readonly query: "room.summary";
}
export interface ListRoomObjectsQueryV1 extends RoomQueryRequestBaseV1 {
  readonly query: "room.objects.list";
  readonly filter?: RoomObjectFilterV1;
  readonly sort?: RoomObjectSortV1;
  readonly page?: RoomQueryPageRequestV1;
}
export interface GetRoomObjectQueryV1 extends RoomQueryRequestBaseV1 {
  readonly query: "room.object.get";
  readonly objectId: RoomObjectId;
}
export interface SearchRoomObjectsQueryV1 extends RoomQueryRequestBaseV1 {
  readonly query: "room.objects.search_plain_text";
  readonly term: string;
  readonly kinds?: readonly RoomObjectV1["kind"][];
  readonly page?: RoomQueryPageRequestV1;
}
export interface ListRoomTasksQueryV1 extends RoomQueryRequestBaseV1 {
  readonly query: "room.tasks.list";
  readonly filter?: RoomObjectFilterV1;
  readonly sort?: RoomObjectSortV1;
  readonly page?: RoomQueryPageRequestV1;
}
export interface ListRoomDecisionsQueryV1 extends RoomQueryRequestBaseV1 {
  readonly query: "room.decisions.list";
  readonly filter?: RoomObjectFilterV1;
  readonly sort?: RoomObjectSortV1;
  readonly page?: RoomQueryPageRequestV1;
}
export interface ListRoomPollsQueryV1 extends RoomQueryRequestBaseV1 {
  readonly query: "room.polls.list";
  readonly filter?: RoomObjectFilterV1;
  readonly sort?: RoomObjectSortV1;
  readonly page?: RoomQueryPageRequestV1;
}
export interface ListRoomFileRefsQueryV1 extends RoomQueryRequestBaseV1 {
  readonly query: "room.file_refs.list";
  readonly filter?: RoomObjectFilterV1;
  readonly sort?: RoomObjectSortV1;
  readonly page?: RoomQueryPageRequestV1;
}
export interface RoomObjectCountsQueryV1 extends RoomQueryRequestBaseV1 {
  readonly query: "room.object_counts";
  readonly filter?: RoomObjectFilterV1;
}

export type RoomQueryRequestV1 =
  | GetRoomSummaryQueryV1
  | ListRoomObjectsQueryV1
  | GetRoomObjectQueryV1
  | SearchRoomObjectsQueryV1
  | ListRoomTasksQueryV1
  | ListRoomDecisionsQueryV1
  | ListRoomPollsQueryV1
  | ListRoomFileRefsQueryV1
  | RoomObjectCountsQueryV1;

/** The list-shaped query kinds (share filter/sort/page structure). */
export const LIST_QUERY_KINDS: readonly RoomQueryKind[] = [
  "room.objects.list",
  "room.tasks.list",
  "room.decisions.list",
  "room.polls.list",
  "room.file_refs.list",
];
