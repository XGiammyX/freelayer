# TECH-ID-05 — Per-Contact Alias Threat Model

> **Sourcing caveat (read first).** Internet access was likely unavailable while preparing this document. External references (Unicode UAX #15 normalization, UTS #39 confusables/mixed-script, W3C pairwise-identifier guidance, SimpleX, Briar) were consulted **offline, from prior knowledge**, not fetched live, and **must be re-verified against the primary source** before being relied on for a security decision. This is a **documentation-only** threat model: it adds no identity, key, cryptographic alias authenticity, network path, directory, verification, or remote alias exchange, and invents no cryptography. Structural decisions: [ADR-0013](../adr/ADR-0013-identity-firewall-architecture.md) §7–§10 (identifier / persona-alias / pairwise / room-binding models). Companion model: [TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md](TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md).

> [!IMPORTANT]
> Read the **[Honest limitations](#honest-limitations-read-this)** section first. This task covers two **local, non-cryptographic presentation** artifacts, and nothing more:
>
> - A **pairwise presentation alias** is *the local presentation the user intends for exactly one relationship* — local-only in TECH-ID-05 (it is **not** transmitted, negotiated, or authenticated to the peer here).
> - A **local peer label** is *a private label the user assigns to recognize a contact* and is **NEVER sent to the peer** under any mode.
>
> **An alias is not identity, not verification, not authentication, not a public username, not a cryptographic identifier, and does not prove key control.** Aliases are **memory/null only** (never persistent-capable in this task). Text handling is **baseline Unicode NFC normalization + dangerous-control rejection — NOT full confusable/homograph detection.** **DevicePosture is not identity; room membership is not identity proof.** Cryptographic alias authenticity is **Gate F**, any wire/remote alias exchange is **Gate E**, distributed alias revocation/sync is **Gate H**, and endpoint protection is **external** (Secure Device / Endpoint Defense). **No complete mitigation is claimed for any threat below.**

## How to read this model

Each category lists a concrete **attack**, then **why it fails / residual** (the structural, policy, or gate reason the attack is blunted, and what it leaves behind), and the **control** that carries the weight. A control is one of:

| Control kind | Meaning |
| --- | --- |
| **Design** | A structural invariant / type boundary / reducer discipline in the `@freelayer/identity` alias module (opaque non-derived ids, memory/null retention, NFC-normalize + dangerous-control rejection, content-free errors, revision-checked lifecycle, relationship-scoped records, local peer labels that are never peer-facing). |
| **Policy** | A fail-closed decision resolved against `PrivacyMode` + an authentic exact-scope `PolicyDecision` (`@freelayer/privacy`). DevicePosture may only **tighten**, never grant. |
| **Gate** | Not solvable by this module: **Gate F** (crypto / alias authenticity), **Gate E** (wire / remote alias exchange), **Gate H** (sync / distributed revocation), **External** (Secure Device / endpoint), **Inherent** (disclosed trade-off). |

Code anchors used repeatedly: `aliases/alias-identifiers.ts` (`ContactAliasId` `alias-…`, `LocalPeerLabelId` `plabel-…`; opaque, encode **no** display text / root / persona / relationship id / phone / email / username / timestamp / room id / device info / key material; grant **no** authority, prove **no** identity; injected generation via `ContactAliasGeneratedIdsV1`), `aliases/alias-errors.ts` (content-free `ContactAliasErrorCode` + static `SAFE_ALIAS_REJECTION`; codes include `normalization`, `relationship_mismatch`, `duplicate_active`, `revision_mismatch`, `transfer_forbidden`, `remote_sharing_unavailable`, `authentication_unavailable`, `local_peer_label_visibility`). The alias reducer / normalizer / policy / repository follow the **same disciplines as the shipped ephemeral module** — memory/null retention and authentic exact-scope decisions (`ephemeral-repository.ts`), content-minimized summaries (`ephemeral-summary.ts`), DevicePosture-tightens-only (`identity-policy.ts`) — and this document states the invariants they must uphold.

---

## 1. Correlation

The crown-jewel risk: alias material that re-links a user's separate relationships, or links a pairwise context back to a root, to another contact, or to an ephemeral context.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Same alias reused across contacts** as a shared handle | An alias is a per-relationship presentation record scoped to exactly one `PairwiseRelationship` (ADR-0013 §9); it is not a global handle and is not searchable. Residual: a human who *chooses* to reuse the same text for two contacts creates observable-to-self linkage, and any peer who later (Gate E) received both could correlate — behavioral, not an API-provided join. | **Design** (relationship-scoped record) + **Inherent** (user behavior) |
| **Same unusual spelling / capitalization** correlates two relationships | The module stores the presentation as-entered (after NFC + control rejection) and never cross-indexes aliases; it exposes no "find relationships with this alias" query. Residual: distinctive text remains humanly recognizable if two contexts are ever seen side by side — stylometric, out of module scope. | **Design** (no cross-alias index) + **Inherent** (stylometry) |
| **Same avatar / metadata** attached to aliases links contexts | TECH-ID-05 governs alias text and local labels only; avatar/profile is separate presentation state and is not bound into the alias id. The module reuses no peer-facing field across relationships by default. Residual: a user reusing one avatar everywhere is behavioral correlation. | **Design** (no avatar in alias id) + **Inherent** (user behavior) |
| **Alias generated from the root id** (derived presentation) | Ids are opaque and **injected**, not derived; `alias-identifiers.ts` forbids encoding root/persona/relationship material, and ADR-0013 §7 forbids using a display alias as a cryptographic identifier. A future derivation that seeds an alias from a root is a top-severity regression. | **Design** (non-derived opaque id) + **Gate F** (future derivation must stay independent) |
| **Alias id includes relationship / root data** (id is a linking oracle) | `validateContactAliasId`/`validateLocalPeerLabelId` accept only opaque `alias-…` / `plabel-…` bodies; the id carries no timestamp, room, device, or relationship field, so possessing an id reveals no relationship graph. Residual: the *mapping* from id to relationship exists in local memory (endpoint scope, §8). | **Design** (opaque id) |
| **Alias history links identities** (a rename trail ties old↔new) | Rotation replaces the active presentation; the record is revision-checked (`revision_mismatch`) rather than an append-only public log, and history is not peer-facing. Residual: any local retained prior-value list is a local social-graph artifact and must be minimized/tombstoned (§5). | **Design** (revision replace, not public log) + **Inherent** (local history) |
| **Alias reuse across long-lived + ephemeral roots** re-links contexts | Ephemeral roots are independent (`rootKind`, TECH-ID-04); the alias module must not copy an alias or local label from a long-lived relationship into an ephemeral one (`transfer_forbidden`). Residual: independence is structural/organizational, not cryptographic — a user re-typing the same alias re-links behaviorally. | **Design** (no cross-root transfer) + **Inherent** (user behavior) |
| **Alias exported in room bundles** leaks pairwise presentation into a room | Aliases are local presentation, not room state; ADR-0013 §10 requires room export to **not** expose unrelated relationship identifiers, and this task adds no export path (`remote_sharing_unavailable`). Residual: room bundle/export semantics stay deferred (RoomOS/CapsuleNet) and must preserve this. | **Design** (no export) + **Gate E** (bundle semantics deferred) |
| **Alias sync creates a global mapping** across devices | No synchronization exists (Gate H); the repository is memory/null and single-vault (`ephemeral-repository.ts` pattern), so no alias↔relationship map is published anywhere. Residual: a future sync must be per-relationship and must not build a global directory. | **Gate H** (sync deferred) + **Design** (memory/null, single vault) |

---

## 2. Impersonation & spoofing

Alias text is attacker-controllable presentation. The threat is a user acting on a name that *looks* trustworthy.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Visually confusable Unicode** (e.g. Latin/Cyrillic look-alikes) | NFC normalization + control-character rejection run at the boundary (`normalization`), but this is **baseline hygiene, not full confusable detection**. Residual: two glyph-distinct-but-look-alike strings can both be accepted; the alias is never presented as proof of who the peer is. | **Design** (NFC + control rejection) + **Inherent** (no full confusable detection) + **Gate F** (authenticity) |
| **Mixed-script homograph** alias | The normalizer may surface a non-blocking mixed-script *warning* signal, but does not adjudicate identity; a warning is a hint, never an accusation or a verification verdict. Residual: mixed-script text can still be stored and shown. | **Design** (advisory signal only) + **Inherent** (no full UTS #39 skeleton) |
| **Bidi-control manipulation** (RLO/LRO reordering to disguise text) | Bidirectional-format and other dangerous control characters are rejected at input (`normalization`), so an alias cannot be smuggled with reordering controls. Residual: legitimate RTL text handling is a rendering concern; rejection is conservative and may refuse some benign controls. | **Design** (dangerous-control rejection) |
| **Invisible characters** (zero-width / joiners padding an alias) | Zero-width and other invisible/format controls are rejected or stripped by the control-rejection pass; an "empty-looking" or padded alias fails `validation`/`normalization`. Residual: not every codepoint edge case is enumerable offline — see i18n (§6). | **Design** (invisible-control rejection) |
| **Duplicate display name** (two contacts share one alias) | Aliases are not required to be unique across contacts; the UI must therefore never treat the alias string as an identity key. `duplicate_active` guards duplicate *active outgoing* aliases within one relationship, not sameness across relationships. Residual: two contacts can display the same alias — disambiguation is the endpoint UI's job, not a uniqueness guarantee. | **Design** (alias is not a key) + **Inherent** (names collide) |
| **Contact renames alias to resemble another** contact | A local peer label / local alias is the *user's own* naming; a peer cannot rename the user's local label. Any peer-supplied display text (future, Gate E) is untrusted presentation, never verification. Residual: the user can mislabel their own contact and later be confused by it. | **Design** (local labels are user-controlled; peer text untrusted) |
| **User mistakes a local peer label for verified peer identity** | The label is defined as a private recognition aid, never verification; sensitive UI must show verification state (ADR-0013 §12 trust states), not the label, as the identity signal. Residual: UX can still mislead if it renders only the label — a UX obligation (TECH-ID-11/13), disclosed. | **Design** (label ≠ verification) + **UX** |
| **Sensitive confirmation UI displays only the alias** | This model requires that alias text is **never** the sole basis for a sensitive confirmation; verification/key-continuity state carries that weight. Residual: enforcement is at the presentation layer, not in this module — stated as an obligation, not solved here. | **Policy/UX** (alias not sole confirmation basis) + **Gate F** (verification) |

---

## 3. Authority confusion

An alias must never be authority. Every path that lets a name grant, merge, reset, or transfer state is an attack.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Alias grants access** (holding/knowing an alias = permission) | Alias ids "grant NO authority, prove NO identity" (`alias-identifiers.ts`); every mutating operation requires an authentic exact-scope `PolicyDecision`. Residual: none from this vector by construction — an alias never substitutes for a decision. | **Design + Policy** (id ≠ authority) |
| **Alias collision merges contacts** (same text fuses two relationships) | The relationship record — not the alias string — is the identity of a contact; equal aliases never trigger a merge, and operations are keyed to a relationship id (`relationship_mismatch`). Residual: none — merge is not expressible from alias equality. | **Design** (relationship-keyed, not name-keyed) |
| **Alias rename resets block state** | Block state is relationship-scoped and **survives display-alias changes** (ADR-0013 §9); rotating/retiring an alias does not touch block state. Residual: none from this vector by construction. | **Design** (block survives alias change) |
| **Alias rename transfers verification** | Verification binds to relationship-specific key state (Gate F), not to presentation text; changing an alias cannot move or confer a trust state. Residual: verification itself is deferred — the invariant is "presentation change never alters trust." | **Design** (verification ≠ presentation) + **Gate F** |
| **Alias acts as a RoomMemberRef / public username / login id** | ADR-0013 §18 explicitly rejects `RoomMemberRef`-as-identity and a mandatory global username; there is no login and no directory (§7, §19). An alias is local presentation with no room or auth role. Residual: none — the alias has no such surface. | **Design** (no directory/login/room role) |
| **DevicePosture validates an alias** (posture "confirms" a name) | DevicePosture may only **tighten** (`identity-policy.ts`) and is not identity; it can restrict alias operations but can never validate, sign, or bless alias text. Residual: none — posture cannot grant. | **Policy** (posture tightens only) |

---

## 4. Lifecycle

Aliases are created, rotated, retired, and tombstoned. Every state that lingers past its intended scope, or moves where it should not, is an attack.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Multiple active outgoing aliases per relationship** (ambiguous presentation) | Exactly one active outgoing presentation per relationship is enforced; a second active create is rejected (`duplicate_active`). Residual: none from this vector by construction. | **Design** (single active outgoing) |
| **Retired alias reactivated** to resurrect an old presentation | Terminal alias states are terminal; reactivation of a retired/tombstoned record fails (`lifecycle`). A new presentation is a new record, not a revival. Residual: none by construction. | **Design** (terminal transitions) |
| **Old alias visible after rotation** | Rotation replaces the active presentation and revision-checks the write (`revision_mismatch`); the prior value is not the active presentation and is not peer-facing. Residual: any locally retained prior value is a local artifact to minimize (§5). | **Design** (revision-checked replace) |
| **Rotation changes relationship identity** | Rotation changes presentation only; the relationship record and its identity/trust state are untouched (ADR-0013 §9). Residual: none — the relationship is not the alias. | **Design** (presentation ≠ relationship) |
| **Alias moved to another relationship** (retarget a name onto a different contact) | Cross-relationship transfer is refused (`transfer_forbidden` / `relationship_mismatch`); an alias belongs to the relationship it was created under. Residual: a user can *type* the same text into another relationship (a new record), which is behavioral, not a transfer. | **Design** (no retarget) + **Inherent** (retyping) |
| **Alias copied long-lived → ephemeral** (bridges an independent root) | Copying an alias or local label from a long-lived relationship into an ephemeral one is refused (`transfer_forbidden`); ephemeral roots are independent (TECH-ID-04). Residual: behavioral re-entry remains possible and re-links contexts (§1). | **Design** (no cross-root copy) + **Inherent** |
| **Alias persists after root / relationship tombstone** | Tombstoning the relationship (or destroying an ephemeral root) removes its alias and local-label records atomically; an orphaned alias referencing a dead relationship is rejected (`not_found`/`lifecycle`), not left live. Residual: memory-page/endpoint remnants are out of module reach (§8). | **Design** (atomic tombstone; orphan rejection) + **External** (endpoint) |

---

## 5. Privacy & storage

Aliases and labels are privacy-sensitive local metadata. The threat is leakage — to peers, to disk, to logs, to diagnostics, or as a social-graph record.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Local peer labels sent to peers** | Local peer labels are structurally never peer-facing; any code path that would place a label on a peer-bound surface fails (`local_peer_label_visibility`). Residual: none from the module; a future remote-profile feature (Gate E) must keep labels local. | **Design** (label never peer-facing) + **Gate E** |
| **Alias persisted plaintext** to disk | Retention is **memory/null** only (never a persistent sink), mirroring `ephemeral-repository.ts`; strict modes use `null` retention. Residual: OS swap / memory pages are outside the module (§8). | **Design** (memory/null) + **External** (swap) |
| **Alias in logs / notifications / analytics** | Errors are content-free (codes + static `SAFE_ALIAS_REJECTION`; never alias text, label, or ids where avoidable); there is no analytics/telemetry sink and no notification body carries alias text. Residual: third-party/application logging outside the module is not controlled here. | **Design** (content-free errors; no telemetry) + **External** (host logging) |
| **Collision report exposes relationship count** | Any collision/duplicate signal is a boolean-style outcome (`duplicate_active`), not a count or list; exact counts are suppressed in strict modes (per the ephemeral summary discipline). Residual: standard mode may reveal coarse local counts to the local user only. | **Design** (no count leak; strict-mode suppression) |
| **Alias history becomes a social-graph record** | History is not append-only and not peer-facing; rotation replaces rather than accretes, so no durable rename graph is built or shared. Residual: any locally retained prior values must be minimized/tombstoned — a disclosed local-only artifact. | **Design** (replace, not accrete) + **Inherent** (local history) |
| **Alias in crash diagnostics** | Crash/diagnostic capture is OS/runtime behavior outside the module; the module holds aliases in memory and adds no dump hook. Residual: a dump may contain in-memory alias text — external/inherent, not defended here. | **External / Inherent** |
| **Strict modes leak exact alias timestamps** | Strict modes suppress timestamps and exact fields in summaries (as `timestampsAllowed: false` / `exactCountsAllowed: false` do for ephemeral); alias summaries follow the same minimization. Residual: standard mode exposes finer local detail to the local user by design. | **Design** (strict-mode minimization) |

---

## 6. Internationalization

Name handling must not exclude legitimate users, nor overclaim protection, nor turn a hint into an accusation.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Over-restrictive ASCII-only** excludes non-Latin users | The baseline is NFC normalization + dangerous-control rejection, **not** an ASCII allowlist; non-Latin scripts are accepted. Residual: control-rejection is conservative and may refuse some legitimate format characters — a disclosed usability trade-off. | **Design** (Unicode-accepting baseline) + **Inherent** (conservative rejection) |
| **Normalization changes meaning** (NFC alters a legitimate string) | NFC is canonical composition (idempotent for already-composed text) and is applied consistently at one boundary; the stored form is the normalized form. Residual: for a minority of scripts, canonical composition can be surprising — disclosed, and never treated as identity evidence. | **Design** (single consistent NFC pass) + **Inherent** |
| **Script detection false accusations** (flagging benign multilingual names) | Mixed-script detection, where present, emits a **non-blocking advisory signal only**; it never denies the operation nor labels the contact an impostor. Residual: false-positive advisories can annoy legitimate multilingual users. | **Design** (advisory, non-blocking) + **Inherent** (heuristic) |
| **Confusable warning presented as proof of impersonation** | This model requires any confusable/mixed-script warning to be framed as a hint, never as verification or proof; the alias is never verification evidence. Residual: UX must honor this framing (TECH-ID-11/13). | **Design** (hint ≠ proof) + **UX** |
| **Different runtime normalization inconsistent** across platforms | Normalization is pinned to a defined NFC pass rather than relying on ambient locale/runtime collation, so the stored form is deterministic. Residual: platform Unicode-version drift can still differ at the margins — disclosed; verified per platform is a test obligation. | **Design** (pinned normalization) + **Inherent** (Unicode-version drift) |

---

## 7. Remote-protocol limits

TECH-ID-05 is local. The threats here are about *pretending it is remote* — treating a local alias as an authenticated, deletable, revocable remote fact.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Local alias mistaken for an authenticated remote profile** | Aliases are local presentation with no wire format and no authentication (`authentication_unavailable`); the model states plainly that a local alias asserts nothing about the peer. Residual: UX must not render a local alias as a peer-confirmed name — disclosed obligation. | **Design** (local, unauthenticated) + **Gate E/F** |
| **Future peer rejects / ignores an alias rotation** | There is no alias exchange protocol today; a rotation is a local presentation change only (`remote_sharing_unavailable`). Residual: once an exchange exists (Gate E), peers may ignore or lag a rotation — an inherent distributed-state limit. | **Gate E** (no exchange) + **Inherent** (distributed state) |
| **Old peer copy remains** after a local change | The module cannot reach a peer; anything a peer already holds (in a future exchange) is beyond local control. Residual: no "delete on the peer" exists — disclosed. | **Gate H / Inherent** (no remote deletion) |
| **No authenticated alias update** (a peer cannot verify who changed a name) | Alias authenticity/signatures are Gate F; this task derives no key material. Residual: until Gate F, no alias change can be cryptographically attributed — stated, not solved. | **Gate F** (authenticity deferred) |
| **No distributed alias revocation** | Distributed revocation/consistency is Gate H; local alias state is authoritative only for the current local vault (ADR-0013 §19). Residual: a removed/rotated alias may persist on unreachable peers once exchange exists. | **Gate H** (revocation deferred) |

---

## 8. Endpoint limits

The endpoint is outside the module's trust boundary. This section states that plainly rather than pretending otherwise.

| Attack | Why it fails / residual | Control |
| --- | --- | --- |
| **Screenshot reveals alias mappings** | Screenshot / task-switcher preview blocking is an **external** Secure Device capability, hook-only in core. Residual: screenshots and previews can capture alias↔contact mappings. | **External** (Secure Device) |
| **Compromised device reads all local labels** | On a compromised endpoint, memory-resident alias/label state is readable regardless of module design; malware sees what the user sees. Residual: total — the endpoint boundary is not defended by core. | **External** (endpoint) |
| **Keyboard observes input** (a keylogger captures alias text as typed) | Secure-input protection is an external Secure Device capability, hook-only in core; the module never claims input-path protection. Residual: alias text can be captured at the keyboard. | **External** (Secure Device) |
| **Secure Device unavailable** (posture cannot be enforced) | Missing posture cannot *loosen* alias behavior — DevicePosture only tightens; absence fails safe toward restriction, not toward a false "protected" claim. Residual: no endpoint hardening is provided by core. | **Policy** (fail toward restriction) + **External** |

---

## Honest limitations (read this)

**Stated plainly, without hedging:**

- **No cryptographic alias authenticity.** Aliases and local peer labels are local, non-cryptographic presentation metadata. Nothing signs them, and nothing proves who set or changed a name. Authenticity is Gate F and is not present.
- **No full Unicode spoofing prevention.** The module applies baseline NFC normalization and rejects dangerous control characters (bidi/invisible/format). It does **not** perform full confusable/homograph adjudication; visually similar names can still be accepted. A confusable/mixed-script warning is a hint, never proof of impersonation.
- **No remote alias deletion.** Aliases are local. There is no alias exchange, no distributed revocation, and no "delete on the peer." Anything a future exchange delivered would persist beyond local control.
- **No unlinkability guarantee.** Relationship-scoping and opaque non-derived ids reduce alias-driven correlation, but this is a structural/organizational property, not a cryptographic one. Reused text, reused avatars, reused behavior, or a compromised process can still correlate contexts.
- **No endpoint guarantee.** Screenshots, second devices, keyloggers, crash dumps, diagnostics, and swap are external (Secure Device) or inherent OS behavior. Memory/null retention does not stop them.
- **Alias text is never verification evidence.** A local peer label or pairwise alias is a recognition aid and a presentation choice. It is not identity, not authentication, and must never be the sole basis for a sensitive confirmation; verification/key-continuity state carries that weight (Gate F).
- **Not safe for real secrets.** Until reviewed identity/crypto (Gate F) and, where relevant, an endpoint integration ship, aliases and labels must not be treated as a safe home for information whose exposure would cause real harm.

## Top threats — indicative severity / likelihood and resolving control

Severity and likelihood are **indicative pre-implementation judgments**, not measurements — they rank where design and test attention are most needed. "Resolved / bounded by" names the control (Design / Policy / Gate) that carries each item; none is claimed fully solved.

| # | Threat | Severity | Likelihood | Resolved / bounded by |
|---|--------|----------|------------|-----------------------|
| 1 | Alias derived from / encoding root or relationship data re-links contexts — (1) | Critical | Low | **Design** (opaque non-derived id) + **Gate F** (independent derivation); treat any derivation as a top-severity regression |
| 2 | Alias reused across long-lived + ephemeral roots re-links independent contexts — (1) | High | Medium | **Design** (`transfer_forbidden`, no cross-root copy) + **Inherent** (retyping is behavioral) |
| 3 | Confusable / homograph / bidi alias used to impersonate a trusted contact — (2) | High | Medium | **Design** (NFC + dangerous-control rejection) + **Inherent** (no full confusable detection) + **Gate F** |
| 4 | User treats a local peer label / alias as verified identity — (2) | High | High | **Design** (label ≠ verification) + **UX** (verification state is the identity signal) |
| 5 | Local peer label leaked to a peer — (5) | High | Low | **Design** (label never peer-facing; `local_peer_label_visibility`) + **Gate E** |
| 6 | Alias rename resets block state or transfers verification — (3) | High | Low | **Design** (block survives alias change; verification ≠ presentation) |
| 7 | Alias treated as authority / RoomMemberRef / username / login — (3) | High | Low | **Design + Policy** (id ≠ authority; no directory/login/room role) |
| 8 | Alias persisted plaintext, logged, or captured in diagnostics — (5) | Medium | Medium | **Design** (memory/null; content-free errors) + **External** (swap / crash dumps) |
| 9 | Alias exported in room bundles / synced into a global mapping — (1) | Medium | Low | **Design** (no export; memory/null single vault) + **Gate E/H** (bundle & sync deferred) |
| 10 | Over-restrictive normalization excludes legitimate international names — (6) | Medium | Medium | **Design** (Unicode-accepting NFC baseline; advisory-only script signal) + **Inherent** (conservative rejection) |
| 11 | Local alias mistaken for an authenticated / deletable remote profile — (7) | Medium | Medium | **Design** (local, unauthenticated) + **Gate E/F/H** (no exchange / authenticity / revocation) |
| 12 | Endpoint compromise / screenshot reveals all alias↔contact mappings — (8) | High | Medium | **External** (Secure Device) — not defended by core |

## References

- [TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md](TECH_ID_04_EPHEMERAL_IDENTITY_THREAT_MODEL.md) — ephemeral identity model; shared memory/null, content-free-error, and fail-closed disciplines reused here.
- [ADR-0013](../adr/ADR-0013-identity-firewall-architecture.md) — identifier model (§7), persona & alias model (§8), pairwise relationship model (§9: alias may change without changing the relationship; block survives alias change), room-binding model (§10), rejected alternatives (§18), deferred gates (§19).
- [RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md](RESEARCH_ID_01_IDENTITY_THREAT_MODEL.md) — the broader identity threat catalogue (correlation, impersonation, alias, abuse).
- [TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md](TECH_23_SECURE_DEVICE_CONTRACT_THREAT_MODEL.md) — endpoint / DevicePosture boundary (external Secure Device project).
- [../IDENTITY_FIREWALL.md](../IDENTITY_FIREWALL.md) — invariants (DevicePosture ≠ identity; membership ≠ identity; not safe for real secrets).
