// Device Passport bypass guard (TECH-ID-08, docs/adr/ADR-0013-identity-firewall-architecture.md).
//
// A Device Passport draft / local approval is LOCAL, NON-CRYPTOGRAPHIC and grants
// NO operational device authority — it is not a signature, not verified, not
// attestation, not DevicePosture, not identity. This guard forbids (in shipped
// code): real key/signature/crypto in the passport module; a passport marked
// generically valid/trusted/verified/issued/accepted; a local approval granting
// operational authority; second-device activation/linking; root-secret or
// history transfer; QR/network/serialization; hardware identifiers or attestation
// as passport authority; DevicePosture/RoomOS role used to approve; scope/
// capability widening; wildcard/delegation/recovery authority; construction of
// future signed/verified lifecycle states; a persistent passport registry/history;
// remote/global revocation claims; active ScreenShield/managed-Bunker; and generic
// passport patch commands. Targets implementation tokens, not prose.
//
// Usage: node scripts/check-no-device-passport-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Passport marked generically valid/trusted/verified/active/issued/accepted.
  "passportValid: true",
  "passportTrusted: true",
  "passportVerified: true",
  "passportActive: true",
  "cryptographicallyIssued: true",
  "cryptographicallyVerified: true",
  "remotelyAccepted: true",
  // Future signed/verified lifecycle states constructed in production.
  'lifecycle: "issued_future_signed"',
  'lifecycle: "accepted_future_verified"',
  // Local approval granting operational authority.
  "operationalAuthorityGranted",
  "grantsOperationalAuthority: true",
  "approvalActivatesDevice",
  'operationalAuthority: "granted"',
  // Second active device / linking.
  "activateLinkedDevice",
  "createSecondActiveDevice",
  "linkDeviceNow",
  // Root-secret / history transfer.
  "rootSecretTransferAllowed: true",
  "historyTransferIncluded: true",
  "transferRootSecret",
  "transferHistory",
  // QR / serialization / wire transport.
  "encodePassportQr",
  "scanPassportQr",
  "serializePassportWire",
  "passportToQr",
  // Attestation / DevicePosture as passport authority.
  "devicePostureClaimIncluded: true",
  "attestationClaimIncluded: true",
  "postureAuthorizesPassport",
  "attestationAuthorizesPassport",
  // RoomOS role as approver.
  "roomRoleApprovesPassport",
  "membershipApprovesPassport",
  // Scope/capability widening + wildcard + delegation + recovery.
  "widenPassportScope",
  "delegationAllowed: true",
  "recoveryAuthorityGranted: true",
  "wildcardCapability",
  // Persistent registry / history + remote/global revocation.
  "persistPassportRegistry",
  "passportRegistryStore",
  "persistPassportHistory",
  "remotePassportRevoke",
  "globalPassportRevocation",
  "cryptographicRevocationPerformed: true",
  // Active ScreenShield / managed Bunker.
  "screenShieldActive: true",
  "managedBunkerPassport",
  // Generic passport patch.
  '"identity.device_passport.patch"',
  '"identity.device_passport.update_any"',
  "passportSetProperty(",
  // Direct persistent storage.
  "localStorage.",
  "sessionStorage.",
  "indexedDB.",
];

// Passport-module-only: crypto, QR/camera, raw claim/passport logging, network.
const PASSPORT_CRYPTO_RE =
  /\b(crypto\.subtle|webcrypto|generateKeyPair|createSign|createVerify|createCipher|createHash|randomBytes|getRandomValues)\b|from ["']node:crypto["']|require\(["']crypto["']\)/;
const PASSPORT_QR_RE = /\b(getUserMedia|BarcodeDetector|jsQR|qrcode|QRCode)\b/;
const PASSPORT_LOG_RE = /console\.\w+\([^)]*(claim|passport|request|scope|challenge)/i;
const PASSPORT_NETWORK_RE = /(fetch|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection)\s*\(/;

const DEFAULT_DIRS = ["apps", "packages"];
const PASSPORT_DIR = "packages/identity/src/device-passports/";
const EXTS = [".ts", ".tsx", ".mjs"];

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith("check-no-device-passport-bypass.mjs") ||
    // The validator legitimately LISTS rejected field names.
    rel.endsWith("packages/identity/src/device-passports/passport-validation.ts") ||
    // Types + lifecycle legitimately DECLARE the future-signed lifecycle literals.
    rel.endsWith("packages/identity/src/device-passports/passport-types.ts") ||
    rel.endsWith("packages/identity/src/device-passports/passport-lifecycle.ts") ||
    // Commands legitimately LIST the future-gated/forbidden command names (data).
    rel.endsWith("packages/identity/src/device-passports/passport-commands.ts") ||
    // The Policy Matrix legitimately names denied passport operations (data).
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
    const inPassport = explicit || rel.includes(PASSPORT_DIR);
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — device-passport bypass pattern "${token}" (ADR-0013; a local unsigned approval is not a signature and grants no operational device authority)`,
          );
        }
      }
      if (
        inPassport &&
        (PASSPORT_CRYPTO_RE.test(line) ||
          PASSPORT_QR_RE.test(line) ||
          PASSPORT_LOG_RE.test(line) ||
          PASSPORT_NETWORK_RE.test(line))
      ) {
        violations.push(
          `${rel}:${index + 1} — device-passport code must not use crypto, encode/scan QR, log raw claims, or make network calls`,
        );
      }
    });
  }
}

report("check:no-device-passport-bypass", violations);
