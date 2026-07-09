/**
 * @freelayer/privacy — Privacy Modes engine (type-level schema, Prompt 03).
 *
 * This package hosts the `PolicyDecision` contract. Side-effect modules
 * (storage, transports, ai) import it type-only and reject calls that do not
 * carry a valid decision — docs/ARCHITECTURE.md, non-bypassable rules 6/13,
 * ADR-0002. Core re-exports these types for apps and the SDK.
 *
 * TODO (Gate B — docs/IMPLEMENTATION_GATES.md):
 * - first full policy schema (versioned)
 * - first 20 privacy-regression invariants (see docs/METADATA_MODEL.md)
 * - mode-to-side-effect matrix (docs/PRIVACY_MODEL.md)
 */

import type { Brand } from "@freelayer/security";

/** The seven privacy modes, enforced by core policy — docs/PRIVACY_MODEL.md. */
export type PrivacyMode =
  "standard" | "private" | "ghost" | "bunker" | "offline_capsule" | "emergency" | "sovereign_room";

/** Capabilities a policy governs. Every side effect maps to one of these. */
export const POLICY_CAPABILITIES = [
  "persistence",
  "network",
  "directTransport",
  "externalAssets",
  "linkPreviews",
  "readReceipts",
  "typingIndicators",
  "presence",
  "notifications",
  "localAI",
  "mediaCache",
  "roomSync",
  "capsuleSpool",
] as const;

export type PolicyCapability = (typeof POLICY_CAPABILITIES)[number];

export type PolicyVerdict = "allowed" | "denied";

/** One policy source's verdict per capability (device mode, room, transport…). */
export type PolicyProfile = Readonly<Record<PolicyCapability, PolicyVerdict>>;

/**
 * Strictest-policy-wins conflict resolution (docs/PRIVACY_MODEL.md, locked by
 * ADR-0002): a capability is allowed only if EVERY contributing profile allows
 * it. With no profiles at all, everything is denied — the engine fails closed.
 */
export function resolveStrictestPolicy(profiles: readonly PolicyProfile[]): PolicyProfile {
  const entries = POLICY_CAPABILITIES.map((capability) => {
    const allowed = profiles.length > 0 && profiles.every((p) => p[capability] === "allowed");
    return [capability, allowed ? "allowed" : "denied"] as const;
  });
  return Object.fromEntries(entries) as Record<PolicyCapability, PolicyVerdict>;
}

export type PolicyDecisionId = Brand<string, "PolicyDecisionId">;

/**
 * The specific side effect a decision authorizes. A decision issued for one
 * operation must not authorize another — side-effect modules compare this
 * against the concrete request (e.g. the storage write barrier requires an
 * exact match). "generic" exists for scaffolding/tests that predate scoped
 * decisions; strict barriers (storage) do NOT accept it.
 */
export type PolicySideEffectScope =
  | "storage.write"
  | "storage.read"
  | "storage.delete"
  | "storage.list"
  | "storage.clear"
  | "storage.export"
  | "storage.import"
  | "storage.cache.write"
  | "storage.cache.read"
  | "storage.audit.write"
  | "network.send"
  | "network.receive"
  // Network operation scopes (TECH-08). A decision issued for one network
  // operation must not authorize another; the network barrier requires an
  // exact match and never accepts "generic".
  | "network.connect"
  | "network.request"
  | "network.listen"
  | "transport.send"
  | "transport.receive"
  | "transport.poll"
  | "transport.sync"
  | "transport.discovery"
  | "link.preview"
  | "asset.fetch"
  | "telemetry.send"
  | "update.check"
  | "ai.remote_request"
  | "ai.infer"
  | "generic";

/**
 * Runtime marker for PolicyDecision objects. Honest scope: `Symbol.for` is
 * forgeable by code in the same process — this guard catches *accidental*
 * bypass (a feature calling a side-effect module directly), not a hostile
 * in-process actor, which is outside the threat model. Compile-time
 * enforcement is a Gate A/B TODO (docs/ARCHITECTURE.md).
 */
export const POLICY_DECISION_MARK: unique symbol = Symbol.for("freelayer.policy-decision");

/** Proof that core evaluated policy for one capability. Required by all side-effect modules. */
export interface PolicyDecision {
  readonly [POLICY_DECISION_MARK]: true;
  readonly id: PolicyDecisionId;
  readonly capability: PolicyCapability;
  /** The concrete operation this decision authorizes (exact-match in strict barriers). */
  readonly sideEffect: PolicySideEffectScope;
  readonly verdict: PolicyVerdict;
  readonly mode: PrivacyMode;
  /** Logical sequence number — ordering hint, not trusted time. */
  readonly issuedAtLogical: number;
}

export type PolicyEvaluationResult =
  | { readonly verdict: "allowed"; readonly decision: PolicyDecision }
  | { readonly verdict: "denied"; readonly reason: string };

let decisionSeq = 0;

/**
 * Issue a PolicyDecision. Intended caller: the core operation pipeline ONLY.
 * Direct use by features is a policy bypass — rejected in review
 * (docs/SECURITY_REVIEW_CHECKLIST.md) until enforced mechanically.
 */
export function issuePolicyDecision(
  capability: PolicyCapability,
  verdict: PolicyVerdict,
  mode: PrivacyMode,
  sideEffect: PolicySideEffectScope = "generic",
): PolicyDecision {
  decisionSeq += 1;
  return {
    [POLICY_DECISION_MARK]: true,
    id: `pd-${decisionSeq}` as PolicyDecisionId,
    capability,
    sideEffect,
    verdict,
    mode,
    issuedAtLogical: decisionSeq,
  };
}

/** Runtime shape check used by side-effect modules before acting. */
export function isPolicyDecision(value: unknown): value is PolicyDecision {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<PolicyDecision>;
  return (
    candidate[POLICY_DECISION_MARK] === true &&
    typeof candidate.id === "string" &&
    typeof candidate.capability === "string" &&
    (candidate.verdict === "allowed" || candidate.verdict === "denied")
  );
}
