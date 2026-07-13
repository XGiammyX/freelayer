# RoomOS Policy Composition + Governance — Research Note (TECH-22)

_Date: 2026-07-13. Informs the policy-layer model, DevicePosture contract, and tighten-only governance._

> [!NOTE]
> **Source verification pending: internet unavailable in this environment.** The concepts below are stable, widely-documented knowledge (author cutoff 2026-01). Re-confirm current specifics (NIST SP 800-162/205/207, OWASP, XACML combining algorithms, GrapheneOS docs) against primary sources before external citation.

## Project separation (mandatory context)

FreeLayer / ChatControl and **Secure Device / Endpoint Defense** are two separate projects. Secure Device (Pixel + GrapheneOS + isolated profile + Device Posture Checker + Bunker Session + ScreenShield + ProtectedContent) is developed elsewhere. This note separates: **Secure Device assumptions** (external, future), **FreeLayer interface requirements** (implemented here), and **unsupported current behavior** (honest gaps).

## 8.1 NIST ABAC (SP 800-162)

**Summary:** authorization = subject × object × operation × environment attributes evaluated against policy.

**Mapped:** subject = local unverified membership + placeholder role + membership state/revision; object = room id/sensitivity + object kind/sensitivity + lifecycle + protected-content class; operation = mutation/query/membership/governance + requested view + side effect; environment = privacy mode + room policy revision + lifecycle + **DevicePosture** + emergency + future Secure Device integration state. Roles are one attribute, never the whole decision.

## 8.2 NIST attribute assurance (SP 800-205)

**Summary:** attribute accuracy/integrity/allowable-values/freshness/provenance/evaluation-assurance.

**Adopted:** a posture value needs PROVENANCE; a stale posture cannot elevate; an unsupported provider cannot produce high assurance; a caller-controlled posture cannot grant access; unknown/missing fail closed. Because no provider is integrated, core resolves posture to `unverified` (or `at_risk` tightening) only. Freshness/expiration belong to the future integration contract (`observedAtLocal`/`expiresAtLocal` fields exist but are not honored for elevation).

## 8.3 NIST Zero Trust (SP 800-207)

**Summary:** no implicit trust; user and device authorization are DISTINCT inputs; resource-focused; changing environmental conditions re-evaluated.

**Adopted:** membership does not imply a safe device; device posture does not imply member identity; both can restrict one operation; no layer can bypass current local policy; posture changes invalidate prepared authorization (bound into the TECH-21 revision fence). We do NOT copy enterprise network architecture.

## 8.4 OWASP authorization

**Summary:** least privilege, deny-by-default, validate every operation, object-level checks, ABAC/ReBAC, centralized enforcement, regression tests.

**Adopted:** room governance is not in UI; owner role does not bypass strict modes; policy updates require exact-scope decisions + execution-time revalidation; every unknown composition result denies.

## 8.5 Policy-combining algorithms (XACML prior art)

**Summary:** deny-overrides / permit-overrides / first-applicable / only-one-applicable + conflict diagnostics.

**Decision:** **deny-overrides + strictest-policy-wins.** We do NOT use permit-overrides, and no rule ordering lets a later room rule bypass a global denial. `foldStrictestEffectV1` ranks effects; `deny`/`not_implemented`/`future_gate` never permit execution; unknown → deny.

## 8.6 Device posture + compartmentalization (GrapheneOS, future integration only)

**Summary (informational):** supported devices, update support, user-profile separation + profile-specific encryption + profile session ending, hardware/firmware dependency.

**FreeLayer boundary:** none of these are implemented in core. They inform the FUTURE Secure Device integration gate (provider trust model, posture provenance/freshness/anti-replay, native-permission audit, compromised-provider threat model). Core defines only the `DevicePosture` enum + fail-closed resolver + minimum-posture requirement contract.

## Adopted / rejected / deferred

**Adopted:** fixed policy-layer taxonomy; deny-overrides + strictest-wins; a versioned tighten-only `RoomPolicyDocumentV1`; monotonic `compareRoomPoliciesV1`; a fail-closed DevicePosture contract (untrusted cannot elevate; at_risk tightens; no provider); protected-content requirements that deny when integration is absent; sensitive-room admission; governance pipeline bound to the TECH-21 revision fence + posture. **Rejected:** permit-overrides; caller-controlled precedence; policy voting/quorum/consensus/multisig; remote/org/cloud policy; a real posture/attestation service; MDM/Device Owner/GrapheneOS management; OPA/Rego/XACML runtime; ScreenShield/ProtectedContent runtime. **Deferred:** Secure Device provider integration (dedicated gate + ADR); signed room policy (Gate F); verified governance (Gate G); distributed consensus / synchronized policy revision (Gate H); external policy import (Gate E).

## Known limitations

FreeLayer enforces policies only in COMPLIANT local clients; room policy is not cryptographically authoritative; DevicePosture verification is unavailable (core cannot satisfy `basic+`); Secure Device is external; a malicious client can ignore room policy; not safe for real secrets.

## Future Secure Device integration requirements

Mature Secure Device project; integration ADR; provider trust model; posture provenance + freshness/expiration + anti-replay; failure behavior; native-permission audit; GrapheneOS/device-support review; PBOM + Trust Center updates; compromised-provider threat model; no spyware-proof claim; integration tests; rollback plan.
