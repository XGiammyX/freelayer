# ADR-0001: No project-owned infrastructure

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** @maintainers

## Context

Centralized communication platforms concentrate risk at their operator: a server that routes messages and stores accounts can be breached, subpoenaed, pressured, monetized, or shut down. Every privacy promise such a platform makes is bounded by the operator's ability and willingness to keep it. FreeLayer's founding premise is to remove that bound by removing the operator.

## Decision

FreeLayer will **never require infrastructure owned, operated, or controlled by the FreeLayer project**. Specifically and permanently:

1. No FreeLayer-owned backend, API server, or cloud service.
2. No central user database, account system, or directory service.
3. No required server of any kind controlled by the project or its maintainers.
4. No recovery mechanism that routes through a central server.
5. No push-notification, update, or discovery service that the software depends on by default.
6. Optional networked components (e.g. `apps/relay`) must be: self-hostable by anyone, untrusted by the protocol, replaceable by non-networked transports, and never preconfigured as a default endpoint operated by the project.

The software must remain fully functional — for some definition of transport (QR, file, USB, LAN) — if every server on the internet associated with FreeLayer disappears.

## Consequences

- Delivery is best-effort and asynchronous; availability is weaker than centralized systems. Accepted openly.
- Spam and abuse control cannot rely on a central authority; this is a hard, ongoing design problem ([CAPSULENET.md](../CAPSULENET.md)).
- Key or data loss cannot be fixed by "contact support" — recovery-kit design carries that weight.
- Any feature proposal that "just needs a small server" must be redesigned to work without one, or rejected.

## Security impact

- There is no central breach target, no aggregate data store to exfiltrate, and no operator credential whose compromise affects all users.
- Security burden shifts to the supply chain (releases, dependencies, CI) — addressed by ADR-0009 and the Trust Center roadmap.

## Privacy impact

- The project structurally cannot collect user data, because it operates nothing that could receive it.
- No entity can be compelled to hand over user data the project never holds.
- Residual exposure moves to user-chosen transports and relays, which are documented as untrusted ([THREAT_MODEL.md](../THREAT_MODEL.md)).

## What would require a new ADR

- Any component that contacts a project-controlled endpoint, even optionally.
- Any default-configured server, relay list, directory, or bootstrap node operated by the project.
- Any hosted "official instance" positioned as the normal way to use FreeLayer.
- Any recovery, sync, or notification mechanism involving project infrastructure.
