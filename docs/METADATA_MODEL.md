# FreeLayer Metadata Model

## Purpose

Inventory the metadata FreeLayer's design can generate, classify who can observe each item, and define the mitigation roadmap. Content encryption without metadata discipline is an incomplete privacy story — this document exists to keep the project honest about that.

## Current status

**Initial inventory.** Classifications are design-time estimates; they must be re-validated against real implementations per phase.

## Metadata categories

### 1. Communication-pattern metadata

| Item | Observable by | Initial direction |
| --- | --- | --- |
| Message timing | Transport operators, network observers | Batching and randomized send windows in stricter modes; dead-drop delivery decouples send from receive *(TODO research: latency cost)* |
| Message frequency | Same | Cover traffic is expensive; document rather than promise *(TODO research)* |
| Message size | Same | Capsule padding to size buckets; bucket sizes TBD in protocol design |
| Communication relationships (who↔whom) | Transport operators; strong observers via correlation | Per-transport blinding; relays see opaque destinations *(design in CAPSULENET.md)*; honest limit: correlation attacks remain possible |

### 2. Network metadata

| Item | Observable by | Initial direction |
| --- | --- | --- |
| IP address exposure | Relays, direct peers, network path | No direct connections (WebRTC) in Private+; relay indirection; future Tor/proxy support |
| Relay exposure | The relay operator | Relays receive only ciphertext + minimal routing hint; relay choice is user-controlled and diverse |
| Transport-native metadata (email headers, messenger accounts, file timestamps) | That transport's provider | Documented per transport; users choose transports knowing their leakage profile |

### 3. Application-signal metadata

| Item | Default in Standard | Private and above |
| --- | --- | --- |
| Read receipts | Off *(TBD — may be per-conversation opt-in)* | Hard off |
| Typing indicators | Off | Hard off |
| Online/presence status | Off | Hard off |
| Delivery acknowledgements | Minimal, encrypted as normal capsules | Batched/delayed |

Signals, when enabled, are themselves carried as encrypted capsule content — never as transport-visible plaintext.

### 4. Content-adjacent leaks

| Item | Risk | Initial direction |
| --- | --- | --- |
| Link previews | Fetching a link reveals the URL and reader IP to the target server at read time | Off by default in all modes; if enabled, explicit per-click, never automatic |
| External assets (remote images, fonts, scripts) | Tracking pixels, IP + fingerprint leaks | Banned by default project-wide (hard constraint); no exceptions in v1 |
| Remote avatars | Same as external assets | Avatars travel as capsule content, never as remote fetches |

### 5. Local metadata

| Item | Risk | Initial direction |
| --- | --- | --- |
| Local logs | Plaintext residue of activity | No sensitive data in logs (hard constraint); log levels respect storage policy |
| Crash reports | Memory dumps may contain plaintext/keys | No crash reporting by default; any future opt-in must scrub and be documented in PBOM |
| AI prompts/cache | Derived plaintext of room content | Follow room storage policy; see [LOCAL_AI.md](LOCAL_AI.md) |
| Media/preview caches | Content residue after deletion | Cache policy bound to mode; emergency wipe covers caches |

### 6. Endpoint exposure metadata (local-only)

Endpoint defense generates its own metadata ([ENDPOINT_DEFENSE_MODEL.md](ENDPOINT_DEFENSE_MODEL.md)):

| Item | Nature | Initial direction |
| --- | --- | --- |
| Screenshot events (where detectable) | Local event | Local audit only, redacted |
| Screen recording / capture active | Local state | Drives redaction; never uploaded |
| Reveal timing / protected-view duration | Local behavioral metadata | Memory-only in strict modes; never uploaded |
| Clipboard events (sensitive copy) | Local event | Clipboard Firewall state; expiry tracked locally |
| Focus/blur events on protected surfaces | Local event | Drives auto-redact; not persisted in strict modes |
| Task-switcher exposure state | Local state | Redaction coordination only |
| External display / cast state | Local state | Device Risk input |
| Platform capability state | Local state | Shown in UI; PBOM-listed |

**These are local-only by rule: no upload, no telemetry (ADR-0008), audit events redacted, PBOM entries required, storage policy applies** ([STORAGE_MODEL.md](STORAGE_MODEL.md)) — local metadata still leaks through logs/caches if mishandled, which is why it falls under the same write-barrier and no-plaintext-logging discipline as content.

TECH-07 additions: strict modes also reduce **storage-shaped metadata** — capsule spool existence/timing stays in memory-only record metadata (never persisted), cache existence is denied outright (a cache that doesn't exist can't be enumerated), and mode-transition state leaves no persistent trace. Development-time metadata is covered too: test/CI artifacts are sentinel-scanned so secrets can't leak into snapshots, coverage, or build output.

Storage itself also *generates* metadata: the existence of a capsule spool, cache entries, reveal state, device-risk state, capture audit events, storage keys/names, bundle-export timestamps, and materialized room state all describe behavior even when encrypted. Mitigations (TECH-05 onward): coarse timestamps where needed, no plaintext in logs/audit (barrier-enforced), no caches in strict modes (matrix-enforced), PBOM enumeration of every storage class, and privacy-regression tests over the machine-checkable parts.

## Metadata regression invariants

Initial machine-checkable invariants, to be enforced as privacy-regression tests when the relevant components exist ([PRIVACY_MODEL.md — Policy conflict rule](PRIVACY_MODEL.md)):

1. Private mode and stricter must not send typing indicators.
2. Private mode and stricter must not send read receipts.
3. Private mode and stricter must not publish online presence.
4. Bunker must not use WebRTC or any direct-IP transport.
5. Bunker must not fetch remote assets (all modes forbid this by default; Bunker admits no override).
6. All modes must block automatic external link previews.
7. Ghost/Bunker must not persist notification content.
8. AI must not create network calls in the default build.
9. External-app courier transports must display a leakage warning in UX before use.
10. Relay transport must be labeled as exposing timing, size, and IP to the relay unless Tor/proxy layering is active.

TODO:

- [ ] Implement wire-level metadata tests when transports exist (Phase 10)
- [ ] Implement UI leakage labels per transport (design at Gate D)

## Mitigation roadmap

- **Phase 2 (policy engines):** application signals off by default and policy-gated; external assets/link previews blocked in core.
- **Phase 4 (CapsuleNet MVP):** capsule size padding buckets; replay-safe delivery acks; relay blinding design.
- **Phase 5–6:** batching/randomized send windows; dead-drop patterns.
- **Phase 9–10:** measure real leakage (instrumented builds), privacy-regression tests asserting signal absence on the wire.
- **Research track:** timing correlation resistance, cover traffic economics, Tor/proxy integration.

## Risks

- **Overpromising.** Metadata reduction has hard limits; a determined observer of both endpoints can correlate. All user-facing text must reflect this.
- **Transport composition surprises**: a user combining a "safe" mode with a leaky transport (e.g. email courier) may assume more protection than exists. Mitigation: per-transport leakage labels in UI *(TODO design)*.
- **Padding/batching cost**: bandwidth and latency overhead may push users to disable mitigations.

## Open questions

- Which padding bucket sizes balance leakage vs. overhead for text/file capsules?
- Are delivery acks worth their metadata cost in Bunker mode, or should Bunker be fire-and-forget?
- Can capsule spool timestamps be coarsened without breaking ordering guarantees?

## Future research required

- Literature review: traffic analysis on store-and-forward mix-like systems (Nym, Loopix, Pond history)
- Empirical: what metadata each candidate transport leaks in practice
- OS notification pipelines as a metadata channel

## TODO

- [ ] Metadata leakage label schema per transport
- [ ] Padding bucket proposal in protocol design (Phase 4)
- [ ] First wire-level privacy-regression tests (Phase 10)
- [ ] Re-audit this inventory at each phase boundary
