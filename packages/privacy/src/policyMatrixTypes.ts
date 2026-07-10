/**
 * Policy Matrix v1 taxonomy (TECH-13). Types + constants only.
 *
 * The Policy Matrix is the SINGLE CANONICAL CONTRACT for what each Privacy
 * Mode permits, denies, redacts, null-routes, memory-limits, future-gates, or
 * marks not implemented — the source of truth that tests, docs, and PBOM must
 * agree with (docs/POLICY_MATRIX.md). It is deliberately NOT a policy runtime,
 * DSL, or external engine: a typed table plus simple, boring lookup logic.
 *
 * ABAC in spirit (mode × domain × operation × sink/transport/dataClass ×
 * room/shield/risk), implemented as explicit rows. Undefined behavior is a
 * bug and fails closed.
 */

import type { PrivacyMode } from "./index";

/** Alias kept for spec-compat; the canonical mode type is PrivacyMode. */
export type PolicyMode = PrivacyMode;

export type PolicyDomain =
  | "storage"
  | "network"
  | "metadata"
  | "link_preview"
  | "external_asset"
  | "notification"
  | "ai"
  | "endpoint"
  | "room"
  | "identity"
  | "capsule"
  | "crypto"
  | "unknown";

export const POLICY_DOMAINS: readonly PolicyDomain[] = [
  "storage",
  "network",
  "metadata",
  "link_preview",
  "external_asset",
  "notification",
  "ai",
  "endpoint",
  "room",
  "identity",
  "capsule",
  "crypto",
  "unknown",
];

/** Domains every mode must have explicit rows for (validator-enforced). */
export const MAJOR_POLICY_DOMAINS: readonly PolicyDomain[] = [
  "storage",
  "network",
  "metadata",
  "link_preview",
  "external_asset",
  "notification",
  "ai",
  "endpoint",
];

export type PolicyEffect =
  | "allow"
  | "deny"
  | "redact"
  | "coarsen"
  | "delay"
  | "batch"
  | "memory_only"
  | "null"
  | "require_user_action"
  | "future_gate"
  | "not_implemented";

/**
 * Strictness order, STRICTEST FIRST. `deny` always wins; `not_implemented` and
 * `future_gate` are NOT allow; `require_user_action` is not allow unless the
 * feature exists and the user action is present (neither is true in v1).
 */
export const POLICY_EFFECT_STRICTNESS: readonly PolicyEffect[] = [
  "deny",
  "null",
  "not_implemented",
  "future_gate",
  "memory_only",
  "redact",
  "coarsen",
  "delay",
  "batch",
  "require_user_action",
  "allow",
];

/** Effects that permit the operation to proceed (under their constraint). */
export const ALLOWING_EFFECTS: readonly PolicyEffect[] = [
  "allow",
  "memory_only",
  "redact",
  "coarsen",
  "delay",
  "batch",
];

export type PolicyReasonCode =
  | "default_deny"
  | "strict_mode"
  | "telemetry_forbidden"
  | "external_asset_forbidden"
  | "link_preview_forbidden"
  | "push_forbidden"
  | "persistent_storage_forbidden"
  | "network_forbidden"
  | "metadata_forbidden"
  | "ai_forbidden"
  | "crypto_not_implemented"
  | "encrypted_storage_not_implemented"
  | "screen_shield_strict"
  | "emergency_mode"
  | "offline_capsule_mode"
  | "room_policy_stricter"
  | "unknown_input"
  | "accepted_limitation"
  | "deferred_gate";

export const POLICY_REASON_CODES: readonly PolicyReasonCode[] = [
  "default_deny",
  "strict_mode",
  "telemetry_forbidden",
  "external_asset_forbidden",
  "link_preview_forbidden",
  "push_forbidden",
  "persistent_storage_forbidden",
  "network_forbidden",
  "metadata_forbidden",
  "ai_forbidden",
  "crypto_not_implemented",
  "encrypted_storage_not_implemented",
  "screen_shield_strict",
  "emergency_mode",
  "offline_capsule_mode",
  "room_policy_stricter",
  "unknown_input",
  "accepted_limitation",
  "deferred_gate",
];

export type PolicyTestCoverage = "covered" | "partial" | "not_testable_yet" | "deferred";

/** One fully-expanded matrix row (one mode × one operation). */
export interface PolicyMatrixRule {
  readonly id: string;
  readonly domain: PolicyDomain;
  readonly mode: PrivacyMode;
  readonly subject?: string;
  readonly object?: string;
  readonly operation: string;
  readonly sink?: string;
  readonly transport?: string;
  readonly dataClass?: string;
  readonly effect: PolicyEffect;
  readonly allowed: boolean;
  readonly persistentAllowed: boolean;
  readonly networkAllowed: boolean;
  readonly requiresUserAction: boolean;
  readonly reasonCode: PolicyReasonCode;
  readonly rationale: string;
  readonly testCoverage: PolicyTestCoverage;
  readonly docsRefs: readonly string[];
}

/**
 * Compact authoring form: one spec expands to 7 rules (one per mode).
 * `effect` is the default; `effectOverrides` (and `reasonOverrides`) adjust
 * specific modes. This is also the exact shape mirrored in
 * docs/policy-matrix.v1.json (drift is test-enforced).
 */
export interface PolicyMatrixSpec {
  readonly id: string;
  readonly domain: PolicyDomain;
  readonly operation: string;
  readonly sink?: string;
  readonly transport?: string;
  readonly dataClass?: string;
  readonly effect: PolicyEffect;
  readonly effectOverrides?: Partial<Record<PrivacyMode, PolicyEffect>>;
  readonly reasonCode: PolicyReasonCode;
  readonly reasonOverrides?: Partial<Record<PrivacyMode, PolicyReasonCode>>;
  /** ScreenShield sealed/bunker (and critical device risk) force-deny this row. */
  readonly shieldTightened?: boolean;
  readonly rationale: string;
  readonly testCoverage: PolicyTestCoverage;
  readonly docsRefs: readonly string[];
}

export interface PolicyMatrixEvaluationInput {
  readonly mode: PrivacyMode;
  readonly domain: PolicyDomain;
  readonly operation: string;
  readonly sink?: string;
  readonly transport?: string;
  readonly dataClass?: string;
  readonly roomPolicy?: Partial<PolicyMatrixRule>;
  readonly screenShieldLevel?: "off" | "standard" | "protected" | "sealed" | "bunker";
  readonly deviceRiskLevel?: "low" | "medium" | "high" | "critical" | "unknown";
}

export interface PolicyMatrixDecision {
  readonly ruleId: string;
  readonly domain: PolicyDomain;
  readonly mode: PrivacyMode;
  readonly effect: PolicyEffect;
  readonly allowed: boolean;
  readonly persistentAllowed: boolean;
  readonly networkAllowed: boolean;
  readonly requiresUserAction: boolean;
  readonly reasonCode: PolicyReasonCode;
  readonly rationale: string;
}
