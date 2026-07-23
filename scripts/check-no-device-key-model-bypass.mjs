// Device-key-model bypass guard (TECH-ID-07, docs/adr/ADR-0013-identity-firewall-architecture.md).
//
// The device-key model is LOCAL, NON-CRYPTOGRAPHIC, root-subordinate device
// AUTHORIZATION metadata — never a key, never a cryptographic proof, never
// identity, never DevicePosture, never a hardware identifier. This guard forbids
// (in shipped code): key bytes / crypto in the devices module; hardware/OS
// identifiers; DevicePosture or a RoomOS role used as device authorization;
// generic trusted/verified/primary-device booleans; a global current-device
// singleton; wildcard/admin/superuser scopes; cross-purpose key reuse; scope
// widening; second-device creation / linking / passport before TECH-ID-08;
// remote or global revocation claims; a persistent device registry/history; raw
// label logging; active attestation / ScreenShield / managed-Bunker claims; and
// generic device patch commands. Targets implementation tokens, not prose.
//
// Usage: node scripts/check-no-device-key-model-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // DevicePosture / RoomOS role used as device authority.
  "postureAuthorizesDevice",
  "postureGrantsDevice",
  "devicePostureAsAuthority",
  "deviceGrantsIdentity",
  "roomRoleAuthorizesDevice",
  "membershipAuthorizesDevice",
  "roleGrantsDevice",
  // Generic trusted / verified / primary device booleans.
  "trustedDevice: true",
  "verifiedDevice: true",
  "primaryDevice: true",
  "isPrimaryDevice: true",
  // Global current-device singleton.
  "currentDeviceSingleton",
  "globalCurrentDevice",
  "getCurrentDevice(",
  // Wildcard / admin / superuser scopes.
  "wildcardScope",
  "adminScope",
  "superuserScope",
  'kind: "*"',
  // Cross-purpose key reuse + scope widening.
  "reuseKeyAcrossPurposes",
  "sharedKeyForAllPurposes",
  'keyReuseAcrossPurposes: "allowed"',
  "widenScope",
  "expandDeviceScope",
  // Second device / linking / passport / attestation before TECH-ID-08.
  "addSecondDevice",
  "linkDevice(",
  "approveDeviceQr(",
  "issueDevicePassport(",
  "verifyDeviceAttestation(",
  "copyRootSecret",
  "devicePassportVerified: true",
  "devicePassportIssued: true",
  // Remote / global / cryptographic revocation claims.
  "remoteDeviceRevoke(",
  "globalDeviceRevocation",
  "remotelyRevoked: true",
  "cryptographicRevocationPerformed: true",
  "messageKeysRotated: true",
  "roomKeysRotated: true",
  "deviceDataErased: true",
  // Persistent device registry / history.
  "persistDeviceRegistry",
  "deviceRegistryStore",
  "persistDeviceHistory",
  "deviceHistoryLog",
  // Active attestation / ScreenShield / managed Bunker.
  "hardwareAttested: true",
  "attestationVerified: true",
  "postureVerified: true",
  "screenShieldActive: true",
  "managedBunkerDevice",
  // Hardware identifiers (as record props).
  "hardwareId:",
  "serialNumber:",
  "advertisingId:",
  "macAddress:",
  "imei:",
  // Generic device patch.
  '"identity.device.patch"',
  '"identity.device.update_any"',
  "deviceSetProperty(",
  // Direct persistent storage.
  "localStorage.",
  "sessionStorage.",
  "indexedDB.",
];

// Devices-module-only: crypto, hardware probing, raw label/device logging, network.
const DEVICE_CRYPTO_RE =
  /\b(crypto\.subtle|webcrypto|generateKeyPair|createSign|createCipher|createHash|randomBytes|getRandomValues)\b|from ["']node:crypto["']|require\(["']crypto["']\)/;
const DEVICE_HARDWARE_RE =
  /\b(navigator\.(userAgent|platform)|os\.(hostname|platform)|getSerialNumber|getDeviceId|getAdvertisingId)\b/;
const DEVICE_LOG_RE = /console\.\w+\([^)]*(label|deviceRef|device)/i;
const DEVICE_NETWORK_RE = /(fetch|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection)\s*\(/;

const DEFAULT_DIRS = ["apps", "packages"];
const DEVICE_DIR = "packages/identity/src/devices/";
const EXTS = [".ts", ".tsx", ".mjs"];

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith("check-no-device-key-model-bypass.mjs") ||
    // The validator legitimately LISTS rejected field names (key/hardware/posture).
    rel.endsWith("packages/identity/src/devices/device-validation.ts") ||
    // The Policy Matrix legitimately names denied device operations (data).
    rel.endsWith("packages/privacy/src/policyMatrix.ts")
  );
}

const args = process.argv.slice(2);
const explicit = args.length > 0 && !args[0].startsWith("--");
const scanDirs = explicit ? args : DEFAULT_DIRS;

const root = repoRoot();
const violations = [];

for (const dir of scanDirs) {
  for (const file of walkFiles(join(root, dir), EXTS)) {
    const rel = repoRelative(root, file);
    if (isAllowlisted(rel)) continue;
    const inDevice = explicit || rel.includes(DEVICE_DIR);
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — device-key-model bypass pattern "${token}" (ADR-0013; a device authorization is local, non-cryptographic metadata, never a key/proof/identity/posture)`,
          );
        }
      }
      if (
        inDevice &&
        (DEVICE_CRYPTO_RE.test(line) ||
          DEVICE_HARDWARE_RE.test(line) ||
          DEVICE_LOG_RE.test(line) ||
          DEVICE_NETWORK_RE.test(line))
      ) {
        violations.push(
          `${rel}:${index + 1} — device-key-model code must not use crypto, probe hardware, log raw device labels, or make network calls`,
        );
      }
    });
  }
}

report("check:no-device-key-model-bypass", violations);
