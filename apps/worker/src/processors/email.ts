import type { MailSender } from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import type { WorkerJobEnvelope, WorkerJobResult } from "./types.js";

export async function processEmailJob(input: {
  data: WorkerJobEnvelope;
  jobLifecycleId?: string;
  attemptsMade?: number;
  maxAttempts?: number;
  repository: OpenPracticeRepository;
  mailSender: MailSender;
}): Promise<WorkerJobResult> {
  const { data, repository, mailSender } = input;
  const metadata = data.metadata || {};
  const emailId =
    data.resourceType === "email_outbox" && data.resourceId
      ? data.resourceId
      : typeof metadata.emailId === "string"
        ? metadata.emailId
        : undefined;

  if (!emailId) {
    return {
      status: "skipped",
      reason: "Missing email outbox id in job metadata",
      metadata: { firmId: data.firmId },
    };
  }

  const email = await repository.getEmailOutbox(data.firmId, emailId);
  if (!email) {
    return {
      status: "skipped",
      reason: "Email outbox record not found",
      metadata: { firmId: data.firmId, emailId },
    };
  }

  if (email.status === "sent" || email.status === "cancelled") {
    return {
      status: "skipped",
      reason: `Email outbox is already ${email.status}`,
      metadata: { firmId: data.firmId, emailId },
    };
  }

  if (!email.subject || (!email.htmlBody && !email.textBody)) {
    return {
      status: "skipped",
      reason: "Missing email details in outbox record",
      metadata: { firmId: data.firmId, emailId },
    };
  }

  const attemptNumber = (input.attemptsMade ?? 0) + 1;
  const maxAttempts = input.maxAttempts ?? 1;
  const attemptMetadata = {
    provider: email.metadata.provider,
    templateKey: email.templateKey,
    maxAttempts,
  };
  await repository.recordEmailDeliveryResult({
    firmId: data.firmId,
    emailId,
    status: "sending",
    occurredAt: new Date().toISOString(),
    attemptNumber,
    jobId: input.jobLifecycleId,
    source: "worker",
    metadata: attemptMetadata,
  });

  let result: Awaited<ReturnType<MailSender["send"]>>;
  try {
    result = await mailSender.send({
      firmId: data.firmId,
      from: email.from,
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      subject: email.subject,
      html: email.htmlBody,
      text: email.textBody,
      metadata: email.metadata.providerMetadata as Record<string, unknown>,
    });
  } catch (error) {
    const terminal = attemptNumber >= maxAttempts;
    await repository.recordEmailDeliveryResult({
      firmId: data.firmId,
      emailId,
      status: "failed",
      occurredAt: new Date().toISOString(),
      attemptNumber,
      jobId: input.jobLifecycleId,
      source: "worker",
      terminal,
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        ...attemptMetadata,
        terminal,
      },
    });
    throw error;
  }

  await repository.recordEmailDeliveryResult({
    firmId: data.firmId,
    emailId,
    status: "sent",
    occurredAt: new Date().toISOString(),
    providerMessageId: result.providerMessageId,
    attemptNumber,
    jobId: input.jobLifecycleId,
    source: "worker",
    terminal: true,
    metadata: {
      ...attemptMetadata,
      terminal: true,
    },
  });

  return {
    status: "completed",
    metadata: {
      firmId: data.firmId,
      emailId,
      attemptNumber,
      maxAttempts,
      providerMessageId: result.providerMessageId,
    },
  };
}
