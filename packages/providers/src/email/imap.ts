import { ImapFlow, type ImapFlowOptions } from "imapflow";
import type { CompleteImapProviderConfig, ImapProviderState } from "@open-practice/domain";

export interface ImapRawMessage {
  uid: number;
  raw: Buffer;
}

export interface ImapMailboxPollResult {
  uidValidity: number;
  messages: ImapRawMessage[];
  nextState: ImapProviderState;
}

export interface ImapMailboxPollInput {
  config: CompleteImapProviderConfig;
  state?: ImapProviderState;
  maxMessages?: number;
  now?: string;
}

export interface ImapMailboxClient {
  connect(): Promise<void>;
  logout(): Promise<void>;
  close?(): void;
  mailbox:
    | false
    | {
        uidValidity?: bigint | number;
      };
  getMailboxLock(
    mailbox: string,
    options?: { readOnly?: boolean; description?: string },
  ): Promise<{ release(): void }>;
  fetch(
    range: string,
    query: { uid?: boolean; source?: boolean },
    options?: { uid?: boolean },
  ): AsyncIterable<{ uid: number; source?: Buffer }>;
  messageFlagsAdd?(
    range: number[],
    flags: string[],
    options?: { uid?: boolean; silent?: boolean },
  ): Promise<boolean>;
}

export type ImapMailboxClientFactory = (config: CompleteImapProviderConfig) => ImapMailboxClient;

function toSafeNumber(value: bigint | number | undefined, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint" && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  return fallback;
}

function imapFlowOptions(config: CompleteImapProviderConfig): ImapFlowOptions {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
  };
}

export class ImapMailboxPoller {
  constructor(
    private readonly clientFactory: ImapMailboxClientFactory = (config) =>
      new ImapFlow(imapFlowOptions(config)) as ImapMailboxClient,
  ) {}

  async poll(input: ImapMailboxPollInput): Promise<ImapMailboxPollResult> {
    const client = this.clientFactory(input.config);
    const now = input.now ?? new Date().toISOString();
    const maxMessages = Math.max(1, input.maxMessages ?? 25);
    await client.connect();
    let lock: { release(): void } | undefined;
    try {
      lock = await client.getMailboxLock(input.config.mailbox, {
        readOnly: !input.config.markSeen,
        description: "open-practice-imap-poll",
      });
      const uidValidity = toSafeNumber(client.mailbox ? client.mailbox.uidValidity : undefined);
      const previousUidValidity = input.state?.uidValidity;
      const watermark =
        previousUidValidity && previousUidValidity === uidValidity
          ? (input.state?.lastSuccessfullyQueuedUid ?? 0)
          : 0;
      const startUid = Math.max(1, watermark + 1);
      const messages: ImapRawMessage[] = [];
      const seenUids: number[] = [];
      for await (const message of client.fetch(
        `${startUid}:*`,
        { uid: true, source: true },
        { uid: true },
      )) {
        if (message.uid <= watermark || !message.source) continue;
        messages.push({ uid: message.uid, raw: Buffer.from(message.source) });
        seenUids.push(message.uid);
        if (messages.length >= maxMessages) break;
      }
      if (input.config.markSeen && seenUids.length > 0 && client.messageFlagsAdd) {
        await client.messageFlagsAdd(seenUids, ["\\Seen"], { uid: true, silent: true });
      }
      const lastSuccessfullyQueuedUid =
        messages.at(-1)?.uid ?? (previousUidValidity === uidValidity ? watermark : undefined);
      return {
        uidValidity,
        messages,
        nextState: {
          uidValidity,
          lastSuccessfullyQueuedUid,
          lastPollAt: now,
          lastSuccessfulPollAt: now,
        },
      };
    } finally {
      lock?.release();
      try {
        await client.logout();
      } catch {
        client.close?.();
      }
    }
  }
}
