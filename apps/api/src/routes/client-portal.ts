import type { FastifyInstance } from "fastify";
import { registerClientPortalAccountRoutes } from "./client-portal/accounts.js";
import { registerClientPortalDocumentRoutes } from "./client-portal/documents.js";
import { registerClientPortalSignatureRoutes } from "./client-portal/signatures.js";
import { registerClientPortalWorkspaceRoutes } from "./client-portal/workspace.js";
import type { ApiRouteDependencies } from "./types.js";

export function registerClientPortalRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies & { jwtSecret?: string },
): void {
  registerClientPortalAccountRoutes(server, dependencies);
  registerClientPortalDocumentRoutes(server, {
    repository: dependencies.repository,
    s3: dependencies.s3,
  });
  registerClientPortalSignatureRoutes(server, { repository: dependencies.repository });
  registerClientPortalWorkspaceRoutes(server, { repository: dependencies.repository });
}
