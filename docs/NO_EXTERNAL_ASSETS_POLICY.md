# No External Assets Policy

## Purpose

Make precise what [ADR-0008](adr/ADR-0008-no-external-assets-or-telemetry.md) locks: FreeLayer applications contact no third party by default. "Assets" here means anything fetched from a host the user did not explicitly choose to contact.

## The policy

In every FreeLayer app (`web`, `desktop`, `docs`, and any future app), by default there are:

- **No remote fonts** — fonts ship in the bundle.
- **No CDN scripts** — all JavaScript ships in the bundle, versioned and reviewable.
- **No tracking pixels** — no image beacons, no analytics endpoints of any kind.
- **No remote avatars** — avatars travel as encrypted capsule content, never as URL fetches.
- **No automatic link previews** — where a mode permits previews at all, fetching is explicit and per-click, never automatic.
- **No external CSS** — stylesheets ship in the bundle.
- **No analytics scripts** — there is no "privacy-friendly analytics" exception.
- **No external image fetches** without explicit user action *and* policy approval by core ([ADR-0002](adr/ADR-0002-core-enforced-policy-engine.md)).

## Why

Remote assets are network requests, and every network request leaks: the user's **IP address**, request **timing** (when the app was opened, when a message was read), and **fingerprinting surface** (headers, TLS characteristics, cache behavior) — to a third party the user never chose to trust. A single hosted font turns "opening the app" into an event visible to a font service. A preview fetch turns "reading a message" into an event visible to whoever controls the link. Privacy-first software does not silently contact third parties; when contacting one is genuinely useful (opening a link), it happens visibly, deliberately, and per-action.

This policy also removes an entire supply-chain class: no CDN script means no CDN compromise, no availability dependency, and no silent version drift.

## Enforcement

- **Now:** static CI guards in [privacy-regression.yml](../.github/workflows/privacy-regression.yml) grep app/package sources for known CDN and font hosts; PR review via [SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md) ("Does it load remote assets?").
- **Phase 1:** strict Content Security Policy in app shells (no external `script-src`/`style-src`/`font-src`/`img-src` by default), reviewed as part of Gate A.
- **Phase 10:** runtime verification (see tests below).

## Future tests

- [ ] Grep/static check for remote font/CDN URLs across all app and package sources (exists in basic form; extend host list and file coverage)
- [ ] CSP check: assert every app ships a CSP that forbids external asset origins by default
- [ ] Runtime egress test: instrumented default build performs zero non-user-initiated network requests (Gate D — [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md))

## Exceptions

There is no exception process short of a superseding ADR ([ADR-0008](adr/ADR-0008-no-external-assets-or-telemetry.md)). "Just for the docs site" and "just this one font" are the precedents this policy exists to refuse.
