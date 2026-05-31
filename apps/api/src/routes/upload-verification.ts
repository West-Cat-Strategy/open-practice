import { Buffer } from "node:buffer";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import type { HeadObjectCommandOutput } from "@aws-sdk/client-s3";
import { ApiHttpError } from "../http/response.js";
import type { ApiRouteDependencies } from "./types.js";

export const checksumSha256HexSchema = /^[a-fA-F0-9]{64}$/;

export function normalizeChecksumSha256(value: string): string {
  if (!checksumSha256HexSchema.test(value)) {
    throw new ApiHttpError(
      400,
      "INVALID_CHECKSUM_SHA256",
      "checksumSha256 must be a 64-character hex SHA-256 digest",
    );
  }
  return value.toLowerCase();
}

export function sha256HexToBase64(checksumSha256: string): string {
  return Buffer.from(normalizeChecksumSha256(checksumSha256), "hex").toString("base64");
}

export async function verifyUploadedObject(
  s3: NonNullable<ApiRouteDependencies["s3"]>,
  input: { storageKey: string; checksumSha256: string },
): Promise<void> {
  const expectedChecksum = sha256HexToBase64(input.checksumSha256);
  let result: HeadObjectCommandOutput;
  try {
    result = await s3.client.send(
      new HeadObjectCommand({
        Bucket: s3.bucket,
        Key: input.storageKey,
        ChecksumMode: "ENABLED",
      }),
    );
  } catch {
    throw new ApiHttpError(
      409,
      "UPLOAD_OBJECT_NOT_FOUND",
      "Uploaded object was not found. Complete the upload before marking it complete.",
    );
  }

  const objectChecksum = result.ChecksumSHA256;
  if (!objectChecksum) {
    throw new ApiHttpError(
      409,
      "UPLOAD_CHECKSUM_UNAVAILABLE",
      "Uploaded object checksum was not available for verification.",
    );
  }
  if (objectChecksum !== expectedChecksum) {
    throw new ApiHttpError(
      400,
      "UPLOAD_CHECKSUM_MISMATCH",
      "Uploaded object checksum did not match the expected SHA-256 digest.",
    );
  }
}
