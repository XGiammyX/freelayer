# @freelayer/ui

**Status: minimal local-only components implemented — Badge, Card, WarningBanner, PillarList, StatusPanel. Inline styles, system font stack, zero external assets.**

Shared UI components: Tailwind CSS, shadcn/ui-compatible structure, used by `apps/web` and `apps/desktop`.

Constraints: no external assets of any kind (fonts bundled locally, no CDN imports); components display policy state honestly (e.g. mode indicators must reflect core policy, never local component state).
