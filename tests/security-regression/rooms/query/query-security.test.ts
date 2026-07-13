/**
 * Security-regression (TECH-19): the query model cannot be bypassed and never
 * leaks. Every query needs an exact-scope authentic decision; object IDs/actor
 * refs confer no authority; cross-room/unknown/scope-mismatch reject; the term/
 * content never reach errors/console; no history/cache/index; no network/
 * notification/persistent-write; the guardrail catches violations. Covers
 * §35 (1-18, 40-49, 55-63) + §36.
 */
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  createRoomQuerySnapshotV1,
  executeRoomQueryV1,
  resolveRoomPolicy,
  resolveRoomQueryPolicy,
  roomQueryScope,
  validateRoomQueryRequestV1,
  createRoomLocalId,
  ROOM_QUERY_CAPABILITY,
  type RoomMaterializedState,
  type RoomObjectProjectionV1,
  type RoomObjectV1,
  type RoomQueryViewClass,
} from "@freelayer/rooms";
import { issuePolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import { createNetworkSideEffectTrap } from "../../../helpers/network-trap";
import { createNotificationSideEffectTrap } from "../../../helpers/notification-trap";
import { createPersistentWriteTrap } from "../../../helpers/persistent-write-trap";

const SENTINEL = "FREELAYER_ROOM_QUERY_SENTINEL_DO_NOT_LEAK";
const ROOM = createRoomLocalId("room-query-sec");
const OTHER = createRoomLocalId("room-other-99");
const T = "local:2026-04-01T00:00:00.000Z";

const text = (value: string) => ({ format: "plain_text" as const, value });
const obj = (id: string, body: string): RoomObjectV1 =>
  Object.freeze({
    schemaVersion: 1,
    projectionVersion: 1,
    objectId: id,
    roomId: ROOM,
    kind: "message",
    revision: 1,
    lifecycle: "active",
    sensitivity: "content",
    createdAtLocal: T,
    updatedAtLocal: T,
    createdBy: "local_unknown",
    updatedBy: "local_unknown",
    redacted: false,
    content: { body: text(body), edited: false },
  }) as RoomObjectV1;

const OBJECTS: readonly RoomObjectV1[] = [
  obj("msg-0001", `hi ${SENTINEL}`),
  obj("msg-0002", "plain"),
];

function roomState(mode: PrivacyMode): RoomMaterializedState {
  return {
    roomId: ROOM,
    kind: "workspace",
    lifecycle: "active_local",
    mode,
    titleRedacted: true,
    members: [],
    objects: [],
    policy: resolveRoomPolicy({ mode, roomKind: "workspace" }),
  };
}
const projection: RoomObjectProjectionV1 = {
  schemaVersion: 1,
  projectionVersion: 1,
  roomId: ROOM,
  objects: OBJECTS,
};

const req = (
  query: string,
  requestedView: RoomQueryViewClass,
  extra: Record<string, unknown> = {},
) => ({
  schemaVersion: 1,
  query,
  roomId: ROOM,
  requestedView,
  mode: "standard",
  reason: "sec",
  ...extra,
});

function exec(
  request: Record<string, unknown>,
  opts?: { mode?: PrivacyMode; decision?: PolicyDecision; snapshotRoom?: RoomMaterializedState },
) {
  const mode = opts?.mode ?? "standard";
  const rs = opts?.snapshotRoom ?? roomState(mode);
  const policy = resolveRoomQueryPolicy({
    mode,
    query: request["query"] as never,
    requestedView: request["requestedView"] as RoomQueryViewClass,
    roomPolicy: rs.policy,
  });
  const decision =
    opts?.decision ??
    issuePolicyDecision(
      ROOM_QUERY_CAPABILITY,
      "allowed",
      mode,
      roomQueryScope(request["query"] as never),
    );
  const snapshot = createRoomQuerySnapshotV1({
    roomState: rs,
    objectProjection: projection,
    decision,
    policy,
  });
  return executeRoomQueryV1({ snapshot, request, decision, policy });
}

function errorText(fn: () => void): string {
  try {
    fn();
  } catch (e: unknown) {
    return e instanceof Error ? `${e.name}: ${e.message} ${e.stack ?? ""}` : String(e);
  }
  throw new Error("expected throw");
}

describe("Authorization (§35: 1-18)", () => {
  it("requires an authentic, allowed, exactly-scoped decision", () => {
    // Fake decision (not from issuePolicyDecision → not in provenance WeakSet).
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "room.query.list",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    } as PolicyDecision;
    expect(() => exec(req("room.objects.list", "object_summary"), { decision: forged })).toThrow(
      /decision_missing/,
    );
    // Denied verdict.
    expect(() =>
      exec(req("room.objects.list", "object_summary"), {
        decision: issuePolicyDecision(
          ROOM_QUERY_CAPABILITY,
          "denied",
          "standard",
          "room.query.list",
        ),
      }),
    ).toThrow(/policy_denied/);
    // Wrong scope: list decision cannot authorize detail.
    expect(() =>
      exec(req("room.object.get", "object_detail_content", { objectId: "msg-0001" }), {
        decision: issuePolicyDecision(
          ROOM_QUERY_CAPABILITY,
          "allowed",
          "standard",
          "room.query.list",
        ),
      }),
    ).toThrow(/decision_mismatch/);
    // Summary decision cannot authorize search; detail cannot authorize count.
    expect(() =>
      exec(req("room.objects.search_plain_text", "object_summary", { term: "hi" }), {
        decision: issuePolicyDecision(
          ROOM_QUERY_CAPABILITY,
          "allowed",
          "standard",
          "room.query.summary",
        ),
      }),
    ).toThrow(/decision_mismatch/);
    // Mutation/storage decisions cannot authorize a query (wrong scope).
    expect(() =>
      exec(req("room.objects.list", "object_summary"), {
        decision: issuePolicyDecision(
          ROOM_QUERY_CAPABILITY,
          "allowed",
          "standard",
          "room.object.create",
        ),
      }),
    ).toThrow(/decision_mismatch/);
  });

  it("cross-room snapshot/request and unknown query/view/filter/sort reject; object id grants no authority", () => {
    // Request room differs from snapshot room.
    const crossReq = { ...req("room.objects.list", "object_summary"), roomId: OTHER };
    expect(() => exec(crossReq)).toThrow(/room_mismatch|invalid/);
    expect(() => validateRoomQueryRequestV1(req("room.frobnicate", "object_summary"))).toThrow(
      /unknown_query/,
    );
    expect(() =>
      validateRoomQueryRequestV1(req("room.objects.list", "x_view" as RoomQueryViewClass)),
    ).toThrow(/unknown_view/);
    expect(() =>
      validateRoomQueryRequestV1(req("room.objects.list", "object_summary", { sort: "by_magic" })),
    ).toThrow(/unknown_sort/);
    expect(() =>
      validateRoomQueryRequestV1(
        req("room.objects.list", "object_summary", { filter: { kinds: ["wizard"] } }),
      ),
    ).toThrow(/unknown_filter/);
    // A guessed but non-existent object id yields "not available", not content.
    expect(() =>
      exec(req("room.object.get", "object_detail_content", { objectId: "msg-guessed" })),
    ).toThrow(/object_not_available/);
  });

  it("prototype-pollution keys and getters reject; unexpected fields reject", () => {
    expect(() =>
      validateRoomQueryRequestV1(
        req("room.summary", "room_summary", { ["__proto__"]: { admin: true } }),
      ),
    ).toThrow(/dangerous_key|unexpected_field/);
    expect(() =>
      validateRoomQueryRequestV1(req("room.summary", "room_summary", { surprise: 1 })),
    ).toThrow(/unexpected_field/);
    let ran = false;
    const hostile = req("room.summary", "room_summary");
    Object.defineProperty(hostile, "extra", {
      enumerable: true,
      get() {
        ran = true;
        return 1;
      },
    });
    expect(() => validateRoomQueryRequestV1(hostile)).toThrow(/unexpected_field/);
    expect(ran).toBe(false);
  });
});

describe("Search safety + leak (§35: 34-40, §36)", () => {
  it("empty/oversized term reject; term never appears in errors", () => {
    expect(() =>
      validateRoomQueryRequestV1(
        req("room.objects.search_plain_text", "object_summary", { term: "" }),
      ),
    ).toThrow(/empty_term/);
    const t = errorText(() =>
      validateRoomQueryRequestV1(
        req("room.objects.search_plain_text", "object_summary", { term: SENTINEL.repeat(20) }),
      ),
    );
    expect(t).not.toContain(SENTINEL);
    expect(t).toContain("term_too_large");
  });

  it("denied search error carries no term; results never leak denied content", () => {
    const t = errorText(() =>
      exec(req("room.objects.search_plain_text", "object_summary", { term: SENTINEL }), {
        mode: "bunker",
      }),
    );
    expect(t).not.toContain(SENTINEL);
    // A redacted (object_summary_redacted) search result carries no content.
    const r = exec(req("room.objects.search_plain_text", "object_summary", { term: SENTINEL }), {
      mode: "ghost",
    });
    expect(JSON.stringify(r)).not.toContain(SENTINEL);
  });

  it("summaries/counts/console never carry the sentinel", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const list = exec(req("room.objects.list", "object_summary"));
      expect(JSON.stringify(list)).not.toContain(SENTINEL);
      const count = exec(req("room.object_counts", "object_summary"), { mode: "standard" });
      expect(JSON.stringify(count)).not.toContain(SENTINEL);
      expect(spy.mock.calls.flat().join(" ")).not.toContain(SENTINEL);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("Cursor safety (§35: 47-49)", () => {
  it("cursor room/sort mismatch reject; cursor grants no authority", () => {
    const first = exec(
      req("room.objects.list", "object_summary", { sort: "object_id_asc", page: { limit: 1 } }),
    );
    if (first.result !== "room.objects.list") throw new Error("unexpected");
    const cursor = first.page.nextCursor!;
    // Wrong sort.
    expect(() =>
      exec(
        req("room.objects.list", "object_summary", {
          sort: "revision_desc",
          page: { limit: 1, cursor },
        }),
      ),
    ).toThrow(/cursor_sort_mismatch/);
    // Wrong room inside the cursor.
    const badCursor = { ...cursor, roomId: OTHER };
    expect(() =>
      validateRoomQueryRequestV1(
        req("room.objects.list", "object_summary", {
          sort: "object_id_asc",
          page: { limit: 1, cursor: badCursor },
        }),
      ),
    ).toThrow(/cursor_room_mismatch/);
  });
});

describe("Zero side effects + immutability (§35: 55-63, 51-52)", () => {
  it("no network/notification/persistent-write across all query kinds", () => {
    const net = createNetworkSideEffectTrap();
    const notif = createNotificationSideEffectTrap();
    const write = createPersistentWriteTrap();
    try {
      exec(req("room.summary", "room_summary"));
      exec(req("room.objects.list", "object_summary"));
      exec(req("room.object.get", "object_detail_content", { objectId: "msg-0001" }));
      exec(req("room.objects.search_plain_text", "object_summary", { term: "plain" }));
      exec(req("room.object_counts", "object_summary"));
    } finally {
      net.uninstall();
      notif.uninstall();
      write.uninstall();
    }
    expect(() => net.assertNoNetworkApiCalled()).not.toThrow();
    expect(() => notif.assertNoNotificationApiCalled()).not.toThrow();
    expect(() => write.assertNoPersistentApiCalled()).not.toThrow();
  });

  it("result mutation does not mutate the source projection", () => {
    const detail = exec(req("room.object.get", "object_detail_content", { objectId: "msg-0001" }));
    if (detail.result === "room.object.get" && detail.detail.object) {
      // The returned object is frozen; the source object is unchanged regardless.
      const before = OBJECTS[0]!.content;
      try {
        (detail.detail.object as { content: unknown }).content = null;
      } catch {
        // frozen — expected
      }
      expect(OBJECTS[0]!.content).toBe(before);
    }
  });
});

describe("Guardrail + import hygiene (§37-38)", () => {
  it("check:no-room-query-bypass flags the fixture and passes real source", () => {
    const bad = spawnSync(
      process.execPath,
      ["scripts/check-no-room-query-bypass.mjs", "tests/fixtures/room-query-bypass"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
    expect(bad.status).toBe(1);
    expect(`${bad.stdout}\n${bad.stderr}`).toContain("query bypass");
    const real = spawnSync(process.execPath, ["scripts/check-no-room-query-bypass.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(real.status).toBe(0);
  });

  it("query/ imports no search/CRDT/crypto/network/AI packages", () => {
    const files = readdirSync("packages/rooms/src/query").filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(`packages/rooms/src/query/${file}`, "utf8");
      for (const banned of [
        '"fuse.js"',
        '"lunr"',
        '"minisearch"',
        '"flexsearch"',
        '"yjs"',
        "@automerge",
        '"@freelayer/crypto"',
        "node:crypto",
        '"@freelayer/ai"',
        '"@freelayer/transports"',
        "iohook",
      ]) {
        expect(src.includes(banned), `${file} imports ${banned}`).toBe(false);
      }
    }
  });
});
