# ADR-0008: No external assets or telemetry

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

Two of the most common privacy erosions in modern software arrive as conveniences: external assets (CDN scripts, hosted fonts, remote images) that leak IPs and fingerprints to third parties on every launch, and telemetry ("anonymous", "opt-out", "just crash reports") that normalizes data flowing from user devices to developers. Both are cheap to add and politically hard to remove. FreeLayer forbids them before the first feature exists.

## Decision

1. **No external assets, by default, in any FreeLayer app**: no CDN scripts, no external stylesheets, no remote fonts, no hotlinked images, no third-party embeds. All assets ship in the bundle. This applies to `apps/web`, `apps/desktop`, `apps/docs`, and any future app.
2. **No telemetry, by default and by design**: no analytics, no crash reporting, no usage statistics, no "anonymous metrics", no phone-home of any kind. There is no opt-out telemetry because there is nothing to opt out of.
3. **No automatic link previews.** Link previews are off by default in every mode; where a mode permits them at all, fetching is explicit and per-click, never automatic.
4. Remote avatars and similar "fetch on display" patterns are forbidden; such content travels as capsule content (ADR-0003).
5. These rules are **enforced in CI** (privacy-regression workflow: telemetry-dependency and external-asset guards) and in review (PR checklist), not just documented.

## Consequences

- Fonts, icons, and libraries are bundled and versioned locally; bundle size is paid honestly.
- The project develops without usage data; product decisions rely on explicit user feedback and public discussion. Accepted.
- Debugging user issues is harder without crash reports; reproduction and user-initiated diagnostics fill the gap.

## Security impact

- No third-party script execution surface in any app; supply-chain exposure narrows to build-time dependencies (reviewed via Dependabot/dependency-review).
- No telemetry endpoint means no telemetry credential, pipeline, or stored dataset to compromise.

## Privacy impact

- Launching or using FreeLayer generates zero third-party network contact by default.
- User IPs, fingerprints, and usage patterns are not exposed to CDNs, font services, or analytics providers — structurally, not by configuration.

## What would require a new ADR

- Any external asset, however convenient, in any app.
- Any telemetry, metrics, or crash-reporting mechanism, including opt-in.
- Automatic link previews in any mode.
- Any exception "just for the docs site" or "just for development builds that ship".
