import type { S3Client } from "@aws-sdk/client-s3";

export interface WorkerJobEnvelope {
  firmId: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkerJobQueue {
  add(
    name: string,
    data: WorkerJobEnvelope,
    options?: { jobId?: string; delay?: number },
  ): Promise<{ id?: string | number }>;
}

export interface WorkerJobResult {
  status: "completed" | "skipped";
  reason?: string;
  metadata: Record<string, unknown>;
}

export interface ConnectorDeliveryRequest {
  url: string;
  body: string;
  headers: Record<string, string>;
}

export interface ConnectorDeliveryResponse {
  status: number;
}

export type ConnectorSecretResolver = (secretReferenceId: string) => string | undefined;

export type ConnectorHttpDeliverer = (
  request: ConnectorDeliveryRequest,
) => Promise<ConnectorDeliveryResponse>;

export type ConnectorDnsResolver = (hostname: string) => Promise<string[]>;

export type WorkerS3Storage = {
  client: S3Client;
  bucket: string;
  serverSideEncryption?: "AES256";
};
