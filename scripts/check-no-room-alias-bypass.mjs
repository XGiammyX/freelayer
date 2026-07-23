// Per-room alias bypass guard (TECH-ID-06, docs/adr/ADR-0013-identity-firewall-architecture.md).
//
// A per-room alias is LOCAL, room-scoped presentation metadata bound to ONE
// identity room binding — NOT identity, membership, a role, verification, a
// RoomMemberRef, or a global username. This guard forbids (in shipped code): an
// alias used as membership/role authority; a `verified member` derived from an
// alias; a root id / RoomMemberRef used as a visible fallback; a contact alias
// automatically copied into a room; an alias shared/reused across rooms by
// default; alias transfer across rooms/bindings; a room-alias lookup/directory/
// search; direct RoomOS membership mutation from the identity package; persistent
// alias history/collision/reuse indexes; network alias exchange; raw alias
// logging; cryptographic/authenticated alias claims; full spoofing-prevention or
// unlinkability claims; active ScreenShield; and generic room-profile patch
// commands. Targets implementation tokens (colon props / call identifiers), not
// prose.
//
// Usage: node scripts/check-no-room-alias-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Alias-as-authority / alias-as-membership / alias-as-role.
  "aliasGrantsRole",
  "aliasGrantsMembership",
  "aliasGrantsAccess",
  "roleFromAlias",
  "membershipFromAlias",
  "aliasIsAuthority",
  "authorityFromAlias",
  // Verified member derived from alias.
  "verifiedMember: true",
  "verifiedFromAlias",
  "aliasVerified: true",
  // Root id / RoomMemberRef used as a visible fallback.
  "rootIdAsRoomAlias",
  "memberRefAsAlias",
  "roomMemberRefAsAlias",
  "rootIdAsAlias",
  // Contact alias automatically copied into a room.
  "copyContactAliasToRoom",
  "contactAliasAsRoomAlias",
  "reuseContactAliasInRoom",
  // Alias shared / reused across rooms by default.
  "shareAliasAcrossRooms",
  "reuseAliasAcrossRooms",
  "aliasSharedAcrossRooms: true",
  // Alias transfer across rooms / bindings.
  "transferRoomAlias",
  "moveAliasToRoom",
  "moveAliasToBinding",
  "copyAliasAcrossRooms",
  // Room-alias lookup / directory / search.
  "roomAliasDirectory",
  "roomAliasLookup(",
  "searchRoomAlias(",
  "roomMemberDirectory",
  "roomAliasAvailabilityService",
  // Persistent alias history / collision / reuse indexes.
  "persistRoomAliasHistory",
  "roomAliasHistoryStore",
  "roomAliasCollisionIndex",
  "roomAliasReuseIndex",
  "persistCollisionIndex",
  // Network alias exchange / remote update.
  "exchangeRoomAlias(",
  "sendRoomAliasToPeer",
  "remoteRoomAliasUpdate(",
  "roomAliasSharedRemotely: true",
  // Cryptographic / authenticated room alias.
  "signRoomAlias(",
  "roomAliasSignature:",
  "authenticateRoomAlias(",
  // Full-spoofing-prevention / unlinkability claims.
  "spoofProof",
  "noSpoofingPossible",
  "impersonationImpossible",
  "unlinkabilityGuaranteed: true",
  "fullConfusableDetection",
  // Active ScreenShield.
  "screenShieldActive: true",
  // Generic room-alias / room-profile patch.
  '"identity.room_alias.patch"',
  '"identity.room_alias.update_any"',
  "roomProfilePatch(",
  "setRoomProfile(",
  // Direct persistent storage.
  "localStorage.",
  "sessionStorage.",
  "indexedDB.",
];

// Raw alias logging + network with alias identifiers (inside the module).
const ROOM_ALIAS_LOG_RE = /console\.\w+\([^)]*(alias|displayText|roomAlias|member)/i;
const ROOM_ALIAS_NETWORK_RE = /(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\([^)]*(alias|room)/i;
// Direct RoomOS membership mutation from the identity room-alias module.
const MEMBERSHIP_MUTATION_RE =
  /\b(mutate|set|remove|update|suspend|create|tombstone)\w*Membership\b|\bmembership\w*\.(mutate|remove|suspend|setRole)/i;

const DEFAULT_DIRS = ["apps", "packages"];
const ROOM_ALIAS_DIR = "packages/identity/src/room-aliases/";
const EXTS = [".ts", ".tsx", ".mjs"];

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith("check-no-room-alias-bypass.mjs") ||
    // The validator legitimately LISTS rejected field names (role/verified/…).
    rel.endsWith("packages/identity/src/room-aliases/room-alias-validation.ts") ||
    // The Policy Matrix legitimately names denied room-alias operations (data).
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
    const inRoomAlias = explicit || rel.includes(ROOM_ALIAS_DIR);
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — room-alias bypass pattern "${token}" (ADR-0013; a room alias is local presentation, never identity/membership/role/verification)`,
          );
        }
      }
      if (
        inRoomAlias &&
        (ROOM_ALIAS_LOG_RE.test(line) ||
          ROOM_ALIAS_NETWORK_RE.test(line) ||
          MEMBERSHIP_MUTATION_RE.test(line))
      ) {
        violations.push(
          `${rel}:${index + 1} — room-alias code must not log raw alias text, make network calls, or mutate RoomOS membership`,
        );
      }
    });
  }
}

report("check:no-room-alias-bypass", violations);
