import { describe, expect, it } from "vitest";
import type { S3Client } from "@aws-sdk/client-s3";
import type {
  InboundEmailAttachmentRecord,
  InboundEmailMessageRecord,
  InboundEmailParser,
} from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { processInboundEmailJob } from "./inbound-email.js";

function fakeS3(rawContent: Uint8Array, serverSideEncryption?: "AES256") {
  const copies: Array<{
    key: string;
    copySource?: string;
    metadataDirective?: string;
    serverSideEncryption?: string;
  }> = [];
  const puts: Array<{
    key: string;
    body: unknown;
    contentType?: string;
    serverSideEncryption?: string;
  }> = [];
  return {
    copies,
    puts,
    s3: {
      bucket: "open-practice-mail",
      serverSideEncryption,
      client: {
        async send(command: unknown) {
          const input = (
            command as {
              input: {
                Key: string;
                Body?: unknown;
                ContentType?: string;
                CopySource?: string;
                MetadataDirective?: string;
                ServerSideEncryption?: string;
              };
            }
          ).input;
          const commandName = (command as { constructor: { name: string } }).constructor.name;
          if (commandName === "GetObjectCommand") {
            return {
              Body: {
                async transformToByteArray() {
                  return rawContent;
                },
              },
            };
          }
          if (commandName === "CopyObjectCommand") {
            copies.push({
              key: input.Key,
              copySource: input.CopySource,
              metadataDirective: input.MetadataDirective,
              serverSideEncryption: input.ServerSideEncryption,
            });
            return {};
          }
          puts.push({
            key: input.Key,
            body: input.Body,
            contentType: input.ContentType,
            serverSideEncryption: input.ServerSideEncryption,
          });
          return {};
        },
      } as unknown as S3Client,
    },
  };
}

function fakeRepository() {
  const messages: InboundEmailMessageRecord[] = [];
  const attachments: InboundEmailAttachmentRecord[] = [];
  const repository = {
    async getInboundEmailAddressByAddress(_firmId: string, address: string) {
      if (address === "matter-001@open-practice.test") {
        return {
          id: "inbound-address-001",
          firmId: "firm-west-legal",
          address,
          matterId: "matter-001",
          enabled: true,
          createdAt: "2026-04-28T12:00:00.000Z",
        };
      }
      return undefined;
    },
    async createInboundEmailMessage(message: InboundEmailMessageRecord) {
      messages.push(message);
      return message;
    },
    async createInboundEmailAttachment(attachment: InboundEmailAttachmentRecord) {
      attachments.push(attachment);
      return attachment;
    },
  } as unknown as OpenPracticeRepository;
  return { repository, messages, attachments };
}

describe("processInboundEmailJob", () => {
  it("parses, routes, and stores inbound email attachments without document promotion", async () => {
    const { repository, messages, attachments } = fakeRepository();
    const parser: InboundEmailParser = {
      async parse(input) {
        expect(new TextDecoder().decode(input.rawContent)).toContain("raw mail");
        return {
          messageId: "<provider-message@example.test>",
          subject: "Client filing",
          fromAddress: "client@example.test",
          toAddresses: ["matter-001@open-practice.test"],
          text: "Please review.",
          html: "<p>Please review.</p>",
          attachments: [
            {
              filename: "filing notice.pdf",
              contentType: "application/pdf",
              sizeBytes: 8,
              checksumSha256: "f56047c822efb76ea455924782aef526abdca4aab8df59e00df26c366e96ace8",
              content: new TextEncoder().encode("PDF body"),
            },
          ],
        };
      },
    };
    const { s3, puts, copies } = fakeS3(new TextEncoder().encode("raw mail"), "AES256");

    const result = await processInboundEmailJob({
      data: {
        firmId: "firm-west-legal",
        metadata: { rawStorageKey: "inbound-email/firm-west-legal/raw/message.eml" },
      },
      repository,
      s3,
      inboundEmailParser: parser,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        firmId: "firm-west-legal",
        inboundMessageId: expect.any(String),
        matterId: "matter-001",
        attachmentCount: 1,
      },
    });
    expect(result.metadata).not.toHaveProperty("messageId");
    expect(result.metadata).not.toHaveProperty("upstreamMessageId");
    expect(result.metadata).not.toHaveProperty("attachments");
    expect(JSON.stringify(result.metadata)).not.toContain("storageKey");
    expect(JSON.stringify(result.metadata)).not.toContain("filing notice.pdf");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      addressId: "inbound-address-001",
      matterId: "matter-001",
      messageId: "<provider-message@example.test>",
      status: "triaged",
      rawStorageKey: "inbound-email/firm-west-legal/raw/message.eml",
      parsedText: "Please review.",
      parsedHtmlStorageKey: expect.stringContaining("/body.html"),
    });
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      filename: "filing notice.pdf",
      contentType: "application/pdf",
      checksumSha256: "f56047c822efb76ea455924782aef526abdca4aab8df59e00df26c366e96ace8",
    });
    expect(attachments[0]).not.toHaveProperty("documentId");
    expect(puts.map((put) => put.key)).toEqual([
      expect.stringContaining("/body.html"),
      expect.stringContaining("/attachments/"),
    ]);
    expect(copies).toEqual([
      {
        key: "inbound-email/firm-west-legal/raw/message.eml",
        copySource: "open-practice-mail/inbound-email/firm-west-legal/raw/message.eml",
        metadataDirective: "COPY",
        serverSideEncryption: "AES256",
      },
    ]);
    expect(puts.map((put) => put.serverSideEncryption)).toEqual(["AES256", "AES256"]);
  });

  it("rejects jobs without a raw storage key", async () => {
    const { repository } = fakeRepository();
    const { s3 } = fakeS3(new Uint8Array());

    await expect(
      processInboundEmailJob({
        data: { firmId: "firm-west-legal" },
        repository,
        s3,
        inboundEmailParser: {
          async parse() {
            throw new Error("Parser should not run");
          },
        },
      }),
    ).rejects.toThrow("Missing rawStorageKey");
  });

  it("rejects raw storage keys outside the job firm inbound namespace", async () => {
    const invalidKeys = [
      "mail/raw/message.eml",
      "inbound-email/firm-east-legal/raw/message.eml",
      "inbound-email/firm-west-legal/raw/../message.eml",
      "inbound-email/firm-west-legal/raw/",
      "inbound-email/firm-west-legal/raw//message.eml",
    ];

    for (const rawStorageKey of invalidKeys) {
      const { repository } = fakeRepository();
      const { s3 } = fakeS3(new TextEncoder().encode("raw mail"));

      await expect(
        processInboundEmailJob({
          data: {
            firmId: "firm-west-legal",
            metadata: { rawStorageKey },
          },
          repository,
          s3,
          inboundEmailParser: {
            async parse() {
              throw new Error("Parser should not run");
            },
          },
        }),
      ).rejects.toThrow("Inbound email raw storage key must be scoped to the job firm");
    }
  });
});
