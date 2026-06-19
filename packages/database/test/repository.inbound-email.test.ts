import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { createInboundMessageWithAttachment, now } from "./repository.fixtures.js";

describe("repository inbound email", () => {
  it("stores parsed inbound email messages and attachments", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailAddress({
      id: "inbound-address-001",
      firmId: "firm-west-legal",
      address: "matter-001@open-practice.test",
      matterId: "matter-001",
      enabled: true,
      createdAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-disabled",
      firmId: "firm-west-legal",
      address: "archive@open-practice.test",
      enabled: false,
      createdAt: now,
    });

    await expect(repository.listInboundEmailAddresses("firm-west-legal")).resolves.toMatchObject([
      {
        id: "inbound-address-001",
        address: "matter-001@open-practice.test",
        matterId: "matter-001",
        enabled: true,
      },
      {
        id: "inbound-address-disabled",
        address: "archive@open-practice.test",
        enabled: false,
      },
    ]);
    await expect(
      repository.createInboundEmailAddress({
        id: "inbound-address-duplicate",
        firmId: "firm-west-legal",
        address: "MATTER-001@open-practice.test",
        matterId: "matter-001",
        enabled: true,
        createdAt: now,
      }),
    ).rejects.toThrow(/already exists/);

    const message = await repository.createInboundEmailMessage({
      id: "inbound-message-001",
      firmId: "firm-west-legal",
      addressId: "inbound-address-001",
      matterId: "matter-001",
      messageId: "<message-001@example.test>",
      fromAddress: "client@example.test",
      toAddresses: ["matter-001@open-practice.test"],
      subject: "Filed materials",
      receivedAt: now,
      rawStorageKey: "inbound/raw/message-001.eml",
      parsedText: "Please review.",
      parsedHtmlStorageKey: "inbound/message-001/body.html",
      labels: [],
      status: "triaged",
      metadata: { routedAddress: "matter-001@open-practice.test" },
    });

    await expect(repository.listInboundEmailMessages("firm-west-legal")).resolves.toMatchObject([
      {
        id: message.id,
        matterId: "matter-001",
        messageId: "<message-001@example.test>",
        status: "triaged",
      },
    ]);
    await expect(
      repository.getInboundEmailMessage("firm-west-legal", message.id),
    ).resolves.toMatchObject({
      messageId: "<message-001@example.test>",
      subject: "Filed materials",
    });
    await expect(
      repository.updateInboundEmailMessage("firm-west-legal", message.id, {
        status: "triage_pending",
        labels: ["needs-review"],
      }),
    ).resolves.toMatchObject({
      status: "triage_pending",
      labels: ["needs-review"],
    });

    await repository.createInboundEmailAttachment({
      id: "inbound-attachment-001",
      firmId: "firm-west-legal",
      inboundMessageId: message.id,
      filename: "filing.pdf",
      contentType: "application/pdf",
      sizeBytes: 128,
      storageKey: "inbound/message-001/filing.pdf",
      checksumSha256: "a".repeat(64),
    });

    const attachments = await repository.listInboundEmailAttachments("firm-west-legal", message.id);
    expect(attachments).toMatchObject([
      {
        filename: "filing.pdf",
        checksumSha256: "a".repeat(64),
      },
    ]);
    expect(attachments[0]).not.toHaveProperty("documentId");

    const promoted = await repository.promoteInboundEmailAttachmentToDocument({
      firmId: "firm-west-legal",
      messageId: message.id,
      attachmentId: "inbound-attachment-001",
      matterId: "matter-001",
      title: "Filed materials.pdf",
      classification: "work_product",
      legalHold: true,
      now,
    });
    expect(promoted).toMatchObject({
      created: true,
      attachment: { id: "inbound-attachment-001", documentId: promoted.document.id },
      document: {
        title: "Filed materials.pdf",
        matterId: "matter-001",
        storageKey: "inbound/message-001/filing.pdf",
        checksumSha256: "a".repeat(64),
        classification: "work_product",
        legalHold: true,
        uploadStatus: "verified",
        checksumStatus: "verified",
        scanStatus: "queued",
        uploadedAt: now,
        verifiedAt: now,
      },
    });
    await expect(
      repository.listInboundEmailAttachments("firm-west-legal", message.id),
    ).resolves.toMatchObject([{ documentId: promoted.document.id }]);

    await expect(
      repository.promoteInboundEmailAttachmentToDocument({
        firmId: "firm-west-legal",
        messageId: message.id,
        attachmentId: "inbound-attachment-001",
        matterId: "matter-001",
        title: "Duplicate call.pdf",
        classification: "general",
        legalHold: false,
      }),
    ).resolves.toMatchObject({
      created: false,
      document: { id: promoted.document.id, title: "Filed materials.pdf" },
    });
  });

  it("does not mark promoted inbound attachments as duplicates across matters", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { message, attachment } = await createInboundMessageWithAttachment(repository, {
      messageId: "inbound-message-duplicate",
      attachmentId: "inbound-attachment-duplicate",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
    });

    await expect(
      repository.promoteInboundEmailAttachmentToDocument({
        firmId: "firm-west-legal",
        messageId: message.id,
        attachmentId: attachment.id,
        matterId: "matter-002",
        title: "Duplicate retainer.pdf",
        classification: "general",
        legalHold: false,
        now,
      }),
    ).resolves.toMatchObject({
      created: true,
      document: {
        checksumStatus: "verified",
        uploadStatus: "verified",
        scanStatus: "queued",
      },
    });
  });

  it("batch-lists inbound attachments with singular precedence and empty-array semantics", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const first = await createInboundMessageWithAttachment(repository, {
      messageId: "inbound-message-batch-001",
      attachmentId: "inbound-attachment-batch-001",
    });
    const second = await createInboundMessageWithAttachment(repository, {
      messageId: "inbound-message-batch-002",
      attachmentId: "inbound-attachment-batch-002",
    });

    await expect(
      repository.listInboundEmailAttachments("firm-west-legal", {
        inboundMessageIds: [first.message.id, second.message.id],
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.attachment.id, inboundMessageId: first.message.id }),
        expect.objectContaining({ id: second.attachment.id, inboundMessageId: second.message.id }),
      ]),
    );
    await expect(
      repository.listInboundEmailAttachments("firm-west-legal", {
        inboundMessageId: first.message.id,
        inboundMessageIds: [second.message.id],
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: first.attachment.id, inboundMessageId: first.message.id }),
    ]);
    await expect(
      repository.listInboundEmailAttachments("firm-west-legal", { inboundMessageIds: [] }),
    ).resolves.toEqual([]);
  });

  it("marks promoted inbound attachments as duplicates within the same matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { message, attachment } = await createInboundMessageWithAttachment(repository, {
      messageId: "inbound-message-same-matter-duplicate",
      attachmentId: "inbound-attachment-same-matter-duplicate",
      matterId: "matter-001",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
    });

    await expect(
      repository.promoteInboundEmailAttachmentToDocument({
        firmId: "firm-west-legal",
        messageId: message.id,
        attachmentId: attachment.id,
        matterId: "matter-001",
        title: "Duplicate retainer.pdf",
        classification: "general",
        legalHold: false,
        now,
      }),
    ).resolves.toMatchObject({
      created: true,
      document: {
        checksumStatus: "duplicate",
        duplicateOfDocumentId: "doc-001",
        uploadStatus: "verified",
        scanStatus: "queued",
      },
    });
  });

  it("rejects inbound attachment promotion when the attachment has no checksum", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { message, attachment } = await createInboundMessageWithAttachment(repository, {
      messageId: "inbound-message-missing-checksum",
      attachmentId: "inbound-attachment-missing-checksum",
    });

    await expect(
      repository.promoteInboundEmailAttachmentToDocument({
        firmId: "firm-west-legal",
        messageId: message.id,
        attachmentId: attachment.id,
        matterId: "matter-002",
        title: "Missing checksum.pdf",
        classification: "general",
        legalHold: false,
        now,
      }),
    ).rejects.toThrow(/checksum is required/);
    await expect(
      repository.listInboundEmailAttachments("firm-west-legal", message.id),
    ).resolves.toMatchObject([{ id: attachment.id }]);
    await expect(repository.listMatterDocuments("firm-west-legal", "matter-002")).resolves.toEqual(
      [],
    );
  });
});
