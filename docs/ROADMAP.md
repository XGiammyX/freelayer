# FreeLayer Roadmap

[← Docs Index](README.md) · [Implementation Gates](IMPLEMENTATION_GATES.md) · [Trust Center](TRUST_CENTER.md)

> [!NOTE]
> No dates, deliberately: phases ship when their exit criteria are met, and gates — not schedules — decide when implementation may start. ✅ marks verified-done work only.

## Purpose

Sequence the work from empty repository to alpha release, with explicit gates: research before design, design before implementation, tests and audit before trust.

## Current status

**Phase 0.5 — Architecture Decision Lock — in progress** (Phase 0 deliverables complete, including the license decision — [ADR-0011](adr/ADR-0011-license-strategy.md)). No dates are attached to phases; this is a small-team open-source project and honesty beats fake schedules. Phases ship when their exit criteria are met.

---

### Phase 0 — Research and repository foundation

Repository structure, documentation set, contribution/security policy, CI baseline.

- Exit criteria: this documentation set exists and is internally consistent; license finalized; CI green on the empty monorepo.
- ✅ License decision complete: code AGPL-3.0-or-later, documentation CC BY-SA 4.0 ([ADR-0011](adr/ADR-0011-license-strategy.md), [LICENSE-DOCS.md](LICENSE-DOCS.md)).
- Remaining: maintainer team setup, first external design feedback.

### Phase 0.5 — Architecture Decision Lock _(current)_

Turn the documentation into a binding project constitution before any implementation: ADRs, policy conflict rule, storage write barrier, hostile-input parsing rules, AI implementation gate, documentation coupling, implementation gates.

- Exit criteria:
  - ✅ ADR directory exists ([docs/adr/](adr/)) with ADR-0001…ADR-0011 accepted.
  - ✅ License strategy finalized ([ADR-0011](adr/ADR-0011-license-strategy.md)).
  - ✅ [SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md) is complete enough for design review.
  - ✅ Policy conflict rule exists ([PRIVACY_MODEL.md](PRIVACY_MODEL.md)).
  - ✅ Write barrier rule exists ([STORAGE_MODEL.md](STORAGE_MODEL.md)).
  - ✅ Network side-effect barrier exists ([NETWORK_MODEL.md](NETWORK_MODEL.md)).
  - ✅ Capsule hostile-input parsing rule exists ([CAPSULENET.md](CAPSULENET.md)).
  - ✅ AI implementation gate exists ([LOCAL_AI.md](LOCAL_AI.md)).
  - ✅ Documentation coupling rule exists ([CONTRIBUTING_SECURITY.md](CONTRIBUTING_SECURITY.md)).
  - ✅ Security review checklist exists ([SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md)).
  - ✅ Implementation gates exist ([IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md), Gates A–J).
  - ✅ Trust Center updated to mention this phase ([TRUST_CENTER.md](TRUST_CENTER.md)).
  - ✅ No contradictions remain in hard constraints (verified this pass; re-verified at every phase boundary).
- Remaining: external design review of the locked decisions.

### Phase 1 — Monorepo and app shells _(started — Prompt 03)_

Workspace packages with real builds; `apps/web` (React+Vite) and `apps/desktop` (Tauri) shells that render, with strict CSP and zero external assets from day one; lint rules enforcing dependency direction.

Progress (Prompt 03):

- ✅ Monorepo: 12 typed packages + 4 apps; `pnpm typecheck/lint/test/build` run real work and pass.
- ✅ Web shell: local-only React+Vite status page, strict CSP, zero external assets, builds for production.
- ✅ Mechanical guardrails (baseline): import-boundary check (dependency direction), no-external-assets check, no-telemetry check, forbidden-storage check — all wired into CI and `audit:privacy`.
- ✅ Side-effect scaffolding: storage/transport placeholders require a `PolicyDecision` and fail closed; baseline tests verify it.
- ⬜ Desktop: placeholder only — Tauri shell still to come (kept minimal deliberately; permissions surface deferred).
- ✅ ESLint-based enforcement added (flat config + typescript-eslint): AST-backed `no-restricted-globals`/`no-restricted-imports` over shipped source, upgrading the static-scan baseline (which remains as belt-and-suspenders). See [PLATFORM_STATE_ANALYSIS.md](PLATFORM_STATE_ANALYSIS.md).
- ✅ First real CI run on GitHub — green on `main` and PRs since INFRA-01 ([LIVE_CI_REPORT.md](LIVE_CI_REPORT.md)).

- Exit: `pnpm build/typecheck/lint/test` run real work; shells launch; privacy-regression workflow checks real artifacts. **Not complete yet** — desktop shell and hosted CI verification remain.

### Phase 2 — Policy engines

`packages/privacy` (Privacy Modes as versioned policy schema) and `packages/storage` (policy-selected backends: encrypted-persistent placeholder, memory-only, null). Core operation pipeline: validate → policy check → execute.

- Exit: modes switch real behavior in a demo harness; "Ghost writes nothing" is a passing test; AIPolicy hooks reserved.

### Phase 3 — Identity Firewall

Local identities, ephemeral identities, per-contact/per-room aliases, invite/verification design (QR + short-code, PAKE-inspired), device keys design, recovery kit design. Crypto library evaluation concludes here (gate for Phase 4).

- Exit: identity model documented and reviewed; no server anywhere in the design; recovery trade-offs documented bluntly.

### Phase 4 — CapsuleNet MVP

Capsule envelope format (`packages/protocol`), seal/unseal via reviewed crypto facade, Capsule Inbox with quarantine, spool, first transports: file export/import + QR (offline-first before networked), then the reference relay + relay transport.

- Exit: two devices exchange capsules via file AND via relay; replay/dedup handled; test vectors published.

### Phase 5 — Messaging MVP

1:1 messaging over capsules: session protocol profile (forward-secrecy question resolved per CRYPTO_DESIGN.md), contact exchange, delivery acks as end-to-end capsules.

- Exit: usable 1:1 chat across at least two transports; external crypto review engaged (gate for any release).

### Phase 6 — Sovereign Rooms research and MVP

Room object model, operation log + merge rules, membership and key rotation design, room bundles. CRDT evaluation memo decides the document story.

- Exit: multi-member room converges under out-of-order delivery; decision ledger prototype.

### Phase 7 — Storage and documents

Encryption-at-rest with crypto-shredding key hierarchy, document/file objects with chunked blob handling, cache policy enforcement, emergency wipe, Vault Inspector.

- Exit: at-rest story reviewed; wipe semantics documented honestly per platform.

### Phase 8 — Local AI research and MVP

Runtime evaluation, model adapter interface, AI Privacy Guard, first feature (room summaries) — local-only, opt-in, provenance-labeled.

- Exit: AI respects modes/AIPolicy provably (tests); prompt-injection annex in threat model; zero network calls verified.

### Phase 9 — Desktop/PWA hardening

Tauri capability lockdown, CSP audit, PWA storage/eviction honesty pass, OS keychain integration, notification privacy.

- Exit: hardening checklist published in TRUST_CENTER.md with pass/fail per platform.

### Phase 10 — Security automation

Full privacy-regression suite (wire + disk assertions), security-regression suite, fuzzing of protocol parsers, SBOM generation, dependency policy automation, PBOM auto-diff.

- Exit: the guarantees documented in PRIVACY_MODEL.md that are machine-checkable are machine-checked in CI.

### Phase 11 — Alpha release

Signed builds, reproducibility investigation, release process, known-limitations sheet, coordinated external review of release candidate.

- Exit: an honest alpha: clearly labeled experimental, with TRUST_CENTER.md accurately describing what has and has not been verified.

---

## Work categories

Roadmap items fall into four categories; the technical phase numbering above is unchanged by the others:

- **TECH** — product/engineering phases (the numbered phases above; e.g. TECH-05 Storage Policy + Write Barrier Hardening)
- **INFRA** — repository/CI/publication work
- **RESEARCH** — research and architecture passes that precede implementation
- **AUDIT** — regression suites, audits, verification passes

## Task tracks (prompt-level roadmap)

The macro phases above stay authoritative for sequencing; this is the finer-grained task view, tagged by category. ✅ = done.

### Foundation / governance

- ✅ TECH-01 Repository Foundation
- ✅ TECH-02 Architecture Decision Lock
- ✅ TECH-03 Monorepo/App Shell + Mechanical Guardrails
- ⬜ TECH-04 Policy Engine (Gate B)
- ✅ INFRA-01 GitHub Publication + Live CI
- ✅ INFRA-02 GitHub Live Audit + Public Experience Polish
- ✅ INFRA-03 Stabilize & Harden — AST-backed ESLint enforcement, unforgeable `PolicyDecision` (WeakSet), Node 24 LTS pin, coverage visibility, and a definitive [maintenance strategy](MAINTENANCE.md); full problem register in [PLATFORM_STATE_ANALYSIS.md](PLATFORM_STATE_ANALYSIS.md)

### Storage / network / metadata

- ✅ TECH-05 Storage Policy + Write Barrier Hardening — exit criteria met: StoragePolicy v0 exists (30 classes × 7 modes, default deny); Memory/Null providers hardened; encrypted persistent placeholder throws; write barrier requires exact-scope `PolicyDecision`; forbidden-storage guardrail extended (browser storage/DB/caches/cookies/beacons/fs/Deno/Bun/Tauri) and self-tested; 37 storage regression tests pass (incl. the 20 required privacy invariants); PBOM + Trust Center updated; no direct storage APIs in source (CI-guarded)
- ✅ TECH-06 Memory/Null Storage Hardening — exit criteria met: provider contract v2 (results, metadata-only lists, honest flags); memory provider clone-at-boundaries with uncloneable-value rejection; null provider structurally stateless; key validation (no echo); redacted error model with sentinel leak tests across errors/console/lists; zero-persistence regression harness (incl. runtime web-storage-untouched check); guardrail v2 (service worker, `promises.writeFile`, Deno/Bun, sqlite, Tauri fs) with fixture self-tests incl. markdown-safe behavior; research notes + precheck + audits ([audits/TECH_06_STORAGE_HARDENING_AUDIT.md](audits/TECH_06_STORAGE_HARDENING_AUDIT.md)); 78 tests green
- ✅ TECH-07 Ghost/Bunker Zero-Persistent-Writes Deep Verification — exit criteria met: zero-persistence assertion layer (`isZeroPersistenceMode`, fail-closed `isPersistentBackend`, tuple assert); resolver fails closed on unknown mode/class/backend; runtime persistence-API traps with positive controls and honest absent-API coverage; 8×22+ provider matrix; mode-transition no-auto-flush proofs; spool/cache/log strict-mode suites; artifact sentinel scan; guardrail v3 (File System Access API tokens) with fixture tests; research + threat-model + audit docs; 116 tests green
- ✅ TECH-08 NetworkPolicy — exit criteria met: NetworkPolicy v0 (13 operations × 12 transports × 7 modes, default deny, fail-closed unknowns, strictest-wins room composition); network side-effect barrier with exact-scope decisions; Noop/MockNetwork transports (`performsRealNetwork: false`); endpoint validation (redacted); metadata leakage labels; forbidden-network guardrail (`check:no-forbidden-network`, in CI + `audit:privacy`) with fixture tests; runtime egress trap with positive controls; research + threat-model + audit docs; 41 new tests (157 total)
- ✅ TECH-09 Zero-Egress Default Build Tests — exit criteria met: static source scan (host-allowlist + CLI modes), build-artifact zero-egress scanner (real `apps/web/dist` clean), runtime egress trap (load path calls nothing; positive controls fire), broadened remote-asset scan, network-dependency scanner, service-worker audit (none exists), GitHub Actions egress audit (GitHub-only), app/runtime vs dev/CI egress distinction; research + threat-model + audit docs; 11 new tests (168 total)
- ⬜ AUDIT-HARD Browser-level zero-egress E2E (Playwright over served build — deferred from TECH-09)
- ✅ TECH-10 Metadata Firewall — exit criteria met: MetadataPolicy v0 (40 events × 12 sinks × 7 modes, default-deny, fail-closed, strictest-wins); metadata side-effect barrier reusing the WeakSet `PolicyDecision` provenance; receipts/typing/presence denied in Private+; notifications/link-preview/external-asset/telemetry/AI metadata denied; v0 invariant (no metadata persists or egresses); redacted audit events + payloads (sentinel-free); `check:no-metadata-bypass` guardrail (in CI + `audit:privacy`); StoragePolicy/NetworkPolicy integration tests; research + threat-model + reconciliation + precheck + audit docs; 47 new tests (220 total).
- ✅ TECH-11 Link Preview / External Asset Blocking — exit criteria met: `LinkPreviewPolicy` + `ExternalAssetPolicy` (all automatic previews + 16 remote-asset kinds denied in every mode, room tighten-only, sealed redaction); pure `classifyUrl` URL classifier (query/credential redaction, dangerous-scheme denial, zero network); `renderPlainTextUrlLabel` safe renderer; hardened `check:no-external-assets` (CDNs/protocol-relative/connection-hints/favicon/OpenGraph) + fixtures, `check:no-network-deps` (scraper packages), `check:no-metadata-bypass` (unfurl/favicon/avatar fetchers); Metadata/Network/Storage integration tests; [WEB_SECURITY_HEADERS.md](WEB_SECURITY_HEADERS.md); research + threat-model + precheck + audit docs; 24 new tests (257 total).
- ✅ TECH-12 Notification Privacy Model — exit criteria met: `NotificationPolicy` (operation × content-class × surface taxonomy; default-deny, fail-closed, strictest-wins); permission requests / push / service-worker / badge / sound / vibration / all OS surfaces denied every mode; sensitive content denied every mode; only a generic content-free memory-only in-app indicator allowed (Standard/Private); notification barrier reusing the WeakSet `PolicyDecision` provenance; `redactNotificationContent`; `check:no-notification-bypass` guardrail + fixtures + runtime notification trap; Tauri-plugin + service-worker/push audits (both absent); Metadata/Storage/Network integration tests; research + threat-model + precheck + audit docs; 29 new tests (286 total).
- ✅ TECH-13 Policy Matrix v1 — exit criteria met: canonical matrix (`packages/privacy/src/policyMatrix.ts`, 94 specs → 658 rules across 7 modes × 12 domains); `evaluatePolicyMatrix` (fail-closed, deny-overrides, strictest-wins, tighten-only room/ScreenShield composition); machine-readable export ([policy-matrix.v1.json](policy-matrix.v1.json)) with verbatim sync test; `check:policy-matrix` + `check:policy-docs` validators (in `audit:privacy` + CI); 34 coverage + cross-engine agreement tests (Storage/Network/Metadata/LinkPreview/ExternalAsset/Notification all agree); [POLICY_MATRIX.md](POLICY_MATRIX.md) human summary; research + threat-model + precheck + audit docs; 320 tests total.
- ✅ TECH-14 Policy Conflict Regression Suite — exit criteria met: 17 first-class conflict categories + deterministic redacted `explainPolicyConflict`; cross-policy assertion helpers comparing REAL resolver outcomes against the matrix (Storage/Network/Metadata/LinkPreview/ExternalAsset/Notification all agree); composition safety (room/feature tighten-only, Emergency override, Offline denial); gated features not executable; unknown inputs deny everywhere; intentional-contradiction fixtures (48+10 findings) proving the validator detects each category; `check:policy-conflicts` (matrix invariants + Trust Center overclaim scan + docs statements + endpoint-monitoring/push dependency ban) in `audit:privacy` + CI; anti-spyware externalization documented and enforced ([audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md](audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md)); [audits/POLICY_CONFLICT_REPORT.md](audits/POLICY_CONFLICT_REPORT.md) — 0 conflicts; 17 new tests (337 total).
- ✅ TECH-15 Policy Developer Experience + Contributor Workflow — exit criteria met: [CONTRIBUTOR_WORKFLOW.md](CONTRIBUTOR_WORKFLOW.md) (setup → PR → policy-change → gate → anti-spyware-integration workflows + required commands), [POLICY_DEVELOPER_GUIDE.md](POLICY_DEVELOPER_GUIDE.md) (add-a-row procedure + honest-marking rules + worked examples), [COMMANDS.md](COMMANDS.md) + `check:all`; PR template hardened (impact questions, matrix/PBOM/Trust-Center checklist, anti-spyware boundary confirmation, commands-run block); 4 new issue forms (privacy bug, policy change, feature gate, Gate R integration); [ADR_WORKFLOW.md](ADR_WORKFLOW.md) + ADR template; CODEOWNERS extended + honest [CODEOWNERS audit](audits/CODEOWNERS_REVIEW_AUDIT.md); [OpenSSF readiness checklist](audits/OPENSSF_READINESS_CHECKLIST.md) (no badge/score claimed); [LABELS.md](LABELS.md) + [DOCS_CANONICAL_WORKFLOW.md](DOCS_CANONICAL_WORKFLOW.md); `check:contributor-workflow` validator (in CI); SECURITY/GOVERNANCE/CONTRIBUTING updated (solo-dev honesty, no-real-secrets, externalized anti-spyware); 11 new tests (348 total).
- ✅ TECH-16 RoomOS Foundation / Sovereign Room Data Model — exit criteria met: `packages/rooms` foundation (branded placeholder IDs, lifecycle/kind/trust states, 12-kind object taxonomy with data-class/sensitivity meta, 18-operation taxonomy with `_placeholder` honesty); `RoomPolicy` v1 (tighten-only; nothing persists/syncs/notifies/infers in any mode; Emergency denies normal mutation; Bunker redacts titles); room barrier reusing the WeakSet `PolicyDecision` provenance with exact `room.*` scopes; versioned memory-only operation events (`local:` timestamps, sequence IDs); pure rebuildable projection (NOT merge — Gate H open); redacted room audit; `createLocalRoom` factory; 9 new matrix rows (103 specs → 721 rules; `room.sync` pinned `future_gate`); `check:no-roomos-bypass` guardrail + fixtures; Storage/Metadata/Network/Notification/Matrix integration tests; research + threat-model + precheck + audit docs; 21 new tests (369 total). No CRDT/crypto/network/anti-spyware dependency added; Gate H still deferred; anti-spyware remains externalized. **Next: TECH-17 — RoomOS Local Operation Log + Projection Regression Suite**
- ✅ TECH-17 RoomOS Local Operation Log + Projection Regression Suite — exit criteria met (stacked on TECH-16): log-grade `RoomOperationEventV1` (schemaVersion/projectionVersion 1, branded `RoomEventId`/`RoomLocalSequence`, typed operation-specific payload union rejecting unknown fields); injected clock/ID creation boundary; fail-closed internal validators (explicitly NOT hostile-input parsers — Gate E); explicit lifecycle state machine (tombstone terminal, not forensic deletion); pure exhaustive reducer + deterministic replay (validate-all-then-apply, no partial state, no sort/dedupe/skip, complete replay starts at sequence 1); `InMemoryRoomOperationLog` (clone-on-append/read, unique IDs, contiguous sequences) + `NullRoomOperationLog` (retains nothing); **separate exactly-scoped decisions** for mutation vs log append/read/clear; 4 new matrix rows (107 specs → 749 rules; `room.project.snapshot` future-gated); guardrail determinism checks (`Date.now`/`Math.random`/`new Date` banned in replay modules, `JSON.stringify(event` banned shipped); 15 golden fixtures + deterministic sequence generators; 30 new tests (399 total); research + threat-model + precheck + boundary + audit docs. Gate H still deferred; no crypto/sync/identity; anti-spyware externalized. **Next: TECH-18 — RoomOS Object Model v1 + Policy-Gated Local Mutations**
- ✅ TECH-18 RoomOS Object Model v1 + Policy-Gated Local Mutations — exit criteria met (stacked on TECH-17): concrete local objects (message/note/task/decision/poll/file_ref) with explicit versioned schemas over a common envelope; plain-text-only content with UTF-8 byte limits + bounded arrays + NUL/surrogate/proto-pollution/getter defenses; an explicit **command union** (no generic `object.patch`/`set_property`/`merge_payload`/`json_patch`) validated fail-closed; local `revision` optimistic concurrency (create→1, +1 per mutation, stale/future/missing/overflow reject) — explicitly not distributed/causal/tamper-proof; deny-by-default policy-gated pipeline (`applyLocalRoomObjectMutationV1`) with **separate exact-scoped decisions** for mutation vs object-log append, Policy-Matrix cross-check, and logical all-or-nothing at the in-memory boundary; deterministic operation-specific events + pure reducer + memory/null object log + replay; explicit lifecycle/status machines (archived read-only, redaction one-way, tombstone terminal, not forensic erasure); file refs hold an opaque `localRefId` only (no bytes/path/URL); poll voting/tallies absent (Gate G/H); 12 new matrix rows (120 specs → 840 rules); `check:no-room-object-bypass` guardrail + fixture + CI; 33 new tests (432 total); research + threat-model + precheck + boundary + audit docs; Gate V + schema-evolution note. No transport/sync/CRDT/crypto/identity/AI/anti-spyware; not safe for real secrets. **Next: TECH-19 — RoomOS Privacy-Safe Local Query Model + Policy-Gated Views**
- ✅ TECH-19 RoomOS Privacy-Safe Local Query Model + Policy-Gated Views — exit criteria met (from merged TECH-18): a side-effect-free, policy-gated READ boundary (`packages/rooms/src/query/`) over an immutable, defensively-cloned snapshot — never the operation log. Query taxonomy (summary/list/detail/search/tasks/decisions/polls/file_refs/counts; unknown denies); privacy-safe view classes (summaries carry no content; content detail only where policy allows; requested view downgrade-only); exact-scope authorization (`room.query.summary/list/detail/search/count` — object IDs/actor refs confer no authority; list≠detail≠search≠count; mutation/storage cannot authorize a query); structured filters + deterministic sorting (object-ID tie-breaker; source never mutated); bounded local cursors (default 25/max 100/search 50; not authority, not persisted, content-free); exact case-sensitive in-memory search only (no index/history/cache/snippet/regex/fuzzy; term never logged; redacted/tombstoned never searched); counts off by default behind their own scope; strict-mode redaction (Ghost/Bunker/Emergency suppress actor refs/timestamps/revisions/counts; Bunker denies content+search); 11 new matrix rows (131 specs → 917 rules; semantic/remote/Bunker-content future-gated); `check:no-room-query-bypass` guardrail + fixture + CI; 28 new tests (460 total); research + threat-model + precheck + boundary + audit docs; Gate W. Side-effect-free (no event/log/storage/network/notification/AI/endpoint — trapped). No remote API/sync (Gate H), no encrypted index (Gate F), no identity (Gate G), no semantic search (Gate I); endpoint defense externalized (no capture protection); not safe for real secrets. **Next: TECH-20 — RoomOS Membership Model v1 + Local Capability Scaffolding**
- ✅ TECH-20 RoomOS Membership Model v1 + Local Capability Scaffolding — exit criteria met (from merged TECH-19): local, UNVERIFIED membership records (`packages/rooms/src/membership/`) held memory-only in `RoomMaterializedState`; placeholder roles (owner/editor/viewer/auditor) as ABAC attributes via an explicit role→capability eligibility table (role eligibility necessary, never sufficient); membership lifecycle machine (active↔suspended→removed_tombstone; tombstone terminal; duplicate/stale-revision reject); **last-owner continuity invariant** (last active owner cannot be removed/suspended/demoted); non-authoritative capability descriptors bound to room+membership+revision (`authoritative:false`, serialization/persistence forbidden, delegation not implemented, no wildcard) with attenuation (narrow-only; widening/subset-checked) + currency/staleness binding; `assertRoomAuthorizationContextV1` requires current membership + current descriptor + an **authentic exact-scope PolicyDecision** (descriptor never authorizes alone); membership mutation pipeline (separate mutation vs membership-log decisions; owner continuity; deterministic events + pure reducer + memory/null log); redacted membership queries (list/get/count, own scopes, no identity/presence/descriptor); local revocation (not distributed — Gate H); 18 new matrix rows (149 specs → 1043 rules; capability persist/serialize deny, delegate not_implemented, invite/identity_verify/distributed_revocation/endpoint_risk future-gated); `check:no-room-membership-bypass` guardrail + fixture + CI; 21 new tests (481 total); research + threat-model + precheck + boundary + audit docs; Gate X. No identity/invites/crypto/sync/distributed-revocation/endpoint-defense; device-risk placeholder tightens only, never identity assurance; not safe for real secrets. **Next: TECH-21 — RoomOS Membership Revocation + Authorization Regression Suite**
- ✅ TECH-21 RoomOS Membership Revocation + Authorization Regression Suite — exit criteria met (stacked on TECH-20): a centralized, fail-closed LOCAL authorization layer (`packages/rooms/src/authorization/`) proving membership/policy changes invalidate stale local authority before execution. `prepareRoomAuthorizationV1` binds a `RoomAuthorizationRevisionV1` fence (room + membership revision + local policy revision + lifecycle + privacy mode) + significant operation data into a non-authoritative, transient, non-serializable context; `assertPreparedRoomAuthorizationCurrentV1` is the FINAL execution-time gate re-checking the fence against CURRENT state + an authentic exact-scope `PolicyDecision` (a prepare is never sufficient; no auto-refresh). Suspension/removal/role-downgrade/reactivation + room-policy tightening + privacy-mode transitions (incl. less-restrictive) + lifecycle changes all invalidate prepared contexts; capability-SET role comparison (`compareRoleAuthorityV1`) + change-direction classifier; `applyLocalMembershipRevocationV1` enforces restrictive-direction (no escalation smuggling) + current-projection owner continuity with no partial effects; content-free `LocalAuthorizationInvalidationReportV1` (`current_local_projection_only`, `distributedRevocation:false`); a `policyRevision` field on `RoomMaterializedState` + deterministic fingerprint fallback; strict **no-authorization-cache** rule ([cache audit](audits/ROOM_AUTHORIZATION_CACHE_AUDIT.md)); 8 new matrix rows (157 specs → 1099 rules; cache/persist/serialize deny, endpoint-assurance deny, distributed/signed revocation future-gated); `check:no-room-authorization-bypass` guardrail + fixture + CI; 19 new tests (500 total); research + threat-model + precheck + boundary + cache + audit docs; Gate Y. Local only — no distributed/signed revocation, no identity, no authorization server, no single-use decisions (Gate B), no endpoint assurance; not safe for real secrets. **Next: TECH-22 — RoomOS Room Policy Composition v1 + Governance Constraints**
- ✅ TECH-22 RoomOS Room Policy Composition v1 + Governance Constraints — exit criteria met (stacked on TECH-21): one deterministic, fail-closed policy-composition model (`packages/rooms/src/policy-composition/`) with **deny-overrides + strictest-policy-wins** over a fixed layer taxonomy; a versioned tighten-only `RoomPolicyDocumentV1` + mode-aware defaults + monotonic `compareRoomPoliciesV1` (only `stricter` succeeds); the **DevicePosture contract** (`unverified`/`basic`/`hardened`/`high_assurance`/`managed_bunker`/`at_risk`) with a fail-closed resolver — **no provider integrated**, untrusted claims cannot elevate, `at_risk` always tightens, unknown/missing → `unverified`; explicit minimum-posture ordering (core can satisfy only `unverified`); protected-content requirements that **deny display when integration is absent** (no active-protection claim); `resolveSensitiveRoomAdmissionV1` (content denies without provider, redacted summary allowed); owner-only tighten-only governance pipeline (`applyLocalRoomGovernanceUpdateV1`) bound to policy revision + posture via the extended TECH-21 authorization fence; content-free conflict reports + governance events; 14 new matrix rows (171 specs → 1197 rules; loosen/elevate/claim-active/persist deny; verify/require/secure-device/consensus/signed future-gated); `check:no-device-posture-or-governance-bypass` guardrail + fixture + CI; 21 new tests (521 total); research + threat-model + precheck + boundary + audit docs; **Secure Device is EXTERNALIZED** (separate project) with a future Secure Device Integration Gate + Gate Z. Local only — no real posture verification, no ScreenShield/ProtectedContent runtime, no signed/distributed/verified governance (Gates F/G/H), no MDM/GrapheneOS/anti-spyware in core; not safe for real secrets. **Next: TECH-23 — Sensitive Room Admission + Secure Device Integration Contract**
- ✅ TECH-23 RoomOS Sensitive Room Admission + Secure Device Integration Contract — exit criteria met (stacked on TECH-22): a narrow, privacy-minimized boundary (`packages/rooms/src/secure-device/`) through which a FUTURE **external** Secure Device provider could supply a normalized posture result. FreeLayer core is modeled as the **RATS Relying Party only** (RFC 9334): explicit Attester/Verifier/Relying-Party roles (`SecureDeviceIntegrationRoleV1`), a versioned provider port (`SecureDeviceProviderPortV1`), a deterministic **Null provider** (`NullSecureDeviceProviderV1`, side-effect-free, reports `not_integrated`, returns `unverified`), a normalized **transient** `DevicePostureAssessmentV1` guarded by a module-private provenance registry (`isAcceptedDevicePostureAssessmentV1`, non-cryptographic — Gate F) that rejects evidence-bearing/forged objects; **current-process-only** freshness (`DevicePostureFreshnessPolicyV1`: no trusted clock/nonce/epoch, no cross-restart validity, revision rollback rejected); 11 explicit `SensitiveRoomAdmissionActionV1` × 13 fail-closed `SensitiveRoomAdmissionOutcomeV1`; a 14-step deterministic `resolveSensitiveRoomAdmissionV1` (untrusted elevation reduced to `unverified`; `at_risk` denies content; unavailable/stale provider denies posture-gated content; ScreenShield/Bunker requirements deny safely; redacted summary separately gated); a transient current-process `SensitiveRoomSessionV1` that invalidates on posture/provider/policy/membership/mode/lifecycle/action change (never silently refreshed); data-only `ProtectedContentIntentV1` future hooks; content-free error taxonomy; **raw evidence, device identifiers, assessment history, and app inventory are structurally forbidden**; 24 new matrix rows (195 specs → 1365 rules); `check:no-secure-device-core-implementation` guardrail + fixture + CI; new privacy/security regression suites + synthetic fixtures + sentinel leak/side-effect traps; research + threat-model + precheck + roadmap-reconciliation + boundary + audit docs; the **Secure Device Integration Gate** expanded. No provider, no attestation, no GrapheneOS management, no MDM, no anti-spyware, no ScreenShield/Bunker runtime in core; posture above `unverified` cannot currently be established; `at_risk` can only restrict; not safe for real secrets. **Next: RESEARCH-ID-01 — Identity Competitor + Threat Research (read from the canonical roadmap)**

### Secure Device externalization (project separation)

Anti-spyware / Endpoint Defense / ScreenShield / device management is developed as a **separate standalone Secure Device project**. FreeLayer core does **not** return to an endpoint-defense implementation track; it keeps only interfaces, policy inputs, minimum-posture requirements, protected-content requirements, and disclosures. Real integration requires the future **Secure Device Integration Gate** (ADR + provider trust model + posture provenance/freshness/anti-replay + compromised-provider threat model).

### Identity Firewall (Gate G)

- ⬜ Local identities · ephemeral identities · per-contact/room aliases · one-time invites · QR verification · recovery kit design

### CapsuleNet (Gate E)

- ⬜ Wire format draft · hostile-input parser · fuzz harness · test vectors · inbox/spool/quarantine · QR/file/bundle transports

### Crypto (Gate F)

- ⬜ Library evaluation · protocol profiles (offline exchange, interactive messaging) · crypto ADR · facade implementation · test vectors · external review

### Messaging (Phase 5)

- ⬜ Contact model · conversation model · protected rendering (depends on ScreenShield/ProtectedContent) · mock/file capsule send/receive · end-to-end delivery acks

### Sovereign Rooms (Gate H)

- ⬜ Operation-log vs CRDT evaluation memo → ADR · membership/key rotation design · messages/notes/tasks/decisions objects · room bundles

### Documents / files (Phase 7)

- ⬜ Protected documents · file capsules · metadata stripping on import · local search index (policy-governed)

### Local AI (Gate I)

- ⬜ Runtime research · AIPolicy · AI Privacy Guard · prompt-injection annex · local summaries MVP

### Hardening / release (Phases 9–11)

- ⬜ Tauri hardening · PWA hardening · parser fuzzing · SBOM/PBOM automation · signed releases · alpha checklist (Gate J)

## Endpoint Defense / ScreenShield track (ADR-0012) — EXTERNALIZED

> [!IMPORTANT]
> **The anti-spyware / Endpoint Defense / ScreenShield implementation has been split into a separate standalone project** (TECH-14 direction update). FreeLayer core keeps **policy hooks and compatibility contracts only** — ScreenShield levels as policy-tightening inputs, endpoint data classes/metadata events, matrix rows marked `future_gate`, docs/PBOM/Trust Center honesty. Once the standalone project is completed, it may be integrated through the dedicated **Endpoint Defense / Anti-spyware Integration Gate** ([IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)) with its own ADR, threat model, PBOM update, and native-permission audit. The concept remains part of the product vision; only the _implementation location_ changed. Enforcement: [audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md](audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md).

- ✅ RESEARCH-EDL-01 — Endpoint Defense + ScreenShield Research and Architecture (informs the external project; the research stays canonical here)
- ▸ TECH-EDL-02 … AUDIT-EDL-14 — **externalized** to the standalone anti-spyware project (ScreenShield policy schema, ProtectedContent contract, secure surfaces, clipboard/input firewalls, anti-overlay, device risk engine, capture-aware rooms, protected/sealed view, panic/decoy, canary/watermark, regression tests, audit). FreeLayer core tracks only the **integration gate**.

## Infrastructure track (separate from the technical phases)

The technical phase numbering above is unchanged by infrastructure work. Infra milestones:

- **Wiki refresh at first easy install** _(scheduled TODO)_: when an installable release exists (Phase 11 / Gate J), rewrite the wiki for end users — real installation steps in Getting-Started, fuller plain-language explanations on Home/FAQ — and publish via `pnpm wiki:publish`. Until then the wiki honestly says there is nothing to install.
- **Infra-01 — GitHub publication + live CI** _(this pass)_: public repository at <https://github.com/XGiammyX/freelayer>, README as a complete public landing page, GitHub Actions validated live, CI validation PR, security settings checklist ([GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md)), branch protection applied or documented ([GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md)), live results in [LIVE_CI_REPORT.md](LIVE_CI_REPORT.md). GitHub is the development platform only — never a runtime dependency.

## Cross-cutting rules

- Every phase: research → design → implementation → tests → audit.
- No phase may weaken a hard constraint to ship faster.
- THREAT_MODEL.md, PRIVACY_MODEL.md, and PBOM.md are re-reviewed at every phase boundary.

## Risks to this roadmap

- Crypto review (Phases 4–5) is the likeliest bottleneck — external review takes time and possibly funding.
- Serverless group messaging (Phase 6) has genuine unsolved-research flavor; scope may need cutting rather than corner-cutting.
- Solo/small-team bus factor; mitigated by documentation-first culture.

## TODO

- [ ] Attach issues/milestones to Phase 0–1 items once the repository is public
- [ ] Define "definition of done" checklists per phase in issue templates
- [ ] Revisit phase ordering after Phase 2 (policy engines may reshuffle storage vs. identity order)
