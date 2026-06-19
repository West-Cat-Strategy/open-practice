import nodemailer from "nodemailer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmtpMailSender } from "./smtp.js";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

const sendMail = vi.fn(async (message: Record<string, unknown>) => {
  void message;
  return { messageId: "smtp-message-001" };
});
const createTransport = vi.mocked(nodemailer.createTransport);

describe("SmtpMailSender", () => {
  beforeEach(() => {
    sendMail.mockClear();
    createTransport.mockReset();
    createTransport.mockReturnValue({ sendMail } as never);
  });

  it("sends structured message fields with file and URL access disabled", async () => {
    const sender = new SmtpMailSender({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      auth: { user: "sender@example.test", pass: "smtp-secret" },
    });

    await expect(
      sender.send({
        firmId: "firm-west-legal",
        from: "office@example.test",
        to: ["client@example.test", "co-client@example.test"],
        cc: ["copy@example.test"],
        subject: "Synthetic update",
        text: "Synthetic plain text.",
        html: "<p>Synthetic HTML.</p>",
      }),
    ).resolves.toEqual({ providerMessageId: "smtp-message-001" });

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      auth: { user: "sender@example.test", pass: "smtp-secret" },
    });
    const message = sendMail.mock.calls[0]?.[0];
    expect(message).toBeDefined();
    expect(message).toMatchObject({
      from: "office@example.test",
      to: "client@example.test, co-client@example.test",
      cc: "copy@example.test",
      subject: "Synthetic update",
      text: "Synthetic plain text.",
      html: "<p>Synthetic HTML.</p>",
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    expect(message).not.toHaveProperty("raw");
  });
});
