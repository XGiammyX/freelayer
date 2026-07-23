/**
 * Device-key-model error taxonomy (TECH-ID-07). REDACTED: codes + STATIC generic
 * messages only — NEVER device/root/persona/room/relationship ids where
 * avoidable, local labels, hardware/model/OS data, key-slot contents, a command/
 * state dump, or the leak sentinel. Failure is always safe (no partial state). A
 * device authorization record is LOCAL, NON-CRYPTOGRAPHIC metadata — never a key,
 * never a cryptographic proof, never identity, never DevicePosture.
 */

export type DeviceKeyModelErrorCode =
  | "validation"
  | "policy_denied"
  | "decision_mismatch"
  | "not_found"
  | "revision_mismatch"
  | "lifecycle"
  | "scope"
  | "capability_attenuation"
  | "key_purpose"
  | "key_material_forbidden"
  | "device_addition_unavailable"
  | "device_passport_unavailable"
  | "revocation"
  | "hardware_identifier_forbidden"
  | "device_posture_authority";

export const SAFE_DEVICE_REJECTION =
  "The device operation was rejected because its authorization state is no longer valid.";

export class DeviceKeyModelError extends Error {
  readonly code: DeviceKeyModelErrorCode;
  constructor(code: DeviceKeyModelErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : `${code}: ${SAFE_DEVICE_REJECTION}`);
    this.name = "DeviceKeyModelError";
    this.code = code;
  }
}

class D extends DeviceKeyModelError {}
export class DeviceKeyModelValidationError extends D {
  constructor(d?: string) {
    super("validation", d);
    this.name = "DeviceKeyModelValidationError";
  }
}
export class DeviceAuthorizationPolicyDeniedError extends D {
  constructor(d?: string) {
    super("policy_denied", d);
    this.name = "DeviceAuthorizationPolicyDeniedError";
  }
}
export class DeviceAuthorizationDecisionMismatchError extends D {
  constructor(d?: string) {
    super("decision_mismatch", d);
    this.name = "DeviceAuthorizationDecisionMismatchError";
  }
}
export class DeviceAuthorizationNotFoundError extends D {
  constructor(d?: string) {
    super("not_found", d);
    this.name = "DeviceAuthorizationNotFoundError";
  }
}
export class DeviceAuthorizationRevisionMismatchError extends D {
  constructor(d?: string) {
    super("revision_mismatch", d);
    this.name = "DeviceAuthorizationRevisionMismatchError";
  }
}
export class DeviceAuthorizationLifecycleError extends D {
  constructor(d?: string) {
    super("lifecycle", d);
    this.name = "DeviceAuthorizationLifecycleError";
  }
}
export class DeviceAuthorizationScopeError extends D {
  constructor(d?: string) {
    super("scope", d);
    this.name = "DeviceAuthorizationScopeError";
  }
}
export class DeviceCapabilityAttenuationError extends D {
  constructor(d?: string) {
    super("capability_attenuation", d);
    this.name = "DeviceCapabilityAttenuationError";
  }
}
export class DeviceKeyPurposeError extends D {
  constructor(d?: string) {
    super("key_purpose", d);
    this.name = "DeviceKeyPurposeError";
  }
}
export class DeviceKeyMaterialForbiddenError extends D {
  constructor(d?: string) {
    super("key_material_forbidden", d);
    this.name = "DeviceKeyMaterialForbiddenError";
  }
}
export class DeviceAdditionUnavailableError extends D {
  constructor(d?: string) {
    super("device_addition_unavailable", d);
    this.name = "DeviceAdditionUnavailableError";
  }
}
export class DevicePassportUnavailableError extends D {
  constructor(d?: string) {
    super("device_passport_unavailable", d);
    this.name = "DevicePassportUnavailableError";
  }
}
export class DeviceRevocationError extends D {
  constructor(d?: string) {
    super("revocation", d);
    this.name = "DeviceRevocationError";
  }
}
export class HardwareIdentifierForbiddenError extends D {
  constructor(d?: string) {
    super("hardware_identifier_forbidden", d);
    this.name = "HardwareIdentifierForbiddenError";
  }
}
export class DevicePostureAuthorityError extends D {
  constructor(d?: string) {
    super("device_posture_authority", d);
    this.name = "DevicePostureAuthorityError";
  }
}
