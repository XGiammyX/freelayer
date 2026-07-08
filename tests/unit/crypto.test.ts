import { describe, expect, it } from "vitest";
import { UnimplementedCryptoProvider, type AlgorithmId, type KeyId } from "@freelayer/crypto";

describe("UnimplementedCryptoProvider", () => {
  it("rejects every operation with a pointer to the design doc", async () => {
    const provider = new UnimplementedCryptoProvider();
    const keyId = "test-key" as KeyId;
    const algorithm = "none" as AlgorithmId;
    const bytes = new Uint8Array([0]);

    await expect(provider.seal({ plaintext: bytes, keyId, algorithm })).rejects.toThrow(
      "Crypto is not implemented. See docs/CRYPTO_DESIGN.md.",
    );
    await expect(provider.open({ sealed: bytes, keyId, algorithm })).rejects.toThrow(
      "Crypto is not implemented",
    );
    await expect(provider.sign({ payload: bytes, keyId, algorithm })).rejects.toThrow(
      "Crypto is not implemented",
    );
    await expect(
      provider.verify({ payload: bytes, signature: bytes, keyId, algorithm }),
    ).rejects.toThrow("Crypto is not implemented");
  });
});
