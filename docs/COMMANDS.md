# Commands

[← Docs Index](README.md) · [Contributor Workflow](CONTRIBUTOR_WORKFLOW.md)

## Everyday

| Command | What it does |
| --- | --- |
| `pnpm install` | Install (Node 24 via `.nvmrc`, pnpm 9) |
| `pnpm typecheck` | Strict TS across all packages + tests |
| `pnpm lint` | ESLint (AST constitution rules) + Prettier check |
| `pnpm format` | Auto-format |
| `pnpm test` | Full vitest suite (unit + privacy/security regression) |
| `pnpm test:coverage` | Coverage (text summary) |
| `pnpm build` | Build all packages/apps |

## Privacy / security guards

| Command | Guards against |
| --- | --- |
| `pnpm check:boundaries` | Package import-direction violations |
| `pnpm check:no-external-assets` | Remote fonts/images/scripts/CSS, CDNs, connection hints, OG images |
| `pnpm check:no-telemetry` | Telemetry/analytics tokens |
| `pnpm check:no-forbidden-storage` | Direct storage APIs outside the barrier |
| `pnpm check:no-forbidden-network` | Direct network APIs / remote hosts |
| `pnpm check:build-zero-egress` | Remote references in the built artifact |
| `pnpm check:no-network-deps` | HTTP/analytics/AI-client dependencies |
| `pnpm check:no-metadata-bypass` | Hand-rolled receipt/typing/presence/preview emitters |
| `pnpm check:no-notification-bypass` | Notification/badge/push/service-worker APIs |
| `pnpm check:policy-matrix` | Matrix structure/invariants (94 specs → 658 rules) |
| `pnpm check:policy-docs` | Docs mention required policy statements |
| `pnpm check:policy-conflicts` | Cross-layer contradictions, Trust Center overclaims, endpoint-monitoring deps |
| `pnpm check:contributor-workflow` | Required workflow files + externalization statements |
| `pnpm check:doc-links` | Broken doc links |
| `pnpm audit:privacy` | Aggregated privacy guards |
| `pnpm audit:security` | Baseline pointer (dedicated suite: Phase 10) |
| `pnpm audit:supply-chain` | `pnpm audit` (high+) |

## One-shot

`pnpm check:all` — typecheck → lint → test → build → every guard → audits. Run it before every PR.

## Docs / wiki

`pnpm wiki:publish` — publish `wiki/` to the GitHub wiki (`docs/` stays canonical — [DOCS_CANONICAL_WORKFLOW.md](DOCS_CANONICAL_WORKFLOW.md)).

## Troubleshooting

- **Prettier failures** → `pnpm format`, re-run.
- **`check:policy-matrix` sync failure** → you edited the TS specs without mirroring `docs/policy-matrix.v1.json` (or vice versa). Mirror them exactly.
- **`check:policy-conflicts` failure** → a layer contradicts the matrix or a doc overclaims; read the category tag in the message ([POLICY_DEVELOPER_GUIDE.md](POLICY_DEVELOPER_GUIDE.md)).
- **`--localstorage-file` warning in tests** → benign Node warning; not a failure.
- **Windows**: scripts are plain Node — no bash required.

## What not to bypass

Never `--no-verify`, never skip/soften a failing guard, never allowlist a real source path to silence a scanner, never mark `testCoverage: "covered"` without the test. A red guard is information, not an obstacle.
