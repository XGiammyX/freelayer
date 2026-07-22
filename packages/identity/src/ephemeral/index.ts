/**
 * @freelayer/identity — Ephemeral Identity (TECH-ID-04).
 *
 * An INDEPENDENT, current-process, non-recoverable, non-cryptographic local
 * ephemeral identity-root context: bounded local lifetime (injected clock),
 * process-epoch binding, fail-closed expiration, isolated persona/relationship/
 * room-binding placeholders, and atomic local destruction. NO recovery, NO
 * promotion to long-lived, NO parent/long-lived link, NO export, NO
 * synchronization, NO persistence. Destruction claims NO media sanitization, NO
 * remote deletion, and NO forensic erasure. It is NOT anonymity, NOT a secure
 * device, NOT a persona. DevicePosture is not identity. Not safe for real secrets.
 */

export * from "./ephemeral-errors";
export * from "./ephemeral-clock";
export * from "./ephemeral-types";
export * from "./ephemeral-expiration";
export * from "./ephemeral-commands";
export * from "./ephemeral-validation";
export * from "./ephemeral-policy";
export * from "./ephemeral-reducer";
export * from "./ephemeral-repository";
export * from "./ephemeral-pipeline";
export * from "./ephemeral-summary";
