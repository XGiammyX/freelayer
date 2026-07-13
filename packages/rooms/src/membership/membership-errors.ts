/**
 * RoomOS membership + capability error taxonomy (TECH-20). Every error is
 * REDACTED: a stable machine code and a STATIC message only — never a member
 * ref, membership ID, role target, room title, membership count, capability
 * descriptor, or the leak sentinel. Rejected commands/descriptors are never
 * stringified.
 */

export type RoomMembershipErrorCode =
  | "unsupported_schema_version"
  | "unknown_command"
  | "unknown_role"
  | "unknown_state"
  | "unknown_capability"
  | "invalid_field"
  | "unexpected_field"
  | "dangerous_key"
  | "caller_authority_field"
  | "invalid_membership_id"
  | "invalid_member_ref"
  | "invalid_revision"
  | "room_mismatch"
  | "membership_not_found"
  | "duplicate_active_membership"
  | "stale_revision"
  | "future_revision"
  | "missing_expected_revision"
  | "revision_overflow"
  | "invalid_lifecycle_transition"
  | "membership_terminal"
  | "last_owner_continuity"
  | "decision_missing"
  | "decision_mismatch"
  | "policy_denied"
  | "persistent_membership_forbidden"
  | "forbidden_side_effect"
  | "capability_denied"
  | "capability_stale"
  | "capability_widening"
  | "capability_scope"
  | "clone_failed";

export const SAFE_MEMBERSHIP_DENIAL = "Room membership operation was denied by the active policy.";

export class RoomMembershipError extends Error {
  readonly code: RoomMembershipErrorCode;
  constructor(code: RoomMembershipErrorCode, detail?: string) {
    // `detail` must be a STATIC caller string — never a member/role/content.
    super(detail ? `${code}: ${detail}` : code);
    this.name = "RoomMembershipError";
    this.code = code;
  }
}

export class RoomMembershipValidationError extends RoomMembershipError {
  constructor(code: RoomMembershipErrorCode, detail?: string) {
    super(code, detail);
    this.name = "RoomMembershipValidationError";
  }
}
export class RoomMembershipPolicyDeniedError extends RoomMembershipError {
  constructor(detail?: string) {
    super("policy_denied", detail);
    this.name = "RoomMembershipPolicyDeniedError";
  }
}
export class RoomMembershipDecisionMismatchError extends RoomMembershipError {
  constructor(detail?: string) {
    super("decision_mismatch", detail);
    this.name = "RoomMembershipDecisionMismatchError";
  }
}
export class RoomMembershipNotFoundError extends RoomMembershipError {
  constructor() {
    super("membership_not_found");
    this.name = "RoomMembershipNotFoundError";
  }
}
export class RoomMembershipRevisionError extends RoomMembershipError {
  constructor(
    code: "stale_revision" | "future_revision" | "missing_expected_revision" | "revision_overflow",
  ) {
    super(code);
    this.name = "RoomMembershipRevisionError";
  }
}
export class RoomMembershipLifecycleError extends RoomMembershipError {
  constructor(code: "invalid_lifecycle_transition" | "membership_terminal") {
    super(code);
    this.name = "RoomMembershipLifecycleError";
  }
}
export class RoomMembershipDuplicateError extends RoomMembershipError {
  constructor() {
    super("duplicate_active_membership");
    this.name = "RoomMembershipDuplicateError";
  }
}
export class RoomLastOwnerContinuityError extends RoomMembershipError {
  constructor() {
    super("last_owner_continuity");
    this.name = "RoomLastOwnerContinuityError";
  }
}
export class RoomCapabilityDeniedError extends RoomMembershipError {
  constructor(detail?: string) {
    super("capability_denied", detail);
    this.name = "RoomCapabilityDeniedError";
  }
}
export class RoomCapabilityStaleError extends RoomMembershipError {
  constructor() {
    super("capability_stale");
    this.name = "RoomCapabilityStaleError";
  }
}
export class RoomCapabilityWideningError extends RoomMembershipError {
  constructor() {
    super("capability_widening");
    this.name = "RoomCapabilityWideningError";
  }
}
export class RoomCapabilityScopeError extends RoomMembershipError {
  constructor() {
    super("capability_scope");
    this.name = "RoomCapabilityScopeError";
  }
}

export function membershipFail(code: RoomMembershipErrorCode, detail?: string): never {
  throw new RoomMembershipValidationError(code, detail);
}
