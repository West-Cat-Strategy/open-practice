import { describe, expect, it } from "vitest";
import type { S3Client } from "@aws-sdk/client-s3";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { MailSender, OcrProvider } from "@open-practice/domain";
import { processOpenPracticeJob } from "./processors.js";

describe("worker processors", () => {
  it("loads outbound email content from the outbox record instead of job metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const sentMessages: unknown[] = [];
    const mailSender: MailSender = {
      async send(message) {
        sentMessages.push(message);
        return { providerMessageId: "mailpit-message-001" };
      },
    };
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-outbox-worker-test",
        firmId: "firm-west-legal",
        templateKey: "signature.requested",
        status: "queued",
        to: ["client@example.test"],
        cc: ["copy@example.test"],
        bcc: ["blind-copy@example.test"],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Signature requested",
        htmlBody: "",
        textBody: "Please review the signature request.",
        relatedResourceType: "signature_request",
        relatedResourceId: "sig-001",
        queuedAt: "2026-05-01T00:00:00.000Z",
        metadata: { providerMetadata: { provider: "mailpit" } },
      },
      event: {
        id: "email-event-worker-test",
        firmId: "firm-west-legal",
        emailId: "email-outbox-worker-test",
        eventType: "queued",
        occurredAt: "2026-05-01T00:00:00.000Z",
        metadata: { provider: "mailpit" },
      },
      job: {
        id: "job-worker-test",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-outbox-worker-test",
        attemptsMade: 0,
        maxAttempts: 3,
        queuedAt: "2026-05-01T00:00:00.000Z",
        metadata: {
          emailId: "email-outbox-worker-test",
          matterId: "matter-001",
          templateKey: "signature.requested",
          recipientCount: 3,
        },
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "email",
      jobName: "send_email",
      data: {
        firmId: "firm-west-legal",
        resourceType: "email_outbox",
        resourceId: "email-outbox-worker-test",
        metadata: { emailId: "email-outbox-worker-test" },
      },
      jobLifecycleId: "job-worker-test",
      attemptsMade: 0,
      maxAttempts: 3,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        emailId: "email-outbox-worker-test",
        providerMessageId: "mailpit-message-001",
      },
    });
    expect(sentMessages).toEqual([
      expect.objectContaining({
        to: ["client@example.test"],
        cc: ["copy@example.test"],
        bcc: ["blind-copy@example.test"],
        subject: "Signature requested",
        text: "Please review the signature request.",
      }),
    ]);
    await expect(
      repository.getEmailOutbox("firm-west-legal", "email-outbox-worker-test"),
    ).resolves.toMatchObject({
      status: "sent",
      sentAt: expect.any(String),
      errorMessage: undefined,
    });
    await expect(
      repository.listEmailEvents("firm-west-legal", { emailId: "email-outbox-worker-test" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "queued",
          emailId: "email-outbox-worker-test",
        }),
        expect.objectContaining({
          eventType: "sent",
          emailId: "email-outbox-worker-test",
          providerMessageId: "mailpit-message-001",
        }),
      ]),
    );
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-worker-test",
          status: "completed",
          targetResourceId: "email-outbox-worker-test",
          finishedAt: expect.any(String),
        }),
      ]),
    );
  });

  it("marks outbound email and job lifecycle failed when delivery throws", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const mailSender: MailSender = {
      async send() {
        throw new Error("SMTP refused message");
      },
    };
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-outbox-failed-worker-test",
        firmId: "firm-west-legal",
        templateKey: "intake.generated",
        status: "queued",
        to: ["staff@example.test"],
        cc: [],
        bcc: [],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Generated intake document",
        htmlBody: "<p>Document generated.</p>",
        textBody: "Document generated.",
        relatedResourceType: "intake_session",
        relatedResourceId: "intake-001",
        queuedAt: "2026-05-01T00:00:00.000Z",
        metadata: { provider: "mailpit", providerMetadata: { provider: "mailpit" } },
      },
      event: {
        id: "email-event-failed-worker-test",
        firmId: "firm-west-legal",
        emailId: "email-outbox-failed-worker-test",
        eventType: "queued",
        occurredAt: "2026-05-01T00:00:00.000Z",
        metadata: { provider: "mailpit" },
      },
      job: {
        id: "job-worker-failed-test",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-outbox-failed-worker-test",
        attemptsMade: 0,
        maxAttempts: 1,
        queuedAt: "2026-05-01T00:00:00.000Z",
        metadata: {
          emailId: "email-outbox-failed-worker-test",
          templateKey: "intake.generated",
          recipientCount: 1,
        },
      },
    });

    await expect(
      processOpenPracticeJob({
        queueName: "email",
        jobName: "send_email",
        data: {
          firmId: "firm-west-legal",
          resourceType: "email_outbox",
          resourceId: "email-outbox-failed-worker-test",
          metadata: { emailId: "email-outbox-failed-worker-test" },
        },
        jobLifecycleId: "job-worker-failed-test",
        attemptsMade: 0,
        maxAttempts: 1,
        repository,
        s3: {} as never,
        ocrProvider: {} as never,
        mailSender,
        inboundEmailParser: {} as never,
      }),
    ).rejects.toThrow("SMTP refused message");

    await expect(
      repository.getEmailOutbox("firm-west-legal", "email-outbox-failed-worker-test"),
    ).resolves.toMatchObject({
      status: "failed",
      failedAt: expect.any(String),
      errorMessage: "SMTP refused message",
    });
    await expect(
      repository.listEmailEvents("firm-west-legal", {
        emailId: "email-outbox-failed-worker-test",
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "failed",
          emailId: "email-outbox-failed-worker-test",
          metadata: expect.objectContaining({ provider: "mailpit" }),
        }),
      ]),
    );
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-worker-failed-test",
          status: "dead_letter",
          attemptsMade: 1,
          errorMessage: "SMTP refused message",
          failedAt: expect.any(String),
        }),
      ]),
    );
  });

  it("skips email jobs when the outbox record is missing", async () => {
    const result = await processOpenPracticeJob({
      queueName: "email",
      jobName: "send_email",
      data: {
        firmId: "firm-west-legal",
        resourceType: "email_outbox",
        resourceId: "missing-email",
      },
      repository: new InMemoryOpenPracticeRepository(),
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender: {
        async send() {
          throw new Error("Should not send");
        },
      },
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "Email outbox record not found",
      metadata: { emailId: "missing-email" },
    });
  });

  it("runs OCR jobs from document storage and completes lifecycle records", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const requestedObjects: string[] = [];
    const s3 = {
      bucket: "open-practice-documents",
      client: {
        async send(command: unknown) {
          const input = (command as { input: { Key: string } }).input;
          requestedObjects.push(input.Key);
          return {
            Body: {
              async transformToByteArray() {
                return new TextEncoder().encode("Synthetic PDF bytes");
              },
            },
          };
        },
      } as unknown as S3Client,
    };
    const ocrProvider: OcrProvider = {
      async extractText(input) {
        expect(input).toMatchObject({
          firmId: "firm-west-legal",
          documentId: "doc-001",
          language: "eng",
        });
        expect(new TextDecoder().decode(input.content)).toBe("Synthetic PDF bytes");
        return {
          confidence: 94,
          extractedText: "Synthetic extracted retainer text.",
          metadata: { engineVersion: "test", rawText: "Synthetic provider text should stay out" },
        };
      },
    };
    await repository.createJobLifecycleRecord({
      id: "job-ocr-worker-test",
      firmId: "firm-west-legal",
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "queued",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: "2026-05-01T00:00:00.000Z",
      metadata: {
        documentId: "doc-001",
        language: "eng",
        title: "Retainer agreement.pdf",
        extractedText: "Do not persist queued text in job metadata",
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "ocr",
      jobName: "extract_document_text",
      data: {
        firmId: "firm-west-legal",
        resourceType: "document",
        resourceId: "doc-001",
        metadata: {
          documentId: "doc-001",
          language: "eng",
          title: "Retainer agreement.pdf",
          extractedText: "Do not persist queued text in job metadata",
        },
      },
      jobLifecycleId: "job-ocr-worker-test",
      attemptsMade: 0,
      maxAttempts: 3,
      repository,
      s3,
      ocrProvider,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        firmId: "firm-west-legal",
        documentId: "doc-001",
        confidence: 94,
        textLength: "Synthetic extracted retainer text.".length,
      },
    });
    expect(requestedObjects).toEqual(["matters/matter-001/retainer-v1.pdf"]);
    await expect(
      repository.getDocumentTextExtractions("firm-west-legal", "doc-001"),
    ).resolves.toEqual([
      expect.objectContaining({
        documentId: "doc-001",
        engine: "tesseract",
        status: "completed",
        language: "eng",
        confidence: 94,
        extractedText: "Synthetic extracted retainer text.",
        metadata: { engineVersion: "test", rawText: "Synthetic provider text should stay out" },
      }),
    ]);
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "ocr" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-ocr-worker-test",
          status: "completed",
          attemptsMade: 0,
          finishedAt: expect.any(String),
          metadata: expect.objectContaining({
            documentId: "doc-001",
            confidence: 94,
            textLength: "Synthetic extracted retainer text.".length,
          }),
        }),
      ]),
    );
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "ocr" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-ocr-worker-test",
          metadata: expect.not.objectContaining({
            extractedText: expect.any(String),
            rawText: expect.any(String),
            title: expect.any(String),
          }),
        }),
      ]),
    );
  });
});
