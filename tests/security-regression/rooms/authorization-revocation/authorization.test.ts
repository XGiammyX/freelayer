/**
 * Security-regression (TECH-21): authorization revalidation cannot be bypassed
 * and never leaks. Prepared contexts are non-authoritative; an authentic exact-
 * scope decision is always required; role comparison is capability-set based;
 * the revocation pipeline enforces owner continuity + no-escalation + no partial
 * effects; reports/errors are content-free; the guardrail catches violations.
 * Covers §22-24, §27, §31 (1-6, 51-75), §32.
 */
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  applyLocalMembershipRevocationV1,
  assertPreparedRoomAuthorizationCurrentV1,
  buildLocalAuthorizationInvalidationReportV1,
  classifyMembershipChangeDirectionV1,
  compareRoleAuthorityV1,
  createRoomLocalId,
  getRoleCapabilitiesV1,
  InMemoryRoomMembershipLog,
  prepareRoomAuthorizationV1,
  resolveRoomPolicy,
  ROOM_MEMBERSHIP_CAPABILITY,
  ROOM_MEMBERSHIP_ROLES,
  type RoomMaterializedState,
  type RoomMembershipRecordV1,
} from "@freelayer/rooms";
import { issuePolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import { createNetworkSideEffectTrap } from "../../../helpers/network-trap";
import { createNotificationSideEffectTrap } from "../../../helpers/notification-trap";
import { createPersistentWriteTrap } from "../../../helpers/persistent-write-trap";

const SENTINEL = "FREELAYER_REVOCATION_SENTINEL_DO_NOT_LEAK";
const ROOM = createRoomLocalId("room-authz-sec");

const rec = (over: Record<string, unknown> = {}): RoomMembershipRecordV1 =>
  Object.freeze({
    schemaVersion: 1,
    membershipId: "mem-owner-1",
    roomId: ROOM,
    memberRef: "member-owner",
    role: "owner_placeholder",
    state: "active_local_unverified",
    revision: 1,
    origin: "local_room_bootstrap",
    verification: "unverified_placeholder",
    createdAtLocal: "local:2026-05-01T00:00:00.000Z",
    updatedAtLocal: "local:2026-05-01T00:00:00.000Z",
    ...over,
  }) as RoomMembershipRecordV1;

function state(
  records: readonly RoomMembershipRecordV1[],
  mode: PrivacyMode = "standard",
): RoomMaterializedState {
  return {
    roomId: ROOM,
    kind: "workspace",
    lifecycle: "active_local",
    mode,
    titleRedacted: true,
    members: [],
    objects: [],
    policy: resolveRoomPolicy({ mode, roomKind: "workspace" }),
    membershipRecords: records,
  };
}
const decision = (scope: PolicyDecision["sideEffect"], mode: PrivacyMode = "standard") =>
  issuePolicyDecision(ROOM_MEMBERSHIP_CAPABILITY, "allowed", mode, scope);

function preparedObjectCreate(owner = rec()) {
  const rs = state([owner]);
  return prepareRoomAuthorizationV1({
    roomState: rs,
    membership: owner,
    requestedCapability: "room.object.create",
    requiredSideEffect: "room.object.create",
    roomPolicy: rs.policy,
    objectId: "obj-0001" as never,
    objectKind: "message",
  });
}

function errorText(fn: () => void): string {
  try {
    fn();
  } catch (e: unknown) {
    return e instanceof Error ? `${e.name}: ${e.message} ${e.stack ?? ""}` : String(e);
  }
  throw new Error("expected throw");
}

describe("Prepared context is non-authoritative (§31: 1-6)", () => {
  it("requires an authentic exact-scope decision; fake/denied/wrong-scope reject", () => {
    const owner = rec();
    const prepared = preparedObjectCreate(owner);
    const reval = (d: PolicyDecision) =>
      assertPreparedRoomAuthorizationCurrentV1({
        prepared,
        currentRoomState: state([owner]),
        currentMembership: owner,
        currentRoomPolicy: state([owner]).policy,
        decision: d,
        actualRequiredCapability: "room.object.create",
        actualSideEffect: "room.object.create",
        actualObjectId: "obj-0001" as never,
        actualObjectKind: "message",
      });
    // Forged (non-provenance) decision.
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "room.object.create",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    } as PolicyDecision;
    expect(() => reval(forged)).toThrow(/decision_missing/);
    expect(() =>
      reval(
        decision("room.object.create") &&
          issuePolicyDecision(
            ROOM_MEMBERSHIP_CAPABILITY,
            "denied",
            "standard",
            "room.object.create",
          ),
      ),
    ).toThrow(/decision_mismatch/);
    expect(() => reval(decision("room.object.update"))).toThrow(/decision_mismatch/);
    // Authentic exact-scope → passes.
    expect(() => reval(decision("room.object.create"))).not.toThrow();
  });
});

describe("Role capability-set comparison (§17, §31: 63-66)", () => {
  it("covers every role pair via capability sets, not names", () => {
    for (const from of ROOM_MEMBERSHIP_ROLES) {
      for (const to of ROOM_MEMBERSHIP_ROLES) {
        const cmp = compareRoleAuthorityV1(from, to);
        expect(["narrower", "wider", "equal", "incomparable"]).toContain(cmp);
        if (from === to) expect(cmp).toBe("equal");
      }
    }
    // Owner is wider than editor/viewer/auditor (superset).
    expect(compareRoleAuthorityV1("editor_placeholder", "owner_placeholder")).toBe("wider");
    expect(compareRoleAuthorityV1("owner_placeholder", "viewer_placeholder")).toBe("narrower");
    // Viewer set ⊂ editor set → viewer→editor is wider.
    expect(compareRoleAuthorityV1("viewer_placeholder", "editor_placeholder")).toBe("wider");
    // Auditor vs viewer: different sets → incomparable.
    expect(compareRoleAuthorityV1("auditor_placeholder", "viewer_placeholder")).toBe(
      "incomparable",
    );
    // Sets are non-empty.
    expect(getRoleCapabilitiesV1("owner_placeholder").size).toBeGreaterThan(0);
  });

  it("change-direction classifier: downgrade restrictive, elevation expansive, incomparable unknown", () => {
    const owner = rec();
    expect(
      classifyMembershipChangeDirectionV1(
        {
          schemaVersion: 1,
          command: "membership.suspend_local",
          roomId: ROOM,
          mode: "standard",
          reason: "x",
          membershipId: "m",
          expectedRevision: 1,
        } as never,
        owner,
      ),
    ).toBe("restrictive");
    const editor = rec({ role: "editor_placeholder" });
    expect(
      classifyMembershipChangeDirectionV1(
        {
          schemaVersion: 1,
          command: "membership.change_role",
          roomId: ROOM,
          mode: "standard",
          reason: "x",
          membershipId: "m",
          newRole: "viewer_placeholder",
          expectedRevision: 1,
        } as never,
        editor,
      ),
    ).toBe("restrictive");
    expect(
      classifyMembershipChangeDirectionV1(
        {
          schemaVersion: 1,
          command: "membership.change_role",
          roomId: ROOM,
          mode: "standard",
          reason: "x",
          membershipId: "m",
          newRole: "owner_placeholder",
          expectedRevision: 1,
        } as never,
        editor,
      ),
    ).toBe("expansive");
  });
});

describe("Revocation pipeline (§18, §23, §31: 33, 43-58)", () => {
  const ownerA = rec({ membershipId: "mem-oa", memberRef: "member-a" });
  const ownerB = rec({ membershipId: "mem-ob", memberRef: "member-b" });
  const editor = rec({ membershipId: "mem-e", memberRef: "member-e", role: "editor_placeholder" });

  function suspend(
    target: RoomMembershipRecordV1,
    actor: RoomMembershipRecordV1,
    records: readonly RoomMembershipRecordV1[],
  ) {
    const rs = state(records);
    const prepared = prepareRoomAuthorizationV1({
      roomState: rs,
      membership: actor,
      requestedCapability: "room.membership.suspend",
      requiredSideEffect: "room.membership.suspend",
      roomPolicy: rs.policy,
      targetMembership: target,
    });
    return applyLocalMembershipRevocationV1({
      roomState: rs,
      command: {
        schemaVersion: 1,
        command: "membership.suspend_local",
        roomId: ROOM,
        mode: "standard",
        reason: "x",
        membershipId: target.membershipId,
        expectedRevision: target.revision,
      } as never,
      preparedAuthorization: prepared,
      decision: decision("room.membership.suspend"),
      storageDecision: decision("room.membership_log.append"),
      roomPolicy: rs.policy,
      eventId: "evt-1" as never,
      localSequence: 1 as never,
      clock: { nowLocalIso: () => "local:2026-05-02T00:00:00.000Z" },
      operationLog: new InMemoryRoomMembershipLog(ROOM),
    });
  }

  it("suspends an editor and reports the invalidated revision", () => {
    const r = suspend(editor, ownerA, [ownerA, editor]);
    expect(r.membership.state).toBe("suspended_local");
    expect(r.invalidatedMembershipRevision).toBe(1);
    expect(r.membership.revision).toBe(2);
  });

  it("last active owner suspension rejects at execution (§23)", () => {
    expect(() => suspend(ownerA, ownerA, [ownerA])).toThrow(/last_owner_continuity/);
    // With a second owner it is allowed.
    expect(() => suspend(ownerA, ownerB, [ownerA, ownerB])).not.toThrow();
  });

  it("a restrictive command carrying an expansive role change rejects (§16)", () => {
    const rs = state([ownerA, editor]);
    const prepared = prepareRoomAuthorizationV1({
      roomState: rs,
      membership: ownerA,
      requestedCapability: "room.membership.change_role",
      requiredSideEffect: "room.membership.change_role",
      roomPolicy: rs.policy,
      targetMembership: editor,
    });
    expect(() =>
      applyLocalMembershipRevocationV1({
        roomState: rs,
        command: {
          schemaVersion: 1,
          command: "membership.change_role",
          roomId: ROOM,
          mode: "standard",
          reason: "x",
          membershipId: editor.membershipId,
          newRole: "owner_placeholder",
          expectedRevision: 1,
        } as never,
        preparedAuthorization: prepared,
        decision: decision("room.membership.change_role"),
        storageDecision: decision("room.membership_log.append"),
        roomPolicy: rs.policy,
        eventId: "evt-2" as never,
        localSequence: 1 as never,
        clock: { nowLocalIso: () => "local:x" },
        operationLog: new InMemoryRoomMembershipLog(ROOM),
      }),
    ).toThrow(/restrictive_operation_escalation/);
  });

  it("failed revocation creates no event/log entry (§31: 51-52)", () => {
    const log = new InMemoryRoomMembershipLog(ROOM);
    const rs = state([ownerA]);
    const prepared = prepareRoomAuthorizationV1({
      roomState: rs,
      membership: ownerA,
      requestedCapability: "room.membership.suspend",
      requiredSideEffect: "room.membership.suspend",
      roomPolicy: rs.policy,
      targetMembership: ownerA,
    });
    try {
      applyLocalMembershipRevocationV1({
        roomState: rs,
        command: {
          schemaVersion: 1,
          command: "membership.suspend_local",
          roomId: ROOM,
          mode: "standard",
          reason: "x",
          membershipId: ownerA.membershipId,
          expectedRevision: 1,
        } as never,
        preparedAuthorization: prepared,
        decision: decision("room.membership.suspend"),
        storageDecision: decision("room.membership_log.append"),
        roomPolicy: rs.policy,
        eventId: "evt-3" as never,
        localSequence: 1 as never,
        clock: { nowLocalIso: () => "local:x" },
        operationLog: log,
      });
    } catch {
      // expected (last owner)
    }
    expect(log.status().retainedEventCount).toBe(0);
  });
});

describe("No side effects + leak-freedom (§31: 55-58, §32)", () => {
  it("revalidation touches no network/notification/persistent-write API", () => {
    const net = createNetworkSideEffectTrap();
    const notif = createNotificationSideEffectTrap();
    const write = createPersistentWriteTrap();
    const owner = rec();
    const prepared = preparedObjectCreate(owner);
    try {
      assertPreparedRoomAuthorizationCurrentV1({
        prepared,
        currentRoomState: state([owner]),
        currentMembership: owner,
        currentRoomPolicy: state([owner]).policy,
        decision: decision("room.object.create"),
        actualRequiredCapability: "room.object.create",
        actualSideEffect: "room.object.create",
        actualObjectId: "obj-0001" as never,
        actualObjectKind: "message",
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

  it("stale-context errors and reports never carry the sentinel (§32)", () => {
    const owner = rec({ memberRef: SENTINEL as never });
    const prepared = preparedObjectCreate(owner);
    const suspended = rec({
      memberRef: SENTINEL as never,
      state: "suspended_local",
      revision: 2 as never,
    });
    const text = errorText(() =>
      assertPreparedRoomAuthorizationCurrentV1({
        prepared,
        currentRoomState: state([suspended]),
        currentMembership: suspended,
        currentRoomPolicy: state([suspended]).policy,
        decision: decision("room.object.create"),
        actualRequiredCapability: "room.object.create",
        actualSideEffect: "room.object.create",
        actualObjectId: "obj-0001" as never,
        actualObjectKind: "message",
      }),
    );
    expect(text).not.toContain(SENTINEL);
    // The invalidation report is content-free and says local-only.
    const report = buildLocalAuthorizationInvalidationReportV1({
      cause: "membership_suspended",
      invalidatedRevision: 1,
    });
    const s = JSON.stringify(report);
    expect(s).not.toContain(SENTINEL);
    expect(report.scope).toBe("current_local_projection_only");
    expect(report.distributedRevocation).toBe(false);
  });

  it("console output during revalidation carries no sentinel", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const owner = rec({ memberRef: SENTINEL as never });
    const prepared = preparedObjectCreate(owner);
    try {
      try {
        assertPreparedRoomAuthorizationCurrentV1({
          prepared,
          currentRoomState: state([rec({ memberRef: SENTINEL as never, revision: 5 as never })]),
          currentMembership: rec({ memberRef: SENTINEL as never, revision: 5 as never }),
          currentRoomPolicy: state([owner]).policy,
          decision: decision("room.object.create"),
          actualRequiredCapability: "room.object.create",
          actualSideEffect: "room.object.create",
          actualObjectId: "obj-0001" as never,
          actualObjectKind: "message",
        });
      } catch {
        // expected
      }
      expect(spy.mock.calls.flat().join(" ")).not.toContain(SENTINEL);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("Guardrail + import hygiene (§33, §35)", () => {
  it("check:no-room-authorization-bypass flags the fixture and passes real source", () => {
    const bad = spawnSync(
      process.execPath,
      [
        "scripts/check-no-room-authorization-bypass.mjs",
        "tests/fixtures/room-authorization-bypass",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(bad.status).toBe(1);
    expect(`${bad.stdout}\n${bad.stderr}`).toMatch(/authorization bypass pattern|role-string/);
    const real = spawnSync(process.execPath, ["scripts/check-no-room-authorization-bypass.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(real.status).toBe(0);
  });

  it("authorization/ imports no auth/identity/crypto/AI/monitoring packages", () => {
    const files = readdirSync("packages/rooms/src/authorization").filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(`packages/rooms/src/authorization/${file}`, "utf8");
      for (const banned of [
        '"jsonwebtoken"',
        '"jose"',
        '"ucans"',
        "@openfga",
        "@authzed",
        '"did-jwt"',
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
