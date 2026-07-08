# Implementation Gates

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

*Opens: any feature that persists data (Phase 2/7).*

- [ ] Write barrier implemented: all persistence through StoragePolicy ([ADR-0005](adr/ADR-0005-storage-selected-only-by-policy.md))
- [ ] Memory-only and null providers working
- [ ] Encrypted-persistent placeholder provider defined (real encryption arrives with Gate F)
- [ ] "Ghost mode: zero persistent writes" test passing
- [ ] "Bunker mode: zero persistent writes" test passing
- [ ] No localStorage / direct storage-API usage in content paths (lint/CI check)

## Gate D — Network

*Opens: any networked transport (Phase 4).*

- [ ] NetworkPolicy defined and enforced through core ([NETWORK_MODEL.md — Network side-effect barrier](NETWORK_MODEL.md))
- [ ] Zero-egress test for the default build: no network calls not explicitly user-initiated
- [ ] No remote assets (CI guard, [NO_EXTERNAL_ASSETS_POLICY.md](NO_EXTERNAL_ASSETS_POLICY.md))
- [ ] No telemetry endpoints (CI guard)
- [ ] Transport leakage labels defined per transport ([METADATA_MODEL.md](METADATA_MODEL.md))
- [ ] "Bunker: no direct-IP transport" test passing

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
