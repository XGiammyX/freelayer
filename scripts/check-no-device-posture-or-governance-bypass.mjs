// DevicePosture + room-governance bypass guard (TECH-22, docs/SOVEREIGN_ROOMS.md).
//
// Secure Device is a SEPARATE project. FreeLayer core must never: elevate device
// posture from untrusted input, integrate a provider, treat posture as identity/
// authority, mutate room policy directly, loosen room policy, lower minimum
// posture, claim active ScreenShield, persist posture, or import device-
// management/attestation/anti-spyware code. Governance is tighten-only. Static
// token scan; AST global bans live in the other guards.
//
// Usage: node scripts/check-no-device-posture-or-governance-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Posture elevation / provider integration in production code.
  "providerIntegrated: true",
  "trustedForElevation: true",
  'effectivePosture: "hardened"',
  'effectivePosture: "high_assurance"',
  'effectivePosture: "managed_bunker"',
  'effectivePosture: "basic"',
  "elevatePosture",
  "elevateDevicePosture",
  // Posture as identity / authority / membership.
  "postureAsIdentity",
  "postureGrantsMembership",
  "postureGrantsAuthority",
  "postureAuthorizes",
  // Endpoint state granting authority + active protection claims.
  "endpointGrantsAccess",
  "endpointRestoresAccess",
  "activeProtectionClaim: true",
  "screenShieldActive: true",
  "screenShieldEnabled: true",
  // Room-policy direct mutation / loosening / posture lowering.
  ".policyDocument.metadata.",
  "loosenRoomPolicy",
  "lowerMinimumDevicePosture",
  "lowerRoomSensitivity",
  "weakenProtectedContent",
  "room.policy.loosen",
  "enableForbiddenFeature",
  // Posture persistence / telemetry.
  "persistDevicePosture",
  "devicePostureCache",
  "postureHistory",
  "reportDevicePosture",
  // Device management / attestation / anti-spyware imports.
  '"react-native-device-info"',
  "PlayIntegrity",
  "play-integrity",
  "SafetyNet",
  "DevicePolicyManager",
  "DeviceOwner",
  "deviceAttestation",
  "hardwareAttestation",
  "antiSpyware",
  "spywareScanner",
  "stalkerware",
  "grapheneOsManager",
  "customRom",
];

// Caller/UI-controlled trusted posture as an object property.
const TRUSTED_POSTURE_RE =
  /source\s*:\s*["']secure_device_future_provider["'][\s\S]{0,40}providerIntegration\s*:\s*["']integrated_future["']/;

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".mjs"];
const APPROVED = ["packages/rooms/src/policy-composition/"];

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith("check-no-device-posture-or-governance-bypass.mjs") ||
    // The Policy Matrix legitimately names denied operations (data).
    rel.endsWith("packages/privacy/src/policyMatrix.ts") ||
    // Type definitions legitimately declare the (future) enum literals.
    rel.endsWith("policy-composition/device-posture.ts") ||
    rel.endsWith("policy-composition/protected-content.ts")
  );
}

const args = process.argv.slice(2);
const scanDirs = args.length > 0 && !args[0].startsWith("--") ? args : DEFAULT_DIRS;

const root = repoRoot();
const violations = [];

for (const dir of scanDirs) {
  for (const file of walkFiles(join(root, dir), EXTS)) {
    const rel = repoRelative(root, file);
    if (isAllowlisted(rel)) continue;
    const inApproved = APPROVED.some((p) => rel.includes(p));
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — posture/governance bypass pattern "${token}" ` +
              "(Secure Device is external; posture cannot elevate/grant; governance is tighten-only — docs/SOVEREIGN_ROOMS.md)",
          );
        }
      }
    });
    // Cross-line trusted-posture-elevation construction outside approved modules.
    if (!inApproved) {
      const joined = lines.join("\n");
      if (TRUSTED_POSTURE_RE.test(joined)) {
        violations.push(
          `${rel} — constructs an integrated/trusted device-posture signal outside the approved contract ` +
            "(no provider is integrated in core — docs/ENDPOINT_DEFENSE_MODEL.md)",
        );
      }
    }
  }
}

report("check:no-device-posture-or-governance-bypass", violations);
