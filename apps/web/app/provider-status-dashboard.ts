import type { ProvidersStatusResponse, WorkerQueueStatus } from "./types";

const emptyWorkerSummary = {
  total: 0,
  queued: 0,
  active: 0,
  failed: 0,
  terminal: 0,
  byQueue: [],
};

function queueUnavailable(queueName: string): WorkerQueueStatus {
  return {
    queueName,
    status: "not_configured",
    reason: "provider_status_unavailable",
  };
}

export function buildProvidersStatusPath(): string {
  return "/api/providers/status";
}

export function emptyProvidersStatusResponse(
  reason = "provider_status_unavailable",
): ProvidersStatusResponse {
  const emailQueue = queueUnavailable("email");
  const inboundEmailQueue = queueUnavailable("inbound_email");
  return {
    status: "unavailable",
    mode: "configuration_posture",
    liveHealth: { status: "not_checked", reason },
    providerSettings: [],
    objectStorage: { status: "not_configured", reason },
    bullmq: {
      producerQueues: [emailQueue],
      workerQueues: [emailQueue, inboundEmailQueue],
      reservedWorkerQueues: [],
    },
    jobs: {
      summary: emptyWorkerSummary,
      latestRuns: [],
    },
    documentProcessing: {
      status: "unavailable",
      reason,
      workers: [],
      workerQueues: [],
      reservedQueues: [],
      supportedTasks: [],
      actionableTasks: ["ocr"],
      reservedTasks: [],
      providers: [],
      providerStatus: [],
      summary: emptyWorkerSummary,
      jobs: [],
    },
    email: {
      status: "disabled",
      reason,
      providers: [],
      queue: emailQueue,
    },
    inboundEmail: {
      status: "disabled",
      reason,
      addresses: [],
      workerQueue: inboundEmailQueue,
    },
    externalUploads: {
      status: "not_configured",
      reason,
      tokenSigning: "not_configured",
      s3: "not_configured",
    },
    draftAssist: {
      status: "disabled",
      reason,
      supportedTasks: ["summarize", "suggest_revision", "continue_draft"],
    },
    authExtensions: {},
  } satisfies ProvidersStatusResponse;
}

export function compactProviderStatus(value?: string): string {
  return value ? value.replaceAll("_", " ") : "none";
}

function configuredQueueCount(queues: WorkerQueueStatus[]): number {
  return queues.filter((queue) => queue.status === "configured").length;
}

export function summarizeProvidersStatus(status: ProvidersStatusResponse): string {
  const enabledProviders = status.providerSettings.reduce(
    (sum, setting) => sum + setting.providers.filter((provider) => provider.enabled).length,
    0,
  );
  const configuredProducers = configuredQueueCount(status.bullmq.producerQueues);
  const configuredWorkers = configuredQueueCount(status.bullmq.workerQueues);
  const activeJobs = status.jobs.summary.queued + status.jobs.summary.active;
  return `${enabledProviders} providers enabled. ${configuredProducers} producer queues and ${configuredWorkers} worker queues configured. ${activeJobs} active or queued jobs. ${status.jobs.summary.failed} failed jobs.`;
}

export function providerPostureRows(status: ProvidersStatusResponse): Array<{
  key: string;
  label: string;
  status: string;
  detail: string;
  tone: "neutral" | "ready" | "risk";
}> {
  const emailQueue = status.email.queue;
  const inboundQueue = status.inboundEmail.workerQueue;
  const ocrQueue = status.documentProcessing.workerQueues.find(
    (queue) => queue.queueName === "ocr",
  );
  return [
    {
      key: "email",
      label: "Outbound email",
      status: compactProviderStatus(status.email.status),
      detail: `Provider ${compactProviderStatus(status.email.provider ?? status.email.reason)} · queue ${compactProviderStatus(emailQueue?.status)}`,
      tone:
        status.email.status === "configured" && emailQueue?.status === "configured"
          ? "ready"
          : "risk",
    },
    {
      key: "inbound-email",
      label: "Inbound email",
      status: compactProviderStatus(status.inboundEmail.status),
      detail: `${status.inboundEmail.addresses?.length ?? 0} addresses · queue ${compactProviderStatus(inboundQueue?.status)}`,
      tone: status.inboundEmail.status === "configured" ? "ready" : "neutral",
    },
    {
      key: "document-processing",
      label: "Document processing",
      status: compactProviderStatus(status.documentProcessing.status),
      detail: `${compactProviderStatus(ocrQueue?.status)} OCR queue · ${status.documentProcessing.reservedQueues?.length ?? 0} reserved queues`,
      tone:
        status.documentProcessing.status === "configured" && ocrQueue?.status === "configured"
          ? "ready"
          : "risk",
    },
    {
      key: "external-uploads",
      label: "External uploads",
      status: compactProviderStatus(status.externalUploads.status),
      detail: `Storage ${compactProviderStatus(status.externalUploads.s3)} · tokens ${compactProviderStatus(status.externalUploads.tokenSigning)}`,
      tone: status.externalUploads.status === "available" ? "ready" : "risk",
    },
    {
      key: "draft-assist",
      label: "Draft assist",
      status: compactProviderStatus(status.draftAssist.status),
      detail: `Provider ${compactProviderStatus(status.draftAssist.provider ?? status.draftAssist.reason)}`,
      tone: status.draftAssist.status === "configured" ? "ready" : "neutral",
    },
  ];
}
