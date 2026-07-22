// Ephemeral identity bypass guard (TECH-ID-04, docs/adr/ADR-0013-identity-firewall-architecture.md).
//
// An ephemeral identity is an INDEPENDENT current-process root context: no
// promotion to long-lived, no parent/long-lived link, no recovery, no
// persistence, no export/serialization, no synchronization, no lifetime
// extension, no background-timer enforcement, no global/ambient current
// ephemeral identity, no reused long-lived persona/contact/trust, no caller
// anonymous/unlinkable/verified, no crypto/key fields, no DevicePosture-as-
// identity, no active ScreenShield, and no "forensic/secure erase" / "remote
// delete" GUARANTEE claim in shipped code. Static token scan; the guard targets
// implementation tokens (colon-suffixed props / call identifiers), not the
// structural `: forbidden` / `: false` markers or prose.
//
// Usage: node scripts/check-no-ephemeral-identity-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Boolean-only model / parent link.
  "ephemeral: true",
  "parentRootId:",
  "longLivedRootId:",
  "parentRoot:",
  // Promotion / conversion.
  "promoteToLongLived",
  "promoteEphemeral",
  "convertToLongLived",
  "convertEphemeral",
  // Recovery / export / synchronization / extension implementations.
  "enableRecovery(",
  "recoveryPhrase:",
  "recoveryKey:",
  "exportEphemeral",
  "serializeEphemeralIdentity",
  "synchronizeEphemeral",
  "syncEphemeral(",
  "extendLifetime(",
  "extendEphemeralLifetime",
  // Background timer treated as enforcement (inside the ephemeral module).
  "setInterval(",
  "setTimeout(",
  // Global / ambient current ephemeral identity.
  "currentEphemeralIdentity",
  "globalEphemeralIdentity",
  "defaultEphemeralRoot",
  "ambientEphemeral",
  // Caller-controlled anonymity/trust claims.
  "anonymous: true",
  "unlinkable: true",
  "verified: true",
  // Crypto / key material as record properties.
  "privateKey:",
  "publicKey:",
  "keyBytes:",
  "seedPhrase:",
  // DevicePosture-as-identity / active ScreenShield.
  "postureGrantsEphemeral",
  "devicePostureAsIdentity",
  "screenShieldActive: true",
  // Erasure / remote-delete GUARANTEE claims.
  "forensicErasureGuaranteed: true",
  "guaranteedErasure",
  "secureErase(",
  "remoteDelete(",
  // Persistent storage adapters.
  "localStorage.",
  "sessionStorage.",
  "indexedDB.",
];

// Network + raw-logging with ephemeral identifiers (inside the ephemeral module).
const EPHEMERAL_NETWORK_RE =
  /(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\([^)]*(ephemeral|identity|root|persona)/i;

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".mjs"];

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith("check-no-ephemeral-identity-bypass.mjs") ||
    // Validator/error modules legitimately LIST rejected field names / codes.
    rel.endsWith("packages/identity/src/ephemeral/ephemeral-validation.ts") ||
    rel.endsWith("packages/identity/src/ephemeral/ephemeral-errors.ts") ||
    // The Policy Matrix legitimately names denied ephemeral operations (data).
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
    const inEphemeral = explicit || rel.includes("packages/identity/src/ephemeral/");
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        // `setInterval`/`setTimeout` are only banned inside the ephemeral module.
        if ((token === "setInterval(" || token === "setTimeout(") && !inEphemeral) continue;
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — ephemeral-identity bypass pattern "${token}" (ADR-0013; ephemeral identity is independent, current-process, non-recoverable)`,
          );
        }
      }
      if (inEphemeral && EPHEMERAL_NETWORK_RE.test(line)) {
        violations.push(`${rel}:${index + 1} — ephemeral identity must make no network calls`);
      }
    });
  }
}

report("check:no-ephemeral-identity-bypass", violations);
