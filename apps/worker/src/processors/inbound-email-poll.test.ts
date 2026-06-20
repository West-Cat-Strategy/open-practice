import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import {
  IMAP_INBOUND_PROVIDER_KEY,
  IMAP_POLL_JOB_NAME,
  INBOUND_EMAIL_PARSE_JOB_NAME,
  serializeImapProviderConfig,
} from "@open-practice/domain";
import { processOpenPracticeJob, type WorkerJobQueue } from "../processors.js";

const parserRecoveryMetadata = {
  recoveryPosture: "owner_reviewed_raw_object_replay",
  ownerReviewRequired: true,
  rawObjectRecoverable: true,
  providerPayloadStored: false,
  automaticDocumentPromotion: false,
  automaticMatterCreation: false,
};
const pollRecoveryMetadata = {
  recoveryPosture: "owner_reviewed_provider_poll",
  ownerReviewRequired: true,
  rawObjectRecoverable: false,
  providerPayloadStored: false,
  automaticDocumentPromotion: false,
  automaticMatterCreation: false,
};

function fakeQueue(input: { rejectParser?: boolean } = {}) {
  const added: Array<{
    name: string;
    data: unknown;
    options?: { jobId?: string; delay?: number };
  }> = [];
  const queue: WorkerJobQueue = {
    async add(name, data, options) {
      if (input.rejectParser && name === INBOUND_EMAIL_PARSE_JOB_NAME) {
        throw new Error("synthetic parser enqueue failure");
      }
      added.push({ name, data, options });
      return { id: options?.jobId ?? `bull-${added.length}` };
    },
  };
  return { queue, added };
}

function fakeS3() {
  const puts: unknown[] = [];
  return {
    puts,
    s3: {
      bucket: "open-practice-documents",
      client: {
        async send(command: { input?: unknown }) {
          puts.push(command.input);
          return {};
        },
      } as never,
      serverSideEncryption: "AES256" as const,
    },
  };
}

async function enableImap(repository: InMemoryOpenPracticeRepository): Promise<void> {
  await repository.upsertProviderSetting({
    id: "provider-inbound-email-imap",
    firmId: "firm-west-legal",
    kind: "inbound_email",
    key: IMAP_INBOUND_PROVIDER_KEY,
    enabled: true,
    encryptedConfig: serializeImapProviderConfig({
      version: 1,
      host: "imap.example.test",
      port: 993,
      secure: true,
      username: "inbox@example.test",
      password: "imap-secret",
      mailbox: "INBOX",
      pollIntervalSeconds: 300,
      markSeen: false,
      state: { uidValidity: 7, lastSuccessfullyQueuedUid: 10 },
    }),
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  });
}

describe("IMAP inbound email polling worker", () => {
  it("stores raw MIME, queues parser jobs, updates watermarks, and self-schedules", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableImap(repository);
    const { queue, added } = fakeQueue();
    const { s3, puts } = fakeS3();

    const result = await processOpenPracticeJob({
      queueName: "inbound_email",
      jobName: IMAP_POLL_JOB_NAME,
      data: { firmId: "firm-west-legal" },
      repository,
      s3,
      ocrProvider: {} as never,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
      inboundEmailJobQueue: queue,
      imapMailboxPoller: {
        async poll() {
          return {
            uidValidity: 7,
            messages: [
              { uid: 11, raw: Buffer.from("Subject: one\r\n\r\nbody one") },
              { uid: 12, raw: Buffer.from("Subject: two\r\n\r\nbody two") },
            ],
            nextState: {
              uidValidity: 7,
              lastSuccessfullyQueuedUid: 12,
              lastPollAt: "2026-06-10T00:01:00.000Z",
              lastSuccessfulPollAt: "2026-06-10T00:01:00.000Z",
            },
          };
        },
      } as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: { messageCount: 2, queuedParserJobCount: 2, uidValidity: 7 },
    });
    expect(puts).toHaveLength(2);
    expect(JSON.stringify(puts)).toContain("inbound-email/firm-west-legal/raw/provider-polls/imap");
    expect(added.map((job) => job.name)).toEqual([
      INBOUND_EMAIL_PARSE_JOB_NAME,
      INBOUND_EMAIL_PARSE_JOB_NAME,
      IMAP_POLL_JOB_NAME,
    ]);
    expect(added[0]?.data).toMatchObject({
      firmId: "firm-west-legal",
      metadata: {
        ...parserRecoveryMetadata,
        rawStorageKey: expect.stringContaining("/11-"),
      },
    });
    expect(added[2]?.data).toMatchObject({
      metadata: expect.objectContaining(pollRecoveryMetadata),
    });
    const parserJobs = (
      await repository.listJobLifecycleRecords("firm-west-legal", {
        queueName: "inbound_email",
      })
    )
      .filter((job) => job.jobName === INBOUND_EMAIL_PARSE_JOB_NAME)
      .sort((left, right) => Number(left.metadata.uid) - Number(right.metadata.uid));
    expect(parserJobs).toHaveLength(2);
    expect(parserJobs[0]?.metadata).toMatchObject({
      ...parserRecoveryMetadata,
      rawStorageKeyPresent: true,
      mailboxHash: expect.any(String),
      uidValidity: 7,
      uid: 11,
      rawContentSha256: expect.any(String),
      rawSizeBytes: expect.any(Number),
    });
    expect(parserJobs.every((job) => !("rawStorageKey" in job.metadata))).toBe(true);
    expect(JSON.stringify(parserJobs.map((job) => job.metadata))).not.toContain(".eml");

    const provider = (
      await repository.listProviderSettings("firm-west-legal", { kind: "inbound_email" })
    ).find((candidate) => candidate.key === IMAP_INBOUND_PROVIDER_KEY);
    const storedConfig = JSON.parse(provider?.encryptedConfig ?? "{}") as {
      state?: { lastSuccessfullyQueuedUid?: number; nextPollAt?: string };
    };
    expect(storedConfig.state).toMatchObject({ lastSuccessfullyQueuedUid: 12 });
    expect(storedConfig.state?.nextPollAt).toEqual(expect.any(String));
  });

  it("does not enqueue duplicate parser jobs for the same UIDVALIDITY and UID", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableImap(repository);
    const { queue, added } = fakeQueue();
    const { s3 } = fakeS3();
    const poller = {
      async poll() {
        return {
          uidValidity: 7,
          messages: [{ uid: 11, raw: Buffer.from("Subject: once\r\n\r\nbody") }],
          nextState: {
            uidValidity: 7,
            lastSuccessfullyQueuedUid: 11,
            lastPollAt: "2026-06-10T00:01:00.000Z",
            lastSuccessfulPollAt: "2026-06-10T00:01:00.000Z",
          },
        };
      },
    } as never;

    const baseInput = {
      queueName: "inbound_email" as const,
      jobName: IMAP_POLL_JOB_NAME,
      data: { firmId: "firm-west-legal" },
      repository,
      s3,
      ocrProvider: {} as never,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
      inboundEmailJobQueue: queue,
      imapMailboxPoller: poller,
    };

    await processOpenPracticeJob(baseInput);
    await processOpenPracticeJob(baseInput);

    expect(added.filter((job) => job.name === INBOUND_EMAIL_PARSE_JOB_NAME)).toHaveLength(1);
    expect(added.filter((job) => job.name === IMAP_POLL_JOB_NAME)).toHaveLength(2);
  });

  it("marks IMAP-created parser jobs failed when parser enqueue is rejected", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableImap(repository);
    const { queue, added } = fakeQueue({ rejectParser: true });
    const { s3 } = fakeS3();

    await expect(
      processOpenPracticeJob({
        queueName: "inbound_email",
        jobName: IMAP_POLL_JOB_NAME,
        data: { firmId: "firm-west-legal" },
        repository,
        s3,
        ocrProvider: {} as never,
        mailSender: {} as never,
        inboundEmailParser: {} as never,
        inboundEmailJobQueue: queue,
        imapMailboxPoller: {
          async poll() {
            return {
              uidValidity: 7,
              messages: [{ uid: 11, raw: Buffer.from("Subject: one\r\n\r\nbody one") }],
              nextState: {
                uidValidity: 7,
                lastSuccessfullyQueuedUid: 11,
                lastPollAt: "2026-06-10T00:01:00.000Z",
                lastSuccessfulPollAt: "2026-06-10T00:01:00.000Z",
              },
            };
          },
        } as never,
      }),
    ).rejects.toThrow("synthetic parser enqueue failure");

    expect(added).toHaveLength(0);
    const [parserJob] = (
      await repository.listJobLifecycleRecords("firm-west-legal", {
        queueName: "inbound_email",
      })
    ).filter((job) => job.jobName === INBOUND_EMAIL_PARSE_JOB_NAME);
    expect(parserJob).toMatchObject({
      status: "failed",
      attemptsMade: 1,
      errorMessage: "Job enqueue failed; retry after the worker queue is available.",
      metadata: {
        ...parserRecoveryMetadata,
        provider: IMAP_INBOUND_PROVIDER_KEY,
        source: "imap.mailbox_poll",
        resourceType: "inbound_email_raw",
        resourceId: "7:11",
        enqueueStatus: "failed",
        providerFailureStage: "imap_parser_enqueue",
        rawStorageKeyPresent: true,
        rawObjectRecoverable: true,
        providerPayloadStored: false,
        automaticDocumentPromotion: false,
        automaticMatterCreation: false,
      },
    });
    expect(parserJob?.metadata).not.toHaveProperty("rawStorageKey");
    expect(JSON.stringify(parserJob?.metadata)).not.toContain(".eml");
  });
});
