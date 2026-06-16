import type { DocumentAutomationProvider, GeneratedDocumentRecord } from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { compactMetadata, metadataString } from "./metadata.js";
import type { WorkerJobEnvelope, WorkerJobResult } from "./types.js";

const ASSEMBLE_INTAKE_GENERATED_PACKAGE_JOB = "assemble_intake_generated_package";

function metadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function processDocumentAssemblyJob(input: {
  jobName: string;
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
  automationProvider?: DocumentAutomationProvider;
}): Promise<WorkerJobResult> {
  const { data, repository } = input;
  const metadata = data.metadata ?? {};

  if (
    input.jobName !== ASSEMBLE_INTAKE_GENERATED_PACKAGE_JOB ||
    data.resourceType !== "intake_generated_package"
  ) {
    return {
      status: "skipped",
      reason: "Unsupported document assembly job",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        providerConfigured: Boolean(input.automationProvider),
        providerStatus: "unsupported",
      }),
    };
  }

  const intakeSessionId = metadataString(metadata, "intakeSessionId");
  const answerSnapshotId = metadataString(metadata, "answerSnapshotId");
  const packageId = metadataString(metadata, "packageId");
  const requestedByUserId = metadataString(metadata, "requestedByUserId");
  const packageDocumentCount = metadataNumber(metadata, "packageDocumentCount");

  if (!intakeSessionId || !answerSnapshotId || !packageId) {
    return {
      status: "skipped",
      reason: "Document assembly metadata was incomplete",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        providerStatus: "invalid_metadata",
      }),
    };
  }

  if (!input.automationProvider) {
    return {
      status: "skipped",
      reason: "Document automation provider is not configured",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        intakeSessionId,
        answerSnapshotId,
        packageId,
        packageDocumentCount,
        providerConfigured: false,
      }),
    };
  }

  const session = await repository.getIntakeSession(data.firmId, intakeSessionId);
  if (!session) {
    return {
      status: "skipped",
      reason: "Intake session was not found",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        intakeSessionId,
        answerSnapshotId,
        packageId,
        packageDocumentCount,
        providerConfigured: true,
        providerStatus: "missing_session",
      }),
    };
  }
  if (session.provider === "docassemble") {
    return {
      status: "skipped",
      reason: "docassemble generated documents are deprecated",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        matterId: session.matterId,
        intakeSessionId,
        answerSnapshotId,
        packageId,
        providerConfigured: true,
        providerStatus: "deprecated_provider",
      }),
    };
  }

  const snapshots = await repository.listAnswerSnapshots(data.firmId, { intakeSessionId });
  const snapshot = snapshots.find((candidate) => candidate.id === answerSnapshotId);
  if (!snapshot) {
    return {
      status: "skipped",
      reason: "Answer snapshot was not found",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        matterId: session.matterId,
        intakeSessionId,
        answerSnapshotId,
        packageId,
        packageDocumentCount,
        providerConfigured: true,
        providerStatus: "missing_snapshot",
      }),
    };
  }
  if (!snapshot.resolution.selectedPackageIds.includes(packageId)) {
    return {
      status: "skipped",
      reason: "Requested package is not eligible for this intake session",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        matterId: session.matterId,
        intakeSessionId,
        answerSnapshotId,
        packageId,
        packageDocumentCount,
        providerConfigured: true,
        providerStatus: "ineligible_package",
      }),
    };
  }

  const packageDocuments = snapshot.resolution.packageDocuments.filter(
    (document) => document.packageId === packageId,
  );
  if (packageDocuments.length === 0) {
    return {
      status: "skipped",
      reason: "Requested package has no resolved documents",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        matterId: session.matterId,
        intakeSessionId,
        answerSnapshotId,
        packageId,
        packageDocumentCount: 0,
        providerConfigured: true,
        providerStatus: "empty_package",
      }),
    };
  }

  const documents: GeneratedDocumentRecord[] = [];
  for (const packageDocument of packageDocuments) {
    const generated = await input.automationProvider.renderDocument({
      firmId: data.firmId,
      matterId: session.matterId,
      sessionExternalId: session.externalId,
      documentTitle: packageDocument.title,
      packageId: packageDocument.packageId,
      packageDocumentId: packageDocument.packageDocumentId,
    });
    documents.push(
      await repository.createGeneratedDocument({
        id: crypto.randomUUID(),
        firmId: data.firmId,
        matterId: session.matterId,
        intakeSessionId: session.id,
        provider: generated.provider,
        externalId: generated.externalId,
        title: generated.title,
        packageId: packageDocument.packageId,
        packageDocumentId: packageDocument.packageDocumentId,
        storageKey: generated.storageKey,
        checksumSha256: generated.checksumSha256,
        evidence: {
          ...(generated.evidence ?? {}),
          answerSnapshotId: snapshot.id,
          source: "worker_document_assembly",
        },
        createdAt: new Date().toISOString(),
      }),
    );
  }

  await repository.appendAuditEvent({
    id: crypto.randomUUID(),
    firmId: data.firmId,
    actorId: requestedByUserId ?? "worker",
    occurredAt: new Date().toISOString(),
    action: "intake.package.generated",
    resourceType: "intake_session",
    resourceId: session.id,
    metadata: compactMetadata({
      matterId: session.matterId,
      intakeSessionId: session.id,
      templateId: snapshot.resolution.templateId,
      templateVersion: snapshot.resolution.templateVersion,
      answerSnapshotId: snapshot.id,
      packageId,
      documentCount: documents.length,
      generatedDocumentCount: documents.length,
      generatedDocumentIdCount: documents.length,
      generatedDocumentIds: documents.map((document) => document.id),
      providerCount: new Set(documents.map((document) => document.provider)).size,
      provider: documents.length === 1 ? documents[0]?.provider : undefined,
    }),
  });

  return {
    status: "completed",
    metadata: compactMetadata({
      firmId: data.firmId,
      resourceType: "intake_generated_package",
      resourceId: data.resourceId,
      matterId: session.matterId,
      intakeSessionId: session.id,
      answerSnapshotId: snapshot.id,
      templateId: snapshot.resolution.templateId,
      templateVersion: snapshot.resolution.templateVersion,
      packageId,
      packageDocumentCount: packageDocuments.length,
      documentCount: documents.length,
      generatedDocumentCount: documents.length,
      generatedDocumentIdCount: documents.length,
      generatedDocumentIds: documents.map((document) => document.id),
      providerCount: new Set(documents.map((document) => document.provider)).size,
      providerConfigured: true,
      providerStatus: "completed",
    }),
  };
}
