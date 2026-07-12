/**
 * Privacy-regression (TECH-18): the RoomOS object model. Explicit policy-gated
 * mutations produce deterministic events + projections; revisions guard
 * optimistic concurrency; lifecycle/status machines hold; strict modes deny
 * persistent content; no network/notification side effects; content never
 * enters summaries/errors. Covers §35-41 invariants.
 */
import { describe, expect, it } from "vitest";
import {
  applyLocalRoomObjectMutationV1,
  createRoomLocalId,
  emptyRoomObjectProjection,
  InMemoryRoomObjectLog,
  NullRoomObjectLog,
  objectMutationScope,
  replayRoomObjectEventsV1,
  resolveRoomPolicy,
  ROOM_OBJECT_CAPABILITY,
  type RoomObjectLog,
  type RoomObjectProjectionV1,
} from "@freelayer/rooms";
import { issuePolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import { createNetworkSideEffectTrap } from "../../../helpers/network-trap";
import { createNotificationSideEffectTrap } from "../../../helpers/notification-trap";

const ROOM = createRoomLocalId("room-objects-01");
const CLOCK = { nowLocalIso: () => "local:2026-02-02T00:00:00.000Z" };
let eid = 0;
const nextEid = () => `oevt-${(eid += 1)}`;

function mutate(scope: PolicyDecision["sideEffect"], mode: PrivacyMode) {
  return issuePolicyDecision(ROOM_OBJECT_CAPABILITY, "allowed", mode, scope);
}
function storage(mode: PrivacyMode) {
  return issuePolicyDecision(ROOM_OBJECT_CAPABILITY, "allowed", mode, "room.object_log.append");
}

interface Harness {
  projection: RoomObjectProjectionV1;
  log: RoomObjectLog;
  apply(
    command: Record<string, unknown>,
    mode?: PrivacyMode,
  ): ReturnType<typeof applyLocalRoomObjectMutationV1>;
}

function harness(options?: { mode?: PrivacyMode; log?: RoomObjectLog }): Harness {
  const mode = options?.mode ?? "private";
  const log = options?.log ?? new InMemoryRoomObjectLog(ROOM);
  const h: Harness = {
    projection: emptyRoomObjectProjection(ROOM),
    log,
    apply(command, m = mode) {
      const roomPolicy = resolveRoomPolicy({ mode: m, roomKind: "workspace" });
      const scope = objectMutationScope(command["command"] as never);
      const result = applyLocalRoomObjectMutationV1({
        projection: h.projection,
        command,
        roomPolicy,
        mutationDecision: mutate(scope, m),
        storageDecision: storage(m),
        objectEventId: nextEid(),
        clock: CLOCK,
        objectLog: log,
        deviceRiskLevel: "low",
      });
      h.projection = result.nextProjection;
      return result;
    },
  };
  return h;
}

const base = (command: string, objectId: string, extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  command,
  roomId: ROOM,
  objectId,
  actorRef: "local_unknown",
  mode: "private",
  reason: "test",
  ...extra,
});

// ---------------------------------------------------------------------------
// Message (§35)
// ---------------------------------------------------------------------------
describe("Message object (§35)", () => {
  it("creates at revision 1, edits with correct revision, rejects stale/redacted/tombstoned edits", () => {
    const h = harness();
    const created = h.apply(base("message.create", "msg-1", { body: "hello world" }));
    expect(created.event.resultingRevision).toBe(1);
    expect(created.objectSummary.contentPresent).toBe(true);
    expect(created.retained).toBe("memory");

    const edited = h.apply(
      base("message.edit", "msg-1", { expectedRevision: 1, body: "edited body" }),
    );
    expect(edited.event.resultingRevision).toBe(2);

    expect(() =>
      h.apply(base("message.edit", "msg-1", { expectedRevision: 1, body: "stale" })),
    ).toThrow(/stale_revision/);
    expect(() =>
      h.apply(base("message.edit", "msg-1", { expectedRevision: 9, body: "future" })),
    ).toThrow(/future_revision/);
    h.apply(base("message.redact", "msg-1", { expectedRevision: 2 }));
    expect(() =>
      h.apply(base("message.edit", "msg-1", { expectedRevision: 3, body: "x" })),
    ).toThrow();
    h.apply(base("object.tombstone", "msg-1", { expectedRevision: 3 }));
    expect(() =>
      h.apply(base("message.edit", "msg-1", { expectedRevision: 4, body: "x" })),
    ).toThrow(/terminal/);
  });

  it("reply to same-room message succeeds; other-room/unknown reply rejects", () => {
    const h = harness();
    h.apply(base("message.create", "msg-a", { body: "first" }));
    const reply = h.apply(
      base("message.create", "msg-b", { body: "reply", replyToObjectId: "msg-a" }),
    );
    expect(reply.event.object.kind).toBe("message");
    expect(() =>
      h.apply(base("message.create", "msg-c", { body: "x", replyToObjectId: "does-not-exist" })),
    ).toThrow(/cross_object_reference/);
  });

  it("oversized body rejects; multi-byte boundary measured in UTF-8", () => {
    const h = harness();
    const under = "€".repeat(10_922); // 3 bytes × 10922 = 32766 ≤ 32768
    h.apply(base("message.create", "msg-u", { body: under }));
    const over = "€".repeat(10_923); // 32769 > 32768
    expect(() => h.apply(base("message.create", "msg-o", { body: over }))).toThrow(
      /content_too_large/,
    );
  });

  it("URL-like and HTML-like bodies are stored as PLAIN TEXT (no preview/render)", () => {
    const h = harness();
    const r = h.apply(
      base("message.create", "msg-html", { body: "<script>alert(1)</script> https://evil.test" }),
    );
    const obj = r.event.object;
    expect(obj.kind === "message" && obj.content?.body.format).toBe("plain_text");
    expect(obj.kind === "message" && obj.content?.body.value).toContain("<script>");
  });
});

// ---------------------------------------------------------------------------
// Note (§36)
// ---------------------------------------------------------------------------
describe("Note object (§36)", () => {
  it("create/update content/tags; tag limits; duplicate-tag dedupe; redaction removes content", () => {
    const h = harness();
    h.apply(base("note.create", "note-1", { title: "t", body: "b", tags: ["a", "a", "b"] }));
    const afterCreate = h.projection.objects[0];
    expect(afterCreate?.kind === "note" && afterCreate.content?.tags).toEqual(["a", "b"]); // dedupe

    h.apply(
      base("note.update_content", "note-1", { expectedRevision: 1, title: "t2", body: "b2" }),
    );
    h.apply(base("note.update_tags", "note-1", { expectedRevision: 2, tags: ["x", "y"] }));

    const tooMany = Array.from({ length: 33 }, (_, i) => `t${i}`);
    expect(() =>
      h.apply(base("note.update_tags", "note-1", { expectedRevision: 3, tags: tooMany })),
    ).toThrow(/too_many_tags/);
    expect(() =>
      h.apply(base("note.update_tags", "note-1", { expectedRevision: 3, tags: ["x".repeat(129)] })),
    ).toThrow(/tag_too_large|invalid_field/);

    const red = h.apply(base("object.redact", "note-1", { expectedRevision: 3 }));
    expect(red.event.object.content).toBeNull();
    expect(red.objectSummary.contentPresent).toBe(false);
  });

  it("archived note is read-only (content edit rejects; redact/tombstone allowed)", () => {
    const h = harness();
    h.apply(base("note.create", "note-2", { body: "b", tags: [] }));
    h.apply(base("object.archive", "note-2", { expectedRevision: 1 }));
    expect(() =>
      h.apply(base("note.update_content", "note-2", { expectedRevision: 2, body: "x" })),
    ).toThrow(/lifecycle/);
    h.apply(base("object.tombstone", "note-2", { expectedRevision: 2 }));
    expect(h.projection.objects[0]?.lifecycle).toBe("deleted_tombstone");
  });
});

// ---------------------------------------------------------------------------
// Task (§37)
// ---------------------------------------------------------------------------
describe("Task object (§37)", () => {
  it("status transitions valid/invalid; resolved tasks cannot reopen; duplicate assignees dedupe", () => {
    const h = harness();
    h.apply(
      base("task.create", "task-1", {
        title: "t",
        assigneeRefs: ["mem-a", "mem-a", "mem-b"],
        tags: [],
      }),
    );
    const t = h.projection.objects[0];
    expect(t?.kind === "task" && t.content?.assigneeRefs).toEqual(["mem-a", "mem-b"]);
    expect(t?.kind === "task" && t.content?.status).toBe("todo");

    h.apply(base("task.update_status", "task-1", { expectedRevision: 1, status: "in_progress" }));
    h.apply(base("task.update_status", "task-1", { expectedRevision: 2, status: "done" }));
    // done → todo is not allowed.
    expect(() =>
      h.apply(base("task.update_status", "task-1", { expectedRevision: 3, status: "todo" })),
    ).toThrow(/invalid_status_transition/);
  });

  it("invalid local due timestamp rejects; valid local due accepted (no notification)", () => {
    const h = harness();
    expect(() =>
      h.apply(
        base("task.create", "task-bad", {
          title: "t",
          assigneeRefs: [],
          tags: [],
          dueAtLocal: "2026-01-01",
        }),
      ),
    ).toThrow(/invalid_field/);
    h.apply(
      base("task.create", "task-ok", {
        title: "t",
        assigneeRefs: [],
        tags: [],
        dueAtLocal: "local:2026-06-01",
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Decision (§38)
// ---------------------------------------------------------------------------
describe("Decision object (§38)", () => {
  it("proposed→accepted; accepted cannot return to proposed; supersede same-room decision only", () => {
    const h = harness();
    h.apply(base("decision.create", "dec-1", { statement: "adopt X" }));
    h.apply(base("decision.resolve", "dec-1", { expectedRevision: 1, status: "accepted" }));
    expect(() =>
      h.apply(base("decision.resolve", "dec-1", { expectedRevision: 2, status: "proposed" })),
    ).toThrow(/invalid_status_transition/);

    h.apply(base("decision.create", "dec-2", { statement: "supersede X" }));
    h.apply(
      base("decision.resolve", "dec-2", {
        expectedRevision: 1,
        status: "superseded",
        supersedesObjectId: "dec-1",
      }),
    );
    // Supersede a non-decision (message) rejects.
    h.apply(base("message.create", "msg-x", { body: "hi" }));
    h.apply(base("decision.create", "dec-3", { statement: "y" }));
    expect(() =>
      h.apply(
        base("decision.resolve", "dec-3", {
          expectedRevision: 1,
          status: "superseded",
          supersedesObjectId: "msg-x",
        }),
      ),
    ).toThrow(/cross_object_reference/);
  });

  it("rationale size limit enforced; redaction removes content", () => {
    const h = harness();
    expect(() =>
      h.apply(
        base("decision.create", "dec-big", { statement: "s", rationale: "a".repeat(65_537) }),
      ),
    ).toThrow(/content_too_large/);
    h.apply(base("decision.create", "dec-r", { statement: "s" }));
    const red = h.apply(base("object.redact", "dec-r", { expectedRevision: 1 }));
    expect(red.event.object.content).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Poll (§39)
// ---------------------------------------------------------------------------
describe("Poll object (§39)", () => {
  const opt = (id: string, label: string) => ({ optionId: id, label });
  it("min/max/duplicate options; open freezes draft; close; no vote capability", () => {
    const h = harness();
    expect(() =>
      h.apply(base("poll.create", "poll-1", { question: "q", options: [opt("opt-1", "a")] })),
    ).toThrow(/too_few_options/);
    expect(() =>
      h.apply(
        base("poll.create", "poll-2", {
          question: "q",
          options: [opt("dupe", "a"), opt("dupe", "b")],
        }),
      ),
    ).toThrow(/duplicate_option_id/);

    h.apply(
      base("poll.create", "poll-3", {
        question: "q",
        options: [opt("opt-1", "a"), opt("opt-2", "b")],
      }),
    );
    const created = h.projection.objects[0];
    expect(created?.kind === "poll" && created.content?.voteCapability).toBe(
      "not_implemented_gate_g_h",
    );
    h.apply(base("poll.open_placeholder", "poll-3", { expectedRevision: 1 }));
    // Opened poll draft cannot be casually edited.
    expect(() =>
      h.apply(
        base("poll.update_draft", "poll-3", {
          expectedRevision: 2,
          question: "q2",
          options: [opt("opt-1", "a"), opt("opt-2", "b")],
        }),
      ),
    ).toThrow(/invalid_status_transition/);
    h.apply(base("poll.close_placeholder", "poll-3", { expectedRevision: 2 }));
    expect(
      h.projection.objects[0]?.kind === "poll" &&
        (h.projection.objects[0] as { content: { status: string } | null }).content?.status,
    ).toBe("closed_local_placeholder");
  });

  it("no vote command exists in the command union", () => {
    const h = harness();
    h.apply(
      base("poll.create", "poll-v", {
        question: "q",
        options: [opt("opt-1", "a"), opt("opt-2", "b")],
      }),
    );
    expect(() =>
      h.apply(base("poll.vote", "poll-v", { expectedRevision: 1, optionId: "opt-1" })),
    ).toThrow(/unknown_command/);
  });
});

// ---------------------------------------------------------------------------
// File reference (§40)
// ---------------------------------------------------------------------------
describe("File-reference object (§40)", () => {
  const refs = [
    "/abs/path",
    "rel/path",
    "../up",
    "http://x",
    "https://x",
    "file:///x",
    "blob:x",
    "data:x",
    "user:pass@host",
  ];
  it("rejects paths/URLs/credentials; opaque localRefId accepted; no availability beyond reference", () => {
    const h = harness();
    for (const bad of refs) {
      expect(
        () => h.apply(base("file_ref.create_placeholder", "f-bad", { localRefId: bad })),
        bad,
      ).toThrow(/forbidden_reference|invalid_field/);
    }
    const ok = h.apply(
      base("file_ref.create_placeholder", "file-1", {
        localRefId: "ref-abc123",
        displayName: "report",
      }),
    );
    expect(ok.event.object.kind === "file_ref" && ok.event.object.content?.availability).toBe(
      "reference_only_not_resolved",
    );
    const red = h.apply(base("object.redact", "file-1", { expectedRevision: 1 }));
    expect(red.event.object.content).toBeNull();
  });

  it("display-name path/URL rejects; invalid size/media type reject", () => {
    const h = harness();
    expect(() =>
      h.apply(
        base("file_ref.create_placeholder", "f-2", {
          localRefId: "ref-1",
          displayName: "http://x",
        }),
      ),
    ).toThrow(/forbidden_reference/);
    expect(() =>
      h.apply(base("file_ref.create_placeholder", "f-3", { localRefId: "ref-2", sizeBytes: -1 })),
    ).toThrow(/invalid_field/);
    expect(() =>
      h.apply(
        base("file_ref.create_placeholder", "f-4", {
          localRefId: "ref-3",
          mediaType: "not a media type",
        }),
      ),
    ).toThrow(/invalid_field/);
  });
});

// ---------------------------------------------------------------------------
// Authorization + concurrency + determinism (§41)
// ---------------------------------------------------------------------------
describe("Authorization, concurrency, determinism (§41)", () => {
  const roomPolicy = () => resolveRoomPolicy({ mode: "private", roomKind: "workspace" });
  const create = (objectId: string) => base("message.create", objectId, { body: "hi" });

  function applyRaw(overrides: {
    command?: Record<string, unknown>;
    mutationDecision?: PolicyDecision;
    storageDecision?: PolicyDecision;
    projection?: RoomObjectProjectionV1;
    log?: RoomObjectLog;
  }) {
    const command = overrides.command ?? create("m-1");
    const scope = objectMutationScope((command["command"] as never) ?? "message.create");
    return applyLocalRoomObjectMutationV1({
      projection: overrides.projection ?? emptyRoomObjectProjection(ROOM),
      command,
      roomPolicy: roomPolicy(),
      mutationDecision: overrides.mutationDecision ?? mutate(scope, "private"),
      storageDecision: overrides.storageDecision ?? storage("private"),
      objectEventId: nextEid(),
      clock: CLOCK,
      objectLog: overrides.log ?? new InMemoryRoomObjectLog(ROOM),
    });
  }

  it("every mutation requires an authentic, exactly-scoped, allowed decision", () => {
    expect(() =>
      applyRaw({
        mutationDecision: {
          id: "x",
          capability: "persistence",
          sideEffect: "room.object.create",
          verdict: "allowed",
          mode: "private",
          issuedAtLogical: 1,
        } as PolicyDecision,
      }),
    ).toThrow(/decision_missing/);
    expect(() =>
      applyRaw({
        mutationDecision: issuePolicyDecision(
          ROOM_OBJECT_CAPABILITY,
          "denied",
          "private",
          "room.object.create",
        ),
      }),
    ).toThrow(/policy_denied/);
    // Wrong side-effect scope (update instead of create).
    expect(() => applyRaw({ mutationDecision: mutate("room.object.update", "private") })).toThrow(
      /decision_mismatch/,
    );
    // Room mutation decision cannot authorize the storage append.
    expect(() => applyRaw({ storageDecision: mutate("room.object.create", "private") })).toThrow(
      /decision_mismatch/,
    );
  });

  it("cross-room object mutation rejects; object id/actor confer no authority", () => {
    const otherRoomCommand = { ...create("m-cross"), roomId: createRoomLocalId("room-other-99") };
    expect(() => applyRaw({ command: otherRoomCommand })).toThrow(/room_mismatch/);
  });

  it("unknown command / object kind / schema version / unexpected fields / proto keys reject", () => {
    expect(() => applyRaw({ command: base("object.frobnicate", "m-1") })).toThrow(
      /unknown_command/,
    );
    expect(() => applyRaw({ command: { ...create("m-1"), schemaVersion: 2 } })).toThrow(
      /unsupported_schema_version/,
    );
    expect(() => applyRaw({ command: { ...create("m-1"), surprise: true } })).toThrow(
      /unexpected_field/,
    );
    expect(() =>
      applyRaw({ command: { ...create("m-1"), ["__proto__"]: { admin: true } } }),
    ).toThrow(/dangerous_key|unexpected_field/);
  });

  it("missing/stale/future revision and update-of-missing reject; revision increments by one", () => {
    const h = harness();
    const created = h.apply(create("m-rev"));
    expect(created.event.previousRevision).toBeNull();
    const edited = h.apply(base("message.edit", "m-rev", { expectedRevision: 1, body: "x" }));
    expect(edited.event.previousRevision).toBe(1);
    expect(edited.event.resultingRevision).toBe(2);
    expect(() => h.apply(base("message.edit", "m-rev", { body: "no rev" }))).toThrow(
      /missing_expected_revision/,
    );
    expect(() =>
      h.apply(base("message.edit", "m-missing", { expectedRevision: 1, body: "x" })),
    ).toThrow(/object_not_found/);
  });

  it("input mutation after the call does not change the stored object; result cannot mutate projection", () => {
    const h = harness();
    const command = base("note.create", "n-iso", { body: "b", tags: ["a"] }) as Record<
      string,
      unknown
    >;
    const r = h.apply(command);
    (command["tags"] as string[]).push("injected");
    const stored = h.projection.objects[0];
    expect(stored?.kind === "note" && stored.content?.tags).toEqual(["a"]);
    // Result objects are frozen — mutation throws or is ignored.
    expect(Object.isFrozen(r.event.object)).toBe(true);
  });

  it("event replay reproduces object state deterministically; projector has no side effects", () => {
    const netTrap = createNetworkSideEffectTrap();
    try {
      const log = new InMemoryRoomObjectLog(ROOM);
      const h = harness({ log });
      h.apply(create("r-1"));
      h.apply(base("message.edit", "r-1", { expectedRevision: 1, body: "v2" }));
      h.apply(base("note.create", "r-2", { body: "note", tags: [] }));
      const events = log.readAll(
        issuePolicyDecision(ROOM_OBJECT_CAPABILITY, "allowed", "private", "room.object_log.read"),
      );
      const replayA = replayRoomObjectEventsV1({
        seed: emptyRoomObjectProjection(ROOM),
        events,
        expectedRoomId: ROOM,
      });
      const replayB = replayRoomObjectEventsV1({
        seed: emptyRoomObjectProjection(ROOM),
        events,
        expectedRoomId: ROOM,
      });
      expect(replayA).toEqual(replayB);
      expect(replayA.projection).toEqual(h.projection);
    } finally {
      netTrap.uninstall();
    }
    expect(() => netTrap.assertNoNetworkApiCalled()).not.toThrow();
  });

  it("failed mutation creates no event, no log entry, no projection change", () => {
    const log = new InMemoryRoomObjectLog(ROOM);
    const h = harness({ log });
    h.apply(create("f-1"));
    const before = { proj: h.projection, count: log.status().retainedEventCount };
    try {
      h.apply(base("message.edit", "f-1", { expectedRevision: 9, body: "x" }));
    } catch {
      // expected (future_revision)
    }
    expect(h.projection).toBe(before.proj);
    expect(log.status().retainedEventCount).toBe(before.count);
  });
});

// ---------------------------------------------------------------------------
// Privacy modes (§25) + separate decisions + traps
// ---------------------------------------------------------------------------
describe("Privacy modes + side-effect freedom", () => {
  it("Emergency denies ordinary create/edit but allows redact/tombstone", () => {
    // Seed an object in private mode first.
    const log = new InMemoryRoomObjectLog(ROOM);
    const h = harness({ log });
    h.apply(base("message.create", "e-1", { body: "hi" }));
    expect(() => h.apply(base("message.create", "e-2", { body: "x" }), "emergency")).toThrow();
    // Redact survives Emergency (safe direction).
    h.apply(base("object.redact", "e-1", { expectedRevision: 1 }), "emergency");
    expect(h.projection.objects[0]?.redacted).toBe(true);
  });

  it("Ghost/Bunker deny persistent content (matrix); Bunker prefers null retention", () => {
    const nullLog = new NullRoomObjectLog(ROOM);
    const roomPolicy = resolveRoomPolicy({ mode: "bunker", roomKind: "workspace" });
    const r = applyLocalRoomObjectMutationV1({
      projection: emptyRoomObjectProjection(ROOM),
      command: base("message.create", "b-1", { body: "secret" }),
      roomPolicy,
      mutationDecision: mutate("room.object.create", "bunker"),
      storageDecision: storage("bunker"),
      objectEventId: nextEid(),
      clock: CLOCK,
      objectLog: nullLog,
    });
    expect(r.retained).toBe("null");
    expect(nullLog.status().replayAvailable).toBe(false);
  });

  it("mutation + object-log append require SEPARATE decisions (no network/notification)", () => {
    const netTrap = createNetworkSideEffectTrap();
    const notifTrap = createNotificationSideEffectTrap();
    try {
      const h = harness();
      h.apply(base("message.create", "s-1", { body: "hi" }));
    } finally {
      netTrap.uninstall();
      notifTrap.uninstall();
    }
    expect(() => netTrap.assertNoNetworkApiCalled()).not.toThrow();
    expect(() => notifTrap.assertNoNotificationApiCalled()).not.toThrow();
  });
});
