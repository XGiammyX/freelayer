// RoomOS membership/capability bypass guard (TECH-20, docs/SOVEREIGN_ROOMS.md).
//
// Membership is local + UNVERIFIED and capabilities are NON-AUTHORITATIVE:
// authority comes only from an authentic exact-scope PolicyDecision. This guard
// forbids ambient authority, role-only authorization outside approved modules,
// caller-controlled trust fields, wildcard permissions, capability
// serialization/persistence, auth/authz/identity dependencies, invite
// URLs/codes, presence/contact fields, network/crypto in membership modules,
// and endpoint-risk-as-authority.
//
// Usage: node scripts/check-no-room-membership-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Direct membership projection mutation.
  ".membershipRecords.push(",
  ".membershipRecords.splice(",
  ".records.push(",
  ".records.splice(",
  // Wildcard permissions.
  'capabilities: ["*"]',
  'capability: "*"',
  '"room.policy.loosen"',
  "delegateCapability",
  "exportCapability",
  // Capability serialization / persistence / cache.
  "JSON.stringify(descriptor",
  "JSON.stringify(capability",
  "serializeCapability",
  "persistCapability",
  "capabilityCache",
  // Auth / authz / identity dependencies.
  'from "jsonwebtoken"',
  'from "jose"',
  'from "macaroons.js"',
  'from "ucans"',
  'from "@ucans',
  'from "did-jwt"',
  'from "@openfga',
  'from "@authzed',
  "spicedb",
  // Invites / contact / presence.
  "inviteUrl",
  "inviteCode",
  "inviteLink",
  "lastSeen",
  "onlineStatus",
  "presence:",
  "contactBook",
  "phoneNumber",
  "emailAddress",
  // Network / crypto / AI / monitoring in membership modules.
  "fetch(",
  "new WebSocket(",
  "new Notification(",
  "node:crypto",
  'from "@freelayer/crypto"',
  'from "@freelayer/ai"',
  "iohook",
  "robotjs",
  // Endpoint overclaims.
  "endpointSafe: true",
  "deviceTrusted: true",
  'endpointIntegration: "active"',
];

// Role-string equality used for AUTHORIZATION outside the approved modules is a
// bypass (roles are attributes, not authority — use the capability layer).
const ROLE_AUTHZ_RE = /(===|!==)\s*["']owner_placeholder["']|["']owner_placeholder["']\s*(===|!==)/;

// Caller-controlled authority/trust fields, matched as OBJECT PROPERTIES with a
// value (avoids state-name substrings like `active_local_unverified:` and
// backticked mentions in comments).
const AUTHORITY_FIELD_RE =
  /\b(isAdmin|isOwner|trustedDevice|endpointSafe|deviceTrusted|grantAll)\s*:\s*(true|false|[a-zA-Z_$])/;

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".mjs"];
const MEMBERSHIP_PKG = "packages/rooms/src/membership/";

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    // The Policy Matrix legitimately NAMES denied operations (e.g. a
    // room.policy.loosen DENY row) as data — not an authorization bypass.
    rel.endsWith("packages/privacy/src/policyMatrix.ts") ||
    rel.endsWith("check-no-room-membership-bypass.mjs")
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
    const inMembershipPkg = rel.includes(MEMBERSHIP_PKG);
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — membership/capability bypass pattern "${token}" ` +
              "(authority comes only from an authentic exact-scope PolicyDecision — docs/SOVEREIGN_ROOMS.md)",
          );
        }
      }
      // Role-equality authorization is only allowed inside the membership package
      // (the explicit role→capability tables + reducers legitimately compare roles).
      if (!inMembershipPkg && ROLE_AUTHZ_RE.test(line)) {
        violations.push(
          `${rel}:${index + 1} — role-string used for authorization outside the membership package ` +
            "(roles are attributes, not authority — use the capability layer — docs/SOVEREIGN_ROOMS.md)",
        );
      }
      // Caller-controlled authority/trust property (any package).
      if (AUTHORITY_FIELD_RE.test(line)) {
        violations.push(
          `${rel}:${index + 1} — caller-controlled authority/trust field ` +
            "(authority comes only from an authentic exact-scope PolicyDecision — docs/SOVEREIGN_ROOMS.md)",
        );
      }
    });
  }
}

report("check:no-room-membership-bypass", violations);
