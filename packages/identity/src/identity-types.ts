/**
 * Identity Firewall scaffolding records (TECH-ID-03) — LOCAL, METADATA-ONLY,
 * NON-CRYPTOGRAPHIC. No key material, no recovery material, no contact/device
 * identifiers, no DevicePosture, no RoomMemberRef-as-identity. Roots are PRIVATE
 * and never peer-facing. Personas under one root are NOT guaranteed unlinkable.
 * Aliases (per-contact/per-room), device keys/passports, Trust Notebook, invites,
 * verification and recovery are NOT implemented (future TECH-ID / Gate F).
 */

import type {
  IdentityPersonaId,
  IdentityVaultId,
  IdentityLocalRevision,
  LocalIdentityRootId,
  PairwiseRelationshipId,
  RoomIdentityBindingId,
  RoomLocalIdRef,
  RoomMembershipIdRef,
} from "./identifiers";

// ---------------------------------------------------------------------------
// Lifecycle + assurance unions (explicit; exhaustively switched elsewhere)
// ---------------------------------------------------------------------------

/**
 * Root-kind discriminant (TECH-ID-04). Long-lived roots live in the
 * `LocalIdentityVaultStateV1`; ephemeral roots are an INDEPENDENT current-process
 * context in the separate ephemeral module. Unknown kinds fail closed.
 */
export type LocalIdentityRootKindV1 = "long_lived_local" | "ephemeral_current_process";

export const LOCAL_IDENTITY_ROOT_KINDS: readonly LocalIdentityRootKindV1[] = [
  "long_lived_local",
  "ephemeral_current_process",
];

export type LocalIdentityRootLifecycleV1 =
  | "draft_local"
  | "active_local"
  | "locked_local"
  | "recovery_required"
  | "recovered_reverification_required"
  | "compromised_suspected"
  | "revoked_tombstone";

export const LOCAL_IDENTITY_ROOT_LIFECYCLES: readonly LocalIdentityRootLifecycleV1[] = [
  "draft_local",
  "active_local",
  "locked_local",
  "recovery_required",
  "recovered_reverification_required",
  "compromised_suspected",
  "revoked_tombstone",
];

/**
 * FreeLayer-specific trust states (NOT NIST IAL/AAL). Production TECH-ID-03 may
 * only create `unverified_local`, `compromised_suspected`, `revoked`; the
 * `*_future` and verification states exist in the contract but are not promoted
 * by current code (no verification/fingerprints/key-change detection here).
 */
export type IdentityAssuranceStateV1 =
  | "unverified_local"
  | "continuity_observed"
  | "out_of_band_verified"
  | "key_change_warning_future"
  | "device_change_warning_future"
  | "recovered_reverification_required"
  | "compromised_suspected"
  | "revoked";

export const IDENTITY_ASSURANCE_STATES: readonly IdentityAssuranceStateV1[] = [
  "unverified_local",
  "continuity_observed",
  "out_of_band_verified",
  "key_change_warning_future",
  "device_change_warning_future",
  "recovered_reverification_required",
  "compromised_suspected",
  "revoked",
];

/** Assurance states current production code is allowed to write. */
export const PRODUCTION_ASSURANCE_STATES: readonly IdentityAssuranceStateV1[] = [
  "unverified_local",
  "compromised_suspected",
  "revoked",
];

export type IdentityPersonaLifecycleV1 = "active_local" | "archived_local" | "revoked_tombstone";

export const IDENTITY_PERSONA_LIFECYCLES: readonly IdentityPersonaLifecycleV1[] = [
  "active_local",
  "archived_local",
  "revoked_tombstone",
];

export type PairwiseRelationshipLifecycleV1 =
  | "draft_local"
  | "active_local_unverified"
  | "blocked_local"
  | "compromised_suspected"
  | "removed_tombstone";

export const PAIRWISE_RELATIONSHIP_LIFECYCLES: readonly PairwiseRelationshipLifecycleV1[] = [
  "draft_local",
  "active_local_unverified",
  "blocked_local",
  "compromised_suspected",
  "removed_tombstone",
];

export type RoomIdentityBindingLifecycleV1 =
  "draft_local" | "active_local_unverified" | "suspended_local" | "removed_tombstone";

export const ROOM_IDENTITY_BINDING_LIFECYCLES: readonly RoomIdentityBindingLifecycleV1[] = [
  "draft_local",
  "active_local_unverified",
  "suspended_local",
  "removed_tombstone",
];

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/** A PRIVATE local identity authority record — never peer-facing, no secrets. */
export interface LocalIdentityRootV1 {
  readonly schemaVersion: 1;
  /** Discriminant (TECH-ID-04): long-lived roots in this vault are always this. */
  readonly rootKind: "long_lived_local";
  readonly rootId: LocalIdentityRootId;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: LocalIdentityRootLifecycleV1;
  readonly assurance: IdentityAssuranceStateV1;

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;

  readonly publicExposure: "forbidden";
  readonly phoneRequired: false;
  readonly emailRequired: false;
  readonly publicDirectory: "forbidden";

  readonly keyMaterialState: "not_implemented_gate_f";
  readonly recoveryState: "not_configured" | "future_gate" | "reverification_required";
  readonly deviceAuthorizationState: "not_implemented_gate_f_g";
  readonly persistenceClass: "memory_only" | "null";
}

/** A local presentation/policy context under one root. NOT guaranteed unlinkable. */
export interface IdentityPersonaV1 {
  readonly schemaVersion: 1;
  readonly personaId: IdentityPersonaId;
  readonly rootId: LocalIdentityRootId;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: IdentityPersonaLifecycleV1;

  /** Local, sensitive, never exported, never a public username. */
  readonly localLabel?: string;
  readonly presentationState: "local_placeholder";
  readonly peerVisibleAliasState: "not_implemented_tech_id_05_06";

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
}

/** A per-contact relationship placeholder. No peer content, no crypto, no alias. */
export interface PairwiseRelationshipV1 {
  readonly schemaVersion: 1;
  readonly relationshipId: PairwiseRelationshipId;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: PairwiseRelationshipLifecycleV1;
  readonly assurance: IdentityAssuranceStateV1;

  readonly peerReferenceState: "opaque_placeholder";
  readonly aliasState: "not_implemented_tech_id_05";
  readonly trustNotebookState: "not_implemented_tech_id_09";

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
}

/** Binds a root/persona to one room via a room-scoped placeholder. No alias yet. */
export interface RoomIdentityBindingV1 {
  readonly schemaVersion: 1;
  readonly bindingId: RoomIdentityBindingId;
  readonly roomId: RoomLocalIdRef;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly membershipId?: RoomMembershipIdRef;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: RoomIdentityBindingLifecycleV1;

  readonly roomAliasState: "not_implemented_tech_id_06";
  readonly credentialState: "not_implemented_gate_f";
  readonly verificationState: "unverified_local";

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
}

/** The local aggregate. Immutable collections; no ambient/default identity. */
export interface LocalIdentityVaultStateV1 {
  readonly schemaVersion: 1;
  readonly vaultId: IdentityVaultId;
  readonly revision: IdentityLocalRevision;

  readonly roots: readonly LocalIdentityRootV1[];
  readonly personas: readonly IdentityPersonaV1[];
  readonly relationships: readonly PairwiseRelationshipV1[];
  readonly roomBindings: readonly RoomIdentityBindingV1[];

  readonly persistenceClass: "memory_only" | "null";
}
