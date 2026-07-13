# FreeLayer Trust Center

[← Docs Index](README.md) · [Threat Model](THREAT_MODEL.md) · [PBOM](PBOM.md) · [Security policy](../SECURITY.md)

> [!IMPORTANT]
> **Can I trust FreeLayer today? No — not with real secrets.** This page exists to tell you exactly why, what exists, what doesn't, and what has actually been verified.

## Purpose

One honest page answering: _how much should you trust FreeLayer right now?_ This document is updated at every phase boundary and every security-relevant event. It states what has been verified, what hasn't, and what "verified" even means at each stage.

## Can I trust FreeLayer today?

> **No. Not with real secrets yet.**
>
> FreeLayer is in the research and foundation stage. There is no implemented cryptography, no released software, and no audit. Every security property described in this repository is a **design intention**, not a verified guarantee.

In plain language:

- **What exists:** the public repository, the architecture constitution (12 ADRs), a typed monorepo with a small local-only status page, mechanical privacy guardrails in CI, and this documentation.
- **What does not exist:** encryption, messaging, rooms, networking, AI, endpoint protections, releases.
- **What is tested:** the scaffolding — policy resolution fails closed, storage/transport placeholders reject calls without policy approval, and CI guards fail on telemetry/external assets/boundary violations (verified on live CI).
- **What is not tested:** every actual security property — there is no crypto to test and no protocol to fuzz.
- **What GitHub checks exist:** CI, privacy-regression guards, CodeQL, dependency review, Dependabot, secret scanning + push protection, branch protection with required checks.
- **What is still only design:** everything a user would call "the product."
- **What limitations are permanent:** compromised devices, malicious room members, cameras pointed at screens, and global traffic analysis are outside what FreeLayer (or anyone) can fully solve — see [THREAT_MODEL.md](THREAT_MODEL.md).

## Claim-by-claim status

| Claim              | Current status                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| No telemetry       | Guardrail active: `check:no-telemetry` fails CI on known SDKs; none exist                         |
| No external assets | Guardrail active: `check:no-external-assets` fails CI on CDN/font patterns; none exist            |
| No crypto          | Intentionally not implemented — the only provider throws (ADR-0004)                               |
| No central backend | Architecture rule (ADR-0001); nothing in the repo contacts a FreeLayer server because none exists |
| ScreenShield       | Research/design only (ADR-0012) — no screenshot blocking implemented                              |
| Safe for secrets   | **No**                                                                                            |

## Trust level

**Current trust level: Design/foundation only. Do not use for real secrets.**

This line is updated only when verified reality changes — never ahead of it.

## Current maturity

| Area                                   | Status                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture Decision Lock (Phase 0.5) | **Complete** — ADR-0001…ADR-0011 accepted; see [docs/adr/](adr/) (external design review still pending)                                                                 |
| Monorepo / app shell (Phase 1)         | **Started** — typed scaffolding + minimal local-only web status page; no product behavior                                                                               |
| Product features                       | **None implemented** — no chat, no rooms, no capsules, no real networking                                                                                               |
| Cryptography                           | **Not implemented** — deliberately ([CRYPTO_DESIGN.md](CRYPTO_DESIGN.md), [ADR-0004](adr/ADR-0004-no-crypto-implementation-before-review.md)); the only provider throws |
| Local AI                               | **Not implemented** — the only provider rejects ([ADR-0007](adr/ADR-0007-local-ai-disabled-by-default.md))                                                              |
| Design documents                       | Initial drafts, not externally reviewed                                                                                                                                 |
| External audit                         | None                                                                                                                                                                    |
| Releases                               | None                                                                                                                                                                    |
| Security posture                       | **Design-only** — every property is a documented intention; none are verified                                                                                           |

### Repository and CI (Infra-01)

| Item                                              | Status                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public repository                                 | <https://github.com/XGiammyX/freelayer> — GitHub is the development platform only; the runtime has no GitHub dependency                          |
| CI (typecheck/lint/test/build + 4 privacy guards) | Live status: see [LIVE_CI_REPORT.md](LIVE_CI_REPORT.md) and the badges on the README                                                             |
| CodeQL                                            | Workflow present (security-extended); results under the Security tab                                                                             |
| Dependency review                                 | Workflow present; runs on every PR                                                                                                               |
| Branch protection                                 | See [GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md) / [GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md) for the verified state |

Unchanged by publication: **no release, no production-ready crypto, no chat, no AI — do not use for real secrets.**

### Endpoint Defense / ScreenShield (RESEARCH-EDL-01)

The Endpoint Defense Layer is now an official **design pillar** (ADR-0012) — and nothing more yet:

| Area                  | Status          |
| --------------------- | --------------- |
| ScreenShield design   | Initial docs    |
| Platform protections  | Research stage  |
| ProtectedContent      | Not implemented |
| Clipboard Firewall    | Not implemented |
| Secure Input Firewall | Not implemented |
| Device Risk Engine    | Not implemented |

Plainly: **no endpoint protections are implemented, no screenshot blocking exists, and there is no spyware-protection guarantee — device compromise remains a major limitation.** Future trust status will be platform-specific ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md)).

### Storage layer (TECH-05)

The storage layer now has foundation-level policy tests, but **FreeLayer still does not provide production-grade encrypted storage** — nothing persists at all.

| Piece                                                                     | Status                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| StoragePolicy v0 (mode × data-class matrix, default deny, strictest wins) | Implemented + regression-tested                                                 |
| Write barrier (exact-scope `PolicyDecision` required per operation)       | Implemented + regression-tested                                                 |
| MemoryStorageProvider / NullStorageProvider                               | Implemented, hardened (no browser/filesystem APIs, values never in errors/logs) |
| Encrypted persistent storage                                              | **Not implemented** — throwing placeholder (Gate F)                             |
| Real message/room storage                                                 | **Does not exist** — no crypto, nothing persists, not safe for real secrets     |

**TECH-09 zero-egress default build:** the built app is verified to make no automatic network egress on load — static source scan, build-artifact scan (real `apps/web/dist` clean), runtime egress trap (FreeLayer's load path calls no network API; positive controls fire), and a network-client dependency scan. No service worker exists; a GitHub Actions egress audit confirms CI contacts only GitHub. **What is verified:** the default app runtime + build artifacts + repository source. **What is not:** full in-browser render egress (future Playwright E2E) and — always outside application control — the OS, browser, extensions, package manager, and GitHub CI infrastructure (which necessarily use the network for development). Still not safe for real secrets; no crypto; no messaging.

**TECH-08 NetworkPolicy:** the network side-effect barrier is now implemented as policy — default-deny `resolveNetworkPolicy`, exact-scope decision enforcement, mock/noop transports (`performsRealNetwork: false`), endpoint validation, per-transport metadata leakage labels, a forbidden-network CI guard, and a runtime egress trap (positive controls prove it fires). **No real networking exists:** no fetch, WebSocket, WebRTC, relay, telemetry, external assets, or update checks. WebRTC/direct peer is denied in Private+; Offline Capsule/Emergency deny all network; Ghost/Bunker deny direct network. **What the tests do not prove:** they verify FreeLayer _application_ behavior, not that the OS/browser/extensions/package-manager make no network calls (that is TECH-09's built-app scope and, ultimately, outside application control). Still not safe for real secrets; no crypto; no messaging.

**TECH-07 zero-persistence verification:** Ghost/Bunker "write nothing persistent" is now machine-checked — 38 additional tests (116 total): full mode×class matrix sweeps (8 configurations × 22+ classes), runtime persistence-API traps with positive controls (a planted `fs.writeFileSync` is caught **and prevented**; browser APIs trapped or verified inert), fail-closed unknowns (unknown backend/class/mode ⇒ deny), mode-transition no-auto-flush proofs, capsule-spool/cache/log strict-mode denials, and artifact sentinel scans. **What is still not guaranteed:** anything below the application — OS swap, crash dumps, browser internals, forensic residue, compromised processes. No production encrypted storage exists; not safe for real secrets.

**TECH-06 hardening:** the memory/null providers are now misuse-resistant — clone-at-boundaries (no reference leaks through write/read), key validation (traversal/URL/sentinel keys rejected without echo), metadata-only listing, honest `persistent/implemented` flags, and a zero-persistence harness that also verifies runtime-provided web storage stays untouched. 25 additional tests (78 total) cover these plus sentinel leak-detection across errors, console, and lists. **Still true: no encrypted persistent storage, no production storage, not safe for real secrets, and memory-only is not forensic protection** (OS swap and compromised processes are out of scope, stated).

**What the TECH-05 tests prove:** Ghost/Bunker cannot obtain a persistent backend for any of the 30 data classes; Emergency denies normal writes; AI/preview/thumbnail caches are denied per matrix; sealed ScreenShield and high device risk tighten storage; room policy tightens but never loosens; forged/denied/wrong-scope decisions are rejected; storage errors never contain stored values; the forbidden-storage CI guard catches direct browser-storage/database/filesystem usage.
**What still has no tests:** anything involving real persistence, encryption-at-rest, wipe semantics, or platform storage behavior — none of it exists yet.

### RoomOS policy composition + governance (TECH-22, 2026-07-13)

A deterministic local policy-composition model. **What TECH-22 proves (21 new tests; 521 total):** composition is deny-overrides + strictest-wins (a room allow cannot override a global/mode/room deny; telemetry/external-assets/previews/push/remote-AI stay denied; persistent plaintext + network never allowed); DevicePosture is fail-closed (missing/unknown/malformed → `unverified`; untrusted `basic`/`hardened`/`high_assurance`/`managed_bunker` claims cannot elevate; `at_risk` always tightens and satisfies nothing; explicit ordering); protected-content future requirements deny content display with no active-protection claim; sensitive-room admission denies content when the provider is absent but allows a redacted summary; governance is tighten-only (only a `stricter` candidate succeeds; owner-only; editor/viewer/auditor cannot govern; suspended/removed owner cannot govern; fake/wrong-scope decisions + stale policy revision reject); posture changes invalidate prepared authorization; the policy reducer is pure/deterministic; governance failure creates no event/log; errors + conflict reports are content-free. **What is NOT provided (honest):** FreeLayer **does not verify device security** — high-assurance posture is unavailable and core **cannot satisfy hardened/bunker room requirements** yet; the `at_risk` signal may only tighten; **ScreenShield is not active** and no anti-spyware exists in core; **GrapheneOS is not managed by FreeLayer**; there is no MDM/Device Owner/attestation/custom ROM; room policy is not cryptographically authoritative (no signed/verified/distributed governance — Gates F/G/H); Secure Device is a SEPARATE project not integrated here; device compromise remains a limitation; not safe for real secrets.

### RoomOS local revocation + authorization regression (TECH-21, 2026-07-13)

Local stale-capability invalidation and final execution-time authorization are now regression-tested. **What TECH-21 proves (19 new tests; 500 total):** a prepared authorization context is non-authoritative and cannot execute alone — an authentic exact-scope `PolicyDecision` is always required (fake/denied/wrong-scope reject); suspension/removal/role-downgrade of the actor, a target-revision change, and object/operation/view/room/target rebinding all reject at revalidation; room-policy tightening, privacy-mode transitions (including less-restrictive ones), and lifecycle changes invalidate prepared contexts; role authority is compared by capability SETS (every role pair covered) and a restrictive command carrying an expansive role change rejects; the revocation pipeline re-checks last-owner continuity against the current projection and produces no event/log/projection change on failure; revalidation touches no network/notification/persistent-write API; errors and content-free invalidation reports never leak (sentinel-tested); there is **no authorization cache**. **What is NOT provided (honest):** no global/distributed revocation (Gate H — local removal does not reach other devices or unknown remote copies); no signed/cryptographic revocation (Gates F/G); no verified identity (Gate G); no authorization server; no single-use/nonce-bound decisions yet (Gate B); no endpoint assurance (device-risk can only tighten). Not safe for real secrets.

### RoomOS membership + capability scaffolding (TECH-20, 2026-07-13)

Local, unverified room-member relationships + non-authoritative capability descriptors. **What TECH-20 proves (21 new tests; 481 total):** bootstrap creates exactly one active owner-placeholder (second bootstrap rejects); membership lifecycle holds (duplicate/resurrection/stale-revision reject; tombstone terminal); the last active owner cannot be removed/suspended/demoted; roles/IDs/refs/descriptors confer no authority and an authentic exact-scope `PolicyDecision` is always required (a forged descriptor fails; wrong-scope decisions reject); viewers cannot mutate, editors cannot manage membership, suspended/removed members cannot act; capability resolution default-denies and binds room+membership+revision (stale after role/state/revision change rejects); attenuation narrows only (widening/object-kind/exact-object/view widening reject); descriptors are non-serializable/non-persistable and there is no wildcard capability; membership is memory/null only, Bunker/Emergency deny expansion, redacted queries return no identity/presence/descriptor; events replay deterministically; the sentinel never leaks. **What is NOT provided (honest):** membership is **unverified** (no identity — Gate G); roles are **placeholders**; capability descriptors are **not credentials/tokens** (a real capability runtime is Gate B); no distributed revocation (Gate H — local removal ≠ global); no invite system (Gate G/E); no cryptographic ownership (Gate F); no endpoint assurance (externalized; device-risk can only tighten, never attest safety). Not safe for real secrets.

### RoomOS privacy-safe query model (TECH-19, 2026-07-13)

A local read boundary over room data. **What TECH-19 proves (28 new tests; 460 total):** every query needs an authentic decision scoped to exactly its class (summary/list/detail/search/count) and a list decision cannot authorize detail, summary cannot authorize search, detail cannot authorize count, mutation/storage cannot authorize a query; object IDs/actor refs confer no authority; cross-room/unknown/scope-mismatch reject; queries are side-effect-free (no event/log/storage/network/notification/AI/endpoint — trapped); summaries carry no content and redacted/tombstoned content never reappears (detail or search); strict modes suppress actor refs/timestamps/revisions/counts and Bunker denies content+search; exact case-sensitive in-memory search only (no index/history/cache/snippet/regex; term never logged); cursors are content-free and non-authority; results are deterministic and defensively cloned. **What is NOT guaranteed (honest):** no authenticated membership (Gate G), no persistent/encrypted index (Gate F), no constant-time queries, no defense against process-memory inspection, and — because endpoint defense is externalized — **no protection of rendered results from screenshots/capture**. No remote query API (Gate H), no semantic search (Gate I). Not safe for real secrets.

### RoomOS Object Model v1 (TECH-18, 2026-07-13)

The first concrete room objects exist — as **local data objects**. **What TECH-18 proves (33 new tests; 432 total):** message/note/task/decision/poll/file_ref objects mutate only through an explicit command union (no generic patch) via a policy-gated pipeline; every mutation needs an authentic decision scoped to exactly its side-effect class, and the mutation vs object-log append are **separate** decisions; object IDs/actor refs confer no authority; cross-room mutation, unknown commands/kinds/versions, unexpected fields, `__proto__`/`prototype`/`constructor`, oversized content, and file-ref paths/URLs/credentials all reject; local `revision` guards optimistic concurrency (stale/future/missing/overflow reject) and increments by exactly one; lifecycle/status machines hold (archived read-only, redaction one-way, tombstone terminal); events + projection are deterministic and replay reproduces state; strict modes deny persistent content and suppress summary signals; content never reaches errors/summaries/status/console (sentinel-tested); no network/notification/persistent-write API is touched (trapped). **What a message object is NOT (honest):** it is not sent, encrypted, synchronized, or delivered. No messaging transport, no sync/CRDT (Gate H), no crypto (Gate F — revisions are **not** tamper resistance), no verified identity or authoritative voting/ownership (Gate G), no external object parsing (Gate E), no real persistence, no file bytes/paths/URLs, no anti-spyware, and nothing is safe for real secrets. Tombstoning does not forensically erase anything.

### RoomOS operation log + deterministic replay (TECH-17, 2026-07-13)

The room event model is now log-grade and regression-locked. **What TECH-17 proves (30 new tests; 399 total):** schema-v1 events with typed payloads reject unknown versions/operations/kinds/fields; the memory log enforces unique IDs + contiguous ascending sequences and clones on append AND read; the null log retains nothing (replay unavailable, stated); replay validates everything before applying anything — invalid input yields **no partial state**; same seed + same events ⇒ deep-equal projections across 15 golden fixtures (repeated + cloned runs); replay makes zero clock/network/notification calls (spied + trapped); room mutation and log append/read/clear require **separate exactly-scoped decisions** (cross-scope rejected); errors/status/reports are sentinel-free. **What remains unimplemented (honest):** no persistent event log (memory/null only), no signatures/encryption (Gate F — this is **not tamper resistance**), no sync/distributed ordering (Gate H), no identity (Gate G), no external event parsing (Gate E — internal validators are not hostile-input parsers), no snapshots/compaction, tombstoning does **not** forensically erase anything (it only ends mutation and clears visible summaries), no anti-spyware in core, and nothing is safe for real secrets.

### RoomOS foundation (TECH-16, 2026-07-12)

The first product-domain layer: `packages/rooms` implements the Sovereign Room **local data model** — branded placeholder identifiers, lifecycle/object/operation taxonomies, `RoomPolicy` (tighten-only), a barrier requiring authentic exactly-scoped `PolicyDecision`s, versioned memory-only operation events, a pure rebuildable projection, and redacted room audit events. **What tests prove (21 new; 369 total):** creation/mutation require authentic decisions (forgeries rejected); unknown operations/objects deny; room policy cannot loosen Ghost/Bunker; logs/projections never persist (matrix + StoragePolicy agree); no network/notification API fires during room operations (trapped); titles/member display redact in strict modes; the sentinel never reaches errors/audit/projections; sync/crypto/identity stay future-gated; endpoint-defense "active" is unrepresentable. **What tests do NOT prove:** rooms are NOT safe for real secrets — no crypto, no sync, no identity, no persistence, and **no active anti-spyware** exist; content lives in memory only while the app runs.

### Contributor workflow & governance surface (TECH-15, 2026-07-10)

The contribution process itself is now part of the safety net: a single contributor workflow ([CONTRIBUTOR_WORKFLOW.md](CONTRIBUTOR_WORKFLOW.md)) and policy developer guide, a PR template that forces privacy/security-impact answers and matrix/PBOM/Trust-Center coupling, focused issue forms (privacy bug / policy change / feature gate / Gate R integration), an ADR workflow + template, an honest [OpenSSF readiness checklist](audits/OPENSSF_READINESS_CHECKLIST.md) (no badge or score claimed), and a `check:contributor-workflow` CI validator. Governance honesty unchanged: solo-dev review limits stay documented, **the project is not ready for real secrets**, and **no active anti-spyware implementation exists in core** — the endpoint-defense implementation is externalized and integration-gated.

### Policy Conflict Regression Suite (TECH-14, 2026-07-10)

Policy contradictions are now regression-tested: 17 conflict categories, table-driven comparisons of every engine against the Policy Matrix, intentional-contradiction fixtures the validator provably detects (48+10 findings), and `check:policy-conflicts` in CI (matrix invariants, docs statements, dependency bans, and an overclaim scanner on this very document). Current status: **0 conflicts** ([audits/POLICY_CONFLICT_REPORT.md](audits/POLICY_CONFLICT_REPORT.md)). **Anti-spyware honesty:** the endpoint-defense implementation is **externalized** to a separate project and is **not active in FreeLayer core** — core keeps policy hooks only; no endpoint monitoring exists or is claimed here; integration requires a dedicated future gate ([audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md](audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md)). This suite prevents known contradiction classes from returning; it is not formal verification.

### Policy Matrix v1 (TECH-13, 2026-07-10)

The seven policy layers are now unified under one canonical contract: [POLICY_MATRIX.md](POLICY_MATRIX.md) — 94 specs → 658 rules (7 modes × all privacy-relevant behaviors), machine-exported to `policy-matrix.v1.json`. **Machine-checked:** unique ids, per-mode/per-domain coverage, fail-closed unknown inputs, deny-overrides/strictest-wins composition, tighten-only room/ScreenShield behavior, v1 no-persist/no-egress invariants, and — critically — **agreement between the matrix and every concrete engine** (Storage/Network/Metadata/LinkPreview/ExternalAsset/Notification) via 34 dedicated tests (320 total), plus the `check:policy-matrix` and `check:policy-docs` CI validators. **What it is not:** formal verification. It proves declared-rule consistency, not crypto/protocol correctness; all deferred gates (crypto, sync, identity, push, AI) remain deferred, and accepted limitations remain accepted.

### Notification privacy model (TECH-12, 2026-07-10)

`NotificationPolicy` (`packages/privacy`) treats notifications as side effects and their content/metadata as sensitive. **No real notifications, no permission prompts, no push, no service worker are implemented.** Permission requests, push subscribe/receive, service-worker notifications, badges, sound, vibration, and all OS surfaces (banner/lock-screen/notification-center) are denied in every mode; sensitive content (message preview, room/sender names, titles, AI summary, protected/secret) is denied in every mode. The only allowed notification is a generic, content-free, memory-only in-app indicator (Standard/Private). Notification content never persists; audit events are redacted. Enforced by a barrier reusing the WeakSet `PolicyDecision` provenance, a `check:no-notification-bypass` scanner, and a runtime trap; the Tauri notification plugin is **absent with zero permissions** and no service worker/push code exists (audited). 29 tests; 286 total. **Not guaranteed:** once a notification is delivered, FreeLayer cannot control the OS notification center, screenshots, or user OS settings. This is application-level privacy, not absolute.

### Link preview / external asset blocking (TECH-11, 2026-07-10)

`LinkPreviewPolicy` and `ExternalAssetPolicy` (`packages/privacy`) deny **all** automatic link previews and **all** remote assets (images/avatars/fonts/scripts/CSS/favicons/OpenGraph images/tracking pixels/iframes/connection hints) in every mode. A pure URL classifier redacts credentials and query strings to a domain-only label and performs **no** network calls (tested with a fetch spy). The hardened `check:no-external-assets` scanner catches CDNs, protocol-relative assets, connection hints, favicons, and OpenGraph images (fixture-tested); `check:no-network-deps` blocks preview/scraper packages. Agrees with MetadataPolicy, NetworkPolicy, and StoragePolicy (24 link/asset tests; 257 total). **Not solved:** a safe user-initiated preview is a future gate; manual external navigation still leaks to the user's browser and the target site; CSP/headers ([WEB_SECURITY_HEADERS.md](WEB_SECURITY_HEADERS.md)) are defense-in-depth and not yet deployed. This is not an anonymity guarantee.

### Metadata Firewall v0 (TECH-10, 2026-07-10)

MetadataPolicy v0 landed in `packages/privacy`: a default-deny, fail-closed engine that classifies 40 metadata events × 12 sinks and composes with StoragePolicy and NetworkPolicy under strictest-policy-wins. **What is machine-checked:** receipts/typing/presence denied in Private+; notification content denied in Ghost/Bunker; link preview / external assets / telemetry-shaped / AI metadata denied; nothing metadata-shaped persists or egresses in v0; redacted audit events and payloads (numeric/boolean only — the sentinel never survives); the metadata barrier rejects forged/mis-scoped decisions via the existing WeakSet provenance; MetadataPolicy agrees with StoragePolicy/NetworkPolicy (47 tests, 220 total). **What is NOT solved:** no messaging, no real network, no notifications — this is metadata _reduction_, not anonymity, and a global passive adversary and transport-native metadata remain out of scope ([audits/TECH_10_METADATA_THREAT_MODEL.md](audits/TECH_10_METADATA_THREAT_MODEL.md)). Platform reconciliation confirmed the baseline matched with no resolved item redone ([audits/TECH_10_PLATFORM_RECONCILIATION.md](audits/TECH_10_PLATFORM_RECONCILIATION.md)).

### Stabilization & hardening (2026-07-09)

A consolidation pass resolved the recurring open items ([PLATFORM_STATE_ANALYSIS.md](PLATFORM_STATE_ANALYSIS.md)): **AST-backed ESLint enforcement** of the boundary and forbidden-API rules (upgrading the regex scanners); **unforgeable `PolicyDecision`** via a module-private WeakSet (closing the forgeable-mark limitation cited since TECH-05, tested); **Node 24 LTS** pinned across `.nvmrc`/CI/types; **coverage** wired (88.6% statements on shipped source); and a **definitive maintenance strategy** ([MAINTENANCE.md](MAINTENANCE.md)) making the green test suite the dependency-update safety net. 173 tests, all checks green. The deliberately-gated work (crypto, room sync, identity) remains correctly deferred — building it early would violate the constitution.

### Mechanical guardrails (baseline, added in Phase 1)

CI and `pnpm audit:privacy` run four static guards: an **import-boundary check** (apps cannot import storage/transports/crypto/ai directly; dependency direction between packages), a **no-external-assets check**, a **no-telemetry check**, and a **forbidden-storage-API check**. Side-effect placeholders (storage, transports) reject calls that lack a `PolicyDecision`, verified by unit tests. Honest scope: these are baseline static scans and runtime accident-guards — they reduce bypass risk as far as practically possible at this stage, but they are not a security proof; stronger (AST/compile-time) enforcement is tracked at Gates A/B and Phase 10.

### Critical gates before implementation

Implementation is blocked behind explicit gates ([IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md), Gates A–J):

- accepted ADRs (constitution in place — [docs/adr/](adr/))
- the core policy engine (Gate B)
- the storage write barrier (Gate C)
- the network side-effect barrier (Gate D)
- capsule parser fuzzing (Gate E)
- crypto design review (Gate F)
- AI Privacy Guard before any AI (Gate I)
- PBOM update discipline on every behavior change ([ADR-0010](adr/ADR-0010-documentation-updated-with-code.md))

No feature work begins ahead of its gate, regardless of schedule pressure.

## What is tested

- Workspace typecheck, lint, unit tests, and production build all run real work and pass locally.
- 16 baseline unit tests: fail-closed policy resolution (strictest wins; empty input → all denied), storage providers rejecting calls without/against a `PolicyDecision`, memory provider non-persistence across instances, null provider storing nothing, crypto and AI placeholders rejecting all operations, redaction and audit helpers.
- Four static privacy guards (boundaries, external assets, telemetry, forbidden storage APIs), verified to fail on planted violations.

## What is NOT tested yet

- Everything else: no cryptographic verification (there is no crypto), no protocol testing (there is no protocol), no fuzzing, no wire-level privacy assertions, no runtime egress verification, no platform hardening checks. The guards are static pattern scans, not proofs. If a claim in `docs/` matters to you, assume it is unverified.

## Security automation roadmap

(Phases per [ROADMAP.md](ROADMAP.md))

- **Now (Phase 0):** CodeQL, dependency review, Dependabot, static privacy guards
- **Phase 4–5:** protocol test vectors; fuzz targets for capsule parsing
- **Phase 10:** full privacy-regression suite (zero-write and zero-egress assertions), security-regression suite, SBOM generation, PBOM auto-diff
- **Phase 11:** signed releases; reproducible-build investigation

## Responsible disclosure

See [SECURITY.md](../SECURITY.md). Private reporting via GitHub Security Advisories; no bounty yet; reporters credited here unless anonymity is preferred.

**Disclosure history:** none yet.

## Known limitations (standing)

- No protection for compromised devices.
- No defense claimed against global passive adversaries.
- Metadata reduction has documented limits ([METADATA_MODEL.md](METADATA_MODEL.md)).
- Serverless delivery is best-effort; availability is weaker than centralized systems.
- No-persistence modes are application-layer guarantees, not forensic ones ([STORAGE_MODEL.md](STORAGE_MODEL.md)).

## Signed releases and supply chain (future)

Planned for Phase 11: maintainer-signed builds and checksums; SBOM per release; provenance attestation research; reproducible builds as a research goal (full reproducibility across Tauri targets is hard — treated honestly as research, not promised).

## PBOM

The Privacy Bill of Materials — what the software actually collects, stores, contacts, and requires — lives in [PBOM.md](PBOM.md) and is a release artifact from the first alpha onward.

## TODO

- [ ] Update at each phase boundary (checklist item in phase exit criteria)
- [ ] Publish maintainer signing keys before first release
- [ ] External design review of THREAT_MODEL.md and CRYPTO_DESIGN.md (earliest meaningful audit step — before implementation, not after)

## Secure Device posture — what we honestly claim (TECH-23)

FreeLayer applies **device posture** as one input to sensitive-room admission, but you should know its limits:

- Secure Device / Endpoint Defense is a **separate, externalized** project. FreeLayer core is only the future relying party.
- The **Null provider** is the only provider that ships today. No trusted provider exists.
- A device posture **above `unverified` cannot currently be established** in core. An untrusted signal can only **restrict** (tighten to `at_risk`); it can never grant, restore, or prove anything.
- We collect **no raw device evidence, no device identifiers, no OS fingerprint, no installed-app inventory, no assessment history, and no telemetry**.
- We do **not** run GrapheneOS management, MDM, hardware attestation, ScreenShield, or a Bunker runtime in core.
- We make **no spyware-proof and no capture-proof claim**. A compromised endpoint, a camera pointed at the screen, or a hostile input method remains outside our control. FreeLayer is **not safe for real secrets** today.

These statements are enforced by the automated **policy conflict** overclaim scanner and are consistent with the anti-spyware **externalized** posture recorded across the Trust Center.

## Identity — what we honestly claim (RESEARCH-ID-01)

FreeLayer does **not** have identity yet. Please read these limits before trusting any identity-like signal:

- There is **no verified identity, no device passport, no key transparency, no QR verification, no recovery, and no secure identity storage** implemented. Identity is future design (Gate G); identity cryptography is Gate F.
- A room membership (`RoomMemberRef`) is a **local, unverified placeholder** — it is not identity and authorizes nothing on its own.
- A profile name is not a verified identity; DevicePosture is not identity; a hardened device is not a verified person.
- FreeLayer requires **no phone number and no email**, keeps **no central identity database**, and will never ship an **administrator recovery backdoor or a project-owned master key**.
- We make **no anti-impersonation guarantee** today.

These statements are consistent with the automated **policy conflict** overclaim scanner and with the **externalized** Secure Device posture recorded across the Trust Center. RESEARCH-ID-01 is research only; the model is decided by **TECH-ID-02 — Identity Architecture ADR**.
