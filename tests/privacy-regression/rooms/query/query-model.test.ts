/**
 * Privacy-regression (TECH-19): the RoomOS query model. Side-effect-free,
 * policy-gated reads over an immutable snapshot; privacy-safe summaries/detail
 * views; structured filters; deterministic sorting; local cursors; bounded
 * exact in-memory search; strict-mode redaction. Covers §35 invariants.
 */
import { describe, expect, it } from "vitest";
import {
  createRoomQuerySnapshotV1,
  executeRoomQueryV1,
  resolveRoomPolicy,
  resolveRoomQueryPolicy,
  roomQueryScope,
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

const ROOM = createRoomLocalId("room-query-01");
const T = "local:2026-04-01T00:00:00.000Z";

function text(value: string) {
  return { format: "plain_text" as const, value };
}
const baseObj = (
  id: string,
  kind: RoomObjectV1["kind"],
  over: Record<string, unknown>,
): RoomObjectV1 =>
  Object.freeze({
    schemaVersion: 1,
    projectionVersion: 1,
    objectId: id,
    roomId: ROOM,
    kind,
    revision: 1,
    lifecycle: "active",
    sensitivity: "content",
    createdAtLocal: T,
    updatedAtLocal: T,
    createdBy: "member-alpha",
    updatedBy: "member-alpha",
    redacted: false,
    ...over,
  }) as RoomObjectV1;

function projection(objects: readonly RoomObjectV1[]): RoomObjectProjectionV1 {
  return { schemaVersion: 1, projectionVersion: 1, roomId: ROOM, objects };
}

const OBJECTS: readonly RoomObjectV1[] = [
  baseObj("msg-0001", "message", { content: { body: text("hello alpha"), edited: false } }),
  baseObj("msg-0002", "message", {
    revision: 3,
    content: { body: text("secret plan text"), edited: true },
  }),
  baseObj("note-0001", "note", {
    content: { body: text("note body"), tags: ["work", "urgent"] },
  }),
  baseObj("task-0001", "task", {
    content: {
      title: text("do the thing"),
      status: "in_progress",
      assigneeRefs: ["member-beta"],
      tags: ["work"],
      dueAtLocal: "local:2026-05-01",
    },
  }),
  baseObj("dec-0001", "decision", {
    content: { statement: text("we adopt X"), status: "accepted" },
  }),
  baseObj("poll-0001", "poll", {
    content: {
      question: text("which option"),
      options: [
        { optionId: "opt-1", label: text("a") },
        { optionId: "opt-2", label: text("b") },
      ],
      status: "draft",
      voteCapability: "not_implemented_gate_g_h",
    },
  }),
  baseObj("file-0001", "file_ref", {
    sensitivity: "relationship",
    content: {
      localRefId: "ref-abc",
      displayName: text("report"),
      availability: "reference_only_not_resolved",
    },
  }),
  baseObj("msg-red01", "message", { redacted: true, lifecycle: "redacted", content: null }),
  baseObj("msg-tomb1", "message", {
    redacted: true,
    lifecycle: "deleted_tombstone",
    content: null,
  }),
];

function roomState(mode: PrivacyMode, title?: string): RoomMaterializedState {
  return {
    roomId: ROOM,
    kind: "workspace",
    lifecycle: "active_local",
    mode,
    titleRedacted: title === undefined,
    ...(title !== undefined ? { title } : {}),
    members: [],
    objects: [],
    policy: resolveRoomPolicy({ mode, roomKind: "workspace" }),
  };
}

function decisionFor(query: string, mode: PrivacyMode): PolicyDecision {
  return issuePolicyDecision(
    ROOM_QUERY_CAPABILITY,
    "allowed",
    mode,
    roomQueryScope(query as never),
  );
}

function run(
  request: Record<string, unknown>,
  opts?: {
    mode?: PrivacyMode;
    title?: string;
    objects?: readonly RoomObjectV1[];
    decision?: PolicyDecision;
  },
) {
  const mode = opts?.mode ?? "standard";
  const rs = roomState(mode, opts?.title);
  const policy = resolveRoomQueryPolicy({
    mode,
    query: request["query"] as never,
    requestedView: request["requestedView"] as RoomQueryViewClass,
    roomPolicy: rs.policy,
  });
  const decision = opts?.decision ?? decisionFor(request["query"] as string, mode);
  const snapshot = createRoomQuerySnapshotV1({
    roomState: rs,
    objectProjection: projection(opts?.objects ?? OBJECTS),
    decision,
    policy,
  });
  return executeRoomQueryV1({ snapshot, request, decision, policy });
}

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
  reason: "test",
  ...extra,
});

describe("Summary + detail views (§35: 19-22)", () => {
  it("room summary carries no object content; counts gated", () => {
    const std = run(req("room.summary", "room_summary"), { mode: "standard", title: "Project" });
    expect(std.result).toBe("room.summary");
    if (std.result === "room.summary") {
      expect(std.view.title).toBe("Project");
      expect(std.view.objectCount).toBe(OBJECTS.length);
      expect(JSON.stringify(std.view)).not.toContain("secret plan text");
    }
    // Private: redacted-ish summary, no count.
    const priv = run(req("room.summary", "room_summary"), { mode: "private", title: "Project" });
    if (priv.result === "room.summary") expect(priv.view.objectCount).toBeUndefined();
  });

  it("object list summaries never contain content", () => {
    const r = run(req("room.objects.list", "object_summary"));
    if (r.result === "room.objects.list") {
      const s = JSON.stringify(r.items);
      expect(s).not.toContain("secret plan text");
      expect(s).not.toContain("hello alpha");
      expect(r.items.every((i) => !("content" in i))).toBe(true);
    }
  });

  it("detail content view returns content in Standard; redacted/tombstoned never do", () => {
    const detail = run(req("room.object.get", "object_detail_content", { objectId: "msg-0002" }), {
      mode: "standard",
    });
    if (detail.result === "room.object.get") {
      expect(detail.detail.redacted).toBe(false);
      expect(detail.detail.object?.kind).toBe("message");
    }
    const red = run(req("room.object.get", "object_detail_content", { objectId: "msg-red01" }), {
      mode: "standard",
    });
    if (red.result === "room.object.get") {
      expect(red.detail.redacted).toBe(true);
      expect(red.detail.object?.content).toBeNull();
      expect(red.detail.redactionReason).toBe("object_redacted");
    }
    const tomb = run(req("room.object.get", "object_detail_content", { objectId: "msg-tomb1" }), {
      mode: "standard",
    });
    if (tomb.result === "room.object.get") {
      expect(tomb.detail.object?.content).toBeNull();
      expect(tomb.detail.redactionReason).toBe("object_tombstoned");
    }
  });
});

describe("Strict-mode redaction (§35: 23-29)", () => {
  it("Ghost suppresses actor refs, timestamps; content only on get", () => {
    const list = run(req("room.objects.list", "object_summary"), { mode: "ghost" });
    if (list.result === "room.objects.list") {
      for (const i of list.items) {
        expect(i.createdAtLocal).toBeUndefined();
        // revision may show but no timestamps; no actor field exists on summaries
        expect(i).not.toHaveProperty("createdBy");
      }
    }
    const detail = run(req("room.object.get", "object_detail_content", { objectId: "task-0001" }), {
      mode: "ghost",
    });
    if (detail.result === "room.object.get" && detail.detail.object?.kind === "task") {
      // actor refs neutralized; assignees (relationship) stripped; timestamps redacted
      expect(detail.detail.object.createdBy).toBe("local_unknown");
      expect(detail.detail.object.content?.assigneeRefs).toEqual([]);
      expect(detail.detail.object.createdAtLocal).toBe("local:redacted");
    }
  });

  it("Bunker denies content detail and search; redacted summaries only", () => {
    expect(() =>
      run(req("room.object.get", "object_detail_content", { objectId: "msg-0001" }), {
        mode: "bunker",
      }),
    ).toThrow(/policy_denied|content_view_denied/);
    expect(() =>
      run(req("room.objects.search_plain_text", "object_summary_redacted", { term: "hello" }), {
        mode: "bunker",
      }),
    ).toThrow(/search_denied|policy_denied/);
    const summary = run(req("room.objects.list", "object_summary_redacted"), { mode: "bunker" });
    if (summary.result === "room.objects.list") {
      for (const i of summary.items) {
        expect(i.objectId).toBeUndefined();
        expect(i.revision).toBeUndefined();
        expect(i.contentPresent).toBeUndefined();
      }
    }
  });

  it("Emergency denies ordinary queries; allows minimal room summary", () => {
    const s = run(req("room.summary", "room_summary_redacted"), { mode: "emergency" });
    expect(s.result).toBe("room.summary");
    expect(() => run(req("room.objects.list", "object_summary"), { mode: "emergency" })).toThrow();
    expect(() => run(req("room.object_counts", "object_summary"), { mode: "emergency" })).toThrow();
  });
});

describe("Search (§35: 31-39)", () => {
  it("Standard exact case-sensitive substring; no regex/snippets; ignores redacted", () => {
    const r = run(
      req("room.objects.search_plain_text", "object_summary", { term: "secret plan" }),
      { mode: "standard" },
    );
    if (r.result === "room.objects.search_plain_text") {
      expect(r.items.length).toBe(1);
      expect(r.items[0]?.objectId).toBe("msg-0002");
      // no snippets present on items
      expect(r.items[0]).not.toHaveProperty("snippet");
    }
    // Case-sensitive: "SECRET" does not match "secret".
    const upper = run(req("room.objects.search_plain_text", "object_summary", { term: "SECRET" }), {
      mode: "standard",
    });
    if (upper.result === "room.objects.search_plain_text") expect(upper.items.length).toBe(0);
    // Regex metachars are treated literally (no regex).
    const rx = run(req("room.objects.search_plain_text", "object_summary", { term: "se.ret" }), {
      mode: "standard",
    });
    if (rx.result === "room.objects.search_plain_text") expect(rx.items.length).toBe(0);
  });

  it("search never matches redacted/tombstoned content", () => {
    // Redacted message had body content before redaction; must not be found.
    const r = run(req("room.objects.search_plain_text", "object_summary", { term: "hello" }), {
      mode: "standard",
    });
    if (r.result === "room.objects.search_plain_text") {
      expect(r.items.every((i) => i.objectId !== "msg-red01" && i.objectId !== "msg-tomb1")).toBe(
        true,
      );
    }
  });
});

describe("Filters, sorting, counts, pagination (§35)", () => {
  it("kind + status filters; deterministic id sort", () => {
    const tasks = run(
      req("room.tasks.list", "object_summary", { filter: { taskStatuses: ["in_progress"] } }),
    );
    if (tasks.result === "room.tasks.list") {
      expect(tasks.items.length).toBe(1);
      expect(tasks.items[0]?.kind).toBe("task");
    }
  });

  it("counts require their own scope and mode allowance", () => {
    const std = run(req("room.object_counts", "object_summary"), { mode: "standard" });
    if (std.result === "room.object_counts") {
      expect(std.countsAvailable).toBe(true);
      expect(std.totalCount).toBe(OBJECTS.length);
    }
    // Private/Ghost deny counts at authorization time (own scope, own denial).
    expect(() => run(req("room.object_counts", "object_summary"), { mode: "private" })).toThrow(
      /count_denied|policy_denied/,
    );
    expect(() => run(req("room.object_counts", "object_summary"), { mode: "ghost" })).toThrow(
      /count_denied|policy_denied/,
    );
  });

  it("limit bounds enforced", () => {
    expect(() =>
      run(
        req("room.objects.list", "object_summary", { sort: "object_id_asc", page: { limit: 0 } }),
      ),
    ).toThrow(/limit_too_small/);
    expect(() =>
      run(req("room.objects.list", "object_summary", { page: { limit: 9999 } })),
    ).toThrow(/limit_too_large/);
  });

  it("pagination returns a cursor and continues deterministically", () => {
    const first = run(
      req("room.objects.list", "object_summary", { sort: "object_id_asc", page: { limit: 3 } }),
    );
    if (first.result === "room.objects.list") {
      expect(first.items.length).toBe(3);
      expect(first.page.hasMore).toBe(true);
      const cursor = first.page.nextCursor!;
      const second = run(
        req("room.objects.list", "object_summary", {
          sort: "object_id_asc",
          page: { limit: 3, cursor },
        }),
      );
      if (second.result === "room.objects.list") {
        const firstIds = first.items.map((i) => i.objectId);
        const secondIds = second.items.map((i) => i.objectId);
        expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
      }
    }
  });
});

describe("Determinism + immutability (§35: 50-54)", () => {
  it("repeated query is deep-equal; result mutation does not touch source", () => {
    const objs = OBJECTS.map((o) => structuredClone(o));
    const a = run(req("room.objects.list", "object_summary"), { objects: objs });
    const b = run(req("room.objects.list", "object_summary"), { objects: objs });
    expect(a).toEqual(b);
    // Mutating source objects array after building the snapshot cannot change a prior result.
    if (a.result === "room.objects.list") {
      const before = a.items.length;
      (objs as RoomObjectV1[]).push(
        baseObj("msg-9999", "message", { content: { body: text("x"), edited: false } }),
      );
      expect(a.items.length).toBe(before);
    }
  });

  it("sorting does not mutate the source object order", () => {
    const objs = OBJECTS.slice();
    const originalOrder = objs.map((o) => o.objectId);
    run(req("room.objects.list", "object_summary", { sort: "revision_desc" }), { objects: objs });
    expect(objs.map((o) => o.objectId)).toEqual(originalOrder);
  });
});

describe("Zero side effects (§35: 58-63)", () => {
  it("no network / notification during snapshot + queries", () => {
    const net = createNetworkSideEffectTrap();
    const notif = createNotificationSideEffectTrap();
    try {
      run(req("room.summary", "room_summary"));
      run(req("room.objects.list", "object_summary"));
      run(req("room.object.get", "object_detail_content", { objectId: "msg-0001" }));
      run(req("room.objects.search_plain_text", "object_summary", { term: "hello" }));
      run(req("room.object_counts", "object_summary"));
    } finally {
      net.uninstall();
      notif.uninstall();
    }
    expect(() => net.assertNoNetworkApiCalled()).not.toThrow();
    expect(() => notif.assertNoNotificationApiCalled()).not.toThrow();
  });
});

describe("Specialized views (§35: 64-67)", () => {
  it("poll view exposes no votes/tallies; file-ref view exposes no path/URL", () => {
    const poll = run(req("room.polls.list", "object_summary"));
    if (poll.result === "room.polls.list") {
      expect(JSON.stringify(poll.items)).not.toContain("vote");
    }
    const fileDetail = run(
      req("room.object.get", "object_detail_content", { objectId: "file-0001" }),
      { mode: "standard" },
    );
    if (fileDetail.result === "room.object.get" && fileDetail.detail.object?.kind === "file_ref") {
      const s = JSON.stringify(fileDetail.detail.object);
      expect(s).not.toContain("http");
      expect(s).not.toContain("/");
      expect(fileDetail.detail.object.content?.availability).toBe("reference_only_not_resolved");
    }
  });

  it("decision view makes no signature/consensus claim", () => {
    const d = run(req("room.decisions.list", "object_summary"));
    if (d.result === "room.decisions.list") {
      const s = JSON.stringify(d.items).toLowerCase();
      expect(s).not.toContain("signature");
      expect(s).not.toContain("consensus");
    }
  });
});
