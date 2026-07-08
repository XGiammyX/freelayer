/**
 * @freelayer/core — operation pipeline scaffolding (Gate B target).
 *
 * ANTI-BYPASS ARCHITECTURE (docs/ARCHITECTURE.md, non-bypassable rules):
 *
 *   apps → sdk/core → policy check → side-effect modules
 *
 * Apps and features never call storage/transports/crypto/ai directly. Core
 * evaluates policy and issues a PolicyDecision; side-effect modules reject
 * calls that do not carry one. The intended pipeline, in order, no stage
 * skippable:
 *
 *   validate input
 *     → classify operation
 *     → resolve active policies (device mode, room, transport, storage, metadata, AI)
 *     → strictest policy wins
 *     → create PolicyDecision
 *     → execute side effect
 *     → audit result
 *
 * Prompt 03 ships type scaffolding plus a FAIL-CLOSED placeholder pipeline:
 * until the real engine exists (Gate B), every operation is denied. Nothing
 * here claims security — mechanical enforcement of the boundaries is
 * baseline-only (scripts/check-boundaries.mjs).
 */

import {
  resolveStrictestPolicy,
  type PolicyDecision,
  type PolicyEvaluationResult,
  type PolicyProfile,
  type PrivacyMode,
} from "@freelayer/privacy";
import { createAuditEvent, redact, type AuditEvent } from "@freelayer/security";

// Re-exported so apps/sdk can reference policy types without importing
// side-effect packages. The PolicyDecision CONTRACT lives in
// @freelayer/privacy so side-effect modules can verify it without importing
// core (dependencies must point downward — docs/ARCHITECTURE.md layering).
export type {
  PolicyDecision,
  PolicyDecisionId,
  PolicyCapability,
  PolicyEvaluationResult,
  PolicyProfile,
  PolicyVerdict,
  PrivacyMode,
} from "@freelayer/privacy";
export type { AuditEvent } from "@freelayer/security";

/** What a caller asks core to do. Maps 1:1 onto policy capabilities downstream. */
export type OperationKind =
  | "persist"
  | "read_persisted"
  | "notify"
  | "connect"
  | "transmit_capsule"
  | "spool_capsule"
  | "fetch_link_preview"
  | "derive_artifact"
  | "sync_room"
  | "run_local_ai";

/** The side-effect families the pipeline can delegate to. */
export type SideEffectKind =
  | "storage_write"
  | "storage_read"
  | "network_send"
  | "network_receive"
  | "notification"
  | "preview_fetch"
  | "artifact_derivation"
  | "ai_inference";

export interface OperationContext {
  readonly mode: PrivacyMode;
  readonly roomId?: string;
  /** Human-readable, NON-SENSITIVE description for audit purposes. */
  readonly description: string;
}

export interface OperationRequest<TPayload = unknown> {
  readonly kind: OperationKind;
  readonly context: OperationContext;
  readonly payload: TPayload;
}

export interface PipelineOutcome {
  readonly evaluation: PolicyEvaluationResult;
  readonly audit: AuditEvent;
}

/** The pipeline contract. The real implementation is Gate B work. */
export interface CoreOperationPipeline {
  execute(request: OperationRequest): Promise<PipelineOutcome>;
}

/** Thrown when an operation reaches a side effect without a PolicyDecision. */
export class PolicyRequiredError extends Error {
  override readonly name = "PolicyRequiredError";
}

/**
 * Fail-closed placeholder: denies everything, always, and says why. This is
 * deliberate — until the policy engine exists, no operation may claim it was
 * policy-approved. Exercises strictest-wins with zero profiles (all denied).
 */
export function createFailClosedPipeline(): CoreOperationPipeline {
  return {
    execute(request: OperationRequest): Promise<PipelineOutcome> {
      const noProfiles: readonly PolicyProfile[] = [];
      resolveStrictestPolicy(noProfiles); // documents the fail-closed contract
      const evaluation: PolicyEvaluationResult = {
        verdict: "denied",
        reason: "Core operation pipeline is not implemented (Gate B). Failing closed.",
      };
      const audit = createAuditEvent(`core.${request.kind}.denied`, redact("operation-payload"));
      return Promise.resolve({ evaluation, audit });
    },
  };
}

/** Narrow helper so callers can assert an evaluation produced a decision. */
export function requireDecision(evaluation: PolicyEvaluationResult): PolicyDecision {
  if (evaluation.verdict !== "allowed") {
    throw new PolicyRequiredError(
      "Operation was not approved by policy; no PolicyDecision exists.",
    );
  }
  return evaluation.decision;
}
