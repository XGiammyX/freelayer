// RoomOS authorization-bypass guard (TECH-21, docs/SOVEREIGN_ROOMS.md).
//
// Authorization must be REVALIDATED against current state + an authentic
// exact-scope PolicyDecision immediately before every protected side effect.
// This guard forbids: capability/allow caches, global allow booleans,
// prepared-context or capability serialization/persistence, localStorage/
// IndexedDB authorization storage, caller-controlled authorization revisions,
// endpoint-risk-grants-access, treating suspended/removed as active, wildcard
// capabilities, automatic owner promotion, and unbacked distributed/crypto
// revocation claims. Static token scan; AST global bans live in the other
// guards.
//
// Usage: node scripts/check-no-room-authorization-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Authorization / capability caches + global allow (authorization-specific).
  "authorizationCache",
  "authAllowCache",
  "capabilityCache",
  "permissionResultCache",
  "rolePermissionCache",
  "globalAllowDecision",
  "currentMemberAuthorization",
  "cachedAuthorizationDecision",
  "lastAllowDecision",
  "memoizeAuthorization",
  // Capability / prepared-context serialization + persistence.
  "serializeCapability",
  "persistCapability",
  "serializePreparedAuthorization",
  "persistPreparedAuthorization",
  "JSON.stringify(prepared",
  "JSON.stringify(capability",
  "JSON.stringify(descriptor",
  // Authorization storage.
  "localStorage",
  "sessionStorage",
  "indexedDB",
  // Caller-controlled authorization revision / endpoint-grants-access.
  "callerRevision",
  "endpointGrantsAccess",
  "endpointRestoresAccess",
  "deviceTrustedGrants",
  "endpointSafe: true",
  // Wildcard / auto-promotion / false distributed-crypto claims.
  'capability: "*"',
  'capabilities: ["*"]',
  "autoPromoteOwner",
  "promoteToOwner(",
  "distributedRevocation: true",
  "signedRevocation: true",
  "cryptographicRevocation: true",
  // Treating suspended/removed as active.
  '=== "suspended_local" ? true',
  "treatSuspendedAsActive",
];

// Role-string equality used for AUTHORIZATION outside the approved modules.
const ROLE_AUTHZ_RE = /(===|!==)\s*["'](owner|editor|viewer|auditor)_placeholder["']/;

const APPROVED = ["packages/rooms/src/membership/", "packages/rooms/src/authorization/"];

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".mjs"];

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith("check-no-room-authorization-bypass.mjs")
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
            `${rel}:${index + 1} — authorization bypass pattern "${token}" ` +
              "(revalidate against current state + an authentic PolicyDecision — docs/SOVEREIGN_ROOMS.md)",
          );
        }
      }
      if (!inApproved && ROLE_AUTHZ_RE.test(line)) {
        violations.push(
          `${rel}:${index + 1} — role-string used for authorization outside the approved modules ` +
            "(roles are attributes; use the capability + revalidation layer — docs/SOVEREIGN_ROOMS.md)",
        );
      }
    });
  }
}

report("check:no-room-authorization-bypass", violations);
