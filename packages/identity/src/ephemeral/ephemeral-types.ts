/**
 * Ephemeral identity records (TECH-ID-04). An ephemeral identity is an
 * INDEPENDENT local identity-root context: current-process only, bounded local
 * lifetime, NO recovery/promotion/export/synchronization/persistence, destroyed
 * fail-closed. It is NOT a persona, alias, guest name, a normal root with a
 * hidden flag, a recoverable short-lived account, an anonymity guarantee, a
 * remote-deletion mechanism, or a Secure Device feature. It lives in a SEPARATE
 * current-process vault, never in the long-lived `LocalIdentityVaultStateV1`.
 */

import type {
  IdentityLocalRevision,
  IdentityPersonaId,
  LocalIdentityRootId,
  PairwiseRelationshipId,
  RoomIdentityBindingId,
  RoomLocalIdRef,
  RoomMembershipIdRef,
} from "../identifiers";
import type { EphemeralProcessBindingV1 } from "./ephemeral-clock";

export type EphemeralIdentityLifecycleV1 =
  | "draft_current_process"
  | "active_current_process"
  | "expired_local"
  | "compromised_suspected"
  | "destroyed_tombstone";

export const EPHEMERAL_IDENTITY_LIFECYCLES: readonly EphemeralIdentityLifecycleV1[] = [
  "draft_current_process",
  "active_current_process",
  "expired_local",
  "compromised_suspected",
  "destroyed_tombstone",
];

export type EphemeralIdentityAssuranceV1 = "unverified_local" | "compromised_suspected" | "revoked";

export type EphemeralIdentityLifetimeModeV1 =
  "current_process" | "current_process_with_local_deadline";

export interface EphemeralIdentityLifetimeV1 {
  readonly mode: EphemeralIdentityLifetimeModeV1;
  readonly createdAtLocal: string;
  readonly expiresAtLocal?: string;
  readonly originalMaximumDurationMs?: number;
  readonly crossRestartValidity: false;
  readonly recoveryAvailable: false;
  readonly extensionAllowed: false;
}

/** An INDEPENDENT current-process root. No parent/long-lived link, no secrets. */
export interface EphemeralIdentityRootV1 {
  readonly schemaVersion: 1;
  readonly rootKind: "ephemeral_current_process";
  readonly rootId: LocalIdentityRootId;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: EphemeralIdentityLifecycleV1;
  readonly assurance: EphemeralIdentityAssuranceV1;

  readonly processBinding: EphemeralProcessBindingV1;
  readonly lifetime: EphemeralIdentityLifetimeV1;

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;

  readonly persistence: "forbidden";
  readonly recovery: "forbidden";
  readonly export: "forbidden";
  readonly synchronization: "forbidden";
  readonly promotion: "forbidden";
  readonly longLivedRootLink: "forbidden";

  readonly keyMaterialState: "not_implemented_gate_f";
  readonly deviceAuthorizationState: "not_implemented_gate_f_g";
}

export type EphemeralPersonaLifecycleV1 =
  "active_current_process" | "expired_local" | "destroyed_tombstone";

export interface EphemeralIdentityPersonaV1 {
  readonly schemaVersion: 1;
  readonly personaId: IdentityPersonaId;
  readonly rootId: LocalIdentityRootId;
  readonly rootKind: "ephemeral_current_process";
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: EphemeralPersonaLifecycleV1;

  readonly localLabel?: string;
  readonly presentationState: "local_placeholder";
  readonly persistence: "forbidden";
  readonly export: "forbidden";

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
}

export type EphemeralRelationshipLifecycleV1 =
  | "draft_current_process"
  | "active_local_unverified"
  | "blocked_local"
  | "expired_local"
  | "destroyed_tombstone";

export interface EphemeralPairwiseRelationshipV1 {
  readonly schemaVersion: 1;
  readonly relationshipId: PairwiseRelationshipId;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: EphemeralRelationshipLifecycleV1;

  readonly assurance: "unverified_local";
  readonly aliasState: "not_implemented_tech_id_05";
  readonly trustState: "not_inherited";
  readonly persistence: "forbidden";
  readonly export: "forbidden";

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
}

export type EphemeralRoomBindingLifecycleV1 =
  | "draft_current_process"
  | "active_local_unverified"
  | "suspended_local"
  | "expired_local"
  | "destroyed_tombstone";

export interface EphemeralRoomIdentityBindingV1 {
  readonly schemaVersion: 1;
  readonly bindingId: RoomIdentityBindingId;
  readonly roomId: RoomLocalIdRef;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly membershipId?: RoomMembershipIdRef;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: EphemeralRoomBindingLifecycleV1;

  readonly roomAliasState: "not_implemented_tech_id_06";
  readonly credentialState: "not_implemented_gate_f";
  readonly persistence: "forbidden";
  readonly export: "forbidden";

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
}

/** Separate current-process aggregate — never persisted, never cross-restart. */
export interface EphemeralIdentityVaultStateV1 {
  readonly schemaVersion: 1;
  readonly processBinding: EphemeralProcessBindingV1;
  readonly roots: readonly EphemeralIdentityRootV1[];
  readonly personas: readonly EphemeralIdentityPersonaV1[];
  readonly relationships: readonly EphemeralPairwiseRelationshipV1[];
  readonly roomBindings: readonly EphemeralRoomIdentityBindingV1[];
  readonly persistenceClass: "current_process_memory" | "null";
}

export interface EphemeralIdentityDestructionResultV1 {
  readonly schemaVersion: 1;
  readonly destroyed: true;
  readonly currentProcessStateCleared: boolean;
  readonly childPersonasCleared: boolean;
  readonly childRelationshipsCleared: boolean;
  readonly childRoomBindingsCleared: boolean;

  readonly persistentMediaSanitized: false;
  readonly remoteCopiesAffected: false;
  readonly externalObservationsAffected: false;
  readonly forensicErasureGuaranteed: false;
  readonly redacted: true;
}

export interface EphemeralIdentitySummaryV1 {
  readonly schemaVersion: 1;
  readonly rootId?: LocalIdentityRootId;
  readonly lifecycle: EphemeralIdentityLifecycleV1;
  readonly assurance: EphemeralIdentityAssuranceV1;

  readonly lifetimeMode: EphemeralIdentityLifetimeModeV1;
  readonly expiresAtLocal?: string;
  readonly personaCount?: number;
  readonly relationshipCount?: number;
  readonly roomBindingCount?: number;

  readonly currentProcessOnly: true;
  readonly recoveryAvailable: false;
  readonly persistent: false;
  readonly anonymous: false;
  readonly forensicErasureGuaranteed: false;
  readonly redacted: boolean;
}
