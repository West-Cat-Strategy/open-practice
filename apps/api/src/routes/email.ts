import type { FastifyInstance } from "fastify";
import { registerEmailOutboxRoutes } from "./email/outbox.js";
import { registerEmailReceiptRoutes } from "./email/receipts.js";
import { registerEmailSettingsRoutes } from "./email/settings.js";
import { registerEmailStatusRoutes } from "./email/status.js";
import { registerEmailTemplateDraftRoutes } from "./email/templates.js";
import type { ApiRouteDependencies } from "./types.js";

export { buildEmailStatus } from "./email/status.js";

type RegisterEmailRouteOptions = ApiRouteDependencies & {
  jwtSecret?: string;
  publicWebBaseUrl?: string;
};

export function registerEmailRoutes(
  server: FastifyInstance,
  {
    repository,
    emailJobQueue,
    jwtSecret,
    publicWebBaseUrl,
    connectorDnsResolver,
  }: RegisterEmailRouteOptions,
): void {
  registerEmailStatusRoutes(server, { repository });
  registerEmailSettingsRoutes(server, { repository, connectorDnsResolver });
  registerEmailTemplateDraftRoutes(server, { repository });
  registerEmailOutboxRoutes(server, { repository, emailJobQueue, jwtSecret, publicWebBaseUrl });
  registerEmailReceiptRoutes(server, { repository, jwtSecret });
}
