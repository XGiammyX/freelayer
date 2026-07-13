/**
 * @freelayer/rooms — Secure Device admission CONTRACT (TECH-23).
 *
 * A narrow, privacy-minimized boundary through which a FUTURE external Secure
 * Device provider could supply a normalized posture result. FreeLayer core is
 * ONLY the RATS Relying Party (RFC 9334): it consumes a normalized assessment
 * and applies its own room-admission policy. It NEVER processes raw Evidence,
 * performs device management, collects endpoint telemetry, or stores device
 * identifiers. No provider is integrated — the deterministic Null provider is
 * the only one that ships; posture above `unverified` cannot be established;
 * `at_risk` can only restrict. No attestation (Gate F), no identity (Gate G),
 * no sync (Gate H), no capabilities/construction authority (Gate B), no capsule/
 * hostile-evidence parsing (Gate E). Not safe for real secrets.
 */

export * from "./secure-device-errors";
export * from "./secure-device-roles";
export * from "./secure-device-provider";
export * from "./posture-assessment";
export * from "./freshness-policy";
export * from "./null-provider";
export * from "./sensitive-room-admission";
export * from "./sensitive-room-session";
export * from "./protected-content-intent";
export * from "./provider-recovery";
