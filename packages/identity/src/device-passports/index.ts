/**
 * Device Passport foundation (TECH-ID-08). A versioned, NON-CRYPTOGRAPHIC Device
 * Passport contract + local approval lifecycle for FUTURE root-to-device
 * authorization: bounded link requests, attenuated passport claims (scope +
 * capabilities + root epoch + empty key-slot commitments), local unsigned
 * approval, restriction, and revocation — all current-process memory/null. A
 * local unsigned approval is NOT cryptographic authorization and grants NO
 * operational device authority. NO signatures, NO signed/verified passport, NO
 * remote activation/acceptance, NO QR/Capsule transport, NO remote revocation,
 * NO root-secret/history transfer, NO attestation. A Device Passport is not
 * DevicePosture; a device is not a person.
 */

export * from "./passport-errors";
export * from "./passport-identifiers";
export * from "./passport-claims";
export * from "./passport-link-requests";
export * from "./passport-types";
export * from "./passport-lifecycle";
export * from "./passport-validity";
export * from "./passport-attenuation";
export * from "./passport-policy";
export * from "./passport-commands";
export * from "./passport-validation";
export * from "./passport-reducer";
export * from "./passport-repository";
export * from "./passport-pipeline";
export * from "./passport-summary";
