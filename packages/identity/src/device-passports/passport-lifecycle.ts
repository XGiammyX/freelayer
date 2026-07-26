/**
 * Device link request + Device Passport lifecycle transitions (TECH-ID-08).
 * Explicit + exhaustive; unknown transitions deny; tombstones are terminal.
 * `consumed_future` (request) and `issued_future_signed` / `accepted_future_
 * verified` (passport) are NOT reachable in production (Gate F/E). Approval never
 * grants device authority.
 */

import { DeviceLinkRequestValidationError, DevicePassportLifecycleError } from "./passport-errors";
import type { DeviceLinkRequestLifecycleV1 } from "./passport-link-requests";
import type { DevicePassportLifecycleV1 } from "./passport-types";

const REQUEST_ALLOWED: ReadonlyMap<
  DeviceLinkRequestLifecycleV1,
  ReadonlySet<DeviceLinkRequestLifecycleV1>
> = new Map([
  [
    "draft_candidate_local",
    new Set<DeviceLinkRequestLifecycleV1>([
      "pending_local_review",
      "rejected_tombstone",
      "expired_tombstone",
      "revoked_tombstone",
    ]),
  ],
  [
    "pending_local_review",
    new Set<DeviceLinkRequestLifecycleV1>([
      "approved_local_unsigned",
      "rejected_tombstone",
      "expired_tombstone",
      "revoked_tombstone",
    ]),
  ],
  [
    "approved_local_unsigned",
    new Set<DeviceLinkRequestLifecycleV1>(["expired_tombstone", "revoked_tombstone"]),
  ],
  ["rejected_tombstone", new Set<DeviceLinkRequestLifecycleV1>()],
  ["expired_tombstone", new Set<DeviceLinkRequestLifecycleV1>()],
  ["revoked_tombstone", new Set<DeviceLinkRequestLifecycleV1>()],
  ["consumed_future", new Set<DeviceLinkRequestLifecycleV1>()],
]);

export function assertDeviceLinkRequestTransitionV1(
  from: DeviceLinkRequestLifecycleV1,
  to: DeviceLinkRequestLifecycleV1,
): void {
  const allowed = REQUEST_ALLOWED.get(from);
  if (allowed === undefined || !allowed.has(to)) {
    throw new DeviceLinkRequestValidationError("forbidden_request_transition");
  }
}

const PASSPORT_ALLOWED: ReadonlyMap<
  DevicePassportLifecycleV1,
  ReadonlySet<DevicePassportLifecycleV1>
> = new Map([
  [
    "draft_local",
    new Set<DevicePassportLifecycleV1>([
      "approved_local_unsigned",
      "restricted_local",
      "expired_tombstone",
      "revoked_tombstone",
    ]),
  ],
  [
    "approved_local_unsigned",
    new Set<DevicePassportLifecycleV1>([
      "restricted_local",
      "expired_tombstone",
      "revoked_tombstone",
    ]),
  ],
  [
    "restricted_local",
    new Set<DevicePassportLifecycleV1>([
      "restricted_local",
      "expired_tombstone",
      "revoked_tombstone",
    ]),
  ],
  ["expired_tombstone", new Set<DevicePassportLifecycleV1>()],
  ["revoked_tombstone", new Set<DevicePassportLifecycleV1>()],
  // Future-signed states are never constructible in production.
  ["issued_future_signed", new Set<DevicePassportLifecycleV1>()],
  ["accepted_future_verified", new Set<DevicePassportLifecycleV1>()],
]);

export function assertDevicePassportTransitionV1(
  from: DevicePassportLifecycleV1,
  to: DevicePassportLifecycleV1,
): void {
  if (to === "issued_future_signed" || to === "accepted_future_verified") {
    throw new DevicePassportLifecycleError("future_signed_state_forbidden_in_production");
  }
  const allowed = PASSPORT_ALLOWED.get(from);
  if (allowed === undefined || !allowed.has(to)) {
    throw new DevicePassportLifecycleError("forbidden_passport_transition");
  }
}
