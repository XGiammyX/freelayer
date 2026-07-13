/**
 * Privacy-regression (TECH-20): local membership + capability scaffolding.
 * Bootstrap/lifecycle/roles, owner continuity, revisions, per-mode behavior,
 * redacted queries, determinism, and zero side effects. Covers §35 invariants.
 */
import { describe, expect, it } from "vitest";
import {
  applyLocalRoomMembershipMutationV1,
  createRoomLocalId,
  InMemoryRoomMembershipLog,
  queryRoomMembershipsListRedactedV1,
  queryRoomMembershipCountV1,
  reduceRoomMembershipEventV1,
  replayRoomMembershipEventsV1,
  resolveRoomLocalCapabilityV1,
  resolveRoomMembershipPolicyV1,
  resolveRoomPolicy,
  ROOM_MEMBERSHIP_CAPABILITY,
  type RoomAuthorizationContextV1,
  type RoomCapabilityNameV1,
  type RoomMaterializedState,
  type RoomMembershipLog,
  type RoomMembershipRecordV1,
} from "@freelayer/rooms";
import {
  issuePolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import { createNetworkSideEffectTrap } from "../../../helpers/network-trap";
import { createNotificationSideEffectTrap } from "../../../helpers/notification-trap";

const ROOM = createRoomLocalId("room-mem-01");
const CLOCK = { nowLocalIso: () => "local:2026-05-01T00:00:00.000Z" };
let n = 0;
const nextEvt = () => `mevt-${(n += 1)}`;

function roomState(
  mode: PrivacyMode,
  records: readonly RoomMembershipRecordV1[] = [],
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

const CAP_SIDE_EFFECT: Record<string, PolicySideEffectScope> = {
  "room.membership.add_placeholder": "room.membership.add",
  "room.membership.change_role": "room.membership.change_role",
  "room.membership.suspend": "room.membership.suspend",
  "room.membership.reactivate": "room.membership.reactivate",
  "room.membership.remove_tombstone": "room.membership.remove",
};

function auth(
  owner: RoomMembershipRecordV1,
  cap: RoomCapabilityNameV1,
  mode: PrivacyMode,
  roomPolicy: RoomMaterializedState["policy"],
): RoomAuthorizationContextV1 {
  const res = resolveRoomLocalCapabilityV1({
    membership: owner,
    requestedCapability: cap,
    mode,
    roomPolicy,
  });
  if (!res.allowed) throw new Error(`capability not resolved: ${res.reasonCode}`);
  return {
    membership: owner,
    capability: res.descriptor,
    decision: issuePolicyDecision(
      ROOM_MEMBERSHIP_CAPABILITY,
      "allowed",
      mode,
      CAP_SIDE_EFFECT[cap]!,
    ),
  };
}

function storageDecision(mode: PrivacyMode): PolicyDecision {
  return issuePolicyDecision(
    ROOM_MEMBERSHIP_CAPABILITY,
    "allowed",
    mode,
    "room.membership_log.append",
  );
}

interface Scenario {
  state: RoomMaterializedState;
  log: RoomMembershipLog;
  mode: PrivacyMode;
}

function scenario(mode: PrivacyMode = "standard"): Scenario {
  return { state: roomState(mode), log: new InMemoryRoomMembershipLog(ROOM), mode };
}

function bootstrap(s: Scenario, memberRef = "member-owner", id = "mem-owner-1") {
  const result = applyLocalRoomMembershipMutationV1({
    roomState: s.state,
    command: {
      schemaVersion: 1,
      command: "membership.bootstrap_local_owner_placeholder",
      roomId: ROOM,
      mode: s.mode,
      reason: "boot",
      memberRef,
    },
    roomPolicy: s.state.policy,
    bootstrapDecision: issuePolicyDecision(
      ROOM_MEMBERSHIP_CAPABILITY,
      "allowed",
      s.mode,
      "room.membership.bootstrap",
    ),
    storageDecision: storageDecision(s.mode),
    eventId: nextEvt() as never,
    localSequence: 1 as never,
    membershipId: id as never,
    clock: CLOCK,
    operationLog: s.log,
  });
  s.state = result.nextState;
  return result;
}

function owner(s: Scenario): RoomMembershipRecordV1 {
  return (s.state.membershipRecords ?? []).find((r) => r.role === "owner_placeholder")!;
}

function run(
  s: Scenario,
  command: Record<string, unknown>,
  capability: RoomCapabilityNameV1,
  newId = "mem-x",
) {
  const result = applyLocalRoomMembershipMutationV1({
    roomState: s.state,
    command,
    roomPolicy: s.state.policy,
    authorization: auth(owner(s), capability, s.mode, s.state.policy),
    storageDecision: storageDecision(s.mode),
    eventId: nextEvt() as never,
    localSequence: 1 as never,
    membershipId: newId as never,
    clock: CLOCK,
    operationLog: s.log,
  });
  s.state = result.nextState;
  return result;
}

const addCmd = (memberRef: string, role: string, mode: PrivacyMode) => ({
  schemaVersion: 1,
  command: "membership.add_local_placeholder",
  roomId: ROOM,
  mode,
  reason: "add",
  memberRef,
  role,
});

describe("Bootstrap + lifecycle (§35: 1-2, 23-27)", () => {
  it("bootstrap creates exactly one active owner; second bootstrap rejects", () => {
    const s = scenario();
    const r = bootstrap(s);
    expect(r.membership.role).toBe("owner_placeholder");
    expect(r.membership.state).toBe("active_local_unverified");
    expect(r.membership.revision).toBe(1);
    expect(r.membership.verification).toBe("unverified_placeholder");
    expect(() => bootstrap(s, "member-two", "mem-two")).toThrow(/duplicate_active_membership/);
  });

  it("add member, change role, suspend, reactivate, remove — revisions increment by one", () => {
    const s = scenario();
    bootstrap(s);
    run(
      s,
      addCmd("member-b", "viewer_placeholder", s.mode),
      "room.membership.add_placeholder",
      "mem-b",
    );
    const b1 = (s.state.membershipRecords ?? []).find((r) => r.membershipId === "mem-b")!;
    expect(b1.revision).toBe(1);
    run(
      s,
      {
        schemaVersion: 1,
        command: "membership.change_role",
        roomId: ROOM,
        mode: s.mode,
        reason: "promote",
        membershipId: "mem-b",
        newRole: "editor_placeholder",
        expectedRevision: 1,
      },
      "room.membership.change_role",
    );
    const b2 = (s.state.membershipRecords ?? []).find((r) => r.membershipId === "mem-b")!;
    expect(b2.role).toBe("editor_placeholder");
    expect(b2.revision).toBe(2);
    run(
      s,
      {
        schemaVersion: 1,
        command: "membership.suspend_local",
        roomId: ROOM,
        mode: s.mode,
        reason: "s",
        membershipId: "mem-b",
        expectedRevision: 2,
      },
      "room.membership.suspend",
    );
    const b3 = (s.state.membershipRecords ?? []).find((r) => r.membershipId === "mem-b")!;
    expect(b3.state).toBe("suspended_local");
    // Stale revision rejects.
    expect(() =>
      run(
        s,
        {
          schemaVersion: 1,
          command: "membership.reactivate_local",
          roomId: ROOM,
          mode: s.mode,
          reason: "r",
          membershipId: "mem-b",
          expectedRevision: 2,
        },
        "room.membership.reactivate",
      ),
    ).toThrow(/stale_revision/);
    run(
      s,
      {
        schemaVersion: 1,
        command: "membership.reactivate_local",
        roomId: ROOM,
        mode: s.mode,
        reason: "r",
        membershipId: "mem-b",
        expectedRevision: 3,
      },
      "room.membership.reactivate",
    );
    run(
      s,
      {
        schemaVersion: 1,
        command: "membership.remove_tombstone",
        roomId: ROOM,
        mode: s.mode,
        reason: "x",
        membershipId: "mem-b",
        expectedRevision: 4,
      },
      "room.membership.remove_tombstone",
    );
    const b5 = (s.state.membershipRecords ?? []).find((r) => r.membershipId === "mem-b")!;
    expect(b5.state).toBe("removed_tombstone");
    // Removed membership cannot reactivate (terminal).
    expect(() =>
      run(
        s,
        {
          schemaVersion: 1,
          command: "membership.reactivate_local",
          roomId: ROOM,
          mode: s.mode,
          reason: "r",
          membershipId: "mem-b",
          expectedRevision: 5,
        },
        "room.membership.reactivate",
      ),
    ).toThrow(/terminal|lifecycle/);
  });

  it("duplicate active room/member relationship rejects", () => {
    const s = scenario();
    bootstrap(s);
    run(
      s,
      addCmd("member-dup", "viewer_placeholder", s.mode),
      "room.membership.add_placeholder",
      "mem-d1",
    );
    expect(() =>
      run(
        s,
        addCmd("member-dup", "viewer_placeholder", s.mode),
        "room.membership.add_placeholder",
        "mem-d2",
      ),
    ).toThrow(/duplicate/);
  });
});

describe("Owner continuity (§35: 28-31, §26)", () => {
  it("last active owner cannot be removed/suspended/demoted; a second owner unblocks it", () => {
    const s = scenario();
    bootstrap(s);
    const ownerId = owner(s).membershipId;
    // No second owner yet: removing/suspending/demoting the owner rejects.
    expect(() =>
      run(
        s,
        {
          schemaVersion: 1,
          command: "membership.remove_tombstone",
          roomId: ROOM,
          mode: s.mode,
          reason: "x",
          membershipId: ownerId,
          expectedRevision: 1,
        },
        "room.membership.remove_tombstone",
      ),
    ).toThrow(/last_owner_continuity/);
    expect(() =>
      run(
        s,
        {
          schemaVersion: 1,
          command: "membership.suspend_local",
          roomId: ROOM,
          mode: s.mode,
          reason: "x",
          membershipId: ownerId,
          expectedRevision: 1,
        },
        "room.membership.suspend",
      ),
    ).toThrow(/last_owner_continuity/);
    expect(() =>
      run(
        s,
        {
          schemaVersion: 1,
          command: "membership.change_role",
          roomId: ROOM,
          mode: s.mode,
          reason: "demote",
          membershipId: ownerId,
          newRole: "viewer_placeholder",
          expectedRevision: 1,
        },
        "room.membership.change_role",
      ),
    ).toThrow(/last_owner_continuity/);
    // Add a second owner → first owner can now be removed.
    run(
      s,
      addCmd("member-o2", "owner_placeholder", s.mode),
      "room.membership.add_placeholder",
      "mem-o2",
    );
    run(
      s,
      {
        schemaVersion: 1,
        command: "membership.remove_tombstone",
        roomId: ROOM,
        mode: s.mode,
        reason: "x",
        membershipId: ownerId,
        expectedRevision: 1,
      },
      "room.membership.remove_tombstone",
    );
    expect((s.state.membershipRecords ?? []).find((r) => r.membershipId === ownerId)!.state).toBe(
      "removed_tombstone",
    );
  });
});

describe("Per-mode behavior (§35: 58-64)", () => {
  it("Ghost/Bunker retain nothing in the log (null); Bunker denies expansion", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const policy = resolveRoomMembershipPolicyV1({
        mode,
        command: "membership.add_local_placeholder",
        roomPolicy: resolveRoomPolicy({ mode, roomKind: "workspace" }),
      });
      expect(policy.operationLogRetention).toBe("null");
      if (mode === "bunker") expect(policy.allowed).toBe(false);
    }
  });

  it("Emergency denies add/reactivate/change; suspend/remove follow policy", () => {
    const roomPolicy = resolveRoomPolicy({ mode: "emergency", roomKind: "workspace" });
    expect(
      resolveRoomMembershipPolicyV1({
        mode: "emergency",
        command: "membership.add_local_placeholder",
        roomPolicy,
      }).allowed,
    ).toBe(false);
    expect(
      resolveRoomMembershipPolicyV1({
        mode: "emergency",
        command: "membership.reactivate_local",
        roomPolicy,
      }).allowed,
    ).toBe(false);
    // suspend/remove are restrictive — allowed at the policy layer in emergency.
    expect(
      resolveRoomMembershipPolicyV1({
        mode: "emergency",
        command: "membership.suspend_local",
        roomPolicy,
      }).allowed,
    ).toBe(true);
  });

  it("bootstrap in Offline Capsule triggers no network", () => {
    const net = createNetworkSideEffectTrap();
    const notif = createNotificationSideEffectTrap();
    try {
      const s = scenario("offline_capsule");
      bootstrap(s);
    } finally {
      net.uninstall();
      notif.uninstall();
    }
    expect(() => net.assertNoNetworkApiCalled()).not.toThrow();
    expect(() => notif.assertNoNotificationApiCalled()).not.toThrow();
  });
});

describe("Redacted queries (§35: 59, 65-68)", () => {
  it("Private list is redacted (no membership ID / member ref); count denied", () => {
    const s = scenario("private");
    // Seed records directly (bootstrap owner + a viewer) via standard, then view under private policy.
    const std = scenario("standard");
    bootstrap(std);
    run(
      std,
      addCmd("member-v", "viewer_placeholder", std.mode),
      "room.membership.add_placeholder",
      "mem-v",
    );
    const records = std.state.membershipRecords ?? [];
    const listDecision = issuePolicyDecision(
      ROOM_MEMBERSHIP_CAPABILITY,
      "allowed",
      "private",
      "room.membership.query.list",
    );
    const list = queryRoomMembershipsListRedactedV1({
      records,
      mode: "private",
      decision: listDecision,
      membershipListAllowed: true,
    });
    for (const item of list.items) {
      expect(item.membershipId).toBeUndefined();
      expect(item.memberRef).toBeUndefined();
      expect(item.verification).toBe("unverified_placeholder");
      expect(item).not.toHaveProperty("presence");
      expect(item).not.toHaveProperty("lastSeen");
    }
    // Count denied in Private.
    const countDecision = issuePolicyDecision(
      ROOM_MEMBERSHIP_CAPABILITY,
      "allowed",
      "private",
      "room.membership.query.count",
    );
    expect(() =>
      queryRoomMembershipCountV1({
        records,
        mode: "private",
        decision: countDecision,
        membershipCountAllowed: false,
      }),
    ).toThrow(/count_denied/);
    void s;
  });
});

describe("Determinism + reducer purity (§35: 52-57)", () => {
  it("membership events replay deterministically; reducer is pure", () => {
    const net = createNetworkSideEffectTrap();
    try {
      const s = scenario();
      bootstrap(s);
      run(
        s,
        addCmd("member-r", "editor_placeholder", s.mode),
        "room.membership.add_placeholder",
        "mem-r",
      );
      const events = s.log.readAll(
        issuePolicyDecision(
          ROOM_MEMBERSHIP_CAPABILITY,
          "allowed",
          s.mode,
          "room.membership_log.read",
        ),
      );
      const a = replayRoomMembershipEventsV1({ seed: [], events });
      const b = replayRoomMembershipEventsV1({ seed: [], events });
      expect(a).toEqual(b);
      expect(a).toEqual(s.state.membershipRecords);
      // Reducer does not mutate its inputs (even on the reject path).
      const before = structuredClone(a);
      try {
        reduceRoomMembershipEventV1(a, events[events.length - 1]!);
      } catch {
        // re-applying an add is a duplicate — expected; input must stay intact
      }
      expect(a).toEqual(before);
    } finally {
      net.uninstall();
    }
    expect(() => net.assertNoNetworkApiCalled()).not.toThrow();
  });

  it("mutation failure creates no event/log entry/projection change", () => {
    const s = scenario();
    bootstrap(s);
    const beforeCount = s.log.status().retainedEventCount;
    const beforeState = s.state;
    try {
      // Stale revision on the owner → rejects before any side effect.
      run(
        s,
        {
          schemaVersion: 1,
          command: "membership.suspend_local",
          roomId: ROOM,
          mode: s.mode,
          reason: "x",
          membershipId: owner(s).membershipId,
          expectedRevision: 99,
        },
        "room.membership.suspend",
      );
    } catch {
      // expected
    }
    expect(s.state).toBe(beforeState);
    expect(s.log.status().retainedEventCount).toBe(beforeCount);
  });
});
