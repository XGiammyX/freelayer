/**
 * RoomOS query executor (TECH-19). Side-effect-free: no snapshot mutation, no
 * event append, no operation-log access, no storage/network/notification/link-
 * preview/file/AI/endpoint call. Deterministic for the same snapshot + request
 * + policy + decision; every sort has an object-ID tie-breaker.
 */

import type { PolicyDecision } from "@freelayer/privacy";
import type { RoomLocalId } from "../room-types";
import type { RoomObjectV1 } from "../objects";
import { evaluatePolicyMatrix } from "@freelayer/privacy";
import {
  RoomQueryObjectNotAvailableError,
  RoomQueryLimitError,
  RoomQueryRoomMismatchError,
} from "./query-errors";
import { validateRoomQueryRequestV1 } from "./query-validation";
import { assertRoomQueryAllowed, roomQueryScope, type RoomQueryPolicy } from "./query-policy";
import { assertCursorMatchesQuery } from "./query-cursor";
import type { RoomQueryRequestV1 } from "./query-requests";
import type { RoomQuerySnapshotV1 } from "./query-snapshot";
import { searchRoomObjectsExact } from "./query-search";
import {
  createRoomObjectDetailView,
  redactRoomObjectSummaryForQuery,
  redactRoomSummaryForQuery,
} from "./query-redaction";
import {
  ROOM_QUERY_DEFAULT_LIMIT,
  ROOM_QUERY_MAX_LIMIT,
  ROOM_QUERY_SEARCH_MAX_LIMIT,
  type RoomObjectFilterV1,
  type RoomObjectSortV1,
  type RoomQueryPageRequestV1,
} from "./query-types";
import type {
  RoomObjectSummaryViewV1,
  RoomQueryPageInfoV1,
  RoomQueryResultV1,
} from "./query-views";

const KIND_FOR_LIST: Record<string, RoomObjectV1["kind"] | undefined> = {
  "room.tasks.list": "task",
  "room.decisions.list": "decision",
  "room.polls.list": "poll",
  "room.file_refs.list": "file_ref",
};

function matchesFilter(object: RoomObjectV1, filter?: RoomObjectFilterV1): boolean {
  if (filter === undefined) return true;
  if (filter.kinds && !filter.kinds.includes(object.kind)) return false;
  if (filter.lifecycles && !filter.lifecycles.includes(object.lifecycle)) return false;
  if (filter.redacted !== undefined && object.redacted !== filter.redacted) return false;
  const content = object.content as Record<string, unknown> | null;
  if (
    filter.taskStatuses &&
    (object.kind !== "task" ||
      !content ||
      !filter.taskStatuses.includes(content["status"] as never))
  ) {
    return false;
  }
  if (
    filter.decisionStatuses &&
    (object.kind !== "decision" ||
      !content ||
      !filter.decisionStatuses.includes(content["status"] as never))
  ) {
    return false;
  }
  if (
    filter.pollStatuses &&
    (object.kind !== "poll" ||
      !content ||
      !filter.pollStatuses.includes(content["status"] as never))
  ) {
    return false;
  }
  if (filter.exactTag !== undefined) {
    const tags = content && Array.isArray(content["tags"]) ? (content["tags"] as string[]) : [];
    if (!tags.includes(filter.exactTag)) return false;
  }
  return true;
}

/** Deterministic comparator with an object-ID tie-breaker on every sort. */
function comparator(sort: RoomObjectSortV1): (a: RoomObjectV1, b: RoomObjectV1) => number {
  const byId = (a: RoomObjectV1, b: RoomObjectV1): number =>
    (a.objectId as string) < (b.objectId as string)
      ? -1
      : (a.objectId as string) > (b.objectId as string)
        ? 1
        : 0;
  switch (sort) {
    case "created_local_asc":
      return (a, b) =>
        a.createdAtLocal < b.createdAtLocal
          ? -1
          : a.createdAtLocal > b.createdAtLocal
            ? 1
            : byId(a, b);
    case "updated_local_desc":
      return (a, b) =>
        a.updatedAtLocal > b.updatedAtLocal
          ? -1
          : a.updatedAtLocal < b.updatedAtLocal
            ? 1
            : byId(a, b);
    case "revision_desc":
      return (a, b) => (b.revision as number) - (a.revision as number) || byId(a, b);
    case "object_id_asc":
    default:
      return byId;
  }
}

function resolveLimit(
  page: RoomQueryPageRequestV1 | undefined,
  hardMax: number,
  policyMax: number,
): number {
  const ceiling = Math.min(hardMax, policyMax);
  // No explicit limit → use the default, clamped to the policy ceiling.
  if (page?.limit === undefined) return Math.min(ROOM_QUERY_DEFAULT_LIMIT, ceiling);
  // An EXPLICIT limit is validated strictly (below-min / above-ceiling reject).
  if (page.limit < 1) throw new RoomQueryLimitError("limit_too_small");
  if (page.limit > ceiling) throw new RoomQueryLimitError("limit_too_large");
  return page.limit;
}

function paginate(
  items: readonly RoomObjectV1[],
  roomId: RoomLocalId,
  sort: RoomObjectSortV1,
  page: RoomQueryPageRequestV1 | undefined,
  limit: number,
): { window: RoomObjectV1[]; info: RoomQueryPageInfoV1 } {
  let start = 0;
  if (page?.cursor !== undefined) {
    assertCursorMatchesQuery(page.cursor, roomId, sort);
    const idx = items.findIndex(
      (o) => (o.objectId as string) === (page.cursor!.lastObjectId as string),
    );
    start = idx >= 0 ? idx + 1 : items.length; // unknown cursor object → empty tail
  }
  const window = items.slice(start, start + limit);
  const hasMore = start + limit < items.length;
  const last = window[window.length - 1];
  const info: RoomQueryPageInfoV1 = {
    returnedCount: window.length,
    limit,
    hasMore,
    ...(hasMore && last
      ? {
          nextCursor: {
            schemaVersion: 1 as const,
            roomId: last.roomId,
            sort,
            lastObjectId: last.objectId,
            lastRevision: last.revision as number,
            lastCreatedAtLocal: last.createdAtLocal,
            lastUpdatedAtLocal: last.updatedAtLocal,
          },
        }
      : {}),
  };
  return { window, info };
}

function assertMatrixLocal(mode: string, scope: string): void {
  const op =
    scope === "room.query.summary"
      ? "room.query.summary"
      : scope === "room.query.detail"
        ? "room.query.detail"
        : scope === "room.query.search"
          ? "room.query.search"
          : scope === "room.query.count"
            ? "room.query.count"
            : "room.query.list";
  const decision = evaluatePolicyMatrix({ mode: mode as never, domain: "room", operation: op });
  if (decision.effect !== "memory_only") {
    // Matrix forbids this query in this mode — a policy denial, content-free.
    throw new RoomQueryObjectNotAvailableError();
  }
}

/** Sort a COPY (never mutate the snapshot's array). */
function sortedCopy(items: readonly RoomObjectV1[], sort: RoomObjectSortV1): RoomObjectV1[] {
  return items.slice().sort(comparator(sort));
}

export function executeRoomQueryV1(input: {
  snapshot: RoomQuerySnapshotV1;
  request: unknown;
  decision: PolicyDecision;
  policy: RoomQueryPolicy;
}): RoomQueryResultV1 {
  const { snapshot, decision, policy } = input;

  // 1. Validate request. 2. Room match. 3-5. Matrix + exact-scope decision.
  const request: RoomQueryRequestV1 = validateRoomQueryRequestV1(input.request);
  if (request.roomId !== snapshot.roomId) throw new RoomQueryRoomMismatchError();
  const scope = roomQueryScope(request.query);
  assertMatrixLocal(snapshot.mode, scope);
  assertRoomQueryAllowed(request, decision, policy);

  const objects = snapshot.objects;

  switch (request.query) {
    case "room.summary":
      return {
        result: "room.summary",
        view: redactRoomSummaryForQuery(snapshot, policy, objects.length),
      };

    case "room.object.get": {
      const found = objects.find((o) => (o.objectId as string) === (request.objectId as string));
      if (found === undefined || found.roomId !== snapshot.roomId) {
        throw new RoomQueryObjectNotAvailableError();
      }
      return { result: "room.object.get", detail: createRoomObjectDetailView(found, policy) };
    }

    case "room.object_counts": {
      const filtered = objects.filter((o) => matchesFilter(o, request.filter));
      return policy.countsAllowed
        ? { result: "room.object_counts", totalCount: filtered.length, countsAvailable: true }
        : { result: "room.object_counts", countsAvailable: false };
    }

    case "room.objects.search_plain_text": {
      const limit = resolveLimit(request.page, ROOM_QUERY_SEARCH_MAX_LIMIT, policy.maxResults);
      const sort: RoomObjectSortV1 = "object_id_asc";
      const ordered = sortedCopy(objects, sort);
      const hits = searchRoomObjectsExact(ordered, request.term, policy, request.kinds);
      const { window, info } = paginate(hits, snapshot.roomId, sort, request.page, limit);
      return {
        result: "room.objects.search_plain_text",
        items: window.map((o) => redactRoomObjectSummaryForQuery(o, policy)),
        page: info,
      };
    }

    default: {
      // All list-shaped queries share this path.
      const kindConstraint = KIND_FOR_LIST[request.query];
      const listReq = request as Extract<RoomQueryRequestV1, { filter?: RoomObjectFilterV1 }>;
      const sort = (listReq as { sort?: RoomObjectSortV1 }).sort ?? "object_id_asc";
      const effectiveSort =
        !policy.timestampsAllowed && (sort === "created_local_asc" || sort === "updated_local_desc")
          ? "object_id_asc" // timestamp ordering denied in strict modes
          : sort;
      return listResult(
        request.query,
        objects,
        snapshot.roomId,
        effectiveSort,
        listReq.filter,
        kindConstraint,
        (listReq as { page?: RoomQueryPageRequestV1 }).page,
        policy,
      );
    }
  }
}

function listResult(
  query: RoomQueryRequestV1["query"],
  objects: readonly RoomObjectV1[],
  roomId: RoomLocalId,
  sort: RoomObjectSortV1,
  filter: RoomObjectFilterV1 | undefined,
  kindConstraint: RoomObjectV1["kind"] | undefined,
  page: RoomQueryPageRequestV1 | undefined,
  policy: RoomQueryPolicy,
): RoomQueryResultV1 {
  const limit = resolveLimit(page, ROOM_QUERY_MAX_LIMIT, policy.maxResults);
  const filtered = objects.filter(
    (o) => (kindConstraint ? o.kind === kindConstraint : true) && matchesFilter(o, filter),
  );
  const ordered = sortedCopy(filtered, sort);
  const { window, info } = paginate(ordered, roomId, sort, page, limit);
  const items: RoomObjectSummaryViewV1[] = window.map((o) =>
    redactRoomObjectSummaryForQuery(o, policy),
  );
  // `result` discriminator mirrors the query kind for list-shaped queries.
  return { result: query, items, page: info } as RoomQueryResultV1;
}
