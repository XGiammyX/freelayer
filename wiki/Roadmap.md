# Roadmap

*Summary — the canonical version with exit criteria is [ROADMAP.md](https://github.com/XGiammyX/freelayer/blob/main/docs/ROADMAP.md).*

No dates, deliberately: privacy/security software should not be rushed, and implementation is blocked behind [gates](https://github.com/XGiammyX/freelayer/blob/main/docs/IMPLEMENTATION_GATES.md) that schedules cannot override.

## The twelve steps

1. **Foundation and public repo** ✅ — constitution (12 ADRs), monorepo, guardrails, live CI
2. **Policy engine** — the rules system that everything else obeys
3. **Storage/network/metadata guardrails** — write barrier, zero-egress, signal control
4. **Endpoint defense / ScreenShield** — research done ✅, implementation staged
5. **Identity without phone/email** — local identities, invites, QR verification
6. **Encrypted capsules** — wire format, hostile-input parser, fuzzing (after crypto review)
7. **Messaging MVP** — 1:1 over capsules, at least two transports
8. **Sovereign Rooms** — the room object model and sync
9. **Documents/files** — protected documents, file capsules
10. **Local AI** — optional, on-device, off by default
11. **Security hardening** — fuzzing, regression suites, SBOM, platform hardening
12. **Alpha** — signed, honestly labeled experimental

## Work categories

- **TECH** — product engineering (next up: TECH-05, Storage Policy + Write Barrier Hardening)
- **INFRA** — repository/CI/publication (INFRA-01/02 done ✅)
- **RESEARCH** — architecture research before implementation (RESEARCH-EDL-01 done ✅)
- **AUDIT** — regression suites and audits
