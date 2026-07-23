/**
 * Per-room alias domain types (TECH-ID-06). A room presentation alias is the
 * LOCAL presentation chosen for ONE identity binding in ONE Sovereign Room. It
 * is room-scoped, root/persona/binding-bound, non-authoritative, not global, not
 * verified, and local/unshared in TECH-ID-06. It is NOT identity, NOT membership,
 * NOT a role, NOT a RoomMemberRef, NOT a global username. A room role is not
 * proof of identity; a collision is not proof of impersonation; DevicePosture is
 * not identity.
 *
 * The Identity Firewall never imports @freelayer/rooms; RoomOS role/state values
 * are mirrored here as a NARROW read-model contract the caller supplies.
 */

import type {
  IdentityLocalRevision,
  IdentityPersonaId,
  LocalIdentityRootId,
  RoomIdentityBindingId,
  RoomLocalIdRef,
  RoomMembershipIdRef,
} from "../identifiers";
import type {
  IdentityAssuranceStateV1,
  LocalIdentityRootKindV1,
  RoomIdentityBindingLifecycleV1,
} from "../identity-types";
import type { ContactAliasDisplayText, ContactAliasTextV1 } from "../aliases";
import type { RoomPresentationAliasId } from "./room-alias-identifiers";

// ---------------------------------------------------------------------------
// RoomOS read-model MIRROR (caller-supplied; identity never imports rooms)
// ---------------------------------------------------------------------------

/** Mirror of RoomOS `RoomMembershipRoleV1` values (non-authoritative here). */
export type RoomOsMembershipRoleV1 =
  "owner_placeholder" | "editor_placeholder" | "viewer_placeholder" | "auditor_placeholder";

/** Mirror of RoomOS `RoomMembershipStateV1` values. */
export type RoomOsMembershipStateV1 =
  "active_local_unverified" | "suspended_local" | "removed_tombstone";

// ---------------------------------------------------------------------------
// Lifecycle + record
// ---------------------------------------------------------------------------

export type RoomPresentationAliasLifecycleV1 =
  "draft_local" | "active_local_unshared" | "retired_tombstone";

/**
 * Caller-resolved, validated reference to the room identity binding the alias
 * belongs to. Decouples the alias module from a specific vault and supports both
 * long-lived and ephemeral roots. For ephemeral roots the caller sets
 * `rootBindingActive:false` once the process epoch has passed (an ephemeral
 * alias can never outlive its root).
 */
export interface RoomAliasBindingRefV1 {
  readonly bindingId: RoomIdentityBindingId;
  readonly roomId: RoomLocalIdRef;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly rootKind: LocalIdentityRootKindV1;
  readonly membershipId?: RoomMembershipIdRef;
  readonly bindingLifecycle: RoomIdentityBindingLifecycleV1;
  readonly bindingRevision: IdentityLocalRevision;
  readonly membershipState?: RoomOsMembershipStateV1;
  readonly membershipRole?: RoomOsMembershipRoleV1;
  readonly identityAssurance: IdentityAssuranceStateV1;
  /** Caller asserts root + persona + binding are all active (and, for an
   *  ephemeral root, that the process epoch has not passed). */
  readonly rootBindingActive: boolean;
}

export interface RoomPresentationAliasV1 {
  readonly schemaVersion: 1;
  readonly aliasId: RoomPresentationAliasId;

  readonly roomId: RoomLocalIdRef;
  readonly bindingId: RoomIdentityBindingId;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly rootKind: LocalIdentityRootKindV1;
  readonly membershipId?: RoomMembershipIdRef;

  readonly revision: IdentityLocalRevision;
  readonly lifecycle: RoomPresentationAliasLifecycleV1;
  readonly displayText: ContactAliasTextV1;

  readonly scope: "one_room_only";
  readonly origin: "user_supplied_local" | "injected_generated_placeholder";

  readonly sharingState: "not_shared_tech_id_06";
  readonly authenticatedBinding: "not_implemented_gate_f";
  readonly remoteUpdateState: "not_implemented_gate_e_f_h";

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
  readonly persistenceClass: "memory_only" | "null";
}

/** The local aggregate for one caller scope. Memory/null only. */
export interface RoomAliasStateV1 {
  readonly schemaVersion: 1;
  readonly presentationAliases: readonly RoomPresentationAliasV1[];
  readonly persistenceClass: "memory_only" | "null";
}

// ---------------------------------------------------------------------------
// Collision + observations
// ---------------------------------------------------------------------------

export type RoomAliasCollisionStateV1 =
  "unique_in_current_room_observation" | "duplicate_in_current_room_observation" | "not_evaluated";

export interface RoomAliasCollisionAssessmentV1 {
  readonly schemaVersion: 1;
  readonly state: RoomAliasCollisionStateV1;
  readonly exactCollisionCountExposed: false;
  readonly collidingMemberIdsExposed: false;
  readonly impersonationProven: false;
  readonly reasonCode: string;
}

/** Transient input for one display calculation. No root/persona data. */
export interface RoomAliasObservationV1 {
  readonly roomId: RoomLocalIdRef;
  readonly membershipId: RoomMembershipIdRef;
  readonly normalizedAlias?: ContactAliasDisplayText;
  readonly membershipState: RoomOsMembershipStateV1;
}

// ---------------------------------------------------------------------------
// Disambiguation
// ---------------------------------------------------------------------------

export type RoomAliasDisambiguationStrategyV1 =
  | "alias_only"
  | "alias_plus_room_local_member_reference"
  | "redacted_member_reference"
  | "fully_redacted";

export interface RoomAliasDisambiguationV1 {
  readonly schemaVersion: 1;
  readonly required: boolean;
  readonly strategy: RoomAliasDisambiguationStrategyV1;
  readonly verifiedIdentity: false;
  readonly globalIdentifierExposed: false;
  readonly reasonCode: string;
}

// ---------------------------------------------------------------------------
// Cross-room reuse
// ---------------------------------------------------------------------------

export interface RoomAliasReuseAssessmentV1 {
  readonly schemaVersion: 1;
  readonly normalizedValueReusedAcrossRooms: boolean;
  readonly affectedRoomCountExposed: false;
  readonly affectedRoomIdsExposed: false;
  readonly correlationRisk: "display_value_reused" | "none_detected_locally" | "not_evaluated";
  readonly unlinkabilityGuaranteed: false;
  readonly reasonCode: string;
}

// ---------------------------------------------------------------------------
// Display context + rotation result
// ---------------------------------------------------------------------------

export interface RoomMemberDisplayContextV1 {
  readonly schemaVersion: 1;
  readonly roomId?: RoomLocalIdRef;
  readonly membershipId?: RoomMembershipIdRef;
  readonly roomAlias?: ContactAliasDisplayText;

  readonly membershipRole: RoomOsMembershipRoleV1;
  readonly membershipState: RoomOsMembershipStateV1;
  readonly identityAssurance: IdentityAssuranceStateV1;

  readonly aliasScope: "this_room_only";
  readonly collisionState: RoomAliasCollisionStateV1;
  readonly disambiguation: RoomAliasDisambiguationStrategyV1;

  readonly aliasVerified: false;
  readonly realWorldIdentityVerified: false;
  readonly cryptographicBindingAvailable: false;
  readonly authorityDerivedFromAlias: false;
  readonly redacted: boolean;
}

export interface RoomAliasRotationResultV1 {
  readonly schemaVersion: 1;
  readonly rotated: true;
  readonly roomBindingPreserved: true;
  readonly membershipPreserved: true;
  readonly membershipRoleChanged: false;
  readonly assuranceChanged: false;
  readonly remoteCopiesAffected: false;
  readonly authenticatedRemoteUpdatePerformed: false;
  readonly historicalMessagesRelabelled: false;
  readonly redacted: true;
}
