# Policy Matrix v1

[← Docs Index](README.md) · [Privacy Model](PRIVACY_MODEL.md) · [PBOM](PBOM.md) · [Machine-readable export](policy-matrix.v1.json)

> [!NOTE]
> **The single canonical contract** for what each Privacy Mode permits, denies, redacts, null-routes, memory-limits, future-gates, or marks not implemented. Tests, docs, and the PBOM must agree with this matrix; drift is a bug. It is a typed table and a test oracle — **not** a policy runtime, DSL, or formal-verification proof.

## Purpose and status

FreeLayer has seven policy layers (Storage, Network, Metadata, LinkPreview, ExternalAsset, Notification, plus AI/endpoint hooks). Policy Matrix v1 (`packages/privacy/src/policyMatrix.ts`) unifies them: **94 specs → 658 rules** (one per mode), machine-exported to [policy-matrix.v1.json](policy-matrix.v1.json), validated by `pnpm check:policy-matrix`, and cross-checked against every concrete policy engine by `tests/privacy-regression/policy-matrix/`.

## How to read it

Each rule is `mode × domain × operation → effect`. Core principle:

```
One canonical policy matrix. Default deny. Deny overrides allow.
Strictest policy wins. Undefined behavior is a bug (fails closed).
```

**Effects** (strictest → loosest): `deny` · `null` · `not_implemented` · `future_gate` · `memory_only` · `redact` · `coarsen` · `delay` · `batch` · `require_user_action` · `allow`. Only `allow/memory_only/redact/coarsen/delay/batch` permit anything; `future_gate`/`not_implemented`/`require_user_action` are **not** allow. **v1 invariants:** every rule has `persistentAllowed=false` and `networkAllowed=false` — nothing persists, nothing egresses.

**Composition:** room policy and feature policy can tighten, never loosen. ScreenShield sealed/bunker (and critical device risk) force-deny shield-sensitive rows. Emergency overrides normal behavior. Every unknown mode/domain/operation/sink/transport/class denies (`unknown_input`).

**Reason codes** are stable identifiers (`default_deny`, `strict_mode`, `telemetry_forbidden`, `push_forbidden`, `ai_forbidden`, `deferred_gate`, …) safe for redacted audit events.

## Mode summaries

### Standard
Private by default: no telemetry, no external assets, no automatic previews, no real network. Content persistence targets the future encrypted backend and **fails hard** until Gate F (no silent memory fallback). Memory-only caches allowed; notifications limited to a generic content-free in-app indicator.

### Private
Standard + stricter metadata: receipts/typing/presence/last-seen denied; WebRTC/direct peers denied; notification content denied; preview/thumbnail caches denied.

### Ghost
Memory/null only — no persistent writes, no AI, no notification content or indicators, no direct network, no metadata signals, no cache/preview persistence, no spool timestamps. **Application-level, not forensic.**

### Bunker
Stricter than Ghost: null preferred; no badges/sound/vibration; no reveal state even in memory; endpoint hooks strictest. **Not a guarantee against a compromised device.**

### Offline Capsule
All network denied. QR/file/USB remain conceptual offline channels. Local memory-only behavior where policy-compatible.

### Emergency
Normal writes/network/metadata generation denied. Only a redacted wipe/revoke audit placeholder. Null/safe behavior preferred.

### Sovereign Room
Composes with the device mode: room policy tightens, never loosens; strictest wins. A hostile client can ignore room policy — an **accepted limitation**.

## Mode × domain behavior (summary)

| Domain | Standard | Private | Ghost | Bunker | Offline | Emergency |
| --- | --- | --- | --- | --- | --- | --- |
| Storage (persistent) | future_gate | deny | deny | deny | deny | deny |
| Storage (memory content) | future_gate¹ | memory_only | memory_only | memory_only | memory_only | deny |
| Network (any egress) | deny² | deny² | deny | deny | deny | deny |
| Metadata (receipts/typing/presence) | deny | deny | deny | deny | deny | deny |
| Metadata (redacted audit/log) | redact | redact | redact | redact | redact | audit-only |
| Link preview (automatic) | deny | deny | deny | deny | deny | deny |
| External assets (all 12 kinds) | deny | deny | deny | deny | deny | deny |
| Notification (content/OS surface) | deny | deny | deny | deny | deny | deny |
| Notification (generic in-app) | memory_only | memory_only | deny | deny | deny | deny |
| AI (local) | future_gate | future_gate | deny | deny | future_gate | deny |
| AI (remote / caches) | deny | deny | deny | deny | deny | deny |
| Endpoint (protected reveal) | memory_only³ | memory_only³ | deny | deny | memory_only³ | deny |

¹ Standard content targets the unimplemented encrypted backend (fails hard). ² Relay send exists only as a user-initiated placeholder (`require_user_action`, performs no I/O). ³ Denied under ScreenShield sealed/bunker or critical device risk.

## Deferred gates (all `future_gate`, 22 specs)

Crypto (Gate F) · encrypted persistent storage (Gate F) · capsule wire format/transport (Gate D/E) · room sync (Gate H) · identity invites/verification (Gate G) · local AI (Gate I) · user-initiated preview · push subscribe/receive/service-worker notifications · clipboard/secure-input/task-switcher/screenshot-blocking (TECH-EDL) · Tauri desktop permissions (Phase 9). Marking them here **encodes the decision without implementing the feature**.

## Accepted limitations

The matrix is a living contract, not a proof: it does not verify crypto/protocol correctness, does not defend against same-realm hostile code beyond `PolicyDecision` scope checks, does not provide anonymity or forensic guarantees, and cannot bind hostile room members.

## Test coverage

Every rule carries `testCoverage` (`covered`/`partial`/`deferred`); 40+ matrix tests plus cross-policy agreement tests keep the matrix and the concrete engines in lockstep. Validation: `pnpm check:policy-matrix` (structure/invariants) and `pnpm check:policy-docs` (doc consistency), both in CI.

## How contributors update it

Any PR that changes privacy/security behavior must update, in the same PR: (1) the spec table in `packages/privacy/src/policyMatrix.ts`, (2) the mirrored `docs/policy-matrix.v1.json` (the sync test fails on drift), (3) the relevant model doc + [PBOM](PBOM.md), and (4) tests. See [CONTRIBUTING_SECURITY.md](CONTRIBUTING_SECURITY.md).
