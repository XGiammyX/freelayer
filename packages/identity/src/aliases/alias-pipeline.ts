/**
 * Per-contact alias pipeline (TECH-ID-05). The policy-gated entry point:
 * validate → resolve policy → require an authentic EXACT-SCOPE PolicyDecision →
 * reduce (pure; validates the relationship ref) → persist to a memory/null
 * repository. Denial happens BEFORE mutation; failure produces no partial state.
 * An alias id / text / relationship id / RoomOS role / DevicePosture NEVER
 * authorizes; alias-text collision never grants authority.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  ContactAliasDecisionMismatchError,
  ContactAliasPolicyDeniedError,
  ContactAliasValidationError,
} from "./alias-errors";
import { validateContactAliasCommandV1 } from "./alias-validation";
import {
  contactAliasOperationForCommandV1,
  resolveContactAliasPolicyV1,
  type ContactAliasOperationV1,
} from "./alias-policy";
import { reduceContactAliasCommandV1 } from "./alias-reducer";
import type { ContactAliasGeneratedIdsV1 } from "./alias-identifiers";
import type {
  ContactAliasRepositoryV1,
  ContactAliasRepositoryWriteResultV1,
} from "./alias-repository";
import type { ContactAliasRelationshipRefV1, ContactAliasStateV1 } from "./alias-types";

const SCOPE_FOR_OPERATION: Readonly<Record<ContactAliasOperationV1, PolicySideEffectScope>> = {
  "presentation.create": "identity.alias.presentation.create",
  "presentation.activate": "identity.alias.presentation.lifecycle",
  "presentation.retire": "identity.alias.presentation.lifecycle",
  "presentation.rotate": "identity.alias.presentation.rotate",
  "local_peer_label.set": "identity.alias.local_peer_label.write",
  "local_peer_label.replace": "identity.alias.local_peer_label.write",
  "local_peer_label.clear": "identity.alias.local_peer_label.clear",
  "display_context.read": "identity.alias.display_context.read",
  "reuse_assessment.read": "identity.alias.reuse_assessment.read",
};

export function requiredContactAliasScopeV1(op: ContactAliasOperationV1): PolicySideEffectScope {
  return SCOPE_FOR_OPERATION[op];
}

export interface ApplyContactAliasCommandInputV1 {
  readonly state: ContactAliasStateV1;
  readonly command: unknown;
  readonly mode: PrivacyMode;
  readonly decision: PolicyDecision;
  readonly relationshipRef?: ContactAliasRelationshipRefV1;
  readonly generatedIds: ContactAliasGeneratedIdsV1;
  readonly clockValue: string;
  readonly repository: ContactAliasRepositoryV1;
}

export interface ApplyContactAliasCommandResultV1 {
  readonly state: ContactAliasStateV1;
  readonly write: ContactAliasRepositoryWriteResultV1;
}

export function applyContactAliasCommandV1(
  input: ApplyContactAliasCommandInputV1,
): ApplyContactAliasCommandResultV1 {
  const command = validateContactAliasCommandV1(input.command);
  const operation = contactAliasOperationForCommandV1(command.command);
  if (operation === undefined) throw new ContactAliasValidationError("unmapped_operation");

  const policy = resolveContactAliasPolicyV1({ mode: input.mode, operation });
  if (!policy.allowed) throw new ContactAliasPolicyDeniedError(policy.reasonCode);

  const requiredScope = SCOPE_FOR_OPERATION[operation];
  if (
    !isPolicyDecision(input.decision) ||
    input.decision.verdict !== "allowed" ||
    input.decision.sideEffect !== requiredScope
  ) {
    throw new ContactAliasDecisionMismatchError();
  }

  const next = reduceContactAliasCommandV1({
    state: input.state,
    command,
    ...(input.relationshipRef !== undefined ? { relationshipRef: input.relationshipRef } : {}),
    generatedIds: input.generatedIds,
    clockValue: input.clockValue,
  });

  const write = input.repository.replace(next, input.decision);
  return { state: next, write };
}
