/**
 * RoomOS local authorization/revocation error taxonomy (TECH-21). Every error
 * is REDACTED: a stable machine code + a STATIC message only — never a member
 * ref, membership ID, room title, object content, target role/state, capability
 * dump, prepared-context serialization, or the leak sentinel. Failure is safe:
 * no partial side effect.
 */

export type RoomAuthorizationErrorCode =
  | "prepared_authorization_stale"
  | "authorization_revision_mismatch"
  | "authorization_operation_binding"
  | "authorization_object_binding"
  | "authorization_view_binding"
  | "authorization_target_binding"
  | "membership_revoked"
  | "membership_suspended"
  | "membership_removed"
  | "role_capability_revoked"
  | "room_policy_revision_mismatch"
  | "privacy_mode_revision_mismatch"
  | "authorization_cache_forbidden"
  | "restrictive_operation_escalation"
  | "decision_missing"
  | "decision_mismatch"
  | "last_owner_continuity"
  | "invalid_field";

export const SAFE_AUTHORIZATION_DENIAL =
  "Authorization is no longer valid for the current local room state.";

export class RoomAuthorizationError extends Error {
  readonly code: RoomAuthorizationErrorCode;
  constructor(code: RoomAuthorizationErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "RoomAuthorizationError";
    this.code = code;
  }
}

const named = (name: string, code: RoomAuthorizationErrorCode) =>
  class extends RoomAuthorizationError {
    constructor(detail?: string) {
      super(code, detail);
      this.name = name;
    }
  };

export const PreparedAuthorizationStaleError = named(
  "PreparedAuthorizationStaleError",
  "prepared_authorization_stale",
);
export const AuthorizationRevisionMismatchError = named(
  "AuthorizationRevisionMismatchError",
  "authorization_revision_mismatch",
);
export const AuthorizationOperationBindingError = named(
  "AuthorizationOperationBindingError",
  "authorization_operation_binding",
);
export const AuthorizationObjectBindingError = named(
  "AuthorizationObjectBindingError",
  "authorization_object_binding",
);
export const AuthorizationViewBindingError = named(
  "AuthorizationViewBindingError",
  "authorization_view_binding",
);
export const AuthorizationTargetBindingError = named(
  "AuthorizationTargetBindingError",
  "authorization_target_binding",
);
export const MembershipRevokedError = named("MembershipRevokedError", "membership_revoked");
export const MembershipSuspendedError = named("MembershipSuspendedError", "membership_suspended");
export const MembershipRemovedError = named("MembershipRemovedError", "membership_removed");
export const RoleCapabilityRevokedError = named(
  "RoleCapabilityRevokedError",
  "role_capability_revoked",
);
export const RoomPolicyRevisionMismatchError = named(
  "RoomPolicyRevisionMismatchError",
  "room_policy_revision_mismatch",
);
export const PrivacyModeRevisionMismatchError = named(
  "PrivacyModeRevisionMismatchError",
  "privacy_mode_revision_mismatch",
);
export const AuthorizationCacheForbiddenError = named(
  "AuthorizationCacheForbiddenError",
  "authorization_cache_forbidden",
);
export const RestrictiveOperationEscalationError = named(
  "RestrictiveOperationEscalationError",
  "restrictive_operation_escalation",
);

export function authorizationFail(code: RoomAuthorizationErrorCode, detail?: string): never {
  throw new RoomAuthorizationError(code, detail);
}
