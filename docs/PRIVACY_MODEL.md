# FreeLayer Privacy Model

[← Docs Index](README.md) · [Threat Model](THREAT_MODEL.md) · [Metadata Model](METADATA_MODEL.md) · [ScreenShield](SCREENSHIELD.md)

> [!NOTE]
> The rule that makes this model real: **strictest policy wins**, enforced by core — not by settings screens. Modes are typed today; the enforcing engine is Gate B work.

## Purpose

Define FreeLayer's privacy goals and the mechanisms that enforce them: Privacy Modes, the Identity Firewall, the Metadata Firewall, storage policy, and AI policy. This is the contract every feature is built against.

## Current status

**Initial draft.** Modes and policies are specified conceptually; the enforcing engine (`packages/privacy` + `packages/core`) is not implemented.

## Privacy goals

1. **No mandatory identity disclosure** — no phone number, no email, no central account, no server-side user database, no address book upload. Ever.
2. **No telemetry** — no analytics, crash reporting, or usage statistics by default. There is no "anonymous telemetry" carve-out.
3. **Local-first data** — user data lives on user devices; the project cannot access it because the project runs no servers.
4. **Content AND metadata protection** — encryption alone is insufficient; see [METADATA_MODEL.md](METADATA_MODEL.md).
5. **Core-enforced policy** — privacy behavior is decided by the core policy engine, not by UI settings that features may forget to check.

## Privacy Modes

Modes are policy objects evaluated by core for every side-effectful operation. Each mode defines, at minimum: persistence, notifications, external assets, link previews, direct connections (WebRTC), metadata signals (receipts/typing/presence), local AI, media cache, room sync, and allowed transports.

| Mode | Intent | Key policy effects (initial direction) |
| --- | --- | --- |
| **Standard** | Sensible private defaults | Encrypted local persistence; no telemetry; no external assets; previews off by default but user-enableable |
| **Private** | Hardened daily use | Receipts/typing/presence off; previews and external assets hard-off; media cache minimized |
| **Ghost** | Leave minimal traces | Memory-only storage; no notifications with content; no direct connections; AI off; nothing written to disk |
| **Bunker** | Assume active local/network adversary | Ghost + only high-assurance transports (no direct IP exposure); strict capsule size padding; sync minimized |
| **Offline Capsule** | Air-gapped exchange | Network fully disabled; QR/file/USB transports only; spool-and-carry workflow |
| **Emergency** | Rapid risk reduction | One action: wipe designated data, revoke device material where possible, drop to a safe mode |
| **Sovereign Room** | Per-room constitution | The room itself carries a policy that binds all members' clients for that room's content (research: enforcement limits — a hostile client can ignore it; this bounds honest clients, not attackers) |

Rules:

- Modes may only be **tightened** per-feature, never loosened.
- Mode transitions are explicit user actions with a clear diff of what changes.
- A feature that cannot operate under the active mode **degrades or disables**; it never bypasses.

## Policy conflict rule

When device mode, room policy, transport policy, storage policy, metadata policy, and AI policy apply to the same operation and disagree:

**Strictest policy wins.** *(Locked — [ADR-0002](adr/ADR-0002-core-enforced-policy-engine.md).)*

Examples:

- Device in Bunker + room in Standard → **Bunker behavior** for that room on that device.
- Room policy forbids AI + device in Standard → **AI disabled for that room**.
- Transport leaks IP + Bunker requires no direct exposure → **transport blocked**.
- Storage policy memory-only + feature wants a cache → **cache denied**.
- Room allows read receipts + device in Private → **receipts remain disabled**.
- AI summary wants a persistent embedding cache + room policy memory-only → **cache denied**.

Enforcement:

- Conflict resolution happens in core policy evaluation — never in feature code.
- Features may tighten policies locally; they may never loosen them.
- **Loosening any policy guarantee requires an ADR or GOVERNANCE-level review.** It cannot land as an ordinary PR.
- **Every new privacy-mode capability must be added to the versioned policy schema** — no capability exists outside the schema, or it cannot be policy-checked.
- **Every machine-checkable privacy claim must eventually have a privacy-regression test.** A claim that cannot be tested is documented as a design intention, not a guarantee.

### Storage-specific policy results (TECH-05 — implemented and tested)

The first machine-checked slice of this model now exists in `packages/storage`:

- **Ghost ⇒ no persistent writes** (tested across all 30 data classes)
- **Bunker ⇒ no persistent writes** (tested across all 30 data classes)
- **Emergency ⇒ null backend, no normal writes** (delete stays possible — wipe direction)
- **ScreenShield sealed/bunker ⇒ no protected preview/thumbnail/cache writes, no reveal history**
- **AI caches follow the strictest source policy** — denied in every mode in v0 (Gate I)
- **Room policy can tighten but never loosen device storage policy** (tested both directions)

**Storage guarantees that are machine-checkable must be tested in privacy-regression tests** — `tests/privacy-regression/storage/` holds them; a claimed guarantee without a test is a documentation bug.

TECH-07 additions: **Ghost/Bunker zero-persistence is machine-checked** — no persistent backend resolvable for any data class (full-sweep tests), runtime traps prove no persistence API fires, and **mode transitions cannot auto-flush**: leaving Ghost/Bunker has no code path that moves memory state to persistent storage (structurally verified — providers expose no flush surface). Room policy composed onto Ghost/Bunker can never loosen them. ScreenShield protected-artifact hooks (reveal state, previews) are denied in strict modes and covered by the same tests. These zero-persistence tests are **required privacy-regression suites**: weakening them is a privacy-model change needing governance review.

TECH-06 additions: **storage errors and logs are privacy channels** — the barrier rejects content-grade payloads in logs/audit/endpoint classes, error messages are generic and value-free (sentinel-tested), and the zero-persistence harness re-verifies Ghost/Bunker/Emergency invariants plus untouched runtime web storage on every run. ScreenShield storage hooks (reveal state, capture audit, device-risk, watermark/canary) are policy-typed and tested even though ScreenShield itself is unimplemented.

TODO:

- [ ] Define the first policy schema (versioned, in `packages/privacy` — Gate B)
- [ ] Define the first 20 privacy-regression invariants (drawing on [METADATA_MODEL.md — Metadata regression invariants](METADATA_MODEL.md) and [STORAGE_MODEL.md — Required future tests](STORAGE_MODEL.md))
- [ ] Map each privacy mode to its allowed side effects (mode × side-effect-category matrix)

## Endpoint Defense / ScreenShield policy (future direction)

ScreenShield ([SCREENSHIELD.md](SCREENSHIELD.md), ADR-0012) adds endpoint-exposure fields to the policy schema. Planned fields (design only — no code yet):

- `screenShieldLevel` — `off | standard | protected | sealed | bunker`
- `allowClipboard`
- `allowScreenshots` *(where the platform can enforce; otherwise detection/redaction)*
- `allowScreenRecording`
- `allowTaskSwitcherPreview`
- `allowAccessibilityExposure` ([ACCESSIBILITY_PRIVACY_TRADEOFFS.md](ACCESSIBILITY_PRIVACY_TRADEOFFS.md))
- `allowProtectedContentAIExposure`
- `protectedRevealMode` — `tap | hold | timed`
- `autoRedactOnBlur`
- `platformAssuranceRequired` — minimum platform assurance to reveal ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md))

**Conflict rule: when ScreenShield conflicts with room or device policy, strictest policy wins** — the same rule as everything else. Examples:

- Standard device + ScreenShield room → **ScreenShield restrictions apply**.
- Bunker device + ScreenShield-off room → **Bunker still redacts**.
- Web/PWA + sealed content → **low-assurance warning or reveal denied**, per `platformAssuranceRequired`.
- Capture detected + protected room → **redact**.

## NetworkPolicy under Privacy Modes (TECH-08)

The network side-effect barrier is now implemented as policy (no real network exists — [NETWORK_MODEL.md](NETWORK_MODEL.md)):

- **Offline Capsule** denies all network operations; **Emergency** denies normal network operations.
- **Ghost/Bunker** deny direct network; **Private and above** deny direct peer connections (WebRTC — real-IP exposure via ICE/STUN).
- **External assets, automatic link previews, and telemetry are denied in every mode** — always (ADR-0008), never a policy field that can flip true.
- **Remote AI and update checks** denied by default.
- **Strictest wins:** room network policy can tighten but never loosen the device mode; unknown operation/transport/mode fail closed.

These are required privacy-regression suites in `tests/privacy-regression/network/`.

TECH-09: **zero egress is a default-build invariant.** The built app makes no automatic network call on load (tested); any future network capability must be policy-gated and PBOM-listed; automatic egress is a privacy violation unless explicitly designed. There is no telemetry carve-out — not even opt-out. App-runtime egress is distinct from development/CI egress (documented in [PBOM.md](PBOM.md)).

## Identity Firewall

- Local identities generated on-device; multiple identities per install.
- Ephemeral identities for one-off contexts.
- Per-contact and per-room aliases: the name you show is contextual, not global.
- One-time invites, QR verification, device keys, Device Passport, Trust Notebook, recovery kit — all future features specified in the roadmap; none require a server.

## Metadata Firewall

Summary here; full inventory in [METADATA_MODEL.md](METADATA_MODEL.md). Defaults: read receipts, typing indicators, online status, link previews, and remote assets are **off** in Private mode and above; in Standard they are individually controllable and honest about what they reveal.

## Storage policy

Storage is governed by [STORAGE_MODEL.md](STORAGE_MODEL.md): encrypted persistent, memory-only, or null backends, selected by the active mode. Caches (media, previews, AI) inherit the strictest applicable policy.

## AI privacy policy (AIPolicy)

- Local AI is **disabled by default** and unavailable entirely in Ghost/Bunker.
- No external AI API calls by default; any future opt-in remote adapter must be explicit, per-use, and visually marked.
- Prompts and outputs follow the room's storage policy; no prompt logging by default.
- Details in [LOCAL_AI.md](LOCAL_AI.md).

## Risks

- **Policy drift**: features acquiring "just this once" exceptions. Mitigation: privacy-regression tests + PR checklist + CODEOWNERS on `packages/privacy`.
- **False user confidence**: users assuming Ghost mode defeats forensics or that Bunker defeats global observers. Mitigation: in-product honesty (mode descriptions state limits) and this documentation.
- **Sovereign Room enforcement gap**: room policy binds honest clients only. Must be communicated clearly.
- **Usability collapse**: modes so strict nobody uses them. Mitigation: Standard mode must remain genuinely usable.

## Open questions

- Exact policy schema: static matrix vs. capability set vs. rule engine?
- Can mode guarantees be expressed as machine-checkable invariants (e.g. "Ghost ⇒ zero storage-backend writes")?
- ~~How do modes compose when a device-level mode and a room-level policy conflict?~~ **Resolved (Phase 0.5):** strictest policy wins — see the Policy conflict rule above.

## Future research required

- Formal specification of the policy matrix
- Notification privacy on each OS (what leaks through OS notification centers)
- PWA storage eviction vs. Ghost-mode guarantees

## Metadata Firewall under Privacy Modes (TECH-10)

Privacy Modes now govern metadata, not only content and storage/network side effects. MetadataPolicy (`packages/privacy`) composes with StoragePolicy and NetworkPolicy under the same strictest-policy-wins rule:

- **Private+** disables read receipts, typing indicators, and presence/last-seen.
- **Ghost / Bunker** additionally disable notification content, AI metadata, and any persistent metadata state (nothing metadata-shaped persists).
- **Offline Capsule** disables all network-exposed metadata.
- **Emergency** disables normal metadata generation (only a redacted wipe/revoke audit placeholder).
- **Room policy cannot loosen device metadata policy** — a permissive room never overrides a stricter device mode.

Details and the full event × sink matrix live in [METADATA_MODEL.md](METADATA_MODEL.md).

**Link previews & external assets (TECH-11):** no automatic link previews and no remote assets in any mode. Relaxed modes may show a URL as redacted plain text (domain-only); Private/Ghost/Bunker follow the content-rendering policy; ScreenShield sealed redacts the URL display entirely. A real, user-initiated preview requires a new design gate. Room policy cannot loosen these denials.

**RoomOS / RoomPolicy (TECH-16):** rooms carry a `RoomPolicy` that composes with the device mode **tighten-only** — a room can never loosen Ghost/Bunker. Room activity is metadata (denied signals); the materialized projection is derived data whose persistence follows StoragePolicy (denied everywhere in v1); strict modes redact titles and member display and never persist logs/projections; Emergency denies normal room mutation.

**Policy Conflict Regression Suite (TECH-14).** Privacy-mode consistency is now regression-protected: table-driven tests compare every concrete engine against the Policy Matrix, so a contradiction (one layer allowing what another denies) fails CI. Room and feature policies cannot loosen the device mode — proven per mode, per domain. Endpoint-defense integration is **deferred/externalized** (hooks only; [audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md](audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md)).

**Policy Matrix v1 (TECH-13) is canonical.** The privacy modes are now *defined* through matrix behavior: [POLICY_MATRIX.md](POLICY_MATRIX.md) (94 specs → 658 rules) is the single contract for what each mode permits/denies/redacts/future-gates, with strictest-policy-wins and deny-overrides composition. Undefined behavior defaults deny. Any PR that changes policy behavior must update the matrix in the same PR ([CONTRIBUTING_SECURITY.md](CONTRIBUTING_SECURITY.md)).

**Notifications (TECH-12):** notification content is denied in strict modes (and, in v0, never shown on any OS surface in any mode). Ghost/Bunker deny badge/sound/vibration by default (all denied in v0). Permission prompts are explicit user actions only — never automatic. Push is not implemented and denied. The notification-content storage class is born denied in strict modes and never plaintext in audit. Only a generic, content-free, memory-only in-app indicator may exist (Standard/Private); room policy cannot loosen device notification policy.

## TODO

- [ ] Write the policy matrix as a versioned schema in `packages/privacy` (Phase 2)
- [ ] Define the first 10 privacy-regression test cases
- [ ] In-product mode descriptions with explicit non-guarantees
- [x] Conflict-resolution rule decided: strictest policy wins (Policy conflict rule, Phase 0.5)
