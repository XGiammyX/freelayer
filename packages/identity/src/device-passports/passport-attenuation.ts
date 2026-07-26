/**
 * Device Passport grant attenuation (TECH-ID-08). Reuses the TECH-ID-07 device
 * scope + capability model. The granted scope may only remain equal or become
 * narrower than BOTH the request and the approver; granted capabilities are the
 * intersection of requested + approver capabilities, minus the structurally
 * unavailable ones. No wildcard, no recursive delegation; `identity.device.
 * add_future` + `identity.recovery.approve_future` are denied by default; cross-
 * root grants reject; read-only can never become writable. Never silently
 * broadens for usability.
 */

import {
  attenuateDeviceAuthorizationScopeV1,
  DEVICE_UNAVAILABLE_CAPABILITIES,
  type DeviceAuthorizationScopeV1,
  type DeviceIdentityCapabilityV1,
} from "../devices";
import {
  DevicePassportCapabilityEscalationError,
  DevicePassportScopeEscalationError,
} from "./passport-errors";
import type { DeviceLinkRequestV1 } from "./passport-link-requests";
import type { DevicePassportApproverContextV1 } from "./passport-types";
import type { DevicePassportPolicyV1 } from "./passport-policy";

export function resolveDevicePassportGrantV1(input: {
  request: DeviceLinkRequestV1;
  approver: DevicePassportApproverContextV1;
  policy: DevicePassportPolicyV1;
}): {
  grantedScope: DeviceAuthorizationScopeV1;
  grantedCapabilities: readonly DeviceIdentityCapabilityV1[];
} {
  // Scope: requested must be equal-or-narrower than the approver's maximum, and
  // same-root. Any widening / cross-root / incomparable transition escalates.
  let grantedScope: DeviceAuthorizationScopeV1;
  try {
    grantedScope = attenuateDeviceAuthorizationScopeV1({
      current: input.approver.maximumScope,
      requested: input.request.requestedScope,
    });
  } catch {
    throw new DevicePassportScopeEscalationError();
  }

  // Capabilities: forbidden (delegation/recovery) reject outright; the rest are
  // the intersection of requested ∩ approver (attenuation-only, dedup).
  for (const c of input.request.requestedCapabilities) {
    if (DEVICE_UNAVAILABLE_CAPABILITIES.includes(c)) {
      throw new DevicePassportCapabilityEscalationError("forbidden_capability");
    }
  }
  const approverSet = new Set(input.approver.maximumCapabilities);
  const seen = new Set<DeviceIdentityCapabilityV1>();
  const grantedCapabilities: DeviceIdentityCapabilityV1[] = [];
  for (const c of input.request.requestedCapabilities) {
    if (approverSet.has(c) && !seen.has(c)) {
      seen.add(c);
      grantedCapabilities.push(c);
    }
  }
  return { grantedScope, grantedCapabilities };
}
