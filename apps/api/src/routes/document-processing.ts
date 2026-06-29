import type { FastifyInstance } from "fastify";
import { registerDocumentProcessingQueueRoutes } from "./document-processing/queue.js";
import { registerDocumentProcessingReviewRoutes } from "./document-processing/review.js";
import { registerDocumentProcessingSettingsRoutes } from "./document-processing/settings.js";
import { registerDocumentProcessingStatusRoutes } from "./document-processing/status.js";
import { registerDocumentProcessingWorkbenchRoutes } from "./document-processing/workbench.js";
import type { ApiRouteDependencies } from "./types.js";

export { buildDocumentProcessingStatus } from "./document-processing/status.js";

export function registerDocumentProcessingRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  registerDocumentProcessingSettingsRoutes(server, dependencies);
  registerDocumentProcessingStatusRoutes(server, dependencies);
  registerDocumentProcessingWorkbenchRoutes(server, dependencies);
  registerDocumentProcessingQueueRoutes(server, dependencies);
  registerDocumentProcessingReviewRoutes(server, dependencies);
}
