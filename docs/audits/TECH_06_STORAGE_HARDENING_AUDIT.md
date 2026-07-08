# TECH-06 Storage Hardening Audit

_Date: 2026-07-08 · Branch: `tech/memory-null-storage-hardening` (from `04ce0f2`)_

## Verdict

**TECH-06: COMPLETE.** All acceptance criteria met; all local checks pass; 78/78 tests green.

## Commands run

`pnpm install/typecheck/lint/test/build` + `check:boundaries` + `check:no-external-assets` + `check:no-telemetry` + `check:no-forbidden-storage` + `check:doc-links` + `audit:privacy` + `audit:supply-chain` — **all PASS**. Two mid-development test failures were diagnosed and fixed (fixture missing the literal `caches.open` token; Node 25 shipping `localStorage` globals, harness adjusted to assert untouched-not-absent — recorded in the research notes).

## Invariant coverage added (25 new tests → 78 total)

- Memory provider: clone isolation (write + read boundaries), uncloneable-value rejection, instance isolation, metadata-only lists, honest flags, invalid/traversal/URL/sentinel key rejection without echo, sentinel-free errors and console output.
- Null provider: validated no-ops, structurally zero value state (`Object.keys` check across 50 writes), honest flags, sentinel-free channels.
- Placeholder: throws on all ops with sentinel-free errors; `persistent: true / implemented: false`.
- Zero-persistence harness: strict-mode backend sweep, provider-flag honesty, runtime web-storage untouched, full-workout sentinel silence.
- Endpoint hooks: device-risk/watermark classes reject content payloads; sensitive_metadata accepted in memory.
- Guardrail: fails on localStorage/indexedDB/caches.open/writeFileSync fixtures; passes clean dirs; markdown mentions never fail.

## Provider hardening status

Memory: **hardened** (contract v2, records with local timestamps + policy mode, cloning, key validation). Null: **hardened** (validates decision/scope/policy/key; stores nothing). Placeholder: unchanged behavior, honest flags added.

## Guardrail status

v2: adds `serviceWorker.register`, `promises.writeFile`, `sqlite`, Deno/Bun/Tauri fs tokens; argv-dir support for self-testing; fixtures under `tests/fixtures/` (never default-scanned).

## Known limitations

Token-based scanning (AST is Phase 10); `Symbol.for` decision marks forgeable in-process; clone protects against aliasing, not compromised processes; OS swap out of scope; class instances round-trip as plain data under `structuredClone`.

## TODOs

Gate B: compile-time provider-construction restriction (see [STORAGE_BOUNDARY_AUDIT.md](STORAGE_BOUNDARY_AUDIT.md)). TECH-07: end-to-end Ghost/Bunker deep verification. Pre-persistence: Tauri capability document, PWA eviction notes, wipe semantics.
