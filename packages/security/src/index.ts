/**
 * @freelayer/security — foundation-layer hardening utilities.
 *
 * Boundary rule: this package must not import any other workspace package
 * (enforced by scripts/check-boundaries.mjs).
 *
 * Honest scope: these are type-level and convention-level guards. They reduce
 * the risk of *accidental* misuse; they do not stop hostile code running in
 * the same process, which is outside the threat model (docs/THREAT_MODEL.md).
 */

declare const brandSymbol: unique symbol;

/** Nominal-typing helper shared across FreeLayer packages. */
export type Brand<T, B extends string> = T & { readonly [brandSymbol]: B };

/** Exhaustiveness guard for discriminated unions. */
export function assertNever(value: never, context = "unexpected variant"): never {
  throw new Error(`assertNever: ${context} (${String(value)})`);
}

/**
 * A string carrying sensitive material (key material, message content,
 * identity data, AI prompts). Values of this type must never reach logs,
 * thrown error messages, audit events, or serialized debug output — the
 * no-plaintext-logging hard constraint.
 */
export type SensitiveString = Brand<string, "SensitiveString">;

export function markSensitive(value: string): SensitiveString {
  return value as SensitiveString;
}

/** The only representation of sensitive data permitted in logs and audit events. */
export type RedactedLogValue = Brand<string, "RedactedLogValue">;

/** Replace a sensitive value with a stable, non-reversible label. */
export function redact(label: string): RedactedLogValue {
  return `[redacted:${label}]` as RedactedLogValue;
}

/**
 * Minimal audit event. `seq` is a module-local logical counter — an ordering
 * hint, not trusted time. The real audit sink arrives with Gate B
 * (docs/IMPLEMENTATION_GATES.md).
 */
export interface AuditEvent {
  readonly seq: number;
  readonly kind: string;
  readonly detail: RedactedLogValue;
}

let auditSeq = 0;

/** Placeholder audit factory. Accepts only pre-redacted detail by type. */
export function createAuditEvent(kind: string, detail: RedactedLogValue): AuditEvent {
  auditSeq += 1;
  return { seq: auditSeq, kind, detail };
}

/** Thrown when a side effect is attempted that the active policy forbids. */
export class ForbiddenSideEffectError extends Error {
  override readonly name = "ForbiddenSideEffectError";
}

/**
 * Thrown when a side-effect module is invoked without a valid PolicyDecision.
 * See docs/ARCHITECTURE.md — non-bypassable rule 6.
 */
export class PolicyBypassError extends Error {
  override readonly name = "PolicyBypassError";
}

/** Thrown when externally-influenced input fails strict validation. */
export class HostileInputError extends Error {
  override readonly name = "HostileInputError";
}

/** Thrown by test-only or placeholder code paths that must never ship behavior. */
export class UnsafeForProductionError extends Error {
  override readonly name = "UnsafeForProductionError";
}
