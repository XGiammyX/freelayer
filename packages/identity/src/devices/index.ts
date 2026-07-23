/**
 * Device key model foundation (TECH-ID-07). A LOCAL, NON-CRYPTOGRAPHIC, root-
 * subordinate device-authorization domain model: opaque local device references,
 * explicit scopes + capabilities, purpose-separated EMPTY key slots, a bootstrap
 * placeholder for the current installation, and restrict/compromise/revoke
 * lifecycle with stale-context invalidation. NO real keys, signatures, Device
 * Passport, linking, cross-signing, synchronization, attestation, or Secure
 * Device implementation. A DeviceKey is not DevicePosture; a device is not a
 * person; a local authorization record is not a cryptographic proof.
 */

export * from "./device-errors";
export * from "./device-identifiers";
export * from "./device-key-purposes";
export * from "./device-key-slots";
export * from "./device-scopes";
export * from "./device-types";
export * from "./device-lifecycle";
export * from "./device-validation";
export * from "./device-policy";
export * from "./device-commands";
export * from "./device-authorization-context";
export * from "./device-reducer";
export * from "./device-repository";
export * from "./device-pipeline";
export * from "./device-summary";
