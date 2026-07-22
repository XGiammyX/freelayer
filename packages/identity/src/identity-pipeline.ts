/**
 * Local identity command pipeline (TECH-ID-03). The single policy-gated entry
 * point: validate → resolve policy → require an authentic EXACT-SCOPE
 * PolicyDecision for the operation → reduce (pure) → persist via a memory/null
 * repository. Denial happens BEFORE any state mutation; a failure produces no
 * partial state. An id / label / RoomMemberRef / DevicePosture NEVER authorizes.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
} from "@freelayer/privacy";
import type { PrivacyMode } from "@freelayer/privacy";
import {
  IdentityDecisionMismatchError,
  IdentityPolicyDeniedError,
  IdentityValidationError,
} from "./identity-errors";
import type { LocalIdentityGeneratedIdsV1 } from "./identifiers";
import { validateLocalIdentityCommandV1 } from "./identity-validation";
import {
  identityOperationForCommandV1,
  resolveLocalIdentityPolicyV1,
  type IdentityOperationV1,
} from "./identity-policy";
import { reduceLocalIdentityCommandV1 } from "./identity-reducer";
import type {
  LocalIdentityRepositoryV1,
  LocalIdentityRepositoryWriteResultV1,
} from "./identity-repository";
import type { LocalIdentityVaultStateV1 } from "./identity-types";

/** The exact PolicyDecision scope required per identity operation. */
const SCOPE_FOR_OPERATION: Readonly<Record<IdentityOperationV1, PolicySideEffectScope>> = {
  "root.create": "identity.root.create",
  "root.activate": "identity.root.lifecycle",
  "root.lock": "identity.root.lifecycle",
  "root.mark_compromised": "identity.root.lifecycle",
  "root.tombstone": "identity.root.lifecycle",
  "persona.create": "identity.persona.create",
  "persona.archive": "identity.persona.lifecycle",
  "persona.tombstone": "identity.persona.lifecycle",
  "relationship.create_placeholder": "identity.relationship.create",
  "relationship.block": "identity.relationship.lifecycle",
  "relationship.mark_compromised": "identity.relationship.lifecycle",
  "relationship.tombstone": "identity.relationship.lifecycle",
  "room_binding.create_placeholder": "identity.room_binding.create",
  "room_binding.suspend": "identity.room_binding.lifecycle",
  "room_binding.tombstone": "identity.room_binding.lifecycle",
  "identity.summary.read": "identity.summary.read",
};

/** The exact scope a given operation requires. */
export function requiredIdentityScopeForOperationV1(
  operation: IdentityOperationV1,
): PolicySideEffectScope {
  return SCOPE_FOR_OPERATION[operation];
}

export interface ApplyLocalIdentityCommandInputV1 {
  readonly state: LocalIdentityVaultStateV1;
  readonly command: unknown;
  readonly mode: PrivacyMode;
  readonly decision: PolicyDecision;
  readonly generatedIds: LocalIdentityGeneratedIdsV1;
  readonly clockValue: string;
  readonly repository: LocalIdentityRepositoryV1;
}

export interface ApplyLocalIdentityCommandResultV1 {
  readonly state: LocalIdentityVaultStateV1;
  readonly write: LocalIdentityRepositoryWriteResultV1;
}

export function applyLocalIdentityCommandV1(
  input: ApplyLocalIdentityCommandInputV1,
): ApplyLocalIdentityCommandResultV1 {
  // (1) Validate the command shape (fail-closed; rejects dangerous/authority fields).
  const command = validateLocalIdentityCommandV1(input.command);

  const operation = identityOperationForCommandV1(command.command);
  if (operation === undefined) throw new IdentityValidationError("unmapped_operation");

  // (2) Resolve policy; deny before any mutation.
  const policy = resolveLocalIdentityPolicyV1({ mode: input.mode, operation });
  if (!policy.allowed) throw new IdentityPolicyDeniedError(policy.reasonCode);

  // (3) Require an authentic, exact-scope, allowed PolicyDecision.
  const requiredScope = SCOPE_FOR_OPERATION[operation];
  if (
    !isPolicyDecision(input.decision) ||
    input.decision.verdict !== "allowed" ||
    input.decision.sideEffect !== requiredScope
  ) {
    throw new IdentityDecisionMismatchError();
  }

  // (4) Reduce (pure) — a failure throws before persistence (no partial state).
  const next = reduceLocalIdentityCommandV1({
    state: input.state,
    command,
    generatedIds: input.generatedIds,
    clockValue: input.clockValue,
  });

  // (5) Persist via the memory/null repository (also authenticates the decision).
  const write = input.repository.replaceVault(next, input.decision);
  return { state: next, write };
}
