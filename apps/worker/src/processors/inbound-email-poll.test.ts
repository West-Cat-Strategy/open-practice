import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import {
  IMAP_INBOUND_PROVIDER_KEY,
  IMAP_POLL_JOB_NAME,
  INBOUND_EMAIL_PARSE_JOB_NAME,
  serializeImapProviderConfig,
} from "@open-practice/domain";
import { processOpenPracticeJob, type WorkerJobQueue } from "../processors.js";

function fakeQueue() {
  const added: Array<{
    name: string;
    data: unknown;
    options?: { jobId?: string; delay?: number };
  }> = [];
  const queue: WorkerJobQueue = {
    async add(name, data, options) {
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
      metadata: { rawStorageKey: expect.stringContaining("/11-") },
    });

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
});
