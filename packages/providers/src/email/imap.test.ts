import { describe, expect, it } from "vitest";
import { ImapMailboxPoller, type ImapMailboxClient } from "./imap.js";

function fakeClient(input: {
  uidValidity: number;
  messages: Array<{ uid: number; source: Buffer }>;
  seen?: number[][];
}): ImapMailboxClient {
  return {
    mailbox: { uidValidity: BigInt(input.uidValidity) },
    async connect() {},
    async logout() {},
    async getMailboxLock() {
      return { release() {} };
    },
    async *fetch(range: string) {
      const [start] = range.split(":");
      const startUid = Number(start);
      for (const message of input.messages) {
        if (message.uid >= startUid) yield message;
      }
    },
    async messageFlagsAdd(range) {
      input.seen?.push(range);
      return true;
    },
  };
}

const config = {
  version: 1 as const,
  host: "imap.example.test",
  port: 993,
  secure: true,
  username: "inbox@example.test",
  password: "imap-secret",
  mailbox: "INBOX",
  pollIntervalSeconds: 300,
  markSeen: false,
  state: {},
};

describe("ImapMailboxPoller", () => {
  it("fetches raw messages after the stored UID watermark", async () => {
    const poller = new ImapMailboxPoller(() =>
      fakeClient({
        uidValidity: 42,
        messages: [
          { uid: 10, source: Buffer.from("old") },
          { uid: 11, source: Buffer.from("new-1") },
          { uid: 12, source: Buffer.from("new-2") },
        ],
      }),
    );

    const result = await poller.poll({
      config,
      state: { uidValidity: 42, lastSuccessfullyQueuedUid: 10 },
      now: "2026-06-10T00:00:00.000Z",
    });

    expect(result.messages.map((message) => [message.uid, message.raw.toString()])).toEqual([
      [11, "new-1"],
      [12, "new-2"],
    ]);
    expect(result.nextState).toMatchObject({
      uidValidity: 42,
      lastSuccessfullyQueuedUid: 12,
      lastSuccessfulPollAt: "2026-06-10T00:00:00.000Z",
    });
  });

  it("resets the watermark when UIDVALIDITY changes", async () => {
    const poller = new ImapMailboxPoller(() =>
      fakeClient({
        uidValidity: 43,
        messages: [{ uid: 1, source: Buffer.from("fresh-mailbox") }],
      }),
    );

    const result = await poller.poll({
      config,
      state: { uidValidity: 42, lastSuccessfullyQueuedUid: 100 },
    });

    expect(result.messages.map((message) => message.uid)).toEqual([1]);
    expect(result.nextState.lastSuccessfullyQueuedUid).toBe(1);
  });

  it("marks fetched messages seen only when configured", async () => {
    const seen: number[][] = [];
    const poller = new ImapMailboxPoller(() =>
      fakeClient({
        uidValidity: 42,
        messages: [{ uid: 5, source: Buffer.from("mail") }],
        seen,
      }),
    );

    await poller.poll({ config: { ...config, markSeen: true } });

    expect(seen).toEqual([[5]]);
  });
});
