import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type {
  InboundEmailAttachmentRecord,
  InboundEmailMessageRecord,
  ProfessionalRole,
  User,
} from "@open-practice/domain";
import { sampleUsers } from "@open-practice/domain/sample-data";
import { registerInboundEmailRoutes } from "./inbound-email.js";
import type { ApiJobQueue } from "./types.js";

const firmId = "firm-west-legal";
const now = "2026-04-29T12:00:00.000Z";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  const idByRole: Partial<Record<ProfessionalRole, string>> = {
    owner_admin: "user-admin",
    auditor: "user-auditor",
    licensee: "user-licensee",
    firm_member: "user-staff",
  };
  return {
    id: idByRole[role] ?? `user-${role}`,
    firmId,
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(
  repository: InMemoryOpenPracticeRepository,
  authUser: User = user("owner_admin", ["matter-001", "matter-002"]),
  ocrJobQueue?: ApiJobQueue,
): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerInboundEmailRoutes(server, { repository, ocrJobQueue });
  servers.push(server);
  return server;
}

function message(overrides: Partial<InboundEmailMessageRecord> = {}): InboundEmailMessageRecord {
  return {
    id: "inbound-message-001",
    firmId,
    addressId: "inbound-address-001",
    matterId: "matter-001",
    messageId: "<message-001@example.test>",
    fromAddress: "client@example.test",
    toAddresses: ["matter-001@open-practice.test"],
    subject: "Filed materials",
    receivedAt: now,
    rawStorageKey: "inbound/raw/message-001.eml",
    parsedText: "Please review.",
    labels: [],
    status: "triaged",
    metadata: {},
    ...overrides,
  };
}

function attachment(
  overrides: Partial<InboundEmailAttachmentRecord> = {},
): InboundEmailAttachmentRecord {
  return {
    id: "inbound-attachment-001",
    firmId,
    inboundMessageId: "inbound-message-001",
    filename: "filing.pdf",
    contentType: "application/pdf",
    sizeBytes: 128,
    storageKey: "inbound/message-001/filing.pdf",
    checksumSha256: "a".repeat(64),
    ...overrides,
  };
}

function fakeOcrQueue() {
  const jobs: Array<{ name: string; data: unknown; jobId?: string }> = [];
  const queue: ApiJobQueue = {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "bull-ocr-job" };
    },
  };
  return { queue, jobs };
}

async function enableOcrProvider(repository: InMemoryOpenPracticeRepository): Promise<void> {
  await repository.upsertProviderSetting({
    id: "provider-ocr-enabled",
    firmId,
    kind: "ocr",
    key: "local-tesseract",
    enabled: true,
    encryptedConfig: "synthetic-ocr-config-not-returned",
    createdAt: now,
    updatedAt: now,
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("inbound email routes", () => {
  it("reports inbound email disabled when no provider is configured", async () => {
    const response = await testServer(new InMemoryOpenPracticeRepository()).inject({
      method: "GET",
      url: "/api/inbound-email/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "disabled",
      reason: "not_configured",
      addresses: [],
    });
  });

  it("returns configured inbound addresses without provider secrets", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-inbound-default",
      firmId,
      kind: "inbound_email",
      key: "mailgun",
      enabled: true,
      encryptedConfig: "sealed:provider-secret",
      createdAt: now,
      updatedAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-001",
      firmId,
      address: "matter-001@open-practice.test",
      matterId: "matter-001",
      enabled: true,
      createdAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-disabled",
      firmId,
      address: "archive@open-practice.test",
      enabled: false,
      createdAt: now,
    });

    const response = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "configured",
      provider: "mailgun",
      addresses: [
        {
          id: "inbound-address-001",
          address: "matter-001@open-practice.test",
          matterId: "matter-001",
          enabled: true,
          createdAt: now,
        },
        {
          id: "inbound-address-disabled",
          address: "archive@open-practice.test",
          enabled: false,
          createdAt: now,
        },
      ],
    });
    expect(JSON.stringify(response.json())).not.toContain("sealed:provider-secret");
  });

  it("filters inbound address status for matter-scoped users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-inbound-default",
      firmId,
      kind: "inbound_email",
      key: "mailgun",
      enabled: true,
      encryptedConfig: "sealed:provider-secret",
      createdAt: now,
      updatedAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-001",
      firmId,
      address: "matter-001@open-practice.test",
      matterId: "matter-001",
      enabled: true,
      createdAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-002",
      firmId,
      address: "matter-002@open-practice.test",
      matterId: "matter-002",
      enabled: true,
      createdAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-general",
      firmId,
      address: "general@open-practice.test",
      enabled: true,
      createdAt: now,
    });

    const response = await testServer(repository, user("firm_member", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "configured",
      addresses: [
        {
          id: "inbound-address-001",
          address: "matter-001@open-practice.test",
          matterId: "matter-001",
        },
      ],
    });
    expect(response.json()).not.toHaveProperty("provider");
    expect(JSON.stringify(response.json())).not.toContain("matter-002@open-practice.test");
    expect(JSON.stringify(response.json())).not.toContain("general@open-practice.test");
  });

  it("returns one parsed message with only that message's inbound attachments", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailMessage(message({ id: "inbound-message-002" }));
    await repository.createInboundEmailAttachment(attachment());
    await repository.createInboundEmailAttachment(
      attachment({
        id: "inbound-attachment-other",
        inboundMessageId: "inbound-message-002",
        filename: "other.pdf",
        storageKey: "inbound/message-002/other.pdf",
      }),
    );

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "available",
      message: {
        id: "inbound-message-001",
        matterId: "matter-001",
        parsedText: "Please review.",
      },
      attachments: [
        {
          id: "inbound-attachment-001",
          inboundMessageId: "inbound-message-001",
          filename: "filing.pdf",
          checksumSha256: "a".repeat(64),
        },
      ],
    });
    expect(response.json().attachments).toHaveLength(1);
    expect(response.json().attachments[0]).not.toHaveProperty("documentId");
  });

  it("applies matter-scoped access to inbound email message lists", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());

    const allowed = await testServer(repository, user("billing_bookkeeper", ["matter-001"])).inject(
      {
        method: "GET",
        url: "/api/inbound-email/messages?matterId=matter-001",
      },
    );

    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({
      status: "available",
      messages: [expect.objectContaining({ id: "inbound-message-001" })],
    });

    const denied = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages?matterId=matter-002",
    });
    expect(denied.statusCode).toBe(403);
  });

  it("allows authorized staff to triage-route unscoped inbound email to an accessible matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
        metadata: { staffTriage: { note: "Private note must not persist" } },
      }),
    );

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        matterId: "matter-001",
        status: "triaged",
        labels: ["client", "routed"],
        staffTriage: {
          status: "routed",
          assignedToUserId: "user-staff",
          contactIds: ["contact-ada"],
          privateNote: "Internal call-back context stays staff-only.",
          followUp: {
            channel: "phone",
            consentStatus: "consented",
            dueAt: "2026-04-30T18:00:00.000Z",
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "updated",
      message: {
        id: "inbound-message-unscoped",
        matterId: "matter-001",
        status: "triaged",
        labels: ["client", "routed"],
        staffTriage: {
          status: "routed",
          assignedToUserId: "user-staff",
          contactIds: ["contact-ada"],
          privateNoteCount: 1,
          latestPrivateNoteAt: expect.any(String),
          followUp: {
            channel: "phone",
            consentStatus: "consented",
            dueAt: "2026-04-30T18:00:00.000Z",
          },
          updatedByUserId: "user-licensee",
        },
      },
    });
    const updated = await repository.getInboundEmailMessage(firmId, "inbound-message-unscoped");
    expect(updated?.metadata.staffTriage).not.toHaveProperty("note");
    expect(updated?.metadata.staffTriage).toMatchObject({
      privateNotes: [
        expect.objectContaining({
          authorUserId: "user-licensee",
          text: "Internal call-back context stays staff-only.",
        }),
      ],
      followUp: {
        channel: "phone",
        consentStatus: "consented",
        dueAt: "2026-04-30T18:00:00.000Z",
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("Internal call-back context");

    const secondResponse = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        staffTriage: {
          privateNote: "Second internal-only context.",
          followUp: { dueAt: "2026-05-01T18:00:00.000Z" },
        },
      },
    });
    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.json()).toMatchObject({
      message: {
        staffTriage: {
          status: "routed",
          assignedToUserId: "user-staff",
          contactIds: ["contact-ada"],
          privateNoteCount: 2,
          followUp: {
            channel: "phone",
            consentStatus: "consented",
            dueAt: "2026-05-01T18:00:00.000Z",
          },
          updatedByUserId: "user-licensee",
        },
      },
    });
    expect(JSON.stringify(secondResponse.json())).not.toContain("Second internal-only context");
    const secondUpdated = await repository.getInboundEmailMessage(
      firmId,
      "inbound-message-unscoped",
    );
    expect(secondUpdated?.metadata.staffTriage).toMatchObject({
      privateNotes: [
        expect.objectContaining({ text: "Internal call-back context stays staff-only." }),
        expect.objectContaining({ text: "Second internal-only context." }),
      ],
    });

    const audit = await repository.listAuditEvents(firmId);
    const triageAudit = audit.events
      .filter((event) => event.action === "inbound_email.triage_updated")
      .at(-1);
    expect(triageAudit?.metadata).toMatchObject({
      matterId: "matter-001",
      status: "triaged",
      labelCount: 2,
      staffTriageStatus: "routed",
      privateNoteAdded: true,
      privateNoteCount: 2,
      followUpChannel: "phone",
      followUpConsentStatus: "consented",
      followUpDueAt: "2026-05-01T18:00:00.000Z",
    });
    expect(JSON.stringify(triageAudit?.metadata)).not.toContain("Private note");
    expect(JSON.stringify(triageAudit?.metadata)).not.toContain("Internal call-back context");
    expect(JSON.stringify(triageAudit?.metadata)).not.toContain("Second internal-only context");
  });

  it("denies auditor triage mutation", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());

    const response = await testServer(repository, user("auditor", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-001",
      payload: { status: "triaged" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("caps stored private triage notes to the latest 25 entries", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(
      message({
        metadata: {
          staffTriage: {
            status: "needs_review",
            privateNotes: Array.from({ length: 25 }, (_, index) => ({
              authorUserId: "user-staff",
              createdAt: `2026-04-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
              text: `Existing private note ${index + 1}`,
            })),
          },
        },
      }),
    );

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-001",
      payload: {
        staffTriage: { privateNote: "Newest private note." },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: {
        staffTriage: {
          status: "needs_review",
          privateNoteCount: 25,
          latestPrivateNoteAt: expect.any(String),
        },
      },
    });
    const updated = await repository.getInboundEmailMessage(firmId, "inbound-message-001");
    const privateNotes = (
      updated?.metadata.staffTriage as { privateNotes?: Array<{ text: string }> } | undefined
    )?.privateNotes;
    expect(privateNotes).toHaveLength(25);
    expect(privateNotes?.[0]?.text).toBe("Existing private note 2");
    expect(privateNotes?.at(-1)?.text).toBe("Newest private note.");
    expect(JSON.stringify(response.json())).not.toContain("Newest private note.");
  });

  it("rejects cross-matter triage routing for already scoped inbound email", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message({ matterId: "matter-001" }));

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
    ).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-001",
      payload: { matterId: "matter-002" },
    });

    expect(response.statusCode).toBe(403);
    await expect(
      repository.getInboundEmailMessage(firmId, "inbound-message-001"),
    ).resolves.toMatchObject({ matterId: "matter-001" });
  });

  it("rejects unknown staff triage fields", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message({ status: "triage_pending" }));

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-001",
      payload: {
        status: "triaged",
        staffTriage: { note: "Unsafe private note" },
      },
    });

    expect(response.statusCode).toBe(400);
    await expect(
      repository.getInboundEmailMessage(firmId, "inbound-message-001"),
    ).resolves.toMatchObject({ status: "triage_pending" });
  });

  it("rejects triage contacts and assignees that are outside the target matter", async () => {
    const repository = new InMemoryOpenPracticeRepository({
      users: [
        ...sampleUsers,
        {
          id: "user-other-matter",
          firmId,
          displayName: "Other Matter Staff",
          email: "other@example.test",
          role: "firm_member",
          assignedMatterIds: ["matter-002"],
          mfaEnabled: true,
        },
      ],
    });
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
      }),
    );

    const badContact = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        matterId: "matter-001",
        staffTriage: { contactIds: ["contact-northstar"] },
      },
    });
    expect(badContact.statusCode).toBe(403);

    const badAssignee = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        matterId: "matter-001",
        staffTriage: { assignedToUserId: "user-other-matter" },
      },
    });
    expect(badAssignee.statusCode).toBe(403);

    const unscopedNote = await testServer(repository).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        staffTriage: { privateNote: "Unscoped staff note should not attach" },
      },
    });
    expect(unscopedNote.statusCode).toBe(400);
  });

  it("promotes a matter-scoped attachment to a document", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableOcrProvider(repository);
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());
    const { queue, jobs } = fakeOcrQueue();

    const response = await testServer(repository, user("licensee", ["matter-001"]), queue).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
      payload: {
        title: "Filed materials.pdf",
        classification: "work_product",
        legalHold: true,
        language: "eng",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload).toMatchObject({
      status: "promoted",
      created: true,
      inboundMessageId: "inbound-message-001",
      attachment: {
        id: "inbound-attachment-001",
        documentId: expect.any(String),
      },
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
      },
      queuedOcr: {
        status: "queued",
        task: "ocr",
        language: "eng",
        documentId: expect.any(String),
        job: {
          queueName: "ocr",
          jobName: "extract_document_text",
          status: "queued",
          targetResourceType: "document",
          targetResourceId: expect.any(String),
        },
      },
    });
    expect(payload.document.id).toBe(payload.attachment.documentId);
    expect(payload.queuedOcr.documentId).toBe(payload.document.id);
    expect(payload.queuedOcr.job.targetResourceId).toBe(payload.document.id);
    expect(jobs).toEqual([
      expect.objectContaining({
        name: "extract_document_text",
        jobId: payload.queuedOcr.job.id,
        data: expect.objectContaining({
          firmId,
          resourceType: "document",
          resourceId: payload.document.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            documentId: payload.document.id,
            task: "ocr",
            language: "eng",
            checksumStatus: "verified",
            scanStatus: "queued",
          }),
        }),
      }),
    ]);

    const detail = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).toMatchObject({ documentId: payload.document.id });

    const audit = await repository.listAuditEvents(firmId);
    const promotionAudit = audit.events.find(
      (event) => event.action === "inbound_email.attachment.promoted_to_document",
    );
    expect(promotionAudit?.metadata).toMatchObject({
      matterId: "matter-001",
      inboundMessageId: "inbound-message-001",
      attachmentId: "inbound-attachment-001",
      documentId: payload.document.id,
      created: true,
      promotionStatus: "promoted",
      documentUploadStatus: "verified",
      checksumStatus: "verified",
      scanStatus: "queued",
    });
    const auditMetadata = JSON.stringify(promotionAudit?.metadata);
    expect(auditMetadata).not.toContain("Please review");
    expect(auditMetadata).not.toContain("inbound/message-001/filing.pdf");
    expect(auditMetadata).not.toContain("a".repeat(64));
  });

  it("returns the existing promoted document without duplicating it", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());
    const server = testServer(repository);

    const first = await server.inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
      payload: { queueOcr: false },
    });
    const second = await server.inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
      payload: { queueOcr: false },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ created: true });
    expect(second.json()).toMatchObject({
      created: false,
      document: { id: first.json().document.id },
      attachment: { documentId: first.json().document.id },
    });
  });

  it("keeps default OCR queueing atomic when no OCR queue is configured", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());

    const response = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ message: "OCR queue is not configured" });
    const detail = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).not.toHaveProperty("documentId");
  });

  it("keeps default OCR queueing atomic when no OCR provider is enabled", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());
    const { queue, jobs } = fakeOcrQueue();

    const response = await testServer(repository, user("licensee", ["matter-001"]), queue).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ message: "OCR provider is not configured" });
    expect(jobs).toEqual([]);
    const detail = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).not.toHaveProperty("documentId");
    await expect(repository.listJobLifecycleRecords(firmId, { queueName: "ocr" })).resolves.toEqual(
      [],
    );
  });

  it("returns 409 for unscoped messages and attachments without checksums", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
      }),
    );
    await repository.createInboundEmailAttachment(
      attachment({ inboundMessageId: "inbound-message-unscoped" }),
    );

    const unscoped = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-unscoped/attachments/inbound-attachment-001/promote-document",
    });
    expect(unscoped.statusCode).toBe(409);
    expect(unscoped.json()).toMatchObject({
      message: "Inbound email message must be matter-scoped before promotion",
    });

    await repository.createInboundEmailMessage(message({ id: "inbound-message-no-checksum" }));
    await repository.createInboundEmailAttachment(
      attachment({
        id: "inbound-attachment-no-checksum",
        inboundMessageId: "inbound-message-no-checksum",
        checksumSha256: undefined,
      }),
    );
    const missingChecksum = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-no-checksum/attachments/inbound-attachment-no-checksum/promote-document",
    });
    expect(missingChecksum.statusCode).toBe(409);
    expect(missingChecksum.json()).toMatchObject({
      message: "Inbound email attachment checksum is required for document promotion",
    });
  });

  it("requires the attachment to belong to the message and both promotion permissions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailMessage(message({ id: "inbound-message-002" }));
    await repository.createInboundEmailAttachment(
      attachment({
        id: "inbound-attachment-other",
        inboundMessageId: "inbound-message-002",
      }),
    );

    const wrongMessage = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-other/promote-document",
    });
    expect(wrongMessage.statusCode).toBe(404);

    await repository.createInboundEmailAttachment(attachment());
    const auditorDenied = await testServer(repository, user("auditor", [])).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
    });
    expect(auditorDenied.statusCode).toBe(403);
  });

  it("denies assigned users outside their matter and for unscoped messages", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message({ matterId: "matter-002" }));
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
      }),
    );
    const server = testServer(repository, user("licensee", ["matter-001"]));

    const wrongMatter = await server.inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(wrongMatter.statusCode).toBe(403);

    const unscoped = await server.inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-unscoped",
    });
    expect(unscoped.statusCode).toBe(403);
  });

  it.each(["owner_admin", "auditor"] as const)(
    "lets %s read unscoped firm-review messages",
    async (role) => {
      const repository = new InMemoryOpenPracticeRepository();
      await repository.createInboundEmailMessage(
        message({
          id: "inbound-message-unscoped",
          matterId: undefined,
          addressId: undefined,
          status: "triage_pending",
        }),
      );

      const response = await testServer(repository, user(role, [])).inject({
        method: "GET",
        url: "/api/inbound-email/messages/inbound-message-unscoped",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: { id: "inbound-message-unscoped" },
        attachments: [],
      });
      expect(response.json().message).not.toHaveProperty("matterId");
    },
  );

  it("returns 404 for a missing firm-scoped inbound message", async () => {
    const response = await testServer(new InMemoryOpenPracticeRepository()).inject({
      method: "GET",
      url: "/api/inbound-email/messages/missing-message",
    });

    expect(response.statusCode).toBe(404);
  });
});
