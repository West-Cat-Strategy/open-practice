import type { FastifyInstance } from "fastify";
import { registerPublicShareRoutes } from "./shares/public.js";
import { registerStaffShareRoutes } from "./shares/staff.js";
import type { ShareRouteDependencies } from "./shares/shared.js";

export function registerShareRoutes(
  server: FastifyInstance,
  options: ShareRouteDependencies,
): void {
  registerStaffShareRoutes(server, options);
  registerPublicShareRoutes(server, options);
}
