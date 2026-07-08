# Installation

## Current status

**There is nothing to install yet.** FreeLayer is in the research and foundation stage — this repository contains design documents and monorepo scaffolding, not a runnable application. This page describes the development setup and will grow into real installation instructions as phases ship.

## Development setup

### Prerequisites

- **Node.js** ≥ 20 (LTS recommended)
- **pnpm** ≥ 9 — `corepack enable` is the simplest way to get the pinned version
- **Git**
- Later phases (desktop shell): **Rust** toolchain + Tauri prerequisites for your OS *(not needed yet)*

### Setup

```bash
git clone https://github.com/XGiammyX/freelayer.git
cd freelayer
pnpm install
```

### Available commands

| Command | Status |
| --- | --- |
| `pnpm typecheck` | Runs via Turborepo; no-op until packages contain code |
| `pnpm lint` | Same |
| `pnpm test` | Same |
| `pnpm build` | Same |
| `pnpm format` | Formats the repository with Prettier |
| `pnpm audit:privacy` | Placeholder — prints scope, exits 0 |
| `pnpm audit:security` | Placeholder — prints scope, exits 0 |
| `pnpm audit:supply-chain` | Runs `pnpm audit` |

## Future installation channels (planned, not promised on a date)

- **Desktop** (Windows/macOS/Linux): signed Tauri builds — Phase 11+
- **Web/PWA**: self-hostable static bundle; FreeLayer will not run a canonical hosted instance you must trust — you (or someone you trust) serve the files
- **Relay**: self-hostable `apps/relay` for those who want to run couriers — Phase 4+

## Verification (future)

Release signing, checksums, and (research) reproducible builds are Phase 11 items — see [TRUST_CENTER.md](TRUST_CENTER.md). Instructions will appear here alongside the first release.

## TODO

- [ ] Replace `<repository-url>` when published
- [ ] Tauri prerequisite guide per OS (Phase 1)
- [ ] Self-hosting guide for the web bundle and relay (Phase 4+)
- [ ] Signed-release verification instructions (Phase 11)
