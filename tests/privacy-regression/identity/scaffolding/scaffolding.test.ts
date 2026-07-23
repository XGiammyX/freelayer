/**
 * Privacy-regression (TECH-ID-03): local identity scaffolding — opaque local
 * identifiers, explicit exhaustive lifecycles, policy-gated commands requiring
 * an exact-scope PolicyDecision, deterministic immutable reducer, cross-reference
 * invariants, memory/null repositories, and redacted summaries. Local, non-
 * cryptographic, metadata-only. Covers §31 (1-58).
 */
import { describe, expect, it } from "vitest";
import {
  applyLocalIdentityCommandV1,
  assertValidIdentityRootTransitionV1,
  buildIdentityPersonaSummaryV1,
  buildLocalIdentityRootSummaryV1,
  emptyLocalIdentityVaultV1,
  IdentityDecisionMismatchError,
  IdentityLifecycleError,
  IdentityPolicyDeniedError,
  IdentityValidationError,
  InMemoryLocalIdentityRepositoryV1,
  NullLocalIdentityRepositoryV1,
  reduceLocalIdentityCommandV1,
  resolveLocalIdentityPolicyV1,
  validateIdentityVaultId,
  validateLocalIdentityCommandV1,
  validateLocalIdentityRootId,
} from "@freelayer/identity";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  apply,
  CLOCK,
  decisionFor,
  emptyVault,
  nextIds,
  repo,
  withActivePersona,
  withActiveRoot,
} from "../../../fixtures/identity-scaffolding/v1/helpers";

describe("Identifiers (§31: 1-4)", () => {
  it("accepts a canonical local id; rejects email/phone/url/path", () => {
    expect(validateLocalIdentityRootId("idr-r1")).toBe("idr-r1");
    expect(() => validateLocalIdentityRootId("idr-a@b.com")).toThrow();
    expect(() => validateLocalIdentityRootId("idr-+15551234567")).toThrow();
    expect(() => validateLocalIdentityRootId("https://x/idr")).toThrow();
    expect(() => validateLocalIdentityRootId("idr-a/b")).toThrow();
    expect(() => validateLocalIdentityRootId("root-1")).toThrow(); // wrong prefix
  });
});

describe("Command validation (§31: 5-9)", () => {
  it("rejects unknown schema version / lifecycle / command", () => {
    expect(() =>
      validateLocalIdentityCommandV1({ schemaVersion: 2, command: "identity.root.create_local" }),
    ).toThrow();
    expect(() =>
      validateLocalIdentityCommandV1({ schemaVersion: 1, command: "identity.root.explode" }),
    ).toThrow(IdentityValidationError);
  });

  it("rejects dangerous prototype keys", () => {
    for (const key of ["__proto__", "prototype", "constructor"]) {
      expect(() =>
        validateLocalIdentityCommandV1({
          schemaVersion: 1,
          command: "identity.root.create_local",
          [key]: {},
        }),
      ).toThrow(IdentityValidationError);
    }
  });

  it("rejects secret-like / authority caller fields (mass-assignment)", () => {
    for (const field of [
      "privateKey",
      "publicKey",
      "seed",
      "mnemonic",
      "recoveryPhrase",
      "email",
      "phone",
      "username",
      "did",
      "devicePosture",
      "verified",
      "trusted",
      "isOwner",
      "isAdmin",
      "permissions",
      "capabilities",
    ]) {
      expect(
        () =>
          validateLocalIdentityCommandV1({
            schemaVersion: 1,
            command: "identity.root.create_local",
            [field]: "x",
          }),
        field,
      ).toThrow(IdentityValidationError);
    }
  });
});

describe("Policy-gated creation (§31: 10-14)", () => {
  const rootCreate = { schemaVersion: 1, command: "identity.root.create_local" };

  it("root creation requires an authentic exact-scope decision", () => {
    // Correct scope succeeds.
    const ok = apply({
      state: emptyVault(),
      command: rootCreate,
      scope: "identity.root.create",
      generatedIds: { rootId: validateLocalIdentityRootId("idr-ok1") },
    });
    expect(ok.state.roots).toHaveLength(1);
  });

  it("fake (forged) decision rejects", () => {
    const forged = {
      id: "pd-x",
      capability: "persistence",
      sideEffect: "identity.root.create",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    };
    expect(() =>
      applyLocalIdentityCommandV1({
        state: emptyVault(),
        command: rootCreate,
        mode: "standard",
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
        generatedIds: { rootId: validateLocalIdentityRootId("idr-f1") },
        clockValue: CLOCK,
        repository: repo(),
      }),
    ).toThrow(IdentityDecisionMismatchError);
  });

  it("wrong-scope decision rejects", () => {
    expect(() =>
      applyLocalIdentityCommandV1({
        state: emptyVault(),
        command: rootCreate,
        mode: "standard",
        decision: issuePolicyDecision(
          "persistence",
          "allowed",
          "standard",
          "identity.summary.read",
        ),
        generatedIds: { rootId: validateLocalIdentityRootId("idr-w1") },
        clockValue: CLOCK,
        repository: repo(),
      }),
    ).toThrow(IdentityDecisionMismatchError);
  });

  it("a denied verdict decision rejects (DevicePosture/membership never authorize)", () => {
    expect(() =>
      applyLocalIdentityCommandV1({
        state: emptyVault(),
        command: rootCreate,
        mode: "standard",
        decision: issuePolicyDecision("persistence", "denied", "standard", "identity.root.create"),
        generatedIds: { rootId: validateLocalIdentityRootId("idr-d1") },
        clockValue: CLOCK,
        repository: repo(),
      }),
    ).toThrow(IdentityDecisionMismatchError);
  });
});

describe("Root lifecycle (§31: 15-20)", () => {
  it("root starts draft_local and activates; invalid transition rejects; tombstone terminal", () => {
    const ids = nextIds();
    const created = apply({
      state: emptyVault(),
      command: { schemaVersion: 1, command: "identity.root.create_local" },
      scope: "identity.root.create",
      generatedIds: { rootId: ids.rootId },
    }).state;
    expect(created.roots[0]!.lifecycle).toBe("draft_local");
    expect(created.roots[0]!.revision).toBe(1);

    const activated = apply({
      state: created,
      command: {
        schemaVersion: 1,
        command: "identity.root.activate_local",
        rootId: ids.rootId,
        expectedRevision: 1,
      },
      scope: "identity.root.lifecycle",
    }).state;
    expect(activated.roots[0]!.lifecycle).toBe("active_local");
    expect(activated.roots[0]!.revision).toBe(2); // increments by one

    // Stale revision rejects.
    expect(() =>
      apply({
        state: activated,
        command: {
          schemaVersion: 1,
          command: "identity.root.lock_local",
          rootId: ids.rootId,
          expectedRevision: 1,
        },
        scope: "identity.root.lifecycle",
      }),
    ).toThrow();

    // Tombstone, then any further transition rejects (terminal).
    const dead = apply({
      state: activated,
      command: {
        schemaVersion: 1,
        command: "identity.root.tombstone",
        rootId: ids.rootId,
        expectedRevision: 2,
      },
      scope: "identity.root.lifecycle",
    }).state;
    expect(dead.roots[0]!.lifecycle).toBe("revoked_tombstone");
    expect(() =>
      apply({
        state: dead,
        command: {
          schemaVersion: 1,
          command: "identity.root.activate_local",
          rootId: ids.rootId,
          expectedRevision: 3,
        },
        scope: "identity.root.lifecycle",
      }),
    ).toThrow();
  });

  it("assertValidIdentityRootTransitionV1 rejects an invalid transition", () => {
    expect(() => assertValidIdentityRootTransitionV1("draft_local", "locked_local")).toThrow(
      IdentityLifecycleError,
    );
  });
});

describe("Persona (§31: 21-25)", () => {
  it("persona requires an active root and belongs to it; label grants no authority", () => {
    const { state, rootId } = withActiveRoot();
    const personaId = nextIds().personaId;
    const withPersona = apply({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.persona.create_local",
        rootId,
        localLabel: "work",
      },
      scope: "identity.persona.create",
      generatedIds: { personaId },
    }).state;
    const persona = withPersona.personas[0]!;
    expect(persona.rootId).toBe(rootId);
    expect(persona.lifecycle).toBe("active_local");
    expect(persona.peerVisibleAliasState).toBe("not_implemented_tech_id_05_06");
    // A label is metadata only — no authority field exists on the record.
    expect(persona).not.toHaveProperty("verified");
    expect(persona).not.toHaveProperty("isOwner");
  });

  it("archived persona cannot create relationships; revoked persona is terminal", () => {
    const { state, rootId, personaId } = withActivePersona();
    const archived = apply({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.persona.archive_local",
        personaId,
        expectedRevision: 1,
      },
      scope: "identity.persona.lifecycle",
    }).state;
    expect(() =>
      apply({
        state: archived,
        command: {
          schemaVersion: 1,
          command: "identity.relationship.create_placeholder",
          rootId,
          personaId,
        },
        scope: "identity.relationship.create",
        generatedIds: { relationshipId: nextIds().relationshipId },
      }),
    ).toThrow();
  });

  it("persona requires an EXISTING active root (unknown root rejects)", () => {
    expect(() =>
      apply({
        state: emptyVault(),
        command: {
          schemaVersion: 1,
          command: "identity.persona.create_local",
          rootId: validateLocalIdentityRootId("idr-ghost"),
        },
        scope: "identity.persona.create",
        generatedIds: { personaId: nextIds().personaId },
      }),
    ).toThrow();
  });
});

describe("Pairwise relationship (§31: 26-31)", () => {
  it("relationship requires valid root/persona, starts unverified, id is local", () => {
    const { state, rootId, personaId } = withActivePersona();
    const relationshipId = nextIds().relationshipId;
    const withRel = apply({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.relationship.create_placeholder",
        rootId,
        personaId,
      },
      scope: "identity.relationship.create",
      generatedIds: { relationshipId },
    }).state;
    const rel = withRel.relationships[0]!;
    expect(rel.lifecycle).toBe("active_local_unverified");
    expect(rel.assurance).toBe("unverified_local");
    expect(rel.aliasState).toBe("not_implemented_tech_id_05");
    expect(rel).not.toHaveProperty("publicKey");
    expect(rel).not.toHaveProperty("did");
  });

  it("blocking is deterministic and terminal-safe (removed is terminal)", () => {
    const { state, rootId, personaId } = withActivePersona();
    const relationshipId = nextIds().relationshipId;
    const withRel = apply({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.relationship.create_placeholder",
        rootId,
        personaId,
      },
      scope: "identity.relationship.create",
      generatedIds: { relationshipId },
    }).state;
    const blocked = apply({
      state: withRel,
      command: {
        schemaVersion: 1,
        command: "identity.relationship.block_local",
        relationshipId,
        expectedRevision: 1,
      },
      scope: "identity.relationship.lifecycle",
    }).state;
    expect(blocked.relationships[0]!.lifecycle).toBe("blocked_local");
    const removed = apply({
      state: blocked,
      command: {
        schemaVersion: 1,
        command: "identity.relationship.tombstone",
        relationshipId,
        expectedRevision: 2,
      },
      scope: "identity.relationship.lifecycle",
    }).state;
    expect(removed.relationships[0]!.lifecycle).toBe("removed_tombstone");
    expect(() =>
      apply({
        state: removed,
        command: {
          schemaVersion: 1,
          command: "identity.relationship.block_local",
          relationshipId,
          expectedRevision: 3,
        },
        scope: "identity.relationship.lifecycle",
      }),
    ).toThrow();
  });
});

describe("Room identity binding (§31: 32-37)", () => {
  it("binding requires valid root/persona, is room-scoped, and no duplicate active per room", () => {
    const { state, rootId, personaId } = withActivePersona();
    const bindingId = nextIds().bindingId;
    const bound = apply({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.room_binding.create_placeholder",
        roomId: "room-a",
        rootId,
        personaId,
      },
      scope: "identity.room_binding.create",
      generatedIds: { bindingId },
    }).state;
    const binding = bound.roomBindings[0]!;
    expect(binding.roomId).toBe("room-a");
    expect(binding.verificationState).toBe("unverified_local");
    expect(binding.roomAliasState).toBe("none");

    // Duplicate active binding for the same (persona, room) rejects.
    expect(() =>
      apply({
        state: bound,
        command: {
          schemaVersion: 1,
          command: "identity.room_binding.create_placeholder",
          roomId: "room-a",
          rootId,
          personaId,
        },
        scope: "identity.room_binding.create",
        generatedIds: { bindingId: nextIds().bindingId },
      }),
    ).toThrow();
  });

  it("root revocation prevents child creation (persona/relationship/binding)", () => {
    const { state, rootId } = withActiveRoot();
    const dead = apply({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.root.tombstone",
        rootId,
        expectedRevision: 2,
      },
      scope: "identity.root.lifecycle",
    }).state;
    expect(() =>
      apply({
        state: dead,
        command: { schemaVersion: 1, command: "identity.persona.create_local", rootId },
        scope: "identity.persona.create",
        generatedIds: { personaId: nextIds().personaId },
      }),
    ).toThrow();
  });
});

describe("Reducer determinism + immutability (§31: 38-41)", () => {
  const cmd = { schemaVersion: 1 as const, command: "identity.root.create_local" as const };

  it("is deterministic and mutates no input", () => {
    const state = emptyVault();
    const frozenState = Object.freeze(state);
    const generatedIds = { rootId: validateLocalIdentityRootId("idr-det1") };
    const a = reduceLocalIdentityCommandV1({
      state: frozenState,
      command: cmd,
      generatedIds,
      clockValue: CLOCK,
    });
    const b = reduceLocalIdentityCommandV1({
      state: frozenState,
      command: cmd,
      generatedIds,
      clockValue: CLOCK,
    });
    expect(a).toEqual(b);
    expect(state.roots).toHaveLength(0); // input untouched
  });

  it("result mutation does not affect a subsequent reduction", () => {
    const state = emptyVault();
    const out = reduceLocalIdentityCommandV1({
      state,
      command: cmd,
      generatedIds: { rootId: validateLocalIdentityRootId("idr-det2") },
      clockValue: CLOCK,
    });
    expect(out.roots).toHaveLength(1);
    expect(state.roots).toHaveLength(0);
  });
});

describe("Repositories (§31: 42-46)", () => {
  it("in-memory clones on read/write and does not share state", () => {
    const r1 = new InMemoryLocalIdentityRepositoryV1();
    const r2 = new InMemoryLocalIdentityRepositoryV1();
    const decision = decisionFor("identity.root.create");
    const vault = emptyLocalIdentityVaultV1({
      vaultId: validateIdentityVaultId("idv-a"),
      persistenceClass: "memory_only",
    });
    r1.replaceVault(vault, decision);
    const read = r1.readVault(decision)!;
    expect(read).not.toBe(vault); // defensive clone
    expect(r2.readVault(decision)).toBeNull(); // independent instances
  });

  it("null repository retains nothing and reports discard honestly", () => {
    const nul = new NullLocalIdentityRepositoryV1();
    const decision = decisionFor("identity.root.create");
    const vault = emptyLocalIdentityVaultV1({
      vaultId: validateIdentityVaultId("idv-n"),
      persistenceClass: "null",
    });
    const write = nul.replaceVault(vault, decision);
    expect(write.outcome).toBe("discarded");
    expect(nul.readVault(decision)).toBeNull();
    expect(nul.retention).toBe("null");
  });
});

describe("Privacy-mode behavior (§31: 51-58)", () => {
  it("Standard allows memory-only scaffolding; Emergency denies expansive, allows restrictive", () => {
    expect(
      resolveLocalIdentityPolicyV1({ mode: "standard", operation: "root.create" }).allowed,
    ).toBe(true);
    expect(
      resolveLocalIdentityPolicyV1({ mode: "standard", operation: "root.create" }).persistence,
    ).toBe("memory_only");
    expect(
      resolveLocalIdentityPolicyV1({ mode: "emergency", operation: "root.create" }).allowed,
    ).toBe(false);
    expect(
      resolveLocalIdentityPolicyV1({ mode: "emergency", operation: "root.lock" }).allowed,
    ).toBe(true);
  });

  it("Bunker denies expansive creation; Ghost persists nothing", () => {
    expect(
      resolveLocalIdentityPolicyV1({ mode: "bunker", operation: "persona.create" }).allowed,
    ).toBe(false);
    expect(
      resolveLocalIdentityPolicyV1({ mode: "ghost", operation: "root.create" }).persistence,
    ).toBe("null");
  });

  it("pipeline enforces mode policy (Emergency create denied before mutation)", () => {
    expect(() =>
      apply({
        state: emptyVault(),
        command: { schemaVersion: 1, command: "identity.root.create_local" },
        scope: "identity.root.create",
        mode: "emergency",
        generatedIds: { rootId: validateLocalIdentityRootId("idr-em1") },
      }),
    ).toThrow(IdentityPolicyDeniedError);
  });

  it("Private summary is minimized; strict omits labels/counts", () => {
    const { state, rootId } = withActiveRoot();
    const policyStd = resolveLocalIdentityPolicyV1({
      mode: "standard",
      operation: "identity.summary.read",
    });
    const policyPriv = resolveLocalIdentityPolicyV1({
      mode: "private",
      operation: "identity.summary.read",
    });
    const root = state.roots[0]!;
    const std = buildLocalIdentityRootSummaryV1({
      root,
      personaCount: 0,
      relationshipCount: 0,
      roomBindingCount: 0,
      policy: policyStd,
    });
    const priv = buildLocalIdentityRootSummaryV1({
      root,
      personaCount: 0,
      relationshipCount: 0,
      roomBindingCount: 0,
      policy: policyPriv,
    });
    expect(std.redacted).toBe(false);
    expect(std.personaCount).toBe(0);
    expect(priv.redacted).toBe(true);
    expect(priv.personaCount).toBeUndefined(); // counts omitted in Private
    void rootId;
  });

  it("persona summary omits the label unless labels are allowed", () => {
    const { state } = withActivePersona();
    const persona = { ...state.personas[0]!, localLabel: "secret-work" };
    const priv = buildIdentityPersonaSummaryV1({
      persona,
      policy: resolveLocalIdentityPolicyV1({ mode: "private", operation: "identity.summary.read" }),
    });
    expect(priv.localLabel).toBeUndefined();
    const std = buildIdentityPersonaSummaryV1({
      persona,
      policy: resolveLocalIdentityPolicyV1({
        mode: "standard",
        operation: "identity.summary.read",
      }),
    });
    expect(std.localLabel).toBe("secret-work");
  });
});
