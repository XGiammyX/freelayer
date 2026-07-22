/**
 * @freelayer/identity — Per-Contact Aliases (TECH-ID-05).
 *
 * A local, relationship-scoped presentation layer for pairwise relationships:
 * PAIRWISE PRESENTATION ALIASES (how the local identity may later present itself
 * to one contact — local-only in TECH-ID-05) and private LOCAL PEER LABELS (how
 * the user recognizes a contact — NEVER shared). Baseline Unicode NFC
 * normalization + dangerous-control rejection; local reuse (correlation)
 * warnings; explicit rotation that preserves relationship continuity; policy-
 * gated redacted display contexts; memory/null retention.
 *
 * An alias is NOT identity, verification, authentication, a public username, or a
 * cryptographic identifier. No global directory, no search, no remote exchange,
 * no cryptographic binding/signature/key continuity, no synchronization, no
 * persistence, no alias history server. Baseline normalization is NOT full
 * Unicode confusable prevention. Rotation does not delete remote copies.
 * DevicePosture is not identity; not safe for real secrets.
 */

export * from "./alias-errors";
export * from "./alias-identifiers";
export * from "./alias-normalization";
export * from "./alias-types";
export * from "./alias-lifecycle";
export * from "./alias-correlation";
export * from "./alias-commands";
export * from "./alias-validation";
export * from "./alias-policy";
export * from "./alias-reducer";
export * from "./alias-repository";
export * from "./alias-pipeline";
export * from "./alias-summary";
