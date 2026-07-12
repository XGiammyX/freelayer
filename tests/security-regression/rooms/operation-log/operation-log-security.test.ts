/**
 * Security-regression (TECH-17): the operation log never leaks — errors,
 * status, replay reports, and audit stay sentinel-free; cloning isolates
 * mutations; uncloneable payloads reject cleanly; no CRDT/crypto/monitoring
 * imports exist in the rooms package; the guardrail catches determinism and
 * serialization violations.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  createRoomLocalId,
  InMemoryRoomOperationLog,
  replayRoomOperationEventsV1,
  resolveRoomPolicy,
  ROOM_CAPABILITY,
  validateRoomOperationEventV1,
  type RoomMaterializedState,
  type RoomOperationEventV1,
} from "@freelayer/rooms";

const SENTINEL = "FREELAYER_ROOM_LOG_SENTINEL_DO_NOT_LEAK";
const ROOM_ID = createRoomLocalId("room-fixture-01");

function makeSeed(): RoomMaterializedState {
  return {
    roomId: ROOM_ID,
    kind: "workspace",
    lifecycle: "draft",
    mode: "private",
    titleRedacted: false,
    members: [],
    objects: [],
    policy: resolveRoomPolicy({ mode: "private", roomKind: "workspace", lifecycle: "draft" }),
  };
}

function createEvent(seq: number, patch: Record<string, unknown> = {}): RoomOperationEventV1 {
  return {
    schemaVersion: 1,
    projectionVersion: 1,
    eventId: `evt-sec-${seq}`,
    roomId: ROOM_ID,
    localSequence: seq,
    operation: "room.create",
    actor: "local_unknown",
    createdAtLocal: "local:2026-01-01T00:00:00.000Z",
    payloadClass: "placeholder",
    payload: { kind: "workspace", title: SENTINEL },
    ...patch,
  } as unknown as RoomOperationEventV1;
}

function errorText(fn: () => void): string {
  try {
    fn();
  } catch (error: unknown) {
    return error instanceof Error
      ? `${error.name}: ${error.message} ${error.stack ?? ""}`
      : String(error);
  }
  throw new Error("expected the operation to throw");
}

describe("Errors never leak (tests 1-5, 12)", () => {
  it("validation/replay/log errors carry codes, never payloads/titles/aliases/filenames", () => {
    // Sentinel-bearing payload + invalid field → error must not echo anything.
    const bad = createEvent(1, {
      payload: { kind: "workspace", title: SENTINEL, member: "alice-alias", file: "secret.pdf" },
    });
    const text = errorText(() => validateRoomOperationEventV1(bad));
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain("alice-alias");
    expect(text).not.toContain("secret.pdf");
    expect(text).toContain("invalid_payload");

    // Replay error over a sentinel event (bad version) leaks nothing.
    const versioned = createEvent(1, { schemaVersion: 9 });
    const replayText = errorText(() =>
      replayRoomOperationEventsV1({
        seed: makeSeed(),
        events: [versioned],
        expectedRoomId: ROOM_ID,
      }),
    );
    expect(replayText).not.toContain(SENTINEL);
    expect(replayText).toContain("unsupported_schema_version");
  });

  it("uncloneable payloads reject without leaking (tests 11-12)", () => {
    const uncloneable = createEvent(1, {
      payload: { kind: "workspace", title: SENTINEL },
    });
    // Functions are not structured-cloneable.
    (uncloneable as unknown as { payload: Record<string, unknown> }).payload["fn"] = () => SENTINEL;
    const text = errorText(() => validateRoomOperationEventV1(uncloneable));
    expect(text).not.toContain(SENTINEL);
  });
});

describe("Status / replay report / audit stay clean (tests 6-8)", () => {
  it("no sentinel in status or replay report", () => {
    const valid = createEvent(1, { payload: { kind: "workspace", title: SENTINEL } });
    const log = new InMemoryRoomOperationLog(ROOM_ID);
    log.append(
      valid,
      issuePolicyDecision(ROOM_CAPABILITY, "allowed", "private", "room.operation_log.append"),
    );
    expect(JSON.stringify(log.status())).not.toContain(SENTINEL);

    const result = replayRoomOperationEventsV1({
      seed: makeSeed(),
      events: [valid],
      expectedRoomId: ROOM_ID,
    });
    const report = {
      appliedEventCount: result.appliedEventCount,
      firstLocalSequence: result.firstLocalSequence,
      lastLocalSequence: result.lastLocalSequence,
      schemaVersion: result.schemaVersion,
      projectionVersion: result.projectionVersion,
    };
    expect(JSON.stringify(report)).not.toContain(SENTINEL);
    // Private mode shows the title in projected STATE (memory-only) — that is
    // in-memory content, not a report/status/audit surface.
  });
});

describe("Mutation isolation (tests 9-10)", () => {
  it("post-append and post-read mutations cannot alter the log", () => {
    const log = new InMemoryRoomOperationLog(ROOM_ID);
    const event = createEvent(1, { payload: { kind: "workspace" } });
    const append = issuePolicyDecision(
      ROOM_CAPABILITY,
      "allowed",
      "private",
      "room.operation_log.append",
    );
    const read = issuePolicyDecision(
      ROOM_CAPABILITY,
      "allowed",
      "private",
      "room.operation_log.read",
    );
    log.append(event, append);
    (event as unknown as { payload: Record<string, unknown> }).payload["title"] =
      "tampered-after-append";
    const first = log.readAll(read);
    (first[0] as unknown as { payload: Record<string, unknown> }).payload["title"] =
      "tampered-after-read";
    const second = log.readAll(read);
    const payload = (second[0] as unknown as { payload: Record<string, unknown> }).payload;
    expect(payload["title"]).toBeUndefined();
  });

  it("no public API exposes the internal array (test 13)", () => {
    const log = new InMemoryRoomOperationLog(ROOM_ID) as unknown as Record<string, unknown>;
    // Private fields (#events/#eventIds) are not reachable properties.
    expect(Object.keys(log).sort()).toEqual(["retention", "roomId"]);
  });
});

describe("Dependency + import hygiene (tests 18-20)", () => {
  it("rooms package imports no CRDT/crypto/network/monitoring packages", () => {
    // Recursive so subpackages (e.g. objects/, TECH-18) are covered too.
    const files = readdirSync("packages/rooms/src", { recursive: true }) as string[];
    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      const source = readFileSync(`packages/rooms/src/${file}`, "utf8");
      for (const banned of [
        '"yjs"',
        '"automerge"',
        "@automerge",
        "loro",
        '"@freelayer/transports"',
        '"@freelayer/storage"',
        '"@freelayer/crypto"',
        "node:crypto",
        "iohook",
        "robotjs",
      ]) {
        expect(source.includes(banned), `${file} imports ${banned}`).toBe(false);
      }
    }
  });

  it("guardrail catches determinism/serialization fixtures and passes real source (tests 14-17)", () => {
    const fixture = spawnSync(
      process.execPath,
      ["scripts/check-no-roomos-bypass.mjs", "tests/fixtures/roomos-bypass"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(fixture.status).toBe(1);
    expect(`${fixture.stdout}\n${fixture.stderr}`).toContain("JSON.stringify(event");
    const real = spawnSync(process.execPath, ["scripts/check-no-roomos-bypass.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(real.status).toBe(0);
  });
});
