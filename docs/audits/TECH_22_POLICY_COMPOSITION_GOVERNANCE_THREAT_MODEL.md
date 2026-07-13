# TECH-22 — Policy Composition + Governance Threat Model

_Scope: room policy composition, DevicePosture contract, protected content, tighten-only governance. Extends [TECH_21_REVOCATION_AUTHORIZATION_THREAT_MODEL.md](TECH_21_REVOCATION_AUTHORIZATION_THREAT_MODEL.md)._

## Policy precedence

A room allow overriding a global deny; a role capability overriding Privacy Mode; an object rule overriding StoragePolicy; a query rule exposing content denied by room policy; an owner placeholder bypassing a device requirement; emergency restrictions applied too late; conflicting policies resolving nondeterministically. **Mitigation:** deterministic **deny-overrides + strictest-policy-wins** (`foldStrictestEffectV1`); precedence never lets a later layer loosen an earlier one; `deny`/`not_implemented`/`future_gate` never permit; unknown effect → deny; composition is pure + table-driven (no first-match bypass, no permit-overrides).

## Governance escalation

A room policy loosened by an owner; minimum posture lowered; Bunker content restriction disabled; persistent storage / network / notification previews / metadata signals / external assets enabled; anti-spyware marked active without a provider. **Mitigation:** governance is TIGHTEN-ONLY — there is no loosen/reset/enable-forbidden/lower-posture/disable-protection/vote command; `compareRoomPoliciesV1` accepts only `stricter` (equal/looser/incomparable/unknown deny); structural fields (`persistentPlaintextAllowed`/`externalAssetsAllowed`/`automaticLinkPreviewsAllowed`/`telemetryAllowed`/`contentPreviewAllowed`/`pushAllowed`/`remoteAiAllowed`/`looseningAllowed`) are typed `false`.

## DevicePosture

UI claims `managed_bunker`; a caller forges `high_assurance`; a stale posture stays valid; at-risk ignored; unknown coerced upward; posture treated as identity; posture alone authorizing membership; missing provider treated as hardened; room requires posture but content still shown. **Mitigation:** `resolveEffectiveDevicePostureV1` returns only `unverified` or `at_risk` (no provider integrated); any elevation claim is reduced to `unverified`; `at_risk` always overrides; unknown/malformed → unverified; posture is an ENVIRONMENT attribute (never identity/authority); posture is bound into the authorization revision fence so any change invalidates prepared authorization; `devicePostureSatisfiesMinimumV1` uses explicit ranks (never lexical).

## Protected content

A room requires ScreenShield but integration is absent; content displayed despite an unmet requirement; a claim of screenshot prevention; room metadata leaking even when content is denied; a silent protection downgrade. **Mitigation:** `resolveProtectedPresentationStatusV1` returns `requirementSatisfied: false` for every future-required value (integration absent) → content denies; `activeProtectionClaim` is structurally `false`; no silent downgrade; summaries are metadata-only and separately gated.

## Governance state

A stale policy revision; a prepared authorization surviving a policy update; a last-owner bypass; a policy update after room tombstone; an unverified owner described as a legitimate governor; a malicious client ignoring room policy. **Mitigation:** the governance pipeline checks `expectedPolicyRevision` against current; the TECH-21 revision fence (now including policy revision + posture) invalidates prepared contexts on any change; owner-continuity + capability + authentic exact-scope decision required; owner is documented as UNVERIFIED; enforcement is local-only (a malicious client is an accepted limitation).

## Privacy

A posture value persisted; policy conflicts logged with sensitive IDs; room sensitivity exposed; minimum posture revealing room purpose; governance history exposing the relationship graph; denial reports becoming telemetry. **Mitigation:** posture/policy are memory-only transient (persistence denied — matrix); conflict reports + governance events carry only layer names/field codes/enum values (no title/member/content — sentinel-tested); no telemetry.

## Distributed limitations (stated)

Another client may ignore policy; no signed room policy; no global consensus; no verified policy author; no remote posture validation; no synchronized policy revision. All are Gate F/G/H.

## Endpoint separation

Endpoint-risk state re-enabling access; a "safe device" bypassing suspension; ScreenShield status treated as authorization evidence. **Mitigation:** posture/endpoint state can only TIGHTEN; matrix `room.device_posture.elevate`/`room.authorization.endpoint_assurance`/`room.protected_content.claim_active` deny; the guard bans elevation/provider-integration/active-protection patterns and device-management imports.

## Limits (stated plainly)

FreeLayer enforces policies only in compliant local clients; room policy is not cryptographically authoritative yet; DevicePosture verification is unavailable; Secure Device is external; no active endpoint protection; not safe for real secrets.
