/**
 * Protected-content requirement contract (TECH-22). Secure Device / ScreenShield
 * is a SEPARATE project and is NOT integrated. Any future-required protection
 * therefore DENIES protected-content display — core never silently downgrades
 * and never claims active capture protection.
 */

export type ProtectedContentRequirementV1 =
  | "none"
  | "policy_redaction_only"
  | "secure_device_future_required"
  | "screen_shield_future_required"
  | "managed_bunker_future_required";

export const PROTECTED_CONTENT_REQUIREMENTS: readonly ProtectedContentRequirementV1[] = [
  "none",
  "policy_redaction_only",
  "secure_device_future_required",
  "screen_shield_future_required",
  "managed_bunker_future_required",
];

export interface ProtectedPresentationStatusV1 {
  readonly integration: "not_integrated" | "future_gate";
  readonly requirementSatisfied: boolean;
  readonly activeProtectionClaim: false;
  readonly reasonCode: string;
}

const FUTURE_REQUIRED: ReadonlySet<ProtectedContentRequirementV1> = new Set([
  "secure_device_future_required",
  "screen_shield_future_required",
  "managed_bunker_future_required",
]);

/**
 * Resolve whether a protected-content requirement is satisfiable NOW. `none` and
 * `policy_redaction_only` are satisfiable by core policy composition; every
 * future-required value is UNSATISFIED (integration absent) and denies display.
 */
export function resolveProtectedPresentationStatusV1(
  requirement: ProtectedContentRequirementV1,
): ProtectedPresentationStatusV1 {
  if (!PROTECTED_CONTENT_REQUIREMENTS.includes(requirement)) {
    return {
      integration: "not_integrated",
      requirementSatisfied: false,
      activeProtectionClaim: false,
      reasonCode: "unknown_requirement",
    };
  }
  if (requirement === "none") {
    return {
      integration: "not_integrated",
      requirementSatisfied: true,
      activeProtectionClaim: false,
      reasonCode: "no_protected_content_requirement",
    };
  }
  if (requirement === "policy_redaction_only") {
    return {
      integration: "not_integrated",
      requirementSatisfied: true,
      activeProtectionClaim: false,
      reasonCode: "policy_redaction_only",
    };
  }
  // future_required → denied until Secure Device / ScreenShield is integrated.
  return {
    integration: "future_gate",
    requirementSatisfied: false,
    activeProtectionClaim: false,
    reasonCode: FUTURE_REQUIRED.has(requirement)
      ? "protected_presentation_not_integrated"
      : "unknown_requirement",
  };
}
