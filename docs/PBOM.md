# PBOM — Privacy Bill of Materials

[← Docs Index](README.md) · [Trust Center](TRUST_CENTER.md) · [Data Leakage Map](DATA_LEAKAGE_MODEL.md)

> [!NOTE]
> Like an SBOM, but for privacy-relevant behavior: everything the software actually does with your data, in one auditable inventory. **Anything not listed here is a bug.**

## Purpose

A single, auditable inventory of everything FreeLayer software does that touches privacy: network endpoints, storage, permissions, telemetry (none), dependencies, AI behavior, caches, and logs. Like an SBOM, but for privacy-relevant behavior. From the first alpha, the PBOM is a release artifact; divergence between PBOM and actual behavior is treated as a bug of the highest severity.

**Rule: any behavior not listed in the PBOM is considered undocumented and therefore a bug** — regardless of whether the behavior itself is benign. The inventory being complete _is_ the guarantee.

## Current status

**Foundation stage — Prompt 03 scaffolding exists; almost all product behavior is "not implemented yet."** The value of starting now: every future feature must update this file in the same PR (enforced via PR checklist), so the inventory can never silently rot.

Actual behavior of the current codebase (verified by tests and static guards):

- The default web app shell makes **no intentional network calls** — it is a static, local-only status page; nothing is fetched at runtime.
- **No telemetry dependencies** (CI guard: `check:no-telemetry`).
- **No external assets** — no remote fonts, scripts, styles, or images; system font stack only (CI guard: `check:no-external-assets`).
- **No AI runtime** — `@freelayer/ai` contains interfaces and a provider that always rejects.
- **No crypto dependencies** — `@freelayer/crypto` contains interfaces and a provider that always throws.
- **No real storage backend** — only memory-only and null test providers, both requiring a `PolicyDecision`; no browser storage APIs anywhere (CI guard: `check:no-forbidden-storage`).
- **No relay implementation**, no update checks, no analytics, no remote avatars, no link previews.

## 1. Network endpoints

| Endpoint                                     | Purpose                   | Status                                              |
| -------------------------------------------- | ------------------------- | --------------------------------------------------- |
| —                                            | FreeLayer-owned backend   | **Does not exist and never will** (hard constraint) |
| User-chosen relays                           | Capsule store-and-forward | Not implemented yet (Phase 4)                       |
| User-initiated transports (email, LAN, etc.) | Blind courier channels    | Not implemented yet                                 |

### Runtime network behavior — default build (TECH-09)

The built app makes **zero automatic network egress on load**, verified by static source + build-artifact + runtime-trap + dependency scans:

| Behavior                        | Default build status                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| FreeLayer-owned backend         | Does not exist                                                                              |
| Runtime network calls           | **Forbidden / tested** (runtime trap)                                                       |
| Telemetry                       | **Forbidden / tested**                                                                      |
| Analytics                       | **Forbidden / tested** (dependency + build scan)                                            |
| Crash reporting                 | Not implemented                                                                             |
| Remote fonts / images / scripts | **Forbidden / tested** (remote-asset + build scan)                                          |
| Link previews                   | Not implemented / forbidden                                                                 |
| Remote AI                       | Not implemented / forbidden                                                                 |
| Update checks                   | Not implemented                                                                             |
| WebSocket / WebRTC              | **Forbidden / tested**                                                                      |
| Service worker network          | **Not implemented** (none registered — [audit](audits/PWA_SERVICE_WORKER_NETWORK_AUDIT.md)) |
| Relay transport                 | Not implemented                                                                             |

**Benign strings in the build (not egress):** `github.com` (navigation anchors), `www.w3.org` (React XML/SVG namespaces), `react.dev` (React error-message links) — documented allowlist, never fetched.

> **Development tooling may contact package registries and GitHub.** That is _not_ app runtime behavior: `pnpm install` uses the npm registry; GitHub Actions/CodeQL/Dependabot are GitHub-side. See the [GitHub Actions egress audit](audits/GITHUB_ACTIONS_EGRESS_AUDIT.md). No third-party upload, telemetry, or deploy occurs in CI.

### Network behavior — current implementation (TECH-08)

| Behavior                   | Status                                                      |
| -------------------------- | ----------------------------------------------------------- |
| FreeLayer-owned backend    | **Does not exist** (ADR-0001)                               |
| Real network transports    | **Not implemented**                                         |
| Relay client               | Not implemented                                             |
| HTTP / fetch               | **Forbidden** outside a future approved provider (CI guard) |
| WebSocket                  | **Forbidden** (CI guard)                                    |
| WebRTC / direct peer       | **Forbidden** (CI guard + policy; IP exposure)              |
| Telemetry / `sendBeacon`   | **Forbidden** (always)                                      |
| External assets            | **Forbidden** (always)                                      |
| Automatic link previews    | **Forbidden** (always)                                      |
| Remote AI API              | **Forbidden** (default build)                               |
| Update checks              | **Not implemented** (manual/future only)                    |
| Mock / Noop transport      | Implemented — `performsRealNetwork: false`                  |
| NetworkPolicy v0 + barrier | Implemented + regression-tested                             |

Any network behavior not listed here is undocumented and must be treated as a privacy bug.

The default build must make **zero** network calls not explicitly initiated by the user. Update checks: none by default; a manual "check for updates" action is the likely future design _(TODO decide, Phase 9)_.

Future entries required at Gate D: **relay usage** (per-relay leakage profile) and **external-app courier flows** (including the mandatory UX leakage warnings — [METADATA_MODEL.md](METADATA_MODEL.md) invariants 9–10).

## 2. External services

None. No analytics providers, no push-notification services, no CDN assets, no font services, no error trackers. _(Standing entry — any change requires GOVERNANCE-level review.)_

## 3. Telemetry

**None. No default telemetry, no opt-out telemetry, no "anonymous statistics."** This row exists so its change history is auditable.

## 4. Storage locations

**Current implementation (TECH-05): nothing persists.** The storage layer is policy-enforced with exactly two working backends — process-memory and null — and a throwing placeholder for future encrypted persistence.

### Storage behavior — current implementation

| Data / behavior                      | Current status                                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Persistent content storage           | **Not implemented**                                                                                              |
| Memory storage                       | Implemented/**hardened** (per-instance, policy-gated, clone-at-boundaries, key-validated, metadata-only listing) |
| Null storage                         | Implemented/**hardened** (validates decision/scope/policy/key, stores nothing, zero value state)                 |
| Encrypted persistent storage         | Placeholder only — every use throws                                                                              |
| Storage logs                         | No sensitive values — barrier rejects content-grade payloads; sentinel-tested                                    |
| Storage errors                       | Redacted — generic stable messages, never values/keys; sentinel-tested                                           |
| localStorage                         | **Forbidden** (CI guard)                                                                                         |
| IndexedDB                            | **Forbidden** (CI guard)                                                                                         |
| Filesystem writes                    | **Forbidden** outside a future reviewed provider (CI guard incl. `fs.writeFile*`, Deno/Bun/Tauri)                |
| Browser cache / service-worker cache | **Forbidden** (CI guard)                                                                                         |
| AI cache                             | Not implemented; policy hooks exist (denied in all modes v0)                                                     |
| Preview/thumbnail cache              | Not implemented; policy hooks exist (denied in Private+/sealed)                                                  |
| ScreenShield reveal state            | Not implemented; policy hooks exist (denied to persist; denied entirely at high risk)                            |

### Zero-persistence modes (TECH-07)

Ghost/Bunker (and Emergency for normal writes) app-level behavior, **machine-checked**: no persistent provider selectable for any of the 30 data classes; caches denied or null; no AI cache; no preview/thumbnail cache; no storage telemetry (none exists anywhere); no default logs with content (barrier-rejected); protected reveal-state and endpoint artifacts non-persistent. Verification: full-matrix policy tests, runtime persistence-API traps (web storage/browser DB/caches/Node fs, with honest absent-API coverage reporting), and sentinel scans over generated artifacts (coverage/build/snapshots — directories absent are reported "not applicable", never assumed). **Known limitations:** application-level only — OS swap, crash dumps, browser internals, backups, and compromised processes are out of scope, stated in [STORAGE_MODEL.md](STORAGE_MODEL.md).

Future per-platform enumeration (identity store, room stores, spool, wipe paths) arrives with real persistence (Phase 7). The future Vault Inspector renders this section live, in-app. Any storage behavior not listed in the PBOM is considered undocumented and therefore a bug.

## 5. Permissions

Not implemented yet. Will enumerate per platform: camera (QR scan — requested at use, never at install), filesystem scopes (capsule/bundle import-export), notifications (optional), LAN/network. Desktop (Tauri) capabilities will be locked down in Phase 9 and listed here.

## 6. Cryptographic dependencies

None yet (no crypto implemented — see [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md)). Will list: libraries with versions, primitives used, review status per component.

## 7. AI model behavior

No AI code ships today (Phase 8+). When it does: local-only inference; zero AI network calls in default build; models listed here with source, hash, and license; **embedding indexes and other AI-derived artifacts enumerated with their storage class and wipe path**; prompts/outputs governed by storage policy; disabled by default. See [LOCAL_AI.md](LOCAL_AI.md).

## 8. Cache behavior

Not implemented yet. Every cache (media thumbnails, previews, AI embeddings/indexes) will be enumerated with: policy inheritance, location, wipe trigger. Rule: no cache may outlive the strictest policy of its source data.

## 9. Logs

Current code: none. Standing rules: no plaintext logging of message content, keys, identities, prompts, or contact data (hard constraint); log verbosity respects active Privacy Mode; no crash reporting by default. Will document log locations and retention per platform.

## 10. Build and supply-chain dependencies

Current (Prompt 03):

- **Root dev tooling:** `turbo`, `typescript`, `prettier`, `vitest` (dev-only; nothing ships to users).
- **`apps/web` runtime:** `react`, `react-dom` — bundled locally into the app; no runtime fetches.
- **`apps/web` dev tooling:** `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom` (build-time only).
- **`packages/ui`:** `react` as a peer dependency.
- **Workspace packages** depend only on each other (`@freelayer/*`); no third-party runtime dependencies in any `packages/*`.
- GitHub Actions listed in [.github/workflows/](../.github/workflows/); Dependabot + dependency-review active.

Rules: [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md). Future: SBOM per release (Phase 10), install-script detection in CI, dependency budget per package.

## 11. Known privacy risks (current honest list)

1. Design-stage risk: documented models may contain errors — nothing is externally reviewed yet.
2. Transport metadata exposure is inherent when using third-party channels as couriers ([METADATA_MODEL.md](METADATA_MODEL.md)).
3. Platform-layer leakage (OS swap, backups, PWA eviction) limits no-persistence guarantees ([STORAGE_MODEL.md](STORAGE_MODEL.md)).
4. GitHub itself: FreeLayer is developed and published on GitHub (<https://github.com/XGiammyX/freelayer>) with GitHub Actions as CI. This is a **development-platform** choice, not a runtime dependency — the shipped software contacts no GitHub endpoint. Developing in public exposes contributor metadata (account names, commit timestamps, review activity) to GitHub and the public; contributors should participate with an identity they are comfortable exposing. No GitHub repository secrets exist, and none were created by the publication pass.

## 12. Endpoint defense behavior (ADR-0012)

**Not implemented — design planned. No telemetry, no upload, ever.** Once implemented, each item below gets a real entry here; **endpoint defense behavior absent from the PBOM is a bug** (same completeness rule as everything else):

- Screen capture protections (per platform: what is enforced vs. detected vs. unavailable)
- Platform capability checks (what is probed, what is reported to the user)
- Clipboard access (Clipboard Firewall behavior, expiry semantics)
- Keyboard/input controls (secure-input flags on sensitive fields)
- Task switcher redaction behavior
- Accessibility exposure policy (what assistive technology receives, under which policy)
- Local audit events (what is recorded locally, always redacted, never uploaded)
- Watermark/canary behavior (off by default; exact marking when enabled)
- Device risk signals (full list of local-only signals evaluated)

## 13. Side-effect category coverage

Not implemented yet. Once the core operation pipeline exists (Gate B), every side-effect category it recognizes (persist, notify, connect, transmit, fetch, preview, derive, sync, run AI) will map to the PBOM sections that inventory it — so "the pipeline allows X" and "the PBOM documents X" can be diffed mechanically (Phase 10 auto-diff). Tauri capabilities (Phase 9 lockdown) are inventoried under section 5 as part of this coverage.

## 14. Metadata behavior — current implementation (TECH-10)

| Metadata behavior            | Default status                           |
| ---------------------------- | ---------------------------------------- |
| Read receipts                | Not implemented / denied in Private+     |
| Typing indicators            | Not implemented / denied in Private+     |
| Presence/online status       | Not implemented / denied in Private+     |
| Last seen                    | Not implemented / denied                 |
| Link previews                | Not implemented / denied                 |
| External assets              | Forbidden                                |
| Notification content         | Not implemented / denied in strict modes |
| Audit events                 | Redacted only                            |
| Telemetry metadata           | Forbidden                                |
| AI metadata                  | Not implemented / denied in Ghost/Bunker |
| ScreenShield reveal metadata | Policy hooks only                        |

Any metadata-producing behavior not listed here is undocumented and must be treated as a privacy bug. Governed by MetadataPolicy v0 ([METADATA_MODEL.md](METADATA_MODEL.md)); in v0 no metadata persists and none egresses.

## 15. Link previews and external assets (TECH-11)

| Behavior                       | Status                   |
| ------------------------------ | ------------------------ |
| Automatic link previews        | Forbidden                |
| OpenGraph fetch                | Forbidden                |
| Favicon fetch                  | Forbidden                |
| Remote images                  | Forbidden                |
| Remote avatars                 | Forbidden                |
| Remote fonts                   | Forbidden                |
| Remote scripts                 | Forbidden                |
| Remote CSS                     | Forbidden                |
| Tracking pixels                | Forbidden                |
| Preconnect/dns-prefetch remote | Forbidden                |
| Preview cache                  | Not implemented / denied |
| User-initiated preview         | Future research gate     |

Governed by `LinkPreviewPolicy` / `ExternalAssetPolicy` ([METADATA_MODEL.md](METADATA_MODEL.md)) and machine-checked by `check:no-external-assets` + `check:build-zero-egress`.

## 16. Notifications (TECH-12)

| Behavior                        | Status                                   |
| ------------------------------- | ---------------------------------------- |
| Browser Notification API        | Not used / denied by policy              |
| Notification permission request | Not performed by default                 |
| System notification display     | Not implemented                          |
| Message previews                | Forbidden                                |
| Room/sender names               | Denied in Private+                       |
| Badge count                     | Not implemented / denied in strict modes |
| Sound/vibration                 | Not implemented / denied in strict modes |
| Push notifications              | Not implemented / denied                 |
| Service worker notifications    | Not implemented / denied                 |
| Tauri notification plugin       | Not present / permission-audited         |
| Notification audit events       | Redacted only                            |

Any notification-producing behavior not listed here is undocumented and must be treated as a privacy bug. Governed by `NotificationPolicy` ([PRIVACY_MODEL.md](PRIVACY_MODEL.md)); machine-checked by `check:no-notification-bypass` + the runtime notification trap. Audits: [audits/TAURI_NOTIFICATION_PERMISSION_AUDIT.md](audits/TAURI_NOTIFICATION_PERMISSION_AUDIT.md), [audits/NOTIFICATION_SERVICE_WORKER_PUSH_AUDIT.md](audits/NOTIFICATION_SERVICE_WORKER_PUSH_AUDIT.md).

## 17. Policy Matrix v1 (TECH-13)

The PBOM must agree with the canonical [Policy Matrix](POLICY_MATRIX.md) — sections 14–16 above map 1:1 onto matrix domains (metadata, link/asset, notification), and the matrix's 94 specs are the machine-checked source of truth (`check:policy-matrix`, `check:policy-docs`). **Any new network / storage / metadata / notification / link / asset / AI behavior requires a matrix update in the same PR. Undocumented behavior is a privacy bug.**

## 18. Endpoint Defense / Anti-spyware status (TECH-14)

The anti-spyware / Endpoint Defense / ScreenShield **implementation is externalized** to a separate standalone project. In FreeLayer core: **no native endpoint monitoring dependency** (screenshot/clipboard/overlay/keystroke/process monitoring — machine-checked by `check:policy-conflicts`), **no native permissions**, **policy hooks only** (ScreenShield levels, endpoint data classes/metadata events, `future_gate` matrix rows). Future integration requires the dedicated gate ([IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md) Gate R) and a PBOM update enumerating every capability. Audit: [audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md](audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md).

## 19. Policy conflict checks (TECH-14)

The PBOM must agree with the Policy Matrix and the conflict checks: `check:policy-conflicts` fails CI if a dependency contradicts a "not implemented" claim here (push SDKs, endpoint monitoring, remote-AI clients), if the Trust Center overclaims, or if the exported matrix marks an always-forbidden behavior as allowed. Conflict status: [audits/POLICY_CONFLICT_REPORT.md](audits/POLICY_CONFLICT_REPORT.md).

## 20. Contributor workflow checks (TECH-15)

The governance surface itself is machine-checked: `check:contributor-workflow` (CI) verifies the workflow docs, PR/issue templates, ADR template, CODEOWNERS, and the anti-spyware externalization statements all exist and stay consistent. **No anti-spyware dependencies may enter core**; any future integration goes through Gate R and requires updating this PBOM first ([CONTRIBUTOR_WORKFLOW.md](CONTRIBUTOR_WORKFLOW.md) §5).

## 21. RoomOS / Sovereign Rooms (TECH-16)

| Behavior                        | Status                                                   |
| ------------------------------- | -------------------------------------------------------- |
| Local room data model           | Implemented foundation                                   |
| Room operation log              | Placeholder / policy-controlled (memory-only)            |
| Room projection                 | Implemented foundation / policy-controlled (memory-only) |
| Real messaging                  | Not implemented                                          |
| Real sync                       | Future Gate H                                            |
| CRDT engine                     | Not selected                                             |
| Crypto room keys                | Future Gate F                                            |
| Identity/invites                | Future Gate G                                            |
| Capsule import/export           | Future Gate E                                            |
| Endpoint Defense / Anti-spyware | Externalized / hooks only                                |
| Room notifications              | Not implemented / denied by policy                       |
| Room AI                         | Not implemented / denied in strict modes                 |

Governed by `RoomPolicy` + the matrix `room` domain ([SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md)); machine-checked by `check:no-roomos-bypass` + the room regression suites. Rooms are NOT safe for real secrets.

## 22. RoomOS local event behavior (TECH-17)

| Behavior                        | Status                    |
| ------------------------------- | ------------------------- |
| Internal RoomOS event schema    | v1 foundation             |
| Local operation log             | Memory/null only          |
| Persistent room event log       | Not implemented           |
| Deterministic projection replay | Implemented foundation    |
| Event signatures                | Not implemented — Gate F  |
| Event encryption                | Not implemented — Gate F  |
| Distributed ordering            | Not implemented — Gate H  |
| CRDT engine                     | Not selected — Gate H     |
| External event parser           | Not implemented — Gate E  |
| Snapshots/checkpoints           | Not implemented           |
| Compaction                      | Not implemented           |
| Tombstone forensic deletion     | Not claimed               |
| Endpoint Defense                | Externalized / hooks only |

## 27. RoomOS device posture + room governance (TECH-22)

| Behavior                    | Status                           |
| --------------------------- | -------------------------------- |
| Room policy composition     | Local v1 foundation              |
| Strictest-policy-wins       | Implemented/tested foundation    |
| Room policy tightening      | Local foundation                 |
| Room policy loosening       | Forbidden                        |
| Minimum device posture      | Policy contract only             |
| Device posture verification | Not implemented                  |
| Effective current posture   | Unverified or at-risk tightening |
| Secure Device provider      | Not integrated                   |
| Sensitive-room admission    | Local policy decision foundation |
| ScreenShield enforcement    | Not integrated                   |
| ProtectedContent runtime    | Not implemented                  |
| Device posture history      | Forbidden                        |
| Device telemetry            | Forbidden                        |
| MDM / Device Owner          | Not implemented                  |
| GrapheneOS manager          | Not implemented                  |
| Anti-spyware scanner        | External Secure Device project   |
| Custom ROM                  | Not planned in core              |

## 26. RoomOS local revocation + authorization behavior (TECH-21)

| Behavior                                   | Status                      |
| ------------------------------------------ | --------------------------- |
| Local membership suspension                | Implemented foundation      |
| Local membership removal                   | Tombstone foundation        |
| Role-change invalidation                   | Local revision-bound        |
| Reactivation invalidation                  | Local revision-bound        |
| Execution-time authorization check         | Implemented foundation      |
| Prepared authorization                     | Non-authoritative/transient |
| Authorization cache                        | Forbidden                   |
| Capability persistence                     | Forbidden                   |
| Prepared-context persistence/serialization | Forbidden                   |
| Distributed revocation                     | Not implemented — Gate H    |
| Signed revocation                          | Not implemented — Gates F/G |
| Single-use / nonce-bound decisions         | Not implemented — Gate B    |
| Global authorization consistency           | Not implemented             |
| Endpoint assurance                         | Externalized / unavailable  |

## 25. RoomOS membership + capability behavior (TECH-20)

| Behavior                               | Status                        |
| -------------------------------------- | ----------------------------- |
| Local membership records               | In-memory foundation          |
| Membership verification                | Not implemented — Gate G      |
| Local placeholder roles                | Implemented foundation        |
| Capability descriptors                 | Non-authoritative scaffolding |
| Capability tokens                      | Not implemented               |
| Capability persistence                 | Forbidden                     |
| Capability serialization               | Forbidden                     |
| Capability delegation                  | Not implemented               |
| Local role revocation                  | Current local projection only |
| Distributed revocation                 | Not implemented — Gate H      |
| Invites                                | Not implemented — Gate G/E    |
| Presence / last seen                   | Forbidden                     |
| Persistent membership graph            | Forbidden                     |
| Membership network / notification / AI | None                          |
| Endpoint assurance                     | Externalized / not integrated |

## 24. RoomOS local query behavior (TECH-19)

| Behavior                               | Status                                  |
| -------------------------------------- | --------------------------------------- |
| Local room summary query               | In-memory foundation                    |
| Local object list query                | In-memory foundation                    |
| Local object detail query              | Policy-gated                            |
| Exact plain-text search                | Direct memory scan only                 |
| Search index                           | Not implemented                         |
| Query history                          | Forbidden                               |
| Result cache                           | Forbidden                               |
| Search snippets                        | Not implemented                         |
| Total counts                           | Separately policy-gated                 |
| Cursors                                | Local, content-free, non-authority      |
| Remote query API                       | Not implemented — Gate H                |
| Semantic search                        | Future AI gate (Gate I)                 |
| Bunker content view                    | Denied pending future presentation gate |
| Query-side network / notification / AI | None                                    |
| Endpoint Defense                       | Externalized / not integrated           |

## 23. RoomOS object model (TECH-18)

| Behavior                                 | Status                      |
| ---------------------------------------- | --------------------------- |
| Concrete objects (message/note/task/…)   | Local data objects (v1)     |
| Content storage                          | Memory only                 |
| Persistent plaintext content             | Denied — Gate F             |
| Object mutation log                      | Memory/null only            |
| Explicit command mutations               | Implemented                 |
| Generic/JSON patch                       | Not available (forbidden)   |
| Local revision (optimistic concurrency)  | Implemented                 |
| Distributed versioning / merge           | Not implemented — Gate H    |
| Messaging transport / send / receive     | Not implemented             |
| Read receipts / typing / presence        | Not implemented             |
| Rich text / HTML / Markdown rendering    | Not implemented (forbidden) |
| Link preview / thumbnail                 | Forbidden                   |
| File bytes / path / URL                  | Never stored                |
| File resolve / fetch / upload / download | Not implemented — Gate E    |
| Poll voting / tallies / voter identity   | Not implemented — Gate G/H  |
| Object content encryption / signatures   | Not implemented — Gate F    |
| Verified identity / authoritative voting | Not implemented — Gate G    |
| External object parser                   | Not implemented — Gate E    |
| Tombstone forensic deletion              | Not claimed                 |
| AI memory objects                        | Placeholder — Gate I        |
| Endpoint hook objects                    | Externalized — Gate R       |

## Maintenance rules

- Every PR that changes network behavior, storage, permissions, dependencies, caches, logs, or AI behavior **must** update this file (PR checklist item).
- Phase 10 adds automated PBOM diffing: CI compares declared endpoints/permissions against detected ones.

## TODO

- [ ] Per-platform storage/permission tables (Phase 2, 7, 9)
- [ ] Crypto dependency table (Phase 4)
- [ ] PBOM auto-diff tooling (Phase 10)
- [ ] Publish PBOM as a signed release artifact (Phase 11)

## TECH-23 — Secure Device admission contract (Relying Party only)

FreeLayer core is the future **RATS Relying Party** for device posture (RFC 9334). It is **not** a Secure Device provider. Secure Device / Endpoint Defense (posture measurement, ScreenShield, Bunker Session Mode, anti-spyware) is a **separate, externalized** project. This PBOM row set records exactly what core does and does not do.

| Secure Device element                                                    | State in FreeLayer core                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Provider port + roles + admission contract                               | **contract implemented** (`packages/rooms/src/secure-device/`)             |
| Trusted Secure Device provider                                           | **not implemented** — only the deterministic **Null provider** ships       |
| Real posture verification (basic/hardened/high_assurance/managed_bunker) | **verification unavailable** — posture is `unverified` (or `at_risk`) only |
| Device posture assessment                                                | **transient** (memory-only, current-process, never persisted)              |
| Raw attestation evidence / measurement logs                              | **forbidden / not received** (rejected on sight)                           |
| Device identifiers / serials / OS build fingerprint                      | **forbidden / not collected**                                              |
| Installed-app / package inventory                                        | **forbidden / not collected**                                              |
| Assessment history                                                       | **forbidden** (no persistent history / tracking record)                    |
| Telemetry                                                                | **forbidden**                                                              |
| ScreenShield / ProtectedContent native surface                           | **external** (Secure Device project); requirement denies content in core   |
| Managed Bunker Session Mode                                              | **external** (Secure Device project); requirement denies content in core   |
| Anti-spyware / MDM / GrapheneOS management / Play Integrity              | **external / not implemented** in core                                     |

No provider network calls, no persistence, and no active-protection claim exist in core. The single provenance mechanism (`isAcceptedDevicePostureAssessmentV1`) is a same-realm registry, **not** cryptographic (Gate F). This complements the **Policy Matrix** rows for the `room.secure_device.*` / `room.device_posture.*` operations and the anti-spyware **externalized** statements elsewhere in this PBOM. Not safe for real secrets.

## RESEARCH-ID-01 — Identity status (research only)

Identity is **not implemented** in FreeLayer. RESEARCH-ID-01 is a research/architecture-preparation phase only; no identity, cryptography, recovery, invite, device-key, device-passport, DID/VC, login, or directory code was added, and **no runtime dependency** was introduced.

| Identity element | State in FreeLayer core |
| --- | --- |
| Verified identity / identity proofing | **not implemented** (self-asserted only; Gate G) |
| Identity keys / cryptographic aliases / unlinkable personas | **not implemented** (Gate F/G) |
| Device keys / device passport | **not implemented** (future design) |
| Key transparency | **not implemented / research** |
| QR verification | **not implemented** (contract design only) |
| Recovery (any form) | **not implemented** — and no administrator or project-owned master key will ever exist |
| Public directory / username lookup | **not implemented** (none planned by default) |
| Phone / email / central account | **not required, not present** |
| Local unverified membership (`RoomMemberRef`) | present — a placeholder, authorizes nothing, **not identity** |
| DevicePosture as identity | **never** — external environment attribute (Secure Device project) |

Next: **TECH-ID-02 — Identity Architecture ADR**. This complements the anti-spyware **externalized** statements and the **Policy Matrix** claims elsewhere in this PBOM.
