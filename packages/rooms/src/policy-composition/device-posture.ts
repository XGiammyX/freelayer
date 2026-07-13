/**
 * DevicePosture signal contract + fail-closed effective resolution (TECH-22).
 *
 * Secure Device is a SEPARATE project. FreeLayer core defines only the CONTRACT
 * and conservative behavior: no provider is integrated, so no `basic`/
 * `hardened`/`high_assurance`/`managed_bunker` posture can be verified here.
 *
 *   An untrusted signal may reduce trust (→ at_risk) but may NEVER increase it.
 *   Caller/UI claims of a higher posture are ignored and reduced to unverified.
 *   `at_risk` always overrides higher claims. Unknown/missing fail closed.
 *
 * DevicePosture is an ENVIRONMENT attribute — never identity, never authority.
 */

export type DevicePosture =
  "unverified" | "basic" | "hardened" | "high_assurance" | "managed_bunker" | "at_risk";

export const DEVICE_POSTURES: readonly DevicePosture[] = [
  "unverified",
  "basic",
  "hardened",
  "high_assurance",
  "managed_bunker",
  "at_risk",
];

export type DevicePostureSignalSourceV1 =
  "none" | "untrusted_local" | "secure_device_future_provider";

export interface DevicePostureSignalV1 {
  readonly schemaVersion: 1;
  readonly reportedPosture: DevicePosture;
  readonly source: DevicePostureSignalSourceV1;
  readonly providerIntegration: "not_integrated" | "future_gate" | "integrated_future";
  readonly signalRevision: number;
  readonly observedAtLocal?: string;
  readonly expiresAtLocal?: string;
}

export interface EffectiveDevicePostureV1 {
  readonly schemaVersion: 1;
  readonly reportedPosture: DevicePosture;
  readonly effectivePosture: DevicePosture;
  readonly trustedForElevation: false;
  readonly mayOnlyTighten: true;
  readonly providerIntegrated: false;
  readonly signalRevision: number;
  readonly reasonCode: string;
}

function unverifiedResult(
  signal: DevicePostureSignalV1 | undefined,
  reasonCode: string,
): EffectiveDevicePostureV1 {
  return {
    schemaVersion: 1,
    reportedPosture: signal?.reportedPosture ?? "unverified",
    effectivePosture: "unverified",
    trustedForElevation: false,
    mayOnlyTighten: true,
    providerIntegrated: false,
    signalRevision:
      typeof signal?.signalRevision === "number" && Number.isSafeInteger(signal.signalRevision)
        ? signal.signalRevision
        : 0,
    reasonCode,
  };
}

/**
 * Resolve the effective posture. NO provider is integrated in core, so the only
 * outcomes are `unverified` (default) or `at_risk` (untrusted tightening). A
 * signal can never elevate — a reported higher posture is reduced to unverified.
 */
export function resolveEffectiveDevicePostureV1(
  signal?: DevicePostureSignalV1,
): EffectiveDevicePostureV1 {
  if (signal === undefined) return unverifiedResult(undefined, "no_signal");

  // Malformed → fail closed to unverified (never deny access here; composition
  // decides — but posture itself can only ever be unverified/at_risk).
  if (
    signal.schemaVersion !== 1 ||
    !DEVICE_POSTURES.includes(signal.reportedPosture) ||
    typeof signal.signalRevision !== "number" ||
    !Number.isSafeInteger(signal.signalRevision) ||
    signal.signalRevision < 0
  ) {
    return unverifiedResult(signal, "malformed_signal");
  }

  // at_risk ALWAYS tightens, regardless of source (a device can report itself unsafe).
  if (signal.reportedPosture === "at_risk") {
    return {
      schemaVersion: 1,
      reportedPosture: "at_risk",
      effectivePosture: "at_risk",
      trustedForElevation: false,
      mayOnlyTighten: true,
      providerIntegrated: false,
      signalRevision: signal.signalRevision,
      reasonCode: "at_risk_tighten",
    };
  }

  // Any elevation claim is ignored — no provider is integrated, and even a
  // "secure_device_future_provider" source is not trusted for elevation in core.
  if (signal.reportedPosture !== "unverified") {
    return unverifiedResult(signal, "elevation_ignored_no_provider");
  }

  return unverifiedResult(signal, "unverified");
}

// ---------------------------------------------------------------------------
// Minimum-posture ordering (explicit; never lexical)
// ---------------------------------------------------------------------------

export type MinimumDevicePostureV1 =
  "unverified" | "basic" | "hardened" | "high_assurance" | "managed_bunker";

export const MINIMUM_DEVICE_POSTURES: readonly MinimumDevicePostureV1[] = [
  "unverified",
  "basic",
  "hardened",
  "high_assurance",
  "managed_bunker",
];

// Explicit rank for the SATISFYING (effective) side. `at_risk` satisfies
// nothing; unverified satisfies only unverified. Because no provider exists,
// core can only ever produce `unverified` — so anything above it is unmet.
const EFFECTIVE_RANK: Readonly<Record<DevicePosture, number>> = {
  at_risk: -1,
  unverified: 0,
  basic: 1,
  hardened: 2,
  high_assurance: 3,
  managed_bunker: 4,
};
const REQUIRED_RANK: Readonly<Record<MinimumDevicePostureV1, number>> = {
  unverified: 0,
  basic: 1,
  hardened: 2,
  high_assurance: 3,
  managed_bunker: 4,
};

export function devicePostureSatisfiesMinimumV1(input: {
  effective: DevicePosture;
  required: MinimumDevicePostureV1;
}): boolean {
  const e = EFFECTIVE_RANK[input.effective];
  const r = REQUIRED_RANK[input.required];
  // Unknown value → deny (fail closed).
  if (e === undefined || r === undefined) return false;
  // at_risk satisfies nothing.
  if (input.effective === "at_risk") return false;
  return e >= r;
}
