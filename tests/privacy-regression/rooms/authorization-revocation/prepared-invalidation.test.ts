/**
 * Privacy-regression (TECH-21): a prepared authorization context is invalidated
 * by any relevant local change before execution — suspension, removal, role
 * downgrade, target-revision change, object/view/operation/room rebinding, and
 * room-policy / privacy-mode / lifecycle transitions. Covers §20 + §26.
 */
import { describe, expect, it } from "vitest";
import {
  assertPreparedRoomAuthorizationCurrentV1,
  createRoomLocalId,
  prepareRoomAuthorizationV1,
  resolveRoomPolicy,
  ROOM_MEMBERSHIP_CAPABILITY,
  type RoomMaterializedState,
  type RoomMembershipRecordV1,
} from "@freelayer/rooms";
import { issuePolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";

const ROOM = createRoomLocalId("room-authz-01");
const OTHER = createRoomLocalId("room-other-99");

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
  mode: PrivacyMode,
  records: readonly RoomMembershipRecordV1[],
  policyRevision?: number,
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
    ...(policyRevision !== undefined ? { policyRevision } : {}),
  };
}

const decision = (mode: PrivacyMode, scope: PolicyDecision["sideEffect"]) =>
  issuePolicyDecision(ROOM_MEMBERSHIP_CAPABILITY, "allowed", mode, scope);

function prepareObjectCreate(mode: PrivacyMode = "standard", owner = rec()) {
  const rs = state(mode, [owner]);
  return {
    rs,
    prepared: prepareRoomAuthorizationV1({
      roomState: rs,
      membership: owner,
      requestedCapability: "room.object.create",
      requiredSideEffect: "room.object.create",
      roomPolicy: rs.policy,
      objectId: "obj-0001" as never,
      objectKind: "message",
    }),
  };
}

function revalidate(
  prepared: ReturnType<typeof prepareObjectCreate>["prepared"],
  over: {
    currentRoomState: RoomMaterializedState;
    currentMembership: RoomMembershipRecordV1;
    decision: PolicyDecision;
    actualRequiredCapability?: string;
    actualSideEffect?: string;
    actualObjectId?: string;
    actualObjectKind?: string;
    actualTargetMembership?: RoomMembershipRecordV1;
  },
) {
  assertPreparedRoomAuthorizationCurrentV1({
    prepared,
    currentRoomState: over.currentRoomState,
    currentMembership: over.currentMembership,
    currentRoomPolicy: over.currentRoomState.policy,
    decision: over.decision,
    actualRequiredCapability: (over.actualRequiredCapability ?? "room.object.create") as never,
    actualSideEffect: over.actualSideEffect ?? "room.object.create",
    actualObjectId: (over.actualObjectId ?? "obj-0001") as never,
    actualObjectKind: (over.actualObjectKind ?? "message") as never,
    ...(over.actualTargetMembership !== undefined
      ? { actualTargetMembership: over.actualTargetMembership }
      : {}),
  });
}

describe("Membership-state invalidation (§20: 1-3)", () => {
  it("suspension / removal / downgrade of the actor invalidate a prepared object op", () => {
    const suspended = rec({ state: "suspended_local", revision: 2 as never });
    const { prepared } = prepareObjectCreate();
    expect(() =>
      revalidate(prepared, {
        currentRoomState: state("standard", [suspended]),
        currentMembership: suspended,
        decision: decision("standard", "room.object.create"),
      }),
    ).toThrow(/membership_suspended|membership_revision|revision_mismatch/);

    const removed = rec({ state: "removed_tombstone", revision: 2 as never });
    expect(() =>
      revalidate(prepared, {
        currentRoomState: state("standard", [removed]),
        currentMembership: removed,
        decision: decision("standard", "room.object.create"),
      }),
    ).toThrow(/membership_removed|membership_revision/);

    const downgraded = rec({ role: "viewer_placeholder", revision: 2 as never });
    expect(() =>
      revalidate(prepared, {
        currentRoomState: state("standard", [downgraded]),
        currentMembership: downgraded,
        decision: decision("standard", "room.object.create"),
      }),
    ).toThrow(/revision_mismatch|role_capability_revoked/);
  });

  it("same-revision valid re-check passes (deterministic revalidation §31: 73)", () => {
    const owner = rec();
    const { rs, prepared } = prepareObjectCreate("standard", owner);
    expect(() =>
      revalidate(prepared, {
        currentRoomState: rs,
        currentMembership: owner,
        decision: decision("standard", "room.object.create"),
      }),
    ).not.toThrow();
    // Repeated → still passes (no cached allow, pure recomputation).
    expect(() =>
      revalidate(prepared, {
        currentRoomState: rs,
        currentMembership: owner,
        decision: decision("standard", "room.object.create"),
      }),
    ).not.toThrow();
  });
});

describe("Operation-data binding (§20: 10-13)", () => {
  const owner = rec();
  it("object / operation / room / target mismatch reject", () => {
    const { rs, prepared } = prepareObjectCreate("standard", owner);
    // Object A prepared, execute on object B.
    expect(() =>
      revalidate(prepared, {
        currentRoomState: rs,
        currentMembership: owner,
        decision: decision("standard", "room.object.create"),
        actualObjectId: "obj-0002",
      }),
    ).toThrow(/object_binding/);
    // Operation mismatch (create prepared, list executed).
    expect(() =>
      revalidate(prepared, {
        currentRoomState: rs,
        currentMembership: owner,
        decision: decision("standard", "room.object.create"),
        actualRequiredCapability: "room.object.list",
        actualSideEffect: "room.query.list",
      }),
    ).toThrow(/operation_binding|decision_mismatch/);
    // Room mismatch.
    const otherRoomState = { ...rs, roomId: OTHER };
    expect(() =>
      revalidate(prepared, {
        currentRoomState: otherRoomState as RoomMaterializedState,
        currentMembership: owner,
        decision: decision("standard", "room.object.create"),
      }),
    ).toThrow(/revision_mismatch|room/);
  });

  it("target membership revision change rejects (§20: 9)", () => {
    const owner2 = rec();
    const target1 = rec({
      membershipId: "mem-t",
      memberRef: "member-t",
      role: "editor_placeholder",
      revision: 1 as never,
    });
    const target2 = rec({
      membershipId: "mem-t",
      memberRef: "member-t",
      role: "editor_placeholder",
      revision: 2 as never,
    });
    const rs = state("standard", [owner2, target1]);
    const prepared = prepareRoomAuthorizationV1({
      roomState: rs,
      membership: owner2,
      requestedCapability: "room.membership.suspend",
      requiredSideEffect: "room.membership.suspend",
      roomPolicy: rs.policy,
      targetMembership: target1,
    });
    expect(() =>
      assertPreparedRoomAuthorizationCurrentV1({
        prepared,
        currentRoomState: state("standard", [owner2, target2]),
        currentMembership: owner2,
        currentRoomPolicy: rs.policy,
        decision: decision("standard", "room.membership.suspend"),
        actualRequiredCapability: "room.membership.suspend",
        actualSideEffect: "room.membership.suspend",
        actualTargetMembership: target2,
      }),
    ).toThrow(/target_binding/);
  });
});

describe("Policy / mode / lifecycle transitions (§20: 6-8, §26)", () => {
  const owner = rec();
  it("room-policy revision change invalidates a prepared context", () => {
    const rs = state("standard", [owner], 1);
    const prepared = prepareRoomAuthorizationV1({
      roomState: rs,
      membership: owner,
      requestedCapability: "room.object.create",
      requiredSideEffect: "room.object.create",
      roomPolicy: rs.policy,
      objectId: "obj-0001" as never,
      objectKind: "message",
    });
    expect(() =>
      revalidate(prepared, {
        currentRoomState: state("standard", [owner], 2),
        currentMembership: owner,
        decision: decision("standard", "room.object.create"),
      }),
    ).toThrow(/room_policy_revision_mismatch/);
  });

  it("privacy-mode change invalidates a prepared context (even Ghost→Standard)", () => {
    const { prepared } = prepareObjectCreate("standard", owner);
    for (const mode of ["private", "ghost", "bunker", "emergency"] as const) {
      // A stricter mode changes the mode fence (and sometimes the policy
      // fingerprint, caught one step earlier) — either way it invalidates.
      expect(
        () =>
          revalidate(prepared, {
            currentRoomState: state(mode, [owner]),
            currentMembership: owner,
            decision: decision(mode, "room.object.create"),
          }),
        mode,
      ).toThrow(/privacy_mode_revision_mismatch|room_policy_revision_mismatch/);
    }
    // Even a less-restrictive transition requires fresh preparation.
    const ghost = prepareObjectCreate("ghost", owner);
    expect(() =>
      revalidate(ghost.prepared, {
        currentRoomState: state("standard", [owner]),
        currentMembership: owner,
        decision: decision("standard", "room.object.create"),
      }),
    ).toThrow(/privacy_mode_revision_mismatch|room_policy_revision_mismatch/);
  });

  it("room lifecycle change invalidates a prepared context (§20: 20)", () => {
    const { prepared } = prepareObjectCreate("standard", owner);
    const sealed = { ...state("standard", [owner]), lifecycle: "sealed_local" as const };
    expect(() =>
      revalidate(prepared, {
        currentRoomState: sealed,
        currentMembership: owner,
        decision: decision("standard", "room.object.create"),
      }),
    ).toThrow(/revision_mismatch|lifecycle/);
  });
});
