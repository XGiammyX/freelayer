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
15. Sensitive content must never be rendered directly by app views — future UI renders it only through `<ProtectedContent />` or an equivalent policy-controlled surface ([PROTECTED_CONTENT_POLICY.md](PROTECTED_CONTENT_POLICY.md), [ADR-0012](adr/ADR-0012-endpoint-defense-layer.md)). *(Documented now; component is a Gate K deliverable.)*

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

**Current enforcement status (Phase 1 baseline):** `scripts/check-boundaries.mjs` statically verifies rules 1/12 (apps may import only `ui`/`sdk`/`core`/`privacy`; per-package allowed-import lists encode the layering) and runs in CI plus `pnpm audit:privacy`, alongside the external-assets, telemetry, and forbidden-storage guards (rules 7–10). Side-effect scaffolding in `@freelayer/storage` and `@freelayer/transports` rejects calls without a valid `PolicyDecision` at runtime (rule 6), verified by unit tests. One structural note: the `PolicyDecision` *contract* is defined in `packages/privacy` — so side-effect modules can verify decisions without importing core (dependencies stay downward) — and `packages/core` re-exports it for apps and the SDK. These guardrails are a baseline, not a security proof: they catch accidental bypass, not determined circumvention.

> **TODO (mechanical enforcement — planned at Gate A, completed by Phase 10, [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)):**
>
> - enforce dependency direction through lint/build rules
> - make side-effect modules require `PolicyDecision` types at compile time
> - add forbidden-import rules so apps cannot import `storage`/`transports`/`crypto`/`ai` directly

## Endpoint Defense Layer / ScreenShield

*(Official pillar — [ADR-0012](adr/ADR-0012-endpoint-defense-layer.md). Design only; implementation blocked by Gate K.)*

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

| App | Role | Notes |
| --- | --- | --- |
| `apps/web` | React + Vite client, PWA-capable | No external assets; strict CSP; offline-first |
| `apps/desktop` | Tauri shell wrapping the web client | Adds OS keychain access, filesystem capsule import/export, future Ghost Vault support |
| `apps/docs` | Documentation site | Static, no analytics, no external fonts |
| `apps/relay` | Optional self-hostable blind relay | Store-and-forward of opaque ciphertext only; never required; anyone can run one |

## Packages

| Package | Responsibility |
| --- | --- |
| `core` | Wires policy engines to features; owns the operation pipeline (validate → policy check → execute → audit) |
| `crypto` | Facade over vetted primitives; key derivation, sealing/unsealing capsules — **design only until [CRYPTO_DESIGN.md](CRYPTO_DESIGN.md) is reviewed** |
| `protocol` | Capsule wire format, schema versioning, canonical encoding |
| `capsules` | Capsule lifecycle: create, bundle, spool, inbox, deduplication |
| `rooms` | Sovereign Rooms object model: messages, notes, docs, tasks, decisions, polls, operation log |
| `storage` | Storage policy engine: encrypted persistent / memory-only / null backends, cache rules, emergency wipe |
| `transports` | `Transport` interface + adapters: relay, QR, file, LAN; future Tor/proxy/radio |
| `privacy` | Privacy Modes engine and metadata firewall policies |
| `security` | Hardening utilities, input validation helpers, regression guards, audit hooks |
| `ai` | Optional local-AI adapters behind AIPolicy; disabled by default |
| `ui` | Shared components (Tailwind, shadcn/ui-compatible), no remote assets |
| `sdk` | Public, stable surface for third-party tools building on FreeLayer |

## Future platform direction

- **Desktop first** (Tauri) because Ghost Vault and filesystem transports need OS integration.
- **PWA** for reach, with documented limitations (storage eviction, weaker isolation).
- **Mobile** is a research item — likely Tauri mobile or native shells over the same packages. *(TODO research)*

## Risks

- **Policy-engine bypass**: a feature performing side effects without consulting core policy. Mitigation: side-effect capable modules (storage, transports, ai) accept operations only from `core`; enforced by lint rules and reviews. *(TODO: enforce mechanically)*
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
