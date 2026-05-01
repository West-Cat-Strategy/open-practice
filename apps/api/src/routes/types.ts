import type { S3Client } from "@aws-sdk/client-s3";
import type { OpenPracticeRepository } from "@open-practice/database";
import type {
  DocumentAutomationProvider,
  DraftAssistProvider,
  SignatureProvider,
} from "@open-practice/domain";

export interface ApiJobQueue {
  add(
    name: string,
    data: {
      firmId: string;
      resourceType?: string;
      resourceId?: string;
      metadata?: Record<string, unknown>;
    },
    options?: { jobId?: string },
  ): Promise<{ id?: string | number }>;
}

export interface ApiRouteDependencies {
  repository: OpenPracticeRepository;
  automationProvider?: DocumentAutomationProvider;
  draftAssistProvider?: DraftAssistProvider;
  signatureProvider?: SignatureProvider;
  emailJobQueue?: ApiJobQueue;
  ocrJobQueue?: ApiJobQueue;
  s3?: {
    client: S3Client;
    bucket: string;
  };
}
