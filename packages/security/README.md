# @freelayer/security

**Status: foundation utilities implemented — branded types, sensitive-value redaction, error taxonomy (PolicyBypassError, HostileInputError, …), audit-event placeholder.**

Hardening utilities shared across packages: input-validation helpers, size/resource limits for hostile input, safe-logging guards (structurally preventing sensitive data in logs), audit hooks, and security regression guards.

Zero-dependency by policy where possible — this package is foundation-layer and depends on nothing else in the workspace.

See [docs/THREAT_MODEL.md](../../docs/THREAT_MODEL.md) and [docs/CONTRIBUTING_SECURITY.md](../../docs/CONTRIBUTING_SECURITY.md).
