# ADR-0005: Storage selected only by policy

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

Storage is where privacy promises quietly die: a draft autosaved to disk in a "no-trace" mode, a thumbnail cache outliving deleted content, a log file capturing plaintext. Individual features cannot be trusted to remember persistence rules — the rules must be structural.

## Decision

1. **All persistent writes pass through the StoragePolicy engine** (`packages/storage`). This is the **write barrier** ([STORAGE_MODEL.md — Write barrier](../STORAGE_MODEL.md)).
2. No package or app may write to localStorage, IndexedDB, SQLite, the filesystem, Tauri filesystem APIs, browser cache, service-worker cache, AI cache, or log files **unless the write is approved by StoragePolicy and carries a valid `PolicyDecision`** (ADR-0002).
3. Features never choose their own persistence path or backend. StoragePolicy selects among **encrypted-persistent**, **memory-only**, and **null** backends based on the active Privacy Mode and data class.
4. **Caches inherit the strictest policy of their source data** and must be expendable (the app functions with all caches wiped).
5. In Ghost and Bunker modes, zero persistent writes from FreeLayer code paths is a **tested invariant**, not an aspiration — with the documented honest limit that OS-level behavior (swap, filesystem journaling) is outside application control. FreeLayer makes **no claim of forensic erasure**.
6. Emergency wipe prefers **crypto-shredding** (destroy keys, not just data) over overwrite-based deletion, because modern storage hardware makes overwriting unreliable.

## Consequences

- A storage abstraction must exist before any feature persists anything (Implementation Gate C).
- Some platform conveniences (direct localStorage use, ad-hoc caching) are forbidden even where harmless-looking.
- Lint/CI guards against direct storage-API usage are required tooling (Phase 10; static greps earlier).

## Security impact

- At-rest exposure is governed at one choke point; key-destruction semantics are defined once.
- Log files fall under the barrier, structurally supporting the no-plaintext-sensitive-logging constraint.

## Privacy impact

- No-persistence modes are real, testable behavior rather than UI theater.
- Derived data (caches, indexes, AI artifacts) cannot silently outlive stricter source policies.

## What would require a new ADR

- Any write path exempt from the barrier, including "temporary" debug persistence.
- A new backend type or a change to backend-selection semantics.
- Any claim of forensic-grade erasure (currently forbidden outright).
- Cache behavior that does not inherit the strictest source policy.
