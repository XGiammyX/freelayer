/**
 * Ephemeral identity clock, process epoch, and lifetime limits (TECH-ID-04).
 *
 * Local time is NOT trusted global time. The process epoch is injected at
 * application bootstrap, contains NO OS process id, is never persisted, and is
 * never exposed to peers — a mismatch means expired/destroyed for operational
 * purposes (no restart restoration). Limits are engineering defaults, not
 * security guarantees.
 */

import { EphemeralIdentityValidationError } from "./ephemeral-errors";

export interface IdentityLocalClockV1 {
  nowLocal(): string;
}

/** Opaque, local, non-persisted, non-peer-facing process-epoch id. */
export type IdentityProcessEpochId = string & {
  readonly __identityProcessEpochId: unique symbol;
};

export interface EphemeralProcessBindingV1 {
  readonly processEpochId: IdentityProcessEpochId;
  readonly crossRestartValidity: false;
}

const EPOCH_RE = /^epoch-[a-z0-9][a-z0-9_-]{2,63}$/;

/** Validate an injected process-epoch id (opaque local slug; no OS pid/device id). */
export function validateIdentityProcessEpochId(input: string): IdentityProcessEpochId {
  if (typeof input !== "string" || !EPOCH_RE.test(input)) {
    throw new EphemeralIdentityValidationError("bad_process_epoch");
  }
  return input as IdentityProcessEpochId;
}

/**
 * Conservative lifetime limits. Engineering defaults, NOT security guarantees;
 * adjust only with documented reasoning + tests.
 */
export const EPHEMERAL_IDENTITY_LIMITS_V1 = {
  minimumDurationMs: 60_000,
  defaultDurationMs: 3_600_000,
  maximumDurationMs: 86_400_000,
  maximumActiveEphemeralRoots: 8,
} as const;

/** Parse a `local:<ms>` clock label into a non-negative integer ms, else null. */
export function parseLocalClockMs(value: string): number | null {
  if (typeof value !== "string") return null;
  const m = /^local:(\d{1,15})$/.exec(value);
  if (m === null) return null;
  const ms = Number(m[1]);
  return Number.isSafeInteger(ms) && ms >= 0 ? ms : null;
}

/** Build a `local:<ms>` label. */
export function localClockLabel(ms: number): string {
  if (!Number.isSafeInteger(ms) || ms < 0) {
    throw new EphemeralIdentityValidationError("bad_clock_ms");
  }
  return `local:${ms}`;
}
