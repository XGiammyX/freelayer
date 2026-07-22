// Per-contact alias bypass guard (TECH-ID-05, docs/adr/ADR-0013-identity-firewall-architecture.md).
//
// A per-contact alias is LOCAL, relationship-scoped presentation metadata — NOT
// identity, verification, authentication, a public username, or a cryptographic
// identifier. This guard forbids (in shipped code): alias/profile/display-name
// used as authority; `verified` derived from an alias; global/public username or
// searchable directory / alias lookup; phone/email discovery; a root id exposed
// as an alias; alias copied/transferred across relationships or used to merge
// contacts; a local peer label shared remotely; network alias exchange;
// persistent alias history; direct browser/DB storage; cryptographic alias /
// authentication / signature; a full-Unicode-spoofing-prevention claim; active
// ScreenShield; raw alias logging; and generic alias/profile patch commands.
// Targets implementation tokens (colon props / call identifiers), not prose.
//
// Usage: node scripts/check-no-contact-alias-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Alias-as-authority / alias-as-verification.
  "aliasVerified: true",
  "verifiedByAlias",
  "aliasGrantsAccess",
  "aliasIsAuthority",
  "trustFromAlias",
  // Global/public username + directory + search + lookup.
  "globalUsername:",
  "publicUsername",
  "usernameDirectory",
  "aliasDirectory",
  "searchAlias(",
  "lookupAlias(",
  "usernameSearch(",
  "findByAlias(",
  "aliasAvailabilityService",
  // Phone/email discovery.
  "discoverByPhone",
  "discoverByEmail",
  // Root id exposed as alias.
  "rootIdAsAlias",
  "exposeRootIdAsAlias",
  // Alias transfer / cross-relationship copy / contact merge.
  "transferAlias",
  "moveAliasToRelationship",
  "copyAliasAcrossRelationships",
  "mergeContactsByAlias",
  "mergeByAlias",
  // Local peer label shared remotely / remote alias exchange.
  "shareLocalPeerLabel",
  "peerShared: true",
  "exchangeAlias(",
  "sendAliasToPeer",
  "remoteAliasUpdate(",
  // Persistent alias history.
  "persistAliasHistory",
  "aliasHistoryStore",
  "aliasHistoryLog",
  // Cryptographic alias / authentication / signature.
  "signAlias(",
  "aliasSignature:",
  "authenticateAlias(",
  // Full-Unicode-spoofing-prevention claim.
  "spoofProof",
  "noSpoofingPossible",
  "fullConfusableDetection",
  "confusableDetectionComplete",
  // Active ScreenShield.
  "screenShieldActive: true",
  // Generic alias/profile patch.
  '"identity.alias.patch"',
  '"identity.alias.update_any"',
  "aliasSetProperty(",
  // Direct persistent storage.
  "localStorage.",
  "sessionStorage.",
  "indexedDB.",
];

// Raw alias/label logging + network with alias identifiers (inside the module).
const ALIAS_LOG_RE = /console\.\w+\([^)]*(alias|label|displayText|labelText)/i;
const ALIAS_NETWORK_RE = /(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\([^)]*(alias|label)/i;

const DEFAULT_DIRS = ["apps", "packages"];
const ALIAS_DIR = "packages/identity/src/aliases/";
const EXTS = [".ts", ".tsx", ".mjs"];

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith("check-no-contact-alias-bypass.mjs") ||
    // The validator legitimately LISTS rejected field names (verified/public/…).
    rel.endsWith("packages/identity/src/aliases/alias-validation.ts") ||
    // The Policy Matrix legitimately names denied alias operations (data).
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
    const inAlias = explicit || rel.includes(ALIAS_DIR);
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — contact-alias bypass pattern "${token}" (ADR-0013; an alias is local presentation, never identity/verification)`,
          );
        }
      }
      if (inAlias && (ALIAS_LOG_RE.test(line) || ALIAS_NETWORK_RE.test(line))) {
        violations.push(
          `${rel}:${index + 1} — alias code must not log raw alias text or make network calls`,
        );
      }
    });
  }
}

report("check:no-contact-alias-bypass", violations);
