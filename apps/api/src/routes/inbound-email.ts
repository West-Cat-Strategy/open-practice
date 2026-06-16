import type { FastifyInstance } from "fastify";
import { registerInboundEmailAttachmentPromotionRoutes } from "./inbound-email/attachment-promotion.js";
import { registerInboundEmailImapSettingsRoutes } from "./inbound-email/imap-settings.js";
import { registerInboundEmailRawMimeRoutes } from "./inbound-email/mailgun-raw-mime.js";
import { registerInboundEmailMessageRoutes } from "./inbound-email/messages.js";
import { registerInboundEmailMatterDraftRoutes } from "./inbound-email/matter-drafts.js";
import { registerInboundEmailParserJobRoutes } from "./inbound-email/parser-jobs.js";
import { registerInboundEmailStatusRoutes } from "./inbound-email/status.js";
import { registerInboundEmailTriageRoutes } from "./inbound-email/triage.js";
import type { ApiRouteDependencies } from "./types.js";

export function registerInboundEmailRoutes(
  server: FastifyInstance,
  { repository, inboundEmailJobQueue, s3 }: ApiRouteDependencies,
): void {
  registerInboundEmailRawMimeRoutes(server, { repository, inboundEmailJobQueue, s3 });
  registerInboundEmailImapSettingsRoutes(server, { repository, inboundEmailJobQueue, s3 });
  registerInboundEmailParserJobRoutes(server, { repository, inboundEmailJobQueue });
  registerInboundEmailStatusRoutes(server, { repository });
  registerInboundEmailAttachmentPromotionRoutes(server, { repository });
  registerInboundEmailMessageRoutes(server, { repository });
  registerInboundEmailMatterDraftRoutes(server, { repository });
  registerInboundEmailTriageRoutes(server, { repository });
}
