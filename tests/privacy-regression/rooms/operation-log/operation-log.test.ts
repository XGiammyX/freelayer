/**
 * Privacy-regression (TECH-17): the RoomOS local operation log + deterministic
 * projection. Golden fixtures replay to explicit expected projections; invalid
 * fixtures reject with stable codes and NO partial state; event creation uses
 * injected clock/ID; replay is pure and repeatable; memory/null logs enforce
 * separate exactly-scoped decisions; policy layers agree.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluatePolicyMatrix,
  issuePolicyDecision,
  resolveMetadataPolicy,
  type PolicyDecision,
  type PrivacyMode,
} from "@freelayer/privacy";
import { resolveStoragePolicy } from "@freelayer/storage";
import {
  createAcceptedRoomOperationEventV1,
  createRoomLocalId,
  InMemoryRoomOperationLog,
  NullRoomOperationLog,
  replayRoomOperationEventsV1,
  resolveRoomPolicy,
  ROOM_CAPABILITY,
  ROOM_EVENT_SCHEMA_VERSION,
  ROOM_PROJECTION_VERSION,
  type RoomEventId,
  type RoomLocalSequence,
  type RoomMaterializedState,
  type RoomOperationEventV1,
} from "@freelayer/rooms";
import { createNetworkSideEffectTrap } from "../../../helpers/network-trap";
import { createNotificationSideEffectTrap } from "../../../helpers/notification-trap";

const FIXTURE_DIR = "tests/fixtures/rooms/v1";
const ROOM_ID = createRoomLocalId("room-fixture-01");

interface Fixture {
  meta: { expect: "valid" | "invalid"; errorCode?: string; description: string };
  events: RoomOperationEventV1[];
}

function loadFixture(name: string): Fixture {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8")) as Fixture;
}

function makeSeed(mode: PrivacyMode = "standard"): RoomMaterializedState {
  return {
    roomId: ROOM_ID,
    kind: "workspace",
    lifecycle: "draft",
    mode,
    titleRedacted: false,
    members: [],
    objects: [],
    policy: resolveRoomPolicy({ mode, roomKind: "workspace", lifecycle: "draft" }),
  };
}

function replayFixture(name: string, mode: PrivacyMode = "standard") {
  const fixture = loadFixture(name);
  return replayRoomOperationEventsV1({
    seed: makeSeed(mode),
    events: fixture.events,
    expectedRoomId: ROOM_ID,
  });
}

describe("Golden fixtures — valid sequences (tests 1-2, 20-21)", () => {
  it("room-create → explicit projection", () => {
    const result = replayFixture("room-create.json");
    expect(result.appliedEventCount).toBe(1);
    expect(result.firstLocalSequence).toBe(1);
    expect(result.lastLocalSequence).toBe(1);
    expect(result.state.lifecycle).toBe("active_local");
    expect(result.state.title).toBe("fixture-room");
    expect(result.schemaVersion).toBe(ROOM_EVENT_SCHEMA_VERSION);
    expect(result.projectionVersion).toBe(ROOM_PROJECTION_VERSION);
  });

  it("create-rename / members / objects / archive / seal / emergency / tombstone", () => {
    expect(replayFixture("room-create-rename.json").state.title).toBe("renamed-room");
    const members = replayFixture("room-member-placeholders.json").state;
    expect(members.members.map((m) => m.ref)).toEqual(["member-bbb"]);
    expect(members.members[0]?.displayNameRedacted).toBe(true);
    const objects = replayFixture("room-object-placeholders.json").state;
    expect(objects.objects.map((o) => o.kind)).toEqual(["note", "task"]);
    expect(objects.objects.every((o) => o.redacted)).toBe(true);
    expect(replayFixture("room-archive.json").state.lifecycle).toBe("archived_local");
    expect(replayFixture("room-seal.json").state.lifecycle).toBe("sealed_local");
    expect(replayFixture("room-emergency-lock.json").state.lifecycle).toBe("emergency_locked");
    const tomb = replayFixture("room-delete-tombstone.json").state;
    expect(tomb.lifecycle).toBe("deleted_tombstone");
    expect(tomb.members).toEqual([]);
    expect(tomb.objects).toEqual([]);
  });

  it("same seed/events and repeated replay produce deep-equal projections (tests 20-21)", () => {
    const a = replayFixture("room-member-placeholders.json");
    const b = replayFixture("room-member-placeholders.json");
    expect(a).toEqual(b);
    const fixture = loadFixture("room-object-placeholders.json");
    const cloned = structuredClone(fixture.events);
    const c = replayRoomOperationEventsV1({
      seed: makeSeed(),
      events: fixture.events,
      expectedRoomId: ROOM_ID,
    });
    const d = replayRoomOperationEventsV1({
      seed: makeSeed(),
      events: cloned,
      expectedRoomId: ROOM_ID,
    });
    expect(c).toEqual(d);
  });
});

describe("Golden fixtures — invalid sequences reject with stable codes (tests 3-14, 22-23)", () => {
  const INVALID: readonly [string, string][] = [
    ["invalid-duplicate-event-id.json", "duplicate_event_id"],
    ["invalid-duplicate-sequence.json", "duplicate_local_sequence"],
    ["invalid-sequence-gap.json", "sequence_gap"],
    ["invalid-out-of-order.json", "out_of_order"],
    ["invalid-room-mismatch.json", "room_mismatch"],
    ["invalid-version.json", "unsupported_schema_version"],
    ["invalid-lifecycle-transition.json", "invalid_lifecycle_transition"],
  ];
  for (const [name, code] of INVALID) {
    it(`${name} → ${code}, no partial state`, () => {
      let threw: unknown;
      try {
        replayFixture(name);
      } catch (error) {
        threw = error;
      }
      expect(threw, name).toBeDefined();
      expect((threw as { code?: string }).code, name).toBe(code);
    });
  }

  it("failed replay never mutates the seed (test 23-24)", () => {
    const seed = makeSeed();
    const before = structuredClone(seed);
    try {
      replayRoomOperationEventsV1({
        seed,
        events: loadFixture("invalid-lifecycle-transition.json").events,
        expectedRoomId: ROOM_ID,
      });
    } catch {
      // expected
    }
    expect(seed).toEqual(before);
  });

  it("unknown operation / object kind / bad payload reject (tests 10-12)", () => {
    const base = loadFixture("room-create.json").events[0]!;
    const mutate = (patch: Record<string, unknown>) =>
      replayRoomOperationEventsV1({
        seed: makeSeed(),
        events: [{ ...structuredClone(base), ...patch } as RoomOperationEventV1],
        expectedRoomId: ROOM_ID,
      });
    expect(() => mutate({ operation: "room.teleport" })).toThrow(/unknown_operation/);
    expect(() => mutate({ objectKind: "hologram" })).toThrow(/unknown_object_kind/);
    expect(() => mutate({ payload: { kind: "workspace", extraField: 1 } })).toThrow(
      /invalid_payload/,
    );
    expect(() => mutate({ projectionVersion: 9 })).toThrow(/unsupported_projection_version/);
  });
});

describe("Event creation boundary (tests 16-17)", () => {
  it("uses the injected clock and ID; requires an authentic room decision", () => {
    let clockCalls = 0;
    const clock = {
      nowLocalIso: () => {
        clockCalls += 1;
        return "local:2026-02-02T00:00:00.000Z";
      },
    };
    const decision = issuePolicyDecision(ROOM_CAPABILITY, "allowed", "private", "room.mutate");
    const policy = resolveRoomPolicy({ mode: "private", roomKind: "workspace" });
    const event = createAcceptedRoomOperationEventV1({
      request: {
        operation: "note.create_placeholder",
        roomId: ROOM_ID,
        mode: "private",
        reason: "t",
      },
      roomPolicy: policy,
      roomDecision: decision,
      eventId: "evt-injected-1" as RoomEventId,
      localSequence: 1 as RoomLocalSequence,
      clock,
      typedPayload: { objectId: "obj-x1", kind: "note", redacted: true, sensitivity: "content" },
    });
    expect(clockCalls).toBe(1);
    expect(event.eventId).toBe("evt-injected-1");
    expect(event.createdAtLocal).toBe("local:2026-02-02T00:00:00.000Z");
    expect(Object.isFrozen(event)).toBe(true);

    const forged = { ...decision } as PolicyDecision;
    expect(() =>
      createAcceptedRoomOperationEventV1({
        request: {
          operation: "note.create_placeholder",
          roomId: ROOM_ID,
          mode: "private",
          reason: "t",
        },
        roomPolicy: policy,
        roomDecision: forged,
        eventId: "evt-injected-2" as RoomEventId,
        localSequence: 2 as RoomLocalSequence,
        clock,
        typedPayload: { objectId: "obj-x2", kind: "note", redacted: true, sensitivity: "content" },
      }),
    ).toThrow(/bypass/i);
  });
});

describe("Replay purity (tests 15, 18-19, 24-26, 38)", () => {
  it("no clock/ID/network/notification calls; timestamps do not order events", () => {
    const netTrap = createNetworkSideEffectTrap();
    const notifTrap = createNotificationSideEffectTrap();
    const dateNow = Date.now;
    let nowCalls = 0;
    // eslint-disable-next-line no-restricted-globals
    Date.now = () => {
      nowCalls += 1;
      return dateNow();
    };
    try {
      const fixture = loadFixture("room-create-rename.json");
      // Scramble timestamps: ordering must come from localSequence alone.
      const scrambled = fixture.events.map((event, index) => ({
        ...structuredClone(event),
        createdAtLocal: `local:1999-01-0${index + 1}T00:00:00.000Z`,
      }));
      const result = replayRoomOperationEventsV1({
        seed: makeSeed(),
        events: scrambled,
        expectedRoomId: ROOM_ID,
      });
      expect(result.state.title).toBe("renamed-room");
      expect(nowCalls).toBe(0);
    } finally {
      Date.now = dateNow;
      netTrap.uninstall();
      notifTrap.uninstall();
    }
    expect(() => netTrap.assertNoNetworkApiCalled()).not.toThrow();
    expect(() => notifTrap.assertNoNotificationApiCalled()).not.toThrow();
  });

  it("result mutation does not touch sources; source mutation does not touch result (tests 25-26)", () => {
    const fixture = loadFixture("room-member-placeholders.json");
    const events = structuredClone(fixture.events);
    const result = replayRoomOperationEventsV1({
      seed: makeSeed(),
      events,
      expectedRoomId: ROOM_ID,
    });
    (result.state.members as unknown as unknown[]).push("tampered");
    const again = replayRoomOperationEventsV1({
      seed: makeSeed(),
      events,
      expectedRoomId: ROOM_ID,
    });
    expect(again.state.members.length).toBe(1);
    (events[0] as { payload: { title?: string } }).payload.title = "tampered-title";
    expect(result.state.title).not.toBe("tampered-title");
  });
});

describe("Operation logs (tests 1-2, 27-32)", () => {
  const appendDecision = () =>
    issuePolicyDecision(ROOM_CAPABILITY, "allowed", "private", "room.operation_log.append");
  const readDecision = () =>
    issuePolicyDecision(ROOM_CAPABILITY, "allowed", "private", "room.operation_log.read");
  const clearDecision = () =>
    issuePolicyDecision(ROOM_CAPABILITY, "allowed", "private", "room.operation_log.clear");

  it("memory log: contiguous appends, clone-on-append/read, isolated instances, clear", () => {
    const events = loadFixture("room-member-placeholders.json").events;
    const log = new InMemoryRoomOperationLog(ROOM_ID);
    const other = new InMemoryRoomOperationLog(ROOM_ID);
    for (const event of events) {
      const result = log.append(structuredClone(event), appendDecision());
      expect(result.outcome).toBe("appended_memory");
    }
    // Instances share no state (test 29).
    expect(other.status().retainedEventCount).toBe(0);
    // Mutation after append cannot alter the log (test 27).
    const external = structuredClone(events[0]!);
    (external as { payload: { title?: string } }).payload.title = "tampered";
    // Read clones (test 28): mutating a read result does not alter internals.
    const read = log.readAll(readDecision());
    (read[0] as { payload: { title?: string } }).payload.title = "tampered-read";
    const reread = log.readAll(readDecision());
    expect((reread[0] as { payload: { title?: string } }).payload.title).not.toBe("tampered-read");
    // Status is metadata-only + replay available (test 30).
    const status = log.status();
    expect(status.retainedEventCount).toBe(events.length);
    expect(status.replayAvailable).toBe(true);
    expect(JSON.stringify(status)).not.toContain("member-bbb");
    // Clear removes events.
    expect(log.clear(clearDecision()).removedEventCount).toBe(events.length);
    expect(log.status().retainedEventCount).toBe(0);
  });

  it("memory log rejects duplicates/gaps/out-of-order/foreign rooms (tests 3-7)", () => {
    const events = loadFixture("room-create-rename.json").events;
    const log = new InMemoryRoomOperationLog(ROOM_ID);
    log.append(events[0]!, appendDecision());
    expect(() => log.append(events[0]!, appendDecision())).toThrow(/duplicate_event_id/);
    const gap = { ...structuredClone(events[1]!), localSequence: 5 };
    expect(() => log.append(gap as RoomOperationEventV1, appendDecision())).toThrow(/sequence_gap/);
    const foreign = { ...structuredClone(events[1]!), roomId: "room-other-99" };
    expect(() => log.append(foreign as RoomOperationEventV1, appendDecision())).toThrow(
      /room_mismatch/,
    );
  });

  it("null log retains nothing; replay unavailable (tests 31-32)", () => {
    const log = new NullRoomOperationLog(ROOM_ID);
    const event = loadFixture("room-create.json").events[0]!;
    const result = log.append(event, appendDecision());
    expect(result.outcome).toBe("discarded_by_null_policy");
    expect(result.retained).toBe(false);
    expect(log.readAll(readDecision())).toEqual([]);
    const status = log.status();
    expect(status.retainedEventCount).toBe(0);
    expect(status.replayAvailable).toBe(false);
  });
});

describe("Separate decisions + policy agreement (tests 33-41, 48-50)", () => {
  it("room decision cannot authorize log append and vice versa (tests 39-41)", () => {
    const log = new InMemoryRoomOperationLog(ROOM_ID);
    const event = loadFixture("room-create.json").events[0]!;
    const roomDecision = issuePolicyDecision(ROOM_CAPABILITY, "allowed", "private", "room.mutate");
    expect(() => log.append(event, roomDecision)).toThrow(/mismatch/i);
    const auditDecision = issuePolicyDecision(ROOM_CAPABILITY, "allowed", "private", "room.audit");
    expect(() => log.append(event, auditDecision)).toThrow(/mismatch/i);
    const appendDecision = issuePolicyDecision(
      ROOM_CAPABILITY,
      "allowed",
      "private",
      "room.operation_log.append",
    );
    // An append decision must not read either.
    expect(() => log.readAll(appendDecision)).toThrow(/mismatch/i);
  });

  it("Ghost/Bunker deny persistent log/projection; Emergency denies mutation; matrix agrees (tests 33-37, 48-49)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const policy = resolveRoomPolicy({ mode, roomKind: "workspace" });
      expect(policy.allowOperationLogPersistence, mode).toBe(false);
      expect(policy.allowPersistentProjection, mode).toBe(false);
      expect(
        evaluatePolicyMatrix({ mode, domain: "room", operation: "room.operation_log.persist" })
          .allowed,
      ).toBe(false);
      expect(
        resolveStoragePolicy({ mode, dataClass: "room_operation_log", sensitivity: "content" })
          .persistentAllowed,
      ).toBe(false);
    }
    expect(
      evaluatePolicyMatrix({ mode: "emergency", domain: "room", operation: "room.mutate" }).allowed,
    ).toBe(false);
    expect(
      evaluatePolicyMatrix({ mode: "emergency", domain: "room", operation: "room.replay" }).allowed,
    ).toBe(false);
    // Log clear stays available in Emergency (wipe direction).
    expect(
      evaluatePolicyMatrix({
        mode: "emergency",
        domain: "room",
        operation: "room.operation_log.clear",
      }).allowed,
    ).toBe(true);
    // Snapshot future gate.
    expect(
      evaluatePolicyMatrix({ mode: "standard", domain: "room", operation: "room.project.snapshot" })
        .effect,
    ).toBe("future_gate");
  });

  it("MetadataPolicy agrees: log metadata is memory-only, activity signals denied (test 50)", () => {
    for (const mode of ["private", "ghost", "bunker"] as const) {
      expect(resolveMetadataPolicy({ mode, event: "room.activity", sink: "ui" }).allowed).toBe(
        false,
      );
      expect(
        resolveMetadataPolicy({
          mode,
          event: "audit_event.write",
          sink: "local_persistent_storage",
        }).allowed,
      ).toBe(false);
    }
  });
});

describe("Deterministic generated sequences (§34)", () => {
  // A tiny deterministic generator — no property-testing dependency.
  const SCENARIOS: readonly (readonly RoomOperationEventV1[])[] = readdirSync(FIXTURE_DIR)
    .filter((name) => name.startsWith("room-"))
    .sort()
    .map((name) => loadFixture(name).events);

  it("every valid scenario replays twice to deep-equal results with no side effects", () => {
    const netTrap = createNetworkSideEffectTrap();
    try {
      for (const events of SCENARIOS) {
        const one = replayRoomOperationEventsV1({
          seed: makeSeed(),
          events,
          expectedRoomId: ROOM_ID,
        });
        const two = replayRoomOperationEventsV1({
          seed: makeSeed(),
          events: structuredClone(events),
          expectedRoomId: ROOM_ID,
        });
        expect(two).toEqual(one);
      }
    } finally {
      netTrap.uninstall();
    }
    expect(() => netTrap.assertNoNetworkApiCalled()).not.toThrow();
  });

  it("deterministic invalid variants all reject (dup/missing-first/gap/swap/wrong-room/after-tombstone)", () => {
    const base = loadFixture("room-create-rename.json").events;
    const variants: readonly RoomOperationEventV1[][] = [
      [base[0]!, base[0]!], // duplicate event
      [base[1]!], // missing sequence 1 (complete replay starts at 1)
      [base[0]!, { ...structuredClone(base[1]!), localSequence: 4 } as RoomOperationEventV1], // gap
      [base[1]!, base[0]!], // swapped events
      [{ ...structuredClone(base[0]!), roomId: "room-other-99" } as RoomOperationEventV1], // wrong room
      [
        ...loadFixture("room-delete-tombstone.json").events,
        {
          ...structuredClone(base[1]!),
          localSequence: 3,
          eventId: "evt-9999",
        } as RoomOperationEventV1,
      ], // operation after tombstone
    ];
    let rejected = 0;
    for (const events of variants) {
      try {
        replayRoomOperationEventsV1({ seed: makeSeed(), events, expectedRoomId: ROOM_ID });
      } catch {
        rejected += 1;
      }
    }
    expect(rejected).toBe(variants.length);
  });
});
