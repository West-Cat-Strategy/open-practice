import type { FastifyInstance } from "fastify";
import { registerDocumentProcessingQueueRoutes } from "./document-processing/queue.js";
import { registerDocumentProcessingStatusRoutes } from "./document-processing/status.js";
import { registerDocumentProcessingWorkbenchRoutes } from "./document-processing/workbench.js";
import type { ApiRouteDependencies } from "./types.js";

export { queueDocumentOcr } from "./document-processing/queue.js";
export { buildDocumentProcessingStatus } from "./document-processing/status.js";
export { assertOcrProviderConfigured } from "./document-processing/shared.js";
export type {
  QueueDocumentOcrInput,
  QueueDocumentOcrResult,
} from "./document-processing/shared.js";

export function registerDocumentProcessingRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  registerDocumentProcessingStatusRoutes(server, dependencies);
  registerDocumentProcessingWorkbenchRoutes(server, dependencies);
  registerDocumentProcessingQueueRoutes(server, dependencies);
}
