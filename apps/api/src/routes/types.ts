import type { S3Client } from "@aws-sdk/client-s3";
import type { OpenPracticeRepository } from "@open-practice/database";
import type { DocumentAutomationProvider, SignatureProvider } from "@open-practice/domain";

export interface ApiRouteDependencies {
  repository: OpenPracticeRepository;
  automationProvider?: DocumentAutomationProvider;
  signatureProvider?: SignatureProvider;
  s3?: {
    client: S3Client;
    bucket: string;
  };
}
