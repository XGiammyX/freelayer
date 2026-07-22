/**
 * Ephemeral identity pipeline (TECH-ID-04). The policy-gated entry point:
 * validate → resolve policy → require an authentic EXACT-SCOPE PolicyDecision →
 * assert current-process/expiry immediately before protected operations → reduce
 * → persist to a current-process-memory/null repository. Denial happens BEFORE
 * mutation; failure produces no partial state. An id/persona/RoomOS-role/
 * DevicePosture NEVER authorizes; an expired identity cannot act on an old decision.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import type { LocalIdentityGeneratedIdsV1 } from "../identifiers";
import {
  EphemeralIdentityDecisionMismatchError,
  EphemeralIdentityPolicyDeniedError,
  EphemeralIdentityValidationError,
} from "./ephemeral-errors";
import type { IdentityProcessEpochId } from "./ephemeral-clock";
import { validateEphemeralIdentityCommandV1 } from "./ephemeral-validation";
import {
  ephemeralOperationForCommandV1,
  resolveEphemeralIdentityPolicyV1,
  type EphemeralIdentityOperationV1,
} from "./ephemeral-policy";
import {
  assertEphemeralIdentityCurrentV1,
  evaluateEphemeralIdentityExpirationV1,
} from "./ephemeral-expiration";
import { reduceEphemeralIdentityCommandV1 } from "./ephemeral-reducer";
import type {
  EphemeralIdentityRepositoryV1,
  EphemeralIdentityRepositoryWriteResultV1,
} from "./ephemeral-repository";
import type { EphemeralIdentityVaultStateV1 } from "./ephemeral-types";

const SCOPE_FOR_OPERATION: Readonly<Record<EphemeralIdentityOperationV1, PolicySideEffectScope>> = {
  create: "identity.ephemeral.create",
  activate: "identity.ephemeral.lifecycle",
  shorten_lifetime: "identity.ephemeral.lifecycle",
  mark_compromised: "identity.ephemeral.lifecycle",
  expire: "identity.ephemeral.lifecycle",
  destroy: "identity.ephemeral.destroy",
  "persona.create": "identity.ephemeral.persona.create",
  "relationship.create_placeholder": "identity.ephemeral.relationship.create",
  "relationship.block": "identity.ephemeral.relationship.block",
  "room_binding.create_placeholder": "identity.ephemeral.room_binding.create",
  "summary.read": "identity.ephemeral.summary.read",
};

/** Operations that require the referenced root to be ACTIVE + current (not expired). */
const REQUIRE_CURRENT_ROOT: ReadonlySet<EphemeralIdentityOperationV1> = new Set([
  "shorten_lifetime",
  "persona.create",
  "relationship.create_placeholder",
  "room_binding.create_placeholder",
]);

export interface ApplyEphemeralIdentityCommandInputV1 {
  readonly state: EphemeralIdentityVaultStateV1;
  readonly command: unknown;
  readonly mode: PrivacyMode;
  readonly decision: PolicyDecision;
  readonly generatedIds: LocalIdentityGeneratedIdsV1;
  readonly clockValue: string;
  readonly processEpochId: IdentityProcessEpochId;
  readonly repository: EphemeralIdentityRepositoryV1;
}

export interface ApplyEphemeralIdentityCommandResultV1 {
  readonly state: EphemeralIdentityVaultStateV1;
  readonly write: EphemeralIdentityRepositoryWriteResultV1;
}

export function applyEphemeralIdentityCommandV1(
  input: ApplyEphemeralIdentityCommandInputV1,
): ApplyEphemeralIdentityCommandResultV1 {
  const command = validateEphemeralIdentityCommandV1(input.command);
  const operation = ephemeralOperationForCommandV1(command.command);
  if (operation === undefined) throw new EphemeralIdentityValidationError("unmapped_operation");

  const policy = resolveEphemeralIdentityPolicyV1({ mode: input.mode, operation });
  if (!policy.allowed) throw new EphemeralIdentityPolicyDeniedError(policy.reasonCode);

  const requiredScope = SCOPE_FOR_OPERATION[operation];
  if (
    !isPolicyDecision(input.decision) ||
    input.decision.verdict !== "allowed" ||
    input.decision.sideEffect !== requiredScope
  ) {
    throw new EphemeralIdentityDecisionMismatchError();
  }

  // Expiry gate BEFORE mutation (creation-time validation is never sufficient).
  if ("rootId" in command && command.rootId !== undefined) {
    const root = input.state.roots.find((r) => r.rootId === command.rootId);
    if (REQUIRE_CURRENT_ROOT.has(operation)) {
      if (root === undefined) throw new EphemeralIdentityValidationError("root_not_found");
      assertEphemeralIdentityCurrentV1({
        root,
        currentProcessEpochId: input.processEpochId,
        nowLocal: input.clockValue,
      });
    } else if (operation === "activate" && root !== undefined) {
      // Activate a draft root only if its epoch/clock/deadline are still valid.
      const status = evaluateEphemeralIdentityExpirationV1({
        root,
        currentProcessEpochId: input.processEpochId,
        nowLocal: input.clockValue,
      });
      if (status !== "current") throw new EphemeralIdentityValidationError("not_activatable");
    }
  }

  const next = reduceEphemeralIdentityCommandV1({
    state: input.state,
    command,
    generatedIds: input.generatedIds,
    clockValue: input.clockValue,
    processEpochId: input.processEpochId,
    maximumLifetimeMs: policy.maximumLifetimeMs,
    maximumActiveRoots: policy.maximumActiveRoots,
  });

  const write = input.repository.replaceCurrent(next, input.decision);
  return { state: next, write };
}
