/**
 * RoomOS query cursors (TECH-19). Cursors are LOCAL, INTERNAL typed values —
 * NOT authorization tokens, never persisted, never logged, never serialized
 * for remote use, and they carry no content. A cursor must match the query's
 * room and sort; cross-snapshot continuity is not guaranteed in v1.
 */

import { assertNoDangerousKeys, isPlainRecord, validateRoomObjectId } from "../objects";
import type { RoomLocalId } from "../room-types";
import { queryFail, RoomQueryCursorError } from "./query-errors";
import { ROOM_OBJECT_SORTS, type RoomObjectSortV1, type RoomQueryCursorV1 } from "./query-types";

const CURSOR_KEYS = [
  "schemaVersion",
  "roomId",
  "sort",
  "lastObjectId",
  "lastRevision",
  "lastCreatedAtLocal",
  "lastUpdatedAtLocal",
] as const;

export function validateCursor(input: unknown, roomId: RoomLocalId): RoomQueryCursorV1 {
  if (!isPlainRecord(input)) queryFail("cursor_invalid");
  assertNoDangerousKeys(input);
  for (const key of Object.keys(input)) {
    if (!(CURSOR_KEYS as readonly string[]).includes(key)) queryFail("cursor_invalid");
  }
  if (input["schemaVersion"] !== 1) queryFail("cursor_invalid");
  if (input["roomId"] !== roomId) throw new RoomQueryCursorError("cursor_room_mismatch");
  const sort = input["sort"];
  if (typeof sort !== "string" || !ROOM_OBJECT_SORTS.includes(sort as RoomObjectSortV1)) {
    queryFail("cursor_invalid");
  }
  const lastObjectId = validateRoomObjectId(input["lastObjectId"] as string);
  const cursor: {
    schemaVersion: 1;
    roomId: RoomLocalId;
    sort: RoomObjectSortV1;
    lastObjectId: ReturnType<typeof validateRoomObjectId>;
    lastRevision?: number;
    lastCreatedAtLocal?: string;
    lastUpdatedAtLocal?: string;
  } = { schemaVersion: 1, roomId, sort: sort as RoomObjectSortV1, lastObjectId };
  if (input["lastRevision"] !== undefined) {
    if (typeof input["lastRevision"] !== "number" || !Number.isSafeInteger(input["lastRevision"])) {
      queryFail("cursor_invalid");
    }
    cursor.lastRevision = input["lastRevision"];
  }
  if (input["lastCreatedAtLocal"] !== undefined) {
    if (
      typeof input["lastCreatedAtLocal"] !== "string" ||
      !input["lastCreatedAtLocal"].startsWith("local:")
    ) {
      queryFail("cursor_invalid");
    }
    cursor.lastCreatedAtLocal = input["lastCreatedAtLocal"];
  }
  if (input["lastUpdatedAtLocal"] !== undefined) {
    if (
      typeof input["lastUpdatedAtLocal"] !== "string" ||
      !input["lastUpdatedAtLocal"].startsWith("local:")
    ) {
      queryFail("cursor_invalid");
    }
    cursor.lastUpdatedAtLocal = input["lastUpdatedAtLocal"];
  }
  return cursor as RoomQueryCursorV1;
}

/** A cursor must agree with the executing query's room + sort. */
export function assertCursorMatchesQuery(
  cursor: RoomQueryCursorV1,
  roomId: RoomLocalId,
  sort: RoomObjectSortV1,
): void {
  if (cursor.roomId !== roomId) throw new RoomQueryCursorError("cursor_room_mismatch");
  if (cursor.sort !== sort) throw new RoomQueryCursorError("cursor_sort_mismatch");
}
