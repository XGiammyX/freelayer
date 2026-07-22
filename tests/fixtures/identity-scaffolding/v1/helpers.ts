/**
 * Local identity scaffolding test helpers (TECH-ID-03). SYNTHETIC only — no real
 * secrets, no keys. Ids are deterministic opaque local references.
 */

import {
  issuePolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  applyLocalIdentityCommandV1,
  emptyLocalIdentityVaultV1,
  InMemoryLocalIdentityRepositoryV1,
  validateIdentityPersonaId,
  validateIdentityVaultId,
  validateLocalIdentityRootId,
  validatePairwiseRelationshipId,
  validateRoomIdentityBindingId,
  type LocalIdentityGeneratedIdsV1,
  type LocalIdentityRepositoryV1,
  type LocalIdentityVaultStateV1,
} from "@freelayer/identity";

export const IDENTITY_SENTINEL = "FREELAYER_IDENTITY_SCAFFOLD_SENTINEL_DO_NOT_LEAK";

export const CLOCK = "local:0";

export function emptyVault(
  persistenceClass: "memory_only" | "null" = "memory_only",
): LocalIdentityVaultStateV1 {
  return emptyLocalIdentityVaultV1({
    vaultId: validateIdentityVaultId("idv-test-1"),
    persistenceClass,
  });
}

let seq = 0;
export function nextIds(): Required<Omit<LocalIdentityGeneratedIdsV1, "vaultId">> {
  seq += 1;
  return {
    rootId: validateLocalIdentityRootId(`idr-r${seq}`),
    personaId: validateIdentityPersonaId(`idp-p${seq}`),
    relationshipId: validatePairwiseRelationshipId(`idrel-r${seq}`),
    bindingId: validateRoomIdentityBindingId(`idrb-b${seq}`),
  };
}

export function decisionFor(scope: PolicySideEffectScope, mode: PrivacyMode = "standard") {
  return issuePolicyDecision("persistence", "allowed", mode, scope);
}

export function repo(): LocalIdentityRepositoryV1 {
  return new InMemoryLocalIdentityRepositoryV1();
}

/** Apply one command through the policy-gated pipeline with a fresh repo. */
export function apply(input: {
  state: LocalIdentityVaultStateV1;
  command: unknown;
  scope: PolicySideEffectScope;
  mode?: PrivacyMode;
  generatedIds?: LocalIdentityGeneratedIdsV1;
  repository?: LocalIdentityRepositoryV1;
}) {
  return applyLocalIdentityCommandV1({
    state: input.state,
    command: input.command,
    mode: input.mode ?? "standard",
    decision: decisionFor(input.scope, input.mode ?? "standard"),
    generatedIds: input.generatedIds ?? {},
    clockValue: CLOCK,
    repository: input.repository ?? repo(),
  });
}

/** Convenience: create + activate a root, returning the vault and its id. */
export function withActiveRoot(): {
  state: LocalIdentityVaultStateV1;
  rootId: ReturnType<typeof validateLocalIdentityRootId>;
} {
  const ids = nextIds();
  const created = apply({
    state: emptyVault(),
    command: { schemaVersion: 1, command: "identity.root.create_local" },
    scope: "identity.root.create",
    generatedIds: { rootId: ids.rootId },
  }).state;
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
  return { state: activated, rootId: ids.rootId };
}

/** Convenience: create an active root + an active persona under it. */
export function withActivePersona(): {
  state: LocalIdentityVaultStateV1;
  rootId: ReturnType<typeof validateLocalIdentityRootId>;
  personaId: ReturnType<typeof validateIdentityPersonaId>;
} {
  const { state: rootState, rootId } = withActiveRoot();
  const personaId = nextIds().personaId;
  const state = apply({
    state: rootState,
    command: { schemaVersion: 1, command: "identity.persona.create_local", rootId },
    scope: "identity.persona.create",
    generatedIds: { personaId },
  }).state;
  return { state, rootId, personaId };
}
