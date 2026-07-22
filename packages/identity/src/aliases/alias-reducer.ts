/**
 * Pure per-contact alias reducer + rotation (TECH-ID-05). PURE: validate-before-
 * mutate; no storage/network/notification/AI/crypto/randomness; injected ids +
 * clock + a validated relationship ref only; source state/command never mutated;
 * deterministic; revisions +1; failure → no partial state. Rotation retires the
 * old alias + creates a new active-local-unshared record, preserving the
 * relationship id / block / trust (those live on the relationship, not here) and
 * making NO remote-deletion or authenticated-update claim.
 */

import { FIRST_IDENTITY_REVISION, nextIdentityRevision } from "../identifiers";
import {
  ContactAliasDuplicateActiveError,
  ContactAliasNotFoundError,
  ContactAliasRelationshipMismatchError,
  ContactAliasRevisionMismatchError,
  ContactAliasValidationError,
} from "./alias-errors";
import {
  assertLocalPeerLabelTransitionV1,
  assertPresentationAliasTransitionV1,
} from "./alias-lifecycle";
import { assessContactAliasReuseV1 } from "./alias-correlation";
import { normalizeContactAliasDisplayTextV1 } from "./alias-normalization";
import type { ContactAliasGeneratedIdsV1 } from "./alias-identifiers";
import type { ContactAliasCommandV1 } from "./alias-commands";
import type {
  ContactAliasRelationshipRefV1,
  ContactAliasSecurityAssessmentV1,
  ContactAliasStateV1,
  ContactAliasRotationResultV1,
  LocalPeerLabelV1,
  PairwisePresentationAliasV1,
} from "./alias-types";
import type { ContactAliasTextV1 } from "./alias-normalization";

export interface ReduceContactAliasInputV1 {
  readonly state: ContactAliasStateV1;
  readonly command: ContactAliasCommandV1;
  /** Resolved + validated relationship (required for create/rotate/set). */
  readonly relationshipRef?: ContactAliasRelationshipRefV1;
  readonly generatedIds: ContactAliasGeneratedIdsV1;
  readonly clockValue: string;
}

function requireRef(ref: ContactAliasRelationshipRefV1 | undefined): ContactAliasRelationshipRefV1 {
  if (ref === undefined) throw new ContactAliasValidationError("missing_relationship_ref");
  if (!ref.rootAndPersonaActive || ref.relationshipLifecycle === "removed_tombstone") {
    throw new ContactAliasRelationshipMismatchError("relationship_not_active");
  }
  return ref;
}

function assertRefMatches(
  ref: ContactAliasRelationshipRefV1,
  cmd: { relationshipId: string; rootId: string; personaId: string },
): void {
  if (
    ref.relationshipId !== cmd.relationshipId ||
    ref.rootId !== cmd.rootId ||
    ref.personaId !== cmd.personaId
  ) {
    throw new ContactAliasRelationshipMismatchError("ref_mismatch");
  }
}

function buildAssessment(
  state: ContactAliasStateV1,
  text: ContactAliasTextV1,
  relationshipId: string,
): ContactAliasSecurityAssessmentV1 {
  const reuse = assessContactAliasReuseV1({
    state,
    normalizedValue: text.normalizedValue,
    forRelationshipId: relationshipId as never,
  });
  return {
    schemaVersion: 1,
    normalized: true,
    dangerousControlsRejected: true,
    confusableAssessment: "not_evaluated",
    correlationRisk: reuse.normalizedValueReused
      ? "reused_normalized_value_in_current_vault"
      : "unique_normalized_value_in_current_vault",
    impersonationSafe: false,
    verifiedIdentity: false,
  };
}

function newAlias(input: {
  aliasId: PairwisePresentationAliasV1["aliasId"];
  ref: ContactAliasRelationshipRefV1;
  text: ContactAliasTextV1;
  assessment: ContactAliasSecurityAssessmentV1;
  lifecycle: PairwisePresentationAliasV1["lifecycle"];
  now: string;
  persistenceClass: "memory_only" | "null";
}): PairwisePresentationAliasV1 {
  return {
    schemaVersion: 1,
    aliasId: input.aliasId,
    rootId: input.ref.rootId,
    personaId: input.ref.personaId,
    relationshipId: input.ref.relationshipId,
    rootKind: input.ref.rootKind,
    revision: FIRST_IDENTITY_REVISION,
    lifecycle: input.lifecycle,
    displayText: input.text,
    securityAssessment: input.assessment,
    origin: "user_supplied_local",
    sharingState: "not_shared_tech_id_05",
    authenticatedBinding: "not_implemented_gate_f",
    remoteUpdateState: "not_implemented_gate_e_f",
    createdAtLocal: input.now,
    updatedAtLocal: input.now,
    persistenceClass: input.persistenceClass,
  };
}

function hasActiveAliasForRelationship(
  state: ContactAliasStateV1,
  relationshipId: string,
): boolean {
  return state.presentationAliases.some(
    (a) => a.relationshipId === relationshipId && a.lifecycle !== "retired_tombstone",
  );
}

export function reduceContactAliasCommandV1(input: ReduceContactAliasInputV1): ContactAliasStateV1 {
  const { state, command, generatedIds, clockValue: now } = input;

  switch (command.command) {
    case "identity.alias.presentation.create": {
      const ref = requireRef(input.relationshipRef);
      assertRefMatches(ref, command);
      const aliasId = generatedIds.aliasId;
      if (aliasId === undefined) throw new ContactAliasValidationError("missing_alias_id");
      if (state.presentationAliases.some((a) => a.aliasId === aliasId)) {
        throw new ContactAliasValidationError("duplicate_id");
      }
      if (hasActiveAliasForRelationship(state, command.relationshipId)) {
        throw new ContactAliasDuplicateActiveError();
      }
      const text = normalizeContactAliasDisplayTextV1(command.displayText);
      const alias = newAlias({
        aliasId,
        ref,
        text,
        assessment: buildAssessment(state, text, command.relationshipId),
        lifecycle: "draft_local",
        now,
        persistenceClass: state.persistenceClass,
      });
      return { ...state, presentationAliases: [...state.presentationAliases, alias] };
    }

    case "identity.alias.presentation.activate":
    case "identity.alias.presentation.retire": {
      const index = state.presentationAliases.findIndex((a) => a.aliasId === command.aliasId);
      if (index < 0) throw new ContactAliasNotFoundError();
      const current = state.presentationAliases[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new ContactAliasRevisionMismatchError();
      }
      const target: PairwisePresentationAliasV1["lifecycle"] =
        command.command === "identity.alias.presentation.activate"
          ? "active_local_unshared"
          : "retired_tombstone";
      assertPresentationAliasTransitionV1(current.lifecycle, target);
      if (
        target === "active_local_unshared" &&
        state.presentationAliases.some(
          (a) =>
            a.relationshipId === current.relationshipId &&
            a.aliasId !== current.aliasId &&
            a.lifecycle === "active_local_unshared",
        )
      ) {
        throw new ContactAliasDuplicateActiveError();
      }
      const next = {
        ...current,
        lifecycle: target,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const list = state.presentationAliases.slice();
      list[index] = next;
      return { ...state, presentationAliases: list };
    }

    case "identity.alias.presentation.rotate": {
      const ref = requireRef(input.relationshipRef);
      assertRefMatches(ref, command);
      const index = state.presentationAliases.findIndex(
        (a) => a.aliasId === command.currentAliasId,
      );
      if (index < 0) throw new ContactAliasNotFoundError();
      const current = state.presentationAliases[index]!;
      if (current.relationshipId !== command.relationshipId) {
        throw new ContactAliasRelationshipMismatchError();
      }
      if ((current.revision as number) !== (command.currentExpectedRevision as number)) {
        throw new ContactAliasRevisionMismatchError();
      }
      assertPresentationAliasTransitionV1(current.lifecycle, "retired_tombstone");
      const newAliasId = generatedIds.aliasId;
      if (newAliasId === undefined) throw new ContactAliasValidationError("missing_alias_id");
      if (state.presentationAliases.some((a) => a.aliasId === newAliasId)) {
        throw new ContactAliasValidationError("duplicate_id");
      }
      const retired = {
        ...current,
        lifecycle: "retired_tombstone" as const,
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const text = normalizeContactAliasDisplayTextV1(command.newDisplayText);
      const fresh = newAlias({
        aliasId: newAliasId,
        ref,
        text,
        assessment: buildAssessment(state, text, command.relationshipId),
        lifecycle: "active_local_unshared",
        now,
        persistenceClass: state.persistenceClass,
      });
      const list = state.presentationAliases.slice();
      list[index] = retired;
      return { ...state, presentationAliases: [...list, fresh] };
    }

    case "identity.alias.local_peer_label.set": {
      const ref = requireRef(input.relationshipRef);
      assertRefMatches(ref, command);
      const labelId = generatedIds.labelId;
      if (labelId === undefined) throw new ContactAliasValidationError("missing_label_id");
      if (state.localPeerLabels.some((l) => l.labelId === labelId)) {
        throw new ContactAliasValidationError("duplicate_id");
      }
      if (
        state.localPeerLabels.some(
          (l) =>
            l.relationshipId === command.relationshipId && l.lifecycle === "active_local_private",
        )
      ) {
        throw new ContactAliasDuplicateActiveError();
      }
      const label: LocalPeerLabelV1 = {
        schemaVersion: 1,
        labelId,
        rootId: ref.rootId,
        personaId: ref.personaId,
        relationshipId: ref.relationshipId,
        rootKind: ref.rootKind,
        revision: FIRST_IDENTITY_REVISION,
        lifecycle: "active_local_private",
        labelText: normalizeContactAliasDisplayTextV1(command.labelText),
        visibility: "local_only",
        peerShared: false,
        authority: "none",
        verificationEvidence: false,
        createdAtLocal: now,
        updatedAtLocal: now,
        persistenceClass: state.persistenceClass,
      };
      return { ...state, localPeerLabels: [...state.localPeerLabels, label] };
    }

    case "identity.alias.local_peer_label.replace": {
      const index = state.localPeerLabels.findIndex((l) => l.labelId === command.labelId);
      if (index < 0) throw new ContactAliasNotFoundError();
      const current = state.localPeerLabels[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new ContactAliasRevisionMismatchError();
      }
      if (current.lifecycle !== "active_local_private") {
        throw new ContactAliasValidationError("not_active");
      }
      // In-place text replacement (no old plaintext retained).
      const next: LocalPeerLabelV1 = {
        ...current,
        labelText: normalizeContactAliasDisplayTextV1(command.labelText),
        revision: nextIdentityRevision(current.revision),
        updatedAtLocal: now,
      };
      const list = state.localPeerLabels.slice();
      list[index] = next;
      return { ...state, localPeerLabels: list };
    }

    case "identity.alias.local_peer_label.clear": {
      const index = state.localPeerLabels.findIndex((l) => l.labelId === command.labelId);
      if (index < 0) throw new ContactAliasNotFoundError();
      const current = state.localPeerLabels[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new ContactAliasRevisionMismatchError();
      }
      assertLocalPeerLabelTransitionV1(current.lifecycle, "cleared_tombstone");
      // Remove the record entirely — no cleared-label text retained.
      return {
        ...state,
        localPeerLabels: state.localPeerLabels.filter((l) => l.labelId !== command.labelId),
      };
    }

    default: {
      const _never: never = command;
      throw new ContactAliasValidationError(`unhandled:${String(_never)}`);
    }
  }
}

export const CONTACT_ALIAS_ROTATION_RESULT_V1: ContactAliasRotationResultV1 = {
  schemaVersion: 1,
  rotated: true,
  relationshipContinuityPreserved: true,
  trustStateChanged: false,
  blockStateChanged: false,
  remoteCopiesAffected: false,
  authenticatedRemoteUpdatePerformed: false,
  redacted: true,
};

export function emptyContactAliasStateV1(
  persistenceClass: "memory_only" | "null" = "memory_only",
): ContactAliasStateV1 {
  return { schemaVersion: 1, presentationAliases: [], localPeerLabels: [], persistenceClass };
}
