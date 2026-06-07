import type { FastifyInstance } from "fastify";
import { registerClientPortalAccountRoutes } from "./client-portal/accounts.js";
import { registerClientPortalWorkspaceRoutes } from "./client-portal/workspace.js";
import type { ApiRouteDependencies } from "./types.js";

export function registerClientPortalRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies & { jwtSecret?: string },
): void {
  registerClientPortalAccountRoutes(server, dependencies);
  registerClientPortalWorkspaceRoutes(server, { repository: dependencies.repository });
}
