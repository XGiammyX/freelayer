/**
 * Safe alias display context + redacted audit (TECH-ID-05). The display context
 * returns trust/assurance SEPARATELY from alias text, never a generic "verified
 * contact" flag, and never a local peer label to any peer/room/Capsule surface.
 * Strict modes omit the relationship id + labels. A read requires its OWN
 * `identity.alias.display_context.read` decision. Security-sensitive callers must
 * never render an alias as the SOLE identity signal in verification/recovery/
 * device-linking/export/destructive confirmations.
 */

import { isPolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import { ContactAliasDecisionMismatchError } from "./alias-errors";
import type { ContactAliasPolicyV1 } from "./alias-policy";
import type {
  ContactAliasRelationshipRefV1,
  ContactAliasStateV1,
  ContactDisplayContextV1,
} from "./alias-types";

export type ContactAliasAuditCategoryV1 =
  "presentation_alias_lifecycle" | "local_peer_label_lifecycle" | "alias_display_context";

export interface ContactAliasAuditEventV1 {
  readonly schemaVersion: 1;
  readonly operationCategory: ContactAliasAuditCategoryV1;
  readonly outcome: "allowed" | "denied";
  readonly mode: PrivacyMode;
  readonly reasonCode: string;
  readonly redacted: true;
}

export function buildContactAliasAuditEventV1(input: {
  operationCategory: ContactAliasAuditCategoryV1;
  outcome: "allowed" | "denied";
  mode: PrivacyMode;
  reasonCode: string;
}): ContactAliasAuditEventV1 {
  return { schemaVersion: 1, ...input, redacted: true };
}

export function assertContactAliasDisplayDecisionV1(decision: PolicyDecision): void {
  if (
    !isPolicyDecision(decision) ||
    decision.verdict !== "allowed" ||
    decision.sideEffect !== "identity.alias.display_context.read"
  ) {
    throw new ContactAliasDecisionMismatchError();
  }
}

export function buildContactDisplayContextV1(input: {
  ref: ContactAliasRelationshipRefV1;
  state: ContactAliasStateV1;
  policy: ContactAliasPolicyV1;
}): ContactDisplayContextV1 {
  const { ref, state, policy } = input;
  const alias = state.presentationAliases.find(
    (a) => a.relationshipId === ref.relationshipId && a.lifecycle === "active_local_unshared",
  );
  const label = state.localPeerLabels.find(
    (l) => l.relationshipId === ref.relationshipId && l.lifecycle === "active_local_private",
  );

  const reuseWarning: ContactDisplayContextV1["reuseWarning"] = !policy.aliasReuseAssessmentAllowed
    ? "not_evaluated"
    : alias?.securityAssessment.correlationRisk === "reused_normalized_value_in_current_vault"
      ? "display_value_reused"
      : "none_detected_locally";

  // Strict / minimizing modes redact ids and labels.
  const full = policy.exactAliasTimestampsAllowed && policy.localPeerLabelAllowed;
  const redacted = !full;

  return {
    schemaVersion: 1,
    ...(redacted ? {} : { relationshipId: ref.relationshipId }),
    ...(alias !== undefined ? { selfPresentationAlias: alias.displayText.normalizedValue } : {}),
    ...(!redacted && policy.localPeerLabelAllowed && label !== undefined
      ? { localPeerLabel: label.labelText.normalizedValue }
      : {}),
    relationshipAssurance: ref.relationshipAssurance,
    relationshipLifecycle: ref.relationshipLifecycle,
    presentationAliasScope: "this_relationship_only",
    localPeerLabelScope: "local_only",
    aliasVerified: false,
    realWorldIdentityVerified: false,
    cryptographicBindingAvailable: false,
    reuseWarning,
    confusableAssessment: "not_evaluated",
    redacted,
  };
}
