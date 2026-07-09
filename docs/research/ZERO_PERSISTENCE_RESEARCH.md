# Zero-Persistence Research (TECH-07)

_Date: 2026-07-09 · Sources verified online during this pass (building on [STORAGE_HARDENING_RESEARCH.md](STORAGE_HARDENING_RESEARCH.md), TECH-06)._

## Sources reviewed

- OWASP MAS — [MASVS-STORAGE](https://mas.owasp.org/checklists/MASVS-STORAGE/), [MASTG local-storage testing](https://mas.owasp.org/MASTG/tests/android/MASVS-STORAGE/MASTG-TEST-0001/), [MASTG logs testing](https://mas.owasp.org/MASTG/tests/android/MASVS-STORAGE/MASTG-TEST-0003/) *(reviewed in TECH-06; conclusions carried forward)*
- MDN — [File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API), [`showSaveFilePicker`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker), [Origin Private File System](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), [StorageManager.persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist), [Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API), [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- Tauri v2 — [capabilities](https://v2.tauri.app/security/capabilities/), [permissions](https://v2.tauri.app/security/permissions/), [fs plugin](https://v2.tauri.app/plugin/file-system/) *(reviewed in TECH-06)*

## Findings and implications

### OWASP: design claims vs tested behavior

MASTG's whole method is verifying storage claims against actual files, logs, caches, and artifacts — a "zero persistence" claim without tests is exactly what it exists to catch. **Implication:** TECH-07's job is converting the Ghost/Bunker claim into runtime traps + static scans + artifact scans, and the docs must keep saying *application-level invariant, not forensic guarantee*.

### Browser persistence surface is wider than Web Storage

Beyond `localStorage`/IndexedDB/CacheStorage, the **File System Access API** (`showSaveFilePicker`, `showOpenFilePicker`, `FileSystemWritableFileStream`) writes to the user's real disk, and the **Origin Private File System** gives origins quota-managed persistent files; `StorageManager.persist()` can upgrade an origin's storage to eviction-protected persistence. Browser-managed data is evicted LRU under pressure unless persisted — the app controls none of this. **Implications:** (1) the forbidden-storage guard must also catch `showSaveFilePicker`/`showOpenFilePicker`/`FileSystemWritableFileStream` and `storage.persist` alongside the classic APIs; (2) PWA strict modes stay lower-assurance than desktop, permanently documented.

### Node/test-runtime persistence is a real leak channel

Tests and tooling can persist secrets by accident: `fs` writes from helpers, snapshots, coverage reports, build output, CI artifacts, console logs captured by runners. Node ships `localStorage` globals now (TECH-06 finding), so "browser-only" APIs are reachable in tests too. **Implications:** runtime traps must cover Node `fs` write APIs *and* the runtime-provided web storage; a sentinel-based artifact scan must sweep coverage/build/snapshot outputs; the trap itself must never write the sentinel anywhere.

### Platform honesty (unchanged, restated)

OS swap, hibernation files, crash dumps, filesystem journaling, SSD wear-leveling, cloud backup, malware, and screen recording all retain data outside the application's control. **Ghost/Bunker zero persistent writes are application-level invariants, not forensic guarantees** — every TECH-07 doc says so.

## What can be tested (and is, in TECH-07)

Runtime: trapped persistence APIs are never called by strict-mode storage paths (positive controls prove the traps fire). Policy: no persistent backend resolvable in Ghost/Bunker/Emergency for any data class; unknown class/backend/mode fail closed. Structure: providers expose no flush/persist/export surface, so leaving Ghost/Bunker cannot auto-flush. Artifacts: the zero-persistence sentinel appears in no error, log, list, snapshot, coverage, or build output.

## What cannot be guaranteed

Anything below the application: a compromised process reads memory; the OS swaps it; the browser decides eviction; hardware keeps traces. Also: aliased/dynamic API access can evade token-level static scans (AST tooling remains Phase 10).

## Decisions made for TECH-07

1. Zero-persistence modes are exactly **ghost, bunker, emergency** (emergency = for normal writes; delete/clear stay possible as the wipe direction).
2. `isPersistentBackend` is the single source of truth and **fails closed**: unknown backend ⇒ treated as persistent ⇒ denied.
3. Unknown data class and unknown mode ⇒ **full deny** in the resolver.
4. Runtime traps **throw and record** — a trapped call is both prevented and visible.
5. New sentinel `FREELAYER_ZERO_PERSISTENCE_SENTINEL_DO_NOT_LEAK` for artifact scans, with an explicit allowlist (helper/test/docs files that define or discuss it).

## Future TODOs

- TECH-08: the same deep-verification pattern for network egress (zero-egress traps).
- Tauri hardening phase: capability-gated fs, plus tests that fail if fs APIs become reachable from app code.
- Phase 10: AST-grade scanning; CI-artifact sweeping in the workflow itself.
