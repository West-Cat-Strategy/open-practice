import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { MailSender } from "@open-practice/domain";
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
        cc: [],
        bcc: [],
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
          recipientCount: 1,
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
        subject: "Signature requested",
        text: "Please review the signature request.",
      }),
    ]);
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
});
