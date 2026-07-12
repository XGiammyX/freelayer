# TECH-14 — Policy Conflict Threat Model

_Scope: how policy layers can contradict each other, and what the regression suite does (and cannot do) about it. Extends [../THREAT_MODEL.md](../THREAT_MODEL.md)._

## Cross-policy contradictions

An engine allowing what the matrix denies (Storage persistence, Network egress, Metadata signals, LinkPreview fetches, ExternalAsset loads, Notification push) — or two engines disagreeing with each other (Metadata allowing a notification preview NotificationPolicy denies; an AI hook allowing what StoragePolicy's AI-cache denial forbids; an endpoint hook treated as implemented although the anti-spyware project is external). **Mitigation:** table-driven outcome comparisons for every critical row across all 7 modes; `assertExternalizedHookOnly` for endpoint capabilities; the `check:policy-conflicts` validator re-checks the exported matrix on every CI run.

## Enforcement contradictions

A `PolicyDecision` scoped to the wrong side effect; a denied decision treated as allow; `future_gate`/`not_implemented` executed; `require_user_action` honored without user action; unknown operation/sink/mode falling through to allow. **Mitigation:** the barriers' exact-scope checks (TECH-05/08/10/12) already reject these at runtime; the conflict suite adds matrix-level proofs (`assertNotExecutableEverywhere`, unknown-input sweeps across matrix AND engines).

## Composition contradictions

Room policy loosening a device mode; a permissive Standard room weakening Ghost/Bunker; feature context loosening a mode; Emergency failing to override; Offline Capsule reachable network via the transport placeholder; externalized endpoint-defense claiming active protection. **Mitigation:** tighten-only composition proofs per mode; Emergency-override and Offline-polling tests; the externalization category + audit.

## Documentation contradictions

PBOM saying "not implemented" while a dependency exists; Trust Center claiming untested protection; Roadmap saying deferred while code enables; docs claiming anti-spyware is integrated when it is external; "no network" claims with remote URLs in build. **Mitigation:** dependency scan (endpoint-monitoring/push packages banned), Trust Center overclaim scanner (negation-aware), docs-statement checks, and the existing zero-egress/build scanners.

## Test contradictions

Two tests asserting opposite outcomes; stale coverage claims; a scanner allowlist hiding a real source directory; fixtures accidentally excluded from detection. **Mitigation:** conflicts are compared through ONE oracle (the matrix), so opposite assertions collide; fixtures live outside shipped scan roots and are spawn-tested both ways (FAIL on fixture, PASS on real source); allowlists are narrow and their fixture dirs are proven detectable.

## Limits (stated plainly)

- A **regression suite, not formal verification** — it prevents known contradiction classes from returning; it does not enumerate every input product or prove the whole system.
- It does not solve deferred gates and does not implement endpoint defense.
- It does not defend against same-realm hostile code beyond existing `PolicyDecision` limitations.
- It provides no anonymity or forensic guarantees.
