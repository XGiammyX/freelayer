# FreeLayer Storage Model

[← Docs Index](README.md) · [Privacy Model](PRIVACY_MODEL.md) · [PBOM](PBOM.md) · [ADR-0005](adr/ADR-0005-storage-selected-only-by-policy.md)

> [!NOTE]
> **TECH-05 implemented the foundation of this model**: StoragePolicy v0, the write barrier, and hardened memory/null providers exist and are regression-tested. Encrypted persistence remains deliberately unimplemented (Gate F).

## TECH-07 — Ghost/Bunker zero persistent writes

**The claim "Ghost/Bunker write nothing persistent" is now a machine-checked invariant** ([research](research/ZERO_PERSISTENCE_RESEARCH.md) · [threat model](audits/TECH_07_ZERO_PERSISTENCE_THREAT_MODEL.md) · [audit](audits/TECH_07_ZERO_PERSISTENCE_AUDIT.md)):

- **What "zero persistent writes" means:** in Ghost/Bunker/Emergency, no data class can resolve a persistent backend (`isPersistentBackend` is the single source of truth, unknown backends fail closed); runtime traps prove strict-mode workouts never touch a persistence API (web storage, browser DBs/caches, Node `fs`, synthetic traps for absent browser APIs); the sentinel never reaches errors, console, lists, or generated artifacts.
- **What it does NOT mean:** no forensic guarantee. OS swap, hibernation, crash dumps, journaling, SSD wear-leveling, backups, browser internals, and compromised processes are outside application control — **application-level invariant, not forensic guarantee.**
- **Mode transitions:** entering Ghost/Bunker re-resolves everything to memory/null; leaving them **cannot auto-flush** — providers structurally expose no flush/persist/export surface, and a standard-mode policy cannot authorize the memory provider (backend mismatch), both tested.
- **Capsule spool:** spool/inbox/quarantine never persistent in strict modes; spool timestamps live only in in-memory record metadata.
- **Caches:** preview/thumbnail/media/AI caches and search-index classes denied in Ghost/Bunker (sealed ScreenShield denies them in every mode).
- **Logs/debug:** content-grade logs rejected at the barrier; debug artifacts denied; audit/endpoint artifacts carry redacted metadata only.
- **Unknowns fail closed:** unknown data class or mode ⇒ full deny on the null backend; unknown backend ⇒ treated as persistent and rejected.
- **PWA/browser honesty:** the page cannot control browser persistence (eviction, OPFS, `StorageManager.persist()`); the File System Access API is now in the forbidden-token guardrail; strict-mode claims remain lower-assurance on web.
- **TECH-08 relationship:** the same deep-verification pattern (traps + matrix + sentinel scans) is the template for network zero-egress.

## Hardening status (TECH-06)

TECH-06 hardened the non-persistent providers into genuinely misuse-resistant foundations (research notes: [research/STORAGE_HARDENING_RESEARCH.md](research/STORAGE_HARDENING_RESEARCH.md)):

- **Provider contract v2** — explicit result objects; `list()` returns **metadata only** (key, class, sensitivity, local timestamps, policy mode — never values); honest `kind`/`persistent`/`implemented` flags.
- **MemoryStorageProvider** — per-instance records; **clone-at-boundaries** via `structuredClone` (mutating an object after write, or a read result, cannot touch stored state); uncloneable values (functions, symbols, DataCloneError cases) are **rejected, not stored by reference**.
- **NullStorageProvider** — validates everything (decision, scope, policy, key) and holds zero value state, structurally verified in tests.
- **Key validation** — `validateStorageKey` misuse detector: rejects empty/whitespace/oversized/null-byte/traversal/absolute-path/drive-path/URL-scheme/newline/sentinel keys; errors say only "Invalid storage key." and never echo the key.
- **Redacted error model** — dedicated `InvalidStorageKeyError`, `StorageDecisionMismatchError`, `UnsupportedStorageValueError`; stable generic messages; sentinel-based tests prove no stored value reaches errors, console output, or list results.
- **Zero-persistence harness** — asserts strict modes never resolve persistent backends, provider flags are honest, runtime-provided web storage (Node now ships `localStorage` globals) is left completely untouched, and a full provider workout leaks nothing.
- **Endpoint artifact rule** — capture-audit, device-risk, watermark/canary and reveal/redaction classes reject content/key-material payloads at the barrier (they are behavioral metadata, not content containers).
- **Honest limits, restated:** memory-only does not defeat OS swap, memory dumps, or a compromised process; cloning prevents accidental aliasing, not attackers. No forensic guarantee exists or is claimed.

## Implementation status (TECH-05)

| Piece | Status |
| --- | --- |
| StoragePolicy v0 (`resolveStoragePolicy`, mode × data-class matrix) | **Implemented** — default deny, strictest wins, room tighten-only, ScreenShield/device-risk hooks |
| Write barrier (`assertStorageWriteAllowed` + read/delete/list/clear asserts) | **Implemented** — requires request + exact-scope `PolicyDecision` + resolved policy |
| MemoryStorageProvider | **Implemented, hardened** — per-instance memory, no browser/filesystem APIs, values never logged |
| NullStorageProvider | **Implemented, hardened** — validates everything, stores nothing |
| Encrypted persistent storage | **Not implemented** — throwing placeholder only (`EncryptedPersistentStorageProviderPlaceholder`) |
| 30 typed data classes + 8 sensitivity levels | **Implemented** (supersedes the initial 11-class list below, which remains as the summary table) |
| Privacy/security regression tests | **Added** — 37 storage tests incl. Ghost/Bunker zero-persistence sweeps and error-redaction checks |
| Emergency wipe, crypto-shredding, Vault Inspector | Not implemented (Phase 7) |

## Purpose

Define how FreeLayer stores data locally: the storage-policy engine, backend types, cache rules, and destruction guarantees. Storage is where privacy promises most often quietly break; this model exists to prevent that.

## Current status

**Design stage.** `packages/storage` is scaffolding only. Policy engine is a Phase 2 deliverable; encryption-at-rest depends on [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md) review.

## Principles

1. **Local-first**: devices hold the authoritative data. Nothing is stored server-side because there is no server side.
2. **Policy-selected backends**: every write goes through the storage policy engine, which selects a backend based on the active Privacy Mode and data class. Features never choose their own persistence.
3. **Honest destruction**: deletion claims are stated at the level the platform can actually deliver (see limitations).

## Write barrier

**All persistent writes must pass through StoragePolicy.** *(Locked — [ADR-0005](adr/ADR-0005-storage-selected-only-by-policy.md).)*

No package or app may write to:

- localStorage
- sessionStorage, when policy forbids it
- IndexedDB
- SQLite
- the filesystem
- Tauri filesystem APIs
- browser cache
- service-worker cache
- AI cache
- log files
- crash dumps
- thumbnail/media cache
- search indexes
- embedding indexes

unless the write is approved by StoragePolicy and carries a valid `PolicyDecision` issued by core ([ADR-0002](adr/ADR-0002-core-enforced-policy-engine.md)).

Direct use of these APIs in feature code is a review-blocking defect regardless of intent. Enforcement: the `check:no-forbidden-storage` CI guard (browser storage, browser databases, page/service-worker caches, cookies, beacons, `fs.writeFile*`, `Deno.writeFile`, `Bun.write`, Tauri fs plugins) plus reviewer checklist; AST-grade tooling remains a Phase 10 upgrade.

**As implemented (TECH-05):** every write presents `(StorageWriteRequest, PolicyDecision, StoragePolicy)`. The barrier rejects, in order: missing/forged decisions, denied verdicts, wrong capability, wrong side-effect scope (a decision for `storage.read` cannot authorize `storage.write`; `generic` is never accepted), policy `allowWrite=false`, cache writes without `allowCache`, debug artifacts, content-grade payloads in logs/audit events, unimplemented backends (the encrypted placeholder throws), and persistent writes without `persistentAllowed`. **Default is deny** — a class/mode pair nothing explicitly allows is denied. Error messages never contain stored values (security-regression-tested).

## Storage side-effect classification

Every persistent write belongs to exactly one class. Entries below are initial design direction, refined at Gate C; **every class requires a PBOM entry and tests before its first implementation ships.**

| Class | Allowed modes (initial) | Backend | Encryption | Wipe behavior |
| --- | --- | --- | --- | --- |
| Identity/key material | All (Ghost Vault later moves keys off-device) | OS keychain / encrypted persistent | Always | First in emergency wipe; crypto-shred |
| Room operation log | Standard, Private; memory-only in Ghost/Bunker | Encrypted persistent or memory | Always | Per-room crypto-shred |
| Materialized room state | Same as operation log (derived, rebuildable) | Same as operation log | Always | Wiped with room; rebuildable from log |
| Document content | Same as operation log | Encrypted persistent or memory | Always | Per-room crypto-shred |
| File/blob content | Standard, Private; memory-only in Ghost/Bunker | Encrypted persistent (chunked) or memory | Always | Per-room crypto-shred |
| Capsule spool | All (Offline Capsule depends on it) | Strictest-of-contents | Contents pre-encrypted; spool metadata coarsened | Emergency wipe clears spool |
| Cache (media/preview/thumbnail) | Standard, Private only | Encrypted persistent, expendable | Always | Wipeable at any time; app must function without |
| AI-derived cache (embeddings, indexes, summaries) | Only where AI allowed (never Ghost/Bunker) | Inherits strictest source policy | Always | Wiped with source content |
| Settings | All | Encrypted persistent | Always | Emergency wipe |
| Logs | All; verbosity respects mode | Policy-gated log backend | No sensitive content permitted, encrypted where persistent | Emergency wipe |
| Debug artifacts | Development builds only — never in releases | Memory-only default | Must not contain sensitive data | Discarded at exit |

## Backend types

| Backend | Behavior | Used by |
| --- | --- | --- |
| **Encrypted persistent** | Encrypted at rest before touching disk; key held per policy (OS keychain via Tauri, or passphrase-derived) | Standard, Private |
| **Memory-only** | Lives in process memory; gone at exit; never intentionally written to disk | Ghost, Bunker |
| **Null** | Accepts writes, stores nothing; reads return empty | No-persistence data classes; Emergency aftermath |

## Data classes

- **Capsule spool** — outbound capsules awaiting transport and inbound awaiting processing. Spool honors the strictest mode among the capsules it holds. Spool entries are already-encrypted capsules, but spool *existence and timing* is metadata → coarse timestamps *(TODO design)*.
- **Room storage** — room operation logs and materialized state. Per-room policy may exceed device mode strictness.
- **Document/file storage** — encrypted blobs with content-addressed references from rooms.
- **Caches** — media thumbnails, decrypted-preview cache, AI cache. Rules: caches inherit the strictest policy of the data they derive from; caches are always expendable (app must function with caches wiped); every cache is enumerated in [PBOM.md](PBOM.md).
- **Settings/identity** — identity keys and trust data; the most protected class; Ghost Vault (future) moves identity keys off-device entirely.

## No-persistence mode

Under Ghost/Bunker, the storage engine mounts memory-only backends for all content classes. Requirements:

- Zero writes to persistent storage from FreeLayer code paths (testable invariant — Phase 10 regression suite).
- UI communicates that closing the app discards state.
- **Honest limit:** the OS may still swap memory to disk, and the browser/PWA platform offers weaker guarantees than the desktop shell. No-persistence is enforced at the application layer; it is not a forensic guarantee.

## Emergency wipe

Emergency mode triggers: wipe of designated data classes (keys first, then content, then caches), best-effort secure deletion, and drop to a safe state. 

- **Honest limit:** SSDs (wear leveling, TRIM timing) and journaling filesystems mean overwrite-based secure deletion is unreliable on modern hardware. The design therefore prefers **crypto-shredding**: destroy the keys, and encrypted data becomes unreadable without relying on physical overwrite. *(Depends on encryption-at-rest, Phase 7.)*

## Vault Inspector (future idea)

A built-in screen enumerating everything FreeLayer holds on disk: what, where, under which policy, encrypted how, wipeable how. Doubles as a live, user-verifiable PBOM. *(Phase 7+ design item.)*

## Derived endpoint artifacts (Endpoint Defense — ADR-0012)

Endpoint defense produces derived data that is content in disguise and follows the same discipline:

| Artifact | Rule |
| --- | --- |
| Redaction state | Memory-only; rebuildable; never plaintext-revealing |
| Reveal timers / reveal history | **Must not persist in strict modes**; memory-only elsewhere unless policy allows |
| Thumbnails | **No persistent thumbnails of protected content, ever** |
| Protected previews | **No preview cache in Ghost/Bunker**; cache-class rules elsewhere |
| Copied sensitive content | Clipboard is not storage, but is treated as leakage — Clipboard Firewall governs it; expiring copies where allowed |
| Screen-capture audit events | Local-only; **must not include plaintext content** (redacted detail only) |
| Watermark/canary state | Policy-gated; storage-class `settings`/`cache` per design |
| Device risk state | Local-only; memory-only in Ghost/Bunker |

## Required future tests

The write barrier and destruction claims are verified, not assumed (Gate C and beyond — [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)):

- Ghost mode: zero persistent writes from FreeLayer code paths
- Bunker mode: zero persistent writes from FreeLayer code paths
- No localStorage usage in content paths (workspace-wide ban is the default; any exception requires policy approval)
- No plaintext room state in any persistent backend
- No plaintext capsule spool
- No plaintext AI cache (embeddings, indexes, summaries)
- No plaintext storage of keys or identity data in any backend
- Cache inheritance: derived data never outlives the strictest policy of its source
- Emergency wipe: key destruction (crypto-shredding) verified — wiped data unreadable without relying on physical overwrite
- Vault Inspector consistency: everything on disk is enumerated by the inspector, and nothing enumerated is missing from [PBOM.md](PBOM.md)

## Current implementation limitations

Stated plainly:

- **No encryption-at-rest exists.** The encrypted backend is a placeholder that throws; Standard-mode content writes therefore fail hard by design until Gate F.
- **No OS keychain, no filesystem storage, no SQLite/IndexedDB** — nothing persists at all in the current implementation.
- **Memory-only is not forensic protection**: the OS may swap process memory to disk; no forensic claims are made anywhere.
- Emergency wipe and crypto-shredding are direction, not implementation (Phase 7).

## Risks

- **Platform storage betrayal**: PWA storage eviction, OS swap, backup systems (cloud backup silently exfiltrating "encrypted-at-rest" blobs — key management must account for backup exposure). *(TODO research per OS)*
- **Cache leaks**: derived data (thumbnails, AI outputs) outliving stricter source policy — prevented structurally by cache-inheritance rule.
- **Key loss = data loss**: local-first + encryption means no recovery service. Recovery kit design (Identity Firewall, Phase 3) is the mitigation; docs must be blunt about this trade-off.

## Open questions

- SQLite (via Tauri) vs. IndexedDB vs. custom log files — per platform?
- One master key per identity, or per-data-class keys for crypto-shredding granularity? (Direction: per-class, derived — see CRYPTO_DESIGN.md.)
- How do room bundles interact with storage policy when exported to file transports?

## Future research required

- Forensic residue of IndexedDB/SQLite deletion per OS
- OS keychain integration in Tauri across Windows/macOS/Linux
- Cloud-backup interaction (iOS/Android/Windows) with app storage

## Storage as a metadata surface (TECH-10)

Storage is not only a content surface — its artifacts are metadata:

- Caches and derived artifacts (preview/thumbnail/media/AI caches) are **content-adjacent metadata**; their existence leaks activity.
- Audit events and logs are **metadata sinks** — redacted only, never content, never persistent in v0.
- Preview/thumbnail existence is metadata; protected-content reveal state is metadata.
- **Cache denial must align with MetadataPolicy.** StoragePolicy denies preview/thumbnail caches in Private+, AI caches everywhere, and reveal-state persistence in strict/sealed; MetadataPolicy denies the corresponding `preview.generated` / `cache.exists` / `ai.cache_exists` / `protected_content.revealed` events. Agreement is guarded by `tests/privacy-regression/metadata/metadata-integration.test.ts`. See [METADATA_MODEL.md](METADATA_MODEL.md).
- **(TECH-11) Preview/favicon/OpenGraph/avatar/thumbnail caches are denied.** A preview cache would persist a URL, title, and image (content-adjacent); a favicon cache would persist browsing interests; a remote-avatar cache would persist contact-graph hints. `LinkPreviewPolicy` denies all preview caching (`cacheAllowed`/`thumbnailAllowed`/`faviconAllowed` false), and Ghost/Bunker deny any persistent URL/preview artifact. Agreement with StoragePolicy is guarded by `tests/privacy-regression/link-preview/`.
- **(TECH-20) Membership records/projections/events and capability descriptors are memory-only; capability persistence is forbidden.** The membership layer introduces these logical data classes, all **memory/null only, never persisted in v1**: `room_membership_record`, `room_membership_projection`, `room_membership_event`, `room_membership_query_result`, `room_membership_count`, `room_capability_descriptor` (transient). `room_capability_cache` and capability persistence are **forbidden** (matrix `room.capability.persist` → deny; descriptors are not credentials). `room_invite_future` and `room_identity_proof_future` are **not implemented** (Gates G/E). Ghost/Bunker retain no membership data (null log). Membership existence, relationship, role, state, revision, count, timestamps, and role-change history are metadata — no telemetry, no query history, no plaintext audit payload.

  | Logical data class            | Behavior (all modes)         |
  | ----------------------------- | ---------------------------- |
  | `room_membership_record`      | Memory/null only             |
  | `room_membership_projection`  | Memory/null only             |
  | `room_membership_event`       | Memory/null only             |
  | `room_membership_query_result`| Memory-only; redacted        |
  | `room_membership_count`       | Memory-only; own scope       |
  | `room_capability_descriptor`  | Memory-only; transient       |
  | `room_capability_cache`       | Forbidden                    |
  | `room_invite_future`          | Not implemented — Gate G/E   |
  | `room_identity_proof_future`  | Not implemented — Gate G     |

- **(TECH-19) Query snapshots, results, cursors, and terms are memory-only; history/cache/index are denied.** The query layer introduces these logical data classes, all **memory-only and never persisted in v1**: `room_query_snapshot`, `room_query_result`, `room_query_cursor`, `room_query_term`. The query term is additionally **never logged, audited, or retained** (no history). `room_query_history`, `room_query_cache`, `room_search_index`, and `room_search_snippet` are **denied in every mode** (matrix rows `room.query.history`/`result_cache`/`search_index` → deny) — a persistent index would duplicate content; enabling any of them requires a future design gate. StoragePolicy, QueryPolicy, and the Policy Matrix agree (test-enforced).

  | Logical data class     | Behavior (all modes)        |
  | ---------------------- | --------------------------- |
  | `room_query_snapshot`  | Memory-only; never persisted |
  | `room_query_result`    | Memory-only; never persisted |
  | `room_query_cursor`    | Memory-only; not authority; not persisted |
  | `room_query_term`      | Memory-only; never logged/audited/retained |
  | `room_query_history`   | Denied — future gate        |
  | `room_query_cache`     | Denied — future gate        |
  | `room_search_index`    | Denied — future gate        |
  | `room_search_snippet`  | Denied — not implemented    |

- **(TECH-18) Object content + object-event logs are memory/null only.** Concrete room objects (message/note/task/decision/poll/file_ref) hold content in memory only; the object mutation log ships exactly `InMemoryRoomObjectLog` + `NullRoomObjectLog`. **Persistent plaintext object content is denied in every mode** (`room.object.persist` → deny) until the encrypted backend exists (Gate F); Ghost/Bunker deny persistence (Bunker prefers null retention); Standard fails hard rather than falling back. File-reference objects store an opaque `localRefId` only — **no bytes, path, or URL** — and resolving/previewing them is future/forbidden (`room.object.file_resolve` future-gate; `file_preview`/`file_remote` deny).

  **Object data classes (TECH-18).** The object model introduces these logical data classes; they map onto the canonical coarse `StorageDataClass` taxonomy (`message_content` / `materialized_room_state`) and are **all denied for persistence in every privacy mode in v1** — the encrypted backend does not exist (Gate F). Behavior by mode is identical across them: Standard/Private/Sovereign/Offline = **in-memory only** (persist → fail hard, no fallback); Ghost/Bunker = **memory-only, no persistence** (Bunker prefers null retention); Emergency = **ordinary content denied**, only redact/tombstone.

  | Logical data class          | Backing coarse class      | Persistence (all modes) |
  | --------------------------- | ------------------------- | ----------------------- |
  | `room_message_content`      | `message_content`         | Denied — Gate F         |
  | `room_note_content`         | `message_content`         | Denied — Gate F         |
  | `room_task_content`         | `materialized_room_state` | Denied — Gate F         |
  | `room_decision_content`     | `materialized_room_state` | Denied — Gate F         |
  | `room_poll_definition`      | `materialized_room_state` | Denied — Gate F         |
  | `room_file_ref_metadata`    | `materialized_room_state` | Denied — Gate F         |
  | `room_object_projection`    | `materialized_room_state` | Denied — Gate F         |
  | `room_object_tombstone`     | `materialized_room_state` | Denied — Gate F         |

  Tombstone records carry no content (content-cleared) and are **not** forensic erasure. Snapshots/compaction of the object projection remain future derived-data storage (Gate F + StoragePolicy/PBOM review).
- **(TECH-17) Operation-log retention is memory/null only.** The log-grade event store ships exactly two providers — `InMemoryRoomOperationLog` and `NullRoomOperationLog`; a persistent (encrypted) log, replay reports, tombstone records, and projection snapshots/checkpoints are FUTURE derived-data storage classes that must pass Gate F + StoragePolicy/PBOM review before existing (`room.snapshot_future` is a pinned future-gate matrix row). Ghost/Bunker never persist logs/projections/replay artifacts; Standard fails hard rather than falling back.
- **(TECH-16) Room data classes are live.** `room_operation_log` and `materialized_room_state` now back real RoomOS objects: the operation log and projection are **memory-only** (matrix rows `room.operation_log_persist`/`room.projection_persist` deny in every mode); Ghost/Bunker never persist them; Standard's content-bearing room objects target the unimplemented encrypted backend and **fail hard** (no silent fallback) until Gate F. Room audit events are redacted `logs`-class entries.
- **(TECH-13) Storage behavior is summarized in the [Policy Matrix](POLICY_MATRIX.md)** and StoragePolicy must not contradict it (agreement is test-enforced): Ghost/Bunker persistent denial, preview/AI-cache denial, and the future-gated encrypted persistent backend are all matrix-covered rows.
- **(TECH-12) Notification content is a denied storage class.** Notification content storage is born denied in strict modes and never persists in v0 (`NotificationPolicy.persistentStorageAllowed` is always false); notification audit events must be redacted (no title/body/room/sender); badge state is metadata and is not persisted in strict modes. Once a notification is delivered, OS notification-center persistence is outside app control. Agreement with StoragePolicy is guarded by `tests/privacy-regression/notifications/`.

## TODO

- [ ] Storage policy engine API design (Phase 2)
- [ ] Data-class → backend matrix per mode (Phase 2)
- [ ] (TECH-10) Keep StoragePolicy cache/reveal/AI denials aligned with MetadataPolicy (integration test guards this)
- [ ] Crypto-shredding key hierarchy proposal (with CRYPTO_DESIGN.md, Phase 7)
- [ ] "Zero persistent writes in Ghost" regression test (Phase 10)
- [ ] Vault Inspector UX sketch (Phase 7+)
