/**
 * Identity Firewall scaffolding error taxonomy (TECH-ID-03).
 *
 * REDACTED: codes + STATIC generic messages only — NEVER a local label, an
 * identifier where avoidable, a room id, relationship data, the raw command,
 * a state dump, an email/phone/username, a secret-like value, or the leak
 * sentinel. Failure is always safe (no partial state). Identity here is LOCAL,
 * NON-CRYPTOGRAPHIC scaffolding — these errors describe validation/policy/
 * lifecycle rejection, never a cryptographic or identity-proofing failure.
 */

export type IdentityErrorCode =
  | "validation"
  | "schema_version"
  | "identifier"
  | "policy_denied"
  | "decision_mismatch"
  | "revision_mismatch"
  | "lifecycle"
  | "root_not_found"
  | "persona_not_found"
  | "relationship_not_found"
  | "room_binding_not_found"
  | "cross_reference"
  | "duplicate"
  | "tombstone"
  | "persistence_unavailable";

/** Stable, content-free rejection message surfaced to callers/UI. */
export const SAFE_IDENTITY_REJECTION =
  "The local identity operation was rejected because its state is no longer valid.";

export class IdentityError extends Error {
  readonly code: IdentityErrorCode;
  constructor(code: IdentityErrorCode, detail?: string) {
    // `detail` is a CALLER-CONTROLLED STATIC code only. Callers must never pass
    // labels/ids/secrets/content; the redaction guards + tests enforce this.
    super(detail ? `${code}: ${detail}` : `${code}: ${SAFE_IDENTITY_REJECTION}`);
    this.name = "IdentityError";
    this.code = code;
  }
}

export class IdentityValidationError extends IdentityError {
  constructor(detail?: string) {
    super("validation", detail);
    this.name = "IdentityValidationError";
  }
}
export class IdentitySchemaVersionError extends IdentityError {
  constructor(detail?: string) {
    super("schema_version", detail);
    this.name = "IdentitySchemaVersionError";
  }
}
export class IdentityIdentifierError extends IdentityError {
  constructor(detail?: string) {
    super("identifier", detail);
    this.name = "IdentityIdentifierError";
  }
}
export class IdentityPolicyDeniedError extends IdentityError {
  constructor(detail?: string) {
    super("policy_denied", detail);
    this.name = "IdentityPolicyDeniedError";
  }
}
export class IdentityDecisionMismatchError extends IdentityError {
  constructor(detail?: string) {
    super("decision_mismatch", detail);
    this.name = "IdentityDecisionMismatchError";
  }
}
export class IdentityRevisionMismatchError extends IdentityError {
  constructor(detail?: string) {
    super("revision_mismatch", detail);
    this.name = "IdentityRevisionMismatchError";
  }
}
export class IdentityLifecycleError extends IdentityError {
  constructor(detail?: string) {
    super("lifecycle", detail);
    this.name = "IdentityLifecycleError";
  }
}
export class IdentityRootNotFoundError extends IdentityError {
  constructor(detail?: string) {
    super("root_not_found", detail);
    this.name = "IdentityRootNotFoundError";
  }
}
export class IdentityPersonaNotFoundError extends IdentityError {
  constructor(detail?: string) {
    super("persona_not_found", detail);
    this.name = "IdentityPersonaNotFoundError";
  }
}
export class IdentityRelationshipNotFoundError extends IdentityError {
  constructor(detail?: string) {
    super("relationship_not_found", detail);
    this.name = "IdentityRelationshipNotFoundError";
  }
}
export class RoomIdentityBindingNotFoundError extends IdentityError {
  constructor(detail?: string) {
    super("room_binding_not_found", detail);
    this.name = "RoomIdentityBindingNotFoundError";
  }
}
export class IdentityCrossReferenceError extends IdentityError {
  constructor(detail?: string) {
    super("cross_reference", detail);
    this.name = "IdentityCrossReferenceError";
  }
}
export class IdentityDuplicateError extends IdentityError {
  constructor(detail?: string) {
    super("duplicate", detail);
    this.name = "IdentityDuplicateError";
  }
}
export class IdentityTombstoneError extends IdentityError {
  constructor(detail?: string) {
    super("tombstone", detail);
    this.name = "IdentityTombstoneError";
  }
}
export class IdentityPersistenceUnavailableError extends IdentityError {
  constructor(detail?: string) {
    super("persistence_unavailable", detail);
    this.name = "IdentityPersistenceUnavailableError";
  }
}

export function identityFail(code: IdentityErrorCode, detail?: string): never {
  throw new IdentityError(code, detail);
}
