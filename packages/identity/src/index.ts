/**
 * @freelayer/identity — Identity Firewall LOCAL SCAFFOLDING (TECH-ID-03).
 *
 * Local, NON-CRYPTOGRAPHIC identity-domain foundations that make later Identity
 * Firewall tasks possible without introducing crypto prematurely. It provides
 * PRIVATE local identity roots (never peer-facing), optional personas (NOT
 * guaranteed unlinkable), pairwise relationship + room identity-binding
 * placeholders, explicit lifecycle validators, policy-gated commands, a pure
 * deterministic reducer, and memory/null repositories — all metadata-only.
 *
 * NOT implemented (future gates, honest): identity keys/signatures/derivation/
 * fingerprints (Gate F), per-contact & per-room aliases (TECH-ID-05/06), device
 * keys/passports (TECH-ID-07/08), Trust Notebook (TECH-ID-09), invites/QR
 * (TECH-ID-10/11, Gate E), recovery (TECH-ID-12/13), synchronization (Gate H).
 * No verified identities, no real-world identity proofing, no phone/email, no
 * public directory, no DID, no key transparency. DevicePosture is not identity;
 * a RoomMemberRef is not identity proof. Not safe for real secrets.
 */

export * from "./identity-errors";
export * from "./identifiers";
export * from "./identity-types";
export * from "./identity-lifecycle";
export * from "./identity-commands";
export * from "./identity-validation";
export * from "./identity-policy";
export * from "./identity-reducer";
export * from "./identity-repository";
export * from "./identity-pipeline";
export * from "./identity-summary";
export * from "./identity-audit";
