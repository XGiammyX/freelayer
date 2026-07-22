/**
 * Pure local identity reducer (TECH-ID-03). PURE: validate-before-mutate, no
 * storage/network/notification/AI/endpoint/crypto, no randomness, no clock call
 * — injected ids + clock only; source state and command are never mutated;
 * deterministic output; exhaustive command handling; revisions increment by one;
 * a failed operation returns NO partial state (it throws). Identity Firewall uses
 * a SEPARATE local aggregate boundary (not the RoomOS operation log), per ADR-0013.
 */

import {
  FIRST_IDENTITY_REVISION,
  nextIdentityRevision,
  type LocalIdentityGeneratedIdsV1,
} from "./identifiers";
import {
  IdentityCrossReferenceError,
  IdentityDuplicateError,
  IdentityPersonaNotFoundError,
  IdentityRelationshipNotFoundError,
  IdentityRevisionMismatchError,
  IdentityRootNotFoundError,
  IdentityValidationError,
  RoomIdentityBindingNotFoundError,
} from "./identity-errors";
import {
  assertValidIdentityRootTransitionV1,
  assertValidPersonaTransitionV1,
  assertValidRelationshipTransitionV1,
  assertValidRoomBindingTransitionV1,
} from "./identity-lifecycle";
import type { LocalIdentityCommandV1 } from "./identity-commands";
import type {
  IdentityPersonaV1,
  LocalIdentityRootV1,
  LocalIdentityVaultStateV1,
  PairwiseRelationshipV1,
  RoomIdentityBindingV1,
} from "./identity-types";

export interface ReduceLocalIdentityInputV1 {
  readonly state: LocalIdentityVaultStateV1;
  readonly command: LocalIdentityCommandV1;
  readonly generatedIds: LocalIdentityGeneratedIdsV1;
  readonly clockValue: string;
}

function requireActiveRoot(state: LocalIdentityVaultStateV1, rootId: string): LocalIdentityRootV1 {
  const root = state.roots.find((r) => r.rootId === rootId);
  if (root === undefined) throw new IdentityRootNotFoundError();
  if (root.lifecycle !== "active_local") throw new IdentityCrossReferenceError("root_not_active");
  return root;
}

function requireActivePersonaOfRoot(
  state: LocalIdentityVaultStateV1,
  personaId: string,
  rootId: string,
): IdentityPersonaV1 {
  const persona = state.personas.find((p) => p.personaId === personaId);
  if (persona === undefined) throw new IdentityPersonaNotFoundError();
  if (persona.rootId !== rootId) throw new IdentityCrossReferenceError("persona_root_mismatch");
  if (persona.lifecycle !== "active_local") {
    throw new IdentityCrossReferenceError("persona_not_active");
  }
  return persona;
}

function withVault(
  state: LocalIdentityVaultStateV1,
  patch: Partial<
    Pick<LocalIdentityVaultStateV1, "roots" | "personas" | "relationships" | "roomBindings">
  >,
): LocalIdentityVaultStateV1 {
  return { ...state, ...patch, revision: nextIdentityRevision(state.revision) };
}

export function reduceLocalIdentityCommandV1(
  input: ReduceLocalIdentityInputV1,
): LocalIdentityVaultStateV1 {
  const { state, command, generatedIds, clockValue } = input;
  const now = clockValue;

  switch (command.command) {
    // ---- Root ----
    case "identity.root.create_local": {
      const rootId = generatedIds.rootId;
      if (rootId === undefined) throw new IdentityValidationError("missing_generated_root_id");
      if (state.roots.some((r) => r.rootId === rootId)) throw new IdentityDuplicateError();
      const root: LocalIdentityRootV1 = {
        schemaVersion: 1,
        rootId,
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "draft_local",
        assurance: "unverified_local",
        createdAtLocal: now,
        updatedAtLocal: now,
        publicExposure: "forbidden",
        phoneRequired: false,
        emailRequired: false,
        publicDirectory: "forbidden",
        keyMaterialState: "not_implemented_gate_f",
        recoveryState: "not_configured",
        deviceAuthorizationState: "not_implemented_gate_f_g",
        persistenceClass: state.persistenceClass,
      };
      return withVault(state, { roots: [...state.roots, root] });
    }

    case "identity.root.activate_local":
    case "identity.root.lock_local":
    case "identity.root.mark_compromised":
    case "identity.root.tombstone": {
      const index = state.roots.findIndex((r) => r.rootId === command.rootId);
      if (index < 0) throw new IdentityRootNotFoundError();
      const current = state.roots[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new IdentityRevisionMismatchError();
      }
      const target =
        command.command === "identity.root.activate_local"
          ? "active_local"
          : command.command === "identity.root.lock_local"
            ? "locked_local"
            : command.command === "identity.root.mark_compromised"
              ? "compromised_suspected"
              : "revoked_tombstone";
      assertValidIdentityRootTransitionV1(current.lifecycle, target);
      const assurance =
        target === "compromised_suspected"
          ? "compromised_suspected"
          : target === "revoked_tombstone"
            ? "revoked"
            : current.assurance;
      const next: LocalIdentityRootV1 = {
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

    // ---- Persona ----
    case "identity.persona.create_local": {
      const personaId = generatedIds.personaId;
      if (personaId === undefined)
        throw new IdentityValidationError("missing_generated_persona_id");
      if (state.personas.some((p) => p.personaId === personaId)) throw new IdentityDuplicateError();
      requireActiveRoot(state, command.rootId);
      const persona: IdentityPersonaV1 = {
        schemaVersion: 1,
        personaId,
        rootId: command.rootId,
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "active_local",
        ...(command.localLabel !== undefined ? { localLabel: command.localLabel } : {}),
        presentationState: "local_placeholder",
        peerVisibleAliasState: "not_implemented_tech_id_05_06",
        createdAtLocal: now,
        updatedAtLocal: now,
      };
      return withVault(state, { personas: [...state.personas, persona] });
    }

    case "identity.persona.archive_local":
    case "identity.persona.tombstone": {
      const index = state.personas.findIndex((p) => p.personaId === command.personaId);
      if (index < 0) throw new IdentityPersonaNotFoundError();
      const current = state.personas[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new IdentityRevisionMismatchError();
      }
      const target =
        command.command === "identity.persona.archive_local"
          ? "archived_local"
          : "revoked_tombstone";
      assertValidPersonaTransitionV1(current.lifecycle, target);
      const next: IdentityPersonaV1 = {
        ...current,
        lifecycle: target,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const personas = state.personas.slice();
      personas[index] = next;
      return withVault(state, { personas });
    }

    // ---- Pairwise relationship ----
    case "identity.relationship.create_placeholder": {
      const relationshipId = generatedIds.relationshipId;
      if (relationshipId === undefined) {
        throw new IdentityValidationError("missing_generated_relationship_id");
      }
      if (state.relationships.some((r) => r.relationshipId === relationshipId)) {
        throw new IdentityDuplicateError();
      }
      requireActiveRoot(state, command.rootId);
      requireActivePersonaOfRoot(state, command.personaId, command.rootId);
      const relationship: PairwiseRelationshipV1 = {
        schemaVersion: 1,
        relationshipId,
        rootId: command.rootId,
        personaId: command.personaId,
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "active_local_unverified",
        assurance: "unverified_local",
        peerReferenceState: "opaque_placeholder",
        aliasState: "not_implemented_tech_id_05",
        trustNotebookState: "not_implemented_tech_id_09",
        createdAtLocal: now,
        updatedAtLocal: now,
      };
      return withVault(state, { relationships: [...state.relationships, relationship] });
    }

    case "identity.relationship.block_local":
    case "identity.relationship.mark_compromised":
    case "identity.relationship.tombstone": {
      const index = state.relationships.findIndex(
        (r) => r.relationshipId === command.relationshipId,
      );
      if (index < 0) throw new IdentityRelationshipNotFoundError();
      const current = state.relationships[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new IdentityRevisionMismatchError();
      }
      const target =
        command.command === "identity.relationship.block_local"
          ? "blocked_local"
          : command.command === "identity.relationship.mark_compromised"
            ? "compromised_suspected"
            : "removed_tombstone";
      assertValidRelationshipTransitionV1(current.lifecycle, target);
      const assurance =
        target === "compromised_suspected"
          ? "compromised_suspected"
          : target === "removed_tombstone"
            ? "revoked"
            : current.assurance;
      const next: PairwiseRelationshipV1 = {
        ...current,
        lifecycle: target,
        assurance,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const relationships = state.relationships.slice();
      relationships[index] = next;
      return withVault(state, { relationships });
    }

    // ---- Room identity binding ----
    case "identity.room_binding.create_placeholder": {
      const bindingId = generatedIds.bindingId;
      if (bindingId === undefined)
        throw new IdentityValidationError("missing_generated_binding_id");
      if (state.roomBindings.some((b) => b.bindingId === bindingId)) {
        throw new IdentityDuplicateError();
      }
      requireActiveRoot(state, command.rootId);
      requireActivePersonaOfRoot(state, command.personaId, command.rootId);
      // One active binding per (persona, room). Terminal bindings do not block.
      const duplicateActive = state.roomBindings.some(
        (b) =>
          b.personaId === command.personaId &&
          b.roomId === command.roomId &&
          b.lifecycle !== "removed_tombstone",
      );
      if (duplicateActive) throw new IdentityDuplicateError();
      const binding: RoomIdentityBindingV1 = {
        schemaVersion: 1,
        bindingId,
        roomId: command.roomId,
        rootId: command.rootId,
        personaId: command.personaId,
        ...(command.membershipId !== undefined ? { membershipId: command.membershipId } : {}),
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "active_local_unverified",
        roomAliasState: "not_implemented_tech_id_06",
        credentialState: "not_implemented_gate_f",
        verificationState: "unverified_local",
        createdAtLocal: now,
        updatedAtLocal: now,
      };
      return withVault(state, { roomBindings: [...state.roomBindings, binding] });
    }

    case "identity.room_binding.suspend_local":
    case "identity.room_binding.tombstone": {
      const index = state.roomBindings.findIndex((b) => b.bindingId === command.bindingId);
      if (index < 0) throw new RoomIdentityBindingNotFoundError();
      const current = state.roomBindings[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new IdentityRevisionMismatchError();
      }
      const target =
        command.command === "identity.room_binding.suspend_local"
          ? "suspended_local"
          : "removed_tombstone";
      assertValidRoomBindingTransitionV1(current.lifecycle, target);
      const next: RoomIdentityBindingV1 = {
        ...current,
        lifecycle: target,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const roomBindings = state.roomBindings.slice();
      roomBindings[index] = next;
      return withVault(state, { roomBindings });
    }

    default: {
      const _never: never = command;
      throw new IdentityValidationError(`unhandled_command:${String(_never)}`);
    }
  }
}

/** An empty vault seed (memory-only or null persistence class). */
export function emptyLocalIdentityVaultV1(input: {
  vaultId: LocalIdentityVaultStateV1["vaultId"];
  persistenceClass: "memory_only" | "null";
}): LocalIdentityVaultStateV1 {
  return {
    schemaVersion: 1,
    vaultId: input.vaultId,
    revision: FIRST_IDENTITY_REVISION,
    roots: [],
    personas: [],
    relationships: [],
    roomBindings: [],
    persistenceClass: input.persistenceClass,
  };
}
