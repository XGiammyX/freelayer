# Contributor Workflow — Research Note (TECH-15)

_Date: 2026-07-10. Informs the contributor workflow, templates, and governance docs._

> [!NOTE]
> **Source verification pending: live internet was unavailable in this environment.** The practices below are stable OSS-governance knowledge (author cutoff 2026-01). Re-confirm current criterion wordings against the named sources before external citation.

## 6.1 OpenSSF Scorecard

**Summary:** automated security-health checks — branch protection, code review, pinned dependencies/actions, token permissions, dangerous workflows, maintained status, SECURITY.md, dependency-update signals.

**Applied:** [audits/OPENSSF_READINESS_CHECKLIST.md](../audits/OPENSSF_READINESS_CHECKLIST.md) maps each check to evidence with honest ✅/🟡/⏳ statuses; workflow docs tell contributors not to lower posture (no unpinned actions, no broadened token permissions); **no score is claimed** — running Scorecard is a recorded TODO.

## 6.2 OpenSSF Best Practices Badge / OSPS Baseline

**Summary:** FLOSS best-practice criteria: security policy, docs, testing, contribution process, vulnerability reporting.

**Applied:** used as a readiness checklist, not marketing; **no badge claimed**; self-assessment deferred to pre-alpha with a TODO.

## 6.3 GitHub branch protection

**Summary:** required PRs/status checks/reviews, force-push and deletion prevention, CODEOWNERS review, `enforce_admins`; a solo maintainer cannot satisfy required-review rules on their own PRs.

**Applied:** recommended settings documented in [GITHUB_REPOSITORY_SETUP.md](../GITHUB_REPOSITORY_SETUP.md); the solo-dev trade-off stays explicit and honest (nothing claimed active that isn't); second-maintainer activation steps written down ([audits/CODEOWNERS_REVIEW_AUDIT.md](../audits/CODEOWNERS_REVIEW_AUDIT.md)).

## 6.4 GitHub CODEOWNERS

**Summary:** ownership rules on the base branch drive automatic review requests; enforcement requires branch protection.

**Applied:** existing CODEOWNERS kept (placeholder documented), extended with the anti-spyware externalization boundary; the audit states plainly that enforcement awaits a second maintainer.

## 6.5 Issue / PR templates

**Summary:** templates and issue forms shape contributions; oversized templates get ignored; private vulnerabilities must not flow through public issues.

**Applied:** PR template extended (type-of-change, 8 privacy/security impact questions, required-updates checklist, anti-spyware boundary confirmation, commands-run block) while keeping the existing honest-checklist tone; 4 focused issue forms added (privacy bug, policy change, feature gate, Gate R integration); vulnerability reporting stays in SECURITY.md, and the privacy-bug form warns against secrets.

## 6.6 Commit / changelog discipline

**Summary:** conventional-commit-style clarity helps review and history; release automation is premature before releases exist.

**Applied:** existing `type: description` convention kept and referenced; security-sensitive PR labeling documented ([LABELS.md](../LABELS.md)); **no release automation added** (Phase 11 concern).

## 6.7 Internal workflow review

Findings and fixes:

- **Missing:** one canonical "what do I run before a PR" doc → [CONTRIBUTOR_WORKFLOW.md](../CONTRIBUTOR_WORKFLOW.md) + [COMMANDS.md](../COMMANDS.md) + `check:all`.
- **Missing:** a policy-focused developer guide (how to add a row without conflicts) → [POLICY_DEVELOPER_GUIDE.md](../POLICY_DEVELOPER_GUIDE.md).
- **Missing:** ADR template + workflow doc (12 ADRs existed with consistent structure but no template) → [ADR_WORKFLOW.md](../ADR_WORKFLOW.md) + `adr/ADR-TEMPLATE.md`.
- **Missing:** contributor-facing anti-spyware boundary (TECH-14 made it machine-enforced; contributors needed the human-readable rule) → workflow §5, PR template, issue form, CODEOWNERS line.
- **Duplication avoided:** existing PR template/issue forms extended rather than replaced; MAINTENANCE.md updated minimally.

## Decisions for TECH-15

1. One workflow doc + one commands doc + one `check:all` script — a single discoverable path.
2. Templates firm but short; forms require the strict-mode-safety question on policy changes.
3. Everything solo-dev-limited is labeled as such; nothing is claimed enforced that isn't.
4. `check:contributor-workflow` validates file existence + externalization statements — simple and stable, no NLP.

## What stays manual (solo-dev stage)

Branch-protection activation, CODEOWNERS team creation, label creation in GitHub settings, Scorecard run, badge self-assessment, second-maintainer onboarding (TODO list lives in [GOVERNANCE.md](../../GOVERNANCE.md)).
