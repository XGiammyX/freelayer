/**
 * RoomOS query request validation (TECH-19). Fail-closed: explicit schema
 * version + query discriminator + requested view + expected fields only.
 * Unknown query/view/filter/sort deny; prototype-pollution keys reject (via
 * the shared object-model guard); no field-selection arrays, no dynamic paths,
 * no getters invoked, no input serialization or query-term echo in errors, no
 * silent coercion.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomLocalId } from "../room-types";
import {
  assertNoDangerousKeys,
  assertOnlyKeys,
  isPlainRecord,
  utf8ByteLength,
  validateRoomObjectId,
  ROOM_OBJECT_KINDS_V1,
  ROOM_DECISION_STATUSES,
  ROOM_POLL_STATUSES,
  ROOM_TASK_STATUSES,
  type RoomObjectLifecycle,
} from "../objects";
import { queryFail } from "./query-errors";
import type {
  GetRoomObjectQueryV1,
  RoomQueryRequestV1,
  SearchRoomObjectsQueryV1,
} from "./query-requests";
import {
  ROOM_OBJECT_FILTER_KEYS,
  ROOM_OBJECT_SORTS,
  ROOM_QUERY_KINDS,
  ROOM_QUERY_SEARCH_MAX_TERM_BYTES,
  ROOM_QUERY_VIEW_CLASSES,
  type RoomObjectFilterV1,
  type RoomObjectSortV1,
  type RoomQueryKind,
  type RoomQueryPageRequestV1,
  type RoomQueryViewClass,
} from "./query-types";
import { validateCursor } from "./query-cursor";

const REASON_RE = /^[a-z0-9_.:-]{1,64}$/;
const LIFECYCLES: readonly RoomObjectLifecycle[] = [
  "active",
  "archived",
  "redacted",
  "deleted_tombstone",
];
const TAG_RE = /^[a-z0-9][a-z0-9_.-]{0,63}$/i;
const BASE_KEYS = ["schemaVersion", "query", "roomId", "requestedView", "mode", "reason"] as const;

function requireStringArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  max: number,
): readonly T[] {
  if (!Array.isArray(value)) queryFail("invalid_field");
  if (value.length > max) queryFail("invalid_field");
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of value) {
    if (typeof v !== "string" || !allowed.includes(v as T)) queryFail("unknown_filter");
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v as T);
    }
  }
  return Object.freeze(out);
}

function validateFilter(input: unknown): RoomObjectFilterV1 {
  if (!isPlainRecord(input)) queryFail("invalid_field");
  assertNoDangerousKeys(input);
  assertOnlyKeys(input, ROOM_OBJECT_FILTER_KEYS);
  const f: {
    kinds?: readonly string[];
    lifecycles?: readonly RoomObjectLifecycle[];
    redacted?: boolean;
    taskStatuses?: readonly string[];
    decisionStatuses?: readonly string[];
    pollStatuses?: readonly string[];
    exactTag?: string;
  } = {};
  if (input["kinds"] !== undefined)
    f.kinds = requireStringArray(input["kinds"], ROOM_OBJECT_KINDS_V1, 6);
  if (input["lifecycles"] !== undefined)
    f.lifecycles = requireStringArray(input["lifecycles"], LIFECYCLES, 4);
  if (input["redacted"] !== undefined) {
    if (typeof input["redacted"] !== "boolean") queryFail("invalid_field");
    f.redacted = input["redacted"];
  }
  if (input["taskStatuses"] !== undefined)
    f.taskStatuses = requireStringArray(input["taskStatuses"], ROOM_TASK_STATUSES, 4);
  if (input["decisionStatuses"] !== undefined)
    f.decisionStatuses = requireStringArray(input["decisionStatuses"], ROOM_DECISION_STATUSES, 4);
  if (input["pollStatuses"] !== undefined)
    f.pollStatuses = requireStringArray(input["pollStatuses"], ROOM_POLL_STATUSES, 3);
  if (input["exactTag"] !== undefined) {
    if (typeof input["exactTag"] !== "string" || !TAG_RE.test(input["exactTag"]))
      queryFail("invalid_field");
    f.exactTag = input["exactTag"];
  }
  return f as RoomObjectFilterV1;
}

function validateSort(input: unknown): RoomObjectSortV1 {
  if (typeof input !== "string" || !ROOM_OBJECT_SORTS.includes(input as RoomObjectSortV1)) {
    queryFail("unknown_sort");
  }
  return input as RoomObjectSortV1;
}

function validatePage(input: unknown, roomId: RoomLocalId): RoomQueryPageRequestV1 {
  if (!isPlainRecord(input)) queryFail("invalid_field");
  assertNoDangerousKeys(input);
  assertOnlyKeys(input, ["limit", "cursor"]);
  if (typeof input["limit"] !== "number" || !Number.isSafeInteger(input["limit"])) {
    queryFail("invalid_field");
  }
  const page: { limit: number; cursor?: ReturnType<typeof validateCursor> } = {
    limit: input["limit"],
  };
  if (input["cursor"] !== undefined) page.cursor = validateCursor(input["cursor"], roomId);
  return page as RoomQueryPageRequestV1;
}

function validateView(input: unknown): RoomQueryViewClass {
  if (typeof input !== "string" || !ROOM_QUERY_VIEW_CLASSES.includes(input as RoomQueryViewClass)) {
    queryFail("unknown_view");
  }
  return input as RoomQueryViewClass;
}

export function validateRoomQueryRequestV1(input: unknown): RoomQueryRequestV1 {
  if (!isPlainRecord(input)) queryFail("invalid_field");
  assertNoDangerousKeys(input);
  if (input["schemaVersion"] !== 1) queryFail("unsupported_schema_version");
  const query = input["query"];
  if (
    typeof query !== "string" ||
    !ROOM_QUERY_KINDS.includes(query as RoomQueryKind) ||
    query === "unknown"
  ) {
    queryFail("unknown_query");
  }
  if (typeof input["roomId"] !== "string") queryFail("invalid_room_id");
  const roomId = input["roomId"] as RoomLocalId;
  const requestedView = validateView(input["requestedView"]);
  if (typeof input["mode"] !== "string") queryFail("invalid_field");
  const mode = input["mode"] as PrivacyMode;
  if (typeof input["reason"] !== "string" || !REASON_RE.test(input["reason"]))
    queryFail("invalid_field");
  const reason = input["reason"];
  const base = { schemaVersion: 1 as const, roomId, requestedView, mode, reason };
  const q = query as RoomQueryKind;

  switch (q) {
    case "room.summary":
      assertOnlyKeys(input, BASE_KEYS);
      return { ...base, query: q };
    case "room.object.get": {
      assertOnlyKeys(input, [...BASE_KEYS, "objectId"]);
      const objectId = validateRoomObjectId(input["objectId"] as string);
      return { ...base, query: q, objectId } as GetRoomObjectQueryV1;
    }
    case "room.objects.search_plain_text": {
      assertOnlyKeys(input, [...BASE_KEYS, "term", "kinds", "page"]);
      if (typeof input["term"] !== "string") queryFail("invalid_field");
      const term = input["term"];
      if (term.length === 0) queryFail("empty_term");
      if (utf8ByteLength(term) > ROOM_QUERY_SEARCH_MAX_TERM_BYTES) queryFail("term_too_large");
      const req: SearchRoomObjectsQueryV1 = {
        ...base,
        query: q,
        term,
        ...(input["kinds"] !== undefined
          ? { kinds: requireStringArray(input["kinds"], ROOM_OBJECT_KINDS_V1, 6) }
          : {}),
        ...(input["page"] !== undefined ? { page: validatePage(input["page"], roomId) } : {}),
      };
      return req;
    }
    case "room.object_counts":
      assertOnlyKeys(input, [...BASE_KEYS, "filter"]);
      return {
        ...base,
        query: q,
        ...(input["filter"] !== undefined ? { filter: validateFilter(input["filter"]) } : {}),
      };
    case "room.objects.list":
    case "room.tasks.list":
    case "room.decisions.list":
    case "room.polls.list":
    case "room.file_refs.list":
      assertOnlyKeys(input, [...BASE_KEYS, "filter", "sort", "page"]);
      return {
        ...base,
        query: q,
        ...(input["filter"] !== undefined ? { filter: validateFilter(input["filter"]) } : {}),
        ...(input["sort"] !== undefined ? { sort: validateSort(input["sort"]) } : {}),
        ...(input["page"] !== undefined ? { page: validatePage(input["page"], roomId) } : {}),
      };
    default:
      queryFail("unknown_query");
  }
}
