// Identity scaffolding bypass guard (TECH-ID-03, docs/adr/ADR-0013-identity-firewall-architecture.md).
//
// TECH-ID-03 identity is LOCAL, NON-CRYPTOGRAPHIC, metadata-only scaffolding.
// Two scopes: (1) IDENTITY-SCOPED bans apply to the shipped identity package
// (records must carry no key/seed/recovery material, no phone/email/public
// username, no caller-controlled trust, no in-place mutation, no persistent
// storage/network, no raw logging); (2) GLOBAL bans apply repo-wide (no DID
// deps/resolution, no ambient/global identity singleton, no generic identity
// patch, no posture-grants-identity). Static token scan; AST-precise bans live
// in tests. A dir argument (fixtures/CI) is scanned with BOTH sets.
//
// Usage: node scripts/check-no-identity-scaffolding-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

// Applies only inside the identity package (+ explicit dir args). Colon-suffixed
// property forms so unrelated words in prose/other domains do not match.
const IDENTITY_SCOPED = [
  "privateKey:",
  "publicKey:",
  "secretKey:",
  "seedPhrase:",
  "mnemonic:",
  "recoveryPhrase:",
  "recoveryKey:",
  "keyBytes:",
  "signatureBytes:",
  "devicePrivateKey:",
  "deviceKeyBytes:",
  "devicePassportSignature:",
  "phoneNumber:",
  "emailAddress:",
  "publicHandle:",
  "verified: true",
  "trusted: true",
  "authenticated: true",
  "isOwner: true",
  "isAdmin: true",
  ".roots.push(",
  ".personas.push(",
  ".relationships.push(",
  ".roomBindings.push(",
  "localStorage.",
  "sessionStorage.",
  "indexedDB.",
  "screenShieldActive: true",
];

// Applies repo-wide — unambiguous identity-bypass markers.
const GLOBAL_FORBIDDEN = [
  '"did-jwt"',
  '"did-resolver"',
  '"@digitalbazaar/',
  '"@veramo/',
  "resolveDid(",
  "currentIdentity",
  "globalIdentity",
  "ambientIdentity",
  "defaultPersona",
  '"identity.patch"',
  '"identity.update_any"',
  '"identity.set_property"',
  '"identity.merge_record"',
  "devicePostureVerifiesIdentity",
  "postureGrantsIdentity",
];

const IDENTITY_NETWORK_RE =
  /(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\([^)]*(identity|persona|relationship|vault|root)/i;
const IDENTITY_LOG_RE = /console\.\w+\([^)]*(identity|persona|relationship|vault|root)/i;

const DEFAULT_DIRS = ["apps", "packages"];
const IDENTITY_DIR = "packages/identity/";
const EXTS = [".ts", ".tsx", ".mjs"];

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith("check-no-identity-scaffolding-bypass.mjs") ||
    // The command validator legitimately LISTS forbidden field names as data.
    rel.endsWith("packages/identity/src/identity-validation.ts") ||
    // The Policy Matrix legitimately names identity operations (data).
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
    // Identity-scoped bans apply inside the identity package or any explicit arg.
    const identityScoped = explicit || rel.includes(IDENTITY_DIR);
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of GLOBAL_FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — identity bypass pattern "${token}" (ADR-0013; identity is local, non-cryptographic scaffolding)`,
          );
        }
      }
      if (identityScoped) {
        for (const token of IDENTITY_SCOPED) {
          if (line.includes(token)) {
            violations.push(
              `${rel}:${index + 1} — identity-scaffolding bypass pattern "${token}" (TECH-ID-03 identity is metadata-only — ADR-0013)`,
            );
          }
        }
        if (IDENTITY_NETWORK_RE.test(line)) {
          violations.push(`${rel}:${index + 1} — identity scaffolding must make no network calls`);
        }
        if (IDENTITY_LOG_RE.test(line)) {
          violations.push(`${rel}:${index + 1} — raw identity object logging is forbidden`);
        }
      }
    });
  }
}

report("check:no-identity-scaffolding-bypass", violations);
