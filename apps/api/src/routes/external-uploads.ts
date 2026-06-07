import type { FastifyInstance } from "fastify";
import { registerPublicExternalUploadRoutes } from "./external-uploads/public.js";
import { registerStaffExternalUploadRoutes } from "./external-uploads/staff.js";
import type { ApiRouteDependencies } from "./types.js";

export { buildExternalUploadsStatus } from "./external-uploads/staff.js";

export function registerExternalUploadRoutes(
  server: FastifyInstance,
  { repository, s3, jwtSecret, emailJobQueue }: ApiRouteDependencies & { jwtSecret?: string },
): void {
  registerStaffExternalUploadRoutes(server, { repository, s3, jwtSecret, emailJobQueue });
  registerPublicExternalUploadRoutes(server, { repository, s3, jwtSecret });
}
