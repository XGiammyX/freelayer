/**
 * Pure per-room alias reducer + rotation (TECH-ID-06). PURE: validate-before-
 * mutate; no storage/network/notification/AI/crypto/randomness; no direct RoomOS
 * membership mutation; injected ids + clock + a validated binding ref only;
 * source state/command never mutated; deterministic; revisions +1; failure → no
 * partial state. Rotation retires the old alias + creates a new active-local-
 * unshared record, preserving the room binding / membership / role / assurance
 * (those live on RoomOS + the binding, not here) and making NO remote-deletion,
 * NO authenticated-update, and NO historical-message-relabel claim.
 */

import { FIRST_IDENTITY_REVISION, nextIdentityRevision } from "../identifiers";
import { normalizeContactAliasDisplayTextV1, type ContactAliasTextV1 } from "../aliases";
import {
  RoomAliasBindingMismatchError,
  RoomAliasDuplicateActiveError,
  RoomAliasMembershipMismatchError,
  RoomAliasNotFoundError,
  RoomAliasRevisionMismatchError,
  RoomAliasValidationError,
} from "./room-alias-errors";
import { assertRoomPresentationAliasTransitionV1 } from "./room-alias-lifecycle";
import type { RoomAliasCommandV1 } from "./room-alias-commands";
import type { RoomAliasGeneratedIdsV1, RoomPresentationAliasId } from "./room-alias-identifiers";
import type {
  RoomAliasBindingRefV1,
  RoomAliasRotationResultV1,
  RoomAliasStateV1,
  RoomPresentationAliasLifecycleV1,
  RoomPresentationAliasV1,
} from "./room-alias-types";

export interface ReduceRoomAliasInputV1 {
  readonly state: RoomAliasStateV1;
  readonly command: RoomAliasCommandV1;
  /** Resolved + validated binding (required for create/rotate). */
  readonly bindingRef?: RoomAliasBindingRefV1;
  readonly generatedIds: RoomAliasGeneratedIdsV1;
  readonly clockValue: string;
}

function requireRef(ref: RoomAliasBindingRefV1 | undefined): RoomAliasBindingRefV1 {
  if (ref === undefined) throw new RoomAliasValidationError("missing_binding_ref");
  if (!ref.rootBindingActive || ref.bindingLifecycle === "removed_tombstone") {
    throw new RoomAliasBindingMismatchError("binding_not_active");
  }
  if (ref.membershipState === "removed_tombstone") {
    throw new RoomAliasMembershipMismatchError("membership_removed");
  }
  return ref;
}

function assertRefMatches(
  ref: RoomAliasBindingRefV1,
  cmd: {
    roomId: string;
    bindingId: string;
    rootId: string;
    personaId: string;
    membershipId?: string;
    expectedBindingRevision: number;
  },
): void {
  if (
    (ref.roomId as string) !== cmd.roomId ||
    (ref.bindingId as string) !== cmd.bindingId ||
    (ref.rootId as string) !== cmd.rootId ||
    (ref.personaId as string) !== cmd.personaId
  ) {
    throw new RoomAliasBindingMismatchError("ref_mismatch");
  }
  if ((ref.bindingRevision as number) !== cmd.expectedBindingRevision) {
    throw new RoomAliasRevisionMismatchError("binding_revision");
  }
  // Membership, when named, must belong to this room binding.
  if (
    cmd.membershipId !== undefined &&
    (ref.membershipId as string | undefined) !== cmd.membershipId
  ) {
    throw new RoomAliasMembershipMismatchError("membership_mismatch");
  }
}

function newAlias(input: {
  aliasId: RoomPresentationAliasId;
  ref: RoomAliasBindingRefV1;
  text: ContactAliasTextV1;
  lifecycle: RoomPresentationAliasLifecycleV1;
  now: string;
  persistenceClass: "memory_only" | "null";
}): RoomPresentationAliasV1 {
  const { ref } = input;
  return {
    schemaVersion: 1,
    aliasId: input.aliasId,
    roomId: ref.roomId,
    bindingId: ref.bindingId,
    rootId: ref.rootId,
    personaId: ref.personaId,
    rootKind: ref.rootKind,
    ...(ref.membershipId !== undefined ? { membershipId: ref.membershipId } : {}),
    revision: FIRST_IDENTITY_REVISION,
    lifecycle: input.lifecycle,
    displayText: input.text,
    scope: "one_room_only",
    origin: "user_supplied_local",
    sharingState: "not_shared_tech_id_06",
    authenticatedBinding: "not_implemented_gate_f",
    remoteUpdateState: "not_implemented_gate_e_f_h",
    createdAtLocal: input.now,
    updatedAtLocal: input.now,
    persistenceClass: input.persistenceClass,
  };
}

function hasActiveAliasForBinding(state: RoomAliasStateV1, bindingId: string): boolean {
  return state.presentationAliases.some(
    (a) => (a.bindingId as string) === bindingId && a.lifecycle !== "retired_tombstone",
  );
}

export function reduceRoomAliasCommandV1(input: ReduceRoomAliasInputV1): RoomAliasStateV1 {
  const { state, command, generatedIds, clockValue: now } = input;

  switch (command.command) {
    case "identity.room_alias.create": {
      const ref = requireRef(input.bindingRef);
      assertRefMatches(ref, command);
      const aliasId = generatedIds.aliasId;
      if (aliasId === undefined) throw new RoomAliasValidationError("missing_alias_id");
      if (state.presentationAliases.some((a) => a.aliasId === aliasId)) {
        throw new RoomAliasValidationError("duplicate_id");
      }
      if (hasActiveAliasForBinding(state, command.bindingId)) {
        throw new RoomAliasDuplicateActiveError();
      }
      const text = normalizeContactAliasDisplayTextV1(command.displayText);
      const alias = newAlias({
        aliasId,
        ref,
        text,
        lifecycle: "draft_local",
        now,
        persistenceClass: state.persistenceClass,
      });
      return { ...state, presentationAliases: [...state.presentationAliases, alias] };
    }

    case "identity.room_alias.activate":
    case "identity.room_alias.retire": {
      const index = state.presentationAliases.findIndex((a) => a.aliasId === command.aliasId);
      if (index < 0) throw new RoomAliasNotFoundError();
      const current = state.presentationAliases[index]!;
      if ((current.revision as number) !== (command.expectedRevision as number)) {
        throw new RoomAliasRevisionMismatchError();
      }
      const target: RoomPresentationAliasLifecycleV1 =
        command.command === "identity.room_alias.activate"
          ? "active_local_unshared"
          : "retired_tombstone";
      assertRoomPresentationAliasTransitionV1(current.lifecycle, target);
      if (
        target === "active_local_unshared" &&
        state.presentationAliases.some(
          (a) =>
            (a.bindingId as string) === (current.bindingId as string) &&
            a.aliasId !== current.aliasId &&
            a.lifecycle === "active_local_unshared",
        )
      ) {
        throw new RoomAliasDuplicateActiveError();
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

    case "identity.room_alias.rotate": {
      const ref = requireRef(input.bindingRef);
      assertRefMatches(ref, command);
      const index = state.presentationAliases.findIndex(
        (a) => a.aliasId === command.currentAliasId,
      );
      if (index < 0) throw new RoomAliasNotFoundError();
      const current = state.presentationAliases[index]!;
      if ((current.bindingId as string) !== command.bindingId) {
        throw new RoomAliasBindingMismatchError();
      }
      if ((current.revision as number) !== (command.currentExpectedRevision as number)) {
        throw new RoomAliasRevisionMismatchError();
      }
      assertRoomPresentationAliasTransitionV1(current.lifecycle, "retired_tombstone");
      const newAliasId = generatedIds.aliasId;
      if (newAliasId === undefined) throw new RoomAliasValidationError("missing_alias_id");
      if (state.presentationAliases.some((a) => a.aliasId === newAliasId)) {
        throw new RoomAliasValidationError("duplicate_id");
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
        lifecycle: "active_local_unshared",
        now,
        persistenceClass: state.persistenceClass,
      });
      const list = state.presentationAliases.slice();
      list[index] = retired;
      return { ...state, presentationAliases: [...list, fresh] };
    }

    default: {
      const _never: never = command;
      throw new RoomAliasValidationError(`unhandled:${String(_never)}`);
    }
  }
}

export const ROOM_ALIAS_ROTATION_RESULT_V1: RoomAliasRotationResultV1 = {
  schemaVersion: 1,
  rotated: true,
  roomBindingPreserved: true,
  membershipPreserved: true,
  membershipRoleChanged: false,
  assuranceChanged: false,
  remoteCopiesAffected: false,
  authenticatedRemoteUpdatePerformed: false,
  historicalMessagesRelabelled: false,
  redacted: true,
};

export function emptyRoomAliasStateV1(
  persistenceClass: "memory_only" | "null" = "memory_only",
): RoomAliasStateV1 {
  return { schemaVersion: 1, presentationAliases: [], persistenceClass };
}
