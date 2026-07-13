# TECH-20 — Membership + Capability Threat Model

_Scope: local unverified membership + non-authoritative capability scaffolding. Extends [TECH_19_QUERY_MODEL_THREAT_MODEL.md](TECH_19_QUERY_MODEL_THREAT_MODEL.md)._

## Fake identity and authority

Forged member reference; guessed membership ID; placeholder role treated as authentication; object creator treated as verified owner; a local actor labelled "self" without verification; owner role presented as cryptographic ownership. **Mitigation:** member refs are opaque placeholders (`verification: "unverified_placeholder"` always); IDs/refs/roles confer **no authority**; owner-placeholder is documented as NOT cryptographic ownership; only an authentic exact-scope `PolicyDecision` authorizes.

## Privilege escalation

Viewer changes role; editor manages membership; a role change widens capability without authorization; capability wildcard; forged descriptor; stale descriptor after suspension/removal; a room capability used in another room; an object-scoped capability used globally; a policy-tightening capability used to loosen policy. **Mitigation:** explicit role→capability eligibility table (viewer/editor cannot manage membership; auditor gets no content); no wildcard capability exists; descriptors bind room+membership+revision and reject when stale/cross-room; attenuation only narrows; `room.policy.loosen` is not a capability.

## Ambient authority and confused deputy

Global current-member/current-room state; an app importing the internal membership mutator; a helper using a caller-selected role; a membership ID alone authorizing access; a broad owner helper doing unintended side effects. **Mitigation:** no ambient authority — every operation passes an explicit `RoomAuthorizationContextV1` (current membership + current descriptor + authentic decision); apps cannot import rooms (boundary guard); the guardrail forbids role-string authorization outside the membership package and caller-controlled trust fields.

## Membership lifecycle

Duplicate active membership; multiple records for the same room/member; a removed membership reactivated; the last active owner removed/suspended/demoted; a membership update after tombstone; a stale-revision overwrite; a cross-room membership mutation. **Mitigation:** one active record per room/member (reducer rejects duplicates); explicit lifecycle machine (tombstone terminal, no resurrection); expected-revision required (stale/future reject); the last-active-owner continuity invariant blocks removal/suspension/demotion; the pipeline rejects room mismatches.

## Capability descriptors

Descriptor treated as a bearer token; serialized or persisted; delegated; widened; reused after a membership-revision change; accepted without an authentic decision; carrying sensitive room/member metadata. **Mitigation:** `authoritative: false` / `serialization: "forbidden"` / `delegation: "not_implemented"` / `persistence: "forbidden"` are structural; matrix rows deny persistence/serialization and not-implement delegation; currency binding rejects revision drift; `assertRoomAuthorizationContextV1` always requires an authentic exact-scope decision; the descriptor carries only refs/ids/role, no content.

## Privacy

Membership list exposes the relationship graph; roles expose room structure; counts expose activity; timestamps expose joining/removal patterns; audit exposes member references; an error exposes the target member or role. **Mitigation:** redacted views suppress membership IDs/refs/revisions/timestamps in strict modes; counts are off by default behind their own scope; audit records only category/mode/reason/`redacted=true`; errors are codes only (sentinel-tested).

## Future distributed-system

Local revocation described as global; concurrent role changes unresolved; a remote replica accepting stale membership; no authenticated event authorship; no membership-signature chain. **Mitigation:** local revocation is explicitly NOT distributed revocation (documented); concurrency is a single-projection optimistic-revision guard, not distributed conflict resolution (Gate H); events are local, unsigned, unencrypted and stated as such.

## Endpoint separation

A device-risk placeholder granting authority; ScreenShield status treated as identity assurance; anti-spyware added to the membership package. **Mitigation:** `deviceRiskLevel` can only TIGHTEN capability resolution (critical risk drops mutations) and is never a safety attestation; `endpointIntegration` can never be `active`; the guardrail + import-hygiene test forbid monitoring dependencies.

## Limits (stated plainly)

Membership is local and unverified; capabilities are non-authoritative descriptors; no cryptographic ownership; no distributed revocation; no verified identity; no endpoint protection; not safe for real secrets.
