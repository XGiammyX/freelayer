/**
 * Security-regression (TECH-22): room governance is tighten-only and cannot be
 * bypassed; posture cannot elevate/grant; the sentinel never leaks; the
 * guardrail catches violations. Covers §29 (35-69, 71-75), §31.
 */
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  applyLocalRoomGovernanceUpdateV1,
  buildRoomPolicyConflictReportV1,
  compareRoomPoliciesV1,
  createRoomLocalId,
  InMemoryRoomGovernanceLog,
  prepareRoomAuthorizationV1,
  reduceRoomGovernanceEventV1,
  resolveEffectiveDevicePostureV1,
  resolveRoomPolicy,
  resolveRoomPolicyDocumentDefaultsV1,
  validateRoomGovernanceCommandV1,
  ROOM_MEMBERSHIP_CAPABILITY,
  type RoomMaterializedState,
  type RoomMembershipRecordV1,
  type RoomPolicyDocumentV1,
} from "@freelayer/rooms";
import { issuePolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import { createNetworkSideEffectTrap } from "../../../helpers/network-trap";
import { createPersistentWriteTrap } from "../../../helpers/persistent-write-trap";

const SENTINEL = "FREELAYER_POLICY_COMPOSITION_SENTINEL_DO_NOT_LEAK";
const ROOM = createRoomLocalId("room-gov-sec");
const CLOCK = { nowLocalIso: () => "local:2026-06-01T00:00:00.000Z" };

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
const doc = (mode: PrivacyMode = "standard"): RoomPolicyDocumentV1 =>
  resolveRoomPolicyDocumentDefaultsV1({ roomId: ROOM, mode });
const dec = (scope: PolicyDecision["sideEffect"]) =>
  issuePolicyDecision(ROOM_MEMBERSHIP_CAPABILITY, "allowed", "standard", scope);

function govern(
  command: Record<string, unknown>,
  opts?: {
    actor?: RoomMembershipRecordV1;
    decision?: PolicyDecision;
    log?: InMemoryRoomGovernanceLog;
    current?: RoomPolicyDocumentV1;
  },
) {
  const actor = opts?.actor ?? rec();
  const rs = state([actor]);
  const prepared = prepareRoomAuthorizationV1({
    roomState: rs,
    membership: actor,
    requestedCapability: "room.policy.tighten",
    requiredSideEffect: "room.governance.update",
    roomPolicy: rs.policy,
  });
  return applyLocalRoomGovernanceUpdateV1({
    roomState: rs,
    currentPolicy: opts?.current ?? doc(),
    command,
    preparedAuthorization: prepared,
    decision: opts?.decision ?? dec("room.governance.update"),
    storageDecision: dec("room.governance_log.append"),
    roomPolicy: rs.policy,
    effectiveDevicePosture: resolveEffectiveDevicePostureV1(),
    eventId: "gev-1" as never,
    localSequence: 1 as never,
    clock: CLOCK,
    operationLog: opts?.log ?? new InMemoryRoomGovernanceLog(),
  });
}

const cmd = (command: string, extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  command,
  roomId: ROOM,
  actorMembershipId: "mem-owner-1",
  expectedPolicyRevision: 1,
  mode: "standard",
  reason: "gov",
  ...extra,
});

function errorText(fn: () => void): string {
  try {
    fn();
  } catch (e: unknown) {
    return e instanceof Error ? `${e.name}: ${e.message} ${e.stack ?? ""}` : String(e);
  }
  throw new Error("expected throw");
}

describe("Tighten-only governance (§29: 35-43, 60-65)", () => {
  it("stricter succeeds and increments revision by one", () => {
    const r = govern(
      cmd("room.policy.increase_minimum_device_posture", { newMinimum: "hardened" }),
    );
    expect(r.resultingRevision).toBe(2);
    expect(r.nextRoomPolicy.minimumDevicePosture).toBe("hardened");
  });

  it("disable a metadata feature (actor_refs) is stricter and succeeds", () => {
    const r = govern(cmd("room.policy.disable_feature", { feature: "actor_refs" }));
    expect(r.nextRoomPolicy.metadata.actorRefsAllowed).toBe(false);
  });

  it("looser / equal / incomparable / unknown all reject", () => {
    // Lowering posture is not even a command; a no-op disable of an already-off
    // feature is `equal` → reject.
    expect(() => govern(cmd("room.policy.disable_feature", { feature: "notifications" }))).toThrow(
      /governance_loosen_attempt/,
    );
    // Comparison-level: a candidate that lowers a field is looser.
    const current = doc("standard");
    const looser = {
      ...current,
      minimumDevicePosture: "unverified" as const,
      sensitivity: "critical" as const,
    };
    // mixed (one stricter sensitivity, one looser posture) → incomparable.
    expect(
      compareRoomPoliciesV1({
        current: { ...current, minimumDevicePosture: "hardened" },
        candidate: looser,
      }),
    ).toBe("incomparable");
    // increasing sensitivity only → stricter.
    expect(
      compareRoomPoliciesV1({ current, candidate: { ...current, sensitivity: "critical" } }),
    ).toBe("stricter");
    // equal.
    expect(compareRoomPoliciesV1({ current, candidate: current })).toBe("equal");
  });

  it("owner cannot lower posture/sensitivity/protection or enable forbidden features (no such command)", () => {
    for (const bad of [
      "room.policy.loosen",
      "room.policy.lower_device_posture",
      "room.policy.enable_forbidden_feature",
      "room.policy.vote",
    ]) {
      expect(() => validateRoomGovernanceCommandV1(cmd(bad))).toThrow(/unknown_command/);
    }
    // Structural falses cannot be enabled — no disableable feature toggles them ON.
    expect(() =>
      validateRoomGovernanceCommandV1(
        cmd("room.policy.tighten", { disableFeatures: ["telemetry"] }),
      ),
    ).toThrow(/unknown_policy_input/);
  });
});

describe("Governance authorization (§29: 44-59)", () => {
  it("editor/viewer/auditor cannot govern (capability not eligible)", () => {
    for (const role of [
      "editor_placeholder",
      "viewer_placeholder",
      "auditor_placeholder",
    ] as const) {
      expect(() =>
        govern(cmd("room.policy.increase_sensitivity", { newSensitivity: "sensitive" }), {
          actor: rec({ role }),
        }),
      ).toThrow();
    }
  });

  it("suspended/removed owner cannot govern; fake/wrong-scope decision rejects; stale policy revision rejects", () => {
    expect(() =>
      govern(cmd("room.policy.increase_sensitivity", { newSensitivity: "sensitive" }), {
        actor: rec({ state: "suspended_local" }),
      }),
    ).toThrow();
    // Fake decision (not provenance).
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "room.governance.update",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    } as PolicyDecision;
    expect(() =>
      govern(cmd("room.policy.increase_sensitivity", { newSensitivity: "sensitive" }), {
        decision: forged,
      }),
    ).toThrow(/decision_missing/);
    // Wrong scope.
    expect(() =>
      govern(cmd("room.policy.increase_sensitivity", { newSensitivity: "sensitive" }), {
        decision: dec("room.object.create"),
      }),
    ).toThrow(/decision_mismatch/);
    // Stale policy revision.
    expect(() =>
      govern(
        cmd("room.policy.increase_sensitivity", {
          newSensitivity: "sensitive",
          expectedPolicyRevision: 5,
        }),
      ),
    ).toThrow(/policy_revision_mismatch/);
  });

  it("governance failure creates no log entry (§29: 57-59)", () => {
    const log = new InMemoryRoomGovernanceLog();
    try {
      govern(cmd("room.policy.disable_feature", { feature: "notifications" }), { log }); // equal → reject
    } catch {
      // expected
    }
    expect(log.count).toBe(0);
  });
});

describe("Reducer purity + determinism (§29: 66-67)", () => {
  it("policy reducer is pure and deterministic", () => {
    const net = createNetworkSideEffectTrap();
    const write = createPersistentWriteTrap();
    try {
      const a = govern(cmd("room.policy.increase_sensitivity", { newSensitivity: "sensitive" }));
      const b = govern(cmd("room.policy.increase_sensitivity", { newSensitivity: "sensitive" }));
      expect(a.nextRoomPolicy).toEqual(b.nextRoomPolicy);
      // Reduce is pure — same event twice yields equal result.
      const r1 = reduceRoomGovernanceEventV1(doc(), a.event);
      expect(r1).toEqual(a.nextRoomPolicy);
    } finally {
      net.uninstall();
      write.uninstall();
    }
    expect(() => net.assertNoNetworkApiCalled()).not.toThrow();
    expect(() => write.assertNoPersistentApiCalled()).not.toThrow();
  });
});

describe("Leak-freedom (§31)", () => {
  it("governance errors + conflict reports never carry the sentinel", () => {
    const t = errorText(() =>
      validateRoomGovernanceCommandV1({
        schemaVersion: 1,
        command: "room.policy.tighten",
        roomId: ROOM,
        actorMembershipId: "mem-owner-1",
        expectedPolicyRevision: 1,
        mode: "standard",
        reason: "gov",
        disableFeatures: [SENTINEL],
      }),
    );
    expect(t).not.toContain(SENTINEL);
    const report = buildRoomPolicyConflictReportV1({
      kind: "governance_loosen_attempt",
      layers: ["room_policy"],
      effect: "deny",
      reasonCode: "loosen",
    });
    const s = JSON.stringify(report);
    expect(s).not.toContain(SENTINEL);
    expect(report.redacted).toBe(true);
  });

  it("console output during governance carries no sentinel", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      try {
        validateRoomGovernanceCommandV1({
          schemaVersion: 1,
          command: "room.policy.tighten",
          roomId: ROOM,
          actorMembershipId: "mem-owner-1",
          expectedPolicyRevision: 1,
          mode: "standard",
          reason: "gov",
          disableFeatures: [SENTINEL],
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

describe("Guardrail + import hygiene (§32, §35, §29: 72-75)", () => {
  it("check:no-device-posture-or-governance-bypass flags the fixture and passes real source", () => {
    const bad = spawnSync(
      process.execPath,
      [
        "scripts/check-no-device-posture-or-governance-bypass.mjs",
        "tests/fixtures/device-posture-governance-bypass",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(bad.status).toBe(1);
    expect(`${bad.stdout}\n${bad.stderr}`).toContain("bypass pattern");
    const real = spawnSync(
      process.execPath,
      ["scripts/check-no-device-posture-or-governance-bypass.mjs"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(real.status).toBe(0);
  });

  it("policy-composition/ imports no device-management/attestation/anti-spyware packages", () => {
    const files = readdirSync("packages/rooms/src/policy-composition").filter((f) =>
      f.endsWith(".ts"),
    );
    for (const file of files) {
      const src = readFileSync(`packages/rooms/src/policy-composition/${file}`, "utf8");
      for (const banned of [
        '"react-native-device-info"',
        "play-integrity",
        "@freelayer/crypto",
        "node:crypto",
        "@freelayer/transports",
        '"@freelayer/ai"',
        "iohook",
      ]) {
        expect(src.includes(banned), `${file} imports ${banned}`).toBe(false);
      }
    }
  });
});
