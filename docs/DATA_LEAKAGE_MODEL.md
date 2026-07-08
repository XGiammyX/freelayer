# Data Leakage Model

## Purpose

One map of every channel through which FreeLayer data can leak, connecting the per-domain models: [METADATA_MODEL.md](METADATA_MODEL.md) (wire), [STORAGE_MODEL.md](STORAGE_MODEL.md) (disk), [LOCAL_AI.md](LOCAL_AI.md) (AI), [ENDPOINT_DEFENSE_MODEL.md](ENDPOINT_DEFENSE_MODEL.md) (endpoint), and [PBOM.md](PBOM.md) (inventory). If a leakage channel is not in this table, that is a documentation bug.

## Current status

Design-stage inventory; mitigations marked *(planned)* are gated behind the referenced designs.

## Leakage channels

| Channel | Example | FreeLayer mitigation | Limit |
| --- | --- | --- | --- |
| Transport metadata | Relay sees timing/size/IP | Blind couriers, padding buckets *(planned)*, leakage labels, Tor/proxy future ([METADATA_MODEL.md](METADATA_MODEL.md)) | Correlation by strong observers remains possible |
| Local storage | Room data on disk | Write barrier, encrypted/memory/null backends, crypto-shredding *(planned)* (ADR-0005) | OS swap, backups, forensic access to unlocked device |
| Memory | Decrypted content in RAM | Minimal lifetime, no-persistence modes; key zeroization *(planned, crypto)* | OS may swap; kernel-level access reads anything |
| Screen | Content visibly rendered | ProtectedContent, redaction-first, hold-to-view *(planned)* | Eyes, cameras, compromised OS |
| Screenshot | User/app captures frame | FLAG_SECURE / display-affinity where supported; detection+redaction elsewhere *(planned)* | iOS/web cannot block; platform-dependent ([PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md)) |
| Screen recording | Recorder or OS capture feature | Capture-aware redaction where detectable; capture-exclusion where supported *(planned)* | Undetectable recorders on compromised systems |
| Clipboard | Copy of sensitive text | Clipboard Firewall: deny/expiry per ScreenShield level *(planned)* | Once allowed out, clipboard readers may see it |
| Keyboard cache | Predictive text learns secrets | Secure Input Firewall: no-learning flags on sensitive fields *(planned)* | Third-party keyboards may ignore hints |
| Notifications | Preview shows plaintext on lock screen | Policy-gated notification content; Ghost/Bunker never persist content in notifications | OS notification pipelines vary |
| Task switcher | App thumbnail shows last frame | Snapshot redaction on background *(planned)* | Timing races on some platforms |
| Crash logs | Memory dumps with plaintext | No crash reporting by default (ADR-0008); scrubbing rules if ever opt-in | OS-level crash collection outside app control |
| App logs | Sensitive data in log lines | No-plaintext-logging hard constraint; `RedactedLogValue` types; guards | Bugs happen — tests + review are the backstop |
| Browser extensions | Extension reads DOM / captures tab | PWA Low-Assurance Mode; sealed/bunker restricted on web *(planned)* | Extensions are invisible to the page; cannot be blocked |
| AI prompts/cache | Content enters prompts/embeddings | AI Privacy Guard, room-scoping, cache inheritance (ADR-0007) | User pasting content into external AI tools |
| File previews | OS/file-manager previews plaintext files | Files stay encrypted blobs; export is explicit *(planned)* | Once exported, outside FreeLayer's control |
| Document thumbnails | Preview cache of protected docs | No persistent thumbnails of protected content ([STORAGE_MODEL.md](STORAGE_MODEL.md)) | — |
| OS backups | Cloud backup exfiltrates app storage | Key management accounting for backup exposure *(planned, Gate F/C)* | Platform backup behavior varies |
| Remote desktop | Support tool streams the screen | Detection where available → redact; Device Risk high | Undetectable on compromised hosts |
| External camera | Phone photographs the monitor | Reveal minimization (hold-to-view, section-by-section) reduces blast radius | **Unsolvable** — stated honestly everywhere |
| Malicious room member | Legitimate recipient exfiltrates | Watermark/leak canary (optional, planned); membership design | **Unsolvable by encryption** — trust decision |

## Reading the table

- **Mitigation** means reduction, not elimination — per the endpoint-defense principle.
- Channels marked platform-dependent get per-platform truth in [PLATFORM_LIMITATIONS.md](PLATFORM_LIMITATIONS.md).
- Every implemented mitigation must appear in [PBOM.md](PBOM.md) with its real behavior.

## TODO

- [ ] Re-audit this table at every phase boundary (with THREAT_MODEL review)
- [ ] Add per-channel test references as regression suites appear (Phase 10 / AUDIT-EDL-13)
