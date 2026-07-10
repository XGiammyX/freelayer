# Platform State Analysis — Problems, Limits, Decisions

_Date: 2026-07-09 · Baseline: `edb3654` + the stabilize/harden pass. Status: main green, 173 tests, 13 checks, 0 open PRs._

## Purpose

A single, honest register of **every open problem, limitation, and deferred decision** accumulated across TECH-01…TECH-09 and the infrastructure work — each with a **decision**. This is the answer to "understand all the problems and solve each one respecting the platform." A decision is one of:

- ✅ **RESOLVED NOW** — fixed in this pass.
- ⏳ **DEFERRED (gated)** — deliberately not done yet, blocked behind a research/implementation gate; deferring it is the *correct* platform decision (implementing it early would violate the constitution).
- ⚖️ **ACCEPTED LIMITATION** — an honest boundary of what the platform can do; documented, not "fixable."

The guiding rule: **respect the constitution.** The platform's strength is that crypto, room sync, and identity are *not* built before their design reviews. "Solving" them now would be the worst possible decision. So this pass resolves everything genuinely resolvable and records the rest with clear rationale.

---

## A. Mechanical enforcement & security hardening

| # | Problem / limit | Decision |
| --- | --- | --- |
| A1 | **Guardrails were regex/token-based** — aliased or dynamic access could evade them (cited in every audit). | ✅ **RESOLVED.** Added ESLint (flat config, typescript-eslint) with **AST-backed** `no-restricted-globals` (localStorage/sessionStorage/indexedDB/caches/fetch/XMLHttpRequest/WebSocket/EventSource/RTCPeerConnection) and `no-restricted-imports` (apps may not import side-effect packages) over shipped `apps/**`+`packages/**` src. The regex CI scanners remain as belt-and-suspenders (they catch build output and non-TS files ESLint doesn't). ESLint immediately found 2 pieces of real dead code `tsc` missed. |
| A2 | **`PolicyDecision` marks were forgeable** — `Symbol.for` uses the global registry, so any in-process code could mint a look-alike (documented since TECH-05). | ✅ **RESOLVED.** Replaced the symbol mark with a **module-private `WeakSet` provenance registry**: only objects returned by `issuePolicyDecision` are authentic; a structurally-perfect forgery is rejected. Proven by `tests/security-regression/policy-decision-authenticity.test.ts`. Genuinely unforgeable in the JS object-capability model. |
| A3 | **Compile-time restriction on provider/transport construction** — `new MemoryStorageProvider()` inside an allowed package isn't a type error. | ⏳ **DEFERRED (Gate B).** The clean fix (factory-token / capability-object) belongs with the real core operation pipeline (Gate B), where construction is centralized. Today: import boundaries (ESLint + regex) + runtime barriers + the boundary regression test cover it. Tracked in [audits/STORAGE_BOUNDARY_AUDIT.md](audits/STORAGE_BOUNDARY_AUDIT.md). |
| A4 | **Reflection-based decision reuse** — a same-realm actor could read a real decision and re-present it. | ⚖️ **ACCEPTED.** Bounded by the **exact side-effect scope check** in every barrier (a `storage.read` decision cannot authorize `storage.write`). Full defense needs a nonce/single-use design, revisited at Gate B. Same-realm hostile code is outside the threat model. |

## B. Maintenance & dependency freshness (explicit goal item)

| # | Problem / limit | Decision |
| --- | --- | --- |
| B1 | **No definitive dependency-update strategy** — Dependabot opened PRs but the process was ad hoc. | ✅ **RESOLVED.** [MAINTENANCE.md](MAINTENANCE.md) makes the **test+guardrail suite the safety net**: a green PR is a safe patch/minor adoption; majors follow a migration checklist. Dependabot groups refined (low-noise tooling group, separate React group, majors individual). |
| B2 | **Node version drift** — local Node 25, CI Node 20, `engines >=20`; Node 25 ships `localStorage` globals (found in TECH-06), so behavior differed by environment. | ✅ **RESOLVED.** Pinned to **Node 24 (Active LTS, EOL 2028)**: `.nvmrc`, CI bumped 20→24, `@types/node`→`^24`. `engines` floor stays `>=20` for contributor flexibility. The web-storage-globals behavior is documented and handled by the traps. |
| B3 | **GitHub Actions supply chain.** | ✅ **RESOLVED (earlier) + verified.** All actions pinned by commit SHA; Dependabot watches them (grouped); egress audit confirms GitHub-only ([audits/GITHUB_ACTIONS_EGRESS_AUDIT.md](audits/GITHUB_ACTIONS_EGRESS_AUDIT.md)). |
| B4 | **TypeScript 7 available** (native Go compiler, breaking). | ⏳ **DEFERRED.** Major migration; tracked in MAINTENANCE.md. TS 5.x is fully supported. |
| B5 | **No coverage visibility.** | ✅ **RESOLVED.** Added `@vitest/coverage-v8` + `test:coverage` (88.6% statements / 84% branches on shipped source). No hard threshold yet — a premature gate rewards coverage theater; revisit at Gate B. |

## C. Deferred research decisions (the gated core)

These are **correctly deferred** — building them before their design reviews would violate the constitution. Each is tracked to a gate.

| # | Item | Decision |
| --- | --- | --- |
| C1 | **Crypto library + protocol profiles** (forward secrecy over lossy transports). | ⏳ **DEFERRED (Gate F, ADR-0004).** No crypto until [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md) passes review. The single most important thing the platform does *not* rush. |
| C2 | **Room sync model** (event-log vs Yjs/Automerge/Loro). | ⏳ **DEFERRED (Gate H).** Formal evaluation → new ADR. Direction locked (event-sourced log); library not chosen. |
| C3 | **Identity model** (local/ephemeral identities, invites, verification, recovery). | ⏳ **DEFERRED (Gate G).** Design-first. |
| C4 | **Capsule wire format** + hostile-input parser + fuzzing. | ⏳ **DEFERRED (Gate E).** |
| C5 | **CC0 for protocol test vectors** (interop). | ⏳ **DEFERRED (own ADR, before first vectors ship — Gate E/Phase 4).** Rationale in [ADR-0011](adr/ADR-0011-license-strategy.md). |
| C6 | **Trusted timestamping for decisions/polls.** | ⏳ **DEFERRED.** Local time + logical order + (future) signatures; no trusted-time claim. |
| C7 | **Notification-content storage class.** | ✅ **DECISION RECORDED.** When notifications are built, their content storage class is born denied-in-strict-modes and no-plaintext-in-audit, per the existing endpoint-artifact rule ([STORAGE_MODEL.md](STORAGE_MODEL.md)). Filed so it can't be forgotten. |
| C8 | **Standard-mode content persistence fallback** (fail-hard vs memory). | ✅ **DECIDED (TECH-05).** Fail hard — Standard content targets the unimplemented encrypted backend and writes throw until Gate F, rather than silently falling back to memory. Documented. |

## D. Product surface & E2E

| # | Item | Decision |
| --- | --- | --- |
| D1 | **`apps/desktop` is a placeholder** — no Tauri shell. | ⏳ **DEFERRED (Phase 1 continuation / Phase 9).** Deliberate: the Tauri permission surface is kept at zero until desktop hardening. |
| D2 | **Full in-browser zero-egress E2E** (Playwright). | ⏳ **DEFERRED (AUDIT-HARD).** The runtime trap + build/host scan cover load-path egress now; a browser-automation stack is not a current dependency. |
| D3 | **Comparison rows marked _TODO verify_.** | ⚖️ **ONGOING (contributor task).** Honest by design; each row is a discrete verification task. Not a blocker. |

## E. Governance & repo

| # | Item | Decision |
| --- | --- | --- |
| E1 | **`@maintainers` CODEOWNERS placeholder** / **`enforce_admins: false`.** | ⚖️ **ACCEPTED (solo-dev trade-offs, documented).** Both resolve when a second maintainer joins; recorded in [GOVERNANCE.md](../GOVERNANCE.md) / [GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md). Not "problems" — honest early-stage state. |
| E2 | **Wiki drift** (wiki vs canonical `docs/`). | ✅ **RESOLVED (earlier).** `docs/` is canonical; wiki authored in `wiki/` via PR and published with `pnpm wiki:publish`; scheduled to expand at first easy install. |
| E3 | **SBOM generation.** | ⏳ **DEFERRED (Phase 10).** PBOM (privacy) exists; SBOM (supply chain) is a release-phase artifact. |

## Honest limitations that are permanent (not bugs)

The platform's guarantees are **application-level**, never forensic or absolute:

- Storage/zero-persistence: no defense against OS swap, crash dumps, journaling, wear-leveling, backups, or a compromised process.
- Network/zero-egress: no control over the OS, browser, extensions, package manager, or GitHub CI infrastructure.
- Endpoint/ScreenShield: reduces capture risk; cannot defeat a compromised device or a camera.
- Metadata: reduced, never eliminated; timing/size correlation persists.
- No perfect anonymity, unbreakable encryption, or forensic erasure — ever.

These are stated in [THREAT_MODEL.md](THREAT_MODEL.md) and [TRUST_CENTER.md](TRUST_CENTER.md) and are features of the honesty, not defects.

## Verdict

Everything **genuinely resolvable now is resolved**; everything **gated is correctly deferred with a tracked gate**; every **permanent limitation is honestly documented.** The platform is stable, green, AST-enforced, unforgeable-decision-hardened, and has a definitive maintenance strategy — while fully respecting the constitution that makes it credible.
