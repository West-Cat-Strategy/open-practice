import { describe, expect, it } from "vitest";
import {
  parseImapProviderConfig,
  parseSmtpProviderConfig,
  redactImapProviderSettings,
  redactSmtpProviderSettings,
  requireCompleteImapProviderConfig,
  requireCompleteSmtpProviderConfig,
  serializeImapProviderConfig,
  serializeSmtpProviderConfig,
} from "./email-provider-settings.js";

describe("email provider settings", () => {
  it("parses, serializes, and redacts SMTP credentials", () => {
    const config = parseSmtpProviderConfig(
      JSON.stringify({
        host: "smtp.example.test",
        port: 587,
        secure: false,
        username: "mailer@example.test",
        password: "smtp-secret",
        fromAddress: "Open Practice <no-reply@example.test>",
      }),
    );

    expect(requireCompleteSmtpProviderConfig(config)).toMatchObject({
      host: "smtp.example.test",
      fromAddress: "Open Practice <no-reply@example.test>",
    });
    expect(serializeSmtpProviderConfig(config)).not.toContain("undefined");

    const redacted = redactSmtpProviderSettings({
      id: "provider-smtp-default",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "default",
      enabled: true,
      encryptedConfig: serializeSmtpProviderConfig(config),
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    });
    expect(redacted).toMatchObject({
      enabled: true,
      host: "smtp.example.test",
      username: "mailer@example.test",
      passwordConfigured: true,
      configValid: true,
    });
    expect(JSON.stringify(redacted)).not.toContain("smtp-secret");
  });

  it("requires IMAP credentials when enabled and redacts watermarks", () => {
    const config = parseImapProviderConfig(
      JSON.stringify({
        host: "imap.example.test",
        port: 993,
        username: "inbox@example.test",
        password: "imap-secret",
        mailbox: "INBOX",
        state: {
          uidValidity: 456,
          lastSuccessfullyQueuedUid: 10,
          lastPollAt: "2026-06-10T01:00:00.000Z",
        },
      }),
    );

    expect(requireCompleteImapProviderConfig(config)).toMatchObject({
      host: "imap.example.test",
      username: "inbox@example.test",
      mailbox: "INBOX",
    });

    const redacted = redactImapProviderSettings({
      id: "provider-inbound-email-imap",
      firmId: "firm-west-legal",
      kind: "inbound_email",
      key: "imap",
      enabled: true,
      encryptedConfig: serializeImapProviderConfig(config),
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    });
    expect(redacted).toMatchObject({
      enabled: true,
      host: "imap.example.test",
      passwordConfigured: true,
      uidValidity: 456,
      lastSuccessfullyQueuedUid: 10,
      configValid: true,
    });
    expect(JSON.stringify(redacted)).not.toContain("imap-secret");
  });

  it("reports missing fields without exposing invalid raw configs", () => {
    const smtp = redactSmtpProviderSettings({
      id: "provider-smtp-default",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "default",
      enabled: true,
      encryptedConfig: "legacy-private-profile",
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    });
    expect(smtp).toMatchObject({ configValid: false, missingFields: ["config"] });
    expect(JSON.stringify(smtp)).not.toContain("legacy-private-profile");
  });
});
