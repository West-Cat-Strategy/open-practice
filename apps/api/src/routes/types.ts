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
    options?: { jobId?: string; delay?: number },
  ): Promise<{ id?: string | number }>;
}

export type ConnectorDnsResolver = (hostname: string) => Promise<string[]>;

export interface ApiRouteDependencies {
  repository: OpenPracticeRepository;
  automationProvider?: DocumentAutomationProvider;
  draftAssistProvider?: DraftAssistProvider;
  signatureProvider?: SignatureProvider;
  meetingLinks?: {
    providerKey: string;
    hostedMeetingBaseUrl?: string;
    guestAccessTokenSigningConfigured?: boolean;
  };
  emailJobQueue?: ApiJobQueue;
  connectorJobQueue?: ApiJobQueue;
  connectorDnsResolver?: ConnectorDnsResolver;
  reportJobQueue?: ApiJobQueue;
  aiAssistJobQueue?: ApiJobQueue;
  ocrJobQueue?: ApiJobQueue;
  s3?: {
    client: S3Client;
    bucket: string;
  };
}
