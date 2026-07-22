# Implementation Gates

[← Docs Index](README.md) · [Roadmap](ROADMAP.md) · [ADRs](adr/README.md)

> [!NOTE]
> Gates decide **whether** work may start; the roadmap decides **when**. A closed gate blocks implementation regardless of schedule pressure — that ordering is the project's core discipline.

## Purpose

Hard preconditions between design and implementation. A gate is **closed** until every criterion is met; work belonging behind a closed gate does not begin, regardless of schedule pressure. Gates encode the project rule that every major feature follows **research → design → implementation → tests → audit** — they are the checkpoints where that order is enforced.

Gates compose with the roadmap ([ROADMAP.md](ROADMAP.md)): phases schedule _when_ work happens; gates define _whether it may_.

## Current status

**Gate A satisfied** (Prompt 03 + Infra-01): monorepo builds, all guards and tests pass locally and on hosted CI ([LIVE_CI_REPORT.md](LIVE_CI_REPORT.md)). **Gates B–J remain closed.** Infra Gate 1 satisfied — see below.

---

## Gate A — Foundation

_Opens: workspace implementation (Phase 1)._

- [x] Monorepo exists and builds: 12 packages + 4 apps compile with strict TypeScript (verified locally)
- [x] CI green: typecheck/lint/test/build + all four guards passing on hosted GitHub Actions (verified 2026-07-08 — [LIVE_CI_REPORT.md](LIVE_CI_REPORT.md))
- [x] Zero external assets verified (CI guard `check:no-external-assets` — [NO_EXTERNAL_ASSETS_POLICY.md](NO_EXTERNAL_ASSETS_POLICY.md); fails on planted violations)
- [x] Zero telemetry verified (CI guard `check:no-telemetry`)
- [x] License finalized: AGPL-3.0-or-later code, CC BY-SA 4.0 docs ([ADR-0011](adr/ADR-0011-license-strategy.md))
- [x] ADR system exists ([docs/adr/](adr/), ADR-0001…ADR-0011 accepted)
- [x] Dependency-direction guard exists as a **baseline** (`scripts/check-boundaries.mjs`); stronger AST/graph tooling (dependency-cruiser or eslint-plugin-boundaries) remains a tracked TODO per [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md)

## Gate B — Policy Engine

_Opens: any side-effectful feature (Phase 2 exit)._

- [ ] Policy schema: Privacy Modes expressed as a versioned schema in `packages/privacy`
- [ ] Core operation pipeline implemented: validate → classify → resolve policies → decide → execute → audit
- [ ] Strictest-policy-wins conflict resolution implemented and tested ([PRIVACY_MODEL.md](PRIVACY_MODEL.md))
- [ ] `PolicyDecision` object defined and required by all side-effect modules — calls without one are rejected ([ADR-0002](adr/ADR-0002-core-enforced-policy-engine.md))
- [ ] First privacy-regression tests running in CI against real policy behavior

## Gate C — Storage

_Opens: any feature that persists data (Phase 2/7)._ **Status: PARTIAL — the policy/barrier half is done (TECH-05); real persistence remains blocked by Gate F.**

- [x] Write barrier implemented: all persistence through StoragePolicy with exact-scope `PolicyDecision` ([ADR-0005](adr/ADR-0005-storage-selected-only-by-policy.md))
- [x] StoragePolicy v0: 30 data classes × 7 modes, default deny, strictest wins, room tighten-only, ScreenShield/device-risk hooks
- [x] Memory-only and null providers working, hardened, regression-tested
- [x] Encrypted-persistent placeholder provider defined and throwing (real encryption arrives with Gate F)
- [x] "Ghost mode: zero persistent writes" tests passing (all 30 data classes)
- [x] "Bunker mode: zero persistent writes" tests passing (all 30 data classes)
- [x] Cache policy exists (cache classes denied in strict modes; sealed ScreenShield denies everywhere)
- [x] Forbidden direct-storage CI guard extended (browser storage/DB, caches, cookies, beacons, `fs.writeFile*`, Deno/Bun/Tauri) and covered by its own tests
- [x] PBOM storage section updated to implemented reality
- [x] TECH-06 hardening: provider contract v2, clone-at-boundaries memory provider, structurally-stateless null provider, key validation, redacted errors, sentinel leak tests, zero-persistence harness, guardrail v2 with fixture self-tests
- [x] TECH-07 deep verification: Ghost/Bunker persistent-backend selection denied (full sweep), runtime persistent-write traps, static scan incl. File System Access API, 8-config provider matrix, mode-transition no-auto-flush tests, spool/cache/log strict suites, artifact sentinel scan — all green ([audit](audits/TECH_07_ZERO_PERSISTENCE_AUDIT.md))
- [ ] Encrypted persistence, wipe semantics, per-platform storage behavior — **blocked by Gate F** (crypto review); Gate C fully opens only with those

## Gate D — Network

_Opens: any networked transport (Phase 4)._

- [ ] NetworkPolicy defined and enforced through core ([NETWORK_MODEL.md — Network side-effect barrier](NETWORK_MODEL.md))
- [ ] Zero-egress test for the default build: no network calls not explicitly user-initiated
- [ ] No remote assets (CI guard, [NO_EXTERNAL_ASSETS_POLICY.md](NO_EXTERNAL_ASSETS_POLICY.md))
- [ ] No telemetry endpoints (CI guard)
- [x] Transport leakage labels defined per transport — `describeNetworkMetadataLeakage` (TECH-08, [METADATA_MODEL.md](METADATA_MODEL.md))
- [x] "Bunker: no direct-IP transport" test passing (WebRTC denied Private+, TECH-08)
- [x] NetworkPolicy v0 + side-effect barrier + forbidden-network guard + runtime egress trap (TECH-08)
- [x] Zero-egress _default-build_ verification (TECH-09): source scan + build-artifact scan + runtime trap + dependency scan + service-worker audit + GitHub Actions egress audit ([audit](audits/TECH_09_ZERO_EGRESS_AUDIT.md)); full in-browser E2E deferred to AUDIT-HARD

## Gate M — Metadata Firewall (TECH-10)

_Opens: any feature that could emit a metadata signal (receipts, typing, presence, notifications, previews, network timing)._

TECH-10 is complete only if all hold:

- [x] Platform reconciliation exists ([audits/TECH_10_PLATFORM_RECONCILIATION.md](audits/TECH_10_PLATFORM_RECONCILIATION.md))
- [x] MetadataPolicy v0 exists with metadata event + sink taxonomy (`packages/privacy`)
- [x] Default deny + fail-closed on unknown mode/event/sink
- [x] Receipts/typing/presence denied in Private+
- [x] Notification content denied in Ghost/Bunker
- [x] Offline Capsule denies network metadata; Emergency denies normal metadata generation
- [x] Link preview / external asset / telemetry-shaped metadata denied
- [x] AI metadata denied in Ghost/Bunker
- [x] Redacted audit-event model exists; sentinel never appears in errors/audit/logs
- [x] StoragePolicy + NetworkPolicy integration tests exist (`tests/privacy-regression/metadata/metadata-integration.test.ts`)
- [x] Metadata-bypass guardrail (`check:no-metadata-bypass`) + AST ESLint coverage
- [x] PBOM, Trust Center, and Metadata Model updated
- [x] All local checks pass (220 tests)

Enforcement reuses the existing WeakSet `PolicyDecision` provenance (Gate B item A2), not a new mechanism. Detail: [METADATA_MODEL.md](METADATA_MODEL.md), [audits/TECH_10_METADATA_FIREWALL_AUDIT.md](audits/TECH_10_METADATA_FIREWALL_AUDIT.md).

## Gate N — Link Preview / External Asset Blocking (TECH-11)

_Opens: any UI that renders user-provided URLs or could load a remote asset._

TECH-11 is complete only if all hold:

- [x] Precheck, research note, and threat model exist ([audits/TECH_11_PRECHECK.md](audits/TECH_11_PRECHECK.md), [research/LINK_PREVIEW_EXTERNAL_ASSET_BLOCKING_RESEARCH.md](research/LINK_PREVIEW_EXTERNAL_ASSET_BLOCKING_RESEARCH.md), [audits/TECH_11_LINK_ASSET_THREAT_MODEL.md](audits/TECH_11_LINK_ASSET_THREAT_MODEL.md))
- [x] `LinkPreviewPolicy`, `ExternalAssetPolicy`, and a pure URL classifier exist (`packages/privacy`)
- [x] Automatic previews + network preview fetch + favicon/OpenGraph denied in all modes
- [x] Remote images/fonts/scripts/styles/avatars + preconnect/dns-prefetch/preload/prefetch denied
- [x] Preview/thumbnail/favicon caching denied; URL display redacts credentials/query
- [x] No sentinel URL in errors/audit/logs; no fetch during classification/policy resolution
- [x] External-asset scanner catches fixtures; real build/source contains no remote assets
- [x] Metadata / Network / Storage integration tests pass
- [x] PBOM, Trust Center, Metadata/Network/Storage/Privacy docs + [WEB_SECURITY_HEADERS.md](WEB_SECURITY_HEADERS.md) updated
- [x] All local checks pass (257 tests)

A safe user-initiated preview remains a future design gate. Detail: [audits/TECH_11_LINK_ASSET_BLOCKING_AUDIT.md](audits/TECH_11_LINK_ASSET_BLOCKING_AUDIT.md).

## Gate O — Notification Privacy (TECH-12)

_Opens: any feature that would show a notification, request permission, set a badge, or use push/service workers._

TECH-12 is complete only if all hold:

- [x] Precheck, research note, and threat model exist ([audits/TECH_12_PRECHECK.md](audits/TECH_12_PRECHECK.md), [research/NOTIFICATION_PRIVACY_RESEARCH.md](research/NOTIFICATION_PRIVACY_RESEARCH.md), [audits/TECH_12_NOTIFICATION_THREAT_MODEL.md](audits/TECH_12_NOTIFICATION_THREAT_MODEL.md))
- [x] `NotificationPolicy` + operation/content-class/surface taxonomy exist (`packages/privacy`)
- [x] Permission requests denied by default; no real prompt/display implemented
- [x] Message previews denied; room/sender names denied in Private+; protected/secret denied in all modes
- [x] Badge denied in Ghost/Bunker/Emergency; sound/vibration denied in Bunker/Emergency
- [x] Push subscribe/receive + service-worker notifications denied in all modes
- [x] Notification content storage denied in Ghost/Bunker; audit events redacted; sentinel-free
- [x] Notification-bypass guardrail + runtime trap exist; Tauri + service-worker/push audits exist (both absent)
- [x] Metadata / Storage / Network integration tests pass
- [x] PBOM, Trust Center, Metadata/Privacy/Threat/Storage/Network docs updated
- [x] All local checks pass (286 tests)

Any OS notification / push / service worker requires a future ADR/gate. Detail: [audits/TECH_12_NOTIFICATION_PRIVACY_AUDIT.md](audits/TECH_12_NOTIFICATION_PRIVACY_AUDIT.md).

## Gate P — Policy Matrix (TECH-13)

_Opens: any change to privacy/security policy behavior (all future feature work consults this gate)._

TECH-13 is complete only if all hold:

- [x] Precheck, research note, and threat model exist ([audits/TECH_13_PRECHECK.md](audits/TECH_13_PRECHECK.md), [research/POLICY_MATRIX_RESEARCH.md](research/POLICY_MATRIX_RESEARCH.md), [audits/TECH_13_POLICY_MATRIX_THREAT_MODEL.md](audits/TECH_13_POLICY_MATRIX_THREAT_MODEL.md))
- [x] Policy Matrix v1 exists (94 specs → 658 rules; unique ids; every mode × major domain covered)
- [x] Machine-readable export ([policy-matrix.v1.json](policy-matrix.v1.json)) with verbatim sync test
- [x] Validation script (`check:policy-matrix`) + docs-consistency script (`check:policy-docs`) in CI
- [x] Fail-closed unknown inputs; deny-overrides; strictest-wins; tighten-only room/ScreenShield composition — all tested
- [x] Cross-engine agreement tests: Storage, Network, Metadata, LinkPreview, ExternalAsset, Notification
- [x] Deferred gates encoded as `future_gate` (crypto, encrypted storage, capsules, room sync, identity, push, AI, EDL)
- [x] PBOM, Trust Center, Privacy/Storage/Network/Metadata docs, CONTRIBUTING_SECURITY updated
- [x] All local checks pass (320 tests)

Any policy-behavior PR must update the matrix in the same PR. Detail: [audits/TECH_13_POLICY_MATRIX_AUDIT.md](audits/TECH_13_POLICY_MATRIX_AUDIT.md).

## Gate Q — Policy Conflict Gate (TECH-14)

_Opens: permanently active — any policy-behavior PR must keep the conflict suite green._

TECH-14 is complete only if all hold:

- [x] Precheck, research note, and threat model exist ([audits/TECH_14_PRECHECK.md](audits/TECH_14_PRECHECK.md), [research/POLICY_CONFLICT_REGRESSION_RESEARCH.md](research/POLICY_CONFLICT_REGRESSION_RESEARCH.md), [audits/TECH_14_POLICY_CONFLICT_THREAT_MODEL.md](audits/TECH_14_POLICY_CONFLICT_THREAT_MODEL.md))
- [x] 17 conflict categories defined (`packages/privacy/src/policyConflicts.ts`) + deterministic redacted explainer
- [x] Cross-policy assertion helpers + table-driven tests (matrix ↔ every engine agrees)
- [x] Intentional-contradiction fixtures exist and are provably detected (48 + 10 findings)
- [x] `check:policy-conflicts` validator (matrix invariants, Trust Center overclaims, docs statements, dependency bans) in `audit:privacy` + CI
- [x] PBOM consistency + Trust Center overclaim checks exist
- [x] Anti-spyware externalization audit exists ([audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md](audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md))
- [x] [audits/POLICY_CONFLICT_REPORT.md](audits/POLICY_CONFLICT_REPORT.md) — 0 conflicts
- [x] All local checks pass (337 tests)

## Gate T — RoomOS Foundation Gate (TECH-16)

_Opens: any feature building on Sovereign Rooms (messaging UI, documents, tasks, decisions)._

TECH-16 is complete only if all hold:

- [x] `packages/rooms` foundation exists: identifiers, lifecycle/kind/trust, object + operation taxonomies ([SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md))
- [x] `RoomPolicy` v1 (tighten-only) + room barrier requiring authentic, exactly-scoped `PolicyDecision`s
- [x] Versioned operation events (memory-only; `local:` timestamps; no crypto/CRDT metadata) + pure rebuildable projection + redacted room audit
- [x] Policy integrations tested: Matrix `room` rows (sync pinned `future_gate`), StoragePolicy (no persistence), Metadata/Network/Notification denials, no-side-effect traps
- [x] `check:no-roomos-bypass` guardrail (+fixtures) in `audit:privacy` + CI
- [x] No sync/crypto/identity/CRDT/anti-spyware implemented or depended upon
- [x] Docs/PBOM (§21)/Trust Center updated; 21 new tests (369 total) pass

Sync remains **Gate H**; room content persistence remains **Gate F**; identity remains **Gate G**; capsule transport remains **Gate E**; endpoint defense remains **Gate R** (externalized).

## Gate U — RoomOS Operation Log and Projection Gate (TECH-17)

_Opens: any feature consuming the room event log (messaging views, documents, history UI)._

TECH-17 is complete only if all hold:

- [x] v1 event schema (`schemaVersion`/`projectionVersion` explicit; unknown versions reject) with typed operation payloads
- [x] Local ordering rules (positive safe integers, contiguous ascending, complete replay starts at 1, timestamps never order) — documented as NOT distributed/causal ordering
- [x] Memory/null logs only (clone-on-append/read; no internal exposure; separate exactly-scoped decisions for append/read/clear)
- [x] Deterministic replay (validate-all-then-apply; no partial state; pure reducer; zero clock/network/notification calls — trapped)
- [x] Lifecycle transition state machine (tombstone terminal; explicitly not forensic deletion)
- [x] Immutability/defensive-cloning tests; sentinel-free errors/status/reports
- [x] Policy integration (matrix rows incl. `room.project.snapshot` future gate; Storage/Metadata agreement; Emergency wipe-direction clear)
- [x] Docs/PBOM (§22)/Trust Center updated; 30 new tests (399 total); no sync/crypto/identity implemented

## Gate Z — RoomOS Room Policy Composition + Governance Gate (TECH-22)

_Opens: any feature relying on composed room policy, minimum device posture, or room governance._

TECH-22 is complete only if all hold:

- [x] Policy layers explicit (fixed taxonomy; no caller-controlled names)
- [x] Strictness ordering + deny-overrides (unknown effect denies; `deny`/`not_implemented`/`future_gate` never permit)
- [x] DevicePosture contract exists; untrusted posture cannot elevate; `at_risk` tightens; minimum-posture ordering explicit
- [x] Protected-content future requirements deny safely (no silent downgrade, no active-protection claim)
- [x] RoomPolicyDocument v1 (versioned) + monotonic tighten-only comparison
- [x] Governance is tighten-only (owner-only; only `stricter` succeeds; policy revision + posture invalidate authorization)
- [x] Operation pipelines use composition; sensitive-room admission is deterministic
- [x] Guardrail + CI; 21 new tests (521 total); docs/PBOM(§27)/Trust Center updated
- [x] No Secure Device provider / posture verification / ScreenShield runtime / signed-distributed governance implemented

## Secure Device Integration Gate (future) — expanded by TECH-23

_Opens: any real device-posture verification, trusted provider, or protected-presentation enforcement in FreeLayer. Until it opens, core is the **RATS Relying Party only** and no trusted provider exists._

TECH-23 defines the CONTRACT only (`packages/rooms/src/secure-device/`): roles, provider port, deterministic Null provider, normalized transient assessment, provenance, freshness, sensitive-room admission, transient session, and ProtectedContent intent. A **trusted provider may be implemented only after ALL** of the following:

- [ ] The external **Secure Device project exists and is independently testable**
- [ ] A dedicated **integration ADR**
- [ ] Provider **trust and provenance** model (cryptographic — Gate F; today provenance is a non-cryptographic same-realm registry)
- [ ] Posture **freshness and anti-replay** design (trusted clock / nonce / epoch — none exist today; freshness is current-process-only)
- [ ] **Failure / degradation** behavior (fail-closed; recovery requires a fresh assessment + admission + authorization, never session restore)
- [ ] Native **permission audit**
- [ ] Privacy **data-flow audit** (no raw evidence, no device identifiers, no inventory, no history, no telemetry)
- [ ] Supported-**platform matrix**
- [ ] **Compromised-provider** threat model
- [ ] **PBOM and Trust Center** update
- [ ] **Regression and rollback** plan
- [ ] Explicit prohibition of **spyware-proof / capture-proof** claims

Until it opens, core resolves posture to `unverified`/`at_risk` only, stricter room requirements deny content, `activeProtectionClaim`/`screenShieldIntegrated`/`protectedSurfaceAvailable` stay `false`, and `trustedForPostureElevation` is structurally `false`.

## Gate Z2 — RoomOS Sensitive Room Admission + Secure Device Contract Gate (TECH-23)

_Opens: any operation relying on a normalized posture assessment or a sensitive-room admission session._

TECH-23 is complete only if all hold:

- [x] FreeLayer modeled as **RATS Relying Party only**; Attester/Verifier external (`secure-device-roles.ts`)
- [x] Versioned provider **port** + deterministic **Null provider**; no trusted production provider (`ready_future` is coerced to `unavailable`)
- [x] Versioned normalized **assessment**; raw evidence / identifiers / inventory / history **structurally forbidden and rejected**
- [x] Untrusted posture **cannot elevate**; `at_risk` can only **tighten**; freshness is **current-process-only**; **revision rollback rejected**
- [x] Admission **actions/outcomes explicit + fail-closed**; minimum posture enforced; unavailable/stale provider denies gated content; ScreenShield/Bunker deny safely; **no silent downgrade**; redacted summary separately gated
- [x] Admission **never replaces** membership / capability / `PolicyDecision`; sessions transient + current-process; **invalidate** on posture/provider/policy/membership/mode/lifecycle/action change; recovery requires fresh assessment/admission/authorization
- [x] `check:no-secure-device-core-implementation` guardrail + fixture + CI; new privacy/security regression suites; **sentinel** leak + side-effect traps
- [x] Policy Matrix (195 specs → 1365 rules), PBOM, Trust Center, and endpoint-boundary docs updated
- [x] **No** network / attestation / GrapheneOS management / MDM / anti-spyware / ScreenShield / Bunker runtime in core

## Gate Y — RoomOS Local Revocation + Authorization Regression Gate (TECH-21)

_Opens: any feature that grants a member a capability and later relies on it staying revoked (permission UIs, capability-scoped operations after membership changes)._

TECH-21 is complete only if all hold:

- [x] Prepared authorization model (non-authoritative, transient, non-serializable, revision-bound)
- [x] Execution-time revalidation as the final gate before every side effect
- [x] Revision binding (membership revision + local policy revision + mode + lifecycle + room + operation/object/view/target)
- [x] Suspension / removal / role-downgrade / role-elevation invalidation of old descriptors
- [x] Reactivation invalidation (revision bump; old descriptors + contexts stale)
- [x] Room-policy revision + privacy-mode invalidation (even less-restrictive transitions)
- [x] Operation-data binding (object/operation/view/room/target mismatch reject)
- [x] Owner-continuity recomputed from the CURRENT projection at execution
- [x] No authorization cache (audited) + capability/context persistence + serialization forbidden
- [x] Restrictive-direction enforcement (no expansive smuggling); capability-set role comparison
- [x] Object/query/membership integration path + guardrail + CI; 19 new tests (500 total); docs/PBOM(§26)/Trust Center updated
- [x] Local only — no identity/crypto/distributed-revocation/endpoint-assurance implementation

## Gate X — RoomOS Membership + Capability Scaffolding Gate (TECH-20)

_Opens: any feature relying on room membership or capability-informed authorization (permission UIs, member management, capability-scoped operations)._

TECH-20 is complete only if all hold:

- [x] Versioned membership model (opaque IDs, positive local revision, `verification: "unverified_placeholder"`)
- [x] Lifecycle enforcement (active↔suspended→removed_tombstone; tombstone terminal; duplicate/stale-revision reject)
- [x] Placeholder roles as ABAC attributes via an explicit role→capability table (eligibility necessary, not sufficient)
- [x] Non-authoritative capability descriptors (bound to room+membership+revision; no wildcard; serialization/persistence forbidden; delegation not implemented)
- [x] Attenuation tests (narrow-only; widening/subset/object-kind/exact-object/view widening reject)
- [x] Stale-revision / currency checks (role/state/revision/room change → stale)
- [x] Last-owner continuity invariant (remove/suspend/demote of the last active owner rejects)
- [x] `PolicyDecision` integration (authentic exact-scope decision always required; descriptor authorizes nothing alone; separate mutation vs storage decisions)
- [x] Object/query integration path (capability resolution + authorization context available to facades)
- [x] No identity/invite/crypto/sync implementation; local revocation ≠ distributed revocation
- [x] 18 matrix rows; guardrail + CI; 21 new tests (481 total); docs/PBOM(§25)/Trust Center updated

## Gate W — RoomOS Query Model Gate (TECH-19)

_Opens: any feature reading room data for display (message views, task boards, search)._

TECH-19 is complete only if all hold:

- [x] Explicit query taxonomy (unknown query/view/filter/sort deny)
- [x] Query policy (deny-by-default; requested view downgrade-only; history/cache/index structurally `false`)
- [x] Exact-scope authorization (`room.query.*`; object IDs/actor refs confer no authority; list≠detail≠search≠count; mutation/storage cannot authorize a query)
- [x] Immutable, defensively-cloned snapshots (never the operation log)
- [x] Privacy-safe views (summaries content-free; content detail only where policy allows; redacted/tombstoned content never reappears)
- [x] Structured filters + deterministic sorts (object-ID tie-breaker; source never mutated)
- [x] Bounded cursor model (local, content-free, non-authority, not persisted)
- [x] No query history/cache/persistent index
- [x] Exact case-sensitive in-memory search (no index/regex/fuzzy/snippet; term never logged)
- [x] Leak tests (sentinel absent from errors/summaries/counts/console) + zero-side-effect traps
- [x] Guardrail + CI; 28 new tests (460 total); docs/PBOM(§24)/Trust Center updated
- [x] No sync/crypto/identity/AI/endpoint implementation; endpoint defense externalized

## Gate V — RoomOS Object Model and Local Mutations Gate (TECH-18)

_Opens: any feature consuming concrete room objects (message views, task boards, decision logs)._

TECH-18 is complete only if all hold:

- [x] Concrete object schemas (message/note/task/decision/poll/file_ref) with explicit `schemaVersion`; unknown versions/kinds/commands reject
- [x] Plain-text-only content with UTF-8 byte limits, bounded arrays, NUL/surrogate rejection
- [x] Explicit command union (no generic patch); proto-pollution + getter + mass-assignment defenses
- [x] Local `revision` optimistic concurrency (create→1, +1/mutation, stale/future/missing/overflow reject) — documented as NOT distributed/causal/tamper-proof
- [x] Deny-by-default policy-gated pipeline; separate exact-scoped mutation vs object-log decisions; matrix cross-check; logical all-or-nothing
- [x] Deterministic operation-specific events + pure reducer + memory/null object log + replay
- [x] Lifecycle/status machines (archived read-only, redaction one-way, tombstone terminal, not forensic erasure)
- [x] File refs hold no bytes/path/URL; poll voting/tallies absent
- [x] 12 matrix rows (`room.object.*`); Storage/Metadata/Network agreement; guardrail + CI; 33 new tests (432 total); docs/PBOM/Trust Center updated
- [x] No transport/sync/CRDT/crypto/identity/AI/anti-spyware; not safe for real secrets

## Room Event Schema Evolution Gate (future)

_Opens: any change to the room event schema beyond v1._ Requires: research note · migration design (no automatic/lossy upcasting) · test vectors · backward-compatibility fixtures · privacy review of retained historical payloads · hostile-input review if external import (Gate E) is involved. Until it opens, unknown schema versions fail closed.

## Gate S — Contributor Workflow Gate (TECH-15)

_Opens: permanently active — the governance surface must stay intact (`check:contributor-workflow` in CI)._

TECH-15 is complete only if all hold:

- [x] [CONTRIBUTOR_WORKFLOW.md](CONTRIBUTOR_WORKFLOW.md) + [POLICY_DEVELOPER_GUIDE.md](POLICY_DEVELOPER_GUIDE.md) + [COMMANDS.md](COMMANDS.md) exist
- [x] PR template asks privacy/security impact + requires matrix/PBOM/Trust Center updates + anti-spyware boundary confirmation
- [x] Issue forms: privacy bug, policy change, feature gate proposal, anti-spyware integration proposal (Gate R)
- [x] [ADR_WORKFLOW.md](ADR_WORKFLOW.md) + [adr/ADR-TEMPLATE.md](adr/ADR-TEMPLATE.md) exist
- [x] [OpenSSF readiness checklist](audits/OPENSSF_READINESS_CHECKLIST.md) (honest; no badge/score claimed)
- [x] CODEOWNERS extended + solo-dev limits documented ([audits/CODEOWNERS_REVIEW_AUDIT.md](audits/CODEOWNERS_REVIEW_AUDIT.md))
- [x] Anti-spyware boundary documented across contributor surface; `check:contributor-workflow` validates it in CI
- [x] PBOM/Trust Center updated; all local checks pass (348 tests)

## Gate R — Endpoint Defense / Anti-spyware Integration Gate

_Opens: only when the standalone anti-spyware project is completed and its integration is proposed._

The anti-spyware / Endpoint Defense / ScreenShield **implementation is externalized** to a separate project; FreeLayer core keeps **policy hooks only** (ScreenShield levels as tightening inputs, endpoint data classes/metadata events, `future_gate` matrix rows). Integration requires ALL of:

- [ ] A dedicated ADR proposing the integration
- [ ] An integration threat model (per-OS capture/clipboard/overlay behavior, honest limits)
- [ ] PBOM update (every native capability, dependency, and permission enumerated)
- [ ] Trust Center update (what is actually protected, what is not)
- [ ] Native-permission audit (Tauri capabilities scoped to exactly what policy allows)
- [ ] No overclaims: integration must not claim protection against compromised endpoints or cameras ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md))

Until this gate opens, any endpoint-monitoring dependency or active-protection claim in core is a policy conflict (`check:policy-conflicts` fails).

## Gate E — Capsule Parser

_Opens: processing any externally-produced capsule (Phase 4)._

- [ ] Capsule wire format draft complete in `packages/protocol` with version + algorithm identifiers
- [ ] Hostile-input parser: strict schema validation, no unbounded structures ([CAPSULENET.md](CAPSULENET.md))
- [ ] Explicit size limits at every level
- [ ] Explicit recursion/depth limits
- [ ] Quarantine path for unknown/undecryptable/malformed capsules implemented
- [ ] Fuzz tests exist and run in CI for every parser
- [ ] Test vector format defined; vectors published
- [ ] Deterministic replay/dedup design complete and tested

## Gate F — Crypto

_Opens: any cryptographic implementation (Phases 4–5)._

- [ ] [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md) specifies the construction with cited prior art
- [ ] Design reviewed per [ADR-0004](adr/ADR-0004-no-crypto-implementation-before-review.md) / [ADR-0009](adr/ADR-0009-security-sensitive-pr-review-rules.md) — no implementation before review
- [ ] Library selected via documented evaluation (its own ADR)
- [ ] Test vectors defined; interop vector publication plan exists
- [ ] No custom primitives anywhere (verified in review)
- [ ] External review plan (scope, reviewers, funding) committed before any release claims trust

## Gate G — Identity

_Opens: Identity Firewall implementation (Phase 3 exit)._

- [ ] No phone/email anywhere in the identity model (hard constraint, verified in design review)
- [ ] Local identity model documented (multiple identities per install, ephemeral identities)
- [ ] Invite model designed (one-time invites, no directory service)
- [ ] Verification model designed (QR + short-code, PAKE-inspired)
- [ ] Device key model designed (device keys vs. identity keys, Ghost Vault compatibility)
- [ ] Recovery trade-offs documented bluntly (no central recovery — key loss means data loss unless the user keeps a recovery kit)

## Gate H — Rooms

_Opens: Sovereign Rooms implementation (Phase 6)._

- [ ] Operation/CRDT model chosen via formal evaluation memo, recorded in a new ADR ([SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md))
- [ ] Out-of-order convergence tests defined and passing on the prototype
- [ ] Membership change and key-rotation design reviewed (crypto dependency, Gate F)
- [ ] Room bundle security design complete (stale-import safety, no rollback, no access resurrection)
- [ ] Decision ledger authenticity design complete (co-signing, verification)
- [ ] Unauthorized-operation rejection and dedup tests passing

## Gate I — AI

_Opens: any local AI feature (Phase 8). Mirrors the AI implementation gate in [LOCAL_AI.md](LOCAL_AI.md)._

- [ ] AIPolicy implemented in the policy engine
- [ ] AI Privacy Guard implemented (mode check, room-scoped input, provenance labels, storage-policy routing)
- [ ] Prompt-injection threat annex complete in [THREAT_MODEL.md](THREAT_MODEL.md)
- [ ] Zero-network AI test passing (default build performs no AI network calls)
- [ ] Prompt/cache no-log test passing
- [ ] Model supply-chain policy exists (sourcing, hashing, update policy)
- [ ] AI output provenance format defined
- [ ] [PBOM.md](PBOM.md) AI section complete (models, hashes, caches, embedding indexes, absence of network calls)

## Gate K — Endpoint Defense / ScreenShield

_Opens in stages (ADR-0012). ProtectedContent/ScreenShield design precedes serious messaging UI._

**Required before protected messaging UI:**

- [x] Endpoint Defense Model exists ([ENDPOINT_DEFENSE_MODEL.md](ENDPOINT_DEFENSE_MODEL.md))
- [x] ScreenShield design exists ([SCREENSHIELD.md](SCREENSHIELD.md))
- [x] ProtectedContent policy exists ([PROTECTED_CONTENT_POLICY.md](PROTECTED_CONTENT_POLICY.md))
- [x] Platform limitations documented ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md))
- [x] Device Risk Model exists ([DEVICE_RISK_MODEL.md](DEVICE_RISK_MODEL.md))
- [x] Accessibility/privacy trade-offs documented ([ACCESSIBILITY_PRIVACY_TRADEOFFS.md](ACCESSIBILITY_PRIVACY_TRADEOFFS.md))
- [x] ScreenShield policy fields added to the privacy model ([PRIVACY_MODEL.md](PRIVACY_MODEL.md))
- [x] Future tests defined ([ENDPOINT_DEFENSE_MODEL.md](ENDPOINT_DEFENSE_MODEL.md), [PROTECTED_CONTENT_POLICY.md](PROTECTED_CONTENT_POLICY.md))
- [ ] ScreenShield policy schema implemented (TECH-EDL-02) and ProtectedContent contract specified (TECH-EDL-03)

**Required before implementing platform-specific protection:**

- [ ] Platform API research complete for the target platform (beyond the RESEARCH-EDL-01 baseline in [ENDPOINT_RESEARCH_NOTES.md](ENDPOINT_RESEARCH_NOTES.md))
- [ ] Platform capability reporting design (honest `protected/degraded/unavailable/failed` states)
- [ ] Failure-mode UX design (what users see when protection is unavailable or fails)
- [ ] Test strategy per platform
- [ ] PBOM entries for the platform's endpoint behavior
- [ ] Trust Center status update per platform

**Required before any Bunker/protected-content release:**

- [ ] ProtectedContent enforced (no other rendering path for sensitive content)
- [ ] No-raw-sensitive-rendering lint rule active
- [ ] Clipboard guard tests passing
- [ ] Screenshot/capture tests passing where the platform supports them
- [ ] Task switcher redaction tests passing where the platform supports them
- [ ] Accessibility exposure policy tested with real assistive technology
- [ ] Platform limitations visible to users in product UI

## Gate J — Release

_Opens: any public release, including alpha (Phase 11)._

- [ ] [TRUST_CENTER.md](TRUST_CENTER.md) updated and accurate for the release
- [ ] [PBOM.md](PBOM.md) updated and shipped as a release artifact
- [ ] SBOM generated (or generation plan documented with a deadline)
- [ ] Signed release process planned and keys published
- [ ] Known-limitations page updated
- [ ] Alpha/experimental warning visible in the product and release notes

---

## Infra Gate 1 — Public Repository and Live CI

_Infrastructure gate (separate from the technical A–J ladder). Opens: accepting external contributions at scale._

- [x] Public repository exists (<https://github.com/XGiammyX/freelayer>)
- [x] README is complete and honest (landing page with status warnings, comparison, architecture)
- [x] GitHub Actions run live — CI, privacy regression, and CodeQL green on `main` first run
- [x] CI validation PR exists with all checks passing (PR #11, left open)
- [x] Branch protection enabled on `main` (verified via API — [GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md))
- [x] CodeQL present and running (green on main + PR)
- [x] Dependency review present and running (green on PR)
- [x] GitHub security settings checklist exists with verified statuses ([GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md))

Live results: [LIVE_CI_REPORT.md](LIVE_CI_REPORT.md). Also satisfied for Gate A: the previously open "CI green on hosted CI" criterion.

---

## Identity Architecture Gate — architecture decided by TECH-ID-02 ([ADR-0013](adr/ADR-0013-identity-firewall-architecture.md))

*Opens: any identity implementation (identity roots, personas, aliases, device keys, device passports, invites, verification, recovery, trust notebook, directory).*

Identity is **Gate G** design work; identity cryptography is **Gate F**. RESEARCH-ID-01 produced the research package and **TECH-ID-02 (ADR-0013, Accepted)** decided the architecture. The **architecture-decision** prerequisites are now settled:

- [x] Terminology accepted (`identity root` / `persona` / `alias` / `member reference` / `device` / `device key` / `device passport` / `DevicePosture` / `verification` / `recovery` distinct — [research/IDENTITY_TERMINOLOGY_MODEL.md](research/IDENTITY_TERMINOLOGY_MODEL.md), ADR-0013 §4)
- [x] Root / persona / alias model chosen — private local root, pairwise per-contact, room-scoped aliases; **personas NOT guaranteed unlinkable** (ADR-0013 §7-10)
- [x] Multi-device model chosen — subordinate revocable `DeviceAuthorization`, explicit approval, stale-device fail-closed (ADR-0013 §11)
- [x] Recovery approach chosen — offline kit + existing-device approval; **no administrator or project-owned master key**; `recovered_reverification_required` (ADR-0013 §13)
- [x] Verification semantics defined — claim-specific trust states, **no generic `verified` boolean** (ADR-0013 §12)
- [x] One-time invite requirements defined — narrow, expiring, single-use, capability-limited, revocable (ADR-0013 §14)
- [x] Metadata / correlation analysis complete ([metadata review](audits/TECH_ID_02_IDENTITY_METADATA_REVIEW.md))
- [x] Storage policies identified — secrets never plaintext/logged; Ghost/Bunker restrictions (ADR-0013 §16)
- [x] PBOM / Trust Center identity claims approved (honest; no "verified identity" claim)
- [x] **No endpoint/identity conflation** — DevicePosture stays external, never identity ([boundary audit](audits/TECH_ID_02_IDENTITY_BOUNDARY_AUDIT.md))

**Still required before implementation (the gate remains CLOSED for code):**

- [ ] Crypto dependencies decided by **Gate F** (root/relationship/device keys, signatures, derivation, verification codes, recovery encryption) — no algorithm selected yet
- [ ] Invite/QR/Capsule wire formats decided by **Gate E**
- [ ] Multi-device identity synchronization decided by **Gate H**
- [ ] A dedicated **recovery threat review** before recovery implementation
- [ ] Secure Device gate before protected recovery rendering

Until it opens for code: no identity keys, no recovery, no invites, no aliases/personas, no device passports, no key transparency, no QR verification, no directory; `RoomMemberRef` remains a local unverified placeholder; identity state fails closed. TECH-ID-03 (Local Identity Scaffolding) may implement **local, type-safe, crypto-free** scaffolding only.

## Rules

- Gate criteria may be **added** by PR review; removing or weakening a criterion requires GOVERNANCE-level review and, where it touches an ADR, a superseding ADR.
- A gate check that cannot be automated yet is verified manually in PR review and noted in [TRUST_CENTER.md](TRUST_CENTER.md).
- Gate status changes are recorded here and in the Trust Center in the same PR.

## TODO

- [ ] Convert each gate into a tracked GitHub milestone with issues when the repository is public
- [ ] Automate gate verification where possible (Phase 10)
