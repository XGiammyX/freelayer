# Local Identity Scaffolding — Implementation Research (TECH-ID-03)

> **Sourcing caveat (read first).** Internet access was likely unavailable while preparing this document; external standards and references below were consulted **from prior knowledge**, not fetched live. Every standards claim (NIST, W3C, OWASP, TypeScript behavior) should be **re-verified against the primary source** before it is relied on for a security decision. Evidence (what the standard/repo actually says or what the code actually does) is kept separate from inference (how we chose to apply it). This document informs the **local, non-cryptographic, metadata-only** TECH-ID-03 scaffolding only; it decides nothing that ADR-0013 defers to Gate F (crypto), Gate E (wire formats), or Gate H (synchronization).

## 0. Scope and non-goals

TECH-ID-03 builds the first Identity Firewall code: a local aggregate of private identity roots, optional personas, and pairwise-relationship / room-binding placeholders, with explicit lifecycle validators, policy-gated commands, a pure reducer, and memory/null repositories. It introduces **no** cryptography, key material, signatures, fingerprints, derivation, verification, recovery, invites/QR, per-contact/per-room aliases, device keys/passports, Trust Notebook, DID, key transparency, phone/email, or public directory. This research extracts **design principles** from external standards and **reused patterns** from this monorepo; it does not port any external identity system.

---

## 6.1 NIST identity & authenticator lifecycle boundaries (design principles only)

**Source (prior knowledge, re-verify):** NIST SP 800-63-4 family — SP 800-63 (overview / assurance levels), SP 800-63A (identity proofing / enrollment, IAL), SP 800-63B (authenticators & lifecycle, AAL), SP 800-63C (federation, FAL). Referenced in `docs/research/IDENTITY_STANDARDS_RESEARCH.md` and RESEARCH-ID-01.

**Principles extracted (evidence → what NIST separates):**

1. **Identity proofing is a distinct process from authentication.** Proving *who a real-world subject is* (IAL, 800-63A) is separate from *proving control of an authenticator* (AAL, 800-63B). Collapsing them is a category error.
2. **Authenticator management is not an identity record.** Binding, activation, suspension, revocation, and reset of authenticators (800-63B lifecycle) are operations on *credentials*, not edits to *who someone is*.
3. **Recovery changes assurance.** Account/authenticator recovery is a known assurance-lowering and attack-prone step; recovered access should not silently inherit prior assurance.
4. **Lifecycle states must be explicit.** Enrollment, active, suspended, revoked are named, bounded states with defined transitions — not implicit booleans.
5. **Local control of an identifier is not real-world identity proof.** Holding/operating an identifier says nothing about legal identity, personhood, or the absence of coercion.

**Inference → how TECH-ID-03 applies the principles (without copying government account architecture):**

- **Proofing ≠ authentication ≠ record.** The module has **no proofing** and **no authenticators** at all (Gate F). It models only *local metadata records* and their lifecycles. `identity-types.ts` carries no `verified`/IAL/AAL field; `PRODUCTION_ASSURANCE_STATES` is limited to `unverified_local | compromised_suspected | revoked`, and `identity-validation.ts` `FORBIDDEN_FIELDS` rejects caller-supplied `verified`/`trusted`/`authenticated`. **We deliberately did not adopt NIST IAL/AAL labels** — ADR-0013 §3 forbids claiming assurance we do not meet.
- **Recovery lowers assurance.** The contract keeps `recovery_required` and `recovered_reverification_required` root states, but **TECH-ID-03 exposes no command that reaches them** (`identity-lifecycle.ts` header: "no fake recovery"). This encodes the principle without implementing recovery (Gate F + a dedicated recovery threat review, per ADR §24).
- **Explicit, bounded lifecycles.** `identity-lifecycle.ts` defines transition tables per aggregate (root/persona/relationship/room-binding); unknown source states and terminal (`*_tombstone`) states throw; there is no silent default that returns current state.
- **Identifier ≠ identity.** `identifiers.ts` documents that an id "grants NO authority, proves NO identity"; opaque local ids encode no email/phone/username/device/room meaning.

**Explicitly not done:** no NIST-style relying party, IdP, session, federation/FAL, or authenticator binding was built. We took the *boundary discipline*, not the *architecture*.

---

## 6.2 W3C pairwise-identifier privacy

**Source (prior knowledge, re-verify):** W3C DID Core (pairwise/peer DID discussion), the general W3C/privacy-IG guidance on correlation and pairwise (per-relationship) identifiers, and the pairwise-pseudonymous concept shared with SAML/OIDC pairwise subject identifiers. Cross-referenced with SimpleX (pairwise connection identities) and Briar in the RESEARCH-ID-01 competitor matrix.

**Principles extracted (evidence):**

1. **Globally stable identifiers create correlation.** One identifier reused across relationships lets independent parties (and observers) link a subject's contexts.
2. **Pairwise (per-relationship) identifiers reduce correlation.** A distinct identifier per relationship denies trivial cross-context linking.
3. **Reusing verification material or metadata can defeat pairwise privacy.** Pairwise identifiers are undermined if the *same key*, the *same service endpoint*, or a *shared metadata field* is exposed across relationships — correlation moves from the id to the reused material.
4. **Records should avoid globally reusable peer-facing fields.** Anything a peer sees should be relationship-scoped, not a global handle.

**Inference → how TECH-ID-03 applies the principles (without implementing DIDs):**

- **Relationship-scoped placeholders.** `PairwiseRelationshipV1.peerReferenceState` is an `"opaque_placeholder"`; there is no shared global peer-facing field. `RoomIdentityBindingV1` is room-scoped. The root is `publicExposure: "forbidden"` and never peer-facing.
- **No reusable correlator.** No key material exists yet (Gate F), so no key can be reused across relationships; ADR §7 further requires future derivation to avoid cross-relationship correlation and to never use display aliases as cryptographic identifiers. The local revision counter is documented as **not** a global/vector version — it is not a cross-context correlator.
- **Peer-facing fields are minimized by construction.** `identifiers.ts` rejects email/phone/URL/path shapes; `identity-validation.ts` rejects `did`, `username`, `globalUsername`, `email`, `phone`. Local labels are sensitive local metadata, "never normalized into a public username".

**Explicitly not done — DIDs rejected for v1 (ADR §18/§19 + IDENTITY_ARCHITECTURE decision table):** no DID method, resolver, DID document, or service endpoint. Service-endpoint metadata and registry dependence are themselves correlation vectors; FreeLayer adopts the **pairwise-identifier principle** without a DID method. Verifiable Credentials and passkey-as-root are likewise out of scope.

---

## 6.3 Type-safe lifecycle models in TypeScript

**Source (prior knowledge, re-verify):** TypeScript handbook — discriminated (tagged) unions, control-flow narrowing, exhaustiveness checking via `never`, `strictNullChecks`, and `readonly`/`Readonly<T>`. Mirrors the existing RoomOS membership modules in this repo.

**Principles extracted (evidence):**

1. **Discriminated unions** model "one of a fixed set of shapes" with a literal discriminant (`command`), enabling per-case narrowing.
2. **Exhaustive `never` checks** turn "a new case was added but not handled" into a **compile error** (assign the narrowed value to `const _never: never`).
3. **String-literal unions** enumerate valid states/operations precisely (preferred over `enum`, per the repo TS style).
4. **`strictNullChecks`** forces explicit handling of absent values; **`readonly`** encodes immutability in the type system.

**Inference → how TECH-ID-03 applies them (evidence from the module):**

- **State as literal unions with runtime companions.** `LocalIdentityRootLifecycleV1`, `IdentityPersonaLifecycleV1`, `PairwiseRelationshipLifecycleV1`, `RoomIdentityBindingLifecycleV1`, `IdentityAssuranceStateV1`, and `IdentityOperationV1` are string-literal unions, each paired with a `readonly [...]` constant array for iteration/validation.
- **Commands are a discriminated union.** `LocalIdentityCommandV1` (15 members) discriminates on `command`; there is **no generic patch/update/set/merge** command (`identity-commands.ts` header). Create commands carry only parent refs + optional label; the id is injected.
- **Exhaustive handling.** `identity-reducer.ts` and `identity-validation.ts` both end their `switch` with `const _never: never = ...` — adding a command without a handler fails to compile. `identity-lifecycle.ts` transition tables are `Record<Lifecycle, readonly Lifecycle[]>`, so a new state must be given a transition set.
- **Immutability + null-safety.** All record fields are `readonly`; collections are `readonly T[]`; `withVault` returns a new object (spread) and never mutates input; optional fields (`localLabel?`, `membershipId?`) are added conditionally rather than set to `undefined`.
- **Branded opaque ids.** `identifiers.ts` uses `string & { readonly __brand: unique symbol }` brands so a raw string cannot be passed where a validated id is required; `Brand<...>` from `@freelayer/security` is reused for the narrow room refs.

**Inference — why this matters here:** the type system, not tests alone, enforces that every lifecycle and command is consciously handled. This is the cheapest available guardrail against the biggest scaffolding risk: an unhandled state silently doing the wrong thing.

---

## 6.4 OWASP logging & error-hygiene

**Source (prior knowledge, re-verify):** OWASP Logging Cheat Sheet and OWASP ASVS V7 (Error Handling & Logging) — log events, not secrets; do not serialize raw objects/PII; use stable event/reason codes; sanitize/redact; avoid correlation-rich identifiers in ordinary logs.

**Principles extracted (evidence):**

1. **No secrets or identity content in errors/logs** (keys, recovery material, display content).
2. **No raw object serialization** — dumping an object/command/state can leak fields inadvertently.
3. **Stable reason codes** — machine-readable, content-free codes rather than interpolated user/identity data.
4. **Sanitized / redacted audit events**, and **no correlation-rich identifiers** (ids, labels, room ids) in ordinary logs.

**Inference → how TECH-ID-03 applies them (evidence from the module):**

- **Codes + static messages only.** `identity-errors.ts` carries an `IdentityErrorCode` union and a single static `SAFE_IDENTITY_REJECTION` message; the header forbids ever passing a local label, identifier, room id, relationship data, the raw command, a state dump, an email/phone/username, a secret-like value, or **the leak sentinel** into an error. The `detail` argument is documented as a **caller-controlled static code only**.
- **Failure is safe.** A rejected operation throws **before** persistence and returns **no partial state** (`identity-reducer.ts`, `identity-pipeline.ts`).
- **Redacted audit events.** `identity-audit.ts` emits only `{ operationCategory, outcome, mode, reasonCode, redacted: true }` — no ids, labels, payload, timestamps-by-default, or sentinel; `redacted` is structurally `true`.
- **Content-minimized summaries.** `identity-summary.ts` degrades disclosure by privacy mode: strict modes drop ids/labels/counts down to lifecycle + assurance only; summary reads require their **own** `identity.summary.read` decision.
- **No raw echo.** `identity-validation.ts` "never echoes raw input"; policy `reasonCode`s (`identity_scaffolding_local`, `restrictive_mode_expansive_denied`, `unknown_input`) are stable and content-free.

**Inference — sentinel discipline:** the repo's security-regression suite uses a "sentinel" token that must never appear in any user-visible/serialized output (e.g. `tests/security-regression/link-preview/url-classification.test.ts`). The identity error/audit code is written so that no caller-supplied content — and therefore no sentinel — can reach an error string or audit event; the identity-specific sentinel-leak tests still need to be authored (see limitations).

---

## 6.5 Repository architecture patterns reused from this monorepo

TECH-ID-03 deliberately **reuses proven local patterns** already validated in `@freelayer/privacy`, `@freelayer/storage`, and `@freelayer/rooms` rather than inventing new machinery. Evidence is from the current repo.

1. **`PolicyDecision` provenance + exact side-effect scope (`@freelayer/privacy`).**
   - Evidence: `packages/privacy/src/index.ts` holds a **module-private `WeakSet<PolicyDecision>`** (`issuedDecisions`); only `issuePolicyDecision(...)` (documented "core operation pipeline ONLY") registers a decision, and `isPolicyDecision(value)` authenticates by WeakSet membership — "forged look-alikes fail by construction". Each decision carries a `sideEffect: PolicySideEffectScope` for exact-match checks.
   - Reuse: the privacy scope union was extended with 9 `identity.*` scopes (`identity.root.create`, `identity.root.lifecycle`, `identity.persona.create/lifecycle`, `identity.relationship.create/lifecycle`, `identity.room_binding.create/lifecycle`, `identity.summary.read`). `identity-pipeline.ts` maps each operation to exactly one scope (`SCOPE_FOR_OPERATION`) and requires an authentic, `allowed`, exact-`sideEffect` decision before mutating; `identity-repository.ts` and `identity-summary.ts` re-check authenticity and scope prefix independently. An id / label / `RoomMemberRef` / DevicePosture never substitutes for a decision.

2. **`StoragePolicy` / `MetadataPolicy` mode-driven minimization (`@freelayer/storage`, `@freelayer/privacy`).**
   - Evidence: `packages/storage/src/policy.ts` and `packages/privacy/src/metadataPolicy.ts` resolve behavior per `PrivacyMode`, with memory-only/null persistence and strict-mode minimization.
   - Reuse: `identity-policy.ts` is a pure, deterministic, fail-closed resolver keyed by `PrivacyMode` × `IdentityOperationV1`; strict modes (`ghost`, `bunker`, `emergency`) force `null` persistence and/or deny expansive create operations; `network/notification/ai/identityProofing/crypto/recovery` are hard-coded unavailable. Unknown mode/operation → deny (`reasonCode: "unknown_input"`).

3. **RoomOS membership module shape + memory/null providers (`@freelayer/rooms`).**
   - Evidence: `packages/rooms/src/membership/` is decomposed as `*-types`, `*-commands`, `*-errors`, `*-ids`, `*-policy`, `*-reducer`, `*-pipeline`, `*-redaction`, `*-log` with `RoomMembershipRecordV1` and injected id generators.
   - Reuse: the identity package mirrors this decomposition (types/commands/errors/identifiers/validation/policy/reducer/repository/pipeline/summary/audit). To avoid a **circular dependency** with RoomOS, identity does **not** import RoomOS ids; it defines narrow local brands `RoomLocalIdRef` / `RoomMembershipIdRef` (ADR §10 binding), leaving RoomOS to map its ids at the boundary. Memory/null repositories parallel the storage/RoomOS local providers.

4. **Guardrail style — fail-closed, immutable, injected effects.**
   - Evidence: RoomOS reducers are pure with injected ids/clock, immutable state, exhaustive switches, optimistic-concurrency revisions, and content-free errors with a leak sentinel.
   - Reuse: `identity-reducer.ts` follows exactly this (validate-before-mutate, injected `generatedIds` + `clockValue`, no randomness/clock/I/O, revisions increment by one, no partial state on failure) and uses a **separate local aggregate boundary** (not the RoomOS operation log), per ADR-0013.

5. **Test conventions — `privacy-regression` / `security-regression` + sentinel.**
   - Evidence: `tests/privacy-regression/**` and `tests/security-regression/**` (49 files) organize per-domain suites; `tests/security-regression/policy-decision-authenticity.test.ts` asserts forged decisions fail; sentinel tokens assert non-leakage of secret-shaped content.
   - Reuse (planned): identity's regression suites should follow the same layout — a `security-regression/identity/**` set (policy-decision authenticity, sentinel-leak in errors/audit/summaries, forbidden-field rejection, memory/null persistence hardening) and a `privacy-regression/identity/**` set (mode-driven minimization matrix, lifecycle exhaustiveness). **These do not yet exist** (see §Limitations).

---

## Sources (all consulted from prior knowledge — re-verify)

- NIST SP 800-63-4 (SP 800-63 / 63A IAL / 63B AAL & authenticator lifecycle / 63C FAL).
- W3C DID Core; W3C privacy guidance on correlation & pairwise/pairwise-pseudonymous identifiers (also OIDC/SAML pairwise subject identifier concept); SimpleX & Briar pairwise/local evidence via RESEARCH-ID-01.
- TypeScript handbook: discriminated unions, narrowing, exhaustive `never`, `strictNullChecks`, `readonly`.
- OWASP Logging Cheat Sheet; OWASP ASVS V7 (Error Handling & Logging).
- In-repo (verified directly): `packages/privacy/src/index.ts` (PolicyDecision/WeakSet/scopes), `packages/storage/src/policy.ts`, `packages/privacy/src/metadataPolicy.ts`, `packages/rooms/src/membership/*`, `tests/{privacy,security}-regression/**`, ADR-0013, `docs/IDENTITY_ARCHITECTURE.md`, `docs/research/RESEARCH_ID_01_CONCLUSIONS.md`, `docs/research/IDENTITY_TERMINOLOGY_MODEL.md`.

## Decisions adopted for TECH-ID-03

1. Metadata-only records with explicit, versioned (`schemaVersion: 1`) shapes; no crypto/keys/secrets (Gate F).
2. Discriminated-union commands + exhaustive `never`-checked reducer/validator; no generic patch/update/merge command.
3. Explicit per-aggregate lifecycle transition tables; unknown/terminal transitions deny; recovery/verification states declared but unreachable (no fake recovery/verification).
4. Pairwise/room placeholders that are relationship/room-scoped; private root never peer-facing; no globally reusable peer-facing field.
5. Policy-gated pipeline requiring an authentic, exact-scope `PolicyDecision`; fail-closed policy resolver with mode-driven minimization; memory/null repositories only.
6. Content-free, sentinel-safe errors and redacted audit/summaries; no raw object/command/state serialization.
7. Narrow local room brands to avoid a RoomOS circular dependency; separate local aggregate boundary (not the RoomOS log).

## Rejected implementation approaches (and why)

- **DIDs / DID documents / service endpoints** — method/resolver/registry complexity and endpoint-metadata correlation; adopt the pairwise *principle* instead (ADR §18/§19). Verifiable Credentials and passkey-as-identity-root likewise rejected for v1.
- **Any cryptography now** — keys/signatures/derivation/fingerprints/recovery encryption are Gate F; scaffolding uses literal `not_implemented_gate_f` markers (ADR-0004 no-crypto-before-review).
- **Event-sourcing identity into the RoomOS operation log** — identity uses a **separate local aggregate boundary** (ADR-0013 §17 / reducer header); reusing the RoomOS log would couple identity to room semantics and risk cross-domain leakage.
- **A global mutable "current identity" / ambient default** — rejected; the vault holds immutable collections with **no** ambient/default identity (`identity-types.ts`), preventing accidental global correlation and hidden state.
- **Generic patch/update/set-property/merge commands** — rejected in favor of an explicit discriminated command union, so mass-assignment of authority/secret fields is impossible; `FORBIDDEN_FIELDS` additionally rejects them at the boundary.
- **NIST IAL/AAL assurance labels / a single `verified` boolean** — rejected as dishonest given no proofing/crypto exists; production may only write `unverified_local | compromised_suspected | revoked`.
- **Persisting anything to disk / localStorage / IndexedDB / DB** — rejected; only memory-only or null retention (encrypted persistence is Gate F).

## Limitations

- **Standards not live-verified.** All external claims (§6.1–6.4) are from prior knowledge; re-verify against primary sources before relying on them.
- **No cryptographic guarantees.** Opaque ids imply no randomness/authenticity; the module is explicitly "not safe for real secrets" and not a hostile-input parser (Gate E owns adversarial parsing).
- **No dedicated identity tests yet.** No test imports `@freelayer/identity`; the `security-regression/identity/**` and `privacy-regression/identity/**` suites (sentinel-leak, policy-authenticity, forbidden-field, memory/null hardening, minimization matrix, lifecycle exhaustiveness) still need authoring — the primary TDD follow-up.
- **Local-only, no distributed guarantees.** The revision counter is not a vector clock; there is no synchronization, distributed revocation, or cross-device consistency (Gate H). Local state is authoritative only for the current vault.
- **Personas are organizational, not unlinkable.** This is a deliberate, disclosed limitation (ADR §8/§21); strong separation requires independent roots.
- **Documentation freshness.** ADR-0013 §1 and `IDENTITY_ARCHITECTURE.md` still read "implementation NOT started"; TECH-ID-03 begins local scaffolding and those banners should be updated per ADR-0010 (docs update with code).
