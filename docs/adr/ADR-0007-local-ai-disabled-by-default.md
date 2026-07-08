# ADR-0007: Local AI disabled by default

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

AI features over private communications create a second copy of the user's most sensitive data: prompts, embeddings, indexes, summaries. Handled casually, they become a shadow database that outlives privacy modes and a network channel that leaks content to third-party APIs. FreeLayer wants the utility (summaries, task extraction, document Q&A) without the betrayal.

## Decision

1. **Local AI is disabled by default** — per device and per room. Enabling it is an explicit, informed opt-in.
2. **No external AI API calls and no cloud AI dependency in the default build.** The default build performs zero AI-related network operations. Any hypothetical future remote adapter would require its own ADR, per-use consent, and unmistakable UI marking — and will never be a default.
3. **AI is entirely unavailable in Ghost and Bunker modes**, enforced by core policy (ADR-0002), not UI.
4. **No prompt logging by default.** Prompts, outputs, embeddings, and indexes are derived room content governed by storage policy (ADR-0005) and enumerated in [PBOM.md](../PBOM.md).
5. **AI outputs are suggestions until human-confirmed.** AI may never write directly to room memory, the decision ledger, or tasks without explicit user confirmation. All outputs carry provenance labels.
6. Implementation is blocked by the **AI implementation gate** ([LOCAL_AI.md](../LOCAL_AI.md)): AIPolicy, AI Privacy Guard, storage/cache policy, prompt-injection threat annex, zero-network test, no-log test, model supply-chain policy, and output provenance format must exist first (Gate I).

## Consequences

- AI ships late (Phase 8+), behind every other policy mechanism. Accepted deliberately.
- Local-only inference limits model quality/speed on modest hardware; the feature degrades to "off", never to "call a cloud API".
- Room documents are a prompt-injection vector against AI features; the threat annex is mandatory before any Q&A feature.

## Security impact

- Model artifacts are a supply-chain surface: sourcing, hashing, and update policy are required PBOM entries before shipping.
- The human-confirmation rule prevents hallucinated or injected AI output from silently becoming authoritative room state.

## Privacy impact

- No user content leaves the device for AI purposes, ever, in the default build.
- AI-derived artifacts cannot outlive the strictest source policy (cache inheritance, ADR-0005) and vanish entirely in Ghost/Bunker.

## What would require a new ADR

- Any remote/cloud AI adapter, even opt-in.
- AI availability in Ghost or Bunker.
- Any AI write path lacking human confirmation.
- Default-enabled AI features of any kind.
- Cross-room context assembly (AI reading beyond the requesting room).
