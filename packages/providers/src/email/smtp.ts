import nodemailer from "nodemailer";
import type { MailSender } from "@open-practice/domain";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

export class SmtpMailSender implements MailSender {
  private transporter: nodemailer.Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  async send(message: {
    firmId: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ providerMessageId?: string }> {
    const info = await this.transporter.sendMail({
      from: message.from,
      to: message.to.join(", "),
      cc: message.cc?.join(", "),
      bcc: message.bcc?.join(", "),
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    return {
      providerMessageId: info.messageId,
    };
  }
}
