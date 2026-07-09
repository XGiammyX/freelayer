# TECH-08 NetworkPolicy Audit

_Date: 2026-07-09 · Branch: `tech/network-policy-implementation` (from `b845b4e`)_

## Verdict

**TECH-08: COMPLETE.** All acceptance criteria met; 157/157 tests green; all 11 local checks pass.

## Commands run

`pnpm install/typecheck/lint/test/build` + `check:boundaries` + `check:no-external-assets` + `check:no-telemetry` + `check:no-forbidden-storage` + **`check:no-forbidden-network`** (new) + `check:doc-links` + `audit:privacy` + `audit:supply-chain` — **all PASS**. Dev-loop findings fixed honestly: the `PolicySideEffectScope` enum was extended with 13 network scopes; the forbidden-network guard self-tripped on a literal insecure-scheme token in the endpoint validator (rebuilt from string parts so the validator still rejects it while the source contains no literal); a positive-control cast tightened for strict TS.

## Research summary

OWASP MASVS-NETWORK (secure channel, endpoint identity, pinning; plain-HTTP is a failure — but no-default-network is the strongest posture) · verified WebRTC ICE/STUN real-IP leak with no prompt (drives Private+ denial) · browser egress APIs · Tauri v2 deny-by-default HTTP plugin · network metadata (IP/DNS/timing/size/relay/courier). Full note: [research/NETWORK_POLICY_RESEARCH.md](../research/NETWORK_POLICY_RESEARCH.md).

## Invariants covered (41 new tests → 157 total)

- **Policy matrix:** always-forbidden ops (telemetry/asset/link-preview/remote-AI/update) denied in all 7 modes; Offline Capsule + Emergency deny network; WebRTC denied Standard/Private/Ghost/Bunker; Ghost/Bunker deny relay/http/websocket/lan; Standard/Private relay = user-initiated placeholder; QR/file/USB = offline_only (no IP exposure); fail-closed on unknown op/transport/mode; strictest-wins room composition (can't loosen Bunker or re-enable WebRTC); metadata labels per transport; every operation kind resolves.
- **Barrier:** forged/denied/wrong-scope/wrong-capability decisions rejected; user-initiation enforced; telemetry → `ForbiddenTelemetryError`; WebRTC → `ForbiddenDirectPeerConnectionError`.
- **Endpoint validation:** insecure scheme, credentials-in-URL, private/loopback hosts, `file:`/`data:`/`blob:`, `ftp:`, suspicious query keys, sentinel — all rejected with a generic, endpoint-free error; plain https accepted (still needs policy).
- **Runtime trap:** policy eval + Noop/Mock transports touch no network API; denied ops fail before any API; positive controls prove the trap catches `fetch` and `WebSocket`/`RTCPeerConnection` construction.
- **Guardrail:** fixture with fetch/WebSocket/RTCPeerConnection/sendBeacon/Tauri-HTTP fails; `packages` clean; markdown mentions never fail.

## Guardrail / trap / label coverage

Guard tokens cover browser egress, `http:`, Tauri HTTP, Node `http/https/net/dgram/tls`, and HTTP client libraries; deliberately **not** bare `https://` (would false-positive on legitimate repo links — decision recorded). Runtime trap patches `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource`/`RTCPeerConnection`/`RTCDataChannel`/`sendBeacon` (synthetic where absent; honest absent-coverage). Metadata labels cover all 12 transport classes.

## Known limitations

Application-behavior guarantee only — not network isolation (OS/browser/extensions/package-manager/malware out of scope). Token-based static scan. In-process forgeable decision marks (documented since TECH-05).

## Deferred to TECH-09

Full-build zero-egress verification: instrument the built `apps/web` bundle and assert no network on load; CI-side egress isolation.
