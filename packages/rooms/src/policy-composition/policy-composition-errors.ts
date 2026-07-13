/**
 * RoomOS policy-composition + governance error taxonomy (TECH-22). Redacted:
 * codes + STATIC messages only — never a room title, member ref, object
 * content, posture device detail, provider data, or the leak sentinel. Failure
 * is safe (no partial side effect).
 */

export type RoomPolicyCompositionErrorCode =
  | "unknown_policy_layer"
  | "unknown_effect"
  | "unknown_policy_input"
  | "invalid_field"
  | "unexpected_field"
  | "dangerous_key"
  | "unsupported_schema_version"
  | "unknown_command"
  | "governance_loosen_attempt"
  | "governance_not_stricter"
  | "policy_incomparable"
  | "governance_denied"
  | "posture_requirement_unmet"
  | "protected_presentation_unavailable"
  | "policy_revision_mismatch"
  | "decision_missing"
  | "decision_mismatch"
  | "room_mismatch"
  | "last_owner_continuity"
  | "clone_failed";

export const SAFE_GOVERNANCE_DENIAL = "Room governance operation was denied by the active policy.";

export class RoomPolicyCompositionError extends Error {
  readonly code: RoomPolicyCompositionErrorCode;
  constructor(code: RoomPolicyCompositionErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "RoomPolicyCompositionError";
    this.code = code;
  }
}

export class RoomGovernanceDeniedError extends RoomPolicyCompositionError {
  constructor(detail?: string) {
    super("governance_denied", detail);
    this.name = "RoomGovernanceDeniedError";
  }
}
export class RoomGovernanceLoosenError extends RoomPolicyCompositionError {
  constructor(detail?: string) {
    super("governance_loosen_attempt", detail);
    this.name = "RoomGovernanceLoosenError";
  }
}
/** Governance policy-revision mismatch (distinct name from the TECH-21 auth one). */
export class RoomGovernancePolicyRevisionMismatchError extends RoomPolicyCompositionError {
  constructor(detail?: string) {
    super("policy_revision_mismatch", detail);
    this.name = "RoomGovernancePolicyRevisionMismatchError";
  }
}

export function compositionFail(code: RoomPolicyCompositionErrorCode, detail?: string): never {
  throw new RoomPolicyCompositionError(code, detail);
}
