# FreeLayer Threat Model

## Purpose

Define what FreeLayer protects, against whom, and — just as importantly — what it does **not** protect. Every feature design must be checked against this document.

## Current status

**Initial draft.** Written before implementation, so it describes the *intended* security posture. Nothing here is a guarantee until implemented, tested, and externally reviewed.

## Assets to protect

1. **Message and room content** — chat, notes, documents, files, tasks, decisions, polls, room memory.
2. **Cryptographic key material** — identity keys, room keys, device keys.
3. **Identity and social graph** — who a user is, who they talk to, which rooms exist and who is in them.
4. **Metadata** — timing, frequency, size, and transport traces of communication (see [METADATA_MODEL.md](METADATA_MODEL.md)).
5. **Local state** — capsule spool, caches, drafts, AI prompts/outputs, logs.
6. **The software supply chain** — the code and dependencies users actually run.

## Attacker classes

| Attacker | Capabilities | Posture |
| --- | --- | --- |
| Transport operator (relay host, email provider, messaging app used as courier) | Reads, stores, drops, delays, replays everything it carries | **Assumed hostile.** Sees only ciphertext capsules; correctness must not depend on courier honesty |
| Passive network observer (local network, ISP) | Observes traffic patterns, sizes, timing, endpoints | Content protected; metadata only partially — honest limitation |
| Active network attacker | MitM, blocking, spoofing, capsule injection/replay | Authenticity and replay protection are protocol requirements |
| Other room members / insiders | Full plaintext access to rooms they belong to; can leak, screenshot, exfiltrate | **Out of scope for confidentiality**; in scope for authenticity (no forging others' messages) and future membership revocation |
| Device thief (device at rest) | Physical access to a powered-off or locked device | Encrypted-at-rest storage, no-persistence modes, emergency wipe |
| Device compromiser (malware, forensic access to unlocked device) | Reads memory, keylogs, screenshots | **Largely out of scope** — see limitations. Ghost Vault reduces (does not eliminate) exposure |
| Global passive adversary | Correlates traffic across the entire network | **Out of scope.** FreeLayer does not claim to defeat this adversary |
| Supply-chain attacker | Malicious dependency, compromised CI, poisoned release | In scope: dependency review, CI hardening, future signed releases and SBOM |

## What FreeLayer tries to protect

- Confidentiality and integrity of content end-to-end, across **any** transport.
- No central place to subpoena, breach, or shut down — because none exists.
- No mandatory identifiers (phone/email) linking accounts to real identities.
- Reduction of unnecessary metadata by default (receipts, presence, previews off in stricter modes).
- Local data at rest, according to the active storage policy.

## What FreeLayer does NOT protect against (honest limitations)

- **Compromised devices.** If an endpoint is compromised, plaintext, keys, and future messages are exposed. Ghost Vault (offline identity keys) limits *key* exposure on the online device but cannot protect content the online device processes.
- **Malicious room members.** Encryption does not protect you from the people you invited.
- **Global or well-positioned traffic analysis.** Timing/size correlation can reveal communication relationships even with encrypted capsules. Mitigations (padding, batching, dead drops) reduce, not eliminate, this.
- **Transport-side metadata.** Using email or a messaging app as a courier exposes that courier's own metadata (sender, recipient, timestamps) to that provider. Documented per-transport in [NETWORK_MODEL.md](NETWORK_MODEL.md).
- **Legal or physical coercion of users.**
- **Operational security failures** — FreeLayer is not a substitute for opsec.

## Policy bypass as a top-level threat

**Threat:** a feature directly writes to storage, opens a network connection, loads assets, logs data, runs AI, or parses hostile input without passing through core policy. This is FreeLayer's most likely self-inflicted failure mode — not an external attacker, but a well-intentioned shortcut that silently voids a privacy mode's guarantees.

**Mitigations** (layered; each reduces but does not eliminate the risk):

- Dependency-direction lint and forbidden-import rules ([ARCHITECTURE.md — Non-bypassable architecture rules](ARCHITECTURE.md))
- `PolicyDecision` requirement in every side-effect module ([ADR-0002](adr/ADR-0002-core-enforced-policy-engine.md))
- CODEOWNERS on policy-enforcing packages ([ADR-0009](adr/ADR-0009-security-sensitive-pr-review-rules.md))
- [SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md) in every sensitive review
- Privacy-regression tests asserting mode invariants ([PRIVACY_MODEL.md](PRIVACY_MODEL.md))
- Documentation coupling, so behavior changes are visible in review ([ADR-0010](adr/ADR-0010-documentation-updated-with-code.md))

## Hostile input parsing

All externally-influenced input is treated as hostile until validated by the approved protocol parser — there is no "trusted sender" fast path, because transports are untrusted and room members may be malicious:

- capsules (all types)
- room operations
- documents
- file metadata (names, MIME types, embedded metadata)
- QR payloads
- imported bundles
- AI prompt context assembled from room content

Rules and gates for this surface live in [CAPSULENET.md — Capsule parsing is hostile-input parsing](CAPSULENET.md) and Gate E of [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md).

## Endpoint display/capture threats

Once content is decrypted and rendered, a distinct threat family applies ([ENDPOINT_DEFENSE_MODEL.md](ENDPOINT_DEFENSE_MODEL.md), ADR-0012):

- **Screenshots** — user- or software-initiated; preventable on some platforms (Android FLAG_SECURE-class, Windows capture-exclusion), only detectable-after-the-fact on others (iOS), neither on web.
- **Screen recording** — including OS features that periodically capture the desktop (Recall-class).
- **Screen sharing / remote desktop** — conferencing and support tools stream protected content; redact where detectable.
- **Task switcher thumbnails** — OS snapshots of the last rendered frame.
- **Casting / external displays** — non-secure displays receive rendered frames.
- **OCR tools** — any capture becomes searchable text.
- **Camera pointed at the screen** — unsolvable; mitigated only by reveal-minimization (hold-to-view, section-by-section rendering).

Mitigations are platform-dependent and reported honestly ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md)); web/PWA is structurally low-assurance for sensitive views.

## Spyware and compromised endpoint

Stated without hedging:

- If the endpoint is compromised, plaintext may be captured — full stop.
- Keyloggers and screen recorders operating with sufficient privilege defeat app-level protections.
- Root/jailbreak/kernel malware is **out of scope for full protection**; detection of it is unreliable and adversarial (advisory at most).
- Accessibility-service abuse reads screens and injects input through legitimate OS channels; FreeLayer cannot distinguish it from assistive technology it must support ([ACCESSIBILITY_PRIVACY_TRADEOFFS.md](ACCESSIBILITY_PRIVACY_TRADEOFFS.md)).
- Ghost Vault reduces online **key** exposure but not the content exposure of whatever the online device renders.
- **ScreenShield reduces capture risk; it does not eliminate it** ([SCREENSHIELD.md](SCREENSHIELD.md)).

## Overlay / tapjacking

Overlay attacks trick users into acting on hidden UI. Sensitive actions (reveal, send, wipe, key operations, mode changes) require anti-overlay measures — touch-filtering-class defenses per OWASP MASTG — where the platform provides them.

## Browser extension risk (web/PWA)

Extensions with host permissions read and modify the DOM and can capture tabs, invisibly to the page. No web mitigation exists; consequence: PWA sensitive views carry a permanent low-assurance label, and sealed/bunker content is restricted or denied on web.

## AI/GUI agent screenshot risk

Screen-observing AI agents (OS assistants, GUI automation, Recall-class recorders) are functionally screen capture and are treated as a privacy boundary: capture-exclusion where available, capture-aware redaction otherwise, and explicit user education that content exposed to external AI tools leaves FreeLayer's control ([LOCAL_AI.md](LOCAL_AI.md)).

## Component-specific risk notes

### Transports
Untrusted by design. Risks: dropped/delayed capsules (availability is best-effort), replay (protocol must include replay protection — *TODO design*), capsule flooding/spam (see [CAPSULENET.md](CAPSULENET.md) anti-spam future work).

### Local AI (threat annex placeholder)

Prompts and outputs are derived plaintext. This placeholder becomes a full annex before any AI feature ships (Gate I). It must cover, at minimum:

- **Prompt injection** — hostile room content (documents, messages) crafted to steer AI output or smuggle instructions; AI must never treat room content as system instructions ([LOCAL_AI.md — Prompt injection and hostile room content](LOCAL_AI.md)).
- **Derived cache leaks** — embeddings, indexes, and summaries persisting beyond the source content's storage policy.
- **Model supply chain** — model weights as large opaque binaries: sourcing, hashing, and update policy required.
- **Cross-room leakage** — context assembly must be room-scoped; cross-room context is forbidden without a future ADR.
- **False extraction of decisions/tasks** — hallucinated or injected extractions gaining authority; mitigated by the human-confirmation rule.
- **Zero-network requirement** — the default build performs no AI network calls; verified by test.

Constraint: AI runs only under AIPolicy, disabled by default, unavailable in Ghost/Bunker (see [LOCAL_AI.md](LOCAL_AI.md), [ADR-0007](adr/ADR-0007-local-ai-disabled-by-default.md)).

### Ghost / Bunker modes
Reduce persistence and network exposure but cannot make a device forensically clean: OS swap, filesystem journaling, and hardware behavior are outside app control. These modes are **harm reduction, not guarantees**.

### Sovereign Rooms sync
Merging state from multiple devices creates ordering/consistency attack surface: a malicious member may attempt history manipulation. Operation-log authentication is a design requirement (see [SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md)).

## Open questions

- Formal protocol verification: which properties, which tooling? *(TODO research)*
- Deniability vs. non-repudiation: do room decisions need signatures (proof-of-agreement) while chat stays deniable?
- Multi-device identity: how do device keys relate to identity keys without a server to mediate?

## Future research required

- Replay and duplicate suppression for high-latency, out-of-order transports
- Traffic-analysis resistance literature (padding, cover traffic costs)
- Forensic residue of browsers/Tauri on each OS (for no-persistence claims)

## TODO

- [ ] Per-transport threat annexes as each transport is designed
- [ ] STRIDE (or similar) pass over the capsule lifecycle
- [ ] Define security invariants testable in `tests/security-regression/`
- [ ] Revisit this document at the end of every roadmap phase
