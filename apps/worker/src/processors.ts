import type { OpenPracticeQueueName } from "@open-practice/domain";

export interface WorkerJobEnvelope {
  firmId: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkerJobResult {
  status: "completed" | "skipped";
  reason?: string;
  metadata: Record<string, unknown>;
}

const disabledReasons: Record<OpenPracticeQueueName, string> = {
  email: "SMTP email delivery is not configured",
  inbound_email: "Inbound email parsing is not configured",
  ai_triage: "AI triage is disabled by default",
  ocr: "OCR worker dependencies are not configured",
  transcription: "Whisper transcription is not configured",
  media: "FFmpeg media processing is not configured",
};

export async function processOpenPracticeJob(
  queueName: OpenPracticeQueueName,
  _jobName: string,
  data: WorkerJobEnvelope,
): Promise<WorkerJobResult> {
  return {
    status: "skipped",
    reason: disabledReasons[queueName],
    metadata: {
      firmId: data.firmId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      providerConfigured: false,
    },
  };
}
