/**
 * Safe ephemeral identity summaries (TECH-ID-04). Content-minimized: never
 * labels, room ids, membership ids, peer data, the process epoch, or future key
 * state. Strict modes suppress ids/deadline/counts. `anonymous` is structurally
 * `false` (an ephemeral identity is not anonymity). A summary read requires its
 * OWN authentic `identity.ephemeral.summary.read` decision.
 */

import { isPolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { EphemeralIdentityDecisionMismatchError } from "./ephemeral-errors";
import type { EphemeralIdentityPolicyV1 } from "./ephemeral-policy";
import type {
  EphemeralIdentityRootV1,
  EphemeralIdentitySummaryV1,
  EphemeralIdentityVaultStateV1,
} from "./ephemeral-types";
import type { LocalIdentityRootId } from "../identifiers";

export function assertEphemeralSummaryDecisionV1(decision: PolicyDecision): void {
  if (
    !isPolicyDecision(decision) ||
    decision.verdict !== "allowed" ||
    decision.sideEffect !== "identity.ephemeral.summary.read"
  ) {
    throw new EphemeralIdentityDecisionMismatchError();
  }
}

export function countEphemeralChildrenV1(
  vault: EphemeralIdentityVaultStateV1,
  rootId: LocalIdentityRootId,
): { personaCount: number; relationshipCount: number; roomBindingCount: number } {
  return {
    personaCount: vault.personas.filter((p) => p.rootId === rootId).length,
    relationshipCount: vault.relationships.filter((r) => r.rootId === rootId).length,
    roomBindingCount: vault.roomBindings.filter((b) => b.rootId === rootId).length,
  };
}

export function buildEphemeralIdentitySummaryV1(input: {
  root: EphemeralIdentityRootV1;
  personaCount: number;
  relationshipCount: number;
  roomBindingCount: number;
  policy: EphemeralIdentityPolicyV1;
}): EphemeralIdentitySummaryV1 {
  const { root, policy } = input;
  const base = {
    schemaVersion: 1 as const,
    lifecycle: root.lifecycle,
    assurance: root.assurance,
    lifetimeMode: root.lifetime.mode,
    currentProcessOnly: true as const,
    recoveryAvailable: false as const,
    persistent: false as const,
    anonymous: false as const,
    forensicErasureGuaranteed: false as const,
  };

  if (!policy.summaryAllowed) {
    return { ...base, redacted: true };
  }
  const full = policy.exactCountsAllowed && policy.timestampsAllowed;
  return {
    ...base,
    rootId: root.rootId,
    ...(policy.timestampsAllowed && root.lifetime.expiresAtLocal !== undefined
      ? { expiresAtLocal: root.lifetime.expiresAtLocal }
      : {}),
    ...(policy.exactCountsAllowed
      ? {
          personaCount: input.personaCount,
          relationshipCount: input.relationshipCount,
          roomBindingCount: input.roomBindingCount,
        }
      : {}),
    redacted: !full,
  };
}
