import type { FastifyInstance } from "fastify";
import { registerCommunicationsInboxRoutes } from "./communications/inbox.js";
import type { ApiRouteDependencies } from "./types.js";

export function registerCommunicationsRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  registerCommunicationsInboxRoutes(server, dependencies);
}
