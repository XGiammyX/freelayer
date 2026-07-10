# Pull Request

## Summary

<!-- What does this PR change, and why? Link the issue it addresses. -->

Closes #

## Type of change

- [ ] Documentation / design
- [ ] Tests only
- [ ] Policy change (Policy Matrix / resolvers)
- [ ] Security/privacy change
- [ ] Dependency change
- [ ] Feature-gated design (ADR/gate work)
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] CI / tooling
- [ ] Audit / research update

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

### Privacy/security impact (answer yes/no; any "yes" requires the matching updates below)

- Does this add any **network** behavior?
- Does this add any **storage** behavior?
- Does this add any **metadata-producing** behavior (receipts/typing/presence/timing/size)?
- Does this add **notification** behavior?
- Does this add **link preview / external asset** behavior?
- Does this add **AI** behavior?
- Does this touch **endpoint-defense / anti-spyware hooks**?
- Does this change any **user-facing guarantee**?

### Required updates (for any behavior/guarantee change)

- [ ] Tests updated (incl. conflict regression where a policy row changed)
- [ ] [Policy Matrix](../docs/POLICY_MATRIX.md) spec + `docs/policy-matrix.v1.json` mirror updated
- [ ] [PBOM](../docs/PBOM.md) updated
- [ ] [Trust Center](../docs/TRUST_CENTER.md) updated
- [ ] Relevant model doc updated
- [ ] Threat model updated (if the threat surface changed)
- [ ] ADR/gate updated (if a gated decision is involved)
- [ ] Audit note updated (if an audit's facts changed)

### Anti-spyware boundary

> This PR does **not** implement anti-spyware / Endpoint Defense / ScreenShield native behavior in FreeLayer core.
> If it touches endpoint-defense hooks, it keeps them **hook-only and integration-gated** (Gate R).

- [ ] I confirm the statement above

### Commands run

<!-- Paste the output summary of `pnpm check:all` (or the individual required commands from docs/CONTRIBUTOR_WORKFLOW.md §7). -->

```text

```

## Security considerations

<!-- "None" is acceptable only for pure docs/tooling changes. Otherwise, describe
     the threat surface this change touches and why it is safe. -->

## Notes for reviewers

<!-- Anything that makes this easier to review: design decisions, trade-offs, follow-ups. -->
