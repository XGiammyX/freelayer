/**
 * Secure Device integration-contract error taxonomy (TECH-23). REDACTED: codes
 * + STATIC messages only — never a room title, member ref, object content, raw
 * device evidence, device model/identifier, OS version, package name, the full
 * assessment object, or the leak sentinel. Failure is always safe (no partial
 * side effect). Secure Device is a SEPARATE project; these errors describe the
 * CONTRACT boundary, never an endpoint measurement.
 */

export type SecureDeviceErrorCode =
  | "provider_unavailable"
  | "provider_not_integrated"
  | "assessment_invalid"
  | "assessment_stale"
  | "assessment_revision_rollback"
  | "elevation_untrusted"
  | "admission_denied"
  | "session_stale"
  | "protected_presentation_unavailable"
  | "bunker_session_unavailable"
  | "raw_evidence_forbidden"
  | "device_identifier_forbidden";

/** Stable, content-free denial message surfaced to callers/UI. */
export const SAFE_SECURE_DEVICE_DENIAL =
  "The requested access was denied by the Secure Device admission policy.";

export class SecureDeviceError extends Error {
  readonly code: SecureDeviceErrorCode;
  constructor(code: SecureDeviceErrorCode, detail?: string) {
    // `detail` is a CALLER-CONTROLLED STATIC code only. Callers must never pass
    // evidence/identifiers/content; the redaction guards + tests enforce this.
    super(detail ? `${code}: ${detail}` : code);
    this.name = "SecureDeviceError";
    this.code = code;
  }
}

export class SecureDeviceProviderUnavailableError extends SecureDeviceError {
  constructor(detail?: string) {
    super("provider_unavailable", detail);
    this.name = "SecureDeviceProviderUnavailableError";
  }
}
export class SecureDeviceProviderNotIntegratedError extends SecureDeviceError {
  constructor(detail?: string) {
    super("provider_not_integrated", detail);
    this.name = "SecureDeviceProviderNotIntegratedError";
  }
}
export class DevicePostureAssessmentInvalidError extends SecureDeviceError {
  constructor(detail?: string) {
    super("assessment_invalid", detail);
    this.name = "DevicePostureAssessmentInvalidError";
  }
}
export class DevicePostureAssessmentStaleError extends SecureDeviceError {
  constructor(detail?: string) {
    super("assessment_stale", detail);
    this.name = "DevicePostureAssessmentStaleError";
  }
}
export class DevicePostureRevisionRollbackError extends SecureDeviceError {
  constructor(detail?: string) {
    super("assessment_revision_rollback", detail);
    this.name = "DevicePostureRevisionRollbackError";
  }
}
export class DevicePostureElevationUntrustedError extends SecureDeviceError {
  constructor(detail?: string) {
    super("elevation_untrusted", detail);
    this.name = "DevicePostureElevationUntrustedError";
  }
}
export class SensitiveRoomAdmissionDeniedError extends SecureDeviceError {
  constructor(detail?: string) {
    super("admission_denied", detail);
    this.name = "SensitiveRoomAdmissionDeniedError";
  }
}
export class SensitiveRoomSessionStaleError extends SecureDeviceError {
  constructor(detail?: string) {
    super("session_stale", detail);
    this.name = "SensitiveRoomSessionStaleError";
  }
}
export class ProtectedPresentationUnavailableError extends SecureDeviceError {
  constructor(detail?: string) {
    super("protected_presentation_unavailable", detail);
    this.name = "ProtectedPresentationUnavailableError";
  }
}
export class BunkerSessionUnavailableError extends SecureDeviceError {
  constructor(detail?: string) {
    super("bunker_session_unavailable", detail);
    this.name = "BunkerSessionUnavailableError";
  }
}
/** Thrown if raw attestation evidence is ever handed to core (forbidden input). */
export class RawDeviceEvidenceForbiddenError extends SecureDeviceError {
  constructor(detail?: string) {
    super("raw_evidence_forbidden", detail);
    this.name = "RawDeviceEvidenceForbiddenError";
  }
}
/** Thrown if a device identifier / inventory field is ever handed to core. */
export class DeviceIdentifierForbiddenError extends SecureDeviceError {
  constructor(detail?: string) {
    super("device_identifier_forbidden", detail);
    this.name = "DeviceIdentifierForbiddenError";
  }
}

export function secureDeviceFail(code: SecureDeviceErrorCode, detail?: string): never {
  throw new SecureDeviceError(code, detail);
}
