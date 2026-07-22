/**
 * Privacy-regression (TECH-ID-05): per-contact aliases — opaque ids, NFC
 * normalization + dangerous-control rejection, relationship-scoped presentation
 * aliases + private local peer labels, local reuse warnings, rotation preserving
 * continuity, policy-gated redacted display contexts, memory/null retention.
 * Covers §30 (1-68).
 */
import { describe, expect, it } from "vitest";
import {
  applyContactAliasCommandV1,
  assessContactAliasReuseV1,
  buildContactDisplayContextV1,
  ContactAliasDecisionMismatchError,
  ContactAliasDuplicateActiveError,
  ContactAliasPolicyDeniedError,
  ContactAliasValidationError,
  InMemoryContactAliasRepositoryV1,
  NullContactAliasRepositoryV1,
  normalizeContactAliasDisplayTextV1,
  resolveContactAliasPolicyV1,
  validateContactAliasCommandV1,
  validateContactAliasId,
} from "@freelayer/identity";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  activeAlias,
  applyA,
  CLOCK,
  decisionFor,
  emptyState,
  nextIds,
  ref,
  repo,
} from "../../../fixtures/contact-aliases/v1/helpers";

describe("Identifiers + normalization (§30: 1-16)", () => {
  it("alias id is opaque local; contains no display text / root data", () => {
    expect(validateContactAliasId("alias-a1")).toBe("alias-a1");
    expect(() => validateContactAliasId("alias-Blue Fox")).toThrow();
    expect(() => validateContactAliasId("alias-a@b")).toThrow();
    expect(() => validateContactAliasId("idr-1")).toThrow(); // wrong prefix
  });

  it("normalizes to NFC and rejects dangerous controls (empty/NUL/bidi/zero-width)", () => {
    // Decomposed é (e + U+0301) → NFC precomposed é.
    const n = normalizeContactAliasDisplayTextV1("é");
    expect(n.normalizedValue).toBe("é");
    expect(n.normalization).toBe("unicode_nfc");
    const bad = [
      "",
      "   ",
      "a\u0000b",
      "a\u0001b",
      "a\u200bb",
      "a\u202eb",
      "a\u2066b",
      "a\u2028b",
      "a\ufeffb",
    ];
    for (const value of bad) {
      expect(() => normalizeContactAliasDisplayTextV1(value)).toThrow();
    }
  });

  it("retains ZWJ/ZWNJ + legitimate international text; enforces limits", () => {
    expect(normalizeContactAliasDisplayTextV1("\u067e\u200c\u06cc").scalarLength).toBeGreaterThan(
      0,
    ); // Persian w/ ZWNJ
    expect(
      normalizeContactAliasDisplayTextV1("\u{1f469}\u200d\u{1f4bb}").scalarLength,
    ).toBeGreaterThan(0); // ZWJ emoji
    expect(() => normalizeContactAliasDisplayTextV1("x".repeat(65))).toThrow(); // > max scalar
  });
});

describe("Command validation (§30: 17-20)", () => {
  it("unknown command / dangerous keys / authority+public fields reject", () => {
    expect(() =>
      validateContactAliasCommandV1({ schemaVersion: 1, command: "identity.alias.boom" }),
    ).toThrow();
    for (const key of ["__proto__", "prototype", "constructor"]) {
      expect(() =>
        validateContactAliasCommandV1({
          schemaVersion: 1,
          command: "identity.alias.presentation.retire",
          aliasId: "alias-a1",
          expectedRevision: 1,
          [key]: {},
        }),
      ).toThrow();
    }
    for (const field of [
      "verified",
      "trusted",
      "authenticated",
      "public",
      "global",
      "searchable",
      "uniqueUsername",
      "handle",
      "phone",
      "email",
      "did",
      "publicKey",
      "rootPublicId",
      "devicePosture",
      "roomRole",
      "peerShared",
      "securityAssessment",
      "sharingState",
    ]) {
      expect(
        () =>
          validateContactAliasCommandV1({
            schemaVersion: 1,
            command: "identity.alias.presentation.retire",
            aliasId: "alias-a1",
            expectedRevision: 1,
            [field]: "x",
          }),
        field,
      ).toThrow(ContactAliasValidationError);
    }
  });
});

describe("Presentation alias lifecycle + policy gating (§30: 21-31, 36-37)", () => {
  it("create requires ref match + exact decision; alias text authorizes nothing", () => {
    const r = ref();
    const create = {
      schemaVersion: 1,
      command: "identity.alias.presentation.create",
      relationshipId: r.relationshipId,
      rootId: r.rootId,
      personaId: r.personaId,
      displayText: "Blue Fox",
    };
    const ok = applyA({
      state: emptyState(),
      command: create,
      scope: "identity.alias.presentation.create",
      relationshipRef: r,
      generatedIds: { aliasId: nextIds().aliasId },
    });
    expect(ok.state.presentationAliases[0]!.sharingState).toBe("not_shared_tech_id_05");
    expect(ok.state.presentationAliases[0]!.lifecycle).toBe("draft_local");

    // Fake + wrong-scope decisions reject.
    const forged = {
      id: "pd",
      capability: "persistence",
      sideEffect: "identity.alias.presentation.create",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    };
    expect(() =>
      applyContactAliasCommandV1({
        state: emptyState(),
        command: create,
        mode: "standard",
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
        relationshipRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
        clockValue: CLOCK,
        repository: repo(),
      }),
    ).toThrow(ContactAliasDecisionMismatchError);
    expect(() =>
      applyContactAliasCommandV1({
        state: emptyState(),
        command: create,
        mode: "standard",
        decision: issuePolicyDecision(
          "persistence",
          "allowed",
          "standard",
          "identity.alias.display_context.read",
        ),
        relationshipRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
        clockValue: CLOCK,
        repository: repo(),
      }),
    ).toThrow(ContactAliasDecisionMismatchError);
  });

  it("alias cannot transfer to another relationship; ref mismatch rejects", () => {
    const r = ref();
    const create = {
      schemaVersion: 1,
      command: "identity.alias.presentation.create",
      relationshipId: r.relationshipId,
      rootId: r.rootId,
      personaId: r.personaId,
      displayText: "Blue Fox",
    };
    // Ref describes a DIFFERENT relationship than the command → mismatch.
    expect(() =>
      applyA({
        state: emptyState(),
        command: create,
        scope: "identity.alias.presentation.create",
        relationshipRef: ref({ relationshipId: "idrel-other" as never }),
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow();
  });

  it("at most one active presentation alias per relationship", () => {
    const { state } = activeAlias();
    const r = ref();
    // Another create while an active alias exists → duplicate active.
    expect(() =>
      applyA({
        state,
        command: {
          schemaVersion: 1,
          command: "identity.alias.presentation.create",
          relationshipId: r.relationshipId,
          rootId: r.rootId,
          personaId: r.personaId,
          displayText: "Red Fox",
        },
        scope: "identity.alias.presentation.create",
        relationshipRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow(ContactAliasDuplicateActiveError);
  });
});

describe("Reuse assessment (§30: 32-35)", () => {
  it("duplicate visible aliases are allowed but locally warned; no ids/counts exposed", () => {
    const { state } = activeAlias("Blue Fox", ref());
    const other = ref({ relationshipId: "idrel-two" as never });
    const assessment = assessContactAliasReuseV1({
      state,
      normalizedValue: normalizeContactAliasDisplayTextV1("Blue Fox").normalizedValue,
      forRelationshipId: other.relationshipId,
    });
    expect(assessment.normalizedValueReused).toBe(true);
    expect(assessment.relationshipIdsExposed).toBe(false);
    expect(assessment.otherRelationshipCountExposed).toBe(false);
    // A unique value does not claim unlinkability.
    const uniq = assessContactAliasReuseV1({
      state,
      normalizedValue: normalizeContactAliasDisplayTextV1("Green Owl").normalizedValue,
      forRelationshipId: other.relationshipId,
    });
    expect(uniq.normalizedValueReused).toBe(false);
  });
});

describe("Rotation (§30: 38-45)", () => {
  it("rotate retires old alias, creates new active, preserves relationship id, no remote deletion", () => {
    const { state, aliasId } = activeAlias("Blue Fox");
    const r = ref();
    const rotated = applyA({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.alias.presentation.rotate",
        relationshipId: r.relationshipId,
        rootId: r.rootId,
        personaId: r.personaId,
        currentAliasId: aliasId,
        currentExpectedRevision: 2,
        newDisplayText: "Red Fox",
      },
      scope: "identity.alias.presentation.rotate",
      relationshipRef: r,
      generatedIds: { aliasId: nextIds().aliasId },
    }).state;
    const old = rotated.presentationAliases.find((a) => a.aliasId === aliasId)!;
    const fresh = rotated.presentationAliases.find((a) => a.lifecycle === "active_local_unshared")!;
    expect(old.lifecycle).toBe("retired_tombstone");
    expect(fresh.relationshipId).toBe(r.relationshipId);
    expect(fresh.displayText.normalizedValue).toBe("Red Fox");
    expect(fresh.sharingState).toBe("not_shared_tech_id_05");
    // Retired alias cannot reactivate.
    expect(() =>
      applyA({
        state: rotated,
        command: {
          schemaVersion: 1,
          command: "identity.alias.presentation.activate",
          aliasId,
          expectedRevision: 3,
        },
        scope: "identity.alias.presentation.lifecycle",
      }),
    ).toThrow();
  });
});

describe("Local peer label (§30: 46-49)", () => {
  it("set requires ref; replace keeps no old plaintext; clear removes record", () => {
    const r = ref();
    const labelId = nextIds().labelId;
    const set = applyA({
      state: emptyState(),
      command: {
        schemaVersion: 1,
        command: "identity.alias.local_peer_label.set",
        relationshipId: r.relationshipId,
        rootId: r.rootId,
        personaId: r.personaId,
        labelText: "Neighbor A",
      },
      scope: "identity.alias.local_peer_label.write",
      relationshipRef: r,
      generatedIds: { labelId },
    }).state;
    expect(set.localPeerLabels[0]!.visibility).toBe("local_only");
    expect(set.localPeerLabels[0]!.peerShared).toBe(false);
    const replaced = applyA({
      state: set,
      command: {
        schemaVersion: 1,
        command: "identity.alias.local_peer_label.replace",
        labelId,
        expectedRevision: 1,
        labelText: "Neighbor B",
      },
      scope: "identity.alias.local_peer_label.write",
    }).state;
    expect(replaced.localPeerLabels[0]!.labelText.normalizedValue).toBe("Neighbor B");
    expect(JSON.stringify(replaced)).not.toContain("Neighbor A"); // no old plaintext
    const cleared = applyA({
      state: replaced,
      command: {
        schemaVersion: 1,
        command: "identity.alias.local_peer_label.clear",
        labelId,
        expectedRevision: 2,
      },
      scope: "identity.alias.local_peer_label.clear",
    }).state;
    expect(cleared.localPeerLabels).toHaveLength(0);
  });
});

describe("Display context + policy modes (§30: 57-62)", () => {
  it("display context returns trust separately, alias not verified; Ghost denies labels", () => {
    const { state } = activeAlias("Blue Fox");
    const ctx = buildContactDisplayContextV1({
      ref: ref(),
      state,
      policy: resolveContactAliasPolicyV1({ mode: "standard", operation: "display_context.read" }),
    });
    expect(ctx.aliasVerified).toBe(false);
    expect(ctx.realWorldIdentityVerified).toBe(false);
    expect(ctx.selfPresentationAlias).toBe("Blue Fox");
    expect(ctx.relationshipAssurance).toBe("unverified_local");
    // Private redacts ids.
    const priv = buildContactDisplayContextV1({
      ref: ref(),
      state,
      policy: resolveContactAliasPolicyV1({ mode: "private", operation: "display_context.read" }),
    });
    expect(priv.redacted).toBe(true);
    expect(priv.relationshipId).toBeUndefined();
    // Ghost denies local peer labels; Emergency denies create.
    expect(
      resolveContactAliasPolicyV1({ mode: "ghost", operation: "local_peer_label.set" }).allowed,
    ).toBe(false);
    expect(
      resolveContactAliasPolicyV1({ mode: "emergency", operation: "presentation.create" }).allowed,
    ).toBe(false);
    expect(
      resolveContactAliasPolicyV1({ mode: "emergency", operation: "presentation.retire" }).allowed,
    ).toBe(true);
  });

  it("Emergency create denied by the pipeline before mutation", () => {
    const r = ref();
    expect(() =>
      applyA({
        state: emptyState(),
        command: {
          schemaVersion: 1,
          command: "identity.alias.presentation.create",
          relationshipId: r.relationshipId,
          rootId: r.rootId,
          personaId: r.personaId,
          displayText: "Blue Fox",
        },
        scope: "identity.alias.presentation.create",
        mode: "emergency",
        relationshipRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow(ContactAliasPolicyDeniedError);
  });
});

describe("Repositories (§30: 61-63)", () => {
  it("in-memory clones; null retains nothing", () => {
    const m = new InMemoryContactAliasRepositoryV1();
    const d = decisionFor("identity.alias.presentation.create");
    const st = emptyState();
    m.replace(st, d);
    expect(m.read(d)).not.toBe(st);
    const n = new NullContactAliasRepositoryV1();
    expect(n.replace(st, d).outcome).toBe("discarded");
    expect(n.read(d)).toBeNull();
  });
});
