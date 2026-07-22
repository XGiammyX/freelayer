# TECH-ID-04 — Ephemeral Identity Threat Model

> **Sourcing caveat (read first).** Internet access was likely unavailable while preparing this document. External references (NIST SP 800-63 / 800-88, W3C pairwise-identifier guidance, SimpleX, Signal) were consulted **offline, from prior knowledge**, not fetched live, and **must be re-verified against the primary source** before being relied on for a security decision. This is a **documentation-only** threat model: it adds no identity, key, alias, persona, device, invite, or recovery code and invents no cryptography. Companion research: [EPHEMERAL_IDENTITY_IMPLEMENTATION_RESEARCH.md](../research/EPHEMERAL_IDENTITY_IMPLEMENTATION_RESEARCH.md). Structural decisions: [ADR-0013](../adr/ADR-0013-identity-firewall-architecture.md) / [IDENTITY_ARCHITECTURE.md](../IDENTITY_ARCHITECTURE.md) / [IDENTITY_FIREWALL.md](../IDENTITY_FIREWALL.md).

> [!IMPORTANT]
> Read the **[Honest limitations](#honest-limitations-read-this)** section first. An ephemeral identity is *an independent local identity-root context whose authority exists only in the current application process, has a bounded local lifetime, has no recovery, cannot be promoted or exported, and is destroyed fail-closed when expired or explicitly ended.* It is **not** a persona, alias, guest display name, a normal root with a hidden flag, a recoverable short-lived account, an anonymity guarantee, a remote-deletion mechanism, or a Secure Device feature. **DevicePosture is not identity. An ephemeral identity is not proof of anonymity. Expiration is not forensic erasure. Local destruction does not delete remote copies. A short lifetime does not prevent screenshots, logs, or external observation.** Cryptography is **Gate F**, wire formats **Gate E**, synchronization/distributed revocation **Gate H**, and endpoint protection is **external** (Secure Device / Endpoint Defense). **No complete mitigation is claimed for any threat below.**

## How to read this model

Each category lists a concrete **attack**, then **why it fails / residual** (the structural, policy, or gate reason the attack is blunted, and what it leaves behind), and the **control** that carries the weight. A control is one of:

| Control kind | Meaning |
| --- | --- |
| **Design** | A structural invariant / type boundary / reducer discipline in `@freelayer/identity` (separate `rootKind`, injected clock/epoch, memory/null, fail-closed transitions, content-free errors). |
| **Policy** | A fail-closed decision in `identity-policy.ts` + an authentic exact-scope `PolicyDecision` (`@freelayer/privacy`). DevicePosture may only tighten. |
| **Gate** | Not solvable by this module: **Gate F** (crypto), **Gate E** (wire), **Gate H** (sync/distributed revocation), **External** (Secure Device / endpoint), **Inherent** (disclosed trade-off). |

Code anchors used repeatedly: `ephemeral-clock.ts` (`EphemeralProcessBindingV1.crossRestartValidity: false`, opaque non-persisted `processEpochId`, `EPHEMERAL_IDENTITY_LIMITS_V1`, `parseLocalClockMs`), `ephemeral-errors.ts` (fail-closed codes + static `SAFE_EPHEMERAL_REJECTION`), `identity-types.ts` (`LocalIdentityRootKindV1`), `identity-reducer.ts` (pure, injected clock/ids, no partial state), `identity-repository.ts` (memory/null, never claims recoverability), `identity-policy.ts` (fail-closed; DevicePosture only tightens).

---

## (a) False-anonymity

Users assume "ephemeral" means "anonymous." It does not — it changes local identity-root scope, nothing about the network or endpoint.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| User believes an ephemeral identity hides them; acts as if untraceable | The module changes **local root scope only**. It touches no network layer (network is structurally unavailable in identity). IP/transport exposure is unchanged. Residual: the user can still be deanonymized by everything outside the module. | **Design** (scope is local) + **Inherent** (disclosed: "not proof of anonymity") |
| Passive network observer correlates by **IP / network metadata / timing** | Out of the identity module entirely — it sends nothing. Residual: full network-level observation remains; only a network-anonymity layer (not in scope) could address it. | **Gate / External** (network anonymity is not an identity feature) |
| **Room membership** links two contexts under one ephemeral identity | An ephemeral root that joins the same room(s) as a long-lived context, or two rooms an observer can correlate, links those contexts by co-membership. Residual: co-presence is inherently observable; the module cannot un-link who is in a room together. | **Design** (independence limits *identity* linkage) + **Inherent** (co-membership) |
| **Invite / connection transport** links the ephemeral identity to a known channel | An invite delivered over an already-observed channel (Gate E, not built) ties the new context to that channel. Residual: courier/transport sees *that* a connection formed. | **Gate E** (invite payload) + **Inherent** (transport metadata) |
| Reused **display info / avatar / writing style / activity timing / behavior** correlate contexts | The module forbids reusing peer-facing identifiers/aliases/labels from a long-lived root, but cannot stop a human reusing the same avatar, phrasing, or online hours. Residual: behavioral/stylometric correlation persists. | **Design** (no reused peer-facing field) + **Inherent** (user behavior) |
| **Endpoint compromise** observes the user regardless of ephemerality | Malware/screen capture/keylogger sees everything the user sees. Residual: total — ephemerality is irrelevant on a compromised endpoint. | **External** (Secure Device) |

---

## (b) Cross-context correlation

The crown-jewel risk: an ephemeral root re-linked to a long-lived root (or another context) via shared material.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| Ephemeral root **references / embeds a long-lived root** id | Ephemeral is a distinct `rootKind` in a separate module; the long-lived root is `publicExposure: "forbidden"` and never peer-facing. No field carries a long-lived root id into ephemeral state. Residual: a *future* faulty binding could reintroduce a reference — a code-review/regression invariant. | **Design** (separate root/module) |
| Reused **persona / label / avatar / room-alias / device-id / trust-record** across contexts | Personas/aliases/room-aliases/device keys/Trust Notebook are `not_implemented` (`identity-types.ts`); none can be shared today. Residual: once built (TECH-ID-05/06, Gate F), the "no reuse across ephemeral↔long-lived" rule must be enforced, not assumed. | **Design** (features absent) + **Gate F** (future enforcement) |
| Reused **future verification material / keys** re-link (pairwise defeat, §6.2) | No key material exists (Gate F); nothing to reuse. Residual: Gate F must derive ephemeral material **independently** of any long-lived root, or correlation moves from id to key (ADR-0013 §7). | **Gate F** (independent derivation) |
| **Shared recovery config** links ephemeral to a recoverable identity | Ephemeral has **no recovery** (`recovery_forbidden`); no recovery config can attach. Residual: none from this vector by construction (adding recovery is a top-severity regression). | **Design** (recovery refused) |
| **Reusable service endpoint / address** re-links contexts | No DID/service-endpoint model (rejected v1); the process epoch is opaque, non-persisted, non-peer-facing; ephemeral has no long-term address. Residual: any future endpoint/discovery feature reopens this and needs its own privacy gate. | **Design** (no endpoint) + **Gate** (future discovery) |
| Same-process runtime **correlates by observation** | Two contexts alive in the same process can be correlated by anything with process access. Residual: independence is structural/organizational, **not** cryptographic; a compromised process sees both. | **Inherent / External** (no crypto unlinkability today) |

---

## (c) Lifetime / expiry bypass

Expiry is authority-ending. Every way to keep operating past it is an attack.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Excessive lifetime** requested (effectively permanent) | `EPHEMERAL_IDENTITY_LIMITS_V1` caps duration (max 24h) and rejects over-long requests (`lifetime`). Residual: limits are **engineering defaults, not security guarantees**; a long-but-legal lifetime still exposes more. | **Design** (bounded limits) |
| **Malformed / past / future deadline** injected | Deadlines are parsed/validated (`parseLocalClockMs`, `local:<ms>`); a malformed value is rejected (`validation`/`lifetime`); a past deadline is already-expired (`expired`). Residual: relies on injected clock honesty (next row). | **Design** (validate-before-use, fail closed) |
| **Clock rollback** (set wall clock backward to un-expire) | Local time is treated as **untrusted**; the epoch binding + monotonic checks reject rollback (`clock_rollback`). The reducer never reads an ambient clock. Residual: an attacker controlling both the injected clock and epoch is out of the local trust model. | **Design** (injected untrusted clock; rollback rejected) |
| **Suspended process** (laptop sleep) hides elapsed time | On resume, the deadline is re-evaluated against the injected clock and epoch; elapsed real time past the deadline yields `expired`. Residual: within a valid window, suspension is benign by design. | **Design** (re-check on use) |
| **Operation without an expiry check** (a code path forgets to validate) | Operations go through the fail-closed pipeline that checks epoch + deadline before mutating; a missing check is a compile/exhaustiveness/regression failure, not a silent allow. Residual: coverage depends on the (not-yet-written) regression suite. | **Design** (fail-closed pipeline) + **Gate** (tests pending) |
| **Stale session** keeps acting after expiry | A stale in-flight decision fails the exact-scope/authenticity check (`decision_mismatch`) and the deadline check (`expired`); no partial state is written. Residual: none from this vector by construction. | **Policy** (authentic exact-scope decision) + **Design** |
| **Restore after restart** (reload the ephemeral root next launch) | `crossRestartValidity: false`; the epoch is not persisted, so a new process epoch never matches (`process_epoch_mismatch`). Nothing is stored to restore. Residual: intended non-persistence. | **Design** (process-epoch binding; memory/null) |
| **Reactivate an expired / ended** root | Terminal states are terminal (explicit lifecycle transitions; no silent default); reactivation throws (`orphan_state`/`destruction`). Residual: none by construction. | **Design** (explicit terminal transitions) |
| **Silent extension** of an active lifetime | There is no extend/renew command; a new lifetime means a new root/decision, not mutation of the deadline. Residual: none — extension is not expressible. | **Design** (no extend command) |

---

## (d) Destruction

Destruction ends authority. The attacks assert it did *more* (or less) than it did.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Only the root deleted while children remain** (dangling relationships/bindings) | Destruction is atomic over the ephemeral context; orphaned child references are rejected (`orphan_state`) rather than left live. Residual: correctness depends on the reducer covering every child kind (exhaustiveness/regression). | **Design** (atomic, orphan-rejecting) + **Gate** (tests pending) |
| **Repository retains hidden refs** after destruction | Repos are memory-only/null with defensive clones and no shared global state; the Null repo "retains nothing and never claims recoverability"; a `null`-classed vault is never retained even in-memory. Residual: OS/runtime memory pages are out of reach (see next). | **Design** (memory/null; no hidden retention) |
| **Logs / audit retain the identity graph** | Errors/audit are content-free: codes + static `SAFE_EPHEMERAL_REJECTION`; no id/label/room-ref/epoch/deadline/sentinel is ever serialized. Residual: application-level logs by third-party code are outside this module. | **Design** (content-free, sentinel-safe) |
| **Crash dumps** capture ephemeral state | Out of the module's reach — OS/runtime behavior. Residual: crash dumps/diagnostics may contain memory contents; this is External/Inherent, not defended here. | **External / Inherent** |
| **Destruction receipt claims forensic erasure** | The design describes destruction as an **authority/state transition only** and makes no media-sanitization claim; clearing process memory is best-effort with no runtime overwrite guarantee. Residual: memory is not provably scrubbed. | **Design** (honest framing) + **Inherent** (no guaranteed scrub) |
| **Remote peers assumed deleted** | The module has no network; destruction cannot reach a peer/relay/backup. Residual: anything already delivered persists remotely. | **Design** (no network) + **Gate H / Inherent** (no remote deletion) |
| **Tombstone reactivated** to resurrect a destroyed identity | Ended/tombstoned is terminal; reactivation throws (`destruction`/`orphan_state`). Residual: none by construction. | **Design** (terminal transitions) |

---

## (e) Promotion / linking

Every attempt to make an ephemeral identity durable, or to fuse it with a persistent one, is an attack on both its unlinkability and its bounded lifetime.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| Ephemeral **becomes long-lived** ("keep this identity") | No promotion path exists; a promotion request fails (`promotion_forbidden`). The `rootKind` is fixed at creation. Residual: none — promotion is not expressible. | **Design** (promotion refused) |
| **Data copied into a persistent root** | Export/persist of ephemeral state is refused (`export_forbidden` / `persistence_forbidden`); repos discard `null`-classed state. Residual: a user manually re-typing content into another identity is behavioral, not an API path. | **Design** (export/persist refused) |
| **Recovery added** to an ephemeral identity | Recovery is structurally unavailable (`recovery_forbidden`; `recoveryAvailable: false` in policy). Residual: none by construction (adding recovery is a top-severity regression). | **Design + Policy** (recovery refused) |
| **Ephemeral persona attaches to a long-lived root** | Ephemeral is an independent root, not a persona of any root; no attach command exists. Residual: persona features (TECH-ID-05/06) must preserve this separation when built. | **Design** (independent root) + **Gate** (future features) |
| **Long-lived contacts imported** into the ephemeral context | No import path; relationships are created fresh under the ephemeral root, not copied. Residual: a user re-adding the same peer is behavioral correlation, not an API path. | **Design** (no import) + **Inherent** (user behavior) |
| **Shared block / trust history** links ephemeral to long-lived | Trust Notebook / block history are `not_implemented`; no shared store exists. Residual: once built, block/trust records must be per-root, not shared across ephemeral↔long-lived. | **Design** (features absent) + **Gate** (future scoping) |
| **UI exposes a shared root** (leaks that two contexts share an origin) | The module surfaces no cross-root linkage; summaries are content-minimized by mode and require their own decision. Residual: a UI that displays both contexts together is a UX concern (TECH-ID-11/13). | **Design** (no linkage surfaced) + **UX** |

---

## (f) Resource / abuse

Cheap, unlimited disposable identities are a resource and abuse vector.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Unlimited identities** exhaust memory | `EPHEMERAL_IDENTITY_LIMITS_V1.maximumActiveEphemeralRoots` (8) caps concurrent active ephemeral roots (`limit`); memory-only state is bounded. Residual: the cap is an engineering default, not a security guarantee. | **Design** (concurrency cap) |
| **Spam / Sybil** via disposable identities | Unlinkability and Sybil-resistance are in tension; no central moderator exists by design. Local caps blunt trivial local flooding. Residual: **disclosed, unresolved** — non-correlating abuse control is a Gate F/G research question. | **Inherent** (unlinkability ↔ abuse) + **Gate** |
| **Creation bypasses room admission** | Creating an ephemeral root grants **no** room authority; joining a room still requires RoomOS admission/membership (separate authorization). Residual: none from this vector — creation ≠ admission. | **Design + Policy** (creation grants no room authority) |
| **Destruction bypasses blocking** (evade a block by cycling identities) | Destroying/recreating does not clear a peer's local block of a *relationship*; blocks are relationship-scoped and survive. Residual: a genuinely new pairwise context is, by design, not the blocked one — the unlinkability↔abuse trade-off again. | **Design** (relationship-scoped block) + **Inherent** |
| **Auto-creation** (a loop mints identities without user intent) | Creation is policy-gated (authentic exact-scope decision) and capped; strict modes deny expansive creation entirely. Residual: caller misuse within limits is bounded by the cap. | **Policy** (gated, capped, strict-mode deny) |

---

## (g) Authorization

An id must never be authority. Ambient/posture/stale signals must never authorize.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **An id grants authority** (holding an ephemeral root id = permission) | Ids are opaque local references that "grant NO authority, prove NO identity" (`identifiers.ts`); every operation requires an authentic, allowed, exact-scope `PolicyDecision`. Residual: none — an id never substitutes for a decision. | **Design + Policy** |
| **DevicePosture / RoomOS role grants creation** | DevicePosture "may only TIGHTEN … NEVER grants an identity operation" (`identity-policy.ts`); a RoomOS role is not identity authority. Residual: none — posture/role can only restrict. | **Policy** (posture tightens only) |
| **Stale `PolicyDecision` reused** across operations | Decisions are WeakSet-authenticated with an exact `sideEffect` scope; a stale/mismatched decision fails (`decision_mismatch`). Residual: none from replay by construction. | **Policy** (authentic exact-scope) |
| **Expired identity still operates** (authorized once, keeps acting) | Every operation re-checks epoch + deadline before mutating; an expired root throws (`expired`). Residual: none — authorization is not cached past expiry. | **Design** (re-check on use) |
| **Wrong root selected via ambient state** ("current identity" default) | There is **no** ambient/default/global "current identity"; the vault holds immutable collections and the caller must name the exact root. Residual: none — mis-scoping requires an explicit wrong id, not a silent default. | **Design** (no ambient identity) |

---

## (h) Endpoint / storage

The endpoint is outside the module's trust boundary; this section states that plainly rather than pretending otherwise.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Browser / OS memory copy** captures ephemeral state | The module keeps state in memory-only/null and never persists; but the runtime/OS may copy pages. Residual: memory-resident data can be captured on a compromised host. | **Design** (memory/null) + **External** (endpoint) |
| **Swap / crash diagnostics** leak state to disk | OS swap and crash/diagnostic capture are outside the module. Residual: state may reach disk via swap or a dump; not defended here. | **External / Inherent** |
| **Protected presentation unavailable** (no screenshot/task-switcher shield) | Screenshot/preview blocking is an **external** Secure Device capability, hook-only in core. Residual: screenshots and task-switcher previews can capture ephemeral content. | **External** (Secure Device) |
| **Secure Device unavailable** (posture cannot be enforced) | Missing posture cannot *loosen* identity behavior (it only tightens); absence fails safe toward restriction, not toward a false "protected" claim. Residual: no endpoint hardening is provided by core. | **Policy** (fail toward restriction) + **External** |
| **Process memory cannot be guaranteed erased** | Clearing references is best-effort; the JS/OS runtime provides no overwrite guarantee (NIST SP 800-88 concerns). Residual: destruction is an authority/state transition, **not** a media wipe — stated honestly, not claimed solved. | **Inherent** (no guaranteed scrub) + **Design** (honest framing) |

---

## Honest limitations (read this)

**Stated plainly, without hedging:**

- **No anonymity guarantee.** An ephemeral identity changes local identity-root scope only. It does not hide IP or network metadata, does not anonymize transport, and does not stop endpoint observation. It is **not proof of anonymity**.
- **No remote deletion.** Local destruction clears local process state. It deletes nothing already delivered to a peer, relay, notification surface, or backup. There is no "delete everywhere."
- **No forensic erasure.** Expiration and destruction end **authority and state**; they are not media sanitization. Clearing process memory is best-effort — the JS/OS runtime provides no overwrite guarantee. The design makes no auto-wipe or vanishing-identity claim.
- **No endpoint guarantee.** Screenshots, second devices, crash dumps, diagnostics, swap, and compromised endpoints are external (Secure Device) or inherent OS behavior. A short lifetime does not prevent them.
- **No cryptographic unlinkability.** No key material exists (Gate F). "Independent root" is a structural/organizational property today, not a cryptographic one; a compromised process, or reused behavior/material, can still correlate contexts.
- **Not safe for real secrets.** Until reviewed identity/crypto (Gate F) and, where relevant, an endpoint integration ship, ephemeral identities must not be treated as a safe home for information whose exposure would cause real harm.

## Top threats — indicative severity / likelihood and resolving control

Severity and likelihood are **indicative pre-implementation judgments**, not measurements — they rank where design and test attention are most needed. "Resolved / bounded by" names the control (Design / Policy / Gate) that carries each item; none is claimed fully solved.

| # | Threat | Severity | Likelihood | Resolved / bounded by |
|---|--------|----------|------------|-----------------------|
| 1 | Ephemeral root re-linked to a long-lived root via reused/derived material — (b) | Critical | Medium | **Design** (separate root/module) + **Gate F** (independent derivation) |
| 2 | User treats ephemeral as anonymous; deanonymized by IP/network/endpoint — (a) | High | High | **Inherent** (disclosed) + **External** (network/endpoint not in scope) |
| 3 | Promotion / export / recovery added, making the identity durable & linkable — (e) | Critical | Low | **Design + Policy** (promotion/export/recovery refused); treat any such feature as a top-severity regression |
| 4 | Clock rollback / suspended process / restart used to bypass expiry — (c) | High | Medium | **Design** (injected untrusted clock; epoch binding; re-check on use) |
| 5 | Destruction assumed to erase memory / delete remote copies — (d)/(h) | High | Medium–High | **Design** (honest framing) + **Inherent** (no scrub / no remote deletion) |
| 6 | Unlimited disposable identities → Sybil / spam / block-evasion — (f) | High | Medium | **Design** (caps) + **Inherent** (unlinkability ↔ abuse, unresolved) |
| 7 | Stale / forged `PolicyDecision` or an id used as authority — (g) | High | Low | **Policy** (WeakSet-authentic exact-scope decision; id ≠ authority) |
| 8 | Expired identity keeps operating (authorization cached past expiry) — (c)/(g) | High | Low | **Design** (re-check epoch + deadline on every operation) |
| 9 | Ephemeral state persisted / synced / restored after restart — (c)/(e) | Medium | Low | **Design** (`crossRestartValidity: false`; memory/null; persist/sync refused) |
| 10 | Identity graph leaked via logs / audit / crash dumps — (d)/(h) | Medium | Medium | **Design** (content-free, sentinel-safe) + **External** (crash dumps) |
| 11 | Ephemeral content captured by screenshot / second device / task-switcher — (a)/(h) | High | Medium | **External** (Secure Device) — not defended by core |
| 12 | DevicePosture / RoomOS role mistaken for identity/creation authority — (g) | Medium | Low | **Policy** (posture only tightens; role ≠ identity) |

## References

- [EPHEMERAL_IDENTITY_IMPLEMENTATION_RESEARCH.md](../research/EPHEMERAL_IDENTITY_IMPLEMENTATION_RESEARCH.md) — sources, decisions adopted, rejected approaches, limitations.
- [RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md](RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md) — the broader identity threat catalogue (correlation, impersonation, recovery, multi-device, alias, invite, abuse).
- [TECH_ID_02_IDENTITY_ARCHITECTURE_THREAT_REVIEW.md](TECH_ID_02_IDENTITY_ARCHITECTURE_THREAT_REVIEW.md) — threat-to-decision mapping onto ADR-0013.
- [TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md](TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md) — endpoint / DevicePosture boundary (external Secure Device project).
- [../IDENTITY_FIREWALL.md](../IDENTITY_FIREWALL.md) — invariants (DevicePosture ≠ identity; membership ≠ identity; not safe for real secrets).
