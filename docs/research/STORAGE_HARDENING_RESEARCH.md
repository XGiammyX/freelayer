# Storage Hardening Research (TECH-06)

_Date: 2026-07-08 · Sources verified online during this pass._

## Sources reviewed

- OWASP MAS — [MASVS-STORAGE checklist](https://mas.owasp.org/checklists/MASVS-STORAGE/), [MASTG-TEST-0001 (local storage for sensitive data)](https://mas.owasp.org/MASTG/tests/android/MASVS-STORAGE/MASTG-TEST-0001/), [MASTG-TEST-0003 (logs for sensitive data)](https://mas.owasp.org/MASTG/tests/android/MASVS-STORAGE/MASTG-TEST-0003/), [Testing Data Storage](https://mas.owasp.org/MASTG/0x05d-Testing-Data-Storage/)
- MDN — [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [Structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
- Tauri v2 — [Permissions](https://v2.tauri.app/security/permissions/), [Capabilities](https://v2.tauri.app/security/capabilities/), [File System plugin](https://v2.tauri.app/plugin/file-system/)

## Findings and FreeLayer implications

### OWASP MASVS-STORAGE / MASTG

**Finding:** sensitive-data storage must be *intentional, protected, and testable*; the test guides treat logs, caches, and debug artifacts as first-class storage leakage channels, checked file-by-file.
**Implication:** FreeLayer's write barrier + data-class model is the right shape; TECH-06 adds what MASTG actually tests for — sentinel-based leak tests over errors, logs, and list output. "Memory-only" remains application-layer behavior, never forensic protection.

### Browser storage (MDN)

**Finding:** `localStorage` persists across sessions per-origin (~5 MiB), synchronously, with browser-controlled quotas/eviction; every same-origin script sees the same store.
**Implication:** direct browser storage is structurally incompatible with FreeLayer's strict modes — persistence the app doesn't control, shared by origin, invisible to policy. Direct use of `localStorage`/`sessionStorage`/IndexedDB/CacheStorage stays **forbidden outside future approved providers** (guardrail v2), and PWA no-persistence claims stay labeled lower-assurance than desktop.

### Tauri v2 capabilities/permissions

**Finding:** every plugin action needs an explicit permission; the fs plugin scopes paths by glob, defaults to app-specific directories, and undeclared calls fail (silently on the frontend).
**Implication:** future desktop persistence must be capability-gated by design, never casually exposed to frontend code: a documented capability set + scoped fs access precedes any persistent provider (Gate C completion). Nothing in TECH-06 adds Tauri permissions.

### JavaScript memory/reference behavior

**Finding:** objects are stored by reference unless cloned; `structuredClone` deep-copies most data but **throws `DataCloneError` on functions and DOM nodes**, and drops property descriptors/getters — class instances lose their prototype semantics.
**Implication:** the memory provider must clone at write AND read boundaries so callers can't mutate stored state through retained references; values `structuredClone` can't handle are **rejected, not stored by reference**. Honest limit: cloning prevents accidental aliasing, not a compromised process reading memory, and nothing prevents OS swap.

## Design decisions made in TECH-06

1. Providers return **result objects**; `list()` returns **metadata only** (never values), with `createdAtLocal`/`updatedAtLocal` explicitly untrusted local strings.
2. **`validateStorageKey`** as a misuse detector (not a security boundary): rejects empty/oversized/null-byte/traversal/absolute-path/URL-scheme/newline keys — errors never echo the key.
3. **Clone-at-boundaries** via `structuredClone`; uncloneable values rejected with a generic error.
4. **Generic, stable error messages**; sentinel-based regression tests assert no leak through errors, console, or list output.
5. Decision mismatches get a dedicated `StorageDecisionMismatchError`; forged decisions remain `StorageBypassAttemptError`.
6. Endpoint artifact classes (capture audit, device-risk, watermark/canary) reject content/key-material sensitivities at the barrier.

### Empirical finding during TECH-06 test runs

Modern Node (the project's own test runtime, Node 25) now exposes `localStorage`/`sessionStorage` as **real globals** (the formerly-flagged web-storage feature, unflagged). Consequence: "browser storage APIs are absent in Node" is no longer a valid assumption — the zero-persistence harness was adjusted to assert the storage layer **leaves runtime-provided web storage completely untouched** (length-before == length-after around a full provider workout) instead of asserting absence. This also strengthens the case for the forbidden-storage guardrail: the API is now reachable even in non-browser code.

## Risks that remain

- A compromised process/OS reads memory regardless of any of this (out of scope, stated).
- Token-based guardrail can be evaded by aliasing (`const s = window["local" + "Storage"]`) — AST tooling is the Phase 10 upgrade.
- `structuredClone` availability assumed (Node ≥17/modern browsers); older environments unsupported by policy.
- Prototype-stripping on clone means class instances round-trip as plain data — documented, acceptable for v0.

## TODOs for TECH-07 and future persistent storage

- TECH-07: deep Ghost/Bunker verification — instrumented runs asserting zero persistent side effects end-to-end, not just policy resolution.
- Persistent storage (post-Gate F): Tauri capability document BEFORE implementation; per-platform storage/eviction notes for PWA claims; wipe semantics.
