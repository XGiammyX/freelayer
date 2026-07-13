// FIXTURE (not shipped): representative Secure Device core-implementation
// violations the check:no-secure-device-core-implementation guardrail must
// catch. Never imported. Secure Device is a SEPARATE project.
/* eslint-disable */
// @ts-nocheck

import deviceInfo from "react-native-device-info";
import { PlayIntegrity } from "play-integrity";

export function bad(provider, assessment) {
  // Raw evidence / measurement parsing.
  const ev = parseEvidence(assessment);
  verifyAttestation(ev);
  readMeasurementLog();
  // Device identifiers / fingerprints.
  const serial = getSerialNumber();
  const imei = getImei();
  const fp = readBuildFingerprint();
  // App inventory scanning.
  const apps = getInstalledApps();
  enumeratePackages();
  // Endpoint monitoring.
  new AccessibilityService();
  const cap = new MediaProjection();
  const clip = new ClipboardManager();
  getRunningAppProcesses();
  // MDM / attestation.
  const dpm = new DevicePolicyManager();
  keyAttestation();
  // GrapheneOS / ROM / firewall.
  installGrapheneOs();
  flashCustomRom();
  // Trusted-posture construction in core.
  const forged = { effectivePosture: "high_assurance", trustedForElevation: true };
  const status = { canAssessPosture: true, lifecycle: "ready_future" };
  // Production mock provider.
  const mock = new AndroidSecureDeviceProvider();
  // Assessment persistence / history.
  persistDevicePostureAssessment(assessment);
  storeAssessmentHistory(assessment);
  // Active protection claims.
  const claim = { activeProtectionClaim: true, screenShieldActive: true };
  // Provider network call.
  fetch("https://example.com/posture?assessment=" + assessment);
  return { ev, serial, imei, fp, apps, cap, clip, dpm, forged, status, mock, claim };
}
