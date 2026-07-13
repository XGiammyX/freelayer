/**
 * @freelayer/rooms — RoomOS policy composition + governance (TECH-22).
 *
 * One deterministic, fail-closed policy-composition model: STRICTEST-POLICY-WINS
 * + DENY-OVERRIDES. Room governance can only TIGHTEN, never weaken local
 * protections. DevicePosture is an externalized future signal (Secure Device is
 * a SEPARATE project) — untrusted input can only reduce trust, never elevate;
 * `at_risk` always tightens; no provider is integrated. Protected-content
 * requirements deny display when integration is absent. Local only — no
 * distributed consensus (Gate H), no signed policy (Gate F), no verified
 * governance (Gate G), no endpoint assurance. Not safe for real secrets.
 */

export * from "./policy-composition-errors";
export * from "./device-posture";
export * from "./protected-content";
export * from "./policy-layers";
export * from "./room-policy-document";
export * from "./policy-comparison";
export * from "./policy-composition";
// NOTE (TECH-23): the sensitive-room admission model graduated to the richer,
// canonical `secure-device` module (../secure-device). The former TECH-22
// composition-level admission was superseded to avoid a duplicate export.
export * from "./governance-commands";
export * from "./governance-events";
export * from "./governance-pipeline";
