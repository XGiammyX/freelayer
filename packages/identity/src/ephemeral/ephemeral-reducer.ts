/**
 * Pure ephemeral identity reducer + atomic destruction (TECH-ID-04). PURE:
 * validate-before-mutate; no storage/network/notification/AI/crypto/randomness;
 * injected ids + clock + process epoch only; source state/command never mutated;
 * deterministic; revisions +1; failure → no partial state. Expiry/destruction
 * propagate to children. Lifetime can only be SHORTENED. No promotion/attach/
 * copy/recovery/export/synchronize command exists.
 */

import {
  FIRST_IDENTITY_REVISION,
  nextIdentityRevision,
  type LocalIdentityGeneratedIdsV1,
} from "../identifiers";
import {
  EPHEMERAL_IDENTITY_LIMITS_V1,
  localClockLabel,
  parseLocalClockMs,
  type IdentityProcessEpochId,
} from "./ephemeral-clock";
import {
  EphemeralIdentityClockRollbackError,
  EphemeralIdentityDestructionError,
  EphemeralIdentityLifetimeError,
  EphemeralIdentityLimitError,
  EphemeralIdentityRecoveryForbiddenError,
  EphemeralIdentityValidationError,
} from "./ephemeral-errors";
import type { EphemeralIdentityCommandV1 } from "./ephemeral-commands";
import type {
  EphemeralIdentityDestructionResultV1,
  EphemeralIdentityLifetimeV1,
  EphemeralIdentityRootV1,
  EphemeralIdentityVaultStateV1,
  EphemeralPairwiseRelationshipV1,
  EphemeralIdentityPersonaV1,
  EphemeralRoomIdentityBindingV1,
} from "./ephemeral-types";

export interface ReduceEphemeralIdentityInputV1 {
  readonly state: EphemeralIdentityVaultStateV1;
  readonly command: EphemeralIdentityCommandV1;
  readonly generatedIds: LocalIdentityGeneratedIdsV1;
  readonly clockValue: string;
  readonly processEpochId: IdentityProcessEpochId;
  readonly maximumLifetimeMs: number;
  readonly maximumActiveRoots: number;
}

const ROOT_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  draft_current_process: ["active_current_process", "destroyed_tombstone"],
  active_current_process: ["expired_local", "compromised_suspected", "destroyed_tombstone"],
  expired_local: ["destroyed_tombstone"],
  compromised_suspected: ["destroyed_tombstone"],
  destroyed_tombstone: [],
};

function assertRootTransition(from: string, to: string): void {
  const allowed = ROOT_TRANSITIONS[from];
  if (allowed === undefined || from === to || !allowed.includes(to)) {
    throw new EphemeralIdentityValidationError("invalid_transition");
  }
}

function activeRootCount(state: EphemeralIdentityVaultStateV1): number {
  return state.roots.filter(
    (r) => r.lifecycle !== "destroyed_tombstone" && r.lifecycle !== "expired_local",
  ).length;
}

function findActiveRoot(
  state: EphemeralIdentityVaultStateV1,
  rootId: string,
): EphemeralIdentityRootV1 {
  const root = state.roots.find((r) => r.rootId === rootId);
  if (root === undefined) throw new EphemeralIdentityValidationError("root_not_found");
  if (root.lifecycle !== "active_current_process") {
    throw new EphemeralIdentityValidationError("root_not_active");
  }
  return root;
}

function withVault(
  state: EphemeralIdentityVaultStateV1,
  patch: Partial<
    Pick<EphemeralIdentityVaultStateV1, "roots" | "personas" | "relationships" | "roomBindings">
  >,
): EphemeralIdentityVaultStateV1 {
  return { ...state, ...patch };
}

/** Effective deadline in ms (Infinity for current-process mode without a deadline). */
function effectiveDeadlineMs(lifetime: EphemeralIdentityLifetimeV1): number {
  if (lifetime.mode !== "current_process_with_local_deadline") return Number.POSITIVE_INFINITY;
  const d = parseLocalClockMs(lifetime.expiresAtLocal ?? "");
  return d ?? Number.POSITIVE_INFINITY;
}

export function reduceEphemeralIdentityCommandV1(
  input: ReduceEphemeralIdentityInputV1,
): EphemeralIdentityVaultStateV1 {
  const { state, command, generatedIds, clockValue: now, processEpochId } = input;
  const nowMs = parseLocalClockMs(now);
  if (nowMs === null) throw new EphemeralIdentityClockRollbackError("bad_now");

  switch (command.command) {
    case "identity.ephemeral.create": {
      const rootId = generatedIds.rootId;
      if (rootId === undefined) throw new EphemeralIdentityValidationError("missing_root_id");
      if (state.roots.some((r) => r.rootId === rootId)) {
        throw new EphemeralIdentityValidationError("duplicate_root");
      }
      if (activeRootCount(state) >= input.maximumActiveRoots) {
        throw new EphemeralIdentityLimitError();
      }
      const duration = command.durationMs ?? EPHEMERAL_IDENTITY_LIMITS_V1.defaultDurationMs;
      if (duration > input.maximumLifetimeMs) throw new EphemeralIdentityLifetimeError("too_long");
      const lifetime: EphemeralIdentityLifetimeV1 =
        command.lifetimeMode === "current_process_with_local_deadline"
          ? {
              mode: "current_process_with_local_deadline",
              createdAtLocal: now,
              expiresAtLocal: localClockLabel(nowMs + duration),
              originalMaximumDurationMs: duration,
              crossRestartValidity: false,
              recoveryAvailable: false,
              extensionAllowed: false,
            }
          : {
              mode: "current_process",
              createdAtLocal: now,
              originalMaximumDurationMs: duration,
              crossRestartValidity: false,
              recoveryAvailable: false,
              extensionAllowed: false,
            };
      const root: EphemeralIdentityRootV1 = {
        schemaVersion: 1,
        rootKind: "ephemeral_current_process",
        rootId,
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "draft_current_process",
        assurance: "unverified_local",
        processBinding: { processEpochId, crossRestartValidity: false },
        lifetime,
        createdAtLocal: now,
        updatedAtLocal: now,
        persistence: "forbidden",
        recovery: "forbidden",
        export: "forbidden",
        synchronization: "forbidden",
        promotion: "forbidden",
        longLivedRootLink: "forbidden",
        keyMaterialState: "not_implemented_gate_f",
        deviceAuthorizationState: "not_implemented_gate_f_g",
      };
      return withVault(state, { roots: [...state.roots, root] });
    }

    case "identity.ephemeral.activate":
    case "identity.ephemeral.mark_compromised":
    case "identity.ephemeral.expire":
    case "identity.ephemeral.destroy": {
      const index = state.roots.findIndex((r) => r.rootId === command.rootId);
      if (index < 0) throw new EphemeralIdentityValidationError("root_not_found");
      const current = state.roots[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new EphemeralIdentityValidationError("stale_revision");
      }
      if (command.command === "identity.ephemeral.destroy") {
        // Atomic destruction: remove root + every child (no orphan, no tombstone).
        assertRootTransition(current.lifecycle, "destroyed_tombstone");
        return withVault(state, {
          roots: state.roots.filter((r) => r.rootId !== command.rootId),
          personas: state.personas.filter((p) => p.rootId !== command.rootId),
          relationships: state.relationships.filter((r) => r.rootId !== command.rootId),
          roomBindings: state.roomBindings.filter((b) => b.rootId !== command.rootId),
        });
      }
      const target =
        command.command === "identity.ephemeral.activate"
          ? "active_current_process"
          : command.command === "identity.ephemeral.mark_compromised"
            ? "compromised_suspected"
            : "expired_local";
      assertRootTransition(current.lifecycle, target);
      const assurance =
        target === "compromised_suspected" ? "compromised_suspected" : current.assurance;
      const next: EphemeralIdentityRootV1 = {
        ...current,
        lifecycle: target,
        assurance,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const roots = state.roots.slice();
      roots[index] = next;
      return withVault(state, { roots });
    }

    case "identity.ephemeral.shorten_lifetime": {
      const index = state.roots.findIndex((r) => r.rootId === command.rootId);
      if (index < 0) throw new EphemeralIdentityValidationError("root_not_found");
      const current = state.roots[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new EphemeralIdentityValidationError("stale_revision");
      }
      if (current.lifecycle !== "active_current_process") {
        throw new EphemeralIdentityValidationError("root_not_active");
      }
      if (command.newDurationMs > input.maximumLifetimeMs) {
        throw new EphemeralIdentityLifetimeError("too_long");
      }
      const createdMs = parseLocalClockMs(current.lifetime.createdAtLocal);
      if (createdMs === null) throw new EphemeralIdentityClockRollbackError("bad_created");
      const newDeadlineMs = createdMs + command.newDurationMs;
      // Only shorten: the new deadline must be strictly earlier than the current one.
      if (newDeadlineMs >= effectiveDeadlineMs(current.lifetime)) {
        throw new EphemeralIdentityLifetimeError("cannot_extend");
      }
      const lifetime: EphemeralIdentityLifetimeV1 = {
        mode: "current_process_with_local_deadline",
        createdAtLocal: current.lifetime.createdAtLocal,
        expiresAtLocal: localClockLabel(newDeadlineMs),
        originalMaximumDurationMs: command.newDurationMs,
        crossRestartValidity: false,
        recoveryAvailable: false,
        extensionAllowed: false,
      };
      const next: EphemeralIdentityRootV1 = {
        ...current,
        lifetime,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const roots = state.roots.slice();
      roots[index] = next;
      return withVault(state, { roots });
    }

    case "identity.ephemeral.persona.create": {
      const personaId = generatedIds.personaId;
      if (personaId === undefined) throw new EphemeralIdentityValidationError("missing_persona_id");
      if (state.personas.some((p) => p.personaId === personaId)) {
        throw new EphemeralIdentityValidationError("duplicate_persona");
      }
      findActiveRoot(state, command.rootId);
      const persona: EphemeralIdentityPersonaV1 = {
        schemaVersion: 1,
        personaId,
        rootId: command.rootId,
        rootKind: "ephemeral_current_process",
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "active_current_process",
        ...(command.localLabel !== undefined ? { localLabel: command.localLabel } : {}),
        presentationState: "local_placeholder",
        persistence: "forbidden",
        export: "forbidden",
        createdAtLocal: now,
        updatedAtLocal: now,
      };
      return withVault(state, { personas: [...state.personas, persona] });
    }

    case "identity.ephemeral.relationship.create_placeholder": {
      const relationshipId = generatedIds.relationshipId;
      if (relationshipId === undefined) {
        throw new EphemeralIdentityValidationError("missing_relationship_id");
      }
      if (state.relationships.some((r) => r.relationshipId === relationshipId)) {
        throw new EphemeralIdentityValidationError("duplicate_relationship");
      }
      findActiveRoot(state, command.rootId);
      const persona = state.personas.find((p) => p.personaId === command.personaId);
      if (persona === undefined || persona.rootId !== command.rootId) {
        throw new EphemeralIdentityValidationError("persona_mismatch");
      }
      const relationship: EphemeralPairwiseRelationshipV1 = {
        schemaVersion: 1,
        relationshipId,
        rootId: command.rootId,
        personaId: command.personaId,
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "active_local_unverified",
        assurance: "unverified_local",
        aliasState: "not_implemented_tech_id_05",
        trustState: "not_inherited",
        persistence: "forbidden",
        export: "forbidden",
        createdAtLocal: now,
        updatedAtLocal: now,
      };
      return withVault(state, { relationships: [...state.relationships, relationship] });
    }

    case "identity.ephemeral.relationship.block": {
      const index = state.relationships.findIndex(
        (r) => r.relationshipId === command.relationshipId,
      );
      if (index < 0) throw new EphemeralIdentityValidationError("relationship_not_found");
      const current = state.relationships[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new EphemeralIdentityValidationError("stale_revision");
      }
      if (current.lifecycle !== "active_local_unverified") {
        throw new EphemeralIdentityValidationError("invalid_transition");
      }
      const next: EphemeralPairwiseRelationshipV1 = {
        ...current,
        lifecycle: "blocked_local",
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const relationships = state.relationships.slice();
      relationships[index] = next;
      return withVault(state, { relationships });
    }

    case "identity.ephemeral.room_binding.create_placeholder": {
      const bindingId = generatedIds.bindingId;
      if (bindingId === undefined) throw new EphemeralIdentityValidationError("missing_binding_id");
      if (state.roomBindings.some((b) => b.bindingId === bindingId)) {
        throw new EphemeralIdentityValidationError("duplicate_binding");
      }
      findActiveRoot(state, command.rootId);
      const persona = state.personas.find((p) => p.personaId === command.personaId);
      if (persona === undefined || persona.rootId !== command.rootId) {
        throw new EphemeralIdentityValidationError("persona_mismatch");
      }
      if (
        state.roomBindings.some(
          (b) =>
            b.personaId === command.personaId &&
            b.roomId === command.roomId &&
            b.lifecycle !== "destroyed_tombstone",
        )
      ) {
        throw new EphemeralIdentityValidationError("duplicate_active_binding");
      }
      const binding: EphemeralRoomIdentityBindingV1 = {
        schemaVersion: 1,
        bindingId,
        roomId: command.roomId,
        rootId: command.rootId,
        personaId: command.personaId,
        ...(command.membershipId !== undefined ? { membershipId: command.membershipId } : {}),
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "active_local_unverified",
        roomAliasState: "none",
        credentialState: "not_implemented_gate_f",
        persistence: "forbidden",
        export: "forbidden",
        createdAtLocal: now,
        updatedAtLocal: now,
      };
      return withVault(state, { roomBindings: [...state.roomBindings, binding] });
    }

    default: {
      const _never: never = command;
      throw new EphemeralIdentityValidationError(`unhandled:${String(_never)}`);
    }
  }
}

/** Empty current-process ephemeral vault seed. */
export function emptyEphemeralIdentityVaultV1(input: {
  processEpochId: IdentityProcessEpochId;
  persistenceClass: "current_process_memory" | "null";
}): EphemeralIdentityVaultStateV1 {
  return {
    schemaVersion: 1,
    processBinding: { processEpochId: input.processEpochId, crossRestartValidity: false },
    roots: [],
    personas: [],
    relationships: [],
    roomBindings: [],
    persistenceClass: input.persistenceClass,
  };
}

/**
 * Atomic local destruction of one ephemeral root + all its children. Removes
 * every record (no orphan); claims NO media sanitization, NO remote deletion, NO
 * forensic erasure. The result is redacted (no id/labels). This is one logical
 * operation over the pure reducer — a failure produces no partial state.
 */
export function destroyEphemeralIdentityV1(input: {
  state: EphemeralIdentityVaultStateV1;
  rootId: LocalIdentityGeneratedIdsV1["rootId"];
  expectedRevision: import("../identifiers").IdentityLocalRevision;
  clockValue: string;
  processEpochId: IdentityProcessEpochId;
}): {
  nextState: EphemeralIdentityVaultStateV1;
  result: EphemeralIdentityDestructionResultV1;
} {
  const { state, rootId } = input;
  if (rootId === undefined) throw new EphemeralIdentityDestructionError("missing_root_id");
  const root = state.roots.find((r) => r.rootId === rootId);
  if (root === undefined) throw new EphemeralIdentityDestructionError("root_not_found");
  if (root.recovery !== "forbidden" || root.persistence !== "forbidden") {
    // Defense: an ephemeral root must never carry recovery/persistence.
    throw new EphemeralIdentityRecoveryForbiddenError();
  }
  const hadPersonas = state.personas.some((p) => p.rootId === rootId);
  const hadRelationships = state.relationships.some((r) => r.rootId === rootId);
  const hadBindings = state.roomBindings.some((b) => b.rootId === rootId);

  const nextState = reduceEphemeralIdentityCommandV1({
    state,
    command: {
      schemaVersion: 1,
      command: "identity.ephemeral.destroy",
      rootId,
      expectedRevision: input.expectedRevision,
    },
    generatedIds: {},
    clockValue: input.clockValue,
    processEpochId: input.processEpochId,
    maximumLifetimeMs: 0,
    maximumActiveRoots: 0,
  });

  // No orphan may remain for this root.
  const orphan =
    nextState.roots.some((r) => r.rootId === rootId) ||
    nextState.personas.some((p) => p.rootId === rootId) ||
    nextState.relationships.some((r) => r.rootId === rootId) ||
    nextState.roomBindings.some((b) => b.rootId === rootId);
  if (orphan) throw new EphemeralIdentityDestructionError("orphan_state");

  const result: EphemeralIdentityDestructionResultV1 = {
    schemaVersion: 1,
    destroyed: true,
    currentProcessStateCleared: true,
    childPersonasCleared: hadPersonas,
    childRelationshipsCleared: hadRelationships,
    childRoomBindingsCleared: hadBindings,
    persistentMediaSanitized: false,
    remoteCopiesAffected: false,
    externalObservationsAffected: false,
    forensicErasureGuaranteed: false,
    redacted: true,
  };
  return { nextState, result };
}
