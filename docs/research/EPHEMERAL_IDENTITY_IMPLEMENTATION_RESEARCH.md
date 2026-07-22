# Ephemeral Identity — Implementation Research (TECH-ID-04)

> **Sourcing caveat (read first).** Internet access was likely unavailable while preparing this document. Every external standard and product reference below (NIST, W3C, SimpleX, Signal, OWASP) was consulted **offline, from prior knowledge**, not fetched live. Any claim used for a security decision **must be re-verified against the primary source** before it is relied on. Throughout, **evidence** (what a standard actually says, or what the code in this repo actually does) is kept separate from **inference** (how we chose to apply it), and each item carries an evidence-type tag. Uncertainty is flagged inline as `[UNCERTAIN]`. This document informs the **local, current-process, non-recoverable, non-cryptographic** TECH-ID-04 ephemeral-identity work only; it decides nothing that ADR-0013 defers to Gate F (cryptography), Gate E (wire formats), or Gate H (synchronization).

**Evidence-type tags used below**

| Tag | Meaning |
| --- | --- |
| `[STANDARD]` | A published specification (NIST SP 800-63 / 800-88, W3C DID / Controlled Identifiers). Consulted offline — re-verify. |
| `[VENDOR]` | A product's documented behavior (SimpleX, Signal). Consulted offline — re-verify against current docs/source. |
| `[REPO]` | Directly verifiable in this repository at the cited path. |
| `[INFERENCE]` | Our design reasoning applying evidence to TECH-ID-04. Not itself a source. |
| `[UNCERTAIN]` | A recollection we are not confident about; treat as a re-verify TODO. |

---

## 0. Scope and non-goals

### 0.1 What an ephemeral identity is (working definition)

An **Ephemeral Identity** is *an independent local identity-root context whose authority exists only in the current application process, has a bounded local lifetime, has no recovery, cannot be promoted or exported, and is destroyed fail-closed when expired or explicitly ended.*

In the module's type system this is the second value of the root-kind discriminant introduced in TECH-ID-04:

- `[REPO]` `packages/identity/src/identity-types.ts` — `LocalIdentityRootKindV1 = "long_lived_local" | "ephemeral_current_process"`. Long-lived roots live in `LocalIdentityVaultStateV1`; the ephemeral root is an **independent current-process context** in the separate `packages/identity/src/ephemeral/` module. Unknown kinds fail closed.
- `[REPO]` `packages/identity/src/ephemeral/ephemeral-clock.ts` — `EphemeralProcessBindingV1` carries an opaque `processEpochId` and `crossRestartValidity: false`; the epoch "contains NO OS process id, is never persisted, and is never exposed to peers — a mismatch means expired/destroyed for operational purposes (no restart restoration)."
- `[REPO]` `packages/identity/src/ephemeral/ephemeral-errors.ts` — a fail-closed error taxonomy whose codes name every rejection class (`expired`, `process_epoch_mismatch`, `clock_rollback`, `lifetime`, `limit`, `promotion_forbidden`, `recovery_forbidden`, `persistence_forbidden`, `export_forbidden`, `synchronization_forbidden`, `destruction`, `orphan_state`). Failure is always safe (no partial state).

### 0.2 What an ephemeral identity is NOT (mandatory distinctions)

`[INFERENCE]` These are load-bearing category boundaries, not marketing copy. Each is a distinct threat class in the companion threat model.

- **Not a persona.** A persona (`IdentityPersonaV1`) is a *presentation/policy context under one long-lived root* and is explicitly **not guaranteed unlinkable** (`identity-types.ts`). An ephemeral identity is an **independent root**, not a child of a long-lived root.
- **Not an alias / guest display name.** Aliases and peer-visible display names are `not_implemented_tech_id_05_06`. An ephemeral identity is not "a name you show"; it is a separate authority context.
- **Not a normal root with a hidden flag.** It is a distinct `rootKind`, kept in a separate module with its own clock, epoch binding, limits, and error taxonomy — not `LocalIdentityRootV1` with a boolean toggled.
- **Not a recoverable short-lived account.** There is no recovery path (`recovery_forbidden`); total loss on process end / expiry is intentional, not a bug.
- **Not proof of anonymity.** It changes *local identity-root scope*, not the network, transport, or endpoint that can observe the user (see §6.1, §6.4 and the threat model).
- **Not a remote-deletion mechanism.** Local destruction clears local process state only; it deletes nothing already delivered to a peer, relay, or backup (see §6.4).
- **Not a Secure Device / endpoint feature.** Endpoint protection (screenshots, memory hardening, task-switcher previews) belongs to the **external** Secure Device / Endpoint Defense project. DevicePosture is an environment attribute, **not identity**.

### 0.3 Non-goals

TECH-ID-04 introduces **no** cryptography, key material, signatures, derivation, verification, recovery, invites/QR, per-contact/per-room aliases, device keys/passports, Trust Notebook, DID documents, key transparency, phone/email, public directory, persistence to disk, network, notification, AI, or synchronization. It adds only a **local, non-cryptographic, current-process** identity-root context, its lifetime/epoch discipline, and fail-closed destruction. It ports no external identity system; it extracts **design principles** from external standards and **reuses patterns** already validated in this monorepo.

---

## 6.1 NIST Digital Identity — lifecycle & assurance boundaries (principles only)

**Source** `[STANDARD]` NIST SP 800-63-4 family — SP 800-63 (overview / assurance model), SP 800-63A (identity proofing / enrollment, IAL), SP 800-63B (authenticators & their lifecycle, AAL), SP 800-63C (federation, FAL). Cross-referenced in `docs/research/IDENTITY_STANDARDS_RESEARCH.md` and RESEARCH-ID-01. Consulted offline — re-verify.

**Principles extracted (evidence → what NIST separates):**

1. `[STANDARD]` **Proofing is distinct from authenticator control.** Establishing *who a real-world subject is* (IAL, 800-63A) is a different process from *proving control of an authenticator* (AAL, 800-63B). Collapsing them is a category error.
2. `[STANDARD]` **Lifecycle states are explicit and bounded.** Enrollment, active, suspended, revoked (and, for authenticators, binding/activation/expiry/reset) are named states with defined transitions — not implicit booleans.
3. `[STANDARD]` **Recovery / replacement affect assurance.** Re-binding or replacing an authenticator is a known assurance-lowering, attack-prone step; recovered access should not silently inherit prior assurance.
4. `[STANDARD]` **Temporary control of an identifier is not proof of a person.** Holding or operating an identifier for a while says nothing about legal identity, personhood, or absence of coercion.
5. `[STANDARD]` **Local deletion/expiration is not revocation everywhere.** A subscriber ending or expiring their own record does not, by itself, propagate a revocation to every relying party that saw the identifier.

**Inference → how TECH-ID-04 applies the principles (without copying centralized government-account architecture):**

- `[INFERENCE]` **Expiry is a first-class, bounded lifecycle event, not a boolean.** The ephemeral context has an explicit local deadline evaluated against an **injected** clock, plus a process-epoch binding; when either fails, operations are rejected with a named terminal code (`expired`, `process_epoch_mismatch`). This mirrors NIST's "states are explicit," applied to a *self-asserted local* record — there is **no** IAL/AAL claim, no proofing, no authenticator.
- `[INFERENCE]` **Temporary control ≠ personhood ≠ assurance.** An ephemeral root asserts nothing about a real-world person and carries no `verified`/IAL/AAL field. Its assurance ceiling is the same as production long-lived roots: only `unverified_local | compromised_suspected | revoked` may ever be written (`[REPO]` `identity-types.ts` `PRODUCTION_ASSURANCE_STATES`).
- `[INFERENCE]` **No recovery, by design.** NIST treats recovery as assurance-affecting and risky; an ephemeral identity resolves that by having **none** (`recovery_forbidden`). Loss on expiry/process-end is the intended availability trade-off, disclosed, not hidden.
- `[INFERENCE]` **Local end is not global revocation.** Ending an ephemeral root is authoritative only for the local current-process context. It is **not** a distributed revocation and makes no claim to reach peers (Gate H). See §6.4 and threat categories (d)/(e).

**Explicitly not done / not copied.** No relying-party, IdP, session-federation, FAL, authenticator binding, or centralized account directory was built. We adopt NIST's **boundary discipline** (proofing ≠ authenticator ≠ record; explicit lifecycle; recovery affects assurance; identifier control ≠ personhood; local end ≠ global revocation), not its account architecture.

---

## 6.2 W3C Controlled Identifiers / DID — pairwise-privacy guidance

**Source** `[STANDARD]` W3C DID Core and the W3C Controlled Identifier / verification-method model, plus general W3C privacy-IG guidance on correlation and pairwise (per-relationship) identifiers (concept shared with OIDC/SAML pairwise subject identifiers). Cross-referenced with SimpleX/Briar pairwise evidence in the RESEARCH-ID-01 competitor matrix. Consulted offline — re-verify.

**Principles extracted (evidence):**

1. `[STANDARD]` **Stable, reused identifiers enable correlation.** A single identifier presented across relationships lets independent parties (and passive observers) link a subject's contexts into one graph.
2. `[STANDARD]` **Pairwise identifiers are unique per relationship/domain.** A distinct identifier per relationship denies trivial cross-context linking.
3. `[STANDARD]` **Reused verification material, metadata, or service endpoints re-link.** Pairwise identifiers are undermined if the *same key/verification method*, the *same service endpoint*, or a *shared metadata field* appears across relationships — correlation simply moves from the id to the reused material.

**Inference → the central implication for an ephemeral identity:**

- `[INFERENCE]` **An ephemeral identity must NOT reuse anything peer-facing from a long-lived root.** Concretely, it must not present, embed, or derive from: the long-lived root's peer-facing identifiers, its (future) verification material/keys, its personas/aliases/labels, its room-alias or device identifiers, its metadata fields, its trust records, or any shared service/endpoint reference. Reusing any of these would collapse the "independent root" property and re-link the ephemeral context to the long-lived one — defeating its entire purpose. This is enforced structurally: the ephemeral root is a **separate `rootKind` in a separate module**, and the long-lived root is `publicExposure: "forbidden"` and never peer-facing (`[REPO]` `identity-types.ts`).
- `[INFERENCE]` **No reusable correlator exists yet, and that must stay true.** No key material exists (Gate F), so no key can be shared across contexts today; the process-epoch id is opaque, non-persisted, and non-peer-facing by construction (`[REPO]` `ephemeral-clock.ts`); the local revision counter is documented as **not** a global/vector version and **not** a cross-context correlator (`[REPO]` `identifiers.ts`). When Gate F adds derivation, ephemeral-root material must be derived independently of any long-lived root (ADR-0013 §7).
- `[INFERENCE]` **Peer-facing surface is minimized by construction.** `identifiers.ts` rejects email/phone/URL/path shapes; `identity-validation.ts` rejects `did`, `username`, `globalUsername`, `email`, `phone`. An ephemeral identity inherits these boundaries and adds no new peer-facing field.

**Explicitly not done — DIDs rejected for v1 (ADR §18/§19).** No DID method, resolver, DID document, verification method, or service endpoint. Service-endpoint metadata and registry dependence are themselves correlation vectors; FreeLayer adopts the **pairwise principle** (never reuse peer-facing material across contexts) without a DID method. Verifiable Credentials and passkey-as-root remain out of scope.

---

## 6.3 SimpleX incognito / random per-contact profiles / one-time links

**Source** `[VENDOR]` SimpleX Chat's documented model: no user identifiers/accounts by design; **incognito mode** generates a random profile per new contact; connections are established via **one-time invitation links** or long-term contact addresses; identity is per-connection (pairwise) rather than a global account. `[UNCERTAIN]` exact current UI wording and defaults — re-verify against current SimpleX docs/source. Cross-referenced with Briar in the RESEARCH-ID-01 competitor matrix.

**Distinctions extracted (do not copy without analysis):** SimpleX conflates, at the product layer, several ideas that FreeLayer keeps **separate**:

1. `[INFERENCE]` **Temporary presentation** (what name/avatar a peer sees for one connection) — in FreeLayer this is an **alias/persona** concern (`not_implemented_tech_id_05_06`), *not* an identity root.
2. `[INFERENCE]` **Per-contact presentation** (a distinct random profile per contact) — this is the **pairwise-relationship** placeholder (§6.2), *not* an identity root.
3. `[INFERENCE]` **Independent identity root** (a separate authority context with its own lifetime) — this is what TECH-ID-04 actually builds (`ephemeral_current_process`).
4. `[INFERENCE]` **Long-term addressability** (a reusable link/address others can keep) — deliberately **absent** from an ephemeral identity: it has no long-term address, no reusable link, no cross-restart validity (`crossRestartValidity: false`).

**Inference → what TECH-ID-04 adopts and rejects:**

- `[INFERENCE]` **Adopt:** the *no-account, no-global-identifier, pairwise-by-default* stance, and the idea that a fresh context should not carry a durable global handle.
- `[INFERENCE]` **Reject / diverge:** SimpleX incognito is primarily a **per-contact presentation** feature layered on a still-persistent app profile/database. FreeLayer's ephemeral identity is a **process-scoped, non-persistent, non-recoverable root**, not a presentation toggle. We do **not** copy "random per-contact profile" as if it were an identity root, and we make **no** long-term-address affordance. The independence is at the *root* layer, and it is bounded to the current process.

**Explicitly not done.** No one-time-link / invitation payload is built (Gate E), no persistent profile database, no contact address. The comparison informs the *conceptual separation* only.

---

## 6.4 Expiration vs erasure — NIST media-sanitization + Signal disappearing-message limits

**Source** `[STANDARD]` NIST SP 800-88 (Guidelines for Media Sanitization): clear vs purge vs destroy; sanitization is about *media*, and residual data can survive in copies, caches, wear-levelled/flash cells, and backups. `[VENDOR]` Signal's disappearing-messages and delete-for-everyone features: they are best-effort UI/state operations, not guaranteed removal — screenshots, a compromised endpoint, another linked device, notification history, or backups can retain content; delete-for-everyone depends on cooperating clients and time windows. `[UNCERTAIN]` exact Signal timing/quirks — re-verify. Both consulted offline.

**Principles extracted (evidence):**

1. `[STANDARD]` **Lifecycle expiry ≠ media sanitization.** Marking a record expired changes application state; it does not sanitize the media (RAM pages, swap, caches) the data may still occupy.
2. `[STANDARD]` **Clearing process memory ≠ a forensic wipe.** Dropping references and letting the runtime reclaim memory is not equivalent to overwriting media; the JS/OS runtime provides no guarantee that a given byte is overwritten or unrecoverable.
3. `[VENDOR]` **Local deletion ≠ remote deletion.** Removing data on one endpoint does not remove copies already delivered elsewhere; "delete everywhere" is best-effort and cooperation-dependent.
4. `[VENDOR]` **Another device / camera / crash-dump / compromised endpoint can retain data.** Screenshots, second linked devices, OS crash dumps, diagnostics, and notification history all sit outside the identity module's reach.

**Inference → how TECH-ID-04 frames its own expiry/destruction honestly:**

- `[INFERENCE]` **Expiry ends authority; it is not erasure.** When an ephemeral root expires or is explicitly ended, its **operational authority** stops fail-closed (further operations throw `expired` / `destruction`). This is a *state and authority* boundary, deliberately **not** a claim of media sanitization.
- `[INFERENCE]` **We describe destruction in authority terms only.** The design avoids "auto-wipe / vanishing / self-erasing identity" language. Clearing process memory is best-effort at the application layer; the JS runtime and host OS provide no guaranteed overwrite, so we make no such guarantee. (See the explicit "no forensic erasure" limitation.)
- `[INFERENCE]` **Local destruction deletes nothing remote.** Ending an ephemeral root cannot delete anything already sent to a peer, relay, notification surface, or backup. There is no remote-deletion channel (network is structurally unavailable in this module).
- `[INFERENCE]` **Out-of-reach retention is disclosed, not defended.** Screenshots, a second device, crash dumps/diagnostics, swap, and compromised endpoints are explicitly out of scope for the identity module (they are Secure Device / external, or inherent OS behavior). A short lifetime does **not** prevent external observation.

**Explicitly not done.** No memory-scrubbing/overwrite primitive is claimed (the runtime cannot guarantee it); no crash-dump suppression (external/OS); no remote deletion; no screenshot prevention (external Secure Device). The module reports destruction honestly as an authority/state transition.

---

## 6.5 Repository patterns reused from this monorepo

`[REPO]` TECH-ID-04 **reuses proven local patterns** already validated in `@freelayer/privacy`, `@freelayer/storage`, `@freelayer/rooms`, and the TECH-ID-03 identity scaffolding, rather than inventing new machinery.

1. **Injected clock + injected ids; pure deterministic reducers.**
   - Evidence `[REPO]`: `identity-reducer.ts` is pure — "no storage/network/notification/AI/endpoint/crypto, no randomness, no clock call — injected ids + clock only; source state and command are never mutated; deterministic output; exhaustive command handling; revisions increment by one; a failed operation returns NO partial state (it throws)." `ephemeral-clock.ts` defines `IdentityLocalClockV1.nowLocal()` and `parseLocalClockMs` / `localClockLabel` over a `local:<ms>` label.
   - Reuse `[INFERENCE]`: ephemeral lifetime/expiry decisions are computed from the **injected** clock and the **injected** process epoch, never from an ambient `Date.now()` inside a reducer. Local time is treated as *untrusted local time*, not global truth (see clock-rollback handling, threat category (c)).

2. **Memory / null repositories; nothing persistent.**
   - Evidence `[REPO]`: `identity-repository.ts` — `InMemoryLocalIdentityRepositoryV1` and `NullLocalIdentityRepositoryV1`; "MEMORY-ONLY or NULL — no disk, no browser storage, no database, and no encrypted storage." A `null`-classed vault is never retained even in-memory; the Null repo "retains nothing and never claims recoverability."
   - Reuse `[INFERENCE]`: an ephemeral root is at most memory-only for the current process and is never eligible for persistent storage; `persistence_forbidden` names the rejection if persistence is ever requested. This matches "no restart restoration."

3. **`PolicyDecision` provenance + exact side-effect scope (`@freelayer/privacy`).**
   - Evidence `[REPO]`: `packages/privacy/src/index.ts` holds a module-private `WeakSet<PolicyDecision>` (`issuedDecisions`); only `issuePolicyDecision(...)` registers a decision and `isPolicyDecision(value)` authenticates by membership — "forged look-alikes fail by construction." Each decision carries an exact `sideEffect` scope; `identity-repository.ts` re-checks authenticity and an `identity.` scope prefix independently.
   - Reuse `[INFERENCE]`: every ephemeral operation must present an **authentic, allowed, exact-scope** decision; a stale/mismatched decision is rejected (`decision_mismatch`). An id, label, `RoomMemberRef`, or DevicePosture never substitutes for a decision.

4. **`StoragePolicy` / `MetadataPolicy` mode-driven minimization; DevicePosture only tightens.**
   - Evidence `[REPO]`: `identity-policy.ts` is a pure, deterministic, fail-closed resolver keyed by `PrivacyMode` × operation; strict modes (`ghost`, `bunker`, `emergency`) force `null` persistence and/or deny expansive create operations; `network/notification/ai/identityProofing/crypto/recovery` are hard-coded unavailable; "DevicePosture may only TIGHTEN … it NEVER grants an identity operation." Unknown mode/operation → deny (`unknown_input`).
   - Reuse `[INFERENCE]`: ephemeral creation is policy-gated on the same fail-closed resolver; DevicePosture/RoomOS role can only *restrict*, never *authorize*, creation. `policy_denied` names a mode/policy rejection.

5. **Revision handling + explicit lifecycle reducers.**
   - Evidence `[REPO]`: `identifiers.ts` — `IdentityLocalRevision` is "a POSITIVE LOCAL optimistic-concurrency counter … NOT a timestamp, NOT a global version, NOT a vector clock, NOT tamper resistance, NOT synchronization"; `identity-lifecycle.ts` uses per-aggregate transition tables where unknown/terminal states throw.
   - Reuse `[INFERENCE]`: ephemeral state transitions (active → expired/ended) use the same explicit-transition, no-silent-default, terminal-is-terminal discipline; a tombstoned/ended ephemeral root cannot be reactivated (`orphan_state` / `destruction`).

6. **Sentinel-leak tests + content-free error/audit conventions (guardrail style).**
   - Evidence `[REPO]`: `identity-errors.ts` carries an error-code union + a single static `SAFE_IDENTITY_REJECTION` message and forbids passing ids/labels/room refs/raw command/state/secret-like values or **the leak sentinel** into an error. `ephemeral-errors.ts` mirrors this: codes + a static `SAFE_EPHEMERAL_REJECTION` message, "never an id, local label, room/member ref, deadline (where unnecessary), process epoch, raw command/state, or the leak sentinel." The repo's `tests/security-regression/**` suites assert forged decisions fail and secret-shaped sentinels never leak.
   - Reuse `[INFERENCE]`: ephemeral errors/audit must stay content-free and sentinel-safe; the dedicated `security-regression/identity/ephemeral/**` suite (sentinel-leak, decision authenticity, expiry/epoch/rollback, promotion/export/recovery refusal, memory/null hardening) is the primary TDD follow-up. **It does not exist yet** (see Limitations).

---

## Sources (all consulted offline — re-verify)

- `[STANDARD]` NIST SP 800-63-4 (63 / 63A IAL / 63B authenticator lifecycle & AAL / 63C FAL).
- `[STANDARD]` NIST SP 800-88 (media sanitization: clear/purge/destroy; residual data in copies/caches/backups).
- `[STANDARD]` W3C DID Core; W3C Controlled Identifier / verification-method model; W3C privacy guidance on correlation & pairwise identifiers (also OIDC/SAML pairwise subject identifier concept).
- `[VENDOR]` SimpleX Chat (no accounts; incognito random per-contact profiles; one-time invitation links vs long-term addresses) — `[UNCERTAIN]` current defaults/wording.
- `[VENDOR]` Signal (disappearing messages; delete-for-everyone limits; screenshot/second-device/backup retention) — `[UNCERTAIN]` current timing details.
- `[STANDARD]` OWASP Logging Cheat Sheet / ASVS V7 (content-free errors, no raw object serialization, stable reason codes) — inherited from TECH-ID-03.
- `[REPO]` (verified directly): `packages/identity/src/ephemeral/{ephemeral-clock,ephemeral-errors}.ts`, `packages/identity/src/{identity-types,identity-reducer,identity-policy,identity-repository,identifiers,identity-lifecycle,identity-validation}.ts`, `packages/privacy/src/index.ts`, `packages/storage/src/policy.ts`, `packages/privacy/src/metadataPolicy.ts`, `docs/adr/ADR-0013-identity-firewall-architecture.md`, `docs/IDENTITY_ARCHITECTURE.md`, `docs/IDENTITY_FIREWALL.md`, `docs/research/{LOCAL_IDENTITY_SCAFFOLDING_IMPLEMENTATION_RESEARCH,IDENTITY_STANDARDS_RESEARCH}.md`, `docs/audits/RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md`.

## Decisions adopted for TECH-ID-04

1. `[INFERENCE]` An ephemeral identity is an **independent root** (`rootKind: "ephemeral_current_process"`) in a **separate module**, never a long-lived root with a hidden flag.
2. `[INFERENCE]` **Current-process only:** bound to an opaque, non-persisted, non-peer-facing process epoch with `crossRestartValidity: false`; a mismatch is treated as expired/destroyed (no restart restoration).
3. `[INFERENCE]` **Bounded local lifetime** enforced against an injected clock, with conservative engineering-default limits (min 60s / default 1h / max 24h; ≤ 8 concurrent active ephemeral roots) documented as **engineering defaults, not security guarantees**.
4. `[INFERENCE]` **No recovery, no promotion, no export, no persistence, no synchronization** — each has a named refusal code; total loss on expiry/process-end is the intended, disclosed trade-off.
5. `[INFERENCE]` **Never reuse peer-facing material from any long-lived root** (pairwise principle): no shared identifiers, aliases, labels, future keys, room/device ids, metadata, trust records, or service endpoints.
6. `[INFERENCE]` **Destruction is an authority/state transition, described honestly** — not media sanitization, not remote deletion, not screenshot/endpoint protection.
7. `[INFERENCE]` **Reuse existing guardrails:** injected clock/ids, pure reducer, memory/null repos, exact-scope authentic `PolicyDecision`, fail-closed mode policy (DevicePosture only tightens), explicit lifecycle transitions, content-free sentinel-safe errors/audit.

## Rejected implementation approaches (and why)

- `[INFERENCE]` **Ephemeral as a flag on `LocalIdentityRootV1`** — rejected; a flagged long-lived root invites accidental promotion, shared material, and persistence. Independence at the `rootKind`/module level is the boundary.
- `[INFERENCE]` **Ephemeral as a persona/alias/guest name** — rejected as a category error; presentation is TECH-ID-05/06, not an identity root.
- `[INFERENCE]` **Any promotion/export/"keep this identity" path** — rejected; promotion would import a non-recoverable, process-scoped context into a persistent root and silently defeat both its unlinkability and its bounded lifetime.
- `[INFERENCE]` **Persisting or syncing ephemeral state, or restoring after restart** — rejected; contradicts "current-process only." Persist/sync/restore requests fail closed.
- `[INFERENCE]` **Trusting local wall-clock time as global truth** — rejected; time is injected and treated as untrusted (rollback/forward and suspended-process cases are rejected, not assumed benign).
- `[INFERENCE]` **Claiming memory erasure / "vanishing identity"** — rejected as an overclaim; the runtime cannot guarantee overwrite. Destruction is described as an authority/state change only.
- `[INFERENCE]` **Deriving ephemeral material from a long-lived root (future Gate F)** — pre-emptively rejected; would re-link contexts (§6.2).

## Limitations / unresolved limits

- `[UNCERTAIN]` **Standards not live-verified.** All external claims (§6.1–6.4) are from prior knowledge; re-verify against primary sources before relying on them.
- **No anonymity guarantee.** An ephemeral identity changes local identity-root scope only; it does not hide IP/network metadata, transport, or endpoint observation. It is not proof of anonymity.
- **No forensic erasure; no guaranteed memory scrub.** Expiry/destruction ends authority; it does not sanitize media. The JS/OS runtime provides no overwrite guarantee (NIST SP 800-88 concerns are out of the module's reach).
- **No remote deletion.** Local destruction deletes nothing already delivered to peers, relays, notification surfaces, or backups.
- **No cryptographic unlinkability.** No key material exists (Gate F); "independent root" is a structural/organizational property today, not a cryptographic one. Same-process observation and endpoint compromise can still correlate.
- **No endpoint guarantee.** Screenshots, second devices, crash dumps/diagnostics, swap, and compromised endpoints are external (Secure Device) or inherent OS behavior; a short lifetime does not prevent them.
- **Lifetime limits are engineering defaults.** The min/default/max durations and concurrency cap resist accidental misuse and resource exhaustion; they are not security guarantees and may be tuned only with documented reasoning + tests.
- **No dedicated ephemeral tests yet.** The `security-regression/identity/ephemeral/**` and `privacy-regression/identity/ephemeral/**` suites still need authoring (the primary TDD follow-up).
- **Local-only, no distributed guarantees.** Ending an ephemeral root is authoritative only for the current process/vault; there is no synchronization or distributed revocation (Gate H).
- **Not safe for real secrets.** Until reviewed identity/crypto (Gate F) and, where relevant, an endpoint integration ship, ephemeral identities must not be treated as a safe home for information whose exposure would cause real harm.
