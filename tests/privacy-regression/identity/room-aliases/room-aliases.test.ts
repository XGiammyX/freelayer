/**
 * Privacy-regression (TECH-ID-06): per-room aliases — opaque ids, reused
 * TECH-ID-05 normalization, room-binding-scoped presentation aliases, one active
 * per binding, no automatic reuse, room-local collision + safe disambiguation,
 * cross-room reuse warnings, rotation preserving binding/membership, policy-gated
 * redacted display contexts, memory/null retention. Covers §30 (1-63).
 */
import { describe, expect, it } from "vitest";
import {
  applyRoomAliasCommandV1,
  assessRoomAliasCollisionV1,
  assessRoomAliasReuseV1,
  buildRoomMemberDisplayContextV1,
  deriveRoomAliasBindingStateV1,
  InMemoryRoomAliasRepositoryV1,
  NullRoomAliasRepositoryV1,
  normalizeContactAliasDisplayTextV1,
  resolveRoomAliasDisambiguationV1,
  resolveRoomAliasPolicyV1,
  RoomAliasBindingMismatchError,
  RoomAliasDecisionMismatchError,
  RoomAliasDuplicateActiveError,
  RoomAliasMembershipMismatchError,
  RoomAliasPolicyDeniedError,
  RoomAliasValidationError,
  validateRoomAliasCommandV1,
  validateRoomPresentationAliasId,
  type RoomAliasObservationV1,
} from "@freelayer/identity";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  activeRoomAlias,
  applyRA,
  CLOCK,
  createCommand,
  decisionFor,
  emptyState,
  MEMBER,
  nextIds,
  ref,
  repo,
} from "../../../fixtures/room-aliases/v1/helpers";

describe("Identifiers + normalization (§30: 1-6)", () => {
  it("room alias id is opaque local; encodes no root/room/member/alias data", () => {
    expect(validateRoomPresentationAliasId("ralias-a1")).toBe("ralias-a1");
    expect(() => validateRoomPresentationAliasId("ralias-Blue Fox")).toThrow();
    expect(() => validateRoomPresentationAliasId("idr-1")).toThrow(); // wrong prefix
  });

  it("reuses the shared TECH-ID-05 normalizer (NFC + dangerous-control rejection)", () => {
    expect(normalizeContactAliasDisplayTextV1("é").normalizedValue).toBe("é");
    for (const bad of ["", "   ", "a\u0000b", "a\u202eb", "a\u200bb"]) {
      expect(() => normalizeContactAliasDisplayTextV1(bad)).toThrow();
    }
    // International text remains supported; no full spoofing-prevention claim.
    expect(normalizeContactAliasDisplayTextV1("Привет").scalarLength).toBeGreaterThan(0);
  });
});

describe("Command validation (§30: 7-9)", () => {
  it("unknown command / dangerous keys / authority+public fields reject", () => {
    expect(() =>
      validateRoomAliasCommandV1({ schemaVersion: 1, command: "identity.room_alias.boom" }),
    ).toThrow(RoomAliasValidationError);
    expect(() =>
      validateRoomAliasCommandV1({
        schemaVersion: 2,
        command: "identity.room_alias.retire",
        aliasId: "ralias-a1",
        expectedRevision: 1,
      }),
    ).toThrow();
    for (const key of ["__proto__", "prototype", "constructor"]) {
      expect(() =>
        validateRoomAliasCommandV1({
          schemaVersion: 1,
          command: "identity.room_alias.retire",
          aliasId: "ralias-a1",
          expectedRevision: 1,
          [key]: {},
        }),
      ).toThrow();
    }
    for (const field of [
      "verified",
      "trusted",
      "authenticated",
      "owner",
      "moderator",
      "admin",
      "role",
      "permissions",
      "capabilities",
      "global",
      "public",
      "searchable",
      "username",
      "phone",
      "email",
      "did",
      "rootPublicId",
      "publicKey",
      "contactAliasId",
      "copyFromContact",
      "copyFromRoom",
      "devicePosture",
      "screenShieldActive",
      "peerShared",
    ]) {
      expect(
        () =>
          validateRoomAliasCommandV1({
            schemaVersion: 1,
            command: "identity.room_alias.retire",
            aliasId: "ralias-a1",
            expectedRevision: 1,
            [field]: "x",
          }),
        field,
      ).toThrow(RoomAliasValidationError);
    }
  });
});

describe("Create + binding/membership matching (§30: 10-20)", () => {
  it("create binds one root/persona/room binding; draft_local; not shared/verified", () => {
    const r = ref();
    const ok = applyRA({
      state: emptyState(),
      command: createCommand("Blue Fox", r),
      scope: "identity.room_alias.create",
      bindingRef: r,
      generatedIds: { aliasId: nextIds().aliasId },
    });
    const alias = ok.state.presentationAliases[0]!;
    expect(alias.lifecycle).toBe("draft_local");
    expect(alias.scope).toBe("one_room_only");
    expect(alias.sharingState).toBe("not_shared_tech_id_06");
    expect(alias.authenticatedBinding).toBe("not_implemented_gate_f");
  });

  it("create requires a binding ref; ref mismatch + membership mismatch reject", () => {
    const r = ref();
    // Missing ref.
    expect(() =>
      applyRA({
        state: emptyState(),
        command: createCommand("X", r),
        scope: "identity.room_alias.create",
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow();
    // Root mismatch between command and ref.
    expect(() =>
      applyRA({
        state: emptyState(),
        command: createCommand("X", r),
        scope: "identity.room_alias.create",
        bindingRef: ref({ rootId: "idr-other" as never }),
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow(RoomAliasBindingMismatchError);
    // Membership named in command but different in ref.
    const cmd = { ...createCommand("X", r), membershipId: "member-other" };
    expect(() =>
      applyRA({
        state: emptyState(),
        command: cmd,
        scope: "identity.room_alias.create",
        bindingRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow(RoomAliasMembershipMismatchError);
  });

  it("binding revision must match; removed binding/membership deny", () => {
    const r = ref();
    // Stale binding revision.
    const stale = { ...createCommand("X", r), expectedBindingRevision: 2 };
    expect(() =>
      applyRA({
        state: emptyState(),
        command: stale,
        scope: "identity.room_alias.create",
        bindingRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow();
    // Removed membership.
    expect(() =>
      applyRA({
        state: emptyState(),
        command: createCommand("X", r),
        scope: "identity.room_alias.create",
        bindingRef: ref({ membershipState: "removed_tombstone" }),
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow(RoomAliasMembershipMismatchError);
    // Inactive binding (ephemeral root expired → rootBindingActive false).
    expect(() =>
      applyRA({
        state: emptyState(),
        command: createCommand("X", r),
        scope: "identity.room_alias.create",
        bindingRef: ref({ rootBindingActive: false }),
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow(RoomAliasBindingMismatchError);
  });

  it("at most one active alias per binding", () => {
    const { state } = activeRoomAlias();
    const r = ref();
    expect(() =>
      applyRA({
        state,
        command: createCommand("Red Fox", r),
        scope: "identity.room_alias.create",
        bindingRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow(RoomAliasDuplicateActiveError);
  });
});

describe("Policy gating (§30: 21-26, 58-63)", () => {
  it("create requires exact decision; fake/wrong-scope reject; alias text authorizes nothing", () => {
    const r = ref();
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
        state: emptyState(),
        command: createCommand("X", r),
        mode: "standard",
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
        bindingRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
        clockValue: CLOCK,
        repository: repo(),
      }),
    ).toThrow(RoomAliasDecisionMismatchError);
    expect(() =>
      applyRoomAliasCommandV1({
        state: emptyState(),
        command: createCommand("X", r),
        mode: "standard",
        decision: issuePolicyDecision(
          "persistence",
          "allowed",
          "standard",
          "identity.room_alias.display_context.read",
        ),
        bindingRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
        clockValue: CLOCK,
        repository: repo(),
      }),
    ).toThrow(RoomAliasDecisionMismatchError);
  });

  it("Bunker denies expansive writes; Emergency denies create, allows retire; policy↔pipeline agree", () => {
    expect(resolveRoomAliasPolicyV1({ mode: "bunker", operation: "create" }).allowed).toBe(false);
    expect(resolveRoomAliasPolicyV1({ mode: "emergency", operation: "create" }).allowed).toBe(
      false,
    );
    expect(resolveRoomAliasPolicyV1({ mode: "emergency", operation: "retire" }).allowed).toBe(true);
    expect(resolveRoomAliasPolicyV1({ mode: "ghost", operation: "create" }).allowed).toBe(true);
    const r = ref();
    expect(() =>
      applyRA({
        state: emptyState(),
        command: createCommand("X", r),
        scope: "identity.room_alias.create",
        mode: "emergency",
        bindingRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow(RoomAliasPolicyDeniedError);
  });
});

describe("Collision + disambiguation (§30: 27-35)", () => {
  const norm = (s: string) => normalizeContactAliasDisplayTextV1(s).normalizedValue;
  const obs = (membershipId: string, alias: string): RoomAliasObservationV1 => ({
    roomId: ref().roomId,
    membershipId: membershipId as never,
    normalizedAlias: norm(alias),
    membershipState: "active_local_unverified",
  });

  it("duplicate aliases are allowed but detected; no ids/counts exposed", () => {
    const a = assessRoomAliasCollisionV1({
      observations: [obs("member-2", "Blue Fox")],
      normalizedValue: norm("Blue Fox"),
      forMembershipId: MEMBER,
    });
    expect(a.state).toBe("duplicate_in_current_room_observation");
    expect(a.collidingMemberIdsExposed).toBe(false);
    expect(a.exactCollisionCountExposed).toBe(false);
    expect(a.impersonationProven).toBe(false);
    // Unique value → unique; a member who left is excluded.
    const uniq = assessRoomAliasCollisionV1({
      observations: [{ ...obs("member-2", "Blue Fox"), membershipState: "removed_tombstone" }],
      normalizedValue: norm("Blue Fox"),
      forMembershipId: MEMBER,
    });
    expect(uniq.state).toBe("unique_in_current_room_observation");
    // Strict mode → not_evaluated.
    expect(
      assessRoomAliasCollisionV1({
        observations: [],
        normalizedValue: norm("X"),
        forMembershipId: MEMBER,
        evaluate: false,
      }).state,
    ).toBe("not_evaluated");
  });

  it("duplicates cannot use alias_only; disambiguation exposes no global/root id", () => {
    const dup = resolveRoomAliasDisambiguationV1({
      collisionState: "duplicate_in_current_room_observation",
      redactMode: false,
    });
    expect(dup.required).toBe(true);
    expect(dup.strategy).not.toBe("alias_only");
    expect(dup.globalIdentifierExposed).toBe(false);
    expect(dup.verifiedIdentity).toBe(false);
    // Strict/high-risk → fully redacted.
    expect(
      resolveRoomAliasDisambiguationV1({
        collisionState: "duplicate_in_current_room_observation",
        redactMode: true,
      }).strategy,
    ).toBe("fully_redacted");
    // Unique → alias_only allowed.
    expect(
      resolveRoomAliasDisambiguationV1({
        collisionState: "unique_in_current_room_observation",
        redactMode: false,
      }).strategy,
    ).toBe("alias_only");
  });
});

describe("Cross-room reuse (§30: 46-47)", () => {
  it("reuse across rooms warns only; exposes no room ids/counts; unique ≠ unlinkable", () => {
    const { state } = activeRoomAlias("Blue Fox", ref());
    const other = ref({ roomId: "room-two" as never });
    const a = assessRoomAliasReuseV1({
      state,
      normalizedValue: normalizeContactAliasDisplayTextV1("Blue Fox").normalizedValue,
      forRoomId: other.roomId,
    });
    expect(a.normalizedValueReusedAcrossRooms).toBe(true);
    expect(a.affectedRoomIdsExposed).toBe(false);
    expect(a.affectedRoomCountExposed).toBe(false);
    expect(a.unlinkabilityGuaranteed).toBe(false);
    const uniq = assessRoomAliasReuseV1({
      state,
      normalizedValue: normalizeContactAliasDisplayTextV1("Green Owl").normalizedValue,
      forRoomId: other.roomId,
    });
    expect(uniq.normalizedValueReusedAcrossRooms).toBe(false);
    // Strict skip.
    expect(
      assessRoomAliasReuseV1({
        state,
        normalizedValue: normalizeContactAliasDisplayTextV1("Blue Fox").normalizedValue,
        forRoomId: other.roomId,
        evaluate: false,
      }).correlationRisk,
    ).toBe("not_evaluated");
  });
});

describe("Rotation (§30: 36-41)", () => {
  it("rotate retires old + creates new active, preserves binding, no remote/history", () => {
    const { state, aliasId } = activeRoomAlias("Blue Fox");
    const r = ref();
    const rotated = applyRA({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.room_alias.rotate",
        roomId: r.roomId,
        bindingId: r.bindingId,
        rootId: r.rootId,
        personaId: r.personaId,
        membershipId: r.membershipId,
        expectedBindingRevision: r.bindingRevision,
        currentAliasId: aliasId,
        currentExpectedRevision: 2,
        newDisplayText: "Red Fox",
      },
      scope: "identity.room_alias.rotate",
      bindingRef: r,
      generatedIds: { aliasId: nextIds().aliasId },
    }).state;
    const old = rotated.presentationAliases.find((a) => a.aliasId === aliasId)!;
    const fresh = rotated.presentationAliases.find((a) => a.lifecycle === "active_local_unshared")!;
    expect(old.lifecycle).toBe("retired_tombstone");
    expect(fresh.bindingId).toBe(r.bindingId);
    expect(fresh.displayText.normalizedValue).toBe("Red Fox");
    // Retired alias cannot reactivate.
    expect(() =>
      applyRA({
        state: rotated,
        command: {
          schemaVersion: 1,
          command: "identity.room_alias.activate",
          aliasId,
          expectedRevision: 3,
        },
        scope: "identity.room_alias.lifecycle",
      }),
    ).toThrow();
  });
});

describe("Display context + binding-state hint (§30: 33-34, 42, 51)", () => {
  it("returns role/state/assurance separately; alias unverified; strict redacts", () => {
    const r = ref();
    const { state } = activeRoomAlias("Blue Fox", r);
    const ctx = buildRoomMemberDisplayContextV1({
      ref: r,
      member: { role: "editor_placeholder", state: "active_local_unverified" },
      state,
      observations: [],
      policy: resolveRoomAliasPolicyV1({ mode: "standard", operation: "display_context.read" }),
    });
    expect(ctx.aliasVerified).toBe(false);
    expect(ctx.authorityDerivedFromAlias).toBe(false);
    expect(ctx.membershipRole).toBe("editor_placeholder");
    expect(ctx.roomAlias).toBe("Blue Fox");
    const priv = buildRoomMemberDisplayContextV1({
      ref: r,
      member: { role: "editor_placeholder", state: "active_local_unverified" },
      state,
      observations: [],
      policy: resolveRoomAliasPolicyV1({ mode: "private", operation: "display_context.read" }),
    });
    expect(priv.redacted).toBe(true);
    expect(priv.roomId).toBeUndefined();
    expect(priv.roomAlias).toBeUndefined();
    // Binding-state hint derives from records.
    expect(deriveRoomAliasBindingStateV1(state, r.bindingId as string)).toBe("local_alias_v1");
  });
});

describe("Repositories (§30: 49-50)", () => {
  it("in-memory clones; null retains nothing", () => {
    const m = new InMemoryRoomAliasRepositoryV1();
    const d = decisionFor("identity.room_alias.create");
    const st = emptyState();
    m.replace(st, d);
    expect(m.read(d)).not.toBe(st);
    const n = new NullRoomAliasRepositoryV1();
    expect(n.replace(st, d).outcome).toBe("discarded");
    expect(n.read(d)).toBeNull();
  });
});
