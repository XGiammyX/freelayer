# FreeLayer Documentation Index

Everything is public and versioned. Statuses are honest: most of what these documents describe is **design, not implemented software** — the [Trust Center](TRUST_CENTER.md) is always the source of truth for what actually exists.

## Start here

- [FreeLayer in plain English](PUBLIC_EXPLANATION.md) — what this project is, with no jargon.
- [Trust Center](TRUST_CENTER.md) — can you trust FreeLayer today? (No — and here is exactly why.)
- [Roadmap](ROADMAP.md) — phases, tracks, and what "done" means for each.
- [Public Comparison](PUBLIC_COMPARISON.md) — how FreeLayer's direction differs from existing tools, respectfully.
- [Glossary](GLOSSARY.md) — every term in one table: simple meaning, technical meaning, real status.
- [Project Positioning](PROJECT_POSITIONING.md) — what FreeLayer is, is not, and for whom.
- [Contributor Tasks](CONTRIBUTOR_TASKS.md) — concrete ways to help right now.

## Architecture

- [Architecture](ARCHITECTURE.md) — layering, the non-bypassable rules, and the operation pipeline.
- [Privacy Model](PRIVACY_MODEL.md) — the seven privacy modes and the strictest-policy-wins rule.
- [Threat Model](THREAT_MODEL.md) — attackers, assets, and what FreeLayer honestly cannot protect against.
- [Metadata Model](METADATA_MODEL.md) — the leaks beyond message content, and what reduces them.
- [Storage Model](STORAGE_MODEL.md) — the write barrier: nothing persists without policy approval.
- [Network Model](NETWORK_MODEL.md) — blind couriers, the network barrier, and no required infrastructure.
- [Endpoint Defense Model](ENDPOINT_DEFENSE_MODEL.md) — protecting data after decryption: screen, clipboard, capture.
- [ScreenShield](SCREENSHIELD.md) — the user-facing protection levels, from `off` to `bunker`.
- [Device Risk Model](DEVICE_RISK_MODEL.md) — local-only risk signals and what they change.
- [Data Leakage Model](DATA_LEAKAGE_MODEL.md) — every leakage channel in one map.
- [Protected Content Policy](PROTECTED_CONTENT_POLICY.md) — sensitive content renders through one guarded door.
- [Platform Limitations](PLATFORM_LIMITATIONS.md) — per-platform truth about capture protection.
- [Accessibility / Privacy Trade-offs](ACCESSIBILITY_PRIVACY_TRADEOFFS.md) — where security and accessibility tension is real, and how it's decided.

## Core systems

- [CapsuleNet](CAPSULENET.md) — sealed capsules, hostile-input parsing, and the blind-courier rules.
- [Sovereign Rooms](SOVEREIGN_ROOMS.md) — rooms as private operational spaces; the sync-model decision.
- [Crypto Design](CRYPTO_DESIGN.md) — the rules under which cryptography will (eventually) be written.
- [Local AI](LOCAL_AI.md) — local-only, disabled-by-default AI and its gates.
- [PBOM](PBOM.md) — the Privacy Bill of Materials: everything the software actually does.

## Contributing and security

- [Contributing](../CONTRIBUTING.md) — process, standards, and the hard lines.
- [Contributing (security-sensitive)](CONTRIBUTING_SECURITY.md) — stricter rules for crypto/privacy/storage paths.
- [Security Review Checklist](SECURITY_REVIEW_CHECKLIST.md) — what reviewers verify on every sensitive PR.
- [Implementation Gates](IMPLEMENTATION_GATES.md) — the checkpoints that block implementation until design is done.
- [Dependency Policy](DEPENDENCY_POLICY.md) — when a dependency may be added, and how it is reviewed.
- [No External Assets Policy](NO_EXTERNAL_ASSETS_POLICY.md) — why the apps contact no third party, ever.
- [ADRs — the project constitution](adr/README.md) — the binding decisions (ADR-0001 … ADR-0012).
- [Security policy](../SECURITY.md) — how to report vulnerabilities privately.

## Infrastructure and audits

- [GitHub Repository Setup](GITHUB_REPOSITORY_SETUP.md) — how the repo is configured and protected.
- [GitHub Security Settings](GITHUB_SECURITY_SETTINGS.md) — per-setting verified checklist.
- [GitHub Actions Audit](GITHUB_ACTIONS_AUDIT.md) — workflows, permissions, third-party actions.
- [GitHub Live Audit](GITHUB_LIVE_AUDIT.md) — latest live health check of the public repository.
- [Live CI Report](LIVE_CI_REPORT.md) — first live validation record.
- [Installation](INSTALLATION.md) — development setup (there is nothing to install as a user yet).
- [License (docs)](LICENSE-DOCS.md) — CC BY-SA 4.0 for documentation.
