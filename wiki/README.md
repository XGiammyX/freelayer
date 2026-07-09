# Wiki source

This directory is the **reviewed source of truth for the GitHub wiki** (<https://github.com/XGiammyX/freelayer/wiki>). Pages here are friendly navigation summaries; the canonical documentation always lives in [`docs/`](../docs/README.md), and wiki pages link into it rather than restating it.

## Publishing

```bash
pnpm wiki:publish
```

**The wiki is live** (bootstrapped 2026-07-09; the one-time UI step GitHub requires is done). Every run of the command above syncs the pages here to <https://github.com/XGiammyX/freelayer/wiki>, overwriting any direct wiki-UI edits. `README.md` in this directory is excluded — it documents the directory, it is not a wiki page.

## Scheduled update

**When an easy installation exists** (first installable release, Phase 11 / Gate J): rewrite [Getting-Started](Getting-Started.md) with real end-user install steps, and refresh [Home](Home.md) + [FAQ](FAQ.md) with fuller explanations for non-contributors. Tracked in [docs/ROADMAP.md](../docs/ROADMAP.md) (infrastructure track).

## Rules

- Edit wiki pages **here**, via PR — never directly in the wiki UI (the next publish overwrites UI edits).
- Wiki pages must never contradict `docs/`; when in doubt, link instead of restating.
- Same content rules as everywhere: no overclaiming, no external assets beyond plain links, honest status labels.
