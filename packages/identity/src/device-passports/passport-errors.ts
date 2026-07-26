/**
 * Device Passport error taxonomy (TECH-ID-08). REDACTED: codes + STATIC generic
 * messages only — NEVER ids where avoidable, scope graphs, capabilities, key
 * commitments, timestamps, command/state dumps, or the leak sentinel. Failure is
 * always safe (no partial state). A Device Passport draft / local approval is
 * NON-CRYPTOGRAPHIC — never a signature, never proof, never operational device
 * authority, never identity, never DevicePosture, never attestation.
 */

export type DevicePassportErrorCode =
  | "link_request_validation"
  | "link_request_expired"
  | "link_request_revision_mismatch"
  | "link_request_replay"
  | "link_request_already_approved"
  | "passport_validation"
  | "passport_policy_denied"
  | "passport_decision_mismatch"
  | "passport_revision_mismatch"
  | "passport_lifecycle"
  | "passport_scope_escalation"
  | "passport_capability_escalation"
  | "passport_root_epoch_mismatch"
  | "passport_candidate_mismatch"
  | "passport_issuance_unavailable"
  | "passport_verification_unavailable"
  | "passport_operational_authority_unavailable"
  | "passport_attestation_confusion";

export const SAFE_PASSPORT_REJECTION =
  "The device passport operation was rejected because its authorization state is no longer valid.";

export class DevicePassportError extends Error {
  readonly code: DevicePassportErrorCode;
  constructor(code: DevicePassportErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : `${code}: ${SAFE_PASSPORT_REJECTION}`);
    this.name = "DevicePassportError";
    this.code = code;
  }
}

class P extends DevicePassportError {}
export class DeviceLinkRequestValidationError extends P {
  constructor(d?: string) {
    super("link_request_validation", d);
    this.name = "DeviceLinkRequestValidationError";
  }
}
export class DeviceLinkRequestExpiredError extends P {
  constructor(d?: string) {
    super("link_request_expired", d);
    this.name = "DeviceLinkRequestExpiredError";
  }
}
export class DeviceLinkRequestRevisionMismatchError extends P {
  constructor(d?: string) {
    super("link_request_revision_mismatch", d);
    this.name = "DeviceLinkRequestRevisionMismatchError";
  }
}
export class DeviceLinkRequestReplayError extends P {
  constructor(d?: string) {
    super("link_request_replay", d);
    this.name = "DeviceLinkRequestReplayError";
  }
}
export class DeviceLinkRequestAlreadyApprovedError extends P {
  constructor(d?: string) {
    super("link_request_already_approved", d);
    this.name = "DeviceLinkRequestAlreadyApprovedError";
  }
}
export class DevicePassportValidationError extends P {
  constructor(d?: string) {
    super("passport_validation", d);
    this.name = "DevicePassportValidationError";
  }
}
export class DevicePassportPolicyDeniedError extends P {
  constructor(d?: string) {
    super("passport_policy_denied", d);
    this.name = "DevicePassportPolicyDeniedError";
  }
}
export class DevicePassportDecisionMismatchError extends P {
  constructor(d?: string) {
    super("passport_decision_mismatch", d);
    this.name = "DevicePassportDecisionMismatchError";
  }
}
export class DevicePassportRevisionMismatchError extends P {
  constructor(d?: string) {
    super("passport_revision_mismatch", d);
    this.name = "DevicePassportRevisionMismatchError";
  }
}
export class DevicePassportLifecycleError extends P {
  constructor(d?: string) {
    super("passport_lifecycle", d);
    this.name = "DevicePassportLifecycleError";
  }
}
export class DevicePassportScopeEscalationError extends P {
  constructor(d?: string) {
    super("passport_scope_escalation", d);
    this.name = "DevicePassportScopeEscalationError";
  }
}
export class DevicePassportCapabilityEscalationError extends P {
  constructor(d?: string) {
    super("passport_capability_escalation", d);
    this.name = "DevicePassportCapabilityEscalationError";
  }
}
export class DevicePassportRootEpochMismatchError extends P {
  constructor(d?: string) {
    super("passport_root_epoch_mismatch", d);
    this.name = "DevicePassportRootEpochMismatchError";
  }
}
export class DevicePassportCandidateMismatchError extends P {
  constructor(d?: string) {
    super("passport_candidate_mismatch", d);
    this.name = "DevicePassportCandidateMismatchError";
  }
}
export class DevicePassportIssuanceUnavailableError extends P {
  constructor(d?: string) {
    super("passport_issuance_unavailable", d);
    this.name = "DevicePassportIssuanceUnavailableError";
  }
}
export class DevicePassportVerificationUnavailableError extends P {
  constructor(d?: string) {
    super("passport_verification_unavailable", d);
    this.name = "DevicePassportVerificationUnavailableError";
  }
}
export class DevicePassportOperationalAuthorityUnavailableError extends P {
  constructor(d?: string) {
    super("passport_operational_authority_unavailable", d);
    this.name = "DevicePassportOperationalAuthorityUnavailableError";
  }
}
export class DevicePassportAttestationConfusionError extends P {
  constructor(d?: string) {
    super("passport_attestation_confusion", d);
    this.name = "DevicePassportAttestationConfusionError";
  }
}
