/**
 * Per-contact alias records + assessments (TECH-ID-05). Two distinct classes: a
 * PAIRWISE PRESENTATION ALIAS (relationship-scoped local presentation, not yet
 * shared) and a LOCAL PEER LABEL (private, never sent to the peer). Neither is
 * identity, verification, authentication, a public username, or a cryptographic
 * identifier. Aliases are memory/null only; text is sensitive relationship
 * metadata. Trust/assurance is never derived from alias text.
 */

import type {
  IdentityLocalRevision,
  IdentityPersonaId,
  LocalIdentityRootId,
  PairwiseRelationshipId,
} from "../identifiers";
import type {
  IdentityAssuranceStateV1,
  LocalIdentityRootKindV1,
  PairwiseRelationshipLifecycleV1,
} from "../identity-types";
import type { ContactAliasId, LocalPeerLabelId } from "./alias-identifiers";
import type { ContactAliasDisplayText, ContactAliasTextV1 } from "./alias-normalization";

// ---------------------------------------------------------------------------
// Security / correlation assessment (local, conservative, non-authoritative)
// ---------------------------------------------------------------------------

export type AliasConfusableAssessmentV1 = "not_evaluated" | "future_unicode_security_gate";

export type AliasCorrelationRiskV1 =
  | "unique_normalized_value_in_current_vault"
  | "reused_normalized_value_in_current_vault"
  | "unknown";

export interface ContactAliasSecurityAssessmentV1 {
  readonly schemaVersion: 1;
  readonly normalized: true;
  readonly dangerousControlsRejected: true;
  readonly confusableAssessment: AliasConfusableAssessmentV1;
  readonly correlationRisk: AliasCorrelationRiskV1;
  readonly impersonationSafe: false;
  readonly verifiedIdentity: false;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export type PairwisePresentationAliasLifecycleV1 =
  "draft_local" | "active_local_unshared" | "retired_tombstone";

export type LocalPeerLabelLifecycleV1 = "active_local_private" | "cleared_tombstone";

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface PairwisePresentationAliasV1 {
  readonly schemaVersion: 1;
  readonly aliasId: ContactAliasId;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly relationshipId: PairwiseRelationshipId;
  readonly rootKind: LocalIdentityRootKindV1;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: PairwisePresentationAliasLifecycleV1;

  readonly displayText: ContactAliasTextV1;
  readonly securityAssessment: ContactAliasSecurityAssessmentV1;

  readonly origin: "user_supplied_local" | "injected_generated_placeholder";
  readonly sharingState: "not_shared_tech_id_05";
  readonly authenticatedBinding: "not_implemented_gate_f";
  readonly remoteUpdateState: "not_implemented_gate_e_f";

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
  readonly persistenceClass: "memory_only" | "null";
}

export interface LocalPeerLabelV1 {
  readonly schemaVersion: 1;
  readonly labelId: LocalPeerLabelId;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly relationshipId: PairwiseRelationshipId;
  readonly rootKind: LocalIdentityRootKindV1;
  readonly revision: IdentityLocalRevision;
  readonly lifecycle: LocalPeerLabelLifecycleV1;

  readonly labelText: ContactAliasTextV1;

  readonly visibility: "local_only";
  readonly peerShared: false;
  readonly authority: "none";
  readonly verificationEvidence: false;

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
  readonly persistenceClass: "memory_only" | "null";
}

/** The separate alias aggregate (memory/null only). Display text is never a key. */
export interface ContactAliasStateV1 {
  readonly schemaVersion: 1;
  readonly presentationAliases: readonly PairwisePresentationAliasV1[];
  readonly localPeerLabels: readonly LocalPeerLabelV1[];
  readonly persistenceClass: "memory_only" | "null";
}

// ---------------------------------------------------------------------------
// A validated relationship reference (resolved from a vault by the caller/pipeline)
// ---------------------------------------------------------------------------

export interface ContactAliasRelationshipRefV1 {
  readonly relationshipId: PairwiseRelationshipId;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly rootKind: LocalIdentityRootKindV1;
  readonly relationshipLifecycle: PairwiseRelationshipLifecycleV1;
  readonly relationshipAssurance: IdentityAssuranceStateV1;
  /** True iff the referenced root + persona are both active (not tombstoned). */
  readonly rootAndPersonaActive: boolean;
}

// ---------------------------------------------------------------------------
// Results / assessments (transient, redacted)
// ---------------------------------------------------------------------------

export interface AliasReuseAssessmentV1 {
  readonly schemaVersion: 1;
  readonly normalizedValueReused: boolean;
  readonly otherRelationshipCountExposed: false;
  readonly relationshipIdsExposed: false;
  readonly reasonCode: string;
}

export interface ContactAliasRotationResultV1 {
  readonly schemaVersion: 1;
  readonly rotated: true;
  readonly relationshipContinuityPreserved: true;
  readonly trustStateChanged: false;
  readonly blockStateChanged: false;
  readonly remoteCopiesAffected: false;
  readonly authenticatedRemoteUpdatePerformed: false;
  readonly redacted: true;
}

export interface ContactDisplayContextV1 {
  readonly schemaVersion: 1;
  readonly relationshipId?: PairwiseRelationshipId;
  readonly selfPresentationAlias?: ContactAliasDisplayText;
  readonly localPeerLabel?: ContactAliasDisplayText;

  readonly relationshipAssurance: IdentityAssuranceStateV1;
  readonly relationshipLifecycle: PairwiseRelationshipLifecycleV1;

  readonly presentationAliasScope: "this_relationship_only";
  readonly localPeerLabelScope: "local_only";

  readonly aliasVerified: false;
  readonly realWorldIdentityVerified: false;
  readonly cryptographicBindingAvailable: false;

  readonly reuseWarning: "none_detected_locally" | "display_value_reused" | "not_evaluated";
  readonly confusableAssessment: "not_evaluated" | "future_unicode_security_gate";
  readonly redacted: boolean;
}
