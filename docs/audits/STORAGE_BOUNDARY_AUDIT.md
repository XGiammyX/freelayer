# Storage Boundary Audit (TECH-06)

_Date: 2026-07-08_

## Desired direction

Apps never import `@freelayer/storage` providers directly; apps call SDK/core; core coordinates policy; storage is a side-effect module. Tests may import providers directly.

## Current boundary status

| Rule | Enforced today? | How |
| --- | --- | --- |
| `apps/*` cannot import `@freelayer/storage` | **Yes** | `scripts/check-boundaries.mjs` allowlists apps to `ui`/`sdk`/`core`/`privacy` only; CI-enforced; verified failing on planted violations |
| `packages/ui`/`packages/sdk` cannot import storage | **Yes** | Same allowlist mechanism |
| Only `core` may orchestrate side-effect modules | **Yes (import level)** | Boundary map allows `core → storage`; nothing else outside tests |
| Tests may import providers directly | **Yes** | `tests/` is outside the boundary scan by design |
| Providers unusable without valid `PolicyDecision` + resolved policy | **Yes (runtime)** | Barrier validation in every operation; regression-tested |
| Provider not reachable as an app convenience API | **Import-level yes; type-level no** | Nothing re-exports providers to apps; but any code *inside* an allowed package could still instantiate them |

## Not enforced yet

- **Compile-time restriction on provider construction** — a factory-token or capability-object pattern could make `new MemoryStorageProvider()` outside core a type error. TODO: evaluate at Gate B when the real core pipeline lands.
- **AST-grade import analysis** — the boundary check is regex-based; aliased/dynamic imports could evade it. TODO (Phase 10): adopt `dependency-cruiser` or `eslint-plugin-boundaries` per [DEPENDENCY_POLICY.md](../DEPENDENCY_POLICY.md).
- **Runtime provenance of decisions** — `Symbol.for` marks are forgeable in-process (documented in privacy package); acceptable against accidents, not attackers.

## Conclusion

Boundary posture is adequate for the current phase: mechanical import enforcement + runtime barrier validation + tests. The two upgrades above are tracked for Gate B / Phase 10.
