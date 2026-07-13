# TECH-23 Roadmap Reconciliation — Sensitive Room Admission + Secure Device Integration Contract

_Date 2026-07-13 · Branch `tech/sensitive-room-secure-device-contract` · Commit `09520ff` (`09520ffc46b8dc38345f10e433607a3e7a6f3dfc`)_

[← Docs Index](../README.md) · [Roadmap](../ROADMAP.md) · [Implementation Gates](../IMPLEMENTATION_GATES.md) · [Precheck](TECH_23_PRECHECK.md)

## Purpose

Reconcile the canonical roadmap after TECH-23, restate the FreeLayer-core /
Secure-Device-external project boundary, enumerate what is FORBIDDEN in core, and
record the exact roadmap-doc changes the TECH-23 pass applies. No marketing
language; only what the code and gates actually support.

## Reconciled canonical roadmap (RoomOS track)

The RoomOS technical track is a single stacked sequence; each entry builds on the
merged one before it:

- **TECH-20** — RoomOS Membership Model v1 + Local Capability Scaffolding (merged, #45).
- **TECH-21** — RoomOS Membership Revocation + Authorization Regression Suite (merged, #46).
- **TECH-22** — RoomOS Room Policy Composition v1 + Governance Constraints (merged, #47) — introduced the DevicePosture contract, protected-content requirements, and the first sensitive-room admission resolver, and **externalized Secure Device**.
- **TECH-23** — Sensitive Room Admission + Secure Device Integration Contract _(this branch)_ — extracts and hardens the Secure Device boundary into a dedicated [`packages/rooms/src/secure-device/`](../../packages/rooms/src/secure-device/) module: RATS-aligned roles, provider port + Null provider, normalized transient posture assessment with provenance, freshness/recovery models, the deterministic admission resolver, transient sessions, and the ProtectedContent intent contract — plus the `check:no-secure-device-core-implementation` guard.

**Likely next macro track:** **RESEARCH-ID-01 — Identity Competitor + Threat
Research** (research pass preceding Gate G identity work). This is the anticipated
next step, not a committed schedule — dates remain deliberately absent, and gates,
not schedules, decide when implementation may begin.

## Project-boundary split

### FreeLayer core owns

- Communication **policy** (Privacy Modes, Policy Matrix, conflict resolution).
- Storage, network, metadata, and notification **barriers** (side-effect gating via the WeakSet `PolicyDecision` provenance).
- Identity Firewall (design; Gate G).
- CapsuleNet envelope/transport contracts (Gate E) and crypto/messaging contracts (Gate F).
- Sovereign Rooms / RoomOS (object model, operation log, membership, authorization, policy composition, governance).
- Protected-content **policy contracts** (requirement taxonomy, deny-on-absence semantics).
- **Minimum DevicePosture requirements** (the environment-attribute contract and fail-closed resolution).
- **Sensitive-room admission** (the deterministic local gate).
- **Future Secure Device integration contracts** (roles, provider port, normalized assessment shape, freshness/recovery rules) — contract only, no integration.

### Secure Device external project owns

- Device posture **MEASUREMENT** (the RATS Attester and Verifier).
- **ScreenShield / Bunker** native presentation surfaces.
- Spyware / endpoint-defense **research**.
- **GrapheneOS / Pixel validation** and device-support assumptions.

The two meet only at the narrow, privacy-minimized boundary: the external project
produces a normalized Attestation Result; FreeLayer core, as the future **Relying
Party** (RFC 9334), consumes a normalized assessment and applies its own
room-admission policy. Core never processes raw Evidence.

## FORBIDDEN in core

The following must never appear in FreeLayer core (enforced by
[`scripts/check-no-secure-device-core-implementation.mjs`](../../scripts/check-no-secure-device-core-implementation.mjs)
and, for dependency/claim bans, `check:policy-conflicts`):

- Anti-spyware / malware scanner.
- Phone-wide (device-wide) firewall.
- Device Owner / MDM (`DevicePolicyManager`, `DeviceAdminReceiver`, `setDeviceOwner`).
- GrapheneOS installation / management; custom ROM flashing.
- App / package inventory scanning (`getInstalledApps`, `enumeratePackages`, …).
- Accessibility-service scanning.
- Screenshot / screen-recording **detection** (`MediaProjection`, `takeScreenshot`, capture callbacks).
- Clipboard / overlay / keyboard / process monitoring (`ClipboardManager`, `TYPE_APPLICATION_OVERLAY`, `SYSTEM_ALERT_WINDOW`, `getRunningAppProcesses`).
- Hardware attestation / key attestation.
- Play Integrity / SafetyNet / integrity tokens.
- Endpoint telemetry.
- Native ScreenShield / Bunker runtime (active-protection claims).

Also structurally impossible in core: trusted-posture literals
(`effectivePosture: "basic"|"hardened"|"high_assurance"|"managed_bunker"`,
`trustedForElevation: true`, `trustedForPostureElevation: true`,
`lifecycle: "ready_future"`), production mock/native providers, assessment
persistence/history, and provider network calls. Core can therefore only ever
resolve posture to `unverified` (default) or `at_risk` (tightening), and
`activeProtectionClaim` stays `false`.

## Deferred gates preserved

TECH-23 does not open any deferred gate. Preserved and still closed:

- **Secure Device Integration Gate** (future) — real posture verification / protected presentation. Requires: mature external project, integration ADR, provider trust model, posture provenance, freshness/expiration, anti-replay, fail-closed failure behavior, native-permission audit, compromised-provider threat model, no spyware-proof claim, integration tests, rollback plan.
- **Gate B** — capabilities / construction authority (single-use `PolicyDecision`).
- **Gate E** — capsule / hostile-evidence parsing.
- **Gate F** — crypto / attestation / nonces (why core has no trusted clock, nonce, or epoch verification).
- **Gate G** — identity.
- **Gate H** — sync.

The posture assessment's WeakSet provenance is explicitly **not** cryptographic
(Gate F): it is unforgeable within the JS object-capability model but does not
defend against same-realm reflection on a real assessment.

## Exact roadmap-doc changes applied for TECH-23

The reconciliation intends the following edits to [`docs/ROADMAP.md`](../ROADMAP.md)
(RoomOS task track). As of this commit the code, guard, matrix, and CI wiring are
in the tree; the roadmap prose edits below are the canonical text to apply as part
of finishing TECH-23:

1. Add a `✅ TECH-23` task-list entry summarizing: dedicated `secure-device/` module (RATS roles, provider port + Null provider, normalized transient posture assessment with provenance + forbidden-field rejection, freshness/recovery, deterministic fail-closed admission resolver, transient sessions, ProtectedContent intent); Policy Matrix growth 171→**195 specs** / 1197→**1365 rules**; new `check:no-secure-device-core-implementation` guard (+ fixture) in `audit:privacy` and CI; new privacy- and security-regression suites; **no provider integrated** — Null provider only, posture ≤ `unverified`/`at_risk`, content denied for `basic+`, no anti-spyware/attestation/MDM in core; Secure Device remains EXTERNALIZED.
2. Update the TECH-22 "**Next:**" pointer target from "read from the canonical roadmap" to name **TECH-23**, and add TECH-23's own **Next** pointer to **RESEARCH-ID-01 — Identity Competitor + Threat Research**.
3. Keep the **Secure Device externalization** section as the authoritative boundary statement; no re-internalization — TECH-23 only hardens the contract.

Corresponding [`docs/IMPLEMENTATION_GATES.md`](../IMPLEMENTATION_GATES.md) note: the
existing **Secure Device Integration Gate (future)** already states the correct
closed-gate behavior (posture `unverified`/`at_risk` only, stricter requirements
deny content, `activeProtectionClaim: false`); TECH-23 adds no new closed gate,
only satisfies the contract that gate presupposes.

## Consistency statement

After the TECH-23 update, [`docs/ROADMAP.md`](../ROADMAP.md) is consistent with the
reconciled roadmap: TECH-20 → TECH-21 → TECH-22 → TECH-23 is a single stacked
sequence; Secure Device stays externalized with the future integration gate as the
sole re-entry point; the FORBIDDEN-in-core list matches the enforced guard; and the
next macro track is RESEARCH-ID-01. The precheck ([TECH_23_PRECHECK.md](TECH_23_PRECHECK.md))
records the one remaining documentation-coupling item (PBOM Null-provider line)
that must land before the branch's docs tests go green.
