/**
 * Secure Device provider lifecycle, status, capabilities, and PORT (TECH-23).
 *
 * The port is the NARROW future boundary through which an external Secure Device
 * adapter could one day supply a normalized posture result. In core today NO
 * provider is integrated: production status may be ONLY `not_integrated`,
 * `unavailable`, or `failed`; capabilities are `unavailable`/`future_gate`; and
 * `trustedForPostureElevation` is structurally `false`. No stable device-
 * identifying field exists. `ready_future`/`degraded_future`/`initializing_future`
 * are declared for the contract but NOT constructible by production factories.
 */

export type SecureDeviceProviderLifecycleV1 =
  | "not_integrated"
  | "unavailable"
  | "initializing_future"
  | "ready_future"
  | "degraded_future"
  | "failed";

export const SECURE_DEVICE_PROVIDER_LIFECYCLES: readonly SecureDeviceProviderLifecycleV1[] = [
  "not_integrated",
  "unavailable",
  "initializing_future",
  "ready_future",
  "degraded_future",
  "failed",
];

/** Lifecycles a PRODUCTION path may construct (no provider integrated). */
export const PRODUCTION_PROVIDER_LIFECYCLES: readonly SecureDeviceProviderLifecycleV1[] = [
  "not_integrated",
  "unavailable",
  "failed",
];

/** Future lifecycles only a real, gated provider could reach (test-only today). */
export const FUTURE_PROVIDER_LIFECYCLES: readonly SecureDeviceProviderLifecycleV1[] = [
  "initializing_future",
  "ready_future",
  "degraded_future",
];

export interface SecureDeviceProviderStatusV1 {
  readonly schemaVersion: 1;
  readonly lifecycle: SecureDeviceProviderLifecycleV1;
  readonly contractVersion: 1;
  readonly canAssessPosture: boolean;
  readonly canProvideProtectedPresentation: boolean;
  readonly canProvideBunkerSession: boolean;
  /** Structural: an untrusted/absent provider is NEVER trusted for elevation. */
  readonly trustedForPostureElevation: false;
  readonly reasonCode: string;
}

export type SecureDeviceCapabilityStateV1 = "unavailable" | "future_gate";

export interface SecureDeviceCapabilitiesV1 {
  readonly schemaVersion: 1;
  readonly postureAssessment: SecureDeviceCapabilityStateV1;
  readonly protectedPresentation: SecureDeviceCapabilityStateV1;
  readonly bunkerSession: SecureDeviceCapabilityStateV1;
  readonly profileIsolationAssessment: SecureDeviceCapabilityStateV1;
  readonly deviceHardeningAssessment: SecureDeviceCapabilityStateV1;
  /** Raw evidence export / device management / telemetry are FORBIDDEN, always. */
  readonly rawEvidenceExport: "forbidden";
  readonly deviceManagement: "forbidden";
  readonly telemetry: "forbidden";
}

/** The only capabilities a core (no-provider) build exposes: nothing available. */
export const NOT_INTEGRATED_CAPABILITIES: SecureDeviceCapabilitiesV1 = {
  schemaVersion: 1,
  postureAssessment: "future_gate",
  protectedPresentation: "future_gate",
  bunkerSession: "future_gate",
  profileIsolationAssessment: "future_gate",
  deviceHardeningAssessment: "future_gate",
  rawEvidenceExport: "forbidden",
  deviceManagement: "forbidden",
  telemetry: "forbidden",
};

/**
 * Build a production provider status. Fail-closed: only `not_integrated`,
 * `unavailable`, and `failed` are allowed. Any attempt to pass a future/ready
 * lifecycle is coerced to `unavailable` (core cannot mint a trusted provider).
 */
export function buildProductionProviderStatusV1(
  lifecycle: SecureDeviceProviderLifecycleV1 = "not_integrated",
  reasonCode = "no_provider_integrated",
): SecureDeviceProviderStatusV1 {
  const safeLifecycle: SecureDeviceProviderLifecycleV1 = PRODUCTION_PROVIDER_LIFECYCLES.includes(
    lifecycle,
  )
    ? lifecycle
    : "unavailable";
  return {
    schemaVersion: 1,
    lifecycle: safeLifecycle,
    contractVersion: 1,
    canAssessPosture: false,
    canProvideProtectedPresentation: false,
    canProvideBunkerSession: false,
    trustedForPostureElevation: false,
    reasonCode: safeLifecycle === lifecycle ? reasonCode : "future_lifecycle_coerced_unavailable",
  };
}

/**
 * True iff a provider status could authorize posture elevation. ALWAYS false in
 * core: `trustedForPostureElevation` is structurally `false`, so no status can
 * ever satisfy it. Kept as a single, testable source of truth for the honest
 * answer rather than scattering the constant.
 */
export function providerTrustedForElevationV1(status: SecureDeviceProviderStatusV1): boolean {
  const trusted: boolean = status.trustedForPostureElevation;
  return trusted && status.lifecycle === "ready_future" && status.canAssessPosture === true;
}

// ---------------------------------------------------------------------------
// Provider PORT (versioned). The external adapter would implement this; core
// ships only the deterministic Null provider (null-provider.ts).
// ---------------------------------------------------------------------------

import type { DevicePostureAssessmentV1 } from "./posture-assessment";

export interface SecureDeviceProviderPortV1 {
  readonly contractVersion: 1;
  status(): SecureDeviceProviderStatusV1;
  capabilities(): SecureDeviceCapabilitiesV1;
  currentAssessment(): DevicePostureAssessmentV1;
}
