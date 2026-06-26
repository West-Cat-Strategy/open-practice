import type { MailSender } from "@open-practice/domain";
import {
  requireCompleteSmtpProviderConfig,
  safeParseSmtpProviderConfig,
  SMTP_PROVIDER_KEY,
  type ProviderEgressDnsResolver,
} from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { SmtpMailSender, type SmtpConfig } from "@open-practice/providers/email/smtp";
import { assertProviderEgressAllowed } from "./provider-egress.js";

export type SmtpSenderFactory = (config: SmtpConfig) => MailSender;

export class ProviderConfiguredSmtpMailSender implements MailSender {
  constructor(
    private readonly repository: OpenPracticeRepository,
    private readonly senderFactory: SmtpSenderFactory = (config) => new SmtpMailSender(config),
    private readonly providerDnsResolver?: ProviderEgressDnsResolver,
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
    await assertProviderEgressAllowed({
      hostname: config.host,
      resolver: this.providerDnsResolver,
      label: "SMTP provider host",
    });
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
