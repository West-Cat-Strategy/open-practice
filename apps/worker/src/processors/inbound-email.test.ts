import { describe, expect, it } from "vitest";
import type { S3Client } from "@aws-sdk/client-s3";
import type {
  InboundEmailAttachmentRecord,
  InboundEmailMessageRecord,
  InboundEmailParser,
} from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { processInboundEmailJob } from "./inbound-email.js";

function fakeS3(rawContent: Uint8Array) {
  const puts: Array<{ key: string; body: unknown; contentType?: string }> = [];
  return {
    puts,
    s3: {
      bucket: "open-practice-mail",
      client: {
        async send(command: unknown) {
          const input = (
            command as { input: { Key: string; Body?: unknown; ContentType?: string } }
          ).input;
          if (
            (command as { constructor: { name: string } }).constructor.name === "GetObjectCommand"
          ) {
            return {
              Body: {
                async transformToByteArray() {
                  return rawContent;
                },
              },
            };
          }
          puts.push({
            key: input.Key,
            body: input.Body,
            contentType: input.ContentType,
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
    const { s3, puts } = fakeS3(new TextEncoder().encode("raw mail"));

    const result = await processInboundEmailJob({
      data: {
        firmId: "firm-west-legal",
        metadata: { rawStorageKey: "mail/raw/message.eml" },
      },
      repository,
      s3,
      inboundEmailParser: parser,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        firmId: "firm-west-legal",
        matterId: "matter-001",
        upstreamMessageId: "<provider-message@example.test>",
        attachmentCount: 1,
      },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      addressId: "inbound-address-001",
      matterId: "matter-001",
      messageId: "<provider-message@example.test>",
      status: "triaged",
      rawStorageKey: "mail/raw/message.eml",
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
});
