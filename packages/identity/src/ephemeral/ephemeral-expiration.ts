/**
 * Ephemeral identity expiration + current-state assertion (TECH-ID-04). PURE and
 * deterministic: no global clock, no background task, no storage. A process-epoch
 * mismatch or a passed local deadline expires; backward local-clock movement or
 * an unparseable timestamp FAILS CLOSED. Every protected operation must call
 * `assertEphemeralIdentityCurrentV1` immediately before executing — creation-time
 * validation is never sufficient.
 */

import {
  EphemeralIdentityClockRollbackError,
  EphemeralIdentityExpiredError,
  EphemeralIdentityProcessEpochMismatchError,
  EphemeralIdentityValidationError,
} from "./ephemeral-errors";
import { parseLocalClockMs, type IdentityProcessEpochId } from "./ephemeral-clock";
import type { EphemeralIdentityRootV1 } from "./ephemeral-types";

export type EphemeralIdentityExpirationStatusV1 =
  | "current"
  | "expired_deadline"
  | "expired_process_epoch"
  | "invalid_clock"
  | "destroyed"
  | "compromised";

export function evaluateEphemeralIdentityExpirationV1(input: {
  root: EphemeralIdentityRootV1;
  currentProcessEpochId: IdentityProcessEpochId;
  nowLocal: string;
}): EphemeralIdentityExpirationStatusV1 {
  const { root, currentProcessEpochId, nowLocal } = input;

  if (root.lifecycle === "destroyed_tombstone") return "destroyed";
  if (root.lifecycle === "compromised_suspected") return "compromised";

  // Cross-process: a different epoch is operationally expired (no restoration).
  if (root.processBinding.processEpochId !== currentProcessEpochId) {
    return "expired_process_epoch";
  }

  const nowMs = parseLocalClockMs(nowLocal);
  const createdMs = parseLocalClockMs(root.lifetime.createdAtLocal);
  if (nowMs === null || createdMs === null) return "invalid_clock";
  // Backward local-clock movement fails closed.
  if (nowMs < createdMs) return "invalid_clock";

  if (root.lifecycle === "expired_local") return "expired_deadline";

  if (root.lifetime.mode === "current_process_with_local_deadline") {
    const deadlineMs = parseLocalClockMs(root.lifetime.expiresAtLocal ?? "");
    if (deadlineMs === null) return "invalid_clock";
    if (nowMs >= deadlineMs) return "expired_deadline";
  }

  return "current";
}

/**
 * Assert an ephemeral root is usable NOW for a protected operation. Throws a
 * content-free error on any non-current state (including a `draft` root that was
 * never activated). Never mutates, never restores.
 */
export function assertEphemeralIdentityCurrentV1(input: {
  root: EphemeralIdentityRootV1;
  currentProcessEpochId: IdentityProcessEpochId;
  nowLocal: string;
}): void {
  const status = evaluateEphemeralIdentityExpirationV1(input);
  switch (status) {
    case "current":
      if (input.root.lifecycle !== "active_current_process") {
        throw new EphemeralIdentityValidationError("not_active");
      }
      return;
    case "expired_process_epoch":
      throw new EphemeralIdentityProcessEpochMismatchError();
    case "invalid_clock":
      throw new EphemeralIdentityClockRollbackError();
    case "expired_deadline":
      throw new EphemeralIdentityExpiredError("deadline");
    case "destroyed":
      throw new EphemeralIdentityExpiredError("destroyed");
    case "compromised":
      throw new EphemeralIdentityExpiredError("compromised");
    default: {
      const _never: never = status;
      throw new EphemeralIdentityValidationError(`unknown_status:${String(_never)}`);
    }
  }
}
