# TECH-15 — DX / Workflow Threat Model

_Scope: how contributor workflow failures weaken privacy/security, and what the workflow layer does about it. Extends [../THREAT_MODEL.md](../THREAT_MODEL.md)._

## Contributor workflow threats

Policy changed without a matrix update · docs changed without tests · PBOM changed without code evidence · dependency added without a stated case · accidental `fetch`/remote asset/notification/push code · **endpoint-defense implementation added despite externalization** · policy layer bypassed for convenience · a failing guardrail disabled to get green. **Mitigation:** machine checks catch the mechanical cases (matrix sync test, conflict validator, all scanners, dependency bans); the workflow docs + PR template make the human cases explicit; CONTRIBUTING_SECURITY forbids softening guardrails.

## Review process threats

A PR template that never asks the privacy questions · CODEOWNERS not triggered on critical files · undocumented branch protection · solo-dev trade-offs hiding missing review · unlabeled security-sensitive PRs · accepted limitations quietly deleted · gates bypassed. **Mitigation:** template extended with 8 impact questions + required-updates checklist + anti-spyware boundary confirmation; CODEOWNERS covers all critical paths (enforcement limits stated honestly); labels documented; gate/ADR workflow written down. **Residual (honest):** with one maintainer, review is self-review — accepted and documented, resolved by the second-maintainer activation step.

## Documentation drift threats

README claiming future-gated features implemented · Trust Center overclaims · PBOM missing behavior · roadmap contradicting code · **ambiguous anti-spyware status** · wiki diverging. **Mitigation:** `check:policy-docs` + `check:policy-conflicts` (overclaim scan) + `check:contributor-workflow` (externalization statements) + `check:doc-links`; canonical-docs workflow forbids wiki-only claims; README carries the externalized note.

## Onboarding threats

Wrong Node version · unknown required scripts · misunderstanding the matrix · adding a row without tests · not understanding "not ready for real secrets" · not understanding the externalized boundary. **Mitigation:** `.nvmrc` + one setup section; `check:all`; the Policy Developer Guide's single add-a-row procedure; "no real secrets" stated in SECURITY/Trust Center/workflow; boundary rule in workflow §5 + PR template.

## Limits (stated plainly)

- TECH-15 improves workflow, **not formal governance** — it cannot force GitHub settings (manual configuration) and cannot replace human review.
- Solo-dev trade-offs remain accepted until a second maintainer joins.
- Templates reduce mistakes; they do not prevent a determined bad PR — the guardrails and (future) review do.
