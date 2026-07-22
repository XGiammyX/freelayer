/**
 * Safe, content-minimized local identity summaries (TECH-ID-03). Summaries never
 * expose key state beyond a generic "not implemented", recovery data, contact
 * identities, room titles, DevicePosture, membership roles, or network
 * identifiers. Strict modes remove ids/labels/counts. Summary reads require
 * their OWN authentic `identity.summary.read` PolicyDecision.
 */

import { isPolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { IdentityDecisionMismatchError } from "./identity-errors";
import type { LocalIdentityPolicyV1 } from "./identity-policy";
import type {
  IdentityPersonaV1,
  LocalIdentityRootV1,
  LocalIdentityVaultStateV1,
} from "./identity-types";
import type { IdentityPersonaId, LocalIdentityRootId } from "./identifiers";
import type {
  IdentityAssuranceStateV1,
  IdentityPersonaLifecycleV1,
  LocalIdentityRootLifecycleV1,
} from "./identity-types";

export interface LocalIdentityRootSummaryV1 {
  readonly schemaVersion: 1;
  readonly rootId?: LocalIdentityRootId;
  readonly lifecycle: LocalIdentityRootLifecycleV1;
  readonly assurance: IdentityAssuranceStateV1;
  readonly personaCount?: number;
  readonly relationshipCount?: number;
  readonly roomBindingCount?: number;
  readonly redacted: boolean;
}

export interface IdentityPersonaSummaryV1 {
  readonly schemaVersion: 1;
  readonly personaId?: IdentityPersonaId;
  readonly rootId?: LocalIdentityRootId;
  readonly lifecycle: IdentityPersonaLifecycleV1;
  readonly localLabel?: string;
  readonly redacted: boolean;
}

/** Require an authentic, allowed, exactly `identity.summary.read`-scoped decision. */
export function assertIdentitySummaryDecisionV1(decision: PolicyDecision): void {
  if (
    !isPolicyDecision(decision) ||
    decision.verdict !== "allowed" ||
    decision.sideEffect !== "identity.summary.read"
  ) {
    throw new IdentityDecisionMismatchError();
  }
}

export function buildLocalIdentityRootSummaryV1(input: {
  root: LocalIdentityRootV1;
  personaCount: number;
  relationshipCount: number;
  roomBindingCount: number;
  policy: LocalIdentityPolicyV1;
}): LocalIdentityRootSummaryV1 {
  const { root, policy } = input;
  const full = policy.summaryAllowed && policy.exactCountsAllowed && policy.localLabelsAllowed;

  // Minimum disclosure: lifecycle + assurance only.
  if (!policy.summaryAllowed) {
    return {
      schemaVersion: 1,
      lifecycle: root.lifecycle,
      assurance: root.assurance,
      redacted: true,
    };
  }
  return {
    schemaVersion: 1,
    rootId: root.rootId,
    lifecycle: root.lifecycle,
    assurance: root.assurance,
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

export function buildIdentityPersonaSummaryV1(input: {
  persona: IdentityPersonaV1;
  policy: LocalIdentityPolicyV1;
}): IdentityPersonaSummaryV1 {
  const { persona, policy } = input;
  if (!policy.summaryAllowed) {
    return { schemaVersion: 1, lifecycle: persona.lifecycle, redacted: true };
  }
  const includeLabel = policy.localLabelsAllowed && persona.localLabel !== undefined;
  return {
    schemaVersion: 1,
    personaId: persona.personaId,
    rootId: persona.rootId,
    lifecycle: persona.lifecycle,
    ...(includeLabel ? { localLabel: persona.localLabel } : {}),
    redacted: !(policy.localLabelsAllowed && policy.summaryAllowed),
  };
}

/** Count a vault's children for a root (used to build a root summary). */
export function countRootChildrenV1(
  vault: LocalIdentityVaultStateV1,
  rootId: LocalIdentityRootId,
): { personaCount: number; relationshipCount: number; roomBindingCount: number } {
  return {
    personaCount: vault.personas.filter((p) => p.rootId === rootId).length,
    relationshipCount: vault.relationships.filter((r) => r.rootId === rootId).length,
    roomBindingCount: vault.roomBindings.filter((b) => b.rootId === rootId).length,
  };
}
