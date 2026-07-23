/**
 * Device authorization lifecycle (TECH-ID-07). Explicit + exhaustive; unknown
 * transitions deny; the revoked tombstone is terminal. `restricted_local ->
 * active_local_unverified` is a FUTURE explicit reviewed flow and is NOT reachable
 * in TECH-ID-07 (fail-closed). Re-restriction (restricted -> restricted) is
 * allowed so a device can be narrowed further.
 */

import { DeviceAuthorizationLifecycleError } from "./device-errors";
import type { DeviceAuthorizationLifecycleV1 } from "./device-types";

const ALLOWED: ReadonlyMap<
  DeviceAuthorizationLifecycleV1,
  ReadonlySet<DeviceAuthorizationLifecycleV1>
> = new Map([
  [
    "draft_local",
    new Set<DeviceAuthorizationLifecycleV1>(["active_local_unverified", "revoked_tombstone"]),
  ],
  [
    "active_local_unverified",
    new Set<DeviceAuthorizationLifecycleV1>([
      "restricted_local",
      "compromised_suspected",
      "revoked_tombstone",
    ]),
  ],
  [
    "restricted_local",
    new Set<DeviceAuthorizationLifecycleV1>([
      "restricted_local",
      "compromised_suspected",
      "revoked_tombstone",
    ]),
  ],
  ["compromised_suspected", new Set<DeviceAuthorizationLifecycleV1>(["revoked_tombstone"])],
  ["revoked_tombstone", new Set<DeviceAuthorizationLifecycleV1>()],
]);

export function assertDeviceAuthorizationTransitionV1(
  from: DeviceAuthorizationLifecycleV1,
  to: DeviceAuthorizationLifecycleV1,
): void {
  const allowed = ALLOWED.get(from);
  if (allowed === undefined || !allowed.has(to)) {
    throw new DeviceAuthorizationLifecycleError("forbidden_transition");
  }
}

/** Lifecycles from which ORDINARY identity/messaging operations are permitted. */
export function isDeviceOperationalLifecycleV1(lifecycle: DeviceAuthorizationLifecycleV1): boolean {
  return lifecycle === "active_local_unverified" || lifecycle === "restricted_local";
}
