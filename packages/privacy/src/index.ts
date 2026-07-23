/**
 * @freelayer/privacy — Privacy Modes engine (type-level schema, Prompt 03).
 *
 * This package hosts the `PolicyDecision` contract. Side-effect modules
 * (storage, transports, ai) import it type-only and reject calls that do not
 * carry a valid decision — docs/ARCHITECTURE.md, non-bypassable rules 6/13,
 * ADR-0002. Core re-exports these types for apps and the SDK.
 *
 * TODO (Gate B — docs/IMPLEMENTATION_GATES.md):
 * - first full policy schema (versioned)
 * - first 20 privacy-regression invariants (see docs/METADATA_MODEL.md)
 * - mode-to-side-effect matrix (docs/PRIVACY_MODEL.md)
 */

import type { Brand } from "@freelayer/security";

/** The seven privacy modes, enforced by core policy — docs/PRIVACY_MODEL.md. */
export type PrivacyMode =
  "standard" | "private" | "ghost" | "bunker" | "offline_capsule" | "emergency" | "sovereign_room";

/** Capabilities a policy governs. Every side effect maps to one of these. */
export const POLICY_CAPABILITIES = [
  "persistence",
  "network",
  "directTransport",
  "externalAssets",
  "linkPreviews",
  "readReceipts",
  "typingIndicators",
  "presence",
  "notifications",
  "localAI",
  "mediaCache",
  "roomSync",
  "capsuleSpool",
] as const;

export type PolicyCapability = (typeof POLICY_CAPABILITIES)[number];

export type PolicyVerdict = "allowed" | "denied";

/** One policy source's verdict per capability (device mode, room, transport…). */
export type PolicyProfile = Readonly<Record<PolicyCapability, PolicyVerdict>>;

/**
 * Strictest-policy-wins conflict resolution (docs/PRIVACY_MODEL.md, locked by
 * ADR-0002): a capability is allowed only if EVERY contributing profile allows
 * it. With no profiles at all, everything is denied — the engine fails closed.
 */
export function resolveStrictestPolicy(profiles: readonly PolicyProfile[]): PolicyProfile {
  const entries = POLICY_CAPABILITIES.map((capability) => {
    const allowed = profiles.length > 0 && profiles.every((p) => p[capability] === "allowed");
    return [capability, allowed ? "allowed" : "denied"] as const;
  });
  return Object.fromEntries(entries) as Record<PolicyCapability, PolicyVerdict>;
}

export type PolicyDecisionId = Brand<string, "PolicyDecisionId">;

/**
 * The specific side effect a decision authorizes. A decision issued for one
 * operation must not authorize another — side-effect modules compare this
 * against the concrete request (e.g. the storage write barrier requires an
 * exact match). "generic" exists for scaffolding/tests that predate scoped
 * decisions; strict barriers (storage) do NOT accept it.
 */
export type PolicySideEffectScope =
  | "storage.write"
  | "storage.read"
  | "storage.delete"
  | "storage.list"
  | "storage.clear"
  | "storage.export"
  | "storage.import"
  | "storage.cache.write"
  | "storage.cache.read"
  | "storage.audit.write"
  | "network.send"
  | "network.receive"
  // Network operation scopes (TECH-08). A decision issued for one network
  // operation must not authorize another; the network barrier requires an
  // exact match and never accepts "generic".
  | "network.connect"
  | "network.request"
  | "network.listen"
  | "transport.send"
  | "transport.receive"
  | "transport.poll"
  | "transport.sync"
  | "transport.discovery"
  | "link.preview"
  | "asset.fetch"
  | "telemetry.send"
  | "update.check"
  | "ai.remote_request"
  | "ai.infer"
  // Metadata Firewall scopes (TECH-10). A metadata decision issued for one
  // signal must not authorize another; the metadata barrier requires an exact
  // match and never accepts "generic" (docs/METADATA_MODEL.md).
  | "metadata.emit"
  | "metadata.store"
  | "metadata.notify"
  | "metadata.log"
  | "metadata.audit"
  | "metadata.network_expose"
  | "receipt.emit"
  | "typing.emit"
  | "presence.emit"
  | "notification.show"
  // Notification Privacy Model scopes (TECH-12). Each notification operation
  // must carry a decision scoped to exactly it (docs/PRIVACY_MODEL.md).
  | "notification.permission_request"
  | "notification.badge"
  | "notification.sound"
  | "notification.vibration"
  | "notification.push_subscribe"
  | "notification.push_receive"
  | "notification.service_worker_show"
  | "notification.audit"
  // RoomOS scopes (TECH-16). Room operations are policy-controlled LOCAL
  // state transitions; each decision is scoped to exactly one of these
  // (docs/SOVEREIGN_ROOMS.md).
  | "room.create"
  | "room.mutate"
  | "room.project"
  | "room.operation_log.append"
  | "room.operation_log.read"
  | "room.operation_log.clear"
  | "room.replay"
  | "room.audit"
  | "room.policy_update"
  | "room.lifecycle_update"
  // RoomOS Object Model scopes (TECH-18). Object mutation and object-log
  // storage are SEPARATE side effects; each decision is scoped to exactly one
  // (docs/SOVEREIGN_ROOMS.md). Object IDs/actor refs confer no authority.
  | "room.object.create"
  | "room.object.update"
  | "room.object.redact"
  | "room.object.archive"
  | "room.object.tombstone"
  | "room.object_log.append"
  | "room.object_log.read"
  | "room.object_log.clear"
  // RoomOS Query Model scopes (TECH-19). Queries are side-effect-free, local,
  // policy-gated reads; each decision is scoped to exactly one of these. A
  // list decision cannot authorize detail, summary cannot authorize search,
  // etc. Object IDs/actor refs confer no query authority.
  | "room.query.summary"
  | "room.query.list"
  | "room.query.detail"
  | "room.query.search"
  | "room.query.count"
  // RoomOS Membership + capability scopes (TECH-20). Membership mutation,
  // membership-log storage, and membership queries are SEPARATE side effects;
  // each decision is scoped to exactly one. A capability descriptor is NEVER a
  // substitute for one of these — it is a non-authoritative policy input.
  | "room.membership.bootstrap"
  | "room.membership.add"
  | "room.membership.change_role"
  | "room.membership.suspend"
  | "room.membership.reactivate"
  | "room.membership.remove"
  | "room.membership_log.append"
  | "room.membership_log.read"
  | "room.membership.query.list"
  | "room.membership.query.detail"
  | "room.membership.query.count"
  // RoomOS governance scopes (TECH-22). Room policy tightening + governance-log
  // storage are SEPARATE side effects; each decision is scoped to exactly one.
  // Governance is tighten-only; a capability descriptor never substitutes.
  | "room.governance.update"
  | "room.governance_log.append"
  // Identity Firewall scaffolding scopes (TECH-ID-03). Local, non-cryptographic
  // identity operations are policy-gated LOCAL state transitions; each decision
  // is scoped to exactly one. An id / label / RoomMemberRef / DevicePosture is
  // NEVER a substitute — only an authentic exact-scope decision authorizes.
  | "identity.root.create"
  | "identity.root.lifecycle"
  | "identity.persona.create"
  | "identity.persona.lifecycle"
  | "identity.relationship.create"
  | "identity.relationship.lifecycle"
  | "identity.room_binding.create"
  | "identity.room_binding.lifecycle"
  | "identity.summary.read"
  // Ephemeral Identity scopes (TECH-ID-04). An independent current-process
  // ephemeral root context; each decision is scoped to exactly one operation.
  // An id / persona / RoomOS role / DevicePosture NEVER substitutes.
  | "identity.ephemeral.create"
  | "identity.ephemeral.lifecycle"
  | "identity.ephemeral.destroy"
  | "identity.ephemeral.persona.create"
  | "identity.ephemeral.relationship.create"
  | "identity.ephemeral.relationship.block"
  | "identity.ephemeral.room_binding.create"
  | "identity.ephemeral.summary.read"
  // Per-Contact Alias scopes (TECH-ID-05). Relationship-scoped local presentation
  // aliases + private local peer labels; each decision is scoped to exactly one
  // operation. An alias id / text / relationship id / RoomOS role / DevicePosture
  // NEVER substitutes; alias text is never authority or verification.
  | "identity.alias.presentation.create"
  | "identity.alias.presentation.lifecycle"
  | "identity.alias.presentation.rotate"
  | "identity.alias.local_peer_label.write"
  | "identity.alias.local_peer_label.clear"
  | "identity.alias.display_context.read"
  | "identity.alias.reuse_assessment.read"
  // Per-room alias scopes (TECH-ID-06). Room-scoped local presentation aliases
  // bound to one identity room binding; each decision is scoped to exactly one
  // operation. An alias id / text / binding id / room role / RoomMemberRef /
  // DevicePosture NEVER substitutes; alias text is never authority or verification.
  | "identity.room_alias.create"
  | "identity.room_alias.lifecycle"
  | "identity.room_alias.rotate"
  | "identity.room_alias.display_context.read"
  | "identity.room_alias.collision_assessment.read"
  | "identity.room_alias.reuse_assessment.read"
  // Device-key-model scopes (TECH-ID-07). LOCAL, non-cryptographic, root-
  // subordinate device authorization; each decision is scoped to exactly one
  // operation. A device id / label / RoomOS role / DevicePosture NEVER
  // authorizes; a local authorization record is never a cryptographic proof.
  | "identity.device.bootstrap"
  | "identity.device.restrict"
  | "identity.device.mark_compromised"
  | "identity.device.revoke"
  | "identity.device.label.write"
  | "identity.device.label.clear"
  | "identity.device.summary.read"
  | "identity.device.key_slots.read_redacted"
  | "generic";

/** Proof that core evaluated policy for one capability. Required by all side-effect modules. */
export interface PolicyDecision {
  readonly id: PolicyDecisionId;
  readonly capability: PolicyCapability;
  /** The concrete operation this decision authorizes (exact-match in strict barriers). */
  readonly sideEffect: PolicySideEffectScope;
  readonly verdict: PolicyVerdict;
  readonly mode: PrivacyMode;
  /** Logical sequence number — ordering hint, not trusted time. */
  readonly issuedAtLogical: number;
}

/**
 * Provenance registry: the set of PolicyDecision objects this module actually
 * issued. It is module-PRIVATE — no other code holds a reference to it, so no
 * other code can add to it. A hand-crafted object that merely *looks* like a
 * PolicyDecision is not a member and is rejected.
 *
 * This is genuinely unforgeable within the JS object-capability model
 * (upgraded from the earlier `Symbol.for` mark, which was forgeable because
 * the registry key was global). Honest remaining limit: it does not defend
 * against a hostile actor with the same-realm ability to reflect on a *real*
 * decision and re-present it — decision reuse across operations is bounded by
 * the exact side-effect scope check in each barrier, not by this registry.
 */
const issuedDecisions = new WeakSet<PolicyDecision>();

export type PolicyEvaluationResult =
  | { readonly verdict: "allowed"; readonly decision: PolicyDecision }
  | { readonly verdict: "denied"; readonly reason: string };

let decisionSeq = 0;

/**
 * Issue a PolicyDecision. Intended caller: the core operation pipeline ONLY.
 * Direct use by features is a policy bypass — rejected in review
 * (docs/SECURITY_REVIEW_CHECKLIST.md). The returned object is registered as
 * an authentic decision; only objects from this factory pass isPolicyDecision.
 */
export function issuePolicyDecision(
  capability: PolicyCapability,
  verdict: PolicyVerdict,
  mode: PrivacyMode,
  sideEffect: PolicySideEffectScope = "generic",
): PolicyDecision {
  decisionSeq += 1;
  const decision: PolicyDecision = {
    id: `pd-${decisionSeq}` as PolicyDecisionId,
    capability,
    sideEffect,
    verdict,
    mode,
    issuedAtLogical: decisionSeq,
  };
  issuedDecisions.add(decision);
  return decision;
}

/**
 * Authenticity check used by side-effect modules before acting: the value must
 * be an object this module actually issued (WeakSet membership). Forged
 * look-alikes fail by construction.
 */
export function isPolicyDecision(value: unknown): value is PolicyDecision {
  return (
    typeof value === "object" && value !== null && issuedDecisions.has(value as PolicyDecision)
  );
}

// ---- Metadata Firewall (TECH-10). Re-exported last so isPolicyDecision above
//      is fully initialized before the metadata barrier's call-time use of it
//      (docs/METADATA_MODEL.md). These modules import only types + the
//      authenticity check from here — no new runtime cycle of concern. ----
export * from "./metadataTypes";
export * from "./metadataErrors";
export * from "./metadataHelpers";
export * from "./metadataPolicy";
export * from "./metadataBarrier";
export * from "./metadataSignals";

// ---- Link preview / external asset blocking (TECH-11). URLs are
//      content-adjacent metadata; remote assets are network side effects.
//      Both denied by default (docs/METADATA_MODEL.md). ----
export * from "./urlClassification";
export * from "./linkPreviewPolicy";
export * from "./externalAssetPolicy";

// ---- Notification Privacy Model (TECH-12). Notifications are side effects;
//      their content and metadata are sensitive; denied by default
//      (docs/PRIVACY_MODEL.md). ----
export * from "./notificationTypes";
export * from "./notificationErrors";
export * from "./notificationPolicy";
export * from "./notificationBarrier";

// ---- Policy Matrix v1 (TECH-13). The single canonical mode × domain ×
//      operation contract; tests, docs and PBOM must agree with it
//      (docs/POLICY_MATRIX.md). ----
export * from "./policyMatrixTypes";
export * from "./policyMatrix";

// ---- Policy conflict taxonomy (TECH-14). Contradictions between policy
//      layers are privacy bugs; the regression suite makes them fail tests
//      (docs/audits/POLICY_CONFLICT_REPORT.md). ----
export * from "./policyConflicts";
