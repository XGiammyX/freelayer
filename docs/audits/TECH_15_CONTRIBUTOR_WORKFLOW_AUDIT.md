# TECH-15 — Policy Developer Experience + Contributor Workflow Audit

_Branch: `tech/policy-developer-experience` (stacked on TECH-14 @ `c697e93`) · Date: 2026-07-10._

## Commands run

`pnpm typecheck` · `lint` · `test` · `build` · all guardrails · `check:policy-matrix` · `check:policy-docs` · `check:policy-conflicts` · **`check:contributor-workflow`** · `check:doc-links` · `audit:privacy` · `audit:supply-chain` · `test:coverage`. All green.

## Precheck / research

TECH-13/14 `present`; baseline note documented (stacked PRs #36/#37 open). → [TECH_15_PRECHECK.md](TECH_15_PRECHECK.md). Research: OpenSSF Scorecard + Best Practices Badge (readiness only — **no badge/score claimed**), GitHub branch protection/CODEOWNERS/templates, commit discipline, internal review (gaps found: no single workflow doc, no policy dev guide, no ADR template, no contributor-facing externalization rule — all fixed). → [../research/CONTRIBUTOR_WORKFLOW_RESEARCH.md](../research/CONTRIBUTOR_WORKFLOW_RESEARCH.md). Threat model → [TECH_15_DX_WORKFLOW_THREAT_MODEL.md](TECH_15_DX_WORKFLOW_THREAT_MODEL.md).

## Created

`docs/CONTRIBUTOR_WORKFLOW.md` · `docs/POLICY_DEVELOPER_GUIDE.md` · `docs/COMMANDS.md` · `docs/ADR_WORKFLOW.md` · `docs/adr/ADR-TEMPLATE.md` · `docs/LABELS.md` · `docs/DOCS_CANONICAL_WORKFLOW.md` · `docs/audits/OPENSSF_READINESS_CHECKLIST.md` · `docs/audits/CODEOWNERS_REVIEW_AUDIT.md` · 4 issue forms (`privacy_bug`, `policy_change`, `feature_gate_proposal`, `antispyware_integration_proposal`) · `scripts/check-contributor-workflow.mjs` · workflow tests · this audit + precheck + research + threat model.

## Modified

PR template (types-of-change, 8 impact questions, required-updates checklist, anti-spyware boundary confirmation, commands-run block — existing honest tone kept) · CODEOWNERS (transports/core/scripts/policy-docs/externalization boundary added; placeholder preserved) · `package.json` (`check:contributor-workflow`, `check:all`) · CI (new step) · README (externalized ScreenShield status, workflow pointer) · ROADMAP · IMPLEMENTATION_GATES (Gate S) · PBOM (§20) · TRUST_CENTER · CONTRIBUTING · CONTRIBUTING_SECURITY · SECURITY (not-ready-for-real-secrets + externalization + no-perfect-claims) · GOVERNANCE (solo-maintainer honesty + activation steps) · MAINTENANCE (anti-spyware dependency rule) · POLICY_MATRIX (guide link) · THREAT_MODEL · docs index.

## Status highlights

- **Contributor workflow / policy guide / commands:** present; one discoverable path (`check:all`).
- **OpenSSF readiness:** honest ✅/🟡/⏳ table; Scorecard run + badge self-assessment are recorded TODOs; nothing claimed.
- **CODEOWNERS / branch protection:** extended + documented; enforcement limits stated plainly (solo-dev); second-maintainer activation steps written.
- **Anti-spyware externalization:** now stated across the whole contributor surface and machine-checked (`check:contributor-workflow`) on top of TECH-14's enforcement.
- **Validator:** green on the real repo; 11 new tests (**348 total**).

## Known limitations / accepted trade-offs

Workflow, not formal governance: GitHub settings need manual configuration; templates can't stop a determined bad PR; solo-dev self-review remains the accepted trade-off until a second maintainer joins (activation checklist exists). Docs checks are phrase-based, not semantic.

## Verdict

**TECH-15 is complete.** All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-16 — RoomOS Foundation / Sovereign Room Data Model**.
