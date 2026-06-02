import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PROVIDER_CONFIG_ENVELOPE_PREFIX = "opencfg:v1:";
const PROVIDER_CONFIG_ALGORITHM = "AES-256-GCM";
const PROVIDER_CONFIG_KEY_BYTES = 32;
const PROVIDER_CONFIG_NONCE_BYTES = 12;

export interface ProviderConfigEncryptionAad {
  firmId: string;
  kind: string;
  key: string;
}

export interface ProviderConfigEncryptionKey {
  key: Buffer;
  kid: string;
}

export interface ProviderConfigEnvelope {
  v: 1;
  alg: typeof PROVIDER_CONFIG_ALGORITHM;
  kid: string;
  nonce: string;
  tag: string;
  ciphertext: string;
}

export interface ProviderConfigCipher {
  kid: string;
  encryptProviderConfig(input: ProviderConfigEncryptionAad & { plaintext: string }): string;
  decryptProviderConfig(input: ProviderConfigEncryptionAad & { encryptedConfig: string }): string;
}

export function providerConfigEnvelopePrefix(): string {
  return PROVIDER_CONFIG_ENVELOPE_PREFIX;
}

export function isEncryptedProviderConfig(value: string): boolean {
  return value.startsWith(PROVIDER_CONFIG_ENVELOPE_PREFIX);
}

function providerConfigAad(input: ProviderConfigEncryptionAad): Buffer {
  return Buffer.from(
    JSON.stringify({
      firmId: input.firmId,
      table: "provider_settings",
      field: "encrypted_config",
      kind: input.kind,
      key: input.key,
    }),
    "utf8",
  );
}

function keyId(key: Buffer): string {
  return createHash("sha256").update(key).digest("base64url").slice(0, 16);
}

function decodeHexKey(value: string): Buffer | undefined {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) return undefined;
  return Buffer.from(value, "hex");
}

function decodeBase64LikeKey(value: string): Buffer | undefined {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(value)) return undefined;
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

export function parseProviderConfigEncryptionKey(rawValue: string): ProviderConfigEncryptionKey {
  const trimmed = rawValue.trim();
  const prefixed = /^(hex|base64|base64url):(.*)$/i.exec(trimmed);
  const encoding = prefixed?.[1]?.toLowerCase();
  const value = (prefixed?.[2] ?? trimmed).trim();
  const decoded =
    encoding === "hex"
      ? decodeHexKey(value)
      : encoding === "base64" || encoding === "base64url"
        ? decodeBase64LikeKey(value)
        : (decodeHexKey(value) ?? decodeBase64LikeKey(value));

  if (!decoded || decoded.byteLength !== PROVIDER_CONFIG_KEY_BYTES) {
    throw new Error(
      "OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY must decode to exactly 32 bytes using base64, base64url, or hex",
    );
  }

  return { key: Buffer.from(decoded), kid: keyId(decoded) };
}

export function isProviderConfigEncryptionKey(value: string): boolean {
  try {
    parseProviderConfigEncryptionKey(value);
    return true;
  } catch {
    return false;
  }
}

export function decodeProviderConfigEnvelope(value: string): ProviderConfigEnvelope {
  if (!isEncryptedProviderConfig(value)) {
    throw new Error("Provider configuration is not an Open Practice encrypted config envelope");
  }
  const encoded = value.slice(PROVIDER_CONFIG_ENVELOPE_PREFIX.length);
  const decoded = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as Partial<ProviderConfigEnvelope>;
  if (
    decoded.v !== 1 ||
    decoded.alg !== PROVIDER_CONFIG_ALGORITHM ||
    typeof decoded.kid !== "string" ||
    typeof decoded.nonce !== "string" ||
    typeof decoded.tag !== "string" ||
    typeof decoded.ciphertext !== "string"
  ) {
    throw new Error("Provider configuration encryption envelope is invalid");
  }
  return decoded as ProviderConfigEnvelope;
}

export function createProviderConfigCipher(
  encryptionKey: ProviderConfigEncryptionKey,
): ProviderConfigCipher {
  return {
    kid: encryptionKey.kid,
    encryptProviderConfig(input) {
      const nonce = randomBytes(PROVIDER_CONFIG_NONCE_BYTES);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey.key, nonce);
      cipher.setAAD(providerConfigAad(input));
      const ciphertext = Buffer.concat([cipher.update(input.plaintext, "utf8"), cipher.final()]);
      const envelope: ProviderConfigEnvelope = {
        v: 1,
        alg: PROVIDER_CONFIG_ALGORITHM,
        kid: encryptionKey.kid,
        nonce: nonce.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
      };
      return `${PROVIDER_CONFIG_ENVELOPE_PREFIX}${Buffer.from(JSON.stringify(envelope)).toString(
        "base64url",
      )}`;
    },
    decryptProviderConfig(input) {
      if (!isEncryptedProviderConfig(input.encryptedConfig)) return input.encryptedConfig;
      const envelope = decodeProviderConfigEnvelope(input.encryptedConfig);
      if (envelope.kid !== encryptionKey.kid) {
        throw new Error("Provider configuration encryption key id does not match this runtime");
      }
      const decipher = createDecipheriv(
        "aes-256-gcm",
        encryptionKey.key,
        Buffer.from(envelope.nonce, "base64url"),
      );
      decipher.setAAD(providerConfigAad(input));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
      try {
        return Buffer.concat([
          decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
          decipher.final(),
        ]).toString("utf8");
      } catch (error) {
        throw new Error("Provider configuration could not be decrypted", { cause: error });
      }
    },
  };
}

export function createProviderConfigCipherFromKey(rawKey: string): ProviderConfigCipher {
  return createProviderConfigCipher(parseProviderConfigEncryptionKey(rawKey));
}
