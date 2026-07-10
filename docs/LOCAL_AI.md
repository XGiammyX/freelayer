# FreeLayer Local AI

## Purpose

Define how FreeLayer will — eventually, optionally — use AI without breaking its privacy model: local-only by default, disabled by default, always subordinate to Privacy Modes and a dedicated AIPolicy.

## Current status

**Research placeholder.** No AI functionality exists or is scheduled before Phase 8. This document exists now so that earlier architecture (storage policy, privacy modes, PBOM) reserves the right hooks.

## Goals

Local AI as a *user-serving lens over the user's own data*:

- **Room summaries** — catch up on a busy room without reading everything
- **Task extraction** — surface action items from discussion
- **Decision extraction** — detect decisions worth recording in the decision ledger
- **Document Q&A** — ask questions over the room's documents
- **Semantic search** — find things by meaning across a room
- **Privacy risk explanation** — plain-language explanation of what a mode/transport choice reveals (AI as privacy educator)

## Hard rules

1. **No external AI API by default.** No cloud AI dependency by default. The default build performs zero AI-related network calls.
2. **Disabled by default.** Local AI is opt-in per device and per room.
3. **No prompt logging by default.** Prompts and outputs are treated as derived room content.
4. **AIPolicy under Privacy Modes**: Ghost and Bunker disable AI entirely; other modes gate which features may run and what may be cached.
5. **AI cache under storage policy**: embeddings, indexes, and summaries inherit the strictest policy of their source data ([STORAGE_MODEL.md](STORAGE_MODEL.md)) and are enumerated in [PBOM.md](PBOM.md).
6. Any future *optional* remote adapter (explicitly out of scope for now) would require: per-use consent, unmistakable UI marking, PBOM entry, and elevated review. It will never be a default.

## AI implementation gate

**Local AI must not be implemented until all of the following exist.** This is Gate I ([IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)), locked by [ADR-0007](adr/ADR-0007-local-ai-disabled-by-default.md):

1. AIPolicy exists in the policy engine.
2. AI Privacy Guard exists.
3. Storage/cache policy exists and governs AI artifacts.
4. The prompt-injection threat annex exists in [THREAT_MODEL.md](THREAT_MODEL.md).
5. A zero-network AI test exists (the default build performs no AI network calls).
6. A prompt/cache no-log test exists.
7. The [PBOM.md](PBOM.md) AI section is complete.
8. A model supply-chain policy exists (sourcing, hashing, update policy for model artifacts).
9. An AI output provenance format exists (model, source room, date, confirmation status).

Standing rules, binding regardless of gate status:

- **AI must be disabled in Ghost and Bunker** — enforced in core policy, not UI.
- **AI is opt-in per device and per room.** Neither opt-in implies the other.
- **AI outputs are suggestions until human-confirmed.**
- **AI may never write directly to room memory, the decision ledger, tasks, documents, or polls** without explicit user confirmation.
- **AI may never use cross-room context** unless a future ADR explicitly allows it.
- **AI may never call external APIs in the default build.**
- **AI models and embeddings are privacy-sensitive artifacts** — inventoried in PBOM, governed by storage policy, covered by the supply-chain policy.
- **AI cache inherits the strictest policy of its source content** ([ADR-0005](adr/ADR-0005-storage-selected-only-by-policy.md)).

## AI storage classes (TECH-05 hooks)

The storage policy matrix now types AI artifacts explicitly: `ai_prompt_cache`, `ai_embedding_index`, `ai_output_cache` — all **derived content**. Current state: **no AI cache implementation exists**, and the matrix denies AI-cache writes in *every* mode (including Standard/Private) until AIPolicy exists (Gate I); Ghost/Bunker/Emergency deny them permanently by mode. When AI storage eventually happens, it requires **AIPolicy + StoragePolicy together** — an allowing AIPolicy cannot override a denying StoragePolicy, and vice versa.

## Prompt injection and hostile room content

Room content is hostile input for AI purposes, exactly as it is for parsers ([THREAT_MODEL.md — Hostile input parsing](THREAT_MODEL.md)):

- **Room members can intentionally add malicious documents or messages to influence AI output** — steering summaries, planting false "decisions," or smuggling instructions into content the AI will read.
- **AI output must not be treated as authoritative.** It is a suggestion with provenance, subject to human confirmation — always.
- **AI must not execute instructions found in room content as system instructions.** Content is data to be analyzed, never directives to be obeyed; the adapter layer must maintain this separation structurally, not by prompt phrasing alone.
- **AI tools must be narrow and policy-gated.** No general-purpose tool use; each capability (summarize, extract, answer) is a distinct, individually policy-checked operation.
- **Document Q&A requires the prompt-injection threat annex before implementation** (Gate I) — Q&A over member-authored documents is the highest-exposure AI feature.

No mitigation eliminates prompt injection; these rules bound its blast radius (no writes without confirmation, no cross-room context, no external calls, provenance on everything).

## Design direction

- **Model adapters** in `packages/ai`: a narrow interface over local runtimes (candidates to research: llama.cpp-family runtimes, ONNX Runtime, WebGPU-based in-browser inference). The core never talks to a model directly; it talks to an adapter governed by AIPolicy.
- **AI Privacy Guard**: a policy layer that (a) checks the active mode before any inference, (b) scopes model input to the requesting room only — no cross-room context assembly, (c) tags all outputs with provenance ("AI-derived, from room X, model Y, date"), and (d) routes outputs through the same storage-policy machinery as any content.
- Derived artifacts are **suggestions, not records**, until a human confirms them (an extracted decision does not enter the decision ledger by itself).

## AI and screen exposure (Endpoint Defense — ADR-0012)

Rules coordinating AI with ScreenShield ([SCREENSHIELD.md](SCREENSHIELD.md), [PROTECTED_CONTENT_POLICY.md](PROTECTED_CONTENT_POLICY.md)):

- Local AI must **not** receive ScreenShield-protected content unless policy explicitly allows it (`allowProtectedContentAIExposure`).
- AI must not process sealed/bunker content by default.
- **AI must never bypass ProtectedContent** — there is no AI side-door to plaintext that the rendering surface would deny.
- AI/GUI agents that observe screenshots are an explicit threat ([THREAT_MODEL.md](THREAT_MODEL.md)): screen-observing assistants are screen capture with a different name.
- Document Q&A over protected documents requires its own policy decision, separate from room-level AI opt-in.
- Screenshots sent to **external** AI tools are outside FreeLayer's control — user education must warn about this explicitly; no technical control can follow content off-device.

Prompt-injection relation: malicious room content can manipulate local AI (below), and malicious *visible UI* can manipulate screen-based agents the same way — ScreenShield and the AI Privacy Guard must coordinate: capture-exclusion limits what screen agents see; the Privacy Guard limits what local AI receives.

## Risks

- **Cache betrayal**: embeddings/indexes are content in disguise; treating them casually would silently break Ghost-adjacent guarantees. (Mitigated structurally by rule 5.)
- **Model supply chain**: model weights are large opaque binaries; sourcing, hashing, and update policy needed *(TODO research — extends PBOM)*.
- **Resource reality**: local inference on modest hardware may be slow/hot; the feature must degrade to "off" gracefully, never to "let's call a cloud API".
- **Output leakage across boundaries**: a summary pasted out of a room leaves the crypto boundary — a user-education issue, flagged in provenance labels.
- **Hallucinated extractions**: wrong AI-extracted decisions/tasks entering room memory — mitigated by human-confirmation rule.

## Bunker/Ghost restrictions

AI is fully unavailable in Ghost and Bunker: inference produces memory artifacts and timing signals inconsistent with those modes' goals, and cache rules would forbid persistence anyway. This restriction is enforced in core policy, not UI.

## Open questions

- Which runtime targets are realistic for the desktop shell vs. the PWA?
- On-device embedding index format that supports crypto-shredding?
- Should AI features be a separately-installed component so the default build ships zero AI code? *(leaning yes — TODO decide)*

## Future research required

- Local runtime evaluation (quality/latency/footprint) on mid-range hardware
- Prompt-injection resistance for Document Q&A over hostile room content (a malicious member can craft documents that steer the AI — real risk, needs design)
- Verified/reproducible model artifact distribution

## TODO

- [ ] (TECH-10) AI *existence* is metadata: `ai.prompt_exists`, `ai.cache_exists`, and `ai.summary_exists` are denied in Ghost/Bunker (and everywhere in v0 — Gate I). AI outputs must never enter audit/log metadata without redaction. MetadataPolicy denies these events; StoragePolicy denies AI caches. See [METADATA_MODEL.md](METADATA_MODEL.md).
- [ ] AIPolicy schema alongside Privacy Modes work (Phase 2 leaves hooks; Phase 8 fills them)
- [ ] Model adapter interface draft
- [ ] AI Privacy Guard design doc
- [ ] Prompt-injection threat annex to THREAT_MODEL.md before any Q&A feature
- [ ] PBOM sections for models, caches, and (absent) AI network calls
