# Policy Conflict Regression — Research Note (TECH-14)

_Date: 2026-07-10. Informs the conflict taxonomy, helpers, fixtures, and validator._

> [!NOTE]
> **Source verification pending: live internet was unavailable in this environment.** The concepts below are stable security-engineering knowledge (author cutoff 2026-01). Re-confirm exact document wordings against the named primary sources before external citation.

## 6.1 NIST ABAC and policy composition

**Summary:** ABAC evaluates subject/object/operation/environmental attributes; combining rules (deny-overrides) decide conflicts between applicable policies.

**Applied:** conflict tests sweep COMBINATIONS — mode × domain × operation × sink/dataClass/transport × room policy × shield/risk × externalization state — not single functions. The typed matrix remains sufficient; no external engine.

## 6.2 OWASP ASVS verification mindset

**Summary:** requirements are testable controls; enforcement belongs in a trusted layer; docs must not claim untested behavior.

**Applied:** every rule has a regression test or documented deferred status; enforcement lives in core/policy barriers (UI-only denial is insufficient — the barriers + guardrails cover this); the Trust Center overclaim scanner mechanically blocks claims tests don't back.

## 6.3 NIST SP 800-53 (AC-3 access / AC-4 information-flow enforcement)

**Summary:** distinguish Policy Decision Points from Policy Enforcement Points; verify flow restrictions, not just access checks.

**Applied:** the Policy Matrix is the decision contract (PDP); the storage/network/metadata/notification barriers are enforcement points (PEPs). Conflict tests verify each *flow* (storage, network, metadata, notification, AI, externalized endpoint hooks) agrees end-to-end with the contract.

## 6.4 Regression testing strategy

**Summary:** regression suites prevent old bugs returning; table-driven + fixture-based tests scale; failures must explain themselves; avoid coverage theater.

**Applied:** table-driven comparisons return `PolicyConflict[]`; tests assert `explainAll(conflicts) === []`, so a failure prints exactly which layers disagreed (`[CRITICAL] allow_vs_deny @ domain=… — expected deny, got allow`). Each contradiction class has a named fixture the validator provably detects (48 + 10 findings). No synthetic allow behavior is fabricated to force comparisons.

## 6.5 Policy conflict patterns

**Summary (reasoned):** the recurring classes are allow-vs-deny, persistence/network/metadata flag conflicts, gates treated as allow, composition loosening, docs/PBOM/dependency mismatches, and externalized components mistaken for implemented.

**Applied:** 17 first-class `PolicyConflictCategory` values; strict deny wins; unknown denies; `future_gate`/`not_implemented`/`require_user_action` are never executable; **externalized means hook-only** — a new category (`externalized_component_marked_implemented`) exists specifically because the anti-spyware split makes this the likeliest future confusion.

## 6.6 FreeLayer internal review

Reviewed all model docs, the matrix, engines, tests, and scanners. Findings:

- **No live contradictions** — TECH-13's agreement tests had already forced alignment.
- **Externalization gap (fixed this pass):** docs described endpoint-defense as in-repo TECH-EDL work; now marked externalized/hook-only/integration-gated across ROADMAP/PBOM/Trust Center/Gates.
- **Coverage gap (fixed):** no mechanism previously proved the *validators themselves* detect contradictions — the fixture matrix + overclaim fixture close it.
- **Dependency gap (fixed):** endpoint-monitoring packages (`iohook`, `robotjs`, `screenshot-desktop`, key listeners, `@nut-tree/*`) were not on any forbidden-deps list; `check:policy-conflicts` now bans them.

## Decisions made for TECH-14

1. Conflicts are data (`PolicyConflict`) with a pure, deterministic, redacted explainer — snapshot-safe.
2. Helpers compare real resolver outcomes only; deferred modules are tested against matrix rows alone.
3. The validator runs three independent layers (matrix invariants, docs statements + overclaims, dependency scan) and supports fixture mode (`--matrix`/`--trust-center`) so its own detection is testable.
4. Anti-spyware externalization is enforced, not just documented: matrix hook rows must stay non-executable, dependencies are banned, and the Trust Center cannot claim active protection.

## TODOs for TECH-15 / Gate B

- **TECH-15:** contributor workflow for adding a matrix row + conflict test in one step; PR checklist automation.
- **Gate B:** single evaluation path (pipeline consumes matrix rows when issuing `PolicyDecision`s) removes the dual-maintenance surface these conflict tests currently guard; reason-code alignment across engine errors/audits.
