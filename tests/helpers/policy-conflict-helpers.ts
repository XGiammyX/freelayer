/**
 * Cross-policy assertion helpers (TECH-14). Each helper compares OUTCOMES —
 * the Policy Matrix decision vs a concrete engine decision — and returns
 * PolicyConflict[] (empty = agreement). Tests assert the explained list is
 * empty, so a failure prints exactly which policies disagreed and why.
 *
 * Helpers never fabricate allow behavior: they only read real resolver output.
 */
import {
  evaluatePolicyMatrix,
  explainPolicyConflict,
  type PolicyConflict,
  type PolicyDomain,
  type PolicyMatrixDecision,
  type PrivacyMode,
} from "@freelayer/privacy";

export const ALL_MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

export function explainAll(conflicts: readonly PolicyConflict[]): readonly string[] {
  return conflicts.map(explainPolicyConflict);
}

/** Matrix decision for (domain, operation, mode) — shared lookup. */
export function matrixDecision(
  domain: PolicyDomain,
  operation: string,
  mode: PrivacyMode,
): PolicyMatrixDecision {
  return evaluatePolicyMatrix({ mode, domain, operation });
}

/**
 * Core comparator: the matrix and an engine must agree on allowed-ness for one
 * (domain, operation, mode). `engineAllowed` is the engine's real output.
 */
export function assertPoliciesAgree(input: {
  readonly domain: PolicyDomain;
  readonly operation: string;
  readonly mode: PrivacyMode;
  readonly engineName: string;
  readonly engineAllowed: boolean;
}): readonly PolicyConflict[] {
  const matrix = matrixDecision(input.domain, input.operation, input.mode);
  if (matrix.allowed === input.engineAllowed) {
    return [];
  }
  return [
    {
      category: "allow_vs_deny",
      domain: input.domain,
      mode: input.mode,
      operation: input.operation,
      expected: `matrix:${matrix.effect}`,
      actual: `${input.engineName}:${input.engineAllowed ? "allow" : "deny"}`,
      severity: "critical",
      explanation: `Policy Matrix and ${input.engineName} disagree on this operation.`,
    },
  ];
}

/** The matrix must deny (never allow) this operation in EVERY mode. */
export function assertDeniedEverywhere(
  domain: PolicyDomain,
  operation: string,
): readonly PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];
  for (const mode of ALL_MODES) {
    const decision = matrixDecision(domain, operation, mode);
    if (decision.allowed) {
      conflicts.push({
        category: "allow_vs_deny",
        domain,
        mode,
        operation,
        expected: "deny",
        actual: decision.effect,
        severity: "critical",
        explanation: "Always-forbidden behavior is marked allowed in the matrix.",
      });
    }
  }
  return conflicts;
}

/** Non-executable in EVERY mode: allowed=false regardless of effect label. */
export function assertNotExecutableEverywhere(
  domain: PolicyDomain,
  operation: string,
): readonly PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];
  for (const mode of ALL_MODES) {
    const decision = matrixDecision(domain, operation, mode);
    if (decision.allowed || decision.persistentAllowed || decision.networkAllowed) {
      conflicts.push({
        category:
          decision.effect === "future_gate"
            ? "future_gate_treated_as_allow"
            : decision.effect === "not_implemented"
              ? "not_implemented_treated_as_allow"
              : "allow_vs_deny",
        domain,
        mode,
        operation,
        expected: "not-executable",
        actual: decision.effect,
        severity: "critical",
        explanation: "A gated/not-implemented behavior is treated as executable.",
      });
    }
  }
  return conflicts;
}

/** future_gate effect AND not executable, in every mode. */
export function assertFutureGatedEverywhere(
  domain: PolicyDomain,
  operation: string,
): readonly PolicyConflict[] {
  const conflicts: PolicyConflict[] = [...assertNotExecutableEverywhere(domain, operation)];
  for (const mode of ALL_MODES) {
    const decision = matrixDecision(domain, operation, mode);
    if (decision.effect !== "future_gate" && decision.effect !== "deny") {
      conflicts.push({
        category: "future_gate_treated_as_allow",
        domain,
        mode,
        operation,
        expected: "future_gate",
        actual: decision.effect,
        severity: "high",
        explanation: "A deferred-gate behavior lost its future_gate marking.",
      });
    }
  }
  return conflicts;
}

/**
 * Externalized components (endpoint-defense / anti-spyware) must be hook-only:
 * platform-capability rows stay future-gated, and nothing claims execution.
 */
export function assertExternalizedHookOnly(
  operations: readonly { domain: PolicyDomain; operation: string }[],
): readonly PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];
  for (const { domain, operation } of operations) {
    for (const mode of ALL_MODES) {
      const decision = matrixDecision(domain, operation, mode);
      if (decision.allowed) {
        conflicts.push({
          category: "externalized_component_marked_implemented",
          domain,
          mode,
          operation,
          expected: "hook-only",
          actual: decision.effect,
          severity: "critical",
          explanation:
            "Endpoint-defense implementation is externalized; core must keep hooks only.",
        });
      }
    }
  }
  return conflicts;
}

/** Room policy must never flip a denied matrix decision to allowed. */
export function assertRoomPolicyCannotLoosenDevicePolicy(input: {
  readonly domain: PolicyDomain;
  readonly operation: string;
  readonly mode: PrivacyMode;
}): readonly PolicyConflict[] {
  const base = matrixDecision(input.domain, input.operation, input.mode);
  const loosened = evaluatePolicyMatrix({
    mode: input.mode,
    domain: input.domain,
    operation: input.operation,
    roomPolicy: { allowed: true, effect: "allow" },
  });
  if (!base.allowed && loosened.allowed) {
    return [
      {
        category: "room_policy_loosened_device_policy",
        domain: input.domain,
        mode: input.mode,
        operation: input.operation,
        expected: base.effect,
        actual: loosened.effect,
        severity: "critical",
        explanation: "A permissive room policy loosened the device baseline.",
      },
    ];
  }
  return [];
}

/** Feature-level tightening flags (ScreenShield/device risk) must never loosen. */
export function assertFeaturePolicyCannotLoosenModePolicy(input: {
  readonly domain: PolicyDomain;
  readonly operation: string;
  readonly mode: PrivacyMode;
}): readonly PolicyConflict[] {
  const base = matrixDecision(input.domain, input.operation, input.mode);
  const withFeature = evaluatePolicyMatrix({
    mode: input.mode,
    domain: input.domain,
    operation: input.operation,
    screenShieldLevel: "off",
    deviceRiskLevel: "low",
  });
  if (!base.allowed && withFeature.allowed) {
    return [
      {
        category: "feature_policy_loosened_mode_policy",
        domain: input.domain,
        mode: input.mode,
        operation: input.operation,
        expected: base.effect,
        actual: withFeature.effect,
        severity: "critical",
        explanation: "A feature-level context loosened the mode baseline.",
      },
    ];
  }
  return [];
}

/** Engines must not allow network operations the matrix denies. */
export function assertNoPolicyAllowsNetworkWhenMatrixDenies(
  rows: readonly {
    operation: string;
    mode: PrivacyMode;
    engineName: string;
    engineAllowed: boolean;
  }[],
): readonly PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];
  for (const row of rows) {
    const matrix = matrixDecision("network", row.operation, row.mode);
    if (!matrix.allowed && row.engineAllowed) {
      conflicts.push({
        category: "network_allowed_conflict",
        domain: "network",
        mode: row.mode,
        operation: row.operation,
        expected: "deny",
        actual: `${row.engineName}:allow`,
        severity: "critical",
        explanation: "An engine allows network behavior the matrix denies.",
      });
    }
  }
  return conflicts;
}

/** Engines must not allow persistence the matrix denies (Ghost/Bunker etc.). */
export function assertNoPolicyAllowsPersistenceWhenMatrixDenies(
  rows: readonly {
    operation: string;
    mode: PrivacyMode;
    engineName: string;
    enginePersistent: boolean;
  }[],
): readonly PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];
  for (const row of rows) {
    const matrix = matrixDecision("storage", row.operation, row.mode);
    if (!matrix.persistentAllowed && row.enginePersistent) {
      conflicts.push({
        category: "persistent_allowed_conflict",
        domain: "storage",
        mode: row.mode,
        operation: row.operation,
        expected: "persistent:false",
        actual: `${row.engineName}:persistent`,
        severity: "critical",
        explanation: "An engine allows persistence the matrix denies.",
      });
    }
  }
  return conflicts;
}

/** Engines must not allow metadata the matrix denies. */
export function assertNoPolicyAllowsMetadataWhenMatrixDenies(
  rows: readonly {
    operation: string;
    mode: PrivacyMode;
    engineName: string;
    engineAllowed: boolean;
  }[],
): readonly PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];
  for (const row of rows) {
    const matrix = matrixDecision("metadata", row.operation, row.mode);
    if (!matrix.allowed && row.engineAllowed) {
      conflicts.push({
        category: "metadata_allowed_conflict",
        domain: "metadata",
        mode: row.mode,
        operation: row.operation,
        expected: "deny",
        actual: `${row.engineName}:allow`,
        severity: "critical",
        explanation: "An engine allows metadata the matrix denies.",
      });
    }
  }
  return conflicts;
}
