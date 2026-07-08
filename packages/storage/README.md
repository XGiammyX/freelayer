# @freelayer/storage

**Status: StoragePolicy v0 + write barrier (TECH-05), providers hardened (TECH-06). No persistence exists — encrypted-at-rest is a throwing placeholder until crypto review (Gate F).**

TECH-06 hardening: provider contract v2 (result objects; `list()` metadata-only; honest `kind`/`persistent`/`implemented`), clone-at-boundaries memory provider (uncloneable values rejected — no reference leaks), structurally stateless null provider, `validateStorageKey` misuse detector (never echoes keys), redacted error model, and sentinel leak tests proving stored values never reach errors, console output, or lists. Research basis: [docs/research/STORAGE_HARDENING_RESEARCH.md](../../docs/research/STORAGE_HARDENING_RESEARCH.md).

## What this package does

- **StoragePolicy v0** — `resolveStoragePolicy(input)` maps *privacy mode × data class × sensitivity* (plus room policy, device risk, ScreenShield level) to an explicit policy: backend, allow-flags, plaintext/persistence permissions, and a human-readable reason. **Default deny; strictest wins; room policy can only tighten.**
- **The write barrier** — `assertStorageWriteAllowed(request, decision, policy)` (and read/delete/list/clear variants) rejects: forged or denied decisions, wrong capability, wrong side-effect scope (a `storage.read` decision cannot authorize `storage.write`; `generic` is never accepted), denied writes, cache writes without cache permission, debug artifacts, content-grade payloads in logs/audit events, unimplemented backends, and forbidden persistence.
- **Approved providers** — exactly three: `MemoryStorageProvider` (per-instance process memory), `NullStorageProvider` (validates everything, stores nothing), `EncryptedPersistentStorageProviderPlaceholder` (throws, by design). Providers also verify the policy was resolved *for their backend*.
- **30 typed data classes** — from key material to AI caches to ScreenShield reveal state — with class-group semantics documented in `src/dataClasses.ts`.

## What it does not do yet

No encryption-at-rest, no OS keychain, no filesystem/SQLite/IndexedDB, no wipe implementation, no Vault Inspector. Nothing persists, anywhere, on purpose.

## Hard constraints

- **No feature chooses its own persistence.** Apps never import this package (boundary-checked); core mediates.
- **No direct storage APIs** anywhere in the workspace — `scripts/check-no-forbidden-storage.mjs` fails CI on browser storage/databases/caches/cookies/beacons and `fs.writeFile*`/Deno/Bun/Tauri writes.
- **Errors never contain stored values** (security-regression-tested).
- Memory-only is not forensic protection — the OS may swap; no such claim is made.

## Testing strategy

Unit tests (providers), `tests/privacy-regression/storage/` (mode invariants: Ghost/Bunker zero-persistence sweeps across all classes, Emergency denial, cache/AI denials, ScreenShield + device-risk tightening, room tighten-only), and `tests/security-regression/storage/` (error redaction, key-material denial, audit no-plaintext, guardrail-script behavior against planted fixtures).

See [docs/STORAGE_MODEL.md](../../docs/STORAGE_MODEL.md) and [ADR-0005](../../docs/adr/ADR-0005-storage-selected-only-by-policy.md).
