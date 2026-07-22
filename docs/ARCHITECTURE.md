# FreeLayer Architecture

[← Docs Index](README.md) · [ADRs (constitution)](adr/README.md) · [Implementation Gates](IMPLEMENTATION_GATES.md)

> [!NOTE]
> Design-stage document: it describes the **target architecture**, and the parts that exist today are typed scaffolding with fail-closed placeholders — see the [Trust Center](TRUST_CENTER.md) for verified status.

## Purpose

This document describes FreeLayer's high-level architecture: the monorepo layout, the responsibilities of each app and package, and the structural principles that every implementation phase must respect.

## Current status

**Foundation stage.** All 12 packages and 4 app shells exist as typed scaffolding: interfaces, policy placeholders that fail closed, and side-effect stubs that require a `PolicyDecision`. No product behavior is implemented — no crypto, no networking, no rooms, no AI. This document defines the target shape so that early decisions do not paint the project into a corner.

## Architecture decision records

Binding decisions are recorded as ADRs in [docs/adr/](adr/). Accepted ADRs are **constitutionally binding**: where an ADR and any other document conflict, the ADR wins until superseded through governance review. The principles and rules in this document are locked by [ADR-0001](adr/ADR-0001-no-project-owned-infrastructure.md) through [ADR-0012](adr/ADR-0012-endpoint-defense-layer.md); changing them requires a superseding ADR, not an edit.

## Core principles

1. **No central backend.** No component may require infrastructure owned or operated by the FreeLayer project. Optional relays exist, but they are self-hostable, untrusted, and replaceable by non-networked transports (QR, file, USB).
2. **Local-first.** The authoritative copy of every room, message, and document lives on users' devices. Network components only move encrypted capsules; they never hold canonical state.
3. **Transport-agnostic.** All data crossing a device boundary is an encrypted capsule (see [CAPSULENET.md](CAPSULENET.md)). Transports are blind couriers implementing a narrow `Transport` interface; adding a transport must never require protocol changes.
4. **Policy engine at the center.** A core policy engine evaluates every side-effectful operation (persist, notify, connect, preview, sync, run AI) against the active Privacy Mode. Features call the policy engine; they do not implement privacy logic themselves. This is what makes privacy core-enforced rather than UI-enforced.
5. **Crypto behind a facade.** All cryptographic operations flow through `packages/crypto`, so primitives can be swapped (crypto agility) and audited in one place.

## Layering

```
┌─────────────────────────────────────────────────────┐
│ apps: web (PWA) · desktop (Tauri) · docs · relay    │
├─────────────────────────────────────────────────────┤
│ ui · sdk                                            │
├─────────────────────────────────────────────────────┤
│ rooms · capsules · ai            (domain features)  │
├─────────────────────────────────────────────────────┤
│ core: policy engine · orchestration                 │
├─────────────────────────────────────────────────────┤
│ privacy · storage · transports · protocol           │
├─────────────────────────────────────────────────────┤
│ crypto · security                (foundations)      │
└─────────────────────────────────────────────────────┘
```

Dependencies point downward only. `crypto` and `security` depend on nothing else in the workspace. Apps never import `crypto` directly.

## Non-bypassable architecture rules

Binding on every feature, in every phase, with no exceptions short of a superseding ADR ([ADR-0002](adr/ADR-0002-core-enforced-policy-engine.md), [ADR-0003](adr/ADR-0003-capsules-as-only-cross-device-format.md), [ADR-0005](adr/ADR-0005-storage-selected-only-by-policy.md), [ADR-0008](adr/ADR-0008-no-external-assets-or-telemetry.md)):

1. Apps must not call storage, transports, crypto, or AI directly.
2. Apps call core.
3. Core validates input.
4. Core checks active policy.
5. Core delegates to side-effect modules.
6. Side-effect modules reject calls that do not carry a valid `PolicyDecision`.
7. No feature may create its own persistence path.
8. No feature may create its own network path.
9. No feature may load remote assets.
10. No feature may log sensitive data.
11. No feature may generate previews or derived artifacts (thumbnails, indexes, summaries, embeddings) without policy approval.
12. No feature may parse capsule/room/document input outside the approved protocol parser ([CAPSULENET.md](CAPSULENET.md)).
13. No feature may weaken the active device mode or room policy ([PRIVACY_MODEL.md — Policy conflict rule](PRIVACY_MODEL.md)).
14. No feature may bypass the PBOM update requirement ([PBOM.md](PBOM.md), [ADR-0010](adr/ADR-0010-documentation-updated-with-code.md)).
15. Sensitive content must never be rendered directly by app views — future UI renders it only through `<ProtectedContent />` or an equivalent policy-controlled surface ([PROTECTED_CONTENT_POLICY.md](PROTECTED_CONTENT_POLICY.md), [ADR-0012](adr/ADR-0012-endpoint-defense-layer.md)). _(Documented now; component is a Gate K deliverable.)_

### Operation pipeline

Every side-effectful operation follows this pipeline, in this order, with no skippable stage:

```
validate input
  → classify operation
  → resolve active policies (device mode, room, transport, storage, metadata, AI)
  → strictest policy wins
  → create PolicyDecision
  → execute side effect
  → audit result
  → update PBOM/docs/tests when behavior changes
```

The final stage is procedural rather than runtime: any change in observable behavior ships with its PBOM, documentation, and test updates in the same PR ([ADR-0010](adr/ADR-0010-documentation-updated-with-code.md)).

Reviewers enforce these rules through [SECURITY_REVIEW_CHECKLIST.md](SECURITY_REVIEW_CHECKLIST.md) until they are enforced mechanically. This reduces bypass risk as far as practically possible; it does not make bypass impossible, which is why mechanical enforcement remains a tracked requirement.

**Zero-egress default build (TECH-09):** the built app must make no automatic network call on load — enforced by static source + build-artifact + runtime-trap + dependency scans. The app/docs shells load no remote assets (system fonts, local bundle only). Any service-worker network behavior requires a future ADR; none is registered today. App-runtime egress is distinct from development/CI egress (registry/GitHub), documented in [PBOM.md](PBOM.md).

**NetworkPolicy as a side-effect gate (TECH-08):** apps cannot call network APIs directly (forbidden-network CI guard); transport implementations require a `PolicyDecision` scoped exactly to the operation; `resolveNetworkPolicy` defaults deny and fails closed on unknowns; transports are **blind couriers** carrying opaque bytes (ADR-0003), and each carries a metadata leakage label that is part of the policy decision. Only mock/noop transports exist (`performsRealNetwork: false`); real transports are Gate D / Phase 4.

**Zero-persistence assertion layer (TECH-07):** `isZeroPersistenceMode`/`isPersistentBackend`/`assertNoPersistentBackendSelected`/`assertNoPersistentWriteAllowed` make strict-mode invariants callable; provider selection **fails closed** (unknown mode, class, or backend ⇒ deny); the persistent provider is unreachable in Ghost/Bunker by resolver construction and unusable everywhere until Gate F. Apps cannot bypass the pipeline (boundary-checked), and leaving a strict mode has no flush path by structure.

**Provider contract (TECH-06):** providers expose honest `kind`/`persistent`/`implemented` flags and return explicit result objects; `list()` is structurally metadata-only. Memory/null providers are **foundation only** — per-instance, clone-at-boundaries, key-validated; the persistent provider stays blocked until crypto/storage review. Apps never reach providers (boundary rule); tests may import them directly.

**Storage as a side-effect module (TECH-05):** apps never call storage directly (rule 1); provider selection is policy-driven — `resolveStoragePolicy` picks the backend per mode × data class, and providers reject policies resolved for a different backend. Every operation requires a `PolicyDecision` scoped to exactly that operation. The encrypted persistent provider is **deliberately unavailable** (throws) until crypto review (Gate F), so no code path can quietly persist content early.

**RoomOS policy composition + governance (TECH-22).** A single policy decision point: `composeEffectiveRoomPolicyV1` folds all layers (global → emergency → mode → device posture → room policy → membership → object/query → side-effect) with **deny-overrides + strictest-wins**. The DevicePosture contract (`resolveEffectiveDevicePostureV1`) is fail-closed — no provider is integrated, so it yields only `unverified`/`at_risk` — and posture is bound into the TECH-21 authorization revision fence (a posture change invalidates prepared authorization). `resolveSensitiveRoomAdmissionV1` is the admission enforcement point (content denies when the provider is absent). `applyLocalRoomGovernanceUpdateV1` is the tighten-only governance pipeline (owner-only, monotonic `compareRoomPoliciesV1`, execution-time revalidation, separate storage decision). Flow: `apps → sdk/core facade → membership/capability → effective posture → composition → admission → authorization → side-effect policy → execution`. A future **Secure Device adapter** sits behind the Secure Device Integration Gate — not implemented in core ([audits/ROOM_POLICY_COMPOSITION_BOUNDARY_AUDIT.md](audits/ROOM_POLICY_COMPOSITION_BOUNDARY_AUDIT.md)).

**RoomOS local revocation + execution-time authorization (TECH-21).** A prepare-vs-execute split: `prepareRoomAuthorizationV1` binds a `RoomAuthorizationRevisionV1` fence (room + membership revision + local policy revision + lifecycle + privacy mode) and the significant operation data into a non-authoritative, transient context; `assertPreparedRoomAuthorizationCurrentV1` is the FINAL local gate that revalidates that fence against CURRENT state + an authentic exact-scope `PolicyDecision` immediately before the side effect. Membership/policy/mode changes invalidate stale contexts (revision-bound); `applyLocalMembershipRevocationV1` enforces restrictive-direction + owner continuity with no partial effects. There is **no authorization cache** ([audits/ROOM_AUTHORIZATION_CACHE_AUDIT.md](audits/ROOM_AUTHORIZATION_CACHE_AUDIT.md)). Flow: `apps → sdk/core facade → current membership → capability resolution → execution-time revalidation → RoomOS pipeline`. Local consistency only — distributed revocation is Gate H; single-use/nonce-bound decisions are Gate B.

**RoomOS membership + capability scaffolding (TECH-20).** A relationship layer: local, unverified membership records (in `RoomMaterializedState`, memory-only) with placeholder roles as ABAC attributes. `resolveRoomLocalCapabilityV1` composes role eligibility with mode + room-policy tightening into a **non-authoritative** capability descriptor bound to room+membership+revision; `attenuateRoomCapabilityDescriptorV1` narrows only. `assertRoomAuthorizationContextV1` ties a current membership + current descriptor + an **authentic exact-scope `PolicyDecision`** — the descriptor never authorizes on its own. Membership mutations flow through `applyLocalRoomMembershipMutationV1` (separate mutation vs membership-log decisions; owner-continuity enforced) producing versioned events → pure reducer. Flow: `apps → sdk/core authorization facade → rooms/membership`; apps cannot import rooms ([audits/ROOM_MEMBERSHIP_BOUNDARY_AUDIT.md](audits/ROOM_MEMBERSHIP_BOUNDARY_AUDIT.md)). A real capability-token runtime is Gate B; verified identity is Gate G; distributed revocation is Gate H.

**RoomOS privacy-safe query model (TECH-19).** A separate READ boundary: `executeRoomQueryV1` reads a frozen `RoomQuerySnapshotV1` (built from room state + object projection, never the operation log) and returns privacy-safe views. Queries are side-effect-free and deterministic; each requires a `PolicyDecision` scoped to exactly its class (`room.query.*`), distinct from mutation/storage scopes. The dependency direction is `apps → sdk/core query facade → rooms/query → immutable projection`; apps cannot import rooms or traverse the raw projection ([audits/ROOM_QUERY_BOUNDARY_AUDIT.md](audits/ROOM_QUERY_BOUNDARY_AUDIT.md)). No query history/cache/index; no remote query API; a future Gate H (remote/synchronized queries) boundary is left open.

**RoomOS Object Model v1 (TECH-18).** Concrete local objects (message/note/task/decision/poll/file_ref) mutate only through an explicit command union (never a generic patch) via `applyLocalRoomObjectMutationV1`: a room-object mutation decision and a storage (object-log) decision are SEPARATE and each exact-scoped; local `revision` provides optimistic concurrency (not distributed versioning — Gate H); accepted mutations emit versioned object events that deterministically update an immutable projection. Apps cannot import the pipeline or mutate the projection ([audits/ROOM_OBJECT_BOUNDARY_AUDIT.md](audits/ROOM_OBJECT_BOUNDARY_AUDIT.md)). No transport/sync/crypto/identity; a future Gate H integration boundary is left open.

**RoomOS operation log + deterministic replay (TECH-17).** Event creation is a policy boundary (injected clock/ID + authentic room decision); the log append/read/clear are SEPARATE side effects with their own exactly-scoped decisions; the projector is pure and replay validates everything before applying anything (no partial results). Dependency direction stays `apps → sdk/core → rooms` — apps cannot import rooms at all ([audits/ROOMOS_BOUNDARY_AUDIT.md](audits/ROOMOS_BOUNDARY_AUDIT.md)); Gate H (sync) remains open and nothing in the local model precludes it.

**RoomOS foundation (TECH-16).** `packages/rooms` implements Sovereign Rooms as **policy-controlled local state transitions**: room state is created only through the factory, mutated only through operations that pass `assertRoomOperationAllowed` (authentic `PolicyDecision`, exact `room.*` scope), and projected as derived, rebuildable, redacted state. RoomOS does not bypass storage/network/metadata policies — its v1 invariants (no persistence, no sync, no side effects) are matrix rows the validators pin. Sync (Gate H), crypto (Gate F), identity (Gate G) stay deferred; anti-spyware stays externalized. See [SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md).

**Policy Conflict Regression Suite (TECH-14) as the safety layer.** Policy modules must agree with the matrix — and now a contradiction _anywhere_ (engine vs matrix, room loosening, gate treated as executable, docs/PBOM overclaim, forbidden dependency) fails tests or `check:policy-conflicts`. Endpoint-defense integration is an **external system behind a dedicated gate** ([IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md) Gate R), not an active core module: core ships hooks and compatibility contracts only.

**Policy Matrix v1 (TECH-13) as the central contract.** The domain-specific policy engines (Storage/Network/Metadata/LinkPreview/ExternalAsset/Notification) now align with one canonical matrix ([POLICY_MATRIX.md](POLICY_MATRIX.md)) — a typed table and test oracle, deliberately NOT a DSL or policy runtime. Features call the policy layer, never ad-hoc checks; agreement between the matrix and each engine is test-enforced, and `evaluatePolicyMatrix` fails closed on anything without a rule. At Gate B the core operation pipeline should consume matrix rows when issuing `PolicyDecision`s.

**Notification Privacy Model (TECH-12).** Notifications are side-effectful operations: a notification, permission prompt, badge, sound, push, or service-worker call must go through `NotificationPolicy` + an authentic `PolicyDecision` (the notification barrier). NotificationPolicy composes with MetadataPolicy, StoragePolicy, and NetworkPolicy under strictest-wins; apps/features never call a notification API directly (the `check:no-notification-bypass` scanner + runtime trap enforce this). Any service-worker or push notification behavior requires a future ADR/gate. See [PRIVACY_MODEL.md](PRIVACY_MODEL.md).

**Link preview / external asset blocking (TECH-11).** URLs are content-adjacent metadata and remote assets are network side effects, so both are denied by default across the privacy/network/metadata/storage policies. The app UI must never embed a remote asset or auto-fetch a URL; the only sanctioned URL renderer is `renderPlainTextUrlLabel` (domain-only, redacted, no image/favicon/card). A future user-initiated preview must be designed as a side-effectful operation that passes the network barrier — not a convenience that bypasses it. See [METADATA_MODEL.md](METADATA_MODEL.md).

**Metadata Firewall (TECH-10) as a core side-effect gate.** Alongside the storage write barrier and the network side-effect barrier, metadata-producing behavior now passes a third gate: `assertMetadataOperationAllowed` (`packages/privacy`) requires an authentic, exactly-scoped `PolicyDecision` before any receipt/typing/presence/notification/preview/log/audit signal. MetadataPolicy composes with StoragePolicy and NetworkPolicy under strictest-policy-wins; apps cannot emit metadata signals directly (they go through core → policy → the barrier). The barrier reuses the existing WeakSet `PolicyDecision` provenance registry (below) — it is trusted foundation and is **not** replaced. See [METADATA_MODEL.md](METADATA_MODEL.md).

**Mechanical enforcement upgrade (stabilize/harden pass):** the non-bypassable rules are now enforced by **ESLint AST rules**, not only regex scanners — `no-restricted-globals` bans direct storage/network browser globals in shipped `apps/**`+`packages/**` source, and `no-restricted-imports` bans apps importing side-effect packages (rules 1/7/8/12). And `PolicyDecision` is now **unforgeable**: authenticity is a module-private `WeakSet` of issued decisions (not the old, forgeable `Symbol.for` mark), so a structurally-perfect forgery is rejected (rule 6, tested). The CI regex scanners remain as belt-and-suspenders for build output and non-TS surfaces. Remaining Gate-B item: compile-time restriction on provider/transport _construction_ ([PLATFORM_STATE_ANALYSIS.md](PLATFORM_STATE_ANALYSIS.md)).

**Current enforcement status (Phase 1 baseline):** `scripts/check-boundaries.mjs` statically verifies rules 1/12 (apps may import only `ui`/`sdk`/`core`/`privacy`; per-package allowed-import lists encode the layering) and runs in CI plus `pnpm audit:privacy`, alongside the external-assets, telemetry, and forbidden-storage guards (rules 7–10). Side-effect scaffolding in `@freelayer/storage` and `@freelayer/transports` rejects calls without a valid `PolicyDecision` at runtime (rule 6), verified by unit tests. One structural note: the `PolicyDecision` _contract_ is defined in `packages/privacy` — so side-effect modules can verify decisions without importing core (dependencies stay downward) — and `packages/core` re-exports it for apps and the SDK. These guardrails are a baseline, not a security proof: they catch accidental bypass, not determined circumvention.

> **TODO (mechanical enforcement — planned at Gate A, completed by Phase 10, [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)):**
>
> - enforce dependency direction through lint/build rules
> - make side-effect modules require `PolicyDecision` types at compile time
> - add forbidden-import rules so apps cannot import `storage`/`transports`/`crypto`/`ai` directly

## Endpoint Defense Layer / ScreenShield

_(Official pillar — [ADR-0012](adr/ADR-0012-endpoint-defense-layer.md). Design only; implementation blocked by Gate K.)_

**ScreenShield protects sensitive content at the moment it is rendered, copied, input, previewed, cached or exposed to the local device environment.** It covers: screen rendering; screen capture/recording; task switcher thumbnails; remote screen sharing; external displays/casting; clipboard; keyboard/autocomplete/cache; overlays/tapjacking; browser extensions; OS-level capture APIs; protected content rendering; panic/auto-redact flows; and device risk assessment. Design: [ENDPOINT_DEFENSE_MODEL.md](ENDPOINT_DEFENSE_MODEL.md), [SCREENSHIELD.md](SCREENSHIELD.md).

The data lifecycle model this completes:

```text
Data in transit  → CapsuleNet
Data at rest     → Storage Policy
Data in memory/use → Endpoint Defense Layer
Data in UI       → ProtectedContent
Data in rooms    → Sovereign Rooms
Data in AI       → AI Privacy Guard
Data in development → GitHub Trust Pipeline
```

Honest scope: exposure reduction, never capture-proof claims — a compromised endpoint exposes plaintext ([THREAT_MODEL.md](THREAT_MODEL.md)).

## Apps

| App            | Role                                | Notes                                                                                 |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `apps/web`     | React + Vite client, PWA-capable    | No external assets; strict CSP; offline-first                                         |
| `apps/desktop` | Tauri shell wrapping the web client | Adds OS keychain access, filesystem capsule import/export, future Ghost Vault support |
| `apps/docs`    | Documentation site                  | Static, no analytics, no external fonts                                               |
| `apps/relay`   | Optional self-hostable blind relay  | Store-and-forward of opaque ciphertext only; never required; anyone can run one       |

## Packages

| Package      | Responsibility                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`       | Wires policy engines to features; owns the operation pipeline (validate → policy check → execute → audit)                                          |
| `crypto`     | Facade over vetted primitives; key derivation, sealing/unsealing capsules — **design only until [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md) is reviewed** |
| `protocol`   | Capsule wire format, schema versioning, canonical encoding                                                                                         |
| `capsules`   | Capsule lifecycle: create, bundle, spool, inbox, deduplication                                                                                     |
| `rooms`      | Sovereign Rooms object model: messages, notes, docs, tasks, decisions, polls, operation log                                                        |
| `storage`    | Storage policy engine: encrypted persistent / memory-only / null backends, cache rules, emergency wipe                                             |
| `transports` | `Transport` interface + adapters: relay, QR, file, LAN; future Tor/proxy/radio                                                                     |
| `privacy`    | Privacy Modes engine and metadata firewall policies                                                                                                |
| `security`   | Hardening utilities, input validation helpers, regression guards, audit hooks                                                                      |
| `ai`         | Optional local-AI adapters behind AIPolicy; disabled by default                                                                                    |
| `ui`         | Shared components (Tailwind, shadcn/ui-compatible), no remote assets                                                                               |
| `sdk`        | Public, stable surface for third-party tools building on FreeLayer                                                                                 |

## Future platform direction

- **Desktop first** (Tauri) because Ghost Vault and filesystem transports need OS integration.
- **PWA** for reach, with documented limitations (storage eviction, weaker isolation).
- **Mobile** is a research item — likely Tauri mobile or native shells over the same packages. _(TODO research)_

## Risks

- **Policy-engine bypass**: a feature performing side effects without consulting core policy. Mitigation: side-effect capable modules (storage, transports, ai) accept operations only from `core`; enforced by lint rules and reviews. _(TODO: enforce mechanically)_
- **Layer erosion**: apps reaching into low-level packages. Mitigation: dependency-direction lint in CI.
- **Relay centralization drift**: convenience pushing users toward a handful of relays, recreating a de-facto center. Mitigation: first-class non-relay transports, relay diversity documentation.
- **Storage-policy bypass**: a feature writing outside the barrier. Mitigation: forbidden-storage CI guard, exact-scope decisions, default-deny matrix, regression tests.
- **Derived-cache leakage**: previews/thumbnails/AI artifacts outliving stricter sources. Mitigation: cache classes in the policy matrix, denied in strict modes, ScreenShield tightening hooks.
- **Endpoint-derived storage artifacts**: reveal state/capture events as behavioral metadata. Mitigation: dedicated data classes, high-risk denial, no-plaintext audit rule.
- **Debug/log leaks**: content in logs or crash dumps. Mitigation: barrier rejects content-grade payloads in logs/audit classes; debug artifacts denied in v0.
- **Web platform limits**: PWAs cannot fully guarantee storage behavior (eviction, OS swap). Documented in [STORAGE_MODEL.md](STORAGE_MODEL.md).

## Open questions

- Event-sourced operation log vs. state-based CRDT sync for rooms (see [SOVEREIGN_ROOMS.md](SOVEREIGN_ROOMS.md))?
- Does `core` own a single global policy engine, or per-room policy instances?
- How much of the protocol should be language-neutral (schema files) to allow future non-TS implementations?

## Future research required

- CRDT libraries and their metadata leakage characteristics
- Tauri mobile maturity
- Capability-based module isolation in TS (can we make policy bypass a compile error?)

## TODO

- [ ] Decide operation-pipeline API shape (`core`)
- [ ] Define `Transport`, `StorageBackend`, `PolicyDecision` interfaces on paper
- [ ] Dependency-direction lint rule in CI (mechanical enforcement of the non-bypassable rules)
- [ ] Per-package README with responsibility statements (done at scaffold level; expand per phase)
- [x] Architecture decision records directory ([docs/adr/](adr/)) — established in Phase 0.5

## Secure Device admission contract (TECH-23)

FreeLayer core is the future **RATS Relying Party** (RFC 9334) for device posture; it is not a Secure Device provider (that project is external). The data flow is one-directional and fail-closed:

```
future external Secure Device adapter
  → SecureDeviceProviderPortV1 (versioned port; only the Null provider ships)
  → DevicePostureAssessmentV1 (normalized, transient, evidence-free, provenance-checked)
  → resolveSensitiveRoomAdmissionV1 (deterministic 14-step, fail-closed)
  → prepared authorization + exact-scope PolicyDecision (TECH-21)
  → protected operation
```

Admission is an **additional** gate; it never replaces membership, capability, or `PolicyDecision`. Core never parses attestation Evidence, appraises firmware, or infers posture from user agent / OS name / device model / membership. No provider is integrated, so effective posture is `unverified` (or `at_risk`) only.

## Identity Firewall architecture (TECH-ID-02 / ADR-0013)

The Identity Firewall is decided by [ADR-0013](adr/ADR-0013-identity-firewall-architecture.md) and detailed in [IDENTITY_ARCHITECTURE.md](IDENTITY_ARCHITECTURE.md): a **private local identity root** then optional **personas** (not guaranteed unlinkable) then **pairwise per-contact relationships** then **room-scoped aliases** (RoomIdentityBinding) then subordinate revocable **device authorizations** then a local **Trust Notebook** then **one-time invites** then **offline recovery**. Identity is independent of Secure Device: **DevicePosture may tighten an authorized device but never authorizes it or proves identity**. RoomOS membership (`RoomMemberRef`) is a local unverified placeholder, not identity. Cryptography (Gate F), wire formats (Gate E), and synchronization (Gate H) are deferred; **no identity code exists yet**.
