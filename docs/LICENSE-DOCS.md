# Documentation License

## Scope

Unless otherwise stated in an individual file, all **documentation** in this repository — the contents of `docs/` (including `docs/adr/`), root-level Markdown documents (README, CONTRIBUTING, SECURITY, GOVERNANCE, CODE_OF_CONDUCT), and package/app README files — is licensed under the

**Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)** license.

- Human-readable summary: <https://creativecommons.org/licenses/by-sa/4.0/>
- Full legal text: <https://creativecommons.org/licenses/by-sa/4.0/legalcode>

**Code** — everything under `apps/`, `packages/`, `tests/`, and build/CI configuration — is licensed under **AGPL-3.0-or-later**; see the root [LICENSE](../LICENSE) file. Code snippets embedded inside documentation files may be used under either the documentation license or the code license, at your option.

## What CC BY-SA 4.0 means in practice

You may copy, redistribute, translate, and adapt FreeLayer documentation — including commercially — provided that you:

1. **Attribute** — credit the FreeLayer project, link to the source, and indicate whether changes were made.
2. **ShareAlike** — distribute adaptations under CC BY-SA 4.0 (or a compatible license).

Share-alike is a deliberate choice, consistent with the rationale in [ADR-0011](adr/ADR-0011-license-strategy.md): improved or corrected versions of FreeLayer's threat models, privacy models, and design documents should remain available to the community rather than becoming proprietary derivatives.

## Exceptions

- The Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org) v2.1, which carries its own CC BY 4.0 licensing.
- Any file stating a different license in its header follows that statement ("unless otherwise stated").

## TODO

- [ ] **Evaluate whether protocol test vectors and normative spec fragments should be released under CC0 1.0** (public domain dedication) so that independent implementations — including permissively-licensed and commercial ones — can embed them without share-alike obligations. Interoperability may be better served by making the *protocol* maximally reusable while the *implementation* remains strongly copyleft. Decision due before test vectors are first published (Gate E / Phase 4); outcome to be recorded in a new ADR per [ADR-0011](adr/ADR-0011-license-strategy.md).

## Note

This page describes the project's licensing intent in plain language; it is not legal advice, and the license texts themselves are authoritative.
