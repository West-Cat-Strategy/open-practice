import type { FastifyInstance } from "fastify";
import { requireAccess } from "../../http/auth-guards.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import {
  actionableDocumentProcessingTasks,
  documentProcessingProviderKinds,
  documentProcessingQueueNames,
  providerStatus,
  queueStatus,
  reservedDocumentProcessingTasks,
  serializeJobRun,
  summarizeJobRuns,
} from "../job-status.js";
import type { ApiJobQueue, ApiRouteDependencies } from "../types.js";
import { localOcrProviderSetting, ocrProviderBodySchema } from "./shared.js";

export async function buildDocumentProcessingStatus(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  ocrJobQueue?: ApiJobQueue;
  s3?: ApiRouteDependencies["s3"];
}) {
  const providers = await Promise.all([
    input.repository.listProviderSettings(input.firmId, { kind: "ocr" }),
    input.repository.listProviderSettings(input.firmId, { kind: "transcription" }),
    input.repository.listProviderSettings(input.firmId, { kind: "media" }),
    input.repository.listProviderSettings(input.firmId, { kind: "ai" }),
  ]);
  const providerStates = documentProcessingProviderKinds.map((kind, index) =>
    providerStatus(kind, providers[index] ?? []),
  );
  const jobs = (await input.repository.listJobLifecycleRecords(input.firmId)).filter((job) =>
    documentProcessingQueueNames.some((queueName) => queueName === job.queueName),
  );
  const workerQueues = documentProcessingQueueNames.map((queueName) =>
    queueStatus(queueName, queueName === "ocr" ? input.ocrJobQueue : undefined),
  );
  const reservedQueues = workerQueues.filter((queue) => queue.status === "reserved");
  const ocrProviderState =
    providerStates.find((providerState) => providerState.kind === "ocr") ??
    providerStatus("ocr", []);
  const configuredOcrProviders = (providers[0] ?? []).filter((provider) => provider.enabled);
  return {
    status: configuredOcrProviders.length > 0 && input.s3 ? "configured" : "disabled",
    reason:
      configuredOcrProviders.length > 0 && input.s3
        ? undefined
        : ocrProviderState.reason === "provider_disabled"
          ? "provider_disabled"
          : configuredOcrProviders.length > 0 && !input.s3
            ? "storage_not_configured"
            : "not_configured",
    workers: workerQueues.filter((queue) => queue.status === "configured"),
    workerQueues,
    reservedQueues,
    supportedTasks: ["malware_scan", "ocr", "classification", "transcription", "media"],
    actionableTasks: actionableDocumentProcessingTasks,
    reservedTasks: reservedDocumentProcessingTasks,
    providers: configuredOcrProviders.map((provider) => ({
      kind: provider.kind,
      key: provider.key,
    })),
    providerStatus: providerStates,
    summary: summarizeJobRuns(jobs),
    jobs: jobs.map(serializeJobRun),
  };
}

export function registerDocumentProcessingStatusRoutes(
  server: FastifyInstance,
  { repository, ocrJobQueue, s3 }: ApiRouteDependencies,
): void {
  server.get("/api/document-processing/status", async (request) => {
    const access = requireAccess(request.auth, {
      resource: "provider_setting",
      action: "read",
    });
    if (!access.ok) throw access.error;

    return buildDocumentProcessingStatus({
      repository,
      firmId: request.auth.firmId,
      ocrJobQueue,
      s3,
    });
  });

  server.put("/api/document-processing/ocr-provider", async (request) => {
    const access = requireAccess(request.auth, {
      resource: "provider_setting",
      action: "update",
    });
    if (!access.ok) throw access.error;

    const body = parseRequestPart(ocrProviderBodySchema, request.body ?? {}, "body");
    const now = new Date().toISOString();
    const setting = await repository.upsertProviderSetting(
      localOcrProviderSetting({
        firmId: request.auth.firmId,
        enabled: body.enabled,
        now,
      }),
    );
    await appendRouteAuditEvent(repository, request.auth, {
      action: "document_processing.ocr_provider.updated",
      resourceType: "provider_setting",
      resourceId: setting.id,
      metadata: {
        providerKind: "ocr",
        providerKey: setting.key,
        enabled: setting.enabled,
      },
    });

    return buildDocumentProcessingStatus({
      repository,
      firmId: request.auth.firmId,
      ocrJobQueue,
      s3,
    });
  });
}
