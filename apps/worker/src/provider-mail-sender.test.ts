import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { serializeSmtpProviderConfig } from "@open-practice/domain";
import { ProviderConfiguredSmtpMailSender } from "./provider-mail-sender.js";

describe("ProviderConfiguredSmtpMailSender", () => {
  it("resolves enabled SMTP settings from provider settings per firm", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-default",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "default",
      enabled: true,
      encryptedConfig: serializeSmtpProviderConfig({
        version: 1,
        host: "smtp.example.test",
        port: 587,
        secure: false,
        username: "mailer@example.test",
        password: "smtp-secret",
        fromAddress: "Open Practice <no-reply@example.test>",
      }),
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    });
    const configs: unknown[] = [];
    const messages: unknown[] = [];
    const sender = new ProviderConfiguredSmtpMailSender(repository, (config) => {
      configs.push(config);
      return {
        async send(message) {
          messages.push(message);
          return { providerMessageId: "smtp-message-001" };
        },
      };
    });

    await sender.send({
      firmId: "firm-west-legal",
      from: "",
      to: ["client@example.test"],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(configs).toEqual([
      {
        host: "smtp.example.test",
        port: 587,
        secure: false,
        auth: { user: "mailer@example.test", pass: "smtp-secret" },
      },
    ]);
    expect(messages[0]).toMatchObject({
      from: "Open Practice <no-reply@example.test>",
      to: ["client@example.test"],
    });
  });

  it("rejects enabled SMTP providers with incomplete config", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-default",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "default",
      enabled: true,
      encryptedConfig: JSON.stringify({ host: "smtp.example.test" }),
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    });
    const sender = new ProviderConfiguredSmtpMailSender(repository);

    await expect(
      sender.send({
        firmId: "firm-west-legal",
        from: "Open Practice <no-reply@example.test>",
        to: ["client@example.test"],
        subject: "Hello",
        html: "",
        text: "Hello",
      }),
    ).rejects.toThrow("SMTP provider settings are incomplete");
  });
});
