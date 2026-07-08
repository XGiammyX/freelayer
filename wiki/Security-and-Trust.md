# Security and Trust

## Can I trust FreeLayer today?

**No. Not with real secrets.** There is no implemented cryptography, no released software, and no audit. Every security property in the documentation is a design intention, not a verified guarantee. The always-current answer lives in the [Trust Center](https://github.com/XGiammyX/freelayer/blob/main/docs/TRUST_CENTER.md).

## What FreeLayer will never claim

No perfect anonymity. No unbreakable encryption. No forensic erasure. No spyware-proof screens. No impossible-to-stop communication. These phrases are **review-blockers** in this project — honest language is enforced, not just encouraged.

## What is honestly out of scope

- **Compromised devices** — malware with sufficient privilege sees what you see.
- **Malicious room members** — encryption cannot protect you from people you invited.
- **Global traffic analysis** — a sufficiently positioned observer can correlate timing and size.
- **Cameras pointed at screens** — physics wins.

Full detail: [Threat Model](https://github.com/XGiammyX/freelayer/blob/main/docs/THREAT_MODEL.md).

## What protects the project itself (verified, live)

- CI on every change: typecheck, lint, tests, build, **four privacy guards** (no telemetry, no external assets, import boundaries, no forbidden storage APIs) and doc-link integrity.
- **CodeQL** static analysis (security-extended), **dependency review**, **Dependabot**, secret scanning + push protection.
- **Branch protection**: PRs with required checks and review; workflow actions pinned by commit SHA.
- A public **[PBOM](https://github.com/XGiammyX/freelayer/blob/main/docs/PBOM.md)** (Privacy Bill of Materials): anything the software does that isn't listed there is treated as a bug.

## Reporting a vulnerability

Privately, please: **Security tab → "Report a vulnerability"** on the repository. Policy: [SECURITY.md](https://github.com/XGiammyX/freelayer/blob/main/SECURITY.md).
