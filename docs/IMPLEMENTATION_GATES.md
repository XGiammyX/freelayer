# Implementation Gates

[← Docs Index](README.md) · [Roadmap](ROADMAP.md) · [ADRs](adr/README.md)

> [!NOTE]
> Gates decide **whether** work may start; the roadmap decides **when**. A closed gate blocks implementation regardless of schedule pressure — that ordering is the project's core discipline.

## Purpose

Hard preconditions between design and implementation. A gate is **closed** until every criterion is met; work belonging behind a closed gate does not begin, regardless of schedule pressure. Gates encode the project rule that every major feature follows **research → design → implementation → tests → audit** — they are the checkpoints where that order is enforced.

Gates compose with the roadmap ([ROADMAP.md](ROADMAP.md)): phases schedule *when* work happens; gates define *whether it may*.

## Current status

**Gate A satisfied** (Prompt 03 + Infra-01): monorepo builds, all guards and tests pass locally and on hosted CI ([LIVE_CI_REPORT.md](LIVE_CI_REPORT.md)). **Gates B–J remain closed.** Infra Gate 1 satisfied — see below.

---

## Gate A — Foundation

*Opens: workspace implementation (Phase 1).*

- [x] Monorepo exists and builds: 12 packages + 4 apps compile with strict TypeScript (verified locally)
- [x] CI green: typecheck/lint/test/build + all four guards passing on hosted GitHub Actions (verified 2026-07-08 — [LIVE_CI_REPORT.md](LIVE_CI_REPORT.md))
- [x] Zero external assets verified (CI guard `check:no-external-assets` — [NO_EXTERNAL_ASSETS_POLICY.md](NO_EXTERNAL_ASSETS_POLICY.md); fails on planted violations)
- [x] Zero telemetry verified (CI guard `check:no-telemetry`)
- [x] License finalized: AGPL-3.0-or-later code, CC BY-SA 4.0 docs ([ADR-0011](adr/ADR-0011-license-strategy.md))
- [x] ADR system exists ([docs/adr/](adr/), ADR-0001…ADR-0011 accepted)
- [x] Dependency-direction guard exists as a **baseline** (`scripts/check-boundaries.mjs`); stronger AST/graph tooling (dependency-cruiser or eslint-plugin-boundaries) remains a tracked TODO per [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md)

## Gate B — Policy Engine

*Opens: any side-effectful feature (Phase 2 exit).*

- [ ] Policy schema: Privacy Modes expressed as a versioned schema in `packages/privacy`
- [ ] Core operation pipeline implemented: validate → classify → resolve policies → decide → execute → audit
- [ ] Strictest-policy-wins conflict resolution implemented and tested ([PRIVACY_MODEL.md](PRIVACY_MODEL.md))
- [ ] `PolicyDecision` object defined and required by all side-effect modules — calls without one are rejected ([ADR-0002](adr/ADR-0002-core-enforced-policy-engine.md))
- [ ] First privacy-regression tests running in CI against real policy behavior

## Gate C — Storage

*Opens: any feature that persists data (Phase 2/7).* **Status: PARTIAL — the policy/barrier half is done (TECH-05); real persistence remains blocked by Gate F.**

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

*Opens: any networked transport (Phase 4).*

- [ ] NetworkPolicy defined and enforced through core ([NETWORK_MODEL.md — Network side-effect barrier](NETWORK_MODEL.md))
- [ ] Zero-egress test for the default build: no network calls not explicitly user-initiated
- [ ] No remote assets (CI guard, [NO_EXTERNAL_ASSETS_POLICY.md](NO_EXTERNAL_ASSETS_POLICY.md))
- [ ] No telemetry endpoints (CI guard)
- [x] Transport leakage labels defined per transport — `describeNetworkMetadataLeakage` (TECH-08, [METADATA_MODEL.md](METADATA_MODEL.md))
- [x] "Bunker: no direct-IP transport" test passing (WebRTC denied Private+, TECH-08)
- [x] NetworkPolicy v0 + side-effect barrier + forbidden-network guard + runtime egress trap (TECH-08)
- [x] Zero-egress *default-build* verification (TECH-09): source scan + build-artifact scan + runtime trap + dependency scan + service-worker audit + GitHub Actions egress audit ([audit](audits/TECH_09_ZERO_EGRESS_AUDIT.md)); full in-browser E2E deferred to AUDIT-HARD

## Gate M — Metadata Firewall (TECH-10)

*Opens: any feature that could emit a metadata signal (receipts, typing, presence, notifications, previews, network timing).*

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

*Opens: any UI that renders user-provided URLs or could load a remote asset.*

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

*Opens: any feature that would show a notification, request permission, set a badge, or use push/service workers.*

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

*Opens: any change to privacy/security policy behavior (all future feature work consults this gate).*

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

*Opens: permanently active — any policy-behavior PR must keep the conflict suite green.*

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

## Gate S — Contributor Workflow Gate (TECH-15)

*Opens: permanently active — the governance surface must stay intact (`check:contributor-workflow` in CI).*

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

*Opens: only when the standalone anti-spyware project is completed and its integration is proposed.*

The anti-spyware / Endpoint Defense / ScreenShield **implementation is externalized** to a separate project; FreeLayer core keeps **policy hooks only** (ScreenShield levels as tightening inputs, endpoint data classes/metadata events, `future_gate` matrix rows). Integration requires ALL of:

- [ ] A dedicated ADR proposing the integration
- [ ] An integration threat model (per-OS capture/clipboard/overlay behavior, honest limits)
- [ ] PBOM update (every native capability, dependency, and permission enumerated)
- [ ] Trust Center update (what is actually protected, what is not)
- [ ] Native-permission audit (Tauri capabilities scoped to exactly what policy allows)
- [ ] No overclaims: integration must not claim protection against compromised endpoints or cameras ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md))

Until this gate opens, any endpoint-monitoring dependency or active-protection claim in core is a policy conflict (`check:policy-conflicts` fails).

## Gate E — Capsule Parser

*Opens: processing any externally-produced capsule (Phase 4).*

- [ ] Capsule wire format draft complete in `packages/protocol` with version + algorithm identifiers
- [ ] Hostile-input parser: strict schema validation, no unbounded structures ([CAPSULENET.md](CAPSULENET.md))
- [ ] Explicit size limits at every level
- [ ] Explicit recursion/depth limits
- [ ] Quarantine path for unknown/undecryptable/malformed capsules implemented
- [ ] Fuzz tests exist and run in CI for every parser
- [ ] Test vector format defined; vectors published
- [ ] Deterministic replay/dedup design complete and tested

## Gate F — Crypto

*Opens: any cryptographic implementation (Phases 4–5).*

- [ ] [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md) specifies the construction with cited prior art
- [ ] Design reviewed per [ADR-0004](adr/ADR-0004-no-crypto-implementation-before-review.md) / [ADR-0009](adr/ADR-0009-security-sensitive-pr-review-rules.md) — no implementation before review
- [ ] Library selected via documented evaluation (its own ADR)
- [ ] Test vectors defined; interop vector publication plan exists
- [ ] No custom primitives anywhere (verified in review)
- [ ] External review plan (scope, reviewers, funding) committed before any release claims trust

## Gate G — Identity

*Opens: Identity Firewall implementation (Phase 3 exit).*

- [ ] No phone/email anywhere in the identity model (hard constraint, verified in design review)
- [ ] Local identity model documented (multiple identities per install, ephemeral identities)
- [ ] Invite model designed (one-time invites, no directory service)
- [ ] Verification model designed (QR + short-code, PAKE-inspired)
- [ ] Device key model designed (device keys vs. identity keys, Ghost Vault compatibility)
- [ ] Recovery trade-offs documented bluntly (no central recovery — key loss means data loss unless the user keeps a recovery kit)

## Gate H — Rooms

*Opens: Sovereign Rooms implementation (Phase 6).*

- [ ] Operation/CRDT model chosen via formal evaluation memo, recorded in a new ADR ([SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md))
- [ ] Out-of-order convergence tests defined and passing on the prototype
- [ ] Membership change and key-rotation design reviewed (crypto dependency, Gate F)
- [ ] Room bundle security design complete (stale-import safety, no rollback, no access resurrection)
- [ ] Decision ledger authenticity design complete (co-signing, verification)
- [ ] Unauthorized-operation rejection and dedup tests passing

## Gate I — AI

*Opens: any local AI feature (Phase 8). Mirrors the AI implementation gate in [LOCAL_AI.md](LOCAL_AI.md).*

- [ ] AIPolicy implemented in the policy engine
- [ ] AI Privacy Guard implemented (mode check, room-scoped input, provenance labels, storage-policy routing)
- [ ] Prompt-injection threat annex complete in [THREAT_MODEL.md](THREAT_MODEL.md)
- [ ] Zero-network AI test passing (default build performs no AI network calls)
- [ ] Prompt/cache no-log test passing
- [ ] Model supply-chain policy exists (sourcing, hashing, update policy)
- [ ] AI output provenance format defined
- [ ] [PBOM.md](PBOM.md) AI section complete (models, hashes, caches, embedding indexes, absence of network calls)

## Gate K — Endpoint Defense / ScreenShield

*Opens in stages (ADR-0012). ProtectedContent/ScreenShield design precedes serious messaging UI.*

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

*Opens: any public release, including alpha (Phase 11).*

- [ ] [TRUST_CENTER.md](TRUST_CENTER.md) updated and accurate for the release
- [ ] [PBOM.md](PBOM.md) updated and shipped as a release artifact
- [ ] SBOM generated (or generation plan documented with a deadline)
- [ ] Signed release process planned and keys published
- [ ] Known-limitations page updated
- [ ] Alpha/experimental warning visible in the product and release notes

---

## Infra Gate 1 — Public Repository and Live CI

*Infrastructure gate (separate from the technical A–J ladder). Opens: accepting external contributions at scale.*

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

## Rules

- Gate criteria may be **added** by PR review; removing or weakening a criterion requires GOVERNANCE-level review and, where it touches an ADR, a superseding ADR.
- A gate check that cannot be automated yet is verified manually in PR review and noted in [TRUST_CENTER.md](TRUST_CENTER.md).
- Gate status changes are recorded here and in the Trust Center in the same PR.

## TODO

- [ ] Convert each gate into a tracked GitHub milestone with issues when the repository is public
- [ ] Automate gate verification where possible (Phase 10)
