# FreeLayer Roadmap

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

### Phase 0.5 — Architecture Decision Lock *(current)*

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

### Phase 1 — Monorepo and app shells *(started — Prompt 03)*

Workspace packages with real builds; `apps/web` (React+Vite) and `apps/desktop` (Tauri) shells that render, with strict CSP and zero external assets from day one; lint rules enforcing dependency direction.

Progress (Prompt 03):

- ✅ Monorepo: 12 typed packages + 4 apps; `pnpm typecheck/lint/test/build` run real work and pass.
- ✅ Web shell: local-only React+Vite status page, strict CSP, zero external assets, builds for production.
- ✅ Mechanical guardrails (baseline): import-boundary check (dependency direction), no-external-assets check, no-telemetry check, forbidden-storage check — all wired into CI and `audit:privacy`.
- ✅ Side-effect scaffolding: storage/transport placeholders require a `PolicyDecision` and fail closed; baseline tests verify it.
- ⬜ Desktop: placeholder only — Tauri shell still to come (kept minimal deliberately; permissions surface deferred).
- ⬜ ESLint-based dependency-direction enforcement (current check is a static-scan baseline).
- ⬜ First real CI run on GitHub (workflows updated; repository not yet pushed).

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

## Endpoint Defense / ScreenShield track (ADR-0012)

**Dependency: ProtectedContent/ScreenShield must be designed before serious messaging UI and protected document UI** — retrofitting endpoint defense onto a shipped UI is how it fails.

- ✅ RESEARCH-EDL-01 — Endpoint Defense + ScreenShield Research and Architecture *(this pass)*
- ⬜ TECH-EDL-02 — ScreenShield Policy Schema
- ⬜ TECH-EDL-03 — ProtectedContent Rendering Contract
- ⬜ TECH-EDL-04 — Secure Surface Adapter Interfaces
- ⬜ TECH-EDL-05 — Clipboard Firewall
- ⬜ TECH-EDL-06 — Secure Input Firewall
- ⬜ TECH-EDL-07 — Anti-Overlay/Tapjacking Guard
- ⬜ TECH-EDL-08 — Device Risk Engine
- ⬜ TECH-EDL-09 — Capture-Aware Rooms
- ⬜ TECH-EDL-10 — Protected View / Sealed View
- ⬜ TECH-EDL-11 — Panic / Auto-Redact / Decoy
- ⬜ TECH-EDL-12 — Leak Canary / Dynamic Watermark
- ⬜ AUDIT-EDL-13 — ScreenShield Regression Tests
- ⬜ AUDIT-EDL-14 — Endpoint Defense Audit

## Infrastructure track (separate from the technical phases)

The technical phase numbering above is unchanged by infrastructure work. Infra milestones:

- **Infra-01 — GitHub publication + live CI** *(this pass)*: public repository at <https://github.com/XGiammyX/freelayer>, README as a complete public landing page, GitHub Actions validated live, CI validation PR, security settings checklist ([GITHUB_SECURITY_SETTINGS.md](GITHUB_SECURITY_SETTINGS.md)), branch protection applied or documented ([GITHUB_REPOSITORY_SETUP.md](GITHUB_REPOSITORY_SETUP.md)), live results in [LIVE_CI_REPORT.md](LIVE_CI_REPORT.md). GitHub is the development platform only — never a runtime dependency.

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
