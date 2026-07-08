# @freelayer/ai

**Status: interfaces plus `DisabledAIProvider`, which always rejects. No AI code before Gate I (Phase 8), by policy (ADR-0007). No runtime dependencies.**

Optional local-AI adapters behind AIPolicy: room summaries, task/decision extraction, document Q&A, semantic search — local-only, disabled by default, unavailable in Ghost/Bunker modes.

Hard rules: no external AI API calls in the default build; no prompt logging; AI caches follow storage policy; outputs are provenance-labeled suggestions until a human confirms them.

See [docs/LOCAL_AI.md](../../docs/LOCAL_AI.md).
