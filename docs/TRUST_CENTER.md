# FreeLayer Trust Center

[← Docs Index](README.md) · [Threat Model](THREAT_MODEL.md) · [PBOM](PBOM.md) · [Security policy](../SECURITY.md)

> [!IMPORTANT]
> **Can I trust FreeLayer today? No — not with real secrets.** This page exists to tell you exactly why, what exists, what doesn't, and what has actually been verified.

## Purpose

One honest page answering: *how much should you trust FreeLayer right now?* This document is updated at every phase boundary and every security-relevant event. It states what has been verified, what hasn't, and what "verified" even means at each stage.

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

| Claim | Current status |
| --- | --- |
| No telemetry | Guardrail active: `check:no-telemetry` fails CI on known SDKs; none exist |
| No external assets | Guardrail active: `check:no-external-assets` fails CI on CDN/font patterns; none exist |
| No crypto | Intentionally not implemented — the only provider throws (ADR-0004) |
| No central backend | Architecture rule (ADR-0001); nothing in the repo contacts a FreeLayer server because none exists |
| ScreenShield | Research/design only (ADR-0012) — no screenshot blocking implemented |
| Safe for secrets | **No** |

## Trust level

**Current trust level: Design/foundation only. Do not use for real secrets.**

This line is updated only when verified reality changes — never ahead of it.

## Current maturity

| Area | Status |
| --- | --- |
| Architecture Decision Lock (Phase 0.5) | **Complete** — ADR-0001…ADR-0011 accepted; see [docs/adr/](adr/) (external design review still pending) |
| Monorepo / app shell (Phase 1) | **Started** — typed scaffolding + minimal local-only web status page; no product behavior |
| Product features | **None implemented** — no chat, no rooms, no capsules, no real networking |
| Cryptography | **Not implemented** — deliberately ([CRYPTO_DESIGN.md](CRYPTO_DESIGN.md), [ADR-0004](adr/ADR-0004-no-crypto-implementation-before-review.md)); the only provider throws |
| Local AI | **Not implemented** — the only provider rejects ([ADR-0007](adr/ADR-0007-local-ai-disabled-by-default.md)) |
| Design documents | Initial drafts, not externally reviewed |
| External audit | None |
| Releases | None |
| Security posture | **Design-only** — every property is a documented intention; none are verified |

### Repository and CI (Infra-01)

| Item | Status |
| --- | --- |
| Public repository | <https://github.com/XGiammyX/freelayer> — GitHub is the development platform only; the runtime has no GitHub dependency |
| CI (typecheck/lint/test/build + 4 privacy guards) | Live status: see [LIVE_CI_REPORT.md](LIVE_CI_REPORT.md) and the badges on the README |
| CodeQL | Workflow present (security-extended); results under the Security tab |
| Dependency review | Workflow present; runs on every PR |
| Branch protection | See [GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md) / [GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md) for the verified state |

Unchanged by publication: **no release, no production-ready crypto, no chat, no AI — do not use for real secrets.**

### Endpoint Defense / ScreenShield (RESEARCH-EDL-01)

The Endpoint Defense Layer is now an official **design pillar** (ADR-0012) — and nothing more yet:

| Area | Status |
| --- | --- |
| ScreenShield design | Initial docs |
| Platform protections | Research stage |
| ProtectedContent | Not implemented |
| Clipboard Firewall | Not implemented |
| Secure Input Firewall | Not implemented |
| Device Risk Engine | Not implemented |

Plainly: **no endpoint protections are implemented, no screenshot blocking exists, and there is no spyware-protection guarantee — device compromise remains a major limitation.** Future trust status will be platform-specific ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md)).

### Storage layer (TECH-05)

The storage layer now has foundation-level policy tests, but **FreeLayer still does not provide production-grade encrypted storage** — nothing persists at all.

| Piece | Status |
| --- | --- |
| StoragePolicy v0 (mode × data-class matrix, default deny, strictest wins) | Implemented + regression-tested |
| Write barrier (exact-scope `PolicyDecision` required per operation) | Implemented + regression-tested |
| MemoryStorageProvider / NullStorageProvider | Implemented, hardened (no browser/filesystem APIs, values never in errors/logs) |
| Encrypted persistent storage | **Not implemented** — throwing placeholder (Gate F) |
| Real message/room storage | **Does not exist** — no crypto, nothing persists, not safe for real secrets |

**TECH-07 zero-persistence verification:** Ghost/Bunker "write nothing persistent" is now machine-checked — 38 additional tests (116 total): full mode×class matrix sweeps (8 configurations × 22+ classes), runtime persistence-API traps with positive controls (a planted `fs.writeFileSync` is caught **and prevented**; browser APIs trapped or verified inert), fail-closed unknowns (unknown backend/class/mode ⇒ deny), mode-transition no-auto-flush proofs, capsule-spool/cache/log strict-mode denials, and artifact sentinel scans. **What is still not guaranteed:** anything below the application — OS swap, crash dumps, browser internals, forensic residue, compromised processes. No production encrypted storage exists; not safe for real secrets.

**TECH-06 hardening:** the memory/null providers are now misuse-resistant — clone-at-boundaries (no reference leaks through write/read), key validation (traversal/URL/sentinel keys rejected without echo), metadata-only listing, honest `persistent/implemented` flags, and a zero-persistence harness that also verifies runtime-provided web storage stays untouched. 25 additional tests (78 total) cover these plus sentinel leak-detection across errors, console, and lists. **Still true: no encrypted persistent storage, no production storage, not safe for real secrets, and memory-only is not forensic protection** (OS swap and compromised processes are out of scope, stated).

**What the TECH-05 tests prove:** Ghost/Bunker cannot obtain a persistent backend for any of the 30 data classes; Emergency denies normal writes; AI/preview/thumbnail caches are denied per matrix; sealed ScreenShield and high device risk tighten storage; room policy tightens but never loosens; forged/denied/wrong-scope decisions are rejected; storage errors never contain stored values; the forbidden-storage CI guard catches direct browser-storage/database/filesystem usage.
**What still has no tests:** anything involving real persistence, encryption-at-rest, wipe semantics, or platform storage behavior — none of it exists yet.

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
