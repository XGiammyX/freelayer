# TECH-07 Zero-Persistence Audit

_Date: 2026-07-09 · Branch: `tech/ghost-bunker-zero-persistent-writes` (from `6d97ecd`)_

## Verdict

**TECH-07: COMPLETE.** All acceptance criteria met; 116/116 tests green; all local checks pass.

## Commands run

`pnpm install/typecheck/lint/test/build` + all five `check:*` guards + `audit:privacy` + `audit:supply-chain` — **all PASS**. Development-loop findings fixed honestly: Node's `Storage` object intercepts instance property assignment (web-storage semantics), so traps patch the **prototype**; and this runtime ships an **inert** `localStorage` global (present, no callable `setItem` without a backing file) — a third honest state the positive control now recognizes (recorded in the research note as an addendum-worthy behavior).

## Research summary

OWASP MASTG (claims must be test-verified; logs/artifacts are storage channels) · MDN File System Access API / OPFS / `StorageManager.persist()` (browser persistence is wider than Web Storage — guardrail extended) · Tauri v2 capabilities (future fs must be capability-gated) · Node/test-runtime risks (fs writes, snapshots, coverage, CI artifacts — sentinel scans added). Full note: [research/ZERO_PERSISTENCE_RESEARCH.md](../research/ZERO_PERSISTENCE_RESEARCH.md).

## Invariants covered (38 new tests → 116 total)

- **Assertion layer:** mode classification (ghost/bunker/emergency), fail-closed `isPersistentBackend` (unknown ⇒ persistent ⇒ denied), policy/backend tuple assertion.
- **Matrix:** 8 mode configurations (incl. Sovereign-Room-composed-with-Ghost/Bunker) × 22 data classes — no persistent backend, no `persistentAllowed`, bunker ≥ ghost strictness, room policy cannot loosen, sealed-ScreenShield+Ghost protected artifacts denied.
- **Fail-closed unknowns:** unknown data class, unknown mode, unknown backend — all full-deny.
- **Runtime traps:** ghost/bunker/emergency workouts fire zero persistence APIs; positive controls prove traps catch `fs.writeFileSync` (file verifiably not created), synthetic `indexedDB.open`/`caches.open`; honest trapped/absent coverage reporting (Deno/Bun absent; localStorage inert in this runtime).
- **Transitions:** Standard→Ghost re-resolves to memory; Ghost→Standard has **no flush surface** (provider prototype exposes exactly write/read/delete/list/clear) and cross-mode policies are rejected by backend-match.
- **Spool/cache/logs:** spool/inbox/quarantine never persistent; bundle export denied in bunker; content-grade logs barrier-rejected in strict modes; debug artifacts denied.
- **Artifacts:** zero-persistence sentinel pushed through a strict workout, then coverage/build/snapshot directories scanned — no hits (absent dirs reported "not applicable", never assumed).
- **Guardrail v3:** File System Access API tokens (`showSaveFilePicker`/`showOpenFilePicker`/`showDirectoryPicker`/`FileSystemWritableFileStream`/`storage.persist(`) caught in fixtures; `packages` scan stays clean; markdown mentions never fail.
- **Boundary:** `check-boundaries` green, now asserted inside the test suite too.

## Coverage honesty

Runtime traps report exactly what they trapped vs what is absent in this environment (browser-only APIs get synthetic traps so accidental calls still fail loudly). Artifact scan covers directories that exist and reports the rest as not-applicable. **Review-only remainder:** aliased/dynamic API access (AST tooling, Phase 10), compile-time provider-construction restriction (Gate B).

## Known limitations

Application-level invariant only — no forensic guarantee (OS swap, crash dumps, journaling, wear-leveling, backups, browser internals, compromised processes). Token-based static scan. In-process forgeable decision marks (documented since TECH-05).
