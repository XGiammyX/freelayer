# FreeLayer Storage Model

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

Direct use of these APIs in feature code is a review-blocking defect regardless of intent. Enforcement: reviewer checklist now ([SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md)); mechanical lint/CI guards by Phase 10.

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

## TODO

- [ ] Storage policy engine API design (Phase 2)
- [ ] Data-class → backend matrix per mode (Phase 2)
- [ ] Crypto-shredding key hierarchy proposal (with CRYPTO_DESIGN.md, Phase 7)
- [ ] "Zero persistent writes in Ghost" regression test (Phase 10)
- [ ] Vault Inspector UX sketch (Phase 7+)
