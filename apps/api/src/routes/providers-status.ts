import type { FastifyInstance } from "fastify";
import {
  canReadJobLifecycleRecord,
  type OpenPracticeQueueName,
  type ProviderSettingKind,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { buildAuthExtensionStatus } from "./auth-extensions.js";
import { buildDocumentProcessingStatus } from "./document-processing.js";
import { buildDraftAssistStatus } from "./draft-assist.js";
import { buildEmailStatus } from "./email.js";
import { buildExternalUploadsStatus } from "./external-uploads.js";
import { buildInboundEmailStatus } from "./inbound-email.js";
import {
  openPracticeQueueNames,
  providerStatus,
  queueStatus,
  serializeJobRun,
  summarizeJobRuns,
} from "./job-status.js";
import type { ApiJobQueue, ApiRouteDependencies } from "./types.js";

const providerSettingKinds = [
  "smtp",
  "inbound_email",
  "ai",
  "ocr",
  "transcription",
  "media",
  "storage",
] as const satisfies readonly ProviderSettingKind[];

const bullMqProducerQueueNames = [
  "email",
  "connectors",
  "ai_triage",
  "ocr",
] as const satisfies readonly OpenPracticeQueueName[];

type RegisterProviderStatusRouteOptions = ApiRouteDependencies & {
  jwtSecret?: string;
  webAuthn?: {
    rpID: string;
    origin: string;
  };
};

function queueForName(
  queueName: OpenPracticeQueueName,
  queues: Pick<
    RegisterProviderStatusRouteOptions,
    "emailJobQueue" | "connectorJobQueue" | "aiAssistJobQueue" | "ocrJobQueue"
  >,
): ApiJobQueue | undefined {
  if (queueName === "email") return queues.emailJobQueue;
  if (queueName === "connectors") return queues.connectorJobQueue;
  if (queueName === "ai_triage") return queues.aiAssistJobQueue;
  if (queueName === "ocr") return queues.ocrJobQueue;
  return undefined;
}

function producerQueueStatus(
  queueName: (typeof bullMqProducerQueueNames)[number],
  queue?: ApiJobQueue,
) {
  return queue
    ? { queueName, status: "configured" as const }
    : { queueName, status: "not_configured" as const, reason: "queue_not_configured" as const };
}

function latestJobRuns(records: Parameters<typeof summarizeJobRuns>[0]) {
  return records
    .slice()
    .sort((left, right) => right.queuedAt.localeCompare(left.queuedAt))
    .slice(0, 10)
    .map(serializeJobRun);
}

export function registerProviderStatusRoutes(
  server: FastifyInstance,
  options: RegisterProviderStatusRouteOptions,
): void {
  server.get("/api/providers/status", async (request) => {
    const access = requireAccess(request.auth, {
      resource: "provider_setting",
      action: "read",
    });
    if (!access.ok) throw access.error;

    const [
      providerSettings,
      jobs,
      authExtensions,
      documentProcessing,
      email,
      inboundEmail,
      externalUploads,
      draftAssist,
    ] = await Promise.all([
      Promise.all(
        providerSettingKinds.map(async (kind) =>
          providerStatus(
            kind,
            await options.repository.listProviderSettings(request.auth.firmId, { kind }),
          ),
        ),
      ),
      options.repository.listJobLifecycleRecords(request.auth.firmId),
      buildAuthExtensionStatus({
        repository: options.repository,
        firmId: request.auth.firmId,
        user: request.auth.user,
        jwtSecret: options.jwtSecret,
        webAuthn: options.webAuthn,
      }),
      buildDocumentProcessingStatus({
        repository: options.repository,
        firmId: request.auth.firmId,
        ocrJobQueue: options.ocrJobQueue,
        s3: options.s3,
      }),
      buildEmailStatus({ repository: options.repository, firmId: request.auth.firmId }),
      buildInboundEmailStatus({ repository: options.repository, firmId: request.auth.firmId }),
      buildExternalUploadsStatus({ s3: options.s3, jwtSecret: options.jwtSecret }),
      buildDraftAssistStatus({
        repository: options.repository,
        firmId: request.auth.firmId,
        draftAssistProvider: options.draftAssistProvider,
        aiAssistJobQueue: options.aiAssistJobQueue,
      }),
    ]);
    const visibleJobs = jobs.filter((record) =>
      canReadJobLifecycleRecord({
        user: request.auth.user,
        firmId: request.auth.firmId,
        record,
      }),
    );
    const workerQueues = openPracticeQueueNames.map((queueName) =>
      queueStatus(queueName, queueForName(queueName, options)),
    );
    const producerQueues = bullMqProducerQueueNames.map((queueName) =>
      producerQueueStatus(queueName, queueForName(queueName, options)),
    );

    return {
      status: "reported",
      mode: "configuration_posture",
      liveHealth: {
        status: "not_checked",
        reason: "read_only_configuration_posture",
      },
      providerSettings,
      objectStorage: options.s3
        ? { status: "configured", provider: "s3" }
        : { status: "not_configured", reason: "s3_not_configured" },
      bullmq: {
        producerQueues,
        workerQueues,
        reservedWorkerQueues: workerQueues.filter((queue) => queue.status === "reserved"),
      },
      jobs: {
        summary: summarizeJobRuns(visibleJobs),
        latestRuns: latestJobRuns(visibleJobs),
      },
      documentProcessing,
      email: {
        ...email,
        queue: producerQueueStatus("email", options.emailJobQueue),
      },
      inboundEmail: {
        ...inboundEmail,
        workerQueue: queueStatus("inbound_email", undefined),
      },
      externalUploads,
      draftAssist,
      authExtensions,
    };
  });
}
