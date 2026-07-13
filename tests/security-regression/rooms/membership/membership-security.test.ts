/**
 * Security-regression (TECH-20): membership + capability scaffolding cannot be
 * bypassed and never leaks. Roles/IDs/refs/descriptors confer no authority; an
 * authentic exact-scope decision is always required; capability binding/
 * attenuation/subset hold; descriptors are non-serializable/non-persistable;
 * the sentinel never leaks; the guardrail catches violations. Covers §35
 * (3-22, 33-51, 71-74) + §36.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  assertRoomAuthorizationContextV1,
  assertRoomCapabilityDescriptorCurrentV1,
  attenuateRoomCapabilityDescriptorV1,
  createRoomLocalId,
  isRoomCapabilitySubsetV1,
  resolveRoomLocalCapabilityV1,
  validateRoomMembershipCommandV1,
  type RoomLocalCapabilityDescriptorV1,
  type RoomMembershipRecordV1,
} from "@freelayer/rooms";
import { issuePolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import { resolveRoomPolicy, ROOM_MEMBERSHIP_CAPABILITY } from "@freelayer/rooms";

const SENTINEL = "FREELAYER_MEMBERSHIP_SENTINEL_DO_NOT_LEAK";
const ROOM = createRoomLocalId("room-mem-sec");
const OTHER = createRoomLocalId("room-other-99");

const ownerRecord = (over: Partial<RoomMembershipRecordV1> = {}): RoomMembershipRecordV1 =>
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

const roomPolicy = (mode: PrivacyMode = "standard") =>
  resolveRoomPolicy({ mode, roomKind: "workspace" });

function descriptor(
  over: Partial<RoomLocalCapabilityDescriptorV1> = {},
): RoomLocalCapabilityDescriptorV1 {
  const res = resolveRoomLocalCapabilityV1({
    membership: ownerRecord(),
    requestedCapability: "room.object.create",
    mode: "standard",
    roomPolicy: roomPolicy(),
  });
  if (!res.allowed) throw new Error("expected allowed");
  return Object.freeze({ ...res.descriptor, ...over });
}

function errorText(fn: () => void): string {
  try {
    fn();
  } catch (e: unknown) {
    return e instanceof Error ? `${e.name}: ${e.message} ${e.stack ?? ""}` : String(e);
  }
  throw new Error("expected throw");
}

describe("Capability resolution (§35: 33-38, 48)", () => {
  it("default-denies for unknown capability, wrong role, suspended member", () => {
    expect(
      resolveRoomLocalCapabilityV1({
        membership: ownerRecord(),
        requestedCapability: "room.wildcard" as never,
        mode: "standard",
        roomPolicy: roomPolicy(),
      }).allowed,
    ).toBe(false);
    // Viewer cannot create objects.
    expect(
      resolveRoomLocalCapabilityV1({
        membership: ownerRecord({ role: "viewer_placeholder" }),
        requestedCapability: "room.object.create",
        mode: "standard",
        roomPolicy: roomPolicy(),
      }).allowed,
    ).toBe(false);
    // Editor cannot manage membership.
    expect(
      resolveRoomLocalCapabilityV1({
        membership: ownerRecord({ role: "editor_placeholder" }),
        requestedCapability: "room.membership.change_role",
        mode: "standard",
        roomPolicy: roomPolicy(),
      }).allowed,
    ).toBe(false);
    // Suspended member: no capability.
    expect(
      resolveRoomLocalCapabilityV1({
        membership: ownerRecord({ state: "suspended_local" }),
        requestedCapability: "room.object.list",
        mode: "standard",
        roomPolicy: roomPolicy(),
      }).allowed,
    ).toBe(false);
  });

  it("descriptor is non-authoritative and binds room/membership/revision", () => {
    const d = descriptor();
    expect(d.authoritative).toBe(false);
    expect(d.serialization).toBe("forbidden");
    expect(d.persistence).toBe("forbidden");
    expect(d.delegation).toBe("not_implemented");
    expect(d.roomId).toBe(ROOM);
    expect(d.membershipId).toBe("mem-owner-1");
    expect(d.membershipRevision).toBe(1);
  });

  it("no wildcard capability exists in the taxonomy", () => {
    expect(() =>
      validateRoomMembershipCommandV1({
        schemaVersion: 1,
        command: "membership.grant_all",
        roomId: ROOM,
        mode: "standard",
        reason: "x",
      }),
    ).toThrow(/unknown_command/);
  });
});

describe("Capability currency + attenuation (§35: 39-47, 49-51)", () => {
  it("stale descriptor rejects after role change / suspension / removal / revision bump", () => {
    const d = descriptor({ capability: "room.object.list" });
    // Role changed.
    expect(() =>
      assertRoomCapabilityDescriptorCurrentV1({
        descriptor: d,
        currentMembership: ownerRecord({
          role: "editor_placeholder",
          membershipId: d.membershipId,
        }),
      }),
    ).toThrow(/capability_stale/);
    // Suspended.
    expect(() =>
      assertRoomCapabilityDescriptorCurrentV1({
        descriptor: d,
        currentMembership: ownerRecord({ state: "suspended_local" }),
      }),
    ).toThrow(/capability_stale/);
    // Removed.
    expect(() =>
      assertRoomCapabilityDescriptorCurrentV1({
        descriptor: d,
        currentMembership: ownerRecord({ state: "removed_tombstone" }),
      }),
    ).toThrow(/capability_stale/);
    // Revision bumped.
    expect(() =>
      assertRoomCapabilityDescriptorCurrentV1({
        descriptor: d,
        currentMembership: ownerRecord({ revision: 2 as never }),
      }),
    ).toThrow(/capability_stale/);
    // Different room.
    expect(() =>
      assertRoomCapabilityDescriptorCurrentV1({
        descriptor: d,
        currentMembership: ownerRecord({ roomId: OTHER }),
      }),
    ).toThrow(/capability_scope/);
  });

  it("attenuation narrows only; widening rejects; subset holds", () => {
    const parent = descriptor({ capability: "room.object.update" });
    // Narrow to a read capability.
    const narrower = attenuateRoomCapabilityDescriptorV1({
      parent,
      narrowerCapability: "room.object.detail.read",
    });
    expect(isRoomCapabilitySubsetV1(narrower, parent)).toBe(true);
    // Widen (list → create) rejects.
    const listCap = descriptor({ capability: "room.object.list" });
    expect(() =>
      attenuateRoomCapabilityDescriptorV1({
        parent: listCap,
        narrowerCapability: "room.object.create",
      }),
    ).toThrow(/capability_widening/);
    // Object-kind widening: parent restricted to note, candidate adds task.
    const kindParent = descriptor({
      capability: "room.object.list",
      objectKinds: Object.freeze(["note"]) as never,
    });
    expect(() =>
      attenuateRoomCapabilityDescriptorV1({
        parent: kindParent,
        objectKinds: ["note", "task"] as never,
      }),
    ).toThrow(/capability_widening/);
    // Exact-object scope cannot be removed.
    const exactParent = descriptor({
      capability: "room.object.detail.read",
      exactObjectId: "obj-0001" as never,
    });
    const cloneNoExact = Object.freeze({
      ...exactParent,
      exactObjectId: undefined,
    }) as unknown as RoomLocalCapabilityDescriptorV1;
    expect(isRoomCapabilitySubsetV1(cloneNoExact, exactParent)).toBe(false);
    // Maximum view cannot widen.
    const viewParent = descriptor({
      capability: "room.object.detail.read",
      maximumView: "object_detail_redacted" as never,
    });
    const wider = Object.freeze({
      ...viewParent,
      maximumView: "object_detail_content",
    }) as RoomLocalCapabilityDescriptorV1;
    expect(isRoomCapabilitySubsetV1(wider, viewParent)).toBe(false);
  });

  it("descriptor cannot move to another room", () => {
    const parent = descriptor();
    const moved = Object.freeze({ ...parent, roomId: OTHER }) as RoomLocalCapabilityDescriptorV1;
    expect(isRoomCapabilitySubsetV1(moved, parent)).toBe(false);
  });
});

describe("Authorization requires an authentic exact-scope decision (§35: 10-17)", () => {
  const ctx = (
    decision: PolicyDecision,
    cap = descriptor({ capability: "room.object.create" }),
  ) => ({
    membership: ownerRecord(),
    capability: cap,
    decision,
  });
  const assertAuthz = (
    decision: PolicyDecision,
    requiredSideEffect: PolicyDecision["sideEffect"] = "room.object.create",
  ) =>
    assertRoomAuthorizationContextV1({
      context: ctx(decision),
      currentMembership: ownerRecord(),
      requiredCapability: "room.object.create",
      requiredSideEffect,
      roomId: ROOM,
    });

  it("owner descriptor + role + IDs alone grant nothing; a real decision is required", () => {
    // Forged (non-provenance) decision → decision_missing.
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "room.object.create",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    } as PolicyDecision;
    expect(() => assertAuthz(forged)).toThrow(/decision_missing/);
    // Denied verdict.
    expect(() =>
      assertAuthz(
        issuePolicyDecision(ROOM_MEMBERSHIP_CAPABILITY, "denied", "standard", "room.object.create"),
      ),
    ).toThrow(/verdict_denied|decision_mismatch/);
    // Wrong side-effect scope.
    expect(() =>
      assertAuthz(
        issuePolicyDecision(
          ROOM_MEMBERSHIP_CAPABILITY,
          "allowed",
          "standard",
          "room.object.update",
        ),
      ),
    ).toThrow(/decision_mismatch/);
    // Authentic exact-scope decision → passes.
    expect(() =>
      assertAuthz(
        issuePolicyDecision(
          ROOM_MEMBERSHIP_CAPABILITY,
          "allowed",
          "standard",
          "room.object.create",
        ),
      ),
    ).not.toThrow();
  });
});

describe("Command validation (§35: 5-9)", () => {
  it("unknown command/role, prototype keys, unexpected authority fields, cross-schema reject", () => {
    const base = {
      schemaVersion: 1,
      command: "membership.add_local_placeholder",
      roomId: ROOM,
      mode: "standard",
      reason: "x",
      memberRef: "member-x",
      role: "viewer_placeholder",
    };
    expect(() =>
      validateRoomMembershipCommandV1({ ...base, command: "membership.frobnicate" }),
    ).toThrow(/unknown_command/);
    expect(() => validateRoomMembershipCommandV1({ ...base, role: "admin" })).toThrow(
      /unknown_role/,
    );
    expect(() => validateRoomMembershipCommandV1({ ...base, schemaVersion: 2 })).toThrow(
      /unsupported_schema_version/,
    );
    expect(() => validateRoomMembershipCommandV1({ ...base, ["__proto__"]: { x: 1 } })).toThrow(
      /dangerous_key|unexpected_field/,
    );
    // Caller-controlled authority fields are just unexpected keys → reject.
    for (const field of [
      "isAdmin",
      "isOwner",
      "verified",
      "capabilities",
      "permissions",
      "trustedDevice",
      "endpointSafe",
    ]) {
      expect(() => validateRoomMembershipCommandV1({ ...base, [field]: true }), field).toThrow(
        /unexpected_field/,
      );
    }
  });
});

describe("Leak-freedom (§36)", () => {
  it("errors never contain the sentinel member ref / role / descriptor", () => {
    const t1 = errorText(() =>
      validateRoomMembershipCommandV1({
        schemaVersion: 1,
        command: "membership.add_local_placeholder",
        roomId: ROOM,
        mode: "standard",
        reason: "x",
        memberRef: SENTINEL,
        role: "wizard",
      }),
    );
    expect(t1).not.toContain(SENTINEL);
    expect(t1).toMatch(/invalid_member_ref|unknown_role/);
    // A capability denial for a sentinel-bearing member leaks nothing.
    const res = resolveRoomLocalCapabilityV1({
      membership: ownerRecord({ memberRef: SENTINEL as never, role: "viewer_placeholder" }),
      requestedCapability: "room.object.create",
      mode: "standard",
      roomPolicy: roomPolicy(),
    });
    expect(JSON.stringify(res)).not.toContain(SENTINEL);
  });
});

describe("Guardrail + import hygiene (§37-38, §35: 73-74)", () => {
  it("check:no-room-membership-bypass flags the fixture and passes real source", () => {
    const bad = spawnSync(
      process.execPath,
      ["scripts/check-no-room-membership-bypass.mjs", "tests/fixtures/room-membership-bypass"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(bad.status).toBe(1);
    expect(`${bad.stdout}\n${bad.stderr}`).toMatch(/bypass pattern|authority\/trust|role-string/);
    const real = spawnSync(process.execPath, ["scripts/check-no-room-membership-bypass.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(real.status).toBe(0);
  });

  it("membership/ imports no auth/identity/crypto/AI/monitoring packages", () => {
    const files = readdirSync("packages/rooms/src/membership").filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(`packages/rooms/src/membership/${file}`, "utf8");
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
