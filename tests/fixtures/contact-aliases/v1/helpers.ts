/**
 * Per-contact alias test helpers (TECH-ID-05). SYNTHETIC only — no real personal
 * names/phones/emails/secrets. Deterministic ids + injected clock.
 */

import {
  issuePolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  applyContactAliasCommandV1,
  emptyContactAliasStateV1,
  InMemoryContactAliasRepositoryV1,
  validateContactAliasId,
  validateIdentityPersonaId,
  validateLocalPeerLabelId,
  validateLocalIdentityRootId,
  validatePairwiseRelationshipId,
  type ContactAliasRelationshipRefV1,
  type ContactAliasRepositoryV1,
  type ContactAliasStateV1,
  type ContactAliasGeneratedIdsV1,
} from "@freelayer/identity";

export const ALIAS_SENTINEL = "FREELAYER_CONTACT_ALIAS_SENTINEL_DO_NOT_LEAK";
export const CLOCK = "local:0";

export const ROOT = validateLocalIdentityRootId("idr-alias-1");
export const PERSONA = validateIdentityPersonaId("idp-alias-1");
export const REL = validatePairwiseRelationshipId("idrel-alias-1");

export function ref(over?: Partial<ContactAliasRelationshipRefV1>): ContactAliasRelationshipRefV1 {
  return {
    relationshipId: REL,
    rootId: ROOT,
    personaId: PERSONA,
    rootKind: "long_lived_local",
    relationshipLifecycle: "active_local_unverified",
    relationshipAssurance: "unverified_local",
    rootAndPersonaActive: true,
    ...over,
  };
}

let seq = 0;
export function nextIds(): Required<ContactAliasGeneratedIdsV1> {
  seq += 1;
  return {
    aliasId: validateContactAliasId(`alias-a${seq}`),
    labelId: validateLocalPeerLabelId(`plabel-${seq}`),
  };
}

export function emptyState(pc: "memory_only" | "null" = "memory_only"): ContactAliasStateV1 {
  return emptyContactAliasStateV1(pc);
}
export function repo(): ContactAliasRepositoryV1 {
  return new InMemoryContactAliasRepositoryV1();
}
export function decisionFor(scope: PolicySideEffectScope, mode: PrivacyMode = "standard") {
  return issuePolicyDecision("persistence", "allowed", mode, scope);
}

export function applyA(input: {
  state: ContactAliasStateV1;
  command: unknown;
  scope: PolicySideEffectScope;
  mode?: PrivacyMode;
  relationshipRef?: ContactAliasRelationshipRefV1;
  generatedIds?: ContactAliasGeneratedIdsV1;
  repository?: ContactAliasRepositoryV1;
}) {
  return applyContactAliasCommandV1({
    state: input.state,
    command: input.command,
    mode: input.mode ?? "standard",
    decision: decisionFor(input.scope, input.mode ?? "standard"),
    ...(input.relationshipRef !== undefined ? { relationshipRef: input.relationshipRef } : {}),
    generatedIds: input.generatedIds ?? {},
    clockValue: CLOCK,
    repository: input.repository ?? repo(),
  });
}

/** Create + activate a presentation alias, returning the state + alias id. */
export function activeAlias(
  displayText = "Blue Fox",
  r = ref(),
): {
  state: ContactAliasStateV1;
  aliasId: ReturnType<typeof validateContactAliasId>;
} {
  const aliasId = nextIds().aliasId;
  const created = applyA({
    state: emptyState(),
    command: {
      schemaVersion: 1,
      command: "identity.alias.presentation.create",
      relationshipId: r.relationshipId,
      rootId: r.rootId,
      personaId: r.personaId,
      displayText,
    },
    scope: "identity.alias.presentation.create",
    relationshipRef: r,
    generatedIds: { aliasId },
  }).state;
  const active = applyA({
    state: created,
    command: {
      schemaVersion: 1,
      command: "identity.alias.presentation.activate",
      aliasId,
      expectedRevision: 1,
    },
    scope: "identity.alias.presentation.lifecycle",
  }).state;
  return { state: active, aliasId };
}
