# Wiki source

This directory is the **reviewed source of truth for the GitHub wiki** (<https://github.com/XGiammyX/freelayer/wiki>). Pages here are friendly navigation summaries; the canonical documentation always lives in [`docs/`](../docs/README.md), and wiki pages link into it rather than restating it.

## Publishing

```bash
pnpm wiki:publish
```

**One-time bootstrap (GitHub limitation):** the wiki's git repository does not exist until the first page is created once through the web UI. Open the [wiki tab](https://github.com/XGiammyX/freelayer/wiki), click "Create the first page", save it with any content, then run the command above — it will overwrite the placeholder with these pages and keep them in sync on every future run.

## Rules

- Edit wiki pages **here**, via PR — never directly in the wiki UI (the next publish overwrites UI edits).
- Wiki pages must never contradict `docs/`; when in doubt, link instead of restating.
- Same content rules as everywhere: no overclaiming, no external assets beyond plain links, honest status labels.
