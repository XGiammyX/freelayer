# ADR Workflow

[← Docs Index](README.md) · [ADRs](adr/README.md) · [Implementation Gates](IMPLEMENTATION_GATES.md)

## When an ADR is required

Any decision that binds the project: new hard constraint, new/changed privacy guarantee, opening a deferred gate, or any of these concrete cases — **crypto library selection · encrypted persistent storage · any real network transport · identity model · room sync model · Capsule wire format · push notifications · remote AI · endpoint-defense / anti-spyware integration (Gate R)**. If a PR would change what the constitution allows, it needs an ADR first.

## Process

1. Copy [adr/ADR-TEMPLATE.md](adr/ADR-TEMPLATE.md) → `docs/adr/ADR-NNNN-short-kebab-title.md` (next number; existing files show the convention).
2. Status starts `proposed`. Statuses: `proposed` · `accepted` · `rejected` · `superseded` · `deferred`.
3. Open a PR containing only the ADR (plus any research note). Discussion happens on the PR.
4. On acceptance: update [adr/README.md](adr/README.md), the relevant gate in [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md), and only then start implementation (tests-first).
5. Superseding: new ADR links the old one; the old one gets `superseded`, never deleted.

## Required sections

Context · Decision · Alternatives considered · Risks · **Privacy impact** · **Security impact** · **PBOM impact** · **Trust Center impact** · Tests required · Rollback. An ADR that skips the privacy/PBOM sections is incomplete by definition.

## Anti-spyware note

The endpoint-defense integration ADR (Gate R) additionally requires: reference to the standalone anti-spyware project, integration boundary, native permissions enumeration, per-platform limits, and explicit non-overclaim language ([audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md](audits/ANTISPYWARE_EXTERNALIZATION_AUDIT.md)).
