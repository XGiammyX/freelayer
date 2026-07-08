# Contributor Tasks

[← Docs Index](README.md) · [Contributing guide](../CONTRIBUTING.md) · [Security-sensitive rules](CONTRIBUTING_SECURITY.md)

> [!TIP]
> At this stage, verifying one comparison row against official docs is as valuable as a code PR — and a perfect first contribution.

Concrete, self-contained ways to help right now. At this stage, **research and documentation verification are as valuable as code.** Before starting: read [CONTRIBUTING.md](../CONTRIBUTING.md); for anything security-flavored, also [CONTRIBUTING_SECURITY.md](CONTRIBUTING_SECURITY.md).

These are prepared as issue-ready tasks; GitHub issues will be created from them as the contributor base grows.

## Good first tasks

- **Verify one row of [PUBLIC_COMPARISON.md](PUBLIC_COMPARISON.md)** against the project's official docs (each row marked *TODO verify* is one task). Cite sources in the PR.
- **Improve the plain-English explanation** ([PUBLIC_EXPLANATION.md](PUBLIC_EXPLANATION.md)) — clarity fixes, better analogies, translation-friendliness.
- **Improve docs navigation** — broken links, missing cross-references, better one-line summaries in [docs/README.md](README.md).
- **Add or refine glossary entries** ([GLOSSARY.md](GLOSSARY.md)) — especially keeping "Status" columns honest as the project moves.
- **Design polish for the web shell** (`apps/web`) — spacing, typography, contrast, responsiveness. Constraint: zero external assets, system fonts only.
- **Add tests for the guardrail scripts** (`scripts/check-*.mjs`) — e.g. fixture directories with planted violations, asserting exit codes and messages.

## Research tasks

- **CRDT metadata leakage comparison** — Yjs vs. Automerge vs. Loro vs. event-sourced log: what do actor IDs/tombstones/update structures reveal inside encrypted payloads? (Feeds the Gate H ADR — [SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md).)
- **Store-and-forward prior art survey** — Pond, Briar/Bramble, LXMF, mixnet mailboxes: replay handling, mailbox privacy, retention. (Feeds Gate E — [CAPSULENET.md](CAPSULENET.md).)
- **Platform screenshot-protection API deep dives** — one platform per task; extend [ENDPOINT_RESEARCH_NOTES.md](ENDPOINT_RESEARCH_NOTES.md) with version-specific behavior (esp. macOS detection and Linux portals).
- **PWA storage limitations analysis** — eviction behavior per browser vs. the no-persistence claims in [STORAGE_MODEL.md](STORAGE_MODEL.md).
- **Verify current state of SimpleX / Session / Briar / Matrix** for [COMPETITOR_COMPARISON.md](COMPETITOR_COMPARISON.md) — one project per task, official docs only.

## Security tasks

- **Improve `check:no-external-assets`** — broader host list, CSS `url()` edge cases, false-positive review.
- **Improve `check:no-telemetry`** — additional SDK indicators, manifest-only deep scan.
- **Improve `check:no-forbidden-storage`** — reduce comment false-positives, prepare the AST-based successor (evaluate `dependency-cruiser` / `eslint-plugin-boundaries` per [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md)).
- **Review GitHub Actions permissions** against [GITHUB_ACTIONS_AUDIT.md](GITHUB_ACTIONS_AUDIT.md) — verify least privilege still holds after any workflow change.
- **Draft the ProtectedContent lint rule** — detect raw rendering of sensitive fields (design in [PROTECTED_CONTENT_POLICY.md](PROTECTED_CONTENT_POLICY.md)); a proposal + prototype is enough, enforcement lands with Gate K.

## Ground rules for all tasks

No telemetry, no external assets, no custom crypto, no policy bypass, no overclaiming language ("unbreakable", "impossible", "perfect anonymity" are review-blockers). Docs and tests ship in the same PR as behavior changes.
