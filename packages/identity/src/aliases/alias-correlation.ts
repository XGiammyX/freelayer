/**
 * Local alias reuse assessment (TECH-ID-05). A PRIVACY WARNING only: reusing the
 * same normalized presentation-alias value across relationships is a correlation
 * risk the local user should know about. It NEVER denies, NEVER merges
 * relationships, NEVER returns the other relationship ids or an exact count, and
 * emits NO telemetry/logging. A unique value is NOT proof of unlinkability; a
 * reused value is NOT proof that identities are linked. Cross-root (long-lived ↔
 * ephemeral) reuse produces the same warning WITHOUT revealing the root mapping.
 */

import type { AliasReuseAssessmentV1, ContactAliasStateV1 } from "./alias-types";
import type { ContactAliasDisplayText } from "./alias-normalization";
import type { PairwiseRelationshipId } from "../identifiers";

/**
 * Assess whether a normalized alias value is already used by an ACTIVE
 * presentation alias in another relationship. Pure; returns no ids/counts.
 */
export function assessContactAliasReuseV1(input: {
  state: ContactAliasStateV1;
  normalizedValue: ContactAliasDisplayText;
  /** The relationship the value is being assigned to (excluded from the scan). */
  forRelationshipId: PairwiseRelationshipId;
}): AliasReuseAssessmentV1 {
  const reused = input.state.presentationAliases.some(
    (a) =>
      a.lifecycle === "active_local_unshared" &&
      a.relationshipId !== input.forRelationshipId &&
      a.displayText.normalizedValue === input.normalizedValue,
  );
  return {
    schemaVersion: 1,
    normalizedValueReused: reused,
    otherRelationshipCountExposed: false,
    relationshipIdsExposed: false,
    reasonCode: reused ? "display_value_reused" : "unique_normalized_value_in_current_vault",
  };
}
