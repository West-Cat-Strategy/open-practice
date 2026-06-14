import { Buffer } from "node:buffer";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import type { HeadObjectCommandOutput } from "@aws-sdk/client-s3";
import { z } from "zod";
import { ApiHttpError } from "../http/response.js";
import type { ApiRouteDependencies } from "./types.js";

const checksumSha256HexSchema = /^[a-fA-F0-9]{64}$/;
export const MAX_UPLOAD_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_FILENAME_LENGTH = 255;
const MAX_UPLOAD_CONTENT_TYPE_LENGTH = 120;

const visibleAsciiPattern = /^[\x20-\x7E]+$/;
const contentTypePattern =
  /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*(?:\s*;\s*[A-Za-z0-9!#$&^_.+-]+=[A-Za-z0-9!#$&^_.+-]+)*$/;

export const uploadFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_UPLOAD_FILENAME_LENGTH)
  .refine((value) => visibleAsciiPattern.test(value), {
    message: "filename must not contain control characters",
  })
  .refine((value) => sanitizeUploadFilenameSegment(value).replaceAll("_", "").length > 0, {
    message: "filename must contain at least one storage-safe character",
  });

export const uploadContentTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_UPLOAD_CONTENT_TYPE_LENGTH)
  .refine((value) => visibleAsciiPattern.test(value), {
    message: "contentType must not contain control characters",
  })
  .refine((value) => contentTypePattern.test(value), {
    message: "contentType must be a valid MIME content type",
  });

export function sanitizeUploadFilenameSegment(filename: string): string {
  return filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, MAX_UPLOAD_FILENAME_LENGTH);
}

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

export function normalizeUploadSizeBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ApiHttpError(
      400,
      "INVALID_FILE_SIZE_BYTES",
      "fileSizeBytes must be a positive integer byte count",
    );
  }
  if (value > MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new ApiHttpError(
      413,
      "UPLOAD_SIZE_LIMIT_EXCEEDED",
      "Uploaded file exceeds the maximum allowed size",
      { maxFileSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES },
    );
  }
  return value;
}

export async function verifyUploadedObject(
  s3: NonNullable<ApiRouteDependencies["s3"]>,
  input: { storageKey: string; checksumSha256: string; expectedSizeBytes: number },
): Promise<void> {
  const expectedChecksum = sha256HexToBase64(input.checksumSha256);
  const expectedSizeBytes = normalizeUploadSizeBytes(input.expectedSizeBytes);
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
  if (typeof result.ContentLength !== "number") {
    throw new ApiHttpError(
      409,
      "UPLOAD_SIZE_UNAVAILABLE",
      "Uploaded object size was not available for verification.",
    );
  }
  if (result.ContentLength !== expectedSizeBytes) {
    throw new ApiHttpError(
      400,
      "UPLOAD_SIZE_MISMATCH",
      "Uploaded object size did not match the expected byte count.",
      { expectedSizeBytes, actualSizeBytes: result.ContentLength },
    );
  }
  if (s3.serverSideEncryption && result.ServerSideEncryption !== s3.serverSideEncryption) {
    throw new ApiHttpError(
      409,
      "UPLOAD_ENCRYPTION_MISMATCH",
      "Uploaded object encryption did not match the configured server-side encryption setting.",
    );
  }
}
