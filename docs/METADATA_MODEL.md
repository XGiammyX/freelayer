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

## Network metadata leakage labels (TECH-08)

Each transport carries an honest, plain-language leakage label (`describeNetworkMetadataLeakage`, `packages/transports`) surfaced in UX and docs so a transport choice is never a silent metadata decision:

| Transport | IP | Timing | Size | Relationship | Third-party endpoint | Exposure |
| --- | --- | --- | --- | --- | --- | --- |
| QR / file / USB | no | no | (file/usb: size) | no | no | local_only / low |
| LAN | yes | yes | yes | yes | no | medium |
| relay | yes | yes | yes | yes | yes | medium (high without Tor/proxy) |
| email / external_app | yes | yes | yes | yes | yes | high |
| WebRTC | yes (real IP via ICE/STUN) | yes | yes | yes | yes | high — **denied in Private+** |
| HTTP / WebSocket | yes | yes | yes | yes | yes | high — forbidden until approved |
| tor_proxy (future) | no (from relay) | yes | yes | no | no | medium |
| unknown | assumed yes | yes | yes | yes | yes | unknown — **denied** |

TECH-09: **zero egress by default reduces the metadata surface at the root** — with no automatic network calls on load, there is no IP/timing/fingerprint leak from remote assets, no update-check or telemetry beacon, and no link-preview fetch to correlate. Any future egress reintroduces these channels and must be policy-gated and PBOM-listed. Development/CI metadata (registry/GitHub contact during `pnpm install`/Actions) is separate from app-runtime metadata and documented in [PBOM.md](PBOM.md).

Related risks: DNS queries, request frequency, capsule size, headers/cookies/referrers, link-preview and remote-asset requests, and update-check/telemetry beacons — all denied or unimplemented. Mitigation is NetworkPolicy (metadata is part of the decision) plus per-transport UX warnings; timing/size correlation cannot be fully eliminated.

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

## TECH-10 — Metadata Firewall implementation

The Metadata Firewall is now a real policy engine in `packages/privacy` (MetadataPolicy v0), the sibling of StoragePolicy and NetworkPolicy. It treats metadata as sensitive data: every metadata-producing behavior is classified and gated.

**Taxonomy.** A `MetadataEventKind` (40 events) × `MetadataSink` (12 sinks) triple resolves through `resolveMetadataPolicy(input)` to a `MetadataPolicy` — `{ action, allowed, persistentAllowed, networkAllowed, userVisibleWarningRequired, reason }`. Events are grouped: application-signal (receipts/typing/presence/room-activity), notification, external-fetch (link preview / remote asset/avatar / navigation), derived-preview (cache/preview/thumbnail existence), network-metadata (timing/size/relay/LAN/ICE), AI-derived, local-state (spool existence/timestamp), log/audit, and endpoint/ScreenShield.

**Default-deny behavior.**
- Unknown mode/event/sink → **fail closed**.
- Receipts/typing/presence/last-seen → off by default, denied in Private+ (v0 denies all — no messaging exists).
- Link preview / external assets / remote avatars / crash reports / telemetry-shaped → forbidden every mode (ADR-0008).
- Notification content → denied in strict modes (v0 denies all notification metadata).
- AI metadata → denied in Ghost/Bunker (v0 denies all — Gate I).
- Protected reveal state → denied in strict/sealed; **v0 invariant: no metadata persists and none egresses** — the ceiling for any allowed event is memory-only, redacted.

**Strictest-policy-wins.** Room policy composes tighten-only; a permissive room can never loosen a stricter device mode.

**Enforcement.** Metadata operations pass a barrier (`assertMetadataOperationAllowed`) that requires an authentic, exactly-scoped `PolicyDecision` — reusing the existing module-private WeakSet provenance registry ([ARCHITECTURE.md](ARCHITECTURE.md)), not a new mechanism. New side-effect scopes: `metadata.emit/store/notify/log/audit/network_expose`, `receipt.emit`, `typing.emit`, `presence.emit`, `notification.show` (plus existing `link.preview`/`asset.fetch`).

**Redaction.** Metadata payloads may carry only numeric/boolean counters and flags — **never strings** (a slug is indistinguishable from a room name). `redactMetadataPayload` and `createRedactedAuditEvent` drop everything else; the sentinel never survives.

**Integration.** MetadataPolicy is self-contained (privacy may not import storage/transports — the boundary rule), so agreement with StoragePolicy and NetworkPolicy is proven by `tests/privacy-regression/metadata/metadata-integration.test.ts` (link preview, external assets, WebRTC, telemetry, preview/AI caches, persistence).

**Tested / not solved.** 47 metadata tests (privacy + security + integration) cover the matrix, redaction, sentinel-freedom, decision authenticity, and cross-policy agreement. Not solved here: real messaging, notifications, batching/padding/cover traffic, protocol-level anonymity — see [research/METADATA_FIREWALL_RESEARCH.md](research/METADATA_FIREWALL_RESEARCH.md) and [audits/TECH_10_METADATA_THREAT_MODEL.md](audits/TECH_10_METADATA_THREAT_MODEL.md).

**Platform-state note.** The AST-backed ESLint guardrails and the WeakSet `PolicyDecision` provenance registry are already-resolved foundation items ([PLATFORM_STATE_ANALYSIS.md](PLATFORM_STATE_ANALYSIS.md)); TECH-10 builds on them and does not replace them.

## TODO

- [ ] Metadata leakage label schema per transport
- [ ] Padding bucket proposal in protocol design (Phase 4)
- [ ] First wire-level privacy-regression tests (Phase 10)
- [ ] `Referrer-Policy: no-referrer` + user-initiated-only preview model (TECH-11)
- [ ] Re-audit this inventory at each phase boundary
