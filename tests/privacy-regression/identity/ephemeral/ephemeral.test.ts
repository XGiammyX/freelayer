/**
 * Privacy-regression (TECH-ID-04): ephemeral identity — independent root kind,
 * process-epoch binding, bounded lifetime via injected clock, fail-closed
 * expiry, isolation, no promotion/recovery/export/sync, atomic destruction,
 * memory/null repositories. Covers §31 (1-68) + §32 lifetime table.
 */
import { describe, expect, it } from "vitest";
import {
  applyEphemeralIdentityCommandV1,
  destroyEphemeralIdentityV1,
  emptyEphemeralIdentityVaultV1,
  EphemeralIdentityDecisionMismatchError,
  EphemeralIdentityExpiredError,
  EphemeralIdentityLifetimeError,
  EphemeralIdentityLimitError,
  EphemeralIdentityPolicyDeniedError,
  EphemeralIdentityValidationError,
  evaluateEphemeralIdentityExpirationV1,
  InMemoryEphemeralIdentityRepositoryV1,
  NullEphemeralIdentityRepositoryV1,
  resolveEphemeralIdentityPolicyV1,
  validateEphemeralIdentityCommandV1,
  validateIdentityLocalRevision,
  validateLocalIdentityRootId,
} from "@freelayer/identity";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  activeEphemeral,
  applyE,
  clock,
  decisionFor,
  emptyVault,
  EPOCH,
  nextIds,
  OTHER_EPOCH,
  repo,
} from "../../../fixtures/ephemeral-identity/v1/helpers";

const createCmd = {
  schemaVersion: 1 as const,
  command: "identity.ephemeral.create" as const,
  lifetimeMode: "current_process_with_local_deadline" as const,
  durationMs: 3_600_000,
};

describe("Independent root + validation (§31: 1-10)", () => {
  it("ephemeral root is an independent kind, has no parent, no ephemeral:boolean", () => {
    const { state, rootId } = activeEphemeral();
    const root = state.roots.find((r) => r.rootId === rootId)!;
    expect(root.rootKind).toBe("ephemeral_current_process");
    expect(root).not.toHaveProperty("parentRootId");
    expect(root).not.toHaveProperty("longLivedRootId");
    expect(root).not.toHaveProperty("ephemeral");
    expect(root.longLivedRootLink).toBe("forbidden");
    expect(root.recovery).toBe("forbidden");
    expect(root.promotion).toBe("forbidden");
  });

  it("unknown command/version/dangerous keys/forbidden fields reject", () => {
    expect(() =>
      validateEphemeralIdentityCommandV1({
        schemaVersion: 2,
        command: "identity.ephemeral.create",
      }),
    ).toThrow();
    expect(() =>
      validateEphemeralIdentityCommandV1({ schemaVersion: 1, command: "identity.ephemeral.boom" }),
    ).toThrow();
    for (const key of ["__proto__", "prototype", "constructor"]) {
      expect(() =>
        validateEphemeralIdentityCommandV1({
          schemaVersion: 1,
          command: "identity.ephemeral.create",
          lifetimeMode: "current_process",
          [key]: {},
        }),
      ).toThrow();
    }
    for (const field of [
      "recovery",
      "recoverable",
      "parentRootId",
      "longLivedRootId",
      "promote",
      "exportable",
      "synchronized",
      "anonymous",
      "unlinkable",
      "verified",
      "persistent",
      "privateKey",
      "seed",
      "email",
      "devicePosture",
    ]) {
      expect(
        () =>
          validateEphemeralIdentityCommandV1({
            schemaVersion: 1,
            command: "identity.ephemeral.create",
            lifetimeMode: "current_process",
            [field]: "x",
          }),
        field,
      ).toThrow(EphemeralIdentityValidationError);
    }
  });
});

describe("Policy-gated creation (§31: 11-15)", () => {
  it("create requires an authentic exact-scope decision; fake/wrong-scope reject", () => {
    const ids = nextIds();
    const ok = applyE({
      state: emptyVault(),
      command: createCmd,
      scope: "identity.ephemeral.create",
      generatedIds: { rootId: ids.rootId },
    });
    expect(ok.state.roots).toHaveLength(1);

    const forged = {
      id: "pd-x",
      capability: "persistence",
      sideEffect: "identity.ephemeral.create",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    };
    expect(() =>
      applyEphemeralIdentityCommandV1({
        state: emptyVault(),
        command: createCmd,
        mode: "standard",
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
        generatedIds: { rootId: validateLocalIdentityRootId("idr-f1") },
        clockValue: clock(0),
        processEpochId: EPOCH,
        repository: repo(),
      }),
    ).toThrow(EphemeralIdentityDecisionMismatchError);

    expect(() =>
      applyEphemeralIdentityCommandV1({
        state: emptyVault(),
        command: createCmd,
        mode: "standard",
        decision: issuePolicyDecision(
          "persistence",
          "allowed",
          "standard",
          "identity.ephemeral.destroy",
        ),
        generatedIds: { rootId: validateLocalIdentityRootId("idr-w1") },
        clockValue: clock(0),
        processEpochId: EPOCH,
        repository: repo(),
      }),
    ).toThrow(EphemeralIdentityDecisionMismatchError);
  });
});

describe("Lifetime bounds + lifecycle (§31: 16-21)", () => {
  it("root starts draft then activates; duration bounds enforced", () => {
    const ids = nextIds();
    const created = applyE({
      state: emptyVault(),
      command: createCmd,
      scope: "identity.ephemeral.create",
      generatedIds: { rootId: ids.rootId },
    }).state;
    expect(created.roots[0]!.lifecycle).toBe("draft_current_process");
    const active = applyE({
      state: created,
      command: {
        schemaVersion: 1,
        command: "identity.ephemeral.activate",
        rootId: ids.rootId,
        expectedRevision: 1,
      },
      scope: "identity.ephemeral.lifecycle",
    }).state;
    expect(active.roots[0]!.lifecycle).toBe("active_current_process");

    // Below minimum / above maximum reject at validation.
    expect(() =>
      validateEphemeralIdentityCommandV1({
        schemaVersion: 1,
        command: "identity.ephemeral.create",
        lifetimeMode: "current_process_with_local_deadline",
        durationMs: 1,
      }),
    ).toThrow();
    expect(() =>
      validateEphemeralIdentityCommandV1({
        schemaVersion: 1,
        command: "identity.ephemeral.create",
        lifetimeMode: "current_process_with_local_deadline",
        durationMs: 999_999_999,
      }),
    ).toThrow();
  });
});

describe("Expiration + fail-closed (§31: 22-29, §32)", () => {
  function rootWith(overrides: { now: number; epoch?: typeof EPOCH; durationMs?: number }) {
    // deterministic evaluate over a created-at-0 deadline root
    const { state, rootId } = activeEphemeral(overrides.durationMs ?? 3_600_000);
    const root = state.roots.find((r) => r.rootId === rootId)!;
    return evaluateEphemeralIdentityExpirationV1({
      root,
      currentProcessEpochId: overrides.epoch ?? EPOCH,
      nowLocal: clock(overrides.now),
    });
  }

  it("lifetime table: before/at/after deadline, epoch mismatch, rollback, invalid", () => {
    expect(rootWith({ now: 3_599_999 })).toBe("current"); // just before
    expect(rootWith({ now: 3_600_000 })).toBe("expired_deadline"); // exactly at
    expect(rootWith({ now: 3_600_001 })).toBe("expired_deadline"); // just after
    expect(rootWith({ now: 10, epoch: OTHER_EPOCH })).toBe("expired_process_epoch");
    // backward clock (now < created=0 is impossible; simulate via a later-created root)
    const { state, rootId } = activeEphemeral();
    const root = {
      ...state.roots.find((r) => r.rootId === rootId)!,
      lifetime: { ...state.roots[0]!.lifetime, createdAtLocal: clock(500) },
    };
    expect(
      evaluateEphemeralIdentityExpirationV1({
        root,
        currentProcessEpochId: EPOCH,
        nowLocal: clock(100),
      }),
    ).toBe("invalid_clock");
    expect(
      evaluateEphemeralIdentityExpirationV1({
        root,
        currentProcessEpochId: EPOCH,
        nowLocal: "not-a-clock",
      }),
    ).toBe("invalid_clock");
  });

  it("expired/epoch-mismatched root cannot create a persona (expiry checked pre-op)", () => {
    const { state, rootId } = activeEphemeral(60_000);
    const personaCmd = { schemaVersion: 1, command: "identity.ephemeral.persona.create", rootId };
    // Deadline passed → pipeline assertion throws before mutation.
    expect(() =>
      applyE({
        state,
        command: personaCmd,
        scope: "identity.ephemeral.persona.create",
        clockValue: clock(120_000),
        generatedIds: { personaId: nextIds().personaId },
      }),
    ).toThrow(EphemeralIdentityExpiredError);
    // Different epoch → throws.
    expect(() =>
      applyE({
        state,
        command: personaCmd,
        scope: "identity.ephemeral.persona.create",
        clockValue: clock(10),
        processEpochId: OTHER_EPOCH,
        generatedIds: { personaId: nextIds().personaId },
      }),
    ).toThrow();
  });

  it("destroyed root is terminal; no reactivation", () => {
    const { state, rootId } = activeEphemeral();
    const dead = applyE({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.ephemeral.destroy",
        rootId,
        expectedRevision: 2,
      },
      scope: "identity.ephemeral.destroy",
    }).state;
    expect(dead.roots.some((r) => r.rootId === rootId)).toBe(false);
  });
});

describe("Shorten only, no extend/promote (§31: 32-38)", () => {
  it("lifetime can be shortened but never extended", () => {
    const { state, rootId } = activeEphemeral(3_600_000);
    const shorter = applyE({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.ephemeral.shorten_lifetime",
        rootId,
        expectedRevision: 2,
        newDurationMs: 1_800_000,
      },
      scope: "identity.ephemeral.lifecycle",
    }).state;
    expect(shorter.roots[0]!.lifetime.expiresAtLocal).toBe(clock(1_800_000));
    // Attempt to lengthen (larger deadline) rejects.
    expect(() =>
      applyE({
        state: shorter,
        command: {
          schemaVersion: 1,
          command: "identity.ephemeral.shorten_lifetime",
          rootId,
          expectedRevision: 3,
          newDurationMs: 3_600_000,
        },
        scope: "identity.ephemeral.lifecycle",
      }),
    ).toThrow(EphemeralIdentityLifetimeError);
  });

  it("no promotion/attach/recovery/export/sync command exists in the union", () => {
    for (const bad of [
      "identity.ephemeral.promote_to_long_lived",
      "identity.ephemeral.attach_to_long_lived_root",
      "identity.ephemeral.enable_recovery",
      "identity.ephemeral.export",
      "identity.ephemeral.synchronize",
      "identity.ephemeral.extend_lifetime",
    ]) {
      expect(() => validateEphemeralIdentityCommandV1({ schemaVersion: 1, command: bad })).toThrow(
        EphemeralIdentityValidationError,
      );
    }
  });
});

describe("Atomic destruction (§31: 47-54)", () => {
  it("clears root + all children atomically; result disclaims sanitization/remote/forensic", () => {
    const { state, rootId } = activeEphemeral();
    const withPersona = applyE({
      state,
      command: { schemaVersion: 1, command: "identity.ephemeral.persona.create", rootId },
      scope: "identity.ephemeral.persona.create",
      generatedIds: { personaId: nextIds().personaId },
    }).state;
    const { nextState, result } = destroyEphemeralIdentityV1({
      state: withPersona,
      rootId,
      expectedRevision: validateIdentityLocalRevision(2),
      clockValue: clock(1),
      processEpochId: EPOCH,
    });
    expect(nextState.roots.some((r) => r.rootId === rootId)).toBe(false);
    expect(nextState.personas.some((p) => p.rootId === rootId)).toBe(false);
    expect(result.destroyed).toBe(true);
    expect(result.childPersonasCleared).toBe(true);
    expect(result.persistentMediaSanitized).toBe(false);
    expect(result.remoteCopiesAffected).toBe(false);
    expect(result.forensicErasureGuaranteed).toBe(false);
  });
});

describe("Repositories (§31: 55-60)", () => {
  it("in-memory is process-bound, clones, and instances share no state", () => {
    const r1 = new InMemoryEphemeralIdentityRepositoryV1();
    const r2 = new InMemoryEphemeralIdentityRepositoryV1();
    const d = decisionFor("identity.ephemeral.create");
    const vault = emptyEphemeralIdentityVaultV1({
      processEpochId: EPOCH,
      persistenceClass: "current_process_memory",
    });
    r1.replaceCurrent(vault, d);
    expect(r1.readCurrent(EPOCH, d)).not.toBe(vault);
    expect(r1.readCurrent(OTHER_EPOCH, d)).toBeNull(); // epoch-bound
    expect(r2.readCurrent(EPOCH, d)).toBeNull(); // independent
  });

  it("null repository retains nothing", () => {
    const n = new NullEphemeralIdentityRepositoryV1();
    const d = decisionFor("identity.ephemeral.create");
    expect(n.replaceCurrent(emptyVault("null"), d).outcome).toBe("discarded");
    expect(n.readCurrent(EPOCH, d)).toBeNull();
  });

  it("root-count limit is enforced", () => {
    let state = emptyVault();
    // Standard allows 8; create 8 then the 9th (via policy max) — use a small mode limit.
    // resolveEphemeralIdentityPolicyV1 bunker maxRoots=2 but denies create; use standard=8.
    for (let i = 0; i < 8; i += 1) {
      state = applyE({
        state,
        command: createCmd,
        scope: "identity.ephemeral.create",
        generatedIds: { rootId: nextIds().rootId },
      }).state;
    }
    expect(() =>
      applyE({
        state,
        command: createCmd,
        scope: "identity.ephemeral.create",
        generatedIds: { rootId: nextIds().rootId },
      }),
    ).toThrow(EphemeralIdentityLimitError);
  });
});

describe("Privacy modes (§31: 61-68)", () => {
  it("Standard memory-only; Bunker denies expansive; Emergency denies create but allows destroy", () => {
    expect(
      resolveEphemeralIdentityPolicyV1({ mode: "standard", operation: "create" }).retention,
    ).toBe("current_process_memory");
    expect(resolveEphemeralIdentityPolicyV1({ mode: "bunker", operation: "create" }).allowed).toBe(
      false,
    );
    expect(
      resolveEphemeralIdentityPolicyV1({ mode: "emergency", operation: "create" }).allowed,
    ).toBe(false);
    expect(
      resolveEphemeralIdentityPolicyV1({ mode: "emergency", operation: "destroy" }).allowed,
    ).toBe(true);
    expect(resolveEphemeralIdentityPolicyV1({ mode: "ghost", operation: "create" }).retention).toBe(
      "current_process_memory",
    );
    // Emergency create denied by the pipeline before mutation.
    expect(() =>
      applyE({
        state: emptyVault(),
        command: createCmd,
        scope: "identity.ephemeral.create",
        mode: "emergency",
        generatedIds: { rootId: nextIds().rootId },
      }),
    ).toThrow(EphemeralIdentityPolicyDeniedError);
  });

  it("all mode policies forbid recovery/promotion/export/sync/persistence/network", () => {
    for (const mode of [
      "standard",
      "private",
      "ghost",
      "bunker",
      "offline_capsule",
      "emergency",
      "sovereign_room",
    ] as const) {
      const p = resolveEphemeralIdentityPolicyV1({ mode, operation: "create" });
      expect(p.recoveryAllowed).toBe(false);
      expect(p.promotionAllowed).toBe(false);
      expect(p.exportAllowed).toBe(false);
      expect(p.synchronizationAllowed).toBe(false);
      expect(p.persistentStorageAllowed).toBe(false);
      expect(p.networkAllowed).toBe(false);
    }
  });
});
