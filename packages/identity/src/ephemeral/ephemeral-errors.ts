/**
 * Ephemeral identity error taxonomy (TECH-ID-04). REDACTED: codes + STATIC
 * generic messages only — never an id, local label, room/member ref, deadline
 * (where unnecessary), process epoch, raw command/state, or the leak sentinel.
 * Failure is always safe (no partial state). Ephemeral identity is LOCAL,
 * CURRENT-PROCESS, NON-CRYPTOGRAPHIC — these errors describe validation/policy/
 * lifetime/destruction rejection, never a cryptographic or anonymity guarantee.
 */

export type EphemeralIdentityErrorCode =
  | "validation"
  | "policy_denied"
  | "decision_mismatch"
  | "expired"
  | "process_epoch_mismatch"
  | "clock_rollback"
  | "lifetime"
  | "limit"
  | "promotion_forbidden"
  | "recovery_forbidden"
  | "persistence_forbidden"
  | "export_forbidden"
  | "synchronization_forbidden"
  | "destruction"
  | "orphan_state";

export const SAFE_EPHEMERAL_REJECTION =
  "The ephemeral identity is no longer valid in the current application process.";

export class EphemeralIdentityError extends Error {
  readonly code: EphemeralIdentityErrorCode;
  constructor(code: EphemeralIdentityErrorCode, detail?: string) {
    // `detail` is a CALLER-CONTROLLED STATIC code only — never ids/labels/secrets.
    super(detail ? `${code}: ${detail}` : `${code}: ${SAFE_EPHEMERAL_REJECTION}`);
    this.name = "EphemeralIdentityError";
    this.code = code;
  }
}

class E extends EphemeralIdentityError {}
export class EphemeralIdentityValidationError extends E {
  constructor(d?: string) {
    super("validation", d);
    this.name = "EphemeralIdentityValidationError";
  }
}
export class EphemeralIdentityPolicyDeniedError extends E {
  constructor(d?: string) {
    super("policy_denied", d);
    this.name = "EphemeralIdentityPolicyDeniedError";
  }
}
export class EphemeralIdentityDecisionMismatchError extends E {
  constructor(d?: string) {
    super("decision_mismatch", d);
    this.name = "EphemeralIdentityDecisionMismatchError";
  }
}
export class EphemeralIdentityExpiredError extends E {
  constructor(d?: string) {
    super("expired", d);
    this.name = "EphemeralIdentityExpiredError";
  }
}
export class EphemeralIdentityProcessEpochMismatchError extends E {
  constructor(d?: string) {
    super("process_epoch_mismatch", d);
    this.name = "EphemeralIdentityProcessEpochMismatchError";
  }
}
export class EphemeralIdentityClockRollbackError extends E {
  constructor(d?: string) {
    super("clock_rollback", d);
    this.name = "EphemeralIdentityClockRollbackError";
  }
}
export class EphemeralIdentityLifetimeError extends E {
  constructor(d?: string) {
    super("lifetime", d);
    this.name = "EphemeralIdentityLifetimeError";
  }
}
export class EphemeralIdentityLimitError extends E {
  constructor(d?: string) {
    super("limit", d);
    this.name = "EphemeralIdentityLimitError";
  }
}
export class EphemeralIdentityPromotionForbiddenError extends E {
  constructor(d?: string) {
    super("promotion_forbidden", d);
    this.name = "EphemeralIdentityPromotionForbiddenError";
  }
}
export class EphemeralIdentityRecoveryForbiddenError extends E {
  constructor(d?: string) {
    super("recovery_forbidden", d);
    this.name = "EphemeralIdentityRecoveryForbiddenError";
  }
}
export class EphemeralIdentityPersistenceForbiddenError extends E {
  constructor(d?: string) {
    super("persistence_forbidden", d);
    this.name = "EphemeralIdentityPersistenceForbiddenError";
  }
}
export class EphemeralIdentityExportForbiddenError extends E {
  constructor(d?: string) {
    super("export_forbidden", d);
    this.name = "EphemeralIdentityExportForbiddenError";
  }
}
export class EphemeralIdentitySynchronizationForbiddenError extends E {
  constructor(d?: string) {
    super("synchronization_forbidden", d);
    this.name = "EphemeralIdentitySynchronizationForbiddenError";
  }
}
export class EphemeralIdentityDestructionError extends E {
  constructor(d?: string) {
    super("destruction", d);
    this.name = "EphemeralIdentityDestructionError";
  }
}
export class EphemeralIdentityOrphanStateError extends E {
  constructor(d?: string) {
    super("orphan_state", d);
    this.name = "EphemeralIdentityOrphanStateError";
  }
}
