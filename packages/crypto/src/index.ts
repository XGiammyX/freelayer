/**
 * @freelayer/crypto — cryptography facade. INTERFACES ONLY.
 *
 * NO CRYPTOGRAPHY IS IMPLEMENTED IN THIS PACKAGE, BY POLICY (ADR-0004).
 * Implementation is blocked until docs/CRYPTO_DESIGN.md passes review
 * (Gate F — docs/IMPLEMENTATION_GATES.md). No WebCrypto, no libsodium,
 * no Node crypto, no custom primitives — nothing here claims security.
 *
 * Boundary rules: this package imports no workspace packages, and only
 * @freelayer/core may import it. Apps never touch it
 * (scripts/check-boundaries.mjs).
 */

declare const brandSymbol: unique symbol;
type Brand<T, B extends string> = T & { readonly [brandSymbol]: B };

export type KeyId = Brand<string, "KeyId">;

/**
 * Algorithm identifier — crypto agility from day one (ADR-0004): every sealed
 * or signed artifact names its algorithm so primitives can be migrated.
 */
export type AlgorithmId = Brand<string, "AlgorithmId">;

export interface CapsuleSealRequest {
  readonly plaintext: Uint8Array;
  readonly keyId: KeyId;
  readonly algorithm: AlgorithmId;
}

export interface CapsuleOpenRequest {
  readonly sealed: Uint8Array;
  readonly keyId: KeyId;
  readonly algorithm: AlgorithmId;
}

export interface SignatureRequest {
  readonly payload: Uint8Array;
  readonly keyId: KeyId;
  readonly algorithm: AlgorithmId;
}

export interface VerificationRequest {
  readonly payload: Uint8Array;
  readonly signature: Uint8Array;
  readonly keyId: KeyId;
  readonly algorithm: AlgorithmId;
}

/** The single facade all FreeLayer cryptography will flow through (ADR-0004). */
export interface CryptoProvider {
  seal(request: CapsuleSealRequest): Promise<Uint8Array>;
  open(request: CapsuleOpenRequest): Promise<Uint8Array>;
  sign(request: SignatureRequest): Promise<Uint8Array>;
  verify(request: VerificationRequest): Promise<boolean>;
}

const NOT_IMPLEMENTED = "Crypto is not implemented. See docs/CRYPTO_DESIGN.md.";

/**
 * The only provider that exists today. Every operation throws, so nothing
 * can accidentally ship a code path that believes encryption happened.
 */
export class UnimplementedCryptoProvider implements CryptoProvider {
  seal(_request: CapsuleSealRequest): Promise<Uint8Array> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  open(_request: CapsuleOpenRequest): Promise<Uint8Array> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  sign(_request: SignatureRequest): Promise<Uint8Array> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  verify(_request: VerificationRequest): Promise<boolean> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }
}
