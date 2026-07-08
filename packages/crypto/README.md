# @freelayer/crypto

**Status: interfaces plus `UnimplementedCryptoProvider`, which throws on every call. No cryptographic code exists, by policy (ADR-0004).**

This package will be the single facade for all cryptographic operations: sealing/unsealing capsules, key derivation, signing. Nothing else in the workspace may perform crypto directly, and apps never import this package.

Before any code lands here:

1. [docs/CRYPTO_DESIGN.md](../../docs/CRYPTO_DESIGN.md) must specify the construction with cited prior art.
2. Elevated review per [GOVERNANCE.md](../../GOVERNANCE.md) and [docs/CONTRIBUTING_SECURITY.md](../../docs/CONTRIBUTING_SECURITY.md).
3. Test vectors accompany every primitive.

**No custom cryptography. Established, reviewed primitives only.**
