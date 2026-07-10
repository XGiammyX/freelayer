# Labels

[← Docs Index](README.md) · [Contributor Workflow](CONTRIBUTOR_WORKFLOW.md)

Recommended issue/PR labels (documentation only — no API automation exists yet; create them in GitHub settings as needed):

| Label | Use for |
| --- | --- |
| `privacy` | Anything touching a privacy boundary/mode |
| `security` | Security hardening, guardrails, review |
| `policy` | Policy Matrix / resolver changes |
| `pbom` | PBOM updates required/affected |
| `trust-center` | User-facing guarantee changes |
| `docs` | Documentation-only work |
| `tests` | Test-only work |
| `guardrail` | Scanner/validator changes |
| `future-gate` | Work blocked behind a gate |
| `adr` | Requires or contains an ADR |
| `deferred` | Deliberately postponed (gated) |
| `accepted-limitation` | Honest boundary, not a bug |
| `anti-spyware-external` | Touches the externalized endpoint-defense boundary |
| `endpoint-hook` | Hook-only endpoint-defense contracts |
| `needs-research` | Research note required first |
| `breaking-policy-change` | Changes an existing policy guarantee |

Usage: security-sensitive PRs should carry `security` (+ `policy`/`pbom`/`trust-center` as applicable); anything touching the externalized boundary carries `anti-spyware-external` and points at Gate R.
