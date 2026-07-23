/**
 * Per-room alias error taxonomy (TECH-ID-06). REDACTED: codes + STATIC generic
 * messages only — NEVER alias text, a root/persona/binding/member/room id where
 * avoidable, collision details, a command/state payload, or the leak sentinel.
 * Failure is always safe (no partial state). A room alias is LOCAL, room-scoped,
 * NON-CRYPTOGRAPHIC presentation metadata — never identity, membership, role, or
 * verification.
 */

export type RoomAliasErrorCode =
  | "validation"
  | "policy_denied"
  | "decision_mismatch"
  | "not_found"
  | "revision_mismatch"
  | "lifecycle"
  | "binding_mismatch"
  | "membership_mismatch"
  | "duplicate_active"
  | "transfer_forbidden"
  | "collision"
  | "remote_sharing_unavailable"
  | "authentication_unavailable";

export const SAFE_ROOM_ALIAS_REJECTION =
  "The room alias operation was rejected because its state is no longer valid.";

export class RoomAliasError extends Error {
  readonly code: RoomAliasErrorCode;
  constructor(code: RoomAliasErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : `${code}: ${SAFE_ROOM_ALIAS_REJECTION}`);
    this.name = "RoomAliasError";
    this.code = code;
  }
}

class A extends RoomAliasError {}
export class RoomAliasValidationError extends A {
  constructor(d?: string) {
    super("validation", d);
    this.name = "RoomAliasValidationError";
  }
}
export class RoomAliasPolicyDeniedError extends A {
  constructor(d?: string) {
    super("policy_denied", d);
    this.name = "RoomAliasPolicyDeniedError";
  }
}
export class RoomAliasDecisionMismatchError extends A {
  constructor(d?: string) {
    super("decision_mismatch", d);
    this.name = "RoomAliasDecisionMismatchError";
  }
}
export class RoomAliasNotFoundError extends A {
  constructor(d?: string) {
    super("not_found", d);
    this.name = "RoomAliasNotFoundError";
  }
}
export class RoomAliasRevisionMismatchError extends A {
  constructor(d?: string) {
    super("revision_mismatch", d);
    this.name = "RoomAliasRevisionMismatchError";
  }
}
export class RoomAliasLifecycleError extends A {
  constructor(d?: string) {
    super("lifecycle", d);
    this.name = "RoomAliasLifecycleError";
  }
}
export class RoomAliasBindingMismatchError extends A {
  constructor(d?: string) {
    super("binding_mismatch", d);
    this.name = "RoomAliasBindingMismatchError";
  }
}
export class RoomAliasMembershipMismatchError extends A {
  constructor(d?: string) {
    super("membership_mismatch", d);
    this.name = "RoomAliasMembershipMismatchError";
  }
}
export class RoomAliasDuplicateActiveError extends A {
  constructor(d?: string) {
    super("duplicate_active", d);
    this.name = "RoomAliasDuplicateActiveError";
  }
}
export class RoomAliasTransferForbiddenError extends A {
  constructor(d?: string) {
    super("transfer_forbidden", d);
    this.name = "RoomAliasTransferForbiddenError";
  }
}
export class RoomAliasCollisionError extends A {
  constructor(d?: string) {
    super("collision", d);
    this.name = "RoomAliasCollisionError";
  }
}
export class RoomAliasRemoteSharingUnavailableError extends A {
  constructor(d?: string) {
    super("remote_sharing_unavailable", d);
    this.name = "RoomAliasRemoteSharingUnavailableError";
  }
}
export class RoomAliasAuthenticationUnavailableError extends A {
  constructor(d?: string) {
    super("authentication_unavailable", d);
    this.name = "RoomAliasAuthenticationUnavailableError";
  }
}
