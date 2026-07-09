# TECH-07 Threat Model — Ghost/Bunker Zero Persistent Writes

_Scope: FreeLayer **application behavior**, not OS forensic residue. A compromised OS/process, swap, crash dumps, journaling, wear-leveling, backups, and cameras are outside what any app-level control can solve — stated here once and in every related doc._

## Persistence bypass threats

Direct writes around the barrier: browser-local storage and session storage, IndexedDB, CacheStorage/service-worker cache, cookies, **File System Access API** (`showSaveFilePicker`/`showOpenFilePicker`/`FileSystemWritableFileStream`, OPFS), `StorageManager.persist()` upgrades, filesystem writes (`fs.writeFile*`, `fs.promises.writeFile`, Deno/Bun writers), SQLite imports, Tauri fs plugin usage, browser download/export helpers, debug dumps, test snapshots, coverage reports, build artifacts, CI artifacts.
**Controls:** forbidden-storage guardrail v3 (tokens incl. File System Access API), runtime persistent-write traps in tests, artifact sentinel scans.

## Policy bypass threats

Persistent/cache provider selected under Ghost/Bunker; features writing before policy evaluation; direct provider instantiation by apps; forged or wrong-scope `PolicyDecision`; **mode transition leaving stale persistent state or auto-flushing memory to disk**; Sovereign Room policy attempting to loosen device strictness.
**Controls:** resolver invariants (no persistent backend resolvable in strict modes; unknown class/backend/mode fail closed), exact-scope decisions, backend-match checks, tighten-only room composition, transition tests proving no flush surface exists.

## Derived-data persistence threats

Previews, thumbnails, media cache, AI prompt/embedding/output caches, search indexes, materialized room state, capsule spool existence/timestamps, protected reveal state, capture-audit events, watermark/canary state, notification content.
**Controls:** matrix denials per class in strict modes; endpoint classes reject content-grade payloads; spool metadata stays in-memory; notification content has no storage class yet — recorded as a future rule the class must adopt at birth (TODO, TECH-EDL/notifications work).

## Test/tooling leakage threats

The sentinel (stand-in for any secret) appearing in: thrown errors, console output, snapshots, coverage, build output, CI artifacts, generated docs, debug output.
**Controls:** sentinel leak tests across errors/console/lists (TECH-06) plus the TECH-07 artifact scanner over coverage/build/snapshot directories with an explicit allowlist.

## Explicit non-goals

No claim is made against: OS swap/hibernation, crash dumps, filesystem journaling, SSD wear-leveling, browser-internal persistence decisions, cloud backup, malware/keyloggers, or hardware attacks. **Application-level invariant, not forensic guarantee.**
