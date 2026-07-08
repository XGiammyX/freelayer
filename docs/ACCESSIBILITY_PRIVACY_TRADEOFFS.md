# Accessibility / Privacy Trade-offs

## Purpose

FreeLayer is privacy-first, and it will not be careless about accessibility. Endpoint defense creates genuine tensions between the two; this document names them honestly and sets the principle for resolving them.

## Principle

```text
Accessibility must be designed deliberately, not accidentally broken.
Privacy-sensitive accessibility exposure must be explicit and policy-controlled.
```

A protection that silently strips content from assistive technology is a design failure twice over: it excludes users without telling them, and it hides a policy decision inside an implementation detail. The `allowAccessibilityExposure` policy field ([PRIVACY_MODEL.md](PRIVACY_MODEL.md)) exists so the choice is visible, testable, and — where safe — the user's.

## The tensions, named

- **Screen readers need access to text.** A ProtectedContent surface that withholds accessibility labels makes content unreadable for blind users. Default direction: protected/standard levels expose accessibility text under policy; sealed/bunker may restrict it, with the restriction stated in UI.
- **Clipboard restrictions hurt usability** — including for users who rely on copy/paste as an accessibility workflow (switch access, alternative input). Expiring-copy is the middle path where policy allows.
- **Hold-to-view can be impossible** for users with motor impairments. Every hold interaction needs an alternative (e.g. toggle-with-timeout) that preserves the reveal-minimization intent.
- **Short reveal timers can be inaccessible** to slow readers, screen-magnifier users, and users with cognitive disabilities. Timers must be adjustable within policy bounds; "longer reveal" is a legitimate accessibility accommodation the policy schema must support.
- **Animations and blur effects** (panic blur, redaction transitions) can affect users with vestibular disorders and photosensitivity. Respect reduced-motion preferences; redaction must not depend on animation to be effective.
- **High-security modes may reduce accessibility — say so.** Bunker/Sealed deliberately disable exposure channels (clipboard, accessibility text, previews) that assistive workflows may rely on. The product must state this plainly at mode selection, not bury it.

## Rules

1. Accessibility exposure of protected content is a **policy decision** (`allowAccessibilityExposure`), never an implementation accident, and follows strictest-wins.
2. Every reveal interaction ships with an accessible alternative that preserves its security intent, or documents why none exists.
3. Reduced-motion and reader/magnifier compatibility are test criteria for ProtectedContent, not afterthoughts.
4. **Users get clear choices where possible**; where a mode removes an accessibility channel deliberately, the UI says so before the user commits to the mode.
5. Accessibility review is part of Gate K exit for ProtectedContent (see [IMPLEMENTATION_GATES.md](IMPLEMENTATION_GATES.md)).

## Honest limits

Assistive technology operates through OS accessibility APIs — the same APIs that accessibility-abusing malware uses (a named threat in [THREAT_MODEL.md](THREAT_MODEL.md)). FreeLayer cannot distinguish a legitimate screen reader from malware wearing one's clothes; policy-controlled exposure is containment, not detection.

## TODO

- [ ] Accessibility-alternative catalog per UX pattern (hold-to-view, timers, section viewing)
- [ ] Assistive-technology test plan (real screen readers, per platform) before ProtectedContent ships
- [ ] Reduced-motion redaction design
