/**
 * Security-regression (TECH-ID-06 §30/§32): per-room alias boundary proofs.
 *
 *  - Sentinel + redaction: no alias text or leak sentinel escapes into errors or
 *    redacted surfaces (audit events, collision/reuse assessments, strict display).
 *  - Side-effect scope traps: every write needs an AUTHENTIC exact-scope decision;
 *    forged / wrong-scope / denied decisions are refused; the repository refuses a
 *    non-room-alias scope.
 *  - Matrix ↔ policy agreement: runtime policy allow/deny matches the Policy
 *    Matrix rows for all 7 room-alias operations across all 7 modes.
 *  - Structural absence proofs: network sharing / authenticated binding / public
 *    directory / global username / persistent plaintext / notification / telemetry
 *    / AI are false in EVERY mode; always-forbidden matrix specs never allowed.
 *  - Guardrail: shipped room-alias code passes the bypass guard; the fixture fails.
 *  - Not-identity proofs: role / verified / owner / DevicePosture / ScreenShield
 *    fields are rejected; an alias never carries authority.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyRoomAliasCommandV1,
  assessRoomAliasCollisionV1,
  assessRoomAliasReuseV1,
  buildRoomAliasAuditEventV1,
  buildRoomMemberDisplayContextV1,
  InMemoryRoomAliasRepositoryV1,
  normalizeContactAliasDisplayTextV1,
  resolveRoomAliasPolicyV1,
  RoomAliasDecisionMismatchError,
  RoomAliasPolicyDeniedError,
  RoomAliasValidationError,
  ROOM_ALIAS_OPERATIONS,
  validateRoomAliasCommandV1,
  type RoomAliasOperationV1,
} from "@freelayer/identity";
import { issuePolicyDecision, POLICY_MATRIX_RULES, type PrivacyMode } from "@freelayer/privacy";
import {
  activeRoomAlias,
  applyRA,
  CLOCK,
  createCommand,
  emptyState,
  MEMBER,
  nextIds,
  ref,
  repo,
  ROOM_ALIAS_SENTINEL,
} from "../../../fixtures/room-aliases/v1/helpers";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

function errText(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return `${String(error)}\n${JSON.stringify(error, Object.getOwnPropertyNames(error))}`;
  }
  throw new Error("expected the operation to throw");
}

describe("Sentinel + redaction", () => {
  it("normalization / pipeline errors never echo alias text or sentinel", () => {
    expect(
      errText(() => normalizeContactAliasDisplayTextV1(`${ROOM_ALIAS_SENTINEL}\u0000`)),
    ).not.toContain(ROOM_ALIAS_SENTINEL);
    const r = ref();
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "identity.room_alias.create",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    };
    const leaked = errText(() =>
      applyRoomAliasCommandV1({
        state: emptyState(),
        command: createCommand(ROOM_ALIAS_SENTINEL, r),
        mode: "standard",
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
        bindingRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
        clockValue: CLOCK,
        repository: repo(),
      }),
    );
    expect(leaked).not.toContain(ROOM_ALIAS_SENTINEL);
  });

  it("audit + collision + reuse surfaces carry no ids/counts/sentinel", () => {
    const audit = buildRoomAliasAuditEventV1({
      operationCategory: "room_alias_collision_assessment",
      outcome: "denied",
      mode: "bunker",
      reasonCode: "collision_assessment_denied",
    });
    expect(audit.redacted).toBe(true);
    expect(JSON.stringify(audit)).not.toContain(ROOM_ALIAS_SENTINEL);
    const norm = normalizeContactAliasDisplayTextV1(ROOM_ALIAS_SENTINEL).normalizedValue;
    const col = assessRoomAliasCollisionV1({
      observations: [],
      normalizedValue: norm,
      forMembershipId: MEMBER,
    });
    expect(col.collidingMemberIdsExposed).toBe(false);
    expect(col.exactCollisionCountExposed).toBe(false);
    const reuse = assessRoomAliasReuseV1({
      state: emptyState(),
      normalizedValue: norm,
      forRoomId: ref().roomId,
    });
    expect(reuse.affectedRoomIdsExposed).toBe(false);
    expect(reuse.affectedRoomCountExposed).toBe(false);
  });

  it("a strict-mode display context redacts the alias text (sentinel)", () => {
    const r = ref();
    const { state } = activeRoomAlias(ROOM_ALIAS_SENTINEL, r);
    const priv = buildRoomMemberDisplayContextV1({
      ref: r,
      member: { role: "editor_placeholder", state: "active_local_unverified" },
      state,
      observations: [],
      policy: resolveRoomAliasPolicyV1({ mode: "private", operation: "display_context.read" }),
    });
    expect(priv.redacted).toBe(true);
    expect(JSON.stringify(priv)).not.toContain(ROOM_ALIAS_SENTINEL);
  });
});

describe("Side-effect scope traps", () => {
  it("wrong-scope, denied, and forged decisions are all refused", () => {
    const r = ref();
    const base = {
      state: emptyState(),
      command: createCommand("Blue Fox", r),
      mode: "standard" as const,
      bindingRef: r,
      generatedIds: { aliasId: nextIds().aliasId },
      clockValue: CLOCK,
      repository: repo(),
    };
    expect(() =>
      applyRoomAliasCommandV1({
        ...base,
        decision: issuePolicyDecision(
          "persistence",
          "allowed",
          "standard",
          "identity.room_alias.rotate",
        ),
      }),
    ).toThrow(RoomAliasDecisionMismatchError);
    expect(() =>
      applyRoomAliasCommandV1({
        ...base,
        decision: issuePolicyDecision(
          "persistence",
          "denied",
          "standard",
          "identity.room_alias.create",
        ),
      }),
    ).toThrow(RoomAliasDecisionMismatchError);
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "identity.room_alias.create",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    };
    expect(() =>
      applyRoomAliasCommandV1({
        ...base,
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
      }),
    ).toThrow(RoomAliasDecisionMismatchError);
  });

  it("the repository refuses a decision whose scope is not a room-alias side effect", () => {
    const memo = new InMemoryRoomAliasRepositoryV1();
    expect(() =>
      memo.replace(
        emptyState(),
        issuePolicyDecision("persistence", "allowed", "standard", "storage.write"),
      ),
    ).toThrow();
    // A contact-alias scope must NOT authorize a room-alias write either.
    expect(() =>
      memo.replace(
        emptyState(),
        issuePolicyDecision(
          "persistence",
          "allowed",
          "standard",
          "identity.alias.presentation.create",
        ),
      ),
    ).toThrow();
  });
});

describe("Matrix ↔ policy agreement (7 ops × 7 modes)", () => {
  const MATRIX_OP: Readonly<Record<string, RoomAliasOperationV1>> = {
    "identity.room_alias.create": "create",
    "identity.room_alias.activate": "activate",
    "identity.room_alias.rotate": "rotate",
    "identity.room_alias.retire": "retire",
    "identity.room_alias.display_context.read": "display_context.read",
    "identity.room_alias.collision_assessment.read": "collision_assessment.read",
    "identity.room_alias.reuse_assessment.read": "reuse_assessment.read",
  };
  it("every operational room-alias matrix rule matches the runtime policy verdict", () => {
    const operational = POLICY_MATRIX_RULES.filter(
      (r) => r.domain === "identity" && r.operation in MATRIX_OP,
    );
    expect(operational).toHaveLength(7 * MODES.length);
    for (const rule of operational) {
      const operation = MATRIX_OP[rule.operation]!;
      expect(
        resolveRoomAliasPolicyV1({ mode: rule.mode, operation }).allowed,
        `${rule.operation}:${rule.mode}`,
      ).toBe(rule.allowed);
    }
  });
});

describe("Structural absence proofs", () => {
  it("no mode/op ever enables sharing, auth binding, directory, username, persistence, notification, telemetry, AI", () => {
    for (const mode of MODES) {
      for (const operation of ROOM_ALIAS_OPERATIONS) {
        const p = resolveRoomAliasPolicyV1({ mode, operation });
        expect(p.networkSharingAllowed).toBe(false);
        expect(p.authenticatedBindingAvailable).toBe(false);
        expect(p.publicDirectoryAllowed).toBe(false);
        expect(p.globalUsernameAllowed).toBe(false);
        expect(p.persistentPlaintextAllowed).toBe(false);
        expect(p.notificationAllowed).toBe(false);
        expect(p.telemetryAllowed).toBe(false);
        expect(p.aiAllowed).toBe(false);
      }
    }
  });

  it("always-forbidden / not-implemented / future-gated room-alias specs are never allowed", () => {
    const forbidden = new Set([
      "identity.room_alias_remote_sharing",
      "identity.room_alias_authenticated_binding_future",
      "identity.room_alias_persistence",
      "identity.room_alias_history",
      "identity.room_alias_bundle_export_import_future",
    ]);
    const rules = POLICY_MATRIX_RULES.filter((r) => forbidden.has(r.id.split(":")[0]!));
    expect(rules.length).toBe(forbidden.size * MODES.length);
    for (const rule of rules) expect(rule.allowed, rule.id).toBe(false);
  });
});

describe("Guardrail (spawned)", () => {
  const script = "scripts/check-no-room-alias-bypass.mjs";
  it("shipped room-alias source passes the bypass guard", () => {
    expect(() =>
      execFileSync("node", [script, "packages/identity/src/room-aliases"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
  it("the intentional bypass fixture fails the guard", () => {
    expect(() =>
      execFileSync("node", [script, "tests/fixtures/room-alias-bypass"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      }),
    ).toThrow();
  });
});

describe("Not-identity proofs", () => {
  it("role / verified / owner / DevicePosture / ScreenShield / copy-from fields are rejected", () => {
    for (const field of [
      "verified",
      "authenticated",
      "owner",
      "moderator",
      "admin",
      "role",
      "permissions",
      "capabilities",
      "devicePosture",
      "screenShieldActive",
      "copyFromContact",
      "copyFromRoom",
      "username",
      "global",
      "public",
    ]) {
      expect(
        () =>
          validateRoomAliasCommandV1({
            schemaVersion: 1,
            command: "identity.room_alias.retire",
            aliasId: "ralias-x1",
            expectedRevision: 1,
            [field]: true,
          }),
        field,
      ).toThrow(RoomAliasValidationError);
    }
  });

  it("a built alias never claims verification/authentication; display derives no authority", () => {
    const r = ref();
    const { state } = activeRoomAlias("Blue Fox", r);
    const alias = state.presentationAliases.find((a) => a.lifecycle === "active_local_unshared")!;
    expect(alias.authenticatedBinding).toBe("not_implemented_gate_f");
    expect(alias.sharingState).toBe("not_shared_tech_id_06");
    const ctx = buildRoomMemberDisplayContextV1({
      ref: r,
      member: { role: "owner_placeholder", state: "active_local_unverified" },
      state,
      observations: [],
      policy: resolveRoomAliasPolicyV1({ mode: "standard", operation: "display_context.read" }),
    });
    expect(ctx.authorityDerivedFromAlias).toBe(false);
    expect(ctx.aliasVerified).toBe(false);
    expect(ctx.cryptographicBindingAvailable).toBe(false);
  });

  it("Emergency denies expansive room-alias writes before mutation", () => {
    const r = ref();
    expect(() =>
      applyRA({
        state: emptyState(),
        command: createCommand("Blue Fox", r),
        scope: "identity.room_alias.create",
        mode: "emergency",
        bindingRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow(RoomAliasPolicyDeniedError);
  });
});
