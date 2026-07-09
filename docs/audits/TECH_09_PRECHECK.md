# TECH-09 Precheck — TECH-05/06/07/08 Baseline

_Date: 2026-07-09 · Baseline commit: `daae3a7` (main, all green, 0 open PRs)_

Statuses: `present` · `partial` · `missing` · `blocked` · `not applicable`

| Baseline | Item | Status |
| --- | --- | --- |
| TECH-05 | StoragePolicy v0 + write barrier + storage guardrails + docs/PBOM | present |
| TECH-06 | Hardened Memory/Null providers, redacted errors, sentinel leak tests, research | present |
| TECH-07 | Ghost/Bunker zero-persistent-write checks, runtime persistent-write trap, static forbidden-storage scan, audit | present |
| TECH-08 | NetworkPolicy v0, `NetworkRequest` taxonomy, network side-effect kinds, default-deny resolver, decision enforcement, Mock/Noop transports, forbidden-network guardrail, runtime network trap, metadata leakage labels, docs/PBOM/Trust Center, audit | present |

## Reusable foundations TECH-09 builds on

- `scripts/check-no-forbidden-network.mjs` (extend with CLI modes + build/host awareness).
- `scripts/check-no-external-assets.mjs` (improve into a fuller remote-asset scanner in place).
- `tests/helpers/network-trap.ts` (extend into a zero-egress runtime trap).
- `resolveNetworkPolicy` / mock transports (import under the trap to prove no egress).
- The `apps/web` Vite build produces `apps/web/dist`; `apps/docs` is a static placeholder (`index.html`, no build step).

## Build-reality finding (grounds the scanner design)

The production `apps/web` bundle contains, **inertly**: React DOM's own `fetch(` / `createElement('script')` / `.src=` (its resource/preload APIs, never triggered by our app), plus benign URL **strings** — `www.w3.org` (XML/SVG namespaces), `react.dev` (error-decoder links in messages), and `github.com` (our navigation anchors). **None are automatic egress.** Consequence: token-scanning minified framework code for `fetch(` is not a valid egress signal. Zero-egress-on-load is verified by (a) the runtime trap, (b) scanning authored HTML/CSS for remote assets, and (c) a remote-**host** allowlist — see [ZERO_EGRESS_RESEARCH.md](../research/ZERO_EGRESS_RESEARCH.md).

**Conclusion:** no missing dependency. TECH-09 is additive.
