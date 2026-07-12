// Policy Matrix v1 validator (TECH-13, docs/POLICY_MATRIX.md).
//
// Validates docs/policy-matrix.v1.json — the machine-readable mirror of
// packages/privacy/src/policyMatrix.ts (a vitest sync-test guarantees the two
// are identical, so validating the JSON validates the TS matrix). Zero
// dependencies; the tiny spec→rule expansion below intentionally duplicates
// the TS logic (~20 lines) so this script needs no TS toolchain.
//
// Usage: node scripts/validate-policy-matrix.mjs [path-to-json]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPathExisting, report, repoRoot } from "./_util.mjs";

const MODES = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];
const MAJOR_DOMAINS = [
  "storage",
  "network",
  "metadata",
  "link_preview",
  "external_asset",
  "notification",
  "ai",
  "endpoint",
];
// "room" graduated in TECH-16 (local RoomOS foundation rows exist); room SYNC
// stays future-gated via the explicit spec-id check below.
const DEFERRED_DOMAINS = ["crypto", "capsule", "identity"];
const FUTURE_GATED_SPEC_IDS = ["room.sync"];
const ALLOWING_EFFECTS = ["allow", "memory_only", "redact", "coarsen", "delay", "batch"];
const EFFECTS = [
  "allow",
  "deny",
  "redact",
  "coarsen",
  "delay",
  "batch",
  "memory_only",
  "null",
  "require_user_action",
  "future_gate",
  "not_implemented",
];

const root = repoRoot();
const jsonPath = process.argv[2] ?? join(root, "docs", "policy-matrix.v1.json");
const violations = [];

let matrix;
try {
  matrix = JSON.parse(readFileSync(jsonPath, "utf8"));
} catch (error) {
  report("check:policy-matrix", [`cannot read/parse ${jsonPath}: ${String(error)}`]);
  process.exit(1);
}

const specs = Array.isArray(matrix.specs) ? matrix.specs : [];
if (specs.length === 0) {
  violations.push("matrix has no specs");
}

// ---- Expand specs → rules (mirror of expandPolicyMatrixSpecs) ----
const rules = [];
for (const spec of specs) {
  for (const mode of MODES) {
    const effect = spec.effectOverrides?.[mode] ?? spec.effect;
    const reasonCode = spec.reasonOverrides?.[mode] ?? spec.reasonCode;
    rules.push({
      id: `${spec.id}:${mode}`,
      domain: spec.domain,
      mode,
      operation: spec.operation,
      sink: spec.sink,
      transport: spec.transport,
      dataClass: spec.dataClass,
      effect,
      allowed: ALLOWING_EFFECTS.includes(effect),
      persistentAllowed: false,
      networkAllowed: false,
      requiresUserAction: effect === "require_user_action",
      reasonCode,
      rationale: spec.rationale,
      testCoverage: spec.testCoverage,
      docsRefs: spec.docsRefs,
    });
  }
}

if (typeof matrix.ruleCount === "number" && matrix.ruleCount !== rules.length) {
  violations.push(`ruleCount ${matrix.ruleCount} != expanded ${rules.length}`);
}

// ---- Per-rule field validation + uniqueness ----
const seenIds = new Set();
const seenKeys = new Set();
for (const rule of rules) {
  if (seenIds.has(rule.id)) violations.push(`duplicate rule id "${rule.id}"`);
  seenIds.add(rule.id);
  const key = `${rule.domain}|${rule.operation}|${rule.mode}`;
  if (seenKeys.has(key)) violations.push(`duplicate/contradictory rule for "${key}"`);
  seenKeys.add(key);

  if (!MODES.includes(rule.mode)) violations.push(`${rule.id}: unknown mode`);
  if (typeof rule.domain !== "string" || rule.domain === "")
    violations.push(`${rule.id}: missing domain`);
  if (typeof rule.operation !== "string" || rule.operation === "")
    violations.push(`${rule.id}: missing operation`);
  if (!EFFECTS.includes(rule.effect))
    violations.push(`${rule.id}: invalid effect "${rule.effect}"`);
  if (typeof rule.reasonCode !== "string" || rule.reasonCode === "")
    violations.push(`${rule.id}: missing reasonCode`);
  if (typeof rule.rationale !== "string" || rule.rationale.length < 10)
    violations.push(`${rule.id}: missing rationale`);
  if (!["covered", "partial", "not_testable_yet", "deferred"].includes(rule.testCoverage)) {
    violations.push(`${rule.id}: invalid testCoverage`);
  }
  if (!Array.isArray(rule.docsRefs) || rule.docsRefs.length === 0) {
    violations.push(`${rule.id}: missing docsRefs`);
  } else {
    for (const ref of rule.docsRefs) {
      if (!isPathExisting(join(root, ref)))
        violations.push(`${rule.id}: docsRef "${ref}" does not exist`);
    }
  }

  // ---- Semantic invariants ----
  if (rule.allowed === true && rule.effect === "deny")
    violations.push(`${rule.id}: allowed:true with effect deny`);
  if (rule.networkAllowed === true)
    violations.push(`${rule.id}: networkAllowed:true (v1 forbids all egress)`);
  if (rule.persistentAllowed === true)
    violations.push(`${rule.id}: persistentAllowed:true (v1 forbids persistence)`);
  if (rule.rationale.includes("SENTINEL"))
    violations.push(`${rule.id}: rationale contains a sentinel marker`);
  if (
    DEFERRED_DOMAINS.includes(rule.domain) &&
    rule.effect !== "future_gate" &&
    rule.effect !== "not_implemented"
  ) {
    violations.push(`${rule.id}: deferred domain must be future_gate/not_implemented`);
  }
  if (
    FUTURE_GATED_SPEC_IDS.some((id) => rule.id.startsWith(`${id}:`)) &&
    rule.effect !== "future_gate"
  ) {
    violations.push(`${rule.id}: must stay future_gate (deferred gate)`);
  }
}

// ---- Always-forbidden behaviors must never be allowed ----
const NEVER_ALLOWED_SPEC_PREFIXES = [
  "network.telemetry_send",
  "network.external_asset_fetch",
  "network.link_preview_fetch",
  "network.push_subscribe",
  "external_asset.",
  "link_preview.automatic_preview",
  "link_preview.opengraph_fetch",
  "link_preview.favicon_fetch",
  "notification.push_subscribe",
  "notification.push_receive",
  "notification.message_preview",
];
for (const rule of rules) {
  if (NEVER_ALLOWED_SPEC_PREFIXES.some((p) => rule.id.startsWith(p)) && rule.allowed) {
    violations.push(`${rule.id}: always-forbidden behavior marked allowed`);
  }
}

// ---- Coverage: every mode has rules in every major domain ----
for (const mode of MODES) {
  for (const domain of MAJOR_DOMAINS) {
    if (!rules.some((r) => r.mode === mode && r.domain === domain)) {
      violations.push(`no rule for mode "${mode}" in major domain "${domain}"`);
    }
  }
}

// ---- Offline Capsule / Ghost / Bunker invariants ----
for (const rule of rules) {
  if (
    rule.mode === "offline_capsule" &&
    rule.domain === "network" &&
    rule.allowed &&
    rule.id !== "network.relay_transport_send:offline_capsule"
  ) {
    violations.push(`${rule.id}: Offline Capsule network rule marked allowed`);
  }
  if (
    (rule.mode === "ghost" || rule.mode === "bunker") &&
    rule.sink === "local_persistent_storage" &&
    rule.allowed
  ) {
    violations.push(`${rule.id}: Ghost/Bunker persistent-sink rule marked allowed`);
  }
}

console.log(
  `[check:policy-matrix] validated ${specs.length} specs → ${rules.length} rules across ${MODES.length} modes`,
);
report("check:policy-matrix", violations);
