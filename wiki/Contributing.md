# Contributing

We are building slowly, because privacy/security software should not be rushed — and right now, **research and documentation verification are as valuable as code**.

## Start here

1. Read [CONTRIBUTING.md](https://github.com/XGiammyX/freelayer/blob/main/CONTRIBUTING.md) — process, standards, hard lines.
2. Pick something from [Contributor Tasks](https://github.com/XGiammyX/freelayer/blob/main/docs/CONTRIBUTOR_TASKS.md) — good-first, research, and security tasks, each self-contained.
3. Security-sensitive areas (crypto, privacy, storage, capsule parsing) follow stricter rules: [CONTRIBUTING_SECURITY.md](https://github.com/XGiammyX/freelayer/blob/main/docs/CONTRIBUTING_SECURITY.md).

## The hard lines (every PR)

- **No custom crypto** — designs cite prior art; implementation waits for review (ADR-0004).
- **No telemetry. No external assets.** CI fails on both — the checks are not decorative.
- **No policy bypass** — side effects go through core; import boundaries are checked mechanically.
- **Docs and tests ship in the same PR** as behavior changes (ADR-0010).
- **No overclaiming language** — "unbreakable", "perfect anonymity", "impossible to exploit" are review-blockers.

## A perfect first contribution

Pick one row of the [comparison](https://github.com/XGiammyX/freelayer/blob/main/docs/PUBLIC_COMPARISON.md) marked *TODO verify*, check it against that project's official documentation, and open a PR fixing or confirming the row with sources. Small, valuable, and it makes the project more honest.

## Reporting security issues

Never in a public issue — use the Security tab's private reporting ([SECURITY.md](https://github.com/XGiammyX/freelayer/blob/main/SECURITY.md)).
