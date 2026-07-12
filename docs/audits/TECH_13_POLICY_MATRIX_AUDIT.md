# TECH-13 — Policy Matrix v1 Audit

_Branch: `tech/policy-matrix-v1` · Base: `main` @ `79af52b` (TECH-12 merged) · Date: 2026-07-10._

## Commands run

`pnpm typecheck` · `lint` · `test` · `build` · all guardrails (`check:boundaries`, `no-external-assets`, `no-telemetry`, `no-forbidden-storage`, `no-forbidden-network`, `build-zero-egress`, `no-network-deps`, `no-metadata-bypass`, `no-notification-bypass`) · **`check:policy-matrix`** · **`check:policy-docs`** · `check:doc-links` · `audit:privacy` · `audit:supply-chain` · `test:coverage`. All green.

## Precheck

TECH-10/11/12 all `present`; nothing missing had to be built. → [TECH_13_PRECHECK.md](TECH_13_PRECHECK.md).

## Research summary

NIST ABAC (attribute-based decisions as explicit rules — implemented as a typed table, deliberately no OPA/XACML/DSL); OWASP ASVS (every claim maps to a test; fail-closed); W3C Permissions Policy (capability map declared separately from feature code); privacy-by-design (deny/null-route metadata by default); deny-overrides composition reasoning; and a full internal policy review (no contradictions found — TECH-10/11/12 integration tests had forced agreement; missing explicit rows added: update checks, SW network, badge dot, watermark state, EDL gates, Tauri permissions). → [../research/POLICY_MATRIX_RESEARCH.md](../research/POLICY_MATRIX_RESEARCH.md). Threat model → [TECH_13_POLICY_MATRIX_THREAT_MODEL.md](TECH_13_POLICY_MATRIX_THREAT_MODEL.md). (Live internet unavailable → verification-pending marker.)

## Matrix

- **94 specs → 658 rules** across **7 modes × 12 domains** (storage 12, network 12, metadata 17, link_preview 6, external_asset 12, notification 13, ai 7, endpoint 9, crypto/capsule/room/identity 6 deferred specs).
- `evaluatePolicyMatrix`: Map lookup, fail-closed (`unknown_input` → deny), ScreenShield/device-risk tightening on shield-marked rows, tighten-only room composition.
- Composition helpers: `combinePolicyEffects` / `isEffectStricterThan` / `applyStrictestPolicy` with the explicit strictness order (deny strictest; `future_gate`/`not_implemented`/`require_user_action` are NOT allow; empty input fails closed; unknown effect treated as deny).
- **v1 invariants:** every rule `persistentAllowed=false`, `networkAllowed=false`.
- The validator caught one real defect during development (websocket/webrtc operation-key collision) — fixed by unique operations.

## Validation

- `scripts/validate-policy-matrix.mjs` (zero-dep, works from the JSON export): unique ids, no duplicate mode/domain/operation keys, required fields, effect/reason validity, docsRefs existence, deferred-domain gating, always-forbidden behaviors never allowed, per-mode major-domain coverage, Ghost/Bunker persistent-sink and Offline-network hard checks. **PASS** (94 specs → 658 rules).
- `scripts/check-policy-docs-consistency.mjs`: artifact existence + stable doc mentions. **PASS.**
- JSON export mirrors the TS specs **verbatim** — drift-proof via `tests/security-regression/policy-matrix/`.

## Integration coverage (all agree, test-enforced)

StoragePolicy (Ghost/Bunker persistence, preview caches) · NetworkPolicy (Offline denial, telemetry/preview always-forbidden) · MetadataPolicy (receipts/typing/presence across all modes) · LinkPreviewPolicy (automatic preview) · ExternalAssetPolicy (4 asset kinds × all modes) · NotificationPolicy (push, message preview, and the one allowed in-app path) · ScreenShield hooks (reveal persistence).

## Tests added

34 new (320 total): structure/uniqueness/coverage, fail-closed, composition (deny-overrides, future_gate≠allow, strictest-wins, unanimity), room/shield/emergency tightening, per-mode invariants, deferred gates, cross-engine agreement, JSON sync, validator pass, sentinel-freedom (decisions never echo hostile input), docsRefs integrity.

## Known limitations

A living contract, not formal verification — proves declared-rule↔engine consistency, not crypto/protocol correctness. Engines keep their own tables (matrix oracles them; deriving one from the other is Gate B work). Agreement tests cover critical rows exhaustively, not every input product (TECH-14 broadens). Same-realm hostile code, anonymity, and forensic guarantees remain out of scope; all deferred gates and accepted limitations preserved.

## Verdict

**TECH-13 is complete.** All acceptance criteria met; all local checks green. Recommended next prompt: **TECH-14 — Policy Conflict Regression Suite**.
