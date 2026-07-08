/**
 * @freelayer/capsules — CapsuleNet lifecycle interfaces. TYPES ONLY.
 *
 * No parsing, no encryption, no wire format, no real deduplication in
 * Prompt 03 — all blocked by Gates E/F (docs/IMPLEMENTATION_GATES.md).
 *
 * Standing rules these types encode (docs/CAPSULENET.md):
 * - unknown capsules go to quarantine, never best-effort processing;
 * - undecryptable capsules are not auto-processed;
 * - parsing is strict, hostile-input parsing; fuzz tests are required
 *   before any production parser;
 * - capsule IDs are RANDOM in the provisional v1 direction — content-derived
 *   IDs are rejected for v1 because they increase correlation risk across
 *   contexts. Deduplication = random ID + replay cache, deterministic.
 */

import type { PolicyDecision } from "@freelayer/privacy";
import type { CapsuleEnvelopeDraft, CapsuleId } from "@freelayer/protocol";

/** ID strategy marker. v1 direction is "random"; the alternative is documented as rejected. */
export type CapsuleIdStrategy = "random" | "content_derived";

/** The provisional v1 decision (Prompt 03). A future ADR finalizes it with the wire format. */
export const CAPSULE_ID_STRATEGY_V1: CapsuleIdStrategy = "random";

/** A capsule as the rest of the system sees it: an ID plus an opaque sealed envelope. */
export interface Capsule {
  readonly id: CapsuleId;
  readonly envelope: CapsuleEnvelopeDraft;
}

/** Where an inbound capsule ends up after the (future) validate → policy → dispatch pipeline. */
export type CapsuleDispatchResult =
  | "dispatched"
  | "duplicate_ignored"
  | "quarantined_unknown"
  | "quarantined_undecryptable"
  | "rejected_malformed";

/**
 * Unified intake for capsules from any transport. Accepting a capsule is a
 * side effect (it may spool/persist), so it requires a PolicyDecision.
 */
export interface CapsuleInbox {
  accept(capsule: Capsule, decision: PolicyDecision): Promise<CapsuleDispatchResult>;
}

/** Outbound queue awaiting a transport opportunity. Persistence is policy-governed. */
export interface CapsuleSpool {
  enqueue(capsule: Capsule, decision: PolicyDecision): Promise<void>;
  drain(decision: PolicyDecision): Promise<readonly Capsule[]>;
}

/** Holding area for unknown/undecryptable capsules. Never auto-processed. */
export interface CapsuleQuarantine {
  quarantine(
    capsule: Capsule,
    reason: Exclude<CapsuleDispatchResult, "dispatched" | "duplicate_ignored">,
    decision: PolicyDecision,
  ): Promise<void>;
  list(decision: PolicyDecision): Promise<readonly Capsule[]>;
}

/**
 * Replay-cache state placeholder. Real dedup must be deterministic — same
 * input set, same outcome, regardless of arrival order (docs/CAPSULENET.md).
 * Design blocked by the replay/dedup matrix TODO (Gate E).
 */
export interface CapsuleDeduplicationState {
  readonly seenIds: ReadonlySet<CapsuleId>;
}
