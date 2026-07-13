// Secure Device core-boundary guard (TECH-23, docs/ENDPOINT_DEFENSE_MODEL.md).
//
// Secure Device / Endpoint Defense is a SEPARATE project. FreeLayer core defines
// only the CONTRACT (roles, provider port, normalized transient assessment,
// admission, session, ProtectedContent intent). Core must NEVER implement device
// posture MEASUREMENT: no raw attestation/measurement parsing, device serials/
// fingerprints, app inventory scanning, Accessibility/overlay/clipboard/capture/
// process monitoring, MDM/Device Owner, Play Integrity/attestation libs,
// GrapheneOS install/management, custom ROM/phone-firewall, production
// trusted-posture constructors, production mock providers, assessment
// persistence/history, provider network calls, or active ScreenShield/Bunker
// claims. This is a STATIC identifier scan; it targets implementation tokens
// (camelCase APIs / quoted native packages / trusted object literals), not prose.
//
// Usage: node scripts/check-no-secure-device-core-implementation.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Raw attestation / measurement / evidence parsing (external Verifier only).
  "parseEvidence",
  "verifyAttestation",
  "appraiseEvidence",
  "readMeasurementLog",
  "attestationToken:",
  "verifyIntegrityToken",
  // Device serials / fingerprints / hardware identifiers.
  "getSerialNumber",
  "getImei",
  "getAndroidId",
  "getHardwareId",
  "readBuildFingerprint",
  "collectDeviceIdentifier",
  // App / package inventory scanning.
  "getInstalledApps",
  "getInstalledPackages",
  "queryIntentActivities",
  "enumeratePackages",
  "scanAppInventory",
  // Accessibility / overlay / clipboard / capture / process monitoring.
  "AccessibilityService",
  "TYPE_APPLICATION_OVERLAY",
  "SYSTEM_ALERT_WINDOW",
  "ClipboardManager",
  "addPrimaryClipChangedListener",
  "MediaProjection",
  "takeScreenshot",
  "getRunningAppProcesses",
  "registerScreenCaptureCallback",
  // MDM / Device Owner.
  "DevicePolicyManager",
  "DeviceAdminReceiver",
  "setDeviceOwner",
  // Play Integrity / attestation libraries.
  "PlayIntegrity",
  "play-integrity",
  "SafetyNet",
  "IntegrityManager",
  "keyAttestation",
  "hardwareAttestation",
  "deviceAttestation",
  // GrapheneOS installation / management, custom ROM, phone-wide firewall.
  "grapheneOsManager",
  "installGrapheneOs",
  "flashCustomRom",
  "phoneWideFirewall",
  // Production trusted-posture constructors (core can never mint elevation).
  'effectivePosture: "basic"',
  'effectivePosture: "hardened"',
  'effectivePosture: "high_assurance"',
  'effectivePosture: "managed_bunker"',
  "trustedForElevation: true",
  "trustedForPostureElevation: true",
  "canAssessPosture: true",
  "canProvideProtectedPresentation: true",
  "canProvideBunkerSession: true",
  'lifecycle: "ready_future"',
  // Production mock / native providers.
  "MockSecureDeviceProvider",
  "FakeSecureDeviceProvider",
  "RealSecureDeviceProvider",
  "AndroidSecureDeviceProvider",
  "GrapheneSecureDeviceProvider",
  "TauriSecureDeviceProvider",
  "IosSecureDeviceProvider",
  // Assessment persistence / history (transient only).
  "persistDevicePostureAssessment",
  "saveDevicePostureAssessment",
  "storeAssessmentHistory",
  "persistAssessmentHistory",
  // Active protection / ScreenShield / Bunker runtime claims.
  "activeProtectionClaim: true",
  "screenShieldActive: true",
  "screenShieldIntegrated: true",
  "protectedSurfaceAvailable: true",
  "bunkerSessionActive: true",
  // Native / attestation dependency specifiers that must not appear in core.
  '"react-native-device-info"',
  '"@react-native-clipboard/clipboard"',
  '"react-native-screenshot-prevent"',
  '"expo-screen-capture"',
];

// Provider network calls: a Secure Device provider in core must be side-effect
// free. Flag network primitives that appear on the same line as provider/
// assessment identifiers (narrow, to avoid false positives elsewhere).
const PROVIDER_NETWORK_RE =
  /(fetch|XMLHttpRequest|WebSocket|navigator\.sendBeacon)\s*\([^)]*(assessment|posture|provider|secureDevice)/i;

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".mjs"];

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith("check-no-secure-device-core-implementation.mjs") ||
    // The Policy Matrix legitimately names denied Secure Device operations (data).
    rel.endsWith("packages/privacy/src/policyMatrix.ts")
  );
  // NOTE: fixtures live under tests/ and are not scanned by the default
  // apps/packages run; the guard's own regression test scans them explicitly.
}

const args = process.argv.slice(2);
const scanDirs = args.length > 0 && !args[0].startsWith("--") ? args : DEFAULT_DIRS;

const root = repoRoot();
const violations = [];

for (const dir of scanDirs) {
  for (const file of walkFiles(join(root, dir), EXTS)) {
    const rel = repoRelative(root, file);
    if (isAllowlisted(rel)) continue;
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — secure-device core-implementation pattern "${token}" ` +
              "(Secure Device is external; core defines only the contract — docs/ENDPOINT_DEFENSE_MODEL.md)",
          );
        }
      }
      if (PROVIDER_NETWORK_RE.test(line)) {
        violations.push(
          `${rel}:${index + 1} — a Secure Device provider must make no network calls in core ` +
            "(the Null provider is side-effect-free — docs/ENDPOINT_DEFENSE_MODEL.md)",
        );
      }
    });
  }
}

report("check:no-secure-device-core-implementation", violations);
