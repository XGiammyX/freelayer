# Pull Request

## Summary

<!-- What does this PR change, and why? Link the issue it addresses. -->

Closes #

## Type of change

- [ ] Documentation / design
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] CI / tooling

## Mandatory checklist

Check every item honestly. Items left unchecked must be explained in the summary. PRs with a dishonestly completed checklist will be closed.

### Verification

- [ ] I ran `pnpm typecheck` and it passes
- [ ] I ran `pnpm test` and it passes
- [ ] I added tests for new behavior
- [ ] I added/updated documentation for this change

### Privacy hard constraints

- [ ] I did **not** add telemetry, analytics, or crash reporting
- [ ] I did **not** add external assets (CDN scripts, remote fonts, remote images)
- [ ] I did **not** log sensitive data (message content, keys, identities, prompts) in plaintext
- [ ] I did **not** introduce a dependency on a FreeLayer-owned or otherwise required backend
- [ ] I did **not** weaken any Privacy Mode or bypass the core policy engine

### Security

- [ ] I considered the security risks of this change (state them below if non-trivial)
- [ ] I updated [THREAT_MODEL.md](../docs/THREAT_MODEL.md) / [PRIVACY_MODEL.md](../docs/PRIVACY_MODEL.md) / [PBOM.md](../docs/PBOM.md) if this change affects them
- [ ] This PR does **not** touch key material, cryptography, or identity storage — or, if it does, I have read [docs/CONTRIBUTING_SECURITY.md](../docs/CONTRIBUTING_SECURITY.md) and requested code-owner review

## Security considerations

<!-- "None" is acceptable only for pure docs/tooling changes. Otherwise, describe
     the threat surface this change touches and why it is safe. -->

## Notes for reviewers

<!-- Anything that makes this easier to review: design decisions, trade-offs, follow-ups. -->
