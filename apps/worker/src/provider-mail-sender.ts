import type { MailSender } from "@open-practice/domain";
import {
  requireCompleteSmtpProviderConfig,
  safeParseSmtpProviderConfig,
  SMTP_PROVIDER_KEY,
} from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { SmtpMailSender, type SmtpConfig } from "@open-practice/providers";

export type SmtpSenderFactory = (config: SmtpConfig) => MailSender;

export class ProviderConfiguredSmtpMailSender implements MailSender {
  constructor(
    private readonly repository: OpenPracticeRepository,
    private readonly senderFactory: SmtpSenderFactory = (config) => new SmtpMailSender(config),
  ) {}

  async send(message: Parameters<MailSender["send"]>[0]): ReturnType<MailSender["send"]> {
    const providers = await this.repository.listProviderSettings(message.firmId, {
      kind: "smtp",
    });
    const provider =
      providers.find((candidate) => candidate.enabled && candidate.key === SMTP_PROVIDER_KEY) ??
      providers.find((candidate) => candidate.enabled);
    const config = requireCompleteSmtpProviderConfig(
      provider ? safeParseSmtpProviderConfig(provider.encryptedConfig) : undefined,
    );
    const sender = this.senderFactory({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth:
        config.username && config.password
          ? { user: config.username, pass: config.password }
          : undefined,
    });
    return sender.send({
      ...message,
      from: message.from || config.fromAddress,
    });
  }
}
