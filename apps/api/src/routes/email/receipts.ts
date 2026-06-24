import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { EmailReceiptTokenRecord } from "@open-practice/domain";
import {
  hashToken,
  publicTokenPathFromHeader,
  readPublicTokenHeader,
} from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { emailReceiptTokenStatus } from "../outbound-email.js";
import { publicTokenPolicyOptions } from "../public-token-rate-limits.js";
import type { ApiRouteDependencies } from "../types.js";
import { requireReceiptSecret } from "./shared.js";

type EmailReceiptRouteDependencies = Pick<ApiRouteDependencies, "repository"> & {
  jwtSecret?: string;
};

const publicReceiptParamsSchema = z.object({
  token: z.string().min(32),
});

const publicReceiptBodySchema = z.object({
  token: z.string().min(32).optional(),
});

function registerReceiptUrlEncodedParser(server: FastifyInstance): void {
  if (server.hasContentTypeParser("application/x-www-form-urlencoded")) return;
  server.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, payload, done) => {
      const form = new URLSearchParams(typeof payload === "string" ? payload : payload.toString());
      done(null, Object.fromEntries(form.entries()));
    },
  );
}

function escapeReceiptPageHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildReceiptActionPath(routeUrl: string | undefined): string {
  const basePath = routeUrl?.includes("/api/portal/mail/receipts/")
    ? "/api/portal/mail/receipts"
    : "/api/portal/email-receipts";
  return basePath;
}

function renderReceiptConfirmationPage(input: {
  actionPath: string;
  token: string;
  alreadyRecorded: boolean;
}) {
  const actionPath = escapeReceiptPageHtml(input.actionPath);
  const token = escapeReceiptPageHtml(input.token);
  const message = input.alreadyRecorded
    ? "This email receipt has already been confirmed."
    : "Confirm that this email was received.";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Email Receipt Confirmation</title>
  </head>
  <body>
    <main>
      <h1>Email Receipt Confirmation</h1>
      <p>${message}</p>
      <form method="post" action="${actionPath}" autocomplete="off">
        <input type="hidden" name="token" value="${token}">
        <button type="submit">Confirm Receipt</button>
      </form>
    </main>
  </body>
</html>`;
}

export function registerEmailReceiptRoutes(
  server: FastifyInstance,
  { repository, jwtSecret }: EmailReceiptRouteDependencies,
): void {
  registerReceiptUrlEncodedParser(server);

  const readReceiptToken = async (
    request: FastifyRequest,
  ): Promise<{
    token: string;
    tokenHash: string;
    receiptToken: EmailReceiptTokenRecord;
  }> => {
    const secret = requireReceiptSecret(jwtSecret);
    const routeParams = request.params as { token?: string } | undefined;
    const body = publicReceiptBodySchema.safeParse(request.body ?? {});
    const headerToken = publicTokenPathFromHeader(readPublicTokenHeader(request.headers));
    const params = parseRequestPart(
      publicReceiptParamsSchema,
      routeParams?.token
        ? routeParams
        : body.success && body.data.token
          ? { token: body.data.token }
          : headerToken,
      "params",
    );
    const tokenHash = hashToken(params.token, secret);
    const receiptToken = await repository.getEmailReceiptTokenByHash(tokenHash);
    if (!receiptToken) {
      throw new ApiHttpError(404, "EMAIL_RECEIPT_NOT_FOUND", "Email receipt was not found");
    }
    if (Date.parse(receiptToken.expiresAt) <= Date.now()) {
      throw new ApiHttpError(410, "EMAIL_RECEIPT_EXPIRED", "Email receipt has expired");
    }
    return { token: params.token, tokenHash, receiptToken };
  };

  const renderReceiptConfirmation = async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Robots-Tag", "noindex, nofollow");
    const { token, receiptToken } = await readReceiptToken(request);
    return reply.type("text/html; charset=utf-8").send(
      renderReceiptConfirmationPage({
        actionPath: buildReceiptActionPath(request.routeOptions.url),
        token,
        alreadyRecorded: Boolean(receiptToken.recordedAt),
      }),
    );
  };

  const recordReceipt = async (request: FastifyRequest) => {
    const { tokenHash } = await readReceiptToken(request);
    const result = await repository.recordEmailReceiptToken({
      tokenHash,
      recordedAt: new Date().toISOString(),
    });
    const token = result?.token;
    const email = token ? await repository.getEmailOutbox(token.firmId, token.emailId) : undefined;
    if (!token || !email) {
      throw new ApiHttpError(404, "EMAIL_RECEIPT_NOT_FOUND", "Email receipt was not found");
    }
    return {
      receipt: emailReceiptTokenStatus(token),
      recorded: result.recordedNow,
    };
  };

  server.get(
    "/api/portal/email-receipts",
    publicTokenPolicyOptions("email-receipt", "view"),
    renderReceiptConfirmation,
  );
  server.get(
    "/api/portal/email-receipts/:token",
    publicTokenPolicyOptions("email-receipt", "view"),
    renderReceiptConfirmation,
  );
  server.get(
    "/api/portal/mail/receipts",
    publicTokenPolicyOptions("email-receipt", "view"),
    renderReceiptConfirmation,
  );
  server.get(
    "/api/portal/mail/receipts/:token",
    publicTokenPolicyOptions("email-receipt", "view"),
    renderReceiptConfirmation,
  );
  server.post(
    "/api/portal/email-receipts",
    publicTokenPolicyOptions("email-receipt", "mutation"),
    recordReceipt,
  );
  server.post(
    "/api/portal/email-receipts/:token",
    publicTokenPolicyOptions("email-receipt", "mutation"),
    recordReceipt,
  );
  server.post(
    "/api/portal/mail/receipts",
    publicTokenPolicyOptions("email-receipt", "mutation"),
    recordReceipt,
  );
  server.post(
    "/api/portal/mail/receipts/:token",
    publicTokenPolicyOptions("email-receipt", "mutation"),
    recordReceipt,
  );
}
