import {
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { InboundEmailParser } from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import type { WorkerJobEnvelope, WorkerJobResult } from "./types.js";

type InboundEmailS3Storage = {
  client: S3Client;
  bucket: string;
  serverSideEncryption?: "AES256";
};

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safePathPart(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 120);
  return normalized || "attachment";
}

function copySource(bucket: string, key: string): string {
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function s3EncryptionOptions(s3: InboundEmailS3Storage) {
  return s3.serverSideEncryption ? { ServerSideEncryption: s3.serverSideEncryption } : {};
}

function rawStorageKeyPrefix(firmId: string): string {
  return `inbound-email/${firmId}/raw/`;
}

function assertRawStorageKey(firmId: string, rawStorageKey: string): void {
  const prefix = rawStorageKeyPrefix(firmId);
  const segments = rawStorageKey.split("/");
  if (
    !rawStorageKey.startsWith(prefix) ||
    rawStorageKey.length <= prefix.length ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("Inbound email raw storage key must be scoped to the job firm");
  }
}

export async function processInboundEmailJob(input: {
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
  s3: InboundEmailS3Storage;
  inboundEmailParser: InboundEmailParser;
}): Promise<WorkerJobResult> {
  const { data, repository, s3, inboundEmailParser } = input;
  const rawStorageKey = metadataString(data.metadata, "rawStorageKey");
  if (!rawStorageKey) {
    throw new Error("Missing rawStorageKey in inbound_email job data");
  }
  assertRawStorageKey(data.firmId, rawStorageKey);

  const getObjectResponse = await s3.client.send(
    new GetObjectCommand({
      Bucket: s3.bucket,
      Key: rawStorageKey,
    }),
  );
  const rawContent = await getObjectResponse.Body?.transformToByteArray();
  if (!rawContent) {
    throw new Error("Failed to read raw email content from S3");
  }
  if (s3.serverSideEncryption) {
    await s3.client.send(
      new CopyObjectCommand({
        Bucket: s3.bucket,
        Key: rawStorageKey,
        CopySource: copySource(s3.bucket, rawStorageKey),
        MetadataDirective: "COPY",
        ...s3EncryptionOptions(s3),
      }),
    );
  }

  const parsed = await inboundEmailParser.parse({
    firmId: data.firmId,
    rawContent,
  });

  let addressId: string | undefined;
  let matterId: string | undefined;
  let routedAddress: string | undefined;
  for (const address of parsed.toAddresses) {
    const inboundAddress = await repository.getInboundEmailAddressByAddress(data.firmId, address);
    if (inboundAddress?.enabled) {
      addressId = inboundAddress.id;
      matterId = inboundAddress.matterId;
      routedAddress = inboundAddress.address;
      break;
    }
  }

  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();
  const parsedHtmlStorageKey = parsed.html
    ? `inbound-email/${data.firmId}/${messageId}/body.html`
    : undefined;
  if (parsed.html && parsedHtmlStorageKey) {
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: parsedHtmlStorageKey,
        Body: Buffer.from(parsed.html),
        ContentType: "text/html; charset=utf-8",
        ...s3EncryptionOptions(s3),
      }),
    );
  }

  await repository.createInboundEmailMessage({
    id: messageId,
    firmId: data.firmId,
    addressId,
    matterId,
    messageId: parsed.messageId,
    fromAddress: parsed.fromAddress,
    toAddresses: parsed.toAddresses,
    subject: parsed.subject,
    receivedAt: now,
    rawStorageKey,
    parsedText: parsed.text,
    parsedHtmlStorageKey,
    labels: [],
    status: matterId ? "triaged" : "triage_pending",
    metadata: {
      routedAddress,
      attachmentCount: parsed.attachments.length,
    },
  });

  let attachmentCount = 0;
  for (const attachment of parsed.attachments) {
    const attachmentId = crypto.randomUUID();
    const storageKey = `inbound-email/${data.firmId}/${messageId}/attachments/${attachmentId}-${safePathPart(
      attachment.filename,
    )}`;
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: storageKey,
        Body: Buffer.from(attachment.content),
        ContentType: attachment.contentType,
        ...s3EncryptionOptions(s3),
      }),
    );
    await repository.createInboundEmailAttachment({
      id: attachmentId,
      firmId: data.firmId,
      inboundMessageId: messageId,
      filename: attachment.filename,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      storageKey,
      checksumSha256: attachment.checksumSha256,
    });
    attachmentCount += 1;
  }

  return {
    status: "completed",
    metadata: {
      firmId: data.firmId,
      inboundMessageId: messageId,
      matterId,
      attachmentCount,
    },
  };
}
