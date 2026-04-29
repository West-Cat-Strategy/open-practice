import { createHash } from "node:crypto";
import { simpleParser } from "mailparser";
import type { InboundEmailParser } from "@open-practice/domain";

function normalizeAddress(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function checksumSha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export class MailParserProvider implements InboundEmailParser {
  async parse(input: { firmId: string; rawContent: Uint8Array }) {
    const parsed = await simpleParser(Buffer.from(input.rawContent));
    const recipients = Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : [];
    const toAddresses = recipients
      .flatMap((recipient) => recipient.value)
      .map((address) => normalizeAddress(address.address))
      .filter((address): address is string => Boolean(address));

    return {
      messageId: parsed.messageId,
      subject: parsed.subject?.trim() || "(No subject)",
      fromAddress: normalizeAddress(parsed.from?.value[0]?.address) ?? "unknown@example.invalid",
      toAddresses,
      text: parsed.text?.trim() || undefined,
      html: typeof parsed.html === "string" ? parsed.html : undefined,
      attachments: parsed.attachments.map((attachment) => {
        const content = new Uint8Array(attachment.content);
        return {
          filename: attachment.filename?.trim() || "unnamed-attachment",
          contentType: attachment.contentType || undefined,
          sizeBytes: attachment.size,
          checksumSha256: checksumSha256(content),
          content,
        };
      }),
    };
  }
}
