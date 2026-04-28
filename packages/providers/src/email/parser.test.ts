import { describe, expect, it } from "vitest";
import { MailParserProvider } from "./parser.js";

describe("MailParserProvider", () => {
  it("normalizes sender, recipients, subject, and text body", async () => {
    const result = await new MailParserProvider().parse({
      firmId: "firm-west-legal",
      rawContent: Buffer.from(
        "Message-ID: <message-001@example.test>\n" +
          "From: Sender <SENDER@Example.TEST>\n" +
          "To: Matter <Matter-001@Open-Practice.TEST>, Other <other@example.test>\n" +
          "Subject:  Filing update  \n" +
          "\n" +
          "  Filed materials attached.  ",
      ),
    });

    expect(result).toMatchObject({
      messageId: "<message-001@example.test>",
      fromAddress: "sender@example.test",
      toAddresses: ["matter-001@open-practice.test", "other@example.test"],
      subject: "Filing update",
      text: "Filed materials attached.",
      attachments: [],
    });
  });

  it("extracts attachment bytes without promoting them to documents", async () => {
    const result = await new MailParserProvider().parse({
      firmId: "firm-west-legal",
      rawContent: Buffer.from(
        "MIME-Version: 1.0\n" +
          "From: sender@example.test\n" +
          "To: matter-001@open-practice.test\n" +
          "Subject: Attachment\n" +
          'Content-Type: multipart/mixed; boundary="boundary"\n' +
          "\n" +
          "--boundary\n" +
          "Content-Type: text/plain\n" +
          "\n" +
          "See attached.\n" +
          "--boundary\n" +
          'Content-Type: text/plain; name="notes.txt"\n' +
          'Content-Disposition: attachment; filename="notes.txt"\n' +
          "\n" +
          "Attachment content\n" +
          "--boundary--",
      ),
    });

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({
      filename: "notes.txt",
      contentType: "text/plain",
    });
    expect(new TextDecoder().decode(result.attachments[0]!.content).trim()).toBe(
      "Attachment content",
    );
  });
});
