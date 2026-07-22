/**
 * Per-contact alias error taxonomy (TECH-ID-05). REDACTED: codes + STATIC
 * generic messages only — NEVER alias text, a local peer label, a relationship/
 * root/persona id where avoidable, a command payload, collision details, or the
 * leak sentinel. Failure is always safe (no partial state). Aliases are LOCAL,
 * NON-CRYPTOGRAPHIC presentation metadata — never identity or verification.
 */

export type ContactAliasErrorCode =
  | "validation"
  | "normalization"
  | "policy_denied"
  | "decision_mismatch"
  | "not_found"
  | "revision_mismatch"
  | "lifecycle"
  | "relationship_mismatch"
  | "duplicate_active"
  | "transfer_forbidden"
  | "remote_sharing_unavailable"
  | "authentication_unavailable"
  | "local_peer_label_visibility";

export const SAFE_ALIAS_REJECTION =
  "The contact alias operation was rejected because its state is no longer valid.";

export class ContactAliasError extends Error {
  readonly code: ContactAliasErrorCode;
  constructor(code: ContactAliasErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : `${code}: ${SAFE_ALIAS_REJECTION}`);
    this.name = "ContactAliasError";
    this.code = code;
  }
}

class A extends ContactAliasError {}
export class ContactAliasValidationError extends A {
  constructor(d?: string) {
    super("validation", d);
    this.name = "ContactAliasValidationError";
  }
}
export class ContactAliasNormalizationError extends A {
  constructor(d?: string) {
    super("normalization", d);
    this.name = "ContactAliasNormalizationError";
  }
}
export class ContactAliasPolicyDeniedError extends A {
  constructor(d?: string) {
    super("policy_denied", d);
    this.name = "ContactAliasPolicyDeniedError";
  }
}
export class ContactAliasDecisionMismatchError extends A {
  constructor(d?: string) {
    super("decision_mismatch", d);
    this.name = "ContactAliasDecisionMismatchError";
  }
}
export class ContactAliasNotFoundError extends A {
  constructor(d?: string) {
    super("not_found", d);
    this.name = "ContactAliasNotFoundError";
  }
}
export class ContactAliasRevisionMismatchError extends A {
  constructor(d?: string) {
    super("revision_mismatch", d);
    this.name = "ContactAliasRevisionMismatchError";
  }
}
export class ContactAliasLifecycleError extends A {
  constructor(d?: string) {
    super("lifecycle", d);
    this.name = "ContactAliasLifecycleError";
  }
}
export class ContactAliasRelationshipMismatchError extends A {
  constructor(d?: string) {
    super("relationship_mismatch", d);
    this.name = "ContactAliasRelationshipMismatchError";
  }
}
export class ContactAliasDuplicateActiveError extends A {
  constructor(d?: string) {
    super("duplicate_active", d);
    this.name = "ContactAliasDuplicateActiveError";
  }
}
export class ContactAliasTransferForbiddenError extends A {
  constructor(d?: string) {
    super("transfer_forbidden", d);
    this.name = "ContactAliasTransferForbiddenError";
  }
}
export class ContactAliasRemoteSharingUnavailableError extends A {
  constructor(d?: string) {
    super("remote_sharing_unavailable", d);
    this.name = "ContactAliasRemoteSharingUnavailableError";
  }
}
export class ContactAliasAuthenticationUnavailableError extends A {
  constructor(d?: string) {
    super("authentication_unavailable", d);
    this.name = "ContactAliasAuthenticationUnavailableError";
  }
}
export class LocalPeerLabelVisibilityError extends A {
  constructor(d?: string) {
    super("local_peer_label_visibility", d);
    this.name = "LocalPeerLabelVisibilityError";
  }
}
