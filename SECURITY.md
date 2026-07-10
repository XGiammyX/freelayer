# Security Policy

> [!IMPORTANT]
> **Found an exploitable vulnerability? Do not open a public issue.** Use GitHub's private reporting: Security tab → "Report a vulnerability". Details below.

## Project status

FreeLayer is in the **research and foundation stage**. There is no released software, no implemented cryptography, and nothing has been audited. **Not ready for real secrets — do not use anything in this repository to protect real communications.** The Endpoint Defense / anti-spyware implementation is **externalized** to a standalone project and is **not active in FreeLayer core** (policy hooks only). No perfect-security claims are made anywhere in this project; overclaims are treated as bugs and machine-scanned (`check:policy-conflicts`).

## Supported versions

| Version | Supported |
| --- | --- |
| — (no releases yet) | Not applicable |

This table will be populated when the first alpha is released.

## Reporting a vulnerability

If you find a vulnerability in this repository (including design flaws in the documented models, CI/workflow weaknesses, or supply-chain issues):

1. **Do not open a public issue** describing an exploitable problem.
2. Report privately via **GitHub Security Advisories** ("Report a vulnerability" on the repository's Security tab). This is the preferred channel.
3. If you cannot use GitHub advisories, open a minimal public issue using the *Security concern* template saying only that you have a sensitive report and how you can be reached — **without technical details**.

Please include, privately:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected files/components,
- any suggested remediation.

## What not to disclose publicly

Until a fix is coordinated: exploit code, reproduction steps for exploitable bugs, key-recovery or deanonymization techniques against the design, and any user-impacting details. Design-level *discussion* (e.g. "the threat model misses X") is welcome in public issues as long as it is not an operational exploit against users.

## Response expectations

> Placeholder — this project is maintained by a small early-stage team.

- Acknowledgement target: within **7 days**.
- Initial assessment target: within **14 days**.
- Coordinated disclosure timeline agreed case by case; we default to 90 days.

## Bounty

There is **no bug bounty program** at this time. Reports are credited in release notes and [docs/TRUST_CENTER.md](docs/TRUST_CENTER.md) unless you prefer anonymity.

## Security limitations (honest statement)

- FreeLayer makes **no claim of absolute anonymity**, unbreakable encryption, or being impossible to block or stop.
- FreeLayer cannot protect users whose devices are compromised.
- Metadata reduction is a goal with documented limits — see [docs/METADATA_MODEL.md](docs/METADATA_MODEL.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
- Until an external audit exists, treat every security property described in `docs/` as a **design intention, not a guarantee**.
