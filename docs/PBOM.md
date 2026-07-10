# PBOM — Privacy Bill of Materials

[← Docs Index](README.md) · [Trust Center](TRUST_CENTER.md) · [Data Leakage Map](DATA_LEAKAGE_MODEL.md)

> [!NOTE]
> Like an SBOM, but for privacy-relevant behavior: everything the software actually does with your data, in one auditable inventory. **Anything not listed here is a bug.**

## Purpose

A single, auditable inventory of everything FreeLayer software does that touches privacy: network endpoints, storage, permissions, telemetry (none), dependencies, AI behavior, caches, and logs. Like an SBOM, but for privacy-relevant behavior. From the first alpha, the PBOM is a release artifact; divergence between PBOM and actual behavior is treated as a bug of the highest severity.

**Rule: any behavior not listed in the PBOM is considered undocumented and therefore a bug** — regardless of whether the behavior itself is benign. The inventory being complete *is* the guarantee.

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

| Endpoint | Purpose | Status |
| --- | --- | --- |
| — | FreeLayer-owned backend | **Does not exist and never will** (hard constraint) |
| User-chosen relays | Capsule store-and-forward | Not implemented yet (Phase 4) |
| User-initiated transports (email, LAN, etc.) | Blind courier channels | Not implemented yet |

### Runtime network behavior — default build (TECH-09)

The built app makes **zero automatic network egress on load**, verified by static source + build-artifact + runtime-trap + dependency scans:

| Behavior | Default build status |
| --- | --- |
| FreeLayer-owned backend | Does not exist |
| Runtime network calls | **Forbidden / tested** (runtime trap) |
| Telemetry | **Forbidden / tested** |
| Analytics | **Forbidden / tested** (dependency + build scan) |
| Crash reporting | Not implemented |
| Remote fonts / images / scripts | **Forbidden / tested** (remote-asset + build scan) |
| Link previews | Not implemented / forbidden |
| Remote AI | Not implemented / forbidden |
| Update checks | Not implemented |
| WebSocket / WebRTC | **Forbidden / tested** |
| Service worker network | **Not implemented** (none registered — [audit](audits/PWA_SERVICE_WORKER_NETWORK_AUDIT.md)) |
| Relay transport | Not implemented |

**Benign strings in the build (not egress):** `github.com` (navigation anchors), `www.w3.org` (React XML/SVG namespaces), `react.dev` (React error-message links) — documented allowlist, never fetched.

> **Development tooling may contact package registries and GitHub.** That is *not* app runtime behavior: `pnpm install` uses the npm registry; GitHub Actions/CodeQL/Dependabot are GitHub-side. See the [GitHub Actions egress audit](audits/GITHUB_ACTIONS_EGRESS_AUDIT.md). No third-party upload, telemetry, or deploy occurs in CI.

### Network behavior — current implementation (TECH-08)

| Behavior | Status |
| --- | --- |
| FreeLayer-owned backend | **Does not exist** (ADR-0001) |
| Real network transports | **Not implemented** |
| Relay client | Not implemented |
| HTTP / fetch | **Forbidden** outside a future approved provider (CI guard) |
| WebSocket | **Forbidden** (CI guard) |
| WebRTC / direct peer | **Forbidden** (CI guard + policy; IP exposure) |
| Telemetry / `sendBeacon` | **Forbidden** (always) |
| External assets | **Forbidden** (always) |
| Automatic link previews | **Forbidden** (always) |
| Remote AI API | **Forbidden** (default build) |
| Update checks | **Not implemented** (manual/future only) |
| Mock / Noop transport | Implemented — `performsRealNetwork: false` |
| NetworkPolicy v0 + barrier | Implemented + regression-tested |

Any network behavior not listed here is undocumented and must be treated as a privacy bug.

The default build must make **zero** network calls not explicitly initiated by the user. Update checks: none by default; a manual "check for updates" action is the likely future design *(TODO decide, Phase 9)*.

Future entries required at Gate D: **relay usage** (per-relay leakage profile) and **external-app courier flows** (including the mandatory UX leakage warnings — [METADATA_MODEL.md](METADATA_MODEL.md) invariants 9–10).

## 2. External services

None. No analytics providers, no push-notification services, no CDN assets, no font services, no error trackers. *(Standing entry — any change requires GOVERNANCE-level review.)*

## 3. Telemetry

**None. No default telemetry, no opt-out telemetry, no "anonymous statistics."** This row exists so its change history is auditable.

## 4. Storage locations

**Current implementation (TECH-05): nothing persists.** The storage layer is policy-enforced with exactly two working backends — process-memory and null — and a throwing placeholder for future encrypted persistence.

### Storage behavior — current implementation

| Data / behavior | Current status |
| --- | --- |
| Persistent content storage | **Not implemented** |
| Memory storage | Implemented/**hardened** (per-instance, policy-gated, clone-at-boundaries, key-validated, metadata-only listing) |
| Null storage | Implemented/**hardened** (validates decision/scope/policy/key, stores nothing, zero value state) |
| Encrypted persistent storage | Placeholder only — every use throws |
| Storage logs | No sensitive values — barrier rejects content-grade payloads; sentinel-tested |
| Storage errors | Redacted — generic stable messages, never values/keys; sentinel-tested |
| localStorage | **Forbidden** (CI guard) |
| IndexedDB | **Forbidden** (CI guard) |
| Filesystem writes | **Forbidden** outside a future reviewed provider (CI guard incl. `fs.writeFile*`, Deno/Bun/Tauri) |
| Browser cache / service-worker cache | **Forbidden** (CI guard) |
| AI cache | Not implemented; policy hooks exist (denied in all modes v0) |
| Preview/thumbnail cache | Not implemented; policy hooks exist (denied in Private+/sealed) |
| ScreenShield reveal state | Not implemented; policy hooks exist (denied to persist; denied entirely at high risk) |

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

## Maintenance rules

- Every PR that changes network behavior, storage, permissions, dependencies, caches, logs, or AI behavior **must** update this file (PR checklist item).
- Phase 10 adds automated PBOM diffing: CI compares declared endpoints/permissions against detected ones.

## TODO

- [ ] Per-platform storage/permission tables (Phase 2, 7, 9)
- [ ] Crypto dependency table (Phase 4)
- [ ] PBOM auto-diff tooling (Phase 10)
- [ ] Publish PBOM as a signed release artifact (Phase 11)
