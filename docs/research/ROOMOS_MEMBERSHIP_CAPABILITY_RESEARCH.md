# RoomOS Membership + Capability — Research Note (TECH-20)

_Date: 2026-07-13. Informs the local membership model, placeholder roles, and non-authoritative capability descriptors._

> [!NOTE]
> **Source verification pending: internet unavailable in this environment.** The concepts below are stable, widely-documented knowledge (author cutoff 2026-01). Re-confirm current specifics (esp. NIST SP 800-162, OWASP, Zanzibar) against primary sources before external citation.

## 7.1 NIST ABAC (SP 800-162)

**Summary:** authorization considers SUBJECT, OBJECT, OPERATION, and ENVIRONMENT attributes evaluated against policy — enabling controlled information sharing without static role lists.

**Adopted:** RoomOS authorization considers more than a role — membership state, room relationship, requested operation, object kind/sensitivity, room policy, privacy mode, lifecycle, and a device-risk placeholder. **A role is ONE attribute, never the whole decision**; `resolveRoomLocalCapabilityV1` composes role eligibility with mode + room policy tightening.

## 7.2 OWASP authorization guidance

**Summary:** least privilege, deny-by-default, authorize EVERY operation at a trusted enforcement point, object-level checks, guessed-ID resistance, prefer ABAC/ReBAC, fail safely, test with regressions.

**Adopted:** every membership/query/mutation requires authorization; room/member/object/membership IDs confer **no authority**; access is checked against the exact room + operation; unknown rules deny; failures never leak membership data (codes only); 74 regression tests.

## 7.3 Relationship-based authorization (Google Zanzibar, prior art)

**Summary:** subject-relation-object tuples resolved by a centralized service; consistency + stale-permission concerns; object-specific checks.

**Adopted:** a membership IS a room-member relationship belonging to ONE room; the current membership revision matters; relationship checks are room/object-specific. **Explicitly rejected:** *"FreeLayer must not implement a centralized Zanzibar-style authorization service, global relationship database, or network authorization dependency."* Everything is one local projection.

## 7.4 Object-capability + least authority

**Summary:** least authority, no ambient authority, explicit authority references, attenuation, revocation, confused-deputy risk, forgery/transfer risk.

**Adopted:** no wildcard authority; no ambient global "current owner"; capability **descriptors** are narrow and may only be ATTENUATED (never widened); they are **non-authoritative, non-unforgeable, non-transferable** — they never authorize a side effect on their own. A real capability runtime (tokens/construction authority) remains **Gate B**; only an authentic exact-scope `PolicyDecision` authorizes.

## 7.5 Local-first membership concerns

**Summary:** local copies, concurrent membership changes, offline revocation, awareness/presence separation, conflict resolution.

**Adopted:** TECH-20 membership is ONE local projection; revocation is LOCAL only (removing/changing a membership invalidates descriptors bound to the older revision in THIS projection — it does not revoke unknown remote copies); presence/awareness is a separate, absent concern; distributed membership semantics remain **Gate H**.

## 7.6 FreeLayer internal review

Reviewed `packages/rooms` (state/objects/query/policy), Policy Matrix, `PolicyDecision`, PBOM, Trust Center, Sovereign Rooms + Identity Firewall + Endpoint Defense docs. Findings:

- The existing `RoomMemberSummary.role` uses placeholder role literals but never as authority — TECH-20 formalizes roles as ABAC attributes with an explicit role→capability eligibility table (no scattered `if (role === ...)` authorization).
- No global owner/admin flags, no wildcard permissions, no direct membership-array mutation exist.
- No identity/endpoint overclaims exist; `endpoint_hook_ref` stays placeholder-only.
- To avoid destabilizing the TECH-17 event union, membership events use a dedicated `RoomMembershipEventV1` envelope + parallel memory/null log (same precedent as TECH-18/19).

## Adopted / rejected / deferred

**Adopted:** ABAC-style evaluation; deny-by-default; explicit role→capability table; non-authoritative attenuable descriptors bound to room+membership+revision; local-only revocation; last-owner continuity; memory/null retention. **Rejected:** centralized authz service; global relationship DB; JWT/macaroon/UCAN/DID/OpenFGA/SpiceDB/OPA dependencies; wildcard capabilities; bearer tokens; capability serialization/persistence/delegation; role-only authorization. **Deferred:** capability-token runtime + construction authority (Gate B); external membership/invite parsing + wire format (Gate E); signed/encrypted membership + revocation certs (Gate F); verified identity + invites + recovery (Gate G); synchronized membership + distributed revocation + CRDT (Gate H); endpoint integration (Gate R).

## Known limitations

Membership is local and unverified; capabilities are non-authoritative descriptors; no cryptographic ownership; no distributed revocation; no verified identity; no endpoint protection; not safe for real secrets.

## TODOs for Gate B and Gate G

Gate B: route capability minting through a core construction-authority token; narrow public exports so the pipeline/policies are unreachable without a capability. Gate G: bind VERIFIED identity to membership without weakening current local policy (identity is additive, never authority-granting on its own).
