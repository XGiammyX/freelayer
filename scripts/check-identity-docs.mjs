// Identity docs honesty check (TECH-ID-02, docs/adr/ADR-0013-identity-firewall-architecture.md).
//
// Identity is architecture-decided (ADR-0013) but NOT implemented. This guard
// keeps the claim-surface docs honest: it fails on unsupported "implemented"
// claims and confirms the Identity Firewall / Architecture docs keep the core
// honesty statements. Deliberately NOT an NLP validator — a small, stable set of
// exact positive-claim phrases chosen to avoid matching honest negated sentences
// (e.g. "RoomMemberRef is not identity" does not contain "RoomMemberRef is identity").
// Research/audit/ADR narrative is intentionally out of scope (they discuss/negate).
//
// Usage: node scripts/check-identity-docs.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPathExisting, report, repoRoot } from "./_util.mjs";

const root = repoRoot();
const violations = [];

// Claim-surface docs (current-status pages), NOT research/audit/adr narrative.
const CLAIM_DOCS = [
  "docs/IDENTITY_FIREWALL.md",
  "docs/IDENTITY_ARCHITECTURE.md",
  "docs/PBOM.md",
  "docs/TRUST_CENTER.md",
  "docs/ARCHITECTURE.md",
  "docs/GLOSSARY.md",
  "docs/PRIVACY_MODEL.md",
  "docs/METADATA_MODEL.md",
  "docs/STORAGE_MODEL.md",
  "docs/THREAT_MODEL.md",
  "docs/SOVEREIGN_ROOMS.md",
  "docs/ROADMAP.md",
  "README.md",
];

// Exact positive-claim phrases that must never appear (identity is not implemented).
const FORBIDDEN_CLAIMS = [
  "verified identity is implemented",
  "verified identities are implemented",
  "device passport is implemented",
  "device passports are implemented",
  "recovery is implemented",
  "recovery is available today",
  "identity keys are implemented",
  "key transparency is active",
  "key transparency is implemented",
  "did method is implemented",
  "did identity is implemented",
  "personas are cryptographically unlinkable",
  "unlinkable personas are guaranteed",
  "deviceposture verifies identity",
  "posture proves identity",
  "posture verifies identity",
  "roommemberref is identity proof",
  "roommemberref is identity",
  "screenshield protects identity secrets",
];

// Docs that MUST keep their honesty statements (phrase → file). These invariants
// hold before and after the TECH-ID-03 local (non-cryptographic) scaffolding.
const MUST_MENTION = {
  "docs/IDENTITY_FIREWALL.md": ["not safe for real secrets", "DevicePosture is not identity"],
  "docs/IDENTITY_ARCHITECTURE.md": ["not implemented", "DevicePosture is not identity"],
};

for (const rel of CLAIM_DOCS) {
  const abs = join(root, rel);
  if (!isPathExisting(abs)) continue; // README/optional docs may be absent
  const lower = readFileSync(abs, "utf8").toLowerCase();
  for (const phrase of FORBIDDEN_CLAIMS) {
    if (lower.includes(phrase)) {
      violations.push(
        `${rel} — unsupported identity claim "${phrase}" (identity is ADR-decided but NOT implemented — ADR-0013)`,
      );
    }
  }
}

for (const [rel, phrases] of Object.entries(MUST_MENTION)) {
  const abs = join(root, rel);
  if (!isPathExisting(abs)) {
    violations.push(`missing required doc "${rel}"`);
    continue;
  }
  const content = readFileSync(abs, "utf8").toLowerCase();
  for (const phrase of phrases) {
    if (!content.includes(phrase.toLowerCase())) {
      violations.push(`"${rel}" must state "${phrase}" (identity honesty statement)`);
    }
  }
}

report("check:identity-docs", violations);
