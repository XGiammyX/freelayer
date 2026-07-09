# Network Boundary Audit (TECH-08)

_Date: 2026-07-09_

## Desired direction

Apps call SDK/core; core evaluates policy; transports require a `PolicyDecision`; network side-effect modules are not app convenience APIs. Tests may import transport mocks directly.

## Current status

| Rule | Enforced today? | How |
| --- | --- | --- |
| `apps/*` cannot import `@freelayer/transports` | **Yes** | `scripts/check-boundaries.mjs` allowlists apps to `ui`/`sdk`/`core`/`privacy`; CI-enforced |
| No direct network APIs in `apps`/`packages` source | **Yes** | `scripts/check-no-forbidden-network.mjs` (fetch/WebSocket/WebRTC/sendBeacon/http:/Tauri HTTP/Node net libs/HTTP client libs); CI + `audit:privacy`; fixture self-tested |
| Transports unusable without a valid `PolicyDecision` + policy | **Yes (runtime)** | `assertNetworkOperationAllowed` in every operation; regression-tested |
| Only `core` orchestrates transports | **Yes (import level)** | Boundary map; nothing outside tests reaches transports |
| Tests may import transport mocks | **Yes** | `tests/` outside the boundary scan |

## Not enforced yet

- **Compile-time restriction on transport construction** (factory-token pattern) — Gate B, alongside the same storage-provider TODO.
- **AST-grade import/call analysis** — the network guard is token-based; aliased/dynamic access can evade it (Phase 10, `dependency-cruiser`/`eslint-plugin-boundaries`).
- **Built-app egress verification** — TECH-09 instruments the production build and asserts zero egress on load.

## Conclusion

Adequate for the current phase: mechanical import + forbidden-API enforcement, runtime barrier, and a runtime trap in tests. The three upgrades above are tracked (Gate B / TECH-09 / Phase 10).
