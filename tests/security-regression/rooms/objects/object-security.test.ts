/**
 * Security-regression (TECH-18): the object model never leaks content and can't
 * be bypassed. The sentinel never reaches errors/summaries/status/replay/logs;
 * prototype-pollution + generic patches + accessor payloads are rejected; no
 * network/notification/storage/filesystem API is touched; the guardrail catches
 * representative violations; the rooms package imports nothing forbidden.
 * Covers §41-45.
 */
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  applyLocalRoomObjectMutationV1,
  createRoomLocalId,
  emptyRoomObjectProjection,
  InMemoryRoomObjectLog,
  objectMutationScope,
  resolveRoomPolicy,
  ROOM_OBJECT_CAPABILITY,
  validateRoomObjectMutationCommandV1,
} from "@freelayer/rooms";
import { issuePolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import { createNetworkSideEffectTrap } from "../../../helpers/network-trap";
import { createNotificationSideEffectTrap } from "../../../helpers/notification-trap";
import { createPersistentWriteTrap } from "../../../helpers/persistent-write-trap";

const SENTINEL = "FREELAYER_ROOM_OBJECT_SENTINEL_DO_NOT_LEAK";
const ROOM = createRoomLocalId("room-objects-sec");
const CLOCK = { nowLocalIso: () => "local:2026-03-03T00:00:00.000Z" };
let eid = 0;

function apply(
  command: Record<string, unknown>,
  opts?: {
    mode?: PrivacyMode;
    log?: InMemoryRoomObjectLog;
    projection?: ReturnType<typeof emptyRoomObjectProjection>;
  },
) {
  const mode = opts?.mode ?? "private";
  const scope = objectMutationScope((command["command"] as never) ?? "message.create");
  return applyLocalRoomObjectMutationV1({
    projection: opts?.projection ?? emptyRoomObjectProjection(ROOM),
    command,
    roomPolicy: resolveRoomPolicy({ mode, roomKind: "workspace" }),
    mutationDecision: issuePolicyDecision(ROOM_OBJECT_CAPABILITY, "allowed", mode, scope),
    storageDecision: issuePolicyDecision(
      ROOM_OBJECT_CAPABILITY,
      "allowed",
      mode,
      "room.object_log.append",
    ),
    objectEventId: `sec-${(eid += 1)}`,
    clock: CLOCK,
    objectLog: opts?.log ?? new InMemoryRoomObjectLog(ROOM),
  });
}

const cmd = (command: string, objectId: string, extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  command,
  roomId: ROOM,
  objectId,
  actorRef: "local_unknown",
  mode: "private",
  reason: "sec",
  ...extra,
});

function errorText(fn: () => void): string {
  try {
    fn();
  } catch (error: unknown) {
    return error instanceof Error
      ? `${error.name}: ${error.message} ${error.stack ?? ""}`
      : String(error);
  }
  throw new Error("expected throw");
}

describe("Content never leaks (§42)", () => {
  it("validation errors carry codes only — no sentinel body/title/filename", () => {
    // Oversized sentinel body → content_too_large, no echo.
    const big = cmd("message.create", "leak-1", { body: SENTINEL.repeat(2_000) });
    const t1 = errorText(() => validateRoomObjectMutationCommandV1(big));
    expect(t1).not.toContain(SENTINEL);
    expect(t1).toContain("content_too_large");
    // Forbidden file reference bearing the sentinel.
    const t2 = errorText(() =>
      validateRoomObjectMutationCommandV1(
        cmd("file_ref.create_placeholder", "leak-2", { localRefId: `https://${SENTINEL}` }),
      ),
    );
    expect(t2).not.toContain(SENTINEL);
  });

  it("summaries/status/replay reports never contain content", () => {
    const log = new InMemoryRoomObjectLog(ROOM);
    const r = apply(cmd("note.create", "leak-n", { title: SENTINEL, body: SENTINEL, tags: [] }), {
      log,
    });
    expect(JSON.stringify(r.objectSummary)).not.toContain(SENTINEL);
    expect(JSON.stringify(log.status())).not.toContain(SENTINEL);
    expect(JSON.stringify(r.event.resultingRevision)).not.toContain(SENTINEL);
    // The event/projection DO hold content in memory (that is the point); a
    // metadata SUMMARY must not. Content presence is a boolean only.
    expect(r.objectSummary).not.toHaveProperty("content");
  });

  it("console output during mutation carries no content", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      apply(cmd("message.create", "leak-c", { body: SENTINEL }));
      const joined = [...spy.mock.calls, ...errSpy.mock.calls].flat().join(" ");
      expect(joined).not.toContain(SENTINEL);
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });
});

describe("No bypass (§41, §24)", () => {
  it("prototype-pollution keys and generic patch commands reject", () => {
    expect(() =>
      validateRoomObjectMutationCommandV1(
        cmd("message.create", "p-1", { ["__proto__"]: { admin: true }, body: "x" }),
      ),
    ).toThrow(/dangerous_key|unexpected_field/);
    for (const generic of [
      "object.patch",
      "object.update_any",
      "set_property",
      "merge_payload",
      "json_patch",
    ]) {
      expect(() => validateRoomObjectMutationCommandV1(cmd(generic, "p-2", {}))).toThrow(
        /unknown_command/,
      );
    }
  });

  it("accessor/getter payloads do not execute; unexpected fields reject", () => {
    let getterRan = false;
    const hostile = cmd("message.create", "p-3", { body: "hi" });
    Object.defineProperty(hostile, "surprise", {
      enumerable: true,
      get() {
        getterRan = true;
        return SENTINEL;
      },
    });
    // assertOnlyKeys sees the key and rejects before reading its value.
    expect(() => validateRoomObjectMutationCommandV1(hostile)).toThrow(/unexpected_field/);
    expect(getterRan).toBe(false);
  });

  it("object ID and actor ref alone confer no authority (still needs a scoped decision)", () => {
    const noDecision = {
      id: "forged",
      capability: "persistence" as const,
      sideEffect: "room.object.create" as const,
      verdict: "allowed" as const,
      mode: "private" as PrivacyMode,
      issuedAtLogical: 1,
    } as PolicyDecision;
    expect(() =>
      applyLocalRoomObjectMutationV1({
        projection: emptyRoomObjectProjection(ROOM),
        command: cmd("message.create", "auth-1", { body: "x" }),
        roomPolicy: resolveRoomPolicy({ mode: "private", roomKind: "workspace" }),
        mutationDecision: noDecision,
        storageDecision: noDecision,
        objectEventId: "sec-auth",
        clock: CLOCK,
        objectLog: new InMemoryRoomObjectLog(ROOM),
      }),
    ).toThrow(/decision_missing/);
  });
});

describe("No runtime side effects (§43)", () => {
  it("validation + full mutation touch no network/notification/persistent-write API", () => {
    const net = createNetworkSideEffectTrap();
    const notif = createNotificationSideEffectTrap();
    const write = createPersistentWriteTrap();
    try {
      validateRoomObjectMutationCommandV1(cmd("message.create", "eff-1", { body: "hi" }));
      apply(cmd("message.create", "eff-2", { body: "hi" }));
      apply(cmd("object.redact", "eff-2", { expectedRevision: 1 }), {
        projection: apply(cmd("message.create", "eff-2", { body: "hi" })).nextProjection,
      });
    } finally {
      net.uninstall();
      notif.uninstall();
      write.uninstall();
    }
    expect(() => net.assertNoNetworkApiCalled()).not.toThrow();
    expect(() => notif.assertNoNotificationApiCalled()).not.toThrow();
    expect(() => write.assertNoPersistentApiCalled()).not.toThrow();
  });
});

describe("Guardrail + import hygiene (§44-45)", () => {
  it("check:no-room-object-bypass flags the fixture and passes real source", () => {
    const bad = spawnSync(
      process.execPath,
      ["scripts/check-no-room-object-bypass.mjs", "tests/fixtures/room-object-bypass"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
    expect(bad.status).toBe(1);
    expect(`${bad.stdout}\n${bad.stderr}`).toContain("object.patch");
    const real = spawnSync(process.execPath, ["scripts/check-no-room-object-bypass.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(real.status).toBe(0);
  });

  it("objects/ imports no CRDT/crypto/network/AI/monitoring packages", () => {
    const files = readdirSync("packages/rooms/src/objects").filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const source = readFileSync(`packages/rooms/src/objects/${file}`, "utf8");
      for (const banned of [
        '"yjs"',
        "@automerge",
        '"loro',
        '"@freelayer/crypto"',
        "node:crypto",
        '"@freelayer/ai"',
        '"@freelayer/transports"',
        '"@freelayer/storage"',
        "iohook",
        "robotjs",
      ]) {
        expect(source.includes(banned), `${file} imports ${banned}`).toBe(false);
      }
    }
  });
});
