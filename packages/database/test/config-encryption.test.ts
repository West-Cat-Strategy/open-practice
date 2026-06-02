import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  createProviderConfigCipher,
  decodeProviderConfigEnvelope,
  isEncryptedProviderConfig,
  isProviderConfigEncryptionKey,
  parseProviderConfigEncryptionKey,
  providerConfigEnvelopePrefix,
} from "../src/config-encryption.js";

const rawKey = Buffer.from(
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  "hex",
);
const encodedKey = rawKey.toString("base64url");

describe("provider config encryption", () => {
  it("accepts 32-byte base64url, base64, and hex keys", () => {
    expect(parseProviderConfigEncryptionKey(encodedKey)).toMatchObject({
      kid: expect.any(String),
    });
    expect(parseProviderConfigEncryptionKey(`base64:${rawKey.toString("base64")}`)).toMatchObject({
      kid: expect.any(String),
    });
    expect(parseProviderConfigEncryptionKey(`hex:${rawKey.toString("hex")}`)).toMatchObject({
      kid: expect.any(String),
    });
  });

  it("rejects invalid or incorrectly sized keys", () => {
    expect(isProviderConfigEncryptionKey(encodedKey)).toBe(true);
    expect(isProviderConfigEncryptionKey(Buffer.alloc(31).toString("base64url"))).toBe(false);
    expect(() => parseProviderConfigEncryptionKey("not-a-provider-config-key")).toThrow(
      /exactly 32 bytes/,
    );
  });

  it("round-trips provider config with an envelope that hides plaintext", () => {
    const cipher = createProviderConfigCipher(parseProviderConfigEncryptionKey(encodedKey));
    const plaintext = JSON.stringify({
      senderAddress: "consultations@example.test",
      privateValue: "synthetic-provider-secret",
    });

    const encryptedConfig = cipher.encryptProviderConfig({
      firmId: "firm-west-legal",
      kind: "public_intake",
      key: "consultation",
      plaintext,
    });

    expect(encryptedConfig).toMatch(new RegExp(`^${providerConfigEnvelopePrefix()}`));
    expect(encryptedConfig).not.toContain("synthetic-provider-secret");
    expect(isEncryptedProviderConfig(encryptedConfig)).toBe(true);
    expect(decodeProviderConfigEnvelope(encryptedConfig)).toMatchObject({
      v: 1,
      alg: "AES-256-GCM",
      kid: cipher.kid,
      nonce: expect.any(String),
      tag: expect.any(String),
      ciphertext: expect.any(String),
    });
    expect(
      cipher.decryptProviderConfig({
        firmId: "firm-west-legal",
        kind: "public_intake",
        key: "consultation",
        encryptedConfig,
      }),
    ).toBe(plaintext);
  });

  it("fails decryption when associated provider metadata changes", () => {
    const cipher = createProviderConfigCipher(parseProviderConfigEncryptionKey(encodedKey));
    const encryptedConfig = cipher.encryptProviderConfig({
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "default",
      plaintext: "synthetic-smtp-password",
    });

    expect(() =>
      cipher.decryptProviderConfig({
        firmId: "firm-west-legal",
        kind: "smtp",
        key: "alternate",
        encryptedConfig,
      }),
    ).toThrow(/could not be decrypted/);
  });

  it("returns legacy plaintext config values unchanged", () => {
    const cipher = createProviderConfigCipher(parseProviderConfigEncryptionKey(encodedKey));

    expect(
      cipher.decryptProviderConfig({
        firmId: "firm-west-legal",
        kind: "smtp",
        key: "default",
        encryptedConfig: JSON.stringify({ host: "localhost" }),
      }),
    ).toBe(JSON.stringify({ host: "localhost" }));
  });
});
