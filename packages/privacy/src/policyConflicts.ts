/**
 * Policy conflict taxonomy (TECH-14). Types + a pure explainer — no behavior.
 *
 * With seven policy layers plus the Policy Matrix, the dangerous failure mode
 * is two layers DISAGREEING. Conflicts are first-class test data: each
 * contradiction class has a category, and every detected conflict produces a
 * stable, redacted, human-readable explanation
 * (docs/audits/TECH_14_POLICY_CONFLICT_THREAT_MODEL.md).
 *
 * Principle: policy contradictions are privacy bugs. Deny wins. Unknown
 * denies. Future-gated is not executable. Not-implemented is not executable.
 * Externalized means hook-only.
 */

import type { PrivacyMode } from "./index";
import type { PolicyDomain } from "./policyMatrixTypes";

export type PolicyConflictCategory =
  | "allow_vs_deny"
  | "persistent_allowed_conflict"
  | "network_allowed_conflict"
  | "metadata_allowed_conflict"
  | "redaction_conflict"
  | "future_gate_treated_as_allow"
  | "not_implemented_treated_as_allow"
  | "user_action_required_without_user_action"
  | "room_policy_loosened_device_policy"
  | "feature_policy_loosened_mode_policy"
  | "unknown_input_allowed"
  | "docs_code_mismatch"
  | "pbom_code_mismatch"
  | "trust_center_test_mismatch"
  | "externalized_component_marked_implemented"
  | "guardrail_allowlist_hides_violation"
  | "unknown";

export const POLICY_CONFLICT_CATEGORIES: readonly PolicyConflictCategory[] = [
  "allow_vs_deny",
  "persistent_allowed_conflict",
  "network_allowed_conflict",
  "metadata_allowed_conflict",
  "redaction_conflict",
  "future_gate_treated_as_allow",
  "not_implemented_treated_as_allow",
  "user_action_required_without_user_action",
  "room_policy_loosened_device_policy",
  "feature_policy_loosened_mode_policy",
  "unknown_input_allowed",
  "docs_code_mismatch",
  "pbom_code_mismatch",
  "trust_center_test_mismatch",
  "externalized_component_marked_implemented",
  "guardrail_allowlist_hides_violation",
  "unknown",
];

export type PolicyConflictSeverity = "low" | "medium" | "high" | "critical";

export interface PolicyConflict {
  readonly category: PolicyConflictCategory;
  readonly domain: PolicyDomain;
  readonly mode?: PrivacyMode;
  readonly operation?: string;
  /** What the stricter/canonical layer requires (short, non-sensitive). */
  readonly expected: string;
  /** What the disagreeing layer actually decided (short, non-sensitive). */
  readonly actual: string;
  readonly severity: PolicyConflictSeverity;
  readonly explanation: string;
}

/** Short slugs safe for stable output: strips anything not slug-shaped. */
function safeToken(value: string | undefined, fallback: string): string {
  if (value === undefined || value === "") {
    return fallback;
  }
  const cleaned = value.replace(/[^a-zA-Z0-9_.:/-]/g, "");
  const capped = cleaned.length > 64 ? cleaned.slice(0, 64) : cleaned;
  return capped === "" ? fallback : capped;
}

/**
 * Render a conflict as one stable, redacted line. Deterministic (no
 * timestamps), so tests can snapshot it. Never includes payloads, endpoints,
 * or room/contact/message names — callers must pass short policy slugs only;
 * hostile input is stripped to slug characters as defense-in-depth.
 */
export function explainPolicyConflict(conflict: PolicyConflict): string {
  const where = [
    `domain=${safeToken(conflict.domain, "unknown")}`,
    conflict.mode !== undefined ? `mode=${safeToken(conflict.mode, "unknown")}` : undefined,
    conflict.operation !== undefined
      ? `operation=${safeToken(conflict.operation, "unknown")}`
      : undefined,
  ]
    .filter((part): part is string => part !== undefined)
    .join(" ");
  return (
    `[${conflict.severity.toUpperCase()}] ${conflict.category} @ ${where} — ` +
    `expected ${safeToken(conflict.expected, "n/a")}, got ${safeToken(conflict.actual, "n/a")}. ` +
    conflict.explanation
  );
}
