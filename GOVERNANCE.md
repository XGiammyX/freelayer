# Governance

## Current stage

FreeLayer is an **early-stage project** governed by a small group of founding maintainers (referenced as `@maintainers` in [.github/CODEOWNERS](.github/CODEOWNERS)). Governance is intentionally lightweight now and will be formalized as the contributor base grows.

## Maintainers

- Maintainers merge PRs, triage issues, own releases, and act as security contacts.
- The current maintainer list is the set of accounts with write access to this repository. A public `MAINTAINERS` list will be added when the team grows beyond its founders. *(TODO)*

## Decision process

- **Day-to-day decisions** (docs, tooling, non-sensitive code): lazy consensus — a PR approved by one maintainer may be merged after the review window.
- **Significant design decisions**: proposed as an issue or design-doc PR, discussed publicly, decided by maintainer consensus. Rationale must be recorded in the relevant `docs/` file.
- **Disagreements**: resolved by maintainer majority; ties are broken by the founding maintainer. This is an explicit early-stage compromise, listed for replacement below.

## Security-sensitive changes (elevated review)

The following classes of change require **at least two maintainer approvals**, one of which must come from a code owner of the affected path, and may not be self-merged by their author:

1. **Cryptography** — anything under `packages/crypto/` or changing [docs/CRYPTO_DESIGN.md](docs/CRYPTO_DESIGN.md). Custom primitives are not accepted; substantive crypto changes additionally require documented external review before being marked trusted.
2. **Privacy policy semantics** — changes to Privacy Modes, the metadata firewall, or [docs/PRIVACY_MODEL.md](docs/PRIVACY_MODEL.md) that relax any guarantee.
3. **Key and identity handling** — anything touching key material, identity storage, or recovery flows.
4. **Dependency changes** — adding or updating dependencies in security-relevant packages (`crypto`, `security`, `privacy`, `storage`, `capsules`, `rooms`). New dependencies require a stated justification and a look at maintenance health, transitive footprint, and install scripts.
5. **CI/workflow changes** — `.github/workflows/` modifications, since CI is part of the supply chain.

## What maintainers may never do

Consistent with the project's hard constraints, no maintainer decision can introduce: a required FreeLayer-owned backend, a central user database, telemetry-by-default, an admin backdoor or remote-control mechanism, or private key upload. Removing these constraints would require public discussion, a documented amendment to this file, and should be treated by users as a fork-worthy event.

## Future governance (TODO)

- [ ] Publish a `MAINTAINERS` file with real identities/keys
- [ ] Define a contributor → committer → maintainer promotion path
- [ ] Establish a security response team distinct from general maintainers
- [ ] Adopt a formal RFC process for protocol-level changes
- [ ] Define release signing and key ceremony procedures
- [ ] Evaluate fiscal hosting / foundation stewardship once the project matures
