import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { InboundParserReplayInventoryResponse } from "../types";
import {
  formatReplayInventoryAge,
  InboundParserReplayInventoryPanel,
} from "./inbound-parser-replay-inventory-panel";

const inventory: InboundParserReplayInventoryResponse = {
  status: "available",
  generatedAt: "2026-07-01T12:00:00.000Z",
  summary: {
    total: 1,
    failed: 1,
    deadLetter: 0,
    byProviderFamily: { mailgun: 1 },
    byFailureStage: { parser_enqueue: 1 },
  },
  jobs: [
    {
      jobId: "job-inbound-parser-safe",
      status: "failed",
      providerFamily: "mailgun",
      failureStage: "parser_enqueue",
      queuedAt: "2026-07-01T10:00:00.000Z",
      failedAt: "2026-07-01T10:01:00.000Z",
      ageSeconds: 7200,
      attemptsMade: 1,
      maxAttempts: 4,
      safetyFlags: {
        noRawMime: true,
        noObjectKey: true,
        noProviderPayload: true,
        noMailboxSecret: true,
        noDocumentPromotion: true,
        noMatterCreation: true,
      },
    },
  ],
};

describe("InboundParserReplayInventoryPanel", () => {
  it("renders safe replay inventory metadata without action controls or private parser details", () => {
    const html = renderToStaticMarkup(
      createElement(InboundParserReplayInventoryPanel, {
        compactDate: (value?: string) => value ?? "No date",
        inventory,
      }),
    );

    expect(html).toContain("Inbound parser replay inventory");
    expect(html).toContain("job-inbound-parser-safe");
    expect(html).toContain("mailgun");
    expect(html).toContain("parser_enqueue");
    expect(html).toContain("2h old");
    expect(html).toContain("1/4 attempts");
    expect(html).toContain(
      "no raw MIME · no object key · no provider payload · no mailbox secret · no document promotion · no matter creation",
    );
    expect(html).not.toContain("<button");
    expect(html).not.toContain("rawStorageKey");
    expect(html).not.toContain("private-message.eml");
    expect(html).not.toContain("providerPayload");
    expect(html).not.toContain("mailboxSecret");
    expect(html).not.toContain("synthetic-token-hash");
    expect(html).not.toContain("targetResourceId");
    expect(html).not.toContain("document promotion enabled");
    expect(html).not.toContain("matter creation enabled");
  });

  it("omits the panel when inventory access is denied", () => {
    const html = renderToStaticMarkup(
      createElement(InboundParserReplayInventoryPanel, {
        compactDate: (value?: string) => value ?? "No date",
        inventory: {
          status: "access_denied",
          summary: {
            total: 0,
            failed: 0,
            deadLetter: 0,
            byProviderFamily: {},
            byFailureStage: {},
          },
          jobs: [],
        },
      }),
    );

    expect(html).toBe("");
  });

  it("formats bounded age labels", () => {
    expect(formatReplayInventoryAge(12)).toBe("12s old");
    expect(formatReplayInventoryAge(120)).toBe("2m old");
    expect(formatReplayInventoryAge(7200)).toBe("2h old");
    expect(formatReplayInventoryAge(172800)).toBe("2d old");
  });
});
