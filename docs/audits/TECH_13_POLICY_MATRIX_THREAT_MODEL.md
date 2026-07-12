# TECH-13 — Policy Matrix Threat Model

_Scope: the risks a canonical matrix mitigates — and the ones it introduces. Extends [../THREAT_MODEL.md](../THREAT_MODEL.md)._

## Policy drift threats

One engine says deny while another says allow (Storage vs Metadata, Network vs LinkPreview, Notification vs Metadata); docs claim behavior code doesn't enforce; PBOM says "not implemented" while code ships it; Trust Center claims a test that doesn't exist; Standard mode quietly becomes a loophole. **Mitigation:** the matrix is the single oracle; `tests/privacy-regression/policy-matrix/` asserts *agreement* between the matrix and every concrete engine for the critical rows; `check:policy-docs` pins docs/PBOM/Trust Center mentions; every rule's `docsRefs` must exist (validator + test).

## Policy composition threats

Room policy loosening device policy; feature policy loosening mode policy; ScreenShield conflicting with Storage/Metadata; Emergency failing to override; Offline Capsule permitting network; Ghost persisting metadata; Bunker allowing convenience features. **Mitigation:** composition is tighten-only by construction (`isEffectStricterThan` gate on room effects; `allowed &&` semantics); Emergency/Offline/strict rows are explicit per-mode overrides, all tested; the validator hard-fails any Ghost/Bunker persistent-sink allowance or Offline network allowance.

## Matrix maintenance threats

Duplicated rules diverging; untyped strings drifting; unsupported inputs falling through to allow; a new data class/side-effect kind lacking a row; a feature shipping without a PBOM update; stale coverage claims. **Mitigation:** unique-id + duplicate-key validation; typed effects/reason codes; unmatched lookup → deny (`unknown_input`); JSON↔TS verbatim sync test; CONTRIBUTING_SECURITY now requires matrix+PBOM+doc+test updates in any policy PR. **Residual risk (honest):** a genuinely *new* behavior with no row anywhere still needs a human to add it — the default-deny evaluation contains it at runtime, but review discipline documents it.

## Testing threats

A documented-but-untested row; a test checking the wrong policy; missing cross-policy coverage; a fixture producing false positives; a guardrail allowlist hiding a real source file. **Mitigation:** `testCoverage` is a required, validated field; agreement tests compare *outcomes* of matrix vs engines (not just both-exist); scanner fixtures assert both FAIL-on-bad and PASS-on-clean; allowlists are narrow (policy modules + tests only).

## Limits (stated plainly)

- Policy Matrix v1 is a **living contract, not formal verification** — it proves consistency between declared rules and engines, not correctness of future crypto/protocols.
- It does not open any deferred gate (crypto, sync, identity, push, AI).
- It does not defend against same-realm hostile code beyond the existing `PolicyDecision` scope checks.
- It provides no anonymity or forensic guarantees.
- Agreement tests cover the critical rows exhaustively but not every conceivable input product — TECH-14 broadens this.
