# FreeLayer Threat Model

[← Docs Index](README.md) · [Privacy Model](PRIVACY_MODEL.md) · [Data Leakage Map](DATA_LEAKAGE_MODEL.md) · [Trust Center](TRUST_CENTER.md)

> [!IMPORTANT]
> Read the "what FreeLayer does NOT protect against" section before anything else. An honest threat model states its limits first — compromised devices, malicious members, and global traffic analysis are outside what any app can fully solve.

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

## Storage-layer threats (TECH-05/06)

- **Storage bypass** — direct browser storage (`localStorage`-class, IndexedDB, CacheStorage, cookies), filesystem writes, or SQLite outside approved providers. Mitigation: write barrier + forbidden-storage CI guard; note that modern Node exposes web-storage globals even outside browsers, making the guard load-bearing everywhere.
- **Provider misuse** — missing/forged/wrong-scope decisions, policy-for-one-backend used on another, app-level direct provider use. Mitigation: barrier validation, backend-match checks, boundary rules ([audits/STORAGE_BOUNDARY_AUDIT.md](audits/STORAGE_BOUNDARY_AUDIT.md)).
- **Sensitive errors/logs** — stored values leaking through exceptions, console output, list metadata, key names, or CI artifacts. Mitigation: redacted error model, metadata-only listing, key validation, sentinel-based regression tests.
- **In-memory reference/mutation leaks** — callers mutating stored state through retained references. Mitigation: clone-at-boundaries; uncloneable values rejected. Honest limit: none of this protects memory from a compromised process or OS swap.
- **PWA storage limitations** — browser-controlled quotas/eviction and origin-shared storage make strict no-persistence claims weaker on web than desktop (research notes); the File System Access API and OPFS add real-disk channels the guardrail now covers.
- **Accidental persistence in strict modes** — a feature or future backend silently persisting under Ghost/Bunker. Mitigation: fail-closed backend detection, full-matrix zero-persistence tests, runtime persistence-API traps (TECH-07).
- **Mode-transition flush** — leaving Ghost/Bunker triggering a "flush memory to disk" path. Mitigation: providers structurally expose no flush surface; cross-mode policy/backend mismatch rejected; tested.
- **Test/CI artifact leakage** — secrets escaping via snapshots, coverage, build output, or CI artifacts during development. Mitigation: sentinel artifact scans over generated outputs; traps prevent test-time disk writes.

## Network-layer threats (TECH-08)

- **Direct network bypass** — `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource`/`RTCPeerConnection`/`sendBeacon`, service workers, Tauri HTTP, Node HTTP/net libraries. Mitigation: default-deny NetworkPolicy, forbidden-network CI guard, runtime egress trap, mock/noop transports only.
- **WebRTC / direct peer metadata** — a data-channel-only `RTCPeerConnection` triggers ICE/STUN and returns the user's real local+public IP to JavaScript, with no prompt, bypassing VPN. Mitigation: direct peer connections denied in Private/Ghost/Bunker (and Standard pending explicit policy); forbidden API.
- **Telemetry-shaped operations** — `sendBeacon` and analytics/crash SDKs. Mitigation: always denied by policy; guardrail catches the APIs; no telemetry dependency exists (ADR-0008).
- **External asset / link-preview leakage** — remote fonts/images/scripts and preview fetches expose IP/timing to third parties. Mitigation: denied in every mode; external-assets guard.
- **DNS/IP/timing leakage** — inherent to any networked transport. Honest limit: reduced by transport choice and (future) Tor/proxy, never eliminated.
- **Development/CI leakage** — tests or dependency scripts calling the internet. Mitigation: runtime trap fails any test touching network APIs; dependency policy; TECH-09 will verify the built app.

Honest scope: NetworkPolicy is an **application-behavior guarantee**, not network isolation — the OS, browser, extensions, package manager, and malware are outside its control.

## Zero-egress build threats (TECH-09)

- **Hidden egress** — a stray `fetch`/WebSocket/beacon or remote asset in app or build. Mitigation: static source scan, build-artifact host-allowlist scan, runtime egress trap, remote-asset scan.
- **Build-artifact endpoint strings** — a remote host baked into the bundle. Mitigation: build scanner fails on any host outside {github.com, www.w3.org, react.dev}; the real build is clean.
- **Dependency-bundled endpoints** — a network-client/analytics/AI SDK pulled in. Mitigation: `check-no-network-deps` fails on direct adoption; dependency-review covers the tree.
- **Runtime API bypass** — policy says deny but a call still fires. Mitigation: the runtime trap fails any test where an egress API is invoked.
- **Service-worker egress** — a worker fetching/caching remote resources. Mitigation: none is registered; `serviceWorker.register` is a forbidden token and trapped.
- **Dev/CI vs runtime confusion** — conflating registry/GitHub contact with app egress. Mitigation: documented distinction; GitHub Actions egress audit (GitHub-only).

Honest limit: TECH-09 verifies the built app and repository source — not the OS, browser, extensions, package manager, GitHub infrastructure, or future dependencies. Full in-browser render egress is deferred to Playwright E2E.

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

## Metadata threats (TECH-10)

The Metadata Firewall addresses application-signal leakage (receipts/typing/presence/room-activity), local metadata leakage (logs/audit/caches/spool existence/reveal state), notification metadata, link-preview/external-asset leakage, and audit/log leakage — all denied-by-default and, where allowed, memory-only and redacted. Endpoint/ScreenShield metadata (capture detection, reveal state, watermark/canary) is memory-only and must never carry raw identity/content.

**Out of scope, stated plainly:** global passive traffic analysis, transport-native metadata visible to a future courier, malicious room members, and network-level timing/size correlation (mitigated only in later phases). TECH-10 is app-level metadata policy, not protocol-level anonymity. Full analysis: [audits/TECH_10_METADATA_THREAT_MODEL.md](audits/TECH_10_METADATA_THREAT_MODEL.md).

## Link preview / external asset threats (TECH-11)

Automatic link previews and remote assets are privacy traps: one auto-fetch leaks the URL, IP, user-agent, referrer, DNS, and open-timing to a server the user never chose; connection hints leak DNS/TCP before content; a malicious URL can attack a parser; a server-side preview (which FreeLayer refuses to build) would add SSRF. **Mitigation:** no automatic previews and no remote assets in any mode; a pure URL classifier that never fetches; domain-only redacted display. **Limitation:** manual external navigation is user-controlled and outside the app boundary — opening a link in another browser leaks to that browser and the target site. Full analysis: [audits/TECH_11_LINK_ASSET_THREAT_MODEL.md](audits/TECH_11_LINK_ASSET_THREAT_MODEL.md).

## Policy drift threats (TECH-13)

With seven policy layers, the dangerous failure is **drift**: one engine allowing what another denies, docs claiming behavior code doesn't enforce, or undefined inputs falling through to allow. **Mitigation:** the canonical [Policy Matrix](POLICY_MATRIX.md) is the tested oracle — agreement tests bind every engine to it, validators bind docs/PBOM to it, and unmatched inputs fail closed. **Limits:** the matrix is a living contract, not formal verification; it does not prove future crypto/protocol correctness and adds no anonymity/forensic guarantees. Full analysis: [audits/TECH_13_POLICY_MATRIX_THREAT_MODEL.md](audits/TECH_13_POLICY_MATRIX_THREAT_MODEL.md).

**RoomOS object model (TECH-18):** object content (message/note/task/decision/poll bodies, filenames) is a leakage surface; object-level authorization, mass-assignment/prototype-pollution, oversized/malformed input, cross-room mutation, stale-revision overwrite, and treating object IDs/actor refs as authority are the primary risks; future-sync confusion (local revisions ≠ distributed versions) and endpoint-object misreading round it out. Mitigated by deny-by-default exact-scope authorization, explicit commands (no generic patch), fail-closed validation with proto-pollution/getter/limit defenses, separate mutation vs storage decisions, immutable deterministic projection, plain-text-only content, memory/null retention, and explicit non-claims. Full analysis: [audits/TECH_18_ROOM_OBJECT_THREAT_MODEL.md](audits/TECH_18_ROOM_OBJECT_THREAT_MODEL.md).

**RoomOS operation log (TECH-17):** event history is a privacy liability (existence/sequence/timing are metadata; history can outlive intent); replay corruption, sequence/order confusion, and schema-version drift are integrity risks; the local sequence must never be mistaken for global ordering, nor internal validators for hostile-input parsers, nor tombstones for forensic deletion. Mitigated by fail-closed versioned validation, validate-all-before-apply replay (no partial state), memory/null-only retention, separate exactly-scoped decisions, determinism guardrails, and explicit non-claims; future sync risks are Gate H design work. Full analysis: [audits/TECH_17_OPERATION_LOG_THREAT_MODEL.md](audits/TECH_17_OPERATION_LOG_THREAT_MODEL.md).

**RoomOS data model (TECH-16):** room titles/member aliases/content/activity are leakage surfaces; append-only logs and projections carry privacy risk if persisted; sync/identity deferral means no ordering, merge, or authenticity guarantees exist yet. Mitigated by redacted summaries/audit, memory-only logs/projections (persistence denied everywhere), tighten-only RoomPolicy, the room barrier, and the `check:no-roomos-bypass` guardrail; the endpoint-defense boundary stays hook-only. Full analysis: [audits/TECH_16_ROOMOS_THREAT_MODEL.md](audits/TECH_16_ROOMOS_THREAT_MODEL.md).

**Contributor workflow drift (TECH-15):** templates being bypassed, governance claims outliving reality (solo-dev limits, unclaimed badges), and confusion about the externalized anti-spyware boundary are workflow-level threats — mitigated by the PR/issue templates, `check:contributor-workflow`, and honest governance docs; not eliminated (templates cannot stop a determined bad PR; human review remains the backstop). Full analysis: [audits/TECH_15_DX_WORKFLOW_THREAT_MODEL.md](audits/TECH_15_DX_WORKFLOW_THREAT_MODEL.md).

**Conflict regression + externalization confusion (TECH-14):** cross-layer contradictions, docs/code mismatches, and the new confusion risk — treating the **externalized** anti-spyware project as if it were active core protection — are regression-tested and validator-enforced (`check:policy-conflicts`). Conflict tests are not a formal proof. Full analysis: [audits/TECH_14_POLICY_CONFLICT_THREAT_MODEL.md](audits/TECH_14_POLICY_CONFLICT_THREAT_MODEL.md).

## Notification threats (TECH-12)

Notifications leak content (message preview / room name / sender alias / title / AI summary) on lock screens and in notification centers; metadata (badge count, sound/vibration, timing, channel name) enabling room-activity inference; and — with push/service workers — subscription/endpoint/provider metadata and background wakeups. **Mitigation:** all content and OS surfaces denied; only a generic content-free in-app indicator allowed; badge/sound/vibration and push/service worker denied in every mode; content never persists; audit redacted. **Limitation:** once a notification is delivered FreeLayer cannot control the OS notification center, screenshots, or user OS settings; push infrastructure is deferred. Full analysis: [audits/TECH_12_NOTIFICATION_THREAT_MODEL.md](audits/TECH_12_NOTIFICATION_THREAT_MODEL.md).

## TODO

- [ ] Per-transport threat annexes as each transport is designed
- [ ] STRIDE (or similar) pass over the capsule lifecycle
- [ ] Define security invariants testable in `tests/security-regression/`
- [ ] Revisit this document at the end of every roadmap phase
