import type { S3Client } from "@aws-sdk/client-s3";
import type { OpenPracticeRepository } from "@open-practice/database";
import type {
  AiOperationalProposalProvider,
  DocumentAutomationProvider,
  DraftExportDocument,
  DraftExportFormat,
  DraftAssistProvider,
  PaymentProcessorProvider,
  SignatureProvider,
} from "@open-practice/domain";

export type ApiJobEnvelope = {
  firmId: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

export interface QueueProducerPort<Data extends ApiJobEnvelope = ApiJobEnvelope> {
  add(
    name: string,
    data: Data,
    options?: { jobId?: string; delay?: number },
  ): Promise<{ id?: string | number }>;
}

export type ApiJobQueue = QueueProducerPort;

export interface ObjectStoragePort {
  client: S3Client;
  bucket: string;
  serverSideEncryption?: "AES256";
}

export type ConnectorDnsResolver = (hostname: string) => Promise<string[]>;

export type DraftExportRenderer = (input: {
  format: DraftExportFormat;
  document: DraftExportDocument;
}) => Promise<{
  buffer: Buffer;
  contentType: string;
  extension: DraftExportFormat;
}>;

export interface ProviderAdapterPorts {
  automationProvider?: DocumentAutomationProvider;
  aiOperationalProposalProvider?: AiOperationalProposalProvider;
  draftExportRenderer?: DraftExportRenderer;
  draftAssistProvider?: DraftAssistProvider;
  signatureProvider?: SignatureProvider;
  paymentProcessorProvider?: PaymentProcessorProvider;
}

export interface ApiRouteDependencies extends ProviderAdapterPorts {
  repository: OpenPracticeRepository;
  publicWebBaseUrl?: string;
  meetingLinks?: {
    providerKey: string;
    hostedMeetingBaseUrl?: string;
    guestAccessTokenSigningConfigured?: boolean;
  };
  emailJobQueue?: ApiJobQueue;
  connectorJobQueue?: ApiJobQueue;
  connectorDnsResolver?: ConnectorDnsResolver;
  inboundEmailJobQueue?: ApiJobQueue;
  reportJobQueue?: ApiJobQueue;
  aiAssistJobQueue?: ApiJobQueue;
  ocrJobQueue?: ApiJobQueue;
  s3?: ObjectStoragePort;
}
