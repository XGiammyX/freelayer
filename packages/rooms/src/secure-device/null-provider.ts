/**
 * The Null Secure Device provider (TECH-23) — the ONLY provider that ships in
 * core. It performs NO storage/network/native calls, retains NO history,
 * exposes NO device data, reports `not_integrated`, returns effective
 * `unverified`, marks every capability unavailable/future-gated, is fully
 * deterministic, and NEVER claims trusted elevation. There is no GrapheneOS/
 * Pixel/Android/Tauri/MDM/attestation/production-mock provider anywhere.
 */

import {
  buildProductionProviderStatusV1,
  NOT_INTEGRATED_CAPABILITIES,
  type SecureDeviceCapabilitiesV1,
  type SecureDeviceProviderPortV1,
  type SecureDeviceProviderStatusV1,
} from "./secure-device-provider";
import { noProviderAssessmentV1, type DevicePostureAssessmentV1 } from "./posture-assessment";

const NULL_STATUS: SecureDeviceProviderStatusV1 = buildProductionProviderStatusV1(
  "not_integrated",
  "null_provider_not_integrated",
);

/**
 * Deterministic, side-effect-free Null provider. Every call returns a value
 * consistent with "no Secure Device integration exists". `currentAssessment()`
 * mints a fresh transient `unverified` assessment (registered for provenance);
 * it is never stored.
 */
export class NullSecureDeviceProviderV1 implements SecureDeviceProviderPortV1 {
  readonly contractVersion = 1 as const;

  status(): SecureDeviceProviderStatusV1 {
    return NULL_STATUS;
  }

  capabilities(): SecureDeviceCapabilitiesV1 {
    return NOT_INTEGRATED_CAPABILITIES;
  }

  currentAssessment(): DevicePostureAssessmentV1 {
    return noProviderAssessmentV1();
  }
}

/** Shared singleton — the Null provider is stateless, so one instance suffices. */
export const NULL_SECURE_DEVICE_PROVIDER: SecureDeviceProviderPortV1 =
  new NullSecureDeviceProviderV1();
