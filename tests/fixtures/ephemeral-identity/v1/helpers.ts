/**
 * Ephemeral identity test helpers (TECH-ID-04). SYNTHETIC only. Deterministic
 * injected clock + process epoch (no real sleeping / wall-clock).
 */

import {
  issuePolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  applyEphemeralIdentityCommandV1,
  emptyEphemeralIdentityVaultV1,
  InMemoryEphemeralIdentityRepositoryV1,
  validateIdentityPersonaId,
  validateIdentityProcessEpochId,
  validateLocalIdentityRootId,
  validatePairwiseRelationshipId,
  validateRoomIdentityBindingId,
  type EphemeralIdentityRepositoryV1,
  type EphemeralIdentityVaultStateV1,
  type IdentityProcessEpochId,
  type LocalIdentityGeneratedIdsV1,
} from "@freelayer/identity";

export const EPHEMERAL_SENTINEL = "FREELAYER_EPHEMERAL_IDENTITY_SENTINEL_DO_NOT_LEAK";

export const EPOCH = validateIdentityProcessEpochId("epoch-test-1");
export const OTHER_EPOCH = validateIdentityProcessEpochId("epoch-test-2");
export const clock = (ms: number): string => `local:${ms}`;

export function emptyVault(
  persistenceClass: "current_process_memory" | "null" = "current_process_memory",
  epoch: IdentityProcessEpochId = EPOCH,
): EphemeralIdentityVaultStateV1 {
  return emptyEphemeralIdentityVaultV1({ processEpochId: epoch, persistenceClass });
}

let seq = 0;
export function nextIds(): Required<Omit<LocalIdentityGeneratedIdsV1, "vaultId">> {
  seq += 1;
  return {
    rootId: validateLocalIdentityRootId(`idr-e${seq}`),
    personaId: validateIdentityPersonaId(`idp-e${seq}`),
    relationshipId: validatePairwiseRelationshipId(`idrel-e${seq}`),
    bindingId: validateRoomIdentityBindingId(`idrb-e${seq}`),
  };
}

export function repo(): EphemeralIdentityRepositoryV1 {
  return new InMemoryEphemeralIdentityRepositoryV1();
}

export function decisionFor(scope: PolicySideEffectScope, mode: PrivacyMode = "standard") {
  return issuePolicyDecision("persistence", "allowed", mode, scope);
}

export function applyE(input: {
  state: EphemeralIdentityVaultStateV1;
  command: unknown;
  scope: PolicySideEffectScope;
  mode?: PrivacyMode;
  generatedIds?: LocalIdentityGeneratedIdsV1;
  clockValue?: string;
  processEpochId?: IdentityProcessEpochId;
  repository?: EphemeralIdentityRepositoryV1;
}) {
  return applyEphemeralIdentityCommandV1({
    state: input.state,
    command: input.command,
    mode: input.mode ?? "standard",
    decision: decisionFor(input.scope, input.mode ?? "standard"),
    generatedIds: input.generatedIds ?? {},
    clockValue: input.clockValue ?? clock(0),
    processEpochId: input.processEpochId ?? EPOCH,
    repository: input.repository ?? repo(),
  });
}

/** Create + activate an ephemeral root (deadline mode) at t=0. */
export function activeEphemeral(durationMs = 3_600_000): {
  state: EphemeralIdentityVaultStateV1;
  rootId: ReturnType<typeof validateLocalIdentityRootId>;
} {
  const ids = nextIds();
  const created = applyE({
    state: emptyVault(),
    command: {
      schemaVersion: 1,
      command: "identity.ephemeral.create",
      lifetimeMode: "current_process_with_local_deadline",
      durationMs,
    },
    scope: "identity.ephemeral.create",
    generatedIds: { rootId: ids.rootId },
    clockValue: clock(0),
  }).state;
  const active = applyE({
    state: created,
    command: {
      schemaVersion: 1,
      command: "identity.ephemeral.activate",
      rootId: ids.rootId,
      expectedRevision: 1,
    },
    scope: "identity.ephemeral.lifecycle",
    clockValue: clock(0),
  }).state;
  return { state: active, rootId: ids.rootId };
}
