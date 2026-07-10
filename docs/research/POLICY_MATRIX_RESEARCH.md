# Policy Matrix — Research Note (TECH-13)

_Date: 2026-07-10. Informs Policy Matrix v1 in `packages/privacy`._

> [!NOTE]
> **Source verification pending: live internet was unavailable in this environment.** The concepts below are stable, well-established security-engineering knowledge (author cutoff 2026-01). Re-confirm exact document numbers/wordings against the named primary sources before external citation.

## 5.1 NIST ABAC (SP 800-162)

**Summary:** Attribute-Based Access Control evaluates subject, object, operation, and environmental attributes against explicit policy rather than ad-hoc code checks — reducing inconsistency and making decisions auditable.

**Applied:** the matrix is ABAC *in spirit* — every decision is `mode × domain × operation` refined by `sink/transport/dataClass/roomPolicy/screenShieldLevel/deviceRiskLevel` — but implemented as an explicit typed table with simple lookup. **No external policy engine** (no OPA/XACML/Rego/JSON-logic): the rule set is small, must be reviewable line-by-line, and a policy runtime would be a supply-chain and complexity liability the constitution forbids.

## 5.2 OWASP ASVS (verification mindset)

**Summary:** security requirements must be testable controls; access control verified with secure defaults and fail-closed behavior; claims map to tests.

**Applied:** every matrix rule carries `testCoverage` (`covered`/`partial`/`deferred`) and `docsRefs` (validator checks the files exist); 40+ tests verify the matrix and its **agreement with every concrete engine**; unknown inputs fail closed; docs/PBOM/Trust Center consistency is machine-checked (`check:policy-docs`).

## 5.3 W3C/MDN Permissions Policy

**Summary:** the web's Permissions-Policy declares feature allow/deny lists separately from feature code — powerful features are denied unless explicitly allowed.

**Applied:** the matrix is exactly that capability map for FreeLayer: platform features (notifications, badges, push, WebRTC, service workers, clipboard, AI) are denied unless a rule explicitly allows them. Future web headers ([WEB_SECURITY_HEADERS.md](../WEB_SECURITY_HEADERS.md)) can mirror matrix rows; policy informs docs, headers, tests, and scanners — not just runtime logic.

## 5.4 Privacy by design / data minimization

**Summary:** collect/store/process the minimum; purpose limitation; explicit user action for anything privacy-relevant; privacy as the default.

**Applied:** defaults deny or null-route metadata; Standard is still privacy-preserving (no telemetry/assets/previews, hard-fail persistence); strict modes remove convenience features instead of silently leaking; PBOM enumerates every privacy-relevant behavior and the matrix is now its oracle.

## 5.5 Policy composition and conflict resolution

**Summary (reasoned):** deny-overrides is the only safe combining algorithm for privacy defaults; composition must be monotone (tighten-only) or a permissive layer becomes a bypass.

**Applied:** explicit strictness order (`deny` strictest → `allow` loosest) with `deny` always winning; `not_implemented`/`future_gate`/`require_user_action` are **not** allow; room and feature policies tighten only; ScreenShield/device-risk tighten shield-marked rows; Emergency rows already encode override; empty/unknown input → deny.

## 5.6 FreeLayer internal policy review

Reviewed all model docs and the four policy engines + their test suites. Findings:

- **No contradictions found** between engines — the TECH-10/11/12 integration tests had already forced agreement; the matrix now encodes it centrally.
- **Duplication identified (accepted):** each engine keeps its own mode lists/deny logic; the matrix does not replace them (that refactor is Gate B pipeline work) — it *oracles* them. TODO for TECH-14/Gate B: derive engine tables from the matrix or vice versa.
- **Missing explicit rows found and added:** update checks, service-worker network behavior, badge dot vs count, watermark/canary state, clipboard/secure-input/task-switcher/screenshot gates, Tauri desktop permissions.
- **Docs/code mismatch:** none blocking; PBOM sections 14–16 map 1:1 onto matrix domains.

## Decisions made for TECH-13

1. Compact **spec table** (94 specs) expanding to per-mode rules (658) — authorable, reviewable, exhaustive.
2. JSON export mirrors the TS specs **verbatim**; a sync test makes drift impossible; the zero-dependency validator works from the JSON.
3. v1 invariants baked into expansion: `persistentAllowed=false`, `networkAllowed=false` on every rule.
4. Evaluation is a Map lookup + tighten-only composition — no eval, no DSL, no dynamic expressions.

## TODOs for TECH-14 / Gate B

- **TECH-14 (Policy Conflict Regression Suite):** exhaustive pairwise engine-vs-matrix sweeps; mode-transition conflict tests; mutation-style tests (flip a rule → suite must fail).
- **Gate B:** the core operation pipeline should consume matrix rows when issuing `PolicyDecision`s (single evaluation path); consider generating engine tables from specs; reason-code alignment across all engine errors/audits.
