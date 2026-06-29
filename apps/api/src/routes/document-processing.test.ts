import Fastify, { type FastifyInstance } from "fastify";
import type { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { LegalResearchArtifactStatus, ProfessionalRole, User } from "@open-practice/domain";
import { registerDocumentProcessingRoutes } from "./document-processing.js";
import type { ApiJobQueue } from "./types.js";

const firmId = "firm-west-legal";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  return {
    id: `user-${role}`,
    firmId,
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function fakeOcrQueue() {
  const jobs: Array<{ name: string; data: unknown; jobId?: string }> = [];
  const queue: ApiJobQueue = {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "bull-ocr-job" };
    },
  };
  return { queue, jobs };
}

function fakeS3(): { client: S3Client; bucket: string } {
  return {
    client: {} as S3Client,
    bucket: "open-practice-test-documents",
  };
}

async function enableOcrProvider(
  repository: InMemoryOpenPracticeRepository,
  enabled = true,
): Promise<void> {
  await repository.upsertProviderSetting({
    id: "provider-ocr-enabled",
    firmId,
    kind: "ocr",
    key: "local-cli-ocr",
    enabled,
    encryptedConfig: "synthetic-config-not-returned",
    createdAt: "2026-05-02T12:00:00.000Z",
    updatedAt: "2026-05-02T12:00:00.000Z",
  });
}

type ConversionReviewDecision = "reviewed" | "rejected";

const unsafeConversionReviewFragments = [
  "Synthetic conversion review decision OCR text must stay private.",
  "# decision markdown must not survive",
  "Synthetic provider evidence",
  "Synthetic provider payload",
  "Synthetic annotation body",
  "Synthetic prompt",
  "Synthetic chunk",
  "Synthetic object body",
  "Synthetic private excerpt",
  "Synthetic generated summary",
] as const;

async function createConversionReviewArtifact(
  repository: InMemoryOpenPracticeRepository,
  input: {
    id?: string;
    documentId?: string;
    matterId?: string;
    status?: LegalResearchArtifactStatus;
    decision?: ConversionReviewDecision;
    reviewedAt?: string;
    updatedAt?: string;
    unsafeMetadata?: boolean;
  } = {},
) {
  const status = input.status ?? "ready_for_review";
  const decision =
    input.decision ?? (status === "reviewed" || status === "rejected" ? status : undefined);
  const reviewedAt = input.reviewedAt ?? "2026-06-27T13:00:00.000Z";
  return repository.createLegalResearchArtifact({
    id: input.id ?? `artifact-conversion-review-${input.documentId ?? "doc-001"}-${status}`,
    firmId,
    matterId: input.matterId ?? "matter-001",
    kind: "document_analysis_status",
    status,
    title: "Document conversion review posture",
    sourceReferences: [],
    contextLinks: [
      {
        resourceType: "document",
        resourceId: input.documentId ?? "doc-001",
        label: "Source document",
      },
    ],
    documentAnalysis: {
      documentId: input.documentId ?? "doc-001",
      status: status === "draft" ? "in_review" : "ready_for_review",
      extractionStatus: "completed",
      artifactStatus: "metadata_only",
      sourceTextLength: 47,
    },
    ...(decision
      ? {
          reviewDecision: decision,
          reviewedByUserId: "user-owner_admin",
          reviewedAt,
        }
      : {}),
    createdByUserId: "user-owner_admin",
    createdAt: "2026-06-27T12:00:00.000Z",
    updatedAt: input.updatedAt ?? (decision ? reviewedAt : "2026-06-27T12:05:00.000Z"),
    reviewOnly: true,
    metadata: {
      source: "document_conversion_review",
      jobId: "job-conversion-review-decision",
      extractionId: "extraction-conversion-review-decision",
      extractionEngine: "tesseract",
      extractionStatus: "completed",
      provider: "local-document-conversion-metadata",
      providerStatus: "metadata_only",
      counts: { sourceTextLength: 47, wordCount: 6, lineCount: 2, nonEmptyLineCount: 2 },
      policy: {
        metadataOnly: true,
        reviewOnly: true,
        internalExtractedTextStored: true,
        rawOcrTextStored: false,
        rawOcrTextStoredInMetadata: false,
        rawOcrTextReturned: false,
        rawMarkdownStored: false,
        annotationBodiesStored: false,
        chunksStored: false,
        embeddingsStored: false,
        providerPayloadsStored: false,
      },
      conversionReviewPosture: "ready_for_review",
      summaryPosture: "op_authored_metadata_only",
      ...(input.unsafeMetadata === false
        ? {}
        : {
            rawOcrText: "Synthetic conversion review decision OCR text must stay private.",
            convertedMarkdown: "# decision markdown must not survive",
            rawMarkdown: "# decision markdown must not survive",
            providerEvidence: { private: "Synthetic provider evidence" },
            providerPayload: { private: "Synthetic provider payload" },
            providerPayloads: [{ private: "Synthetic provider payload" }],
            annotationSpans: [{ start: 0, end: 12, body: "Synthetic annotation body" }],
            annotations: [{ body: "Synthetic annotation body" }],
            prompt: "Synthetic prompt",
            chunks: ["Synthetic chunk"],
            embeddings: [[0.1, 0.2]],
            storageKey: "matters/matter-001/private-conversion.md",
            objectKey: "matters/matter-001/private-object",
            objectBody: "Synthetic object body",
            privateExcerpt: "Synthetic private excerpt",
            generatedSummary: "Synthetic generated summary",
          }),
    },
  });
}

async function conversionReviewMutationSnapshot(
  repository: InMemoryOpenPracticeRepository,
): Promise<string> {
  return JSON.stringify({
    document: await repository.getDocument(firmId, "doc-001"),
    jobs: await repository.listJobLifecycleRecords(firmId, { queueName: "ocr" }),
    drafts: await repository.listDrafts(firmId, { matterId: "matter-001" }),
    tasks: await repository.listTaskDeadlines(firmId, {
      matterId: "matter-001",
      includeCompleted: true,
    }),
    calendarEvents: await repository.listCalendarEvents(firmId, { matterId: "matter-001" }),
    calendarRequests: await repository.listCalendarSchedulingRequests(firmId, {
      matterId: "matter-001",
    }),
    ledgerPostingRequests: await repository.listLedgerPostingRequests(firmId, {
      matterId: "matter-001",
    }),
    portalGrants: await repository.listPortalGrants(firmId),
    portalDocumentAccess: await repository.listPortalDocumentAccess(firmId, {
      matterId: "matter-001",
    }),
  });
}

function testServer(
  input: {
    repository?: InMemoryOpenPracticeRepository;
    authUser?: User;
    ocrJobQueue?: ApiJobQueue;
    s3?: { client: S3Client; bucket: string } | null;
  } = {},
): FastifyInstance {
  const server = Fastify({ logger: false });
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerDocumentProcessingRoutes(server, {
    repository,
    ocrJobQueue: input.ocrJobQueue,
    s3: input.s3 === null ? undefined : (input.s3 ?? fakeS3()),
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("document processing routes", () => {
  it("reports OCR-only actionable defaults when no document provider is configured", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/document-processing/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "disabled",
      reason: "not_configured",
      supportedTasks: ["malware_scan", "ocr", "classification", "transcription", "media"],
      actionableTasks: ["ocr"],
      reservedTasks: expect.arrayContaining([
        expect.objectContaining({ task: "classification", queueName: "ai_triage" }),
        expect.objectContaining({ task: "transcription", queueName: "transcription" }),
        expect.objectContaining({ task: "media", queueName: "media" }),
      ]),
      workerQueues: expect.arrayContaining([
        expect.objectContaining({
          queueName: "ai_triage",
          status: "reserved",
          reason: "deferred_worker",
        }),
        expect.objectContaining({
          queueName: "ocr",
          status: "not_configured",
        }),
      ]),
      providerReadiness: expect.arrayContaining([
        expect.objectContaining({
          kind: "ocr",
          task: "ocr",
          queueName: "ocr",
          status: "disabled",
          reason: "not_configured",
          actionable: true,
          providerStatus: "disabled",
          providerReason: "not_configured",
          queueStatus: "not_configured",
          queueReason: "queue_not_configured",
          storageRequired: true,
          storageConfigured: true,
          evidencePacket: expect.objectContaining({
            packet: "document_processing_provider_readiness",
            posture: "op_authored_metadata_only",
            metadataOnly: true,
            internalExtractedTextStored: true,
            rawPrivateTextStored: false,
            rawPrivateTextStoredInMetadata: false,
            rawOcrTextStoredInMetadata: false,
            providerPayloadsStored: false,
            realProviderActivation: false,
            jobCounts: { total: 0, queued: 0, active: 0, failed: 0, terminal: 0 },
          }),
        }),
        expect.objectContaining({
          kind: "ai",
          task: "classification",
          status: "reserved",
          reason: "deferred_worker",
          actionable: false,
        }),
        expect.objectContaining({
          kind: "transcription",
          task: "transcription",
          status: "reserved",
          reason: "deferred_worker",
          actionable: false,
        }),
      ]),
      evidencePacket: {
        packet: "document_processing_boundary",
        posture: "op_authored_metadata_only",
        status: "disabled",
        reason: "not_configured",
        reviewOnly: true,
        metadataOnly: true,
        internalExtractedTextStored: true,
        rawPrivateTextStored: false,
        rawPrivateTextStoredInMetadata: false,
        rawOcrTextStored: false,
        rawOcrTextStoredInMetadata: false,
        rawOcrTextReturned: false,
        providerPayloadsStored: false,
        providerPayloadsReturned: false,
        realProviderActivation: false,
        providerReadinessCounts: {
          ready: 0,
          disabled: 1,
          reserved: 3,
          actionable: 1,
        },
        jobCounts: { total: 0, queued: 0, active: 0, failed: 0, terminal: 0 },
      },
    });
  });

  it("requires operator provider-setting read access for firm-wide OCR posture", async () => {
    const denied = await testServer({ authUser: user("firm_member", ["matter-001"]) }).inject({
      method: "GET",
      url: "/api/document-processing/status",
    });
    const auditor = await testServer({ authUser: user("auditor", []) }).inject({
      method: "GET",
      url: "/api/document-processing/status",
    });

    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toMatchObject({
      code: "PROVIDER_SETTING_ACCESS_REQUIRED",
      message: "Provider setting access required",
    });
    expect(auditor.statusCode).toBe(200);
    expect(auditor.json()).toMatchObject({ status: "disabled", reason: "not_configured" });
  });

  it("lets owner admins enable and disable the local OCR provider without exposing config", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue } = fakeOcrQueue();
    const server = testServer({ repository, ocrJobQueue: queue });

    const enabled = await server.inject({
      method: "PUT",
      url: "/api/document-processing/ocr-provider",
      payload: { enabled: true },
    });
    const denied = await testServer({
      repository,
      authUser: user("licensee", ["matter-001"]),
      ocrJobQueue: queue,
    }).inject({
      method: "PUT",
      url: "/api/document-processing/ocr-provider",
      payload: { enabled: false },
    });
    const disabled = await server.inject({
      method: "PUT",
      url: "/api/document-processing/ocr-provider",
      payload: { enabled: false },
    });

    expect(enabled.statusCode).toBe(200);
    expect(enabled.json()).toMatchObject({
      status: "configured",
      providers: [{ kind: "ocr", key: "local-cli-ocr" }],
      providerStatus: expect.arrayContaining([
        expect.objectContaining({
          kind: "ocr",
          status: "configured",
          providers: [expect.objectContaining({ key: "local-cli-ocr", enabled: true })],
        }),
      ]),
      workerQueues: expect.arrayContaining([{ queueName: "ocr", status: "configured" }]),
    });
    expect(JSON.stringify(enabled.json())).not.toContain("synthetic-config-not-returned");
    expect(JSON.stringify(enabled.json())).not.toContain("encryptedConfig");
    expect(denied.statusCode).toBe(403);
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json()).toMatchObject({
      status: "disabled",
      reason: "provider_disabled",
      providers: [],
    });
    await expect(repository.listProviderSettings(firmId, { kind: "ocr" })).resolves.toEqual([
      expect.objectContaining({
        key: "local-cli-ocr",
        enabled: false,
        encryptedConfig: "local-cli-ocr:no-secret",
      }),
    ]);
    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "document_processing.ocr_provider.updated",
          resourceType: "provider_setting",
          metadata: { providerKind: "ocr", providerKey: "local-cli-ocr", enabled: true },
        }),
        expect.objectContaining({
          action: "document_processing.ocr_provider.updated",
          resourceType: "provider_setting",
          metadata: { providerKind: "ocr", providerKey: "local-cli-ocr", enabled: false },
        }),
      ]),
    );
  });

  it("reports disabled providers, worker queue availability, and redacted job summaries", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-ocr-disabled",
      firmId,
      kind: "ocr",
      key: "local-cli-ocr",
      enabled: false,
      encryptedConfig: "synthetic-disabled-config",
      createdAt: "2026-05-02T09:00:00.000Z",
      updatedAt: "2026-05-02T09:00:00.000Z",
    });
    await repository.createJobLifecycleRecord({
      id: "job-ocr-dead",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "dead_letter",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 3,
      maxAttempts: 3,
      queuedAt: "2026-05-02T09:10:00.000Z",
      failedAt: "2026-05-02T09:12:00.000Z",
      errorMessage: "Synthetic OCR provider unavailable",
      metadata: {
        matterId: "matter-001",
        documentId: "doc-001",
        task: "ocr",
        providerConfigured: false,
        content: "Do not return document text",
        storageKey: "matters/matter-001/doc-001.pdf",
      },
    });

    const response = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/document-processing/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "disabled",
      reason: "provider_disabled",
      workerQueues: expect.arrayContaining([
        {
          queueName: "ai_triage",
          status: "reserved",
          reason: "deferred_worker",
          task: "classification",
          actionable: false,
        },
        {
          queueName: "ocr",
          status: "not_configured",
          reason: "queue_not_configured",
        },
        {
          queueName: "transcription",
          status: "reserved",
          reason: "deferred_worker",
          task: "transcription",
          actionable: false,
        },
        {
          queueName: "media",
          status: "reserved",
          reason: "deferred_worker",
          task: "media",
          actionable: false,
        },
      ]),
      reservedQueues: expect.arrayContaining([
        expect.objectContaining({ queueName: "ai_triage", status: "reserved" }),
        expect.objectContaining({ queueName: "transcription", status: "reserved" }),
        expect.objectContaining({ queueName: "media", status: "reserved" }),
      ]),
      supportedTasks: ["malware_scan", "ocr", "classification", "transcription", "media"],
      actionableTasks: ["ocr"],
      reservedTasks: expect.arrayContaining([
        expect.objectContaining({
          task: "classification",
          queueName: "ai_triage",
          status: "reserved",
        }),
        expect.objectContaining({
          task: "transcription",
          queueName: "transcription",
          status: "reserved",
        }),
        expect.objectContaining({ task: "media", queueName: "media", status: "reserved" }),
      ]),
      providerStatus: expect.arrayContaining([
        expect.objectContaining({
          kind: "ocr",
          status: "disabled",
          reason: "provider_disabled",
          providers: [
            {
              key: "local-cli-ocr",
              enabled: false,
              disabledReason: "provider_disabled",
              updatedAt: "2026-05-02T09:00:00.000Z",
            },
          ],
        }),
      ]),
      providerReadiness: expect.arrayContaining([
        expect.objectContaining({
          kind: "ocr",
          task: "ocr",
          status: "disabled",
          reason: "provider_disabled",
          providerStatus: "disabled",
          providerReason: "provider_disabled",
          providerCount: 1,
          enabledProviderCount: 0,
          evidencePacket: expect.objectContaining({
            metadataOnly: true,
            providerPayloadsStored: false,
            providerPayloadsReturned: false,
            realProviderActivation: false,
            retainedEvidenceFields: expect.arrayContaining([
              "provider_kind",
              "queue_status",
              "job_counts",
              "policy_flags",
            ]),
            jobCounts: { total: 1, queued: 0, active: 0, failed: 1, terminal: 1 },
          }),
        }),
      ]),
      evidencePacket: expect.objectContaining({
        packet: "document_processing_boundary",
        status: "disabled",
        reason: "provider_disabled",
        metadataOnly: true,
        internalExtractedTextStored: true,
        rawPrivateTextStored: false,
        rawPrivateTextStoredInMetadata: false,
        rawOcrTextStored: false,
        rawOcrTextStoredInMetadata: false,
        rawOcrTextReturned: false,
        providerPayloadsStored: false,
        providerPayloadsReturned: false,
        realProviderActivation: false,
        providerReadinessCounts: {
          ready: 0,
          disabled: 1,
          reserved: 3,
          actionable: 1,
        },
        jobCounts: { total: 1, queued: 0, active: 0, failed: 1, terminal: 1 },
      }),
      summary: {
        total: 1,
        failed: 1,
        terminal: 1,
      },
      jobs: [
        expect.objectContaining({
          id: "job-ocr-dead",
          queueName: "ocr",
          status: "dead_letter",
          failed: true,
          terminal: true,
          retryable: false,
          metadata: {
            matterId: "matter-001",
            documentId: "doc-001",
            task: "ocr",
            providerConfigured: false,
          },
        }),
      ],
    });
    expect(response.json().jobs[0].metadata).not.toHaveProperty("content");
    expect(response.json().jobs[0].metadata).not.toHaveProperty("storageKey");
    expect(JSON.stringify(response.json())).not.toContain("synthetic-disabled-config");
  });

  it("queues OCR jobs with durable redacted lifecycle metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableOcrProvider(repository);
    const { queue, jobs } = fakeOcrQueue();
    const response = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });

    expect(response.statusCode).toBe(202);
    const payload = response.json();
    expect(payload).toMatchObject({
      status: "queued",
      task: "ocr",
      language: "eng",
      documentId: "doc-001",
      job: {
        queueName: "ocr",
        jobName: "extract_document_text",
        status: "queued",
        targetResourceType: "document",
        targetResourceId: "doc-001",
        language: "eng",
        bullJobId: expect.any(String),
      },
    });
    expect(payload).not.toHaveProperty("document");
    expect(jobs).toEqual([
      {
        name: "extract_document_text",
        data: expect.objectContaining({
          firmId,
          resourceType: "document",
          resourceId: "doc-001",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            documentId: "doc-001",
            jobId: payload.job.id,
            task: "ocr",
            language: "eng",
            checksumStatus: "verified",
            scanStatus: "passed",
          }),
        }),
        jobId: payload.job.id,
      },
    ]);
    await expect(repository.listJobLifecycleRecords(firmId, { queueName: "ocr" })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: payload.job.id,
          status: "queued",
          bullJobId: payload.job.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            documentId: "doc-001",
            task: "ocr",
            language: "eng",
            checksumStatus: "verified",
            scanStatus: "passed",
          }),
        }),
      ]),
    );
    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "document_processing.ocr.queued",
          resourceId: "doc-001",
          metadata: expect.objectContaining({
            requestId: expect.any(String),
            actorType: "owner_admin",
            actorId: "user-owner_admin",
            matterId: "matter-001",
            matterIds: ["matter-001"],
            workflowStatus: "queued",
            beforeStatus: "passed",
            expectedStatus: "queued",
            afterStatus: "queued",
            attemptNumber: 0,
            maxAttempts: 3,
            idempotencyKeyPresent: true,
          }),
        }),
      ]),
    );
    const queueMetadata = jobs[0]?.data as { metadata?: Record<string, unknown> };
    const auditMetadata = audit.events.find(
      (event) => event.action === "document_processing.ocr.queued",
    )?.metadata;
    for (const metadata of [queueMetadata.metadata, auditMetadata]) {
      expect(metadata).toBeDefined();
      expect(metadata).not.toHaveProperty("storageKey");
      expect(metadata).not.toHaveProperty("checksumSha256");
      expect(metadata).not.toHaveProperty("content");
    }
    expect(auditMetadata).not.toHaveProperty("documentId");
    expect(auditMetadata).not.toHaveProperty("jobId");
    expect(auditMetadata).not.toHaveProperty("bullJobId");
    expect(auditMetadata).not.toHaveProperty("task");
    expect(auditMetadata).not.toHaveProperty("language");
    expect(auditMetadata).not.toHaveProperty("checksumStatus");
    expect(auditMetadata).not.toHaveProperty("scanStatus");
  });

  it("queues metadata-only document conversion review jobs from completed OCR extraction", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue, jobs } = fakeOcrQueue();
    await repository.createDocumentUploadIntent({
      id: "doc-conversion-review",
      firmId,
      matterId: "matter-001",
      title: "Synthetic conversion review evidence.pdf",
      storageKey: "matters/matter-001/conversion-review-evidence.pdf",
      checksumSha256: "8".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-conversion-review",
      checksumSha256: "8".repeat(64),
      scanStatus: "passed",
    });
    await repository.createDocumentTextExtraction({
      id: "extraction-conversion-review-doc",
      firmId,
      documentId: "doc-conversion-review",
      engine: "tesseract",
      status: "completed",
      language: "eng",
      confidence: 0.91,
      extractedText: "Synthetic OCR text for conversion review.\nSecond line.",
      metadata: {
        textLength: 54,
        providerPayload: { private: true },
        rawMarkdown: "# must not survive",
      },
      createdAt: "2026-06-16T12:00:00.000Z",
      completedAt: "2026-06-16T12:01:00.000Z",
    });

    const response = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-conversion-review/conversion-review/jobs",
      payload: { idempotencyKey: "synthetic-conversion-review-doc" },
    });
    const workbench = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });

    expect(response.statusCode).toBe(202);
    const payload = response.json();
    expect(payload).toMatchObject({
      status: "queued",
      task: "document_conversion_review",
      documentId: "doc-conversion-review",
      job: {
        queueName: "ocr",
        jobName: "document_conversion_review",
        status: "queued",
        targetResourceType: "document",
        targetResourceId: "doc-conversion-review",
        idempotencyKeyPresent: true,
      },
      conversionReview: {
        posture: "queued",
        summaryPosture: "op_authored_metadata_only",
        provider: "local-document-conversion-metadata",
        providerStatus: "metadata_only",
        jobId: expect.any(String),
        counts: { sourceTextLength: 54 },
        policy: expect.objectContaining({
          metadataOnly: true,
          reviewOnly: true,
          rawOcrTextStored: false,
          internalExtractedTextStored: true,
          rawOcrTextStoredInMetadata: false,
          rawOcrTextReturned: false,
          rawMarkdownStored: false,
          annotationBodiesStored: false,
          chunksStored: false,
          embeddingsStored: false,
          providerPayloadsStored: false,
        }),
      },
    });
    expect(payload).not.toHaveProperty("document");
    expect(jobs).toEqual([
      {
        name: "document_conversion_review",
        data: expect.objectContaining({
          firmId,
          resourceType: "document",
          resourceId: "doc-conversion-review",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            documentId: "doc-conversion-review",
            extractionId: "extraction-conversion-review-doc",
            jobId: payload.job.id,
            requestedByUserId: "user-owner_admin",
            provider: "local-document-conversion-metadata",
            providerStatus: "metadata_only",
            summaryPosture: "op_authored_metadata_only",
            idempotencyKeyPresent: true,
          }),
        }),
        jobId: payload.job.id,
      },
    ]);
    await expect(repository.listJobLifecycleRecords(firmId, { queueName: "ocr" })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: payload.job.id,
          jobName: "document_conversion_review",
          status: "queued",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            documentId: "doc-conversion-review",
            task: "document_conversion_review",
            extractionId: "extraction-conversion-review-doc",
            provider: "local-document-conversion-metadata",
            providerStatus: "metadata_only",
            sourceTextLength: 54,
            summaryPosture: "op_authored_metadata_only",
            requestedByUserId: "user-owner_admin",
          }),
        }),
      ]),
    );
    expect(JSON.stringify(jobs[0]?.data)).not.toContain("Synthetic OCR text");
    expect(JSON.stringify(jobs[0]?.data)).not.toContain("rawMarkdown");
    expect(JSON.stringify(jobs[0]?.data)).not.toContain("providerPayload");
    expect(JSON.stringify(payload)).not.toContain("Synthetic OCR text");
    expect(JSON.stringify(payload)).not.toContain("# must not survive");
    expect(JSON.stringify(payload)).not.toContain('"private":true');
    expect(workbench.json().documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          document: expect.objectContaining({ id: "doc-conversion-review" }),
          conversionReview: expect.objectContaining({
            posture: "queued",
            summaryPosture: "op_authored_metadata_only",
            provider: "local-document-conversion-metadata",
            providerStatus: "metadata_only",
            jobId: payload.job.id,
            counts: { sourceTextLength: 54 },
          }),
        }),
      ]),
    );
    const audit = await repository.listAuditEvents(firmId);
    const conversionAudit = audit.events.find(
      (event) => event.action === "document_processing.conversion_review.queued",
    );
    expect(conversionAudit).toMatchObject({
      resourceType: "document",
      resourceId: "doc-conversion-review",
      metadata: expect.objectContaining({
        matterId: "matter-001",
        documentId: "doc-conversion-review",
        extractionId: "extraction-conversion-review-doc",
        provider: "local-document-conversion-metadata",
        providerStatus: "metadata_only",
        sourceTextLength: 54,
        summaryPosture: "op_authored_metadata_only",
        workflowStatus: "queued",
      }),
    });
    expect(JSON.stringify(conversionAudit?.metadata)).not.toContain("Synthetic OCR text");
  });

  it("returns completed document conversion review posture from existing artifacts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createDocumentTextExtraction({
      id: "extraction-conversion-review-completed",
      firmId,
      documentId: "doc-001",
      engine: "tesseract",
      status: "completed",
      language: "eng",
      extractedText: "Synthetic completed OCR text stays private.",
      metadata: {},
      createdAt: "2026-06-16T12:00:00.000Z",
      completedAt: "2026-06-16T12:01:00.000Z",
    });
    await repository.createLegalResearchArtifact({
      id: "artifact-conversion-review-doc-001",
      firmId,
      matterId: "matter-001",
      kind: "document_analysis_status",
      status: "ready_for_review",
      title: "Document conversion review posture",
      sourceReferences: [],
      contextLinks: [{ resourceType: "document", resourceId: "doc-001", label: "Source document" }],
      documentAnalysis: {
        documentId: "doc-001",
        status: "ready_for_review",
        extractionStatus: "completed",
        artifactStatus: "metadata_only",
        sourceTextLength: 42,
      },
      createdByUserId: "user-owner_admin",
      createdAt: "2026-06-16T12:02:00.000Z",
      updatedAt: "2026-06-16T12:02:00.000Z",
      reviewOnly: true,
      metadata: {
        jobId: "job-conversion-review-completed",
        provider: "local-document-conversion-metadata",
        providerStatus: "metadata_only",
        counts: { sourceTextLength: 42, wordCount: 5, lineCount: 1 },
        rawMarkdown: "# must not survive",
        providerPayload: { private: true },
        annotationSpans: [{ start: 0, end: 12, body: "Synthetic span" }],
        prompt: "Synthetic prompt",
        chunks: ["Synthetic chunk"],
        embeddings: [[0.1, 0.2]],
        storageKey: "matters/matter-001/private-conversion.md",
        objectBody: "Synthetic object body",
        privateExcerpt: "Synthetic private excerpt",
        generatedSummary: "Synthetic generated summary",
      },
    });

    const response = await testServer({ repository, ocrJobQueue: undefined }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/conversion-review/jobs",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "completed",
      task: "document_conversion_review",
      documentId: "doc-001",
      conversionReview: {
        posture: "ready_for_review",
        summaryPosture: "op_authored_metadata_only",
        provider: "local-document-conversion-metadata",
        providerStatus: "metadata_only",
        jobId: "job-conversion-review-completed",
        artifactId: "artifact-conversion-review-doc-001",
        counts: { sourceTextLength: 42, wordCount: 5, lineCount: 1 },
        reviewReadiness: {
          status: "ready_for_review",
          artifactStatus: "metadata_only",
          staffReviewRequired: true,
          terminalReview: false,
          reviewOnly: true,
          metadataOnly: true,
          downstreamMutation: false,
          providerEvidenceStored: false,
          rawOcrTextReturned: false,
        },
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("Synthetic completed OCR text");
    expect(JSON.stringify(response.json())).not.toContain("# must not survive");
    expect(JSON.stringify(response.json())).not.toContain('"private":true');
    expect(JSON.stringify(response.json())).not.toContain("annotationSpans");
    expect(JSON.stringify(response.json())).not.toContain("Synthetic prompt");
    expect(JSON.stringify(response.json())).not.toContain("Synthetic chunk");
    expect(JSON.stringify(response.json())).not.toContain("Synthetic object body");
    expect(JSON.stringify(response.json())).not.toContain("Synthetic private excerpt");
    expect(JSON.stringify(response.json())).not.toContain("Synthetic generated summary");
  });

  it.each([
    { decision: "reviewed", reviewedAt: "2026-06-16T13:00:00.000Z" },
    { decision: "rejected", reviewedAt: "2026-06-16T13:05:00.000Z" },
  ] as const)(
    "returns metadata-only document conversion review readiness for $decision artifacts",
    async ({ decision, reviewedAt }) => {
      const repository = new InMemoryOpenPracticeRepository();
      await repository.createLegalResearchArtifact({
        id: `artifact-conversion-review-doc-001-${decision}`,
        firmId,
        matterId: "matter-001",
        kind: "document_analysis_status",
        status: decision,
        title: "Document conversion review posture",
        sourceReferences: [],
        contextLinks: [
          { resourceType: "document", resourceId: "doc-001", label: "Source document" },
        ],
        documentAnalysis: {
          documentId: "doc-001",
          status: "ready_for_review",
          extractionStatus: "completed",
          artifactStatus: "metadata_only",
          sourceTextLength: 47,
        },
        reviewDecision: decision,
        reviewedByUserId: "user-owner_admin",
        reviewedAt,
        createdByUserId: "user-owner_admin",
        createdAt: "2026-06-16T12:02:00.000Z",
        updatedAt: reviewedAt,
        reviewOnly: true,
        metadata: {
          jobId: `job-conversion-review-${decision}`,
          provider: "local-document-conversion-metadata",
          providerStatus: "metadata_only",
          counts: { sourceTextLength: 47, wordCount: 6, lineCount: 2 },
          rawOcrText: "Synthetic reviewed OCR text must stay private.",
          rawMarkdown: "# must not survive",
          providerEvidence: { private: "Synthetic provider evidence" },
          providerPayload: { private: true },
          annotationSpans: [{ start: 0, end: 12, body: "Synthetic span" }],
          prompt: "Synthetic prompt",
          chunks: ["Synthetic chunk"],
          embeddings: [[0.1, 0.2]],
          storageKey: "matters/matter-001/private-conversion.md",
          objectBody: "Synthetic object body",
          privateExcerpt: "Synthetic private excerpt",
          generatedSummary: "Synthetic generated summary",
        },
      });

      const response = await testServer({ repository, ocrJobQueue: undefined }).inject({
        method: "GET",
        url: "/api/document-processing/workbench?matterId=matter-001",
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      const entry = payload.documents.find(
        (item: { document: { id: string } }) => item.document.id === "doc-001",
      );
      expect(entry).toMatchObject({
        conversionReview: {
          summaryPosture: "op_authored_metadata_only",
          provider: "local-document-conversion-metadata",
          providerStatus: "metadata_only",
          artifactId: `artifact-conversion-review-doc-001-${decision}`,
          counts: { sourceTextLength: 47, wordCount: 6, lineCount: 2 },
          reviewReadiness: {
            status: decision,
            artifactStatus: "metadata_only",
            reviewedAt,
            staffReviewRequired: true,
            terminalReview: true,
            reviewOnly: true,
            metadataOnly: true,
            downstreamMutation: false,
            providerEvidenceStored: false,
            rawOcrTextReturned: false,
          },
        },
      });
      expect(JSON.stringify(entry?.conversionReview)).not.toContain(
        "Synthetic reviewed OCR text must stay private.",
      );
      expect(JSON.stringify(entry?.conversionReview)).not.toContain("# must not survive");
      expect(JSON.stringify(entry?.conversionReview)).not.toContain('"providerEvidence":');
      expect(JSON.stringify(entry?.conversionReview)).not.toContain("Synthetic provider evidence");
      expect(JSON.stringify(entry?.conversionReview)).not.toContain('"private":true');
      expect(JSON.stringify(entry?.conversionReview)).not.toContain("Synthetic span");
      expect(JSON.stringify(entry?.conversionReview)).not.toContain("Synthetic prompt");
      expect(JSON.stringify(entry?.conversionReview)).not.toContain("Synthetic chunk");
      expect(JSON.stringify(entry?.conversionReview)).not.toContain("Synthetic object body");
      expect(JSON.stringify(entry?.conversionReview)).not.toContain("Synthetic private excerpt");
      expect(JSON.stringify(entry?.conversionReview)).not.toContain("Synthetic generated summary");
    },
  );

  it.each(["reviewed", "rejected"] as const)(
    "records metadata-only document conversion review %s decisions",
    async (decision) => {
      const repository = new InMemoryOpenPracticeRepository();
      await createConversionReviewArtifact(repository, {
        id: `artifact-conversion-review-decision-${decision}`,
      });
      const before = await conversionReviewMutationSnapshot(repository);

      const response = await testServer({ repository, ocrJobQueue: undefined }).inject({
        method: "PATCH",
        url: "/api/document-processing/documents/doc-001/conversion-review/review",
        payload: { decision },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toMatchObject({
        status: "completed",
        task: "document_conversion_review",
        documentId: "doc-001",
        conversionReview: {
          posture: decision,
          summaryPosture: "op_authored_metadata_only",
          artifactId: `artifact-conversion-review-decision-${decision}`,
          provider: "local-document-conversion-metadata",
          providerStatus: "metadata_only",
          counts: { sourceTextLength: 47, wordCount: 6, lineCount: 2, nonEmptyLineCount: 2 },
          reviewReadiness: {
            status: decision,
            artifactStatus: "metadata_only",
            reviewedAt: expect.any(String),
            staffReviewRequired: true,
            terminalReview: true,
            reviewOnly: true,
            metadataOnly: true,
            downstreamMutation: false,
            providerEvidenceStored: false,
            rawOcrTextReturned: false,
          },
          latestDecision: {
            artifactId: `artifact-conversion-review-decision-${decision}`,
            decision,
            decidedAt: expect.any(String),
            decidedByUserId: "user-owner_admin",
            artifactStatus: "metadata_only",
            reviewOnly: true,
            metadataOnly: true,
            terminalReview: true,
            downstreamMutation: false,
            providerEvidenceStored: false,
            rawOcrTextReturned: false,
          },
          decisionHistory: [
            {
              artifactId: `artifact-conversion-review-decision-${decision}`,
              decision,
              decidedAt: expect.any(String),
              decidedByUserId: "user-owner_admin",
              artifactStatus: "metadata_only",
              reviewOnly: true,
              metadataOnly: true,
              terminalReview: true,
              downstreamMutation: false,
              providerEvidenceStored: false,
              rawOcrTextReturned: false,
            },
          ],
        },
      });
      expect(payload).not.toHaveProperty("artifact");
      const responseJson = JSON.stringify(payload);
      for (const fragment of unsafeConversionReviewFragments) {
        expect(responseJson).not.toContain(fragment);
      }
      expect(responseJson).not.toContain('"providerEvidence":');
      expect(responseJson).not.toContain('"providerPayload":');
      expect(responseJson).not.toContain('"providerPayloads":');
      expect(responseJson).not.toContain('"annotationSpans":');
      expect(responseJson).not.toContain('"annotations":');
      expect(responseJson).not.toContain('"chunks":');
      expect(responseJson).not.toContain('"embeddings":');
      expect(responseJson).not.toContain('"storageKey":');
      expect(responseJson).not.toContain('"objectKey":');
      expect(responseJson).not.toContain('"objectBody":');

      const [artifact] = await repository.listLegalResearchArtifacts(firmId, {
        matterId: "matter-001",
        kind: "document_analysis_status",
      });
      expect(artifact).toMatchObject({
        id: `artifact-conversion-review-decision-${decision}`,
        status: decision,
        reviewDecision: decision,
        reviewedByUserId: "user-owner_admin",
        reviewedAt: expect.any(String),
        reviewOnly: true,
        metadata: expect.objectContaining({
          source: "document_conversion_review",
          jobId: "job-conversion-review-decision",
          extractionId: "extraction-conversion-review-decision",
          provider: "local-document-conversion-metadata",
          providerStatus: "metadata_only",
          metadataOnly: true,
          reviewOnly: true,
          reviewState: decision,
          artifactStatus: "metadata_only",
          staffReviewRequired: true,
          terminalReview: true,
          downstreamMutation: false,
          providerEvidenceStored: false,
          rawOcrTextReturned: false,
          conversionReviewPosture: "ready_for_review",
          summaryPosture: "op_authored_metadata_only",
        }),
      });
      expect(artifact?.metadata.counts).toEqual({
        sourceTextLength: 47,
        wordCount: 6,
        lineCount: 2,
        nonEmptyLineCount: 2,
      });
      expect(artifact?.metadata.policy).toMatchObject({
        metadataOnly: true,
        reviewOnly: true,
        rawOcrTextReturned: false,
        providerPayloadsStored: false,
      });
      for (const key of [
        "rawOcrText",
        "rawMarkdown",
        "convertedMarkdown",
        "providerEvidence",
        "providerPayload",
        "providerPayloads",
        "annotationSpans",
        "annotations",
        "prompt",
        "chunks",
        "embeddings",
        "storageKey",
        "objectKey",
        "objectBody",
        "privateExcerpt",
        "generatedSummary",
      ]) {
        expect(artifact?.metadata).not.toHaveProperty(key);
      }

      const audit = await repository.listAuditEvents(firmId);
      const reviewAudit = audit.events.find(
        (event) => event.action === "legal_research.artifact.reviewed",
      );
      expect(reviewAudit).toMatchObject({
        resourceType: "legal_research",
        resourceId: `artifact-conversion-review-decision-${decision}`,
        metadata: expect.objectContaining({
          matterId: "matter-001",
          artifactKind: "document_analysis_status",
          status: decision,
          decision,
          documentId: "doc-001",
          sourceTextLength: 47,
          reviewedByUserId: "user-owner_admin",
          reviewOnly: true,
        }),
      });
      const auditJson = JSON.stringify(reviewAudit?.metadata);
      for (const fragment of unsafeConversionReviewFragments) {
        expect(auditJson).not.toContain(fragment);
      }

      await expect(conversionReviewMutationSnapshot(repository)).resolves.toBe(before);
    },
  );

  it("returns the same terminal conversion review decision without rewriting", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createConversionReviewArtifact(repository, {
      status: "reviewed",
      reviewedAt: "2026-06-27T13:10:00.000Z",
      updatedAt: "2026-06-27T13:10:00.000Z",
      unsafeMetadata: false,
    });

    const response = await testServer({ repository, ocrJobQueue: undefined }).inject({
      method: "PATCH",
      url: "/api/document-processing/documents/doc-001/conversion-review/review",
      payload: { decision: "reviewed" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "completed",
      task: "document_conversion_review",
      documentId: "doc-001",
      conversionReview: {
        posture: "reviewed",
        reviewReadiness: {
          status: "reviewed",
          reviewedAt: "2026-06-27T13:10:00.000Z",
          terminalReview: true,
          downstreamMutation: false,
        },
      },
    });
    const [artifact] = await repository.listLegalResearchArtifacts(firmId, {
      matterId: "matter-001",
      kind: "document_analysis_status",
    });
    expect(artifact?.reviewedAt).toBe("2026-06-27T13:10:00.000Z");
    expect(artifact?.updatedAt).toBe("2026-06-27T13:10:00.000Z");
    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events.some((event) => event.action === "legal_research.artifact.reviewed")).toBe(
      false,
    );
  });

  it("returns ordered metadata-only conversion review decision history in the workbench", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createConversionReviewArtifact(repository, {
      id: "artifact-conversion-review-history-old",
      status: "reviewed",
      reviewedAt: "2026-06-27T13:00:00.000Z",
      updatedAt: "2026-06-27T13:00:00.000Z",
    });
    await createConversionReviewArtifact(repository, {
      id: "artifact-conversion-review-history-new",
      status: "rejected",
      reviewedAt: "2026-06-27T14:00:00.000Z",
      updatedAt: "2026-06-27T14:00:00.000Z",
    });

    const response = await testServer({ repository, ocrJobQueue: undefined }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    const [entry] = response
      .json()
      .documents.filter((item: { document: { id: string } }) => item.document.id === "doc-001");
    expect(entry.conversionReview).toMatchObject({
      posture: "rejected",
      latestDecision: {
        artifactId: "artifact-conversion-review-history-new",
        decision: "rejected",
        decidedAt: "2026-06-27T14:00:00.000Z",
        decidedByUserId: "user-owner_admin",
        artifactStatus: "metadata_only",
        reviewOnly: true,
        metadataOnly: true,
        terminalReview: true,
        downstreamMutation: false,
        providerEvidenceStored: false,
        rawOcrTextReturned: false,
      },
      decisionHistory: [
        {
          artifactId: "artifact-conversion-review-history-new",
          decision: "rejected",
          decidedAt: "2026-06-27T14:00:00.000Z",
        },
        {
          artifactId: "artifact-conversion-review-history-old",
          decision: "reviewed",
          decidedAt: "2026-06-27T13:00:00.000Z",
        },
      ],
    });
    const responseJson = JSON.stringify(entry.conversionReview);
    for (const fragment of unsafeConversionReviewFragments) {
      expect(responseJson).not.toContain(fragment);
    }
    expect(responseJson).not.toContain('"providerPayload":');
    expect(responseJson).not.toContain('"storageKey":');
    expect(responseJson).not.toContain('"generatedSummary":');
  });

  it("rejects opposite terminal conversion review decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createConversionReviewArtifact(repository, {
      status: "reviewed",
      reviewedAt: "2026-06-27T13:20:00.000Z",
      updatedAt: "2026-06-27T13:20:00.000Z",
    });

    const response = await testServer({ repository, ocrJobQueue: undefined }).inject({
      method: "PATCH",
      url: "/api/document-processing/documents/doc-001/conversion-review/review",
      payload: { decision: "rejected" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message: "Document conversion review has already been decided",
    });
    const [artifact] = await repository.listLegalResearchArtifacts(firmId, {
      matterId: "matter-001",
      kind: "document_analysis_status",
    });
    expect(artifact).toMatchObject({
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedAt: "2026-06-27T13:20:00.000Z",
    });
    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events.some((event) => event.action === "legal_research.artifact.reviewed")).toBe(
      false,
    );
  });

  it("rejects conversion review decisions before metadata artifacts are ready", async () => {
    const missingArtifactRepository = new InMemoryOpenPracticeRepository();
    const missingArtifactResponse = await testServer({
      repository: missingArtifactRepository,
      ocrJobQueue: undefined,
    }).inject({
      method: "PATCH",
      url: "/api/document-processing/documents/doc-001/conversion-review/review",
      payload: { decision: "reviewed" },
    });
    expect(missingArtifactResponse.statusCode).toBe(409);
    expect(missingArtifactResponse.json()).toMatchObject({
      message: "Document conversion review artifact is not ready for review",
    });

    const draftArtifactRepository = new InMemoryOpenPracticeRepository();
    await createConversionReviewArtifact(draftArtifactRepository, { status: "draft" });
    const draftResponse = await testServer({
      repository: draftArtifactRepository,
      ocrJobQueue: undefined,
    }).inject({
      method: "PATCH",
      url: "/api/document-processing/documents/doc-001/conversion-review/review",
      payload: { decision: "reviewed" },
    });
    expect(draftResponse.statusCode).toBe(409);
    expect(draftResponse.json()).toMatchObject({
      message: "Document conversion review artifact is not ready for review",
    });

    const queuedRepository = new InMemoryOpenPracticeRepository();
    await createConversionReviewArtifact(queuedRepository);
    await queuedRepository.createJobLifecycleRecord({
      id: "job-conversion-review-queued",
      firmId,
      queueName: "ocr",
      jobName: "document_conversion_review",
      status: "queued",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: "2026-06-27T13:25:00.000Z",
      metadata: {
        matterId: "matter-001",
        documentId: "doc-001",
        provider: "local-document-conversion-metadata",
        providerStatus: "metadata_only",
        sourceTextLength: 47,
      },
    });
    const queuedResponse = await testServer({
      repository: queuedRepository,
      ocrJobQueue: undefined,
    }).inject({
      method: "PATCH",
      url: "/api/document-processing/documents/doc-001/conversion-review/review",
      payload: { decision: "reviewed" },
    });
    expect(queuedResponse.statusCode).toBe(409);
    expect(queuedResponse.json()).toMatchObject({
      message: "Document conversion review is not ready for a review decision",
    });

    const missingDocumentRepository = new InMemoryOpenPracticeRepository();
    const missingDocumentResponse = await testServer({
      repository: missingDocumentRepository,
      ocrJobQueue: undefined,
    }).inject({
      method: "PATCH",
      url: "/api/document-processing/documents/doc-missing/conversion-review/review",
      payload: { decision: "reviewed" },
    });
    expect(missingDocumentResponse.statusCode).toBe(404);
  });

  it("enforces matter scope and legal research approval for conversion review decisions", async () => {
    const crossMatterRepository = new InMemoryOpenPracticeRepository();
    await createConversionReviewArtifact(crossMatterRepository);
    const crossMatter = await testServer({
      repository: crossMatterRepository,
      authUser: user("firm_member", ["matter-002"]),
      ocrJobQueue: undefined,
    }).inject({
      method: "PATCH",
      url: "/api/document-processing/documents/doc-001/conversion-review/review",
      payload: { decision: "reviewed" },
    });
    expect(crossMatter.statusCode).toBe(403);

    const auditorRepository = new InMemoryOpenPracticeRepository();
    await createConversionReviewArtifact(auditorRepository);
    const auditor = await testServer({
      repository: auditorRepository,
      authUser: user("auditor", ["matter-001"]),
      ocrJobQueue: undefined,
    }).inject({
      method: "PATCH",
      url: "/api/document-processing/documents/doc-001/conversion-review/review",
      payload: { decision: "reviewed" },
    });
    expect(auditor.statusCode).toBe(403);
    const [artifact] = await auditorRepository.listLegalResearchArtifacts(firmId, {
      matterId: "matter-001",
      kind: "document_analysis_status",
    });
    expect(artifact?.status).toBe("ready_for_review");
  });

  it("returns a matter-scoped sanitized document processing workbench", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-ocr-enabled",
      firmId,
      kind: "ocr",
      key: "local-cli-ocr",
      enabled: true,
      encryptedConfig: "synthetic-config-not-returned",
      createdAt: "2026-05-02T12:00:00.000Z",
      updatedAt: "2026-05-02T12:00:00.000Z",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-matter-002",
      firmId,
      matterId: "matter-002",
      title: "Other matter record.pdf",
      storageKey: "matters/matter-002/other.pdf",
      checksumSha256: "e".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-matter-002",
      checksumSha256: "e".repeat(64),
      scanStatus: "passed",
    });
    await repository.createJobLifecycleRecord({
      id: "job-doc-001-active",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      bullJobId: "bull-doc-001",
      status: "active",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 1,
      maxAttempts: 3,
      queuedAt: "2026-05-02T12:10:00.000Z",
      startedAt: "2026-05-02T12:10:05.000Z",
      metadata: {
        matterId: "matter-001",
        documentId: "doc-001",
        task: "ocr",
        language: "eng",
        storageKey: "matters/matter-001/private.pdf",
        providerPayload: { private: true },
      },
    });
    await repository.createJobLifecycleRecord({
      id: "job-other-matter",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "queued",
      targetResourceType: "document",
      targetResourceId: "doc-matter-002",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: "2026-05-02T12:15:00.000Z",
      metadata: { matterId: "matter-002", documentId: "doc-matter-002", task: "ocr" },
    });
    await repository.createDocumentTextExtraction({
      id: "extraction-doc-001",
      firmId,
      documentId: "doc-001",
      engine: "tesseract",
      status: "completed",
      language: "eng",
      confidence: 0.93,
      textStorageKey: "matters/matter-001/doc-001.txt",
      extractedText: "Synthetic private extracted text that must not leave the server.",
      metadata: {
        language: "eng",
        textLength: 243,
        suggestedClassification: "financial",
        classificationConfidence: 0.88,
        storageKey: "matters/matter-001/doc-001.txt",
        token: "private-token",
        providerPayload: { private: true },
      },
      createdAt: "2026-05-02T12:11:00.000Z",
      completedAt: "2026-05-02T12:12:00.000Z",
    });
    await repository.createDocumentTextExtraction({
      id: "extraction-other-matter",
      firmId,
      documentId: "doc-matter-002",
      engine: "tesseract",
      status: "completed",
      language: "eng",
      confidence: 0.98,
      textStorageKey: "matters/matter-002/doc-matter-002.txt",
      extractedText: "Synthetic other-matter OCR text must stay out of matter 001 workbench.",
      metadata: {
        language: "eng",
        textLength: 512,
        suggestedClassification: "financial",
        storageKey: "matters/matter-002/doc-matter-002.txt",
        providerPayload: { private: true },
      },
      createdAt: "2026-05-02T12:16:00.000Z",
      completedAt: "2026-05-02T12:17:00.000Z",
    });

    const response = await testServer({ repository, ocrJobQueue: fakeOcrQueue().queue }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      matterId: "matter-001",
      status: "configured",
      providerStatus: expect.arrayContaining([
        expect.objectContaining({
          kind: "ocr",
          status: "configured",
          providers: [
            {
              key: "local-cli-ocr",
              enabled: true,
              updatedAt: "2026-05-02T12:00:00.000Z",
            },
          ],
        }),
      ]),
      providerReadiness: expect.arrayContaining([
        expect.objectContaining({
          kind: "ocr",
          task: "ocr",
          queueName: "ocr",
          status: "ready",
          actionable: true,
          providerStatus: "configured",
          queueStatus: "configured",
          providerCount: 1,
          enabledProviderCount: 1,
          storageRequired: true,
          storageConfigured: true,
          evidencePacket: expect.objectContaining({
            packet: "document_processing_provider_readiness",
            posture: "op_authored_metadata_only",
            metadataOnly: true,
            internalExtractedTextStored: true,
            rawPrivateTextStored: false,
            rawPrivateTextStoredInMetadata: false,
            rawOcrTextStored: false,
            rawOcrTextStoredInMetadata: false,
            rawOcrTextReturned: false,
            providerPayloadsStored: false,
            providerPayloadsReturned: false,
            realProviderActivation: false,
            jobCounts: { total: 1, queued: 0, active: 1, failed: 0, terminal: 0 },
          }),
        }),
        expect.objectContaining({
          kind: "ai",
          task: "classification",
          status: "reserved",
          reason: "deferred_worker",
          actionable: false,
        }),
        expect.objectContaining({
          kind: "transcription",
          task: "transcription",
          status: "reserved",
          reason: "deferred_worker",
          actionable: false,
        }),
      ]),
      evidencePacket: expect.objectContaining({
        packet: "document_processing_boundary",
        posture: "op_authored_metadata_only",
        status: "configured",
        metadataOnly: true,
        internalExtractedTextStored: true,
        rawPrivateTextStored: false,
        rawPrivateTextStoredInMetadata: false,
        rawOcrTextStored: false,
        rawOcrTextStoredInMetadata: false,
        rawOcrTextReturned: false,
        providerPayloadsStored: false,
        providerPayloadsReturned: false,
        realProviderActivation: false,
        providerReadinessCounts: {
          ready: 1,
          disabled: 0,
          reserved: 3,
          actionable: 1,
        },
        jobCounts: { total: 1, queued: 0, active: 1, failed: 0, terminal: 0 },
      }),
      workerQueues: expect.arrayContaining([{ queueName: "ocr", status: "configured" }]),
      reservedQueues: expect.arrayContaining([
        expect.objectContaining({ queueName: "ai_triage", status: "reserved" }),
        expect.objectContaining({ queueName: "transcription", status: "reserved" }),
        expect.objectContaining({ queueName: "media", status: "reserved" }),
      ]),
      actionableTasks: ["ocr"],
      reservedTasks: expect.arrayContaining([
        expect.objectContaining({ task: "classification", queueName: "ai_triage" }),
        expect.objectContaining({ task: "transcription", queueName: "transcription" }),
        expect.objectContaining({ task: "media", queueName: "media" }),
      ]),
      summary: {
        total: 1,
        active: 1,
      },
      reviewQueue: {
        needsReviewCount: 0,
        duplicateCandidateCount: 0,
        supersessionCount: 0,
        failedScanCount: 0,
      },
      documents: [
        expect.objectContaining({
          group: "queued_or_active",
          queueEligibility: { eligible: false, reason: "already_queued_or_active" },
          document: {
            id: "doc-001",
            matterId: "matter-001",
            title: "BC tenancy retainer and review plan.pdf",
            version: 1,
            classification: "privileged",
            legalHold: true,
            uploadStatus: "verified",
            checksumStatus: "verified",
            scanStatus: "passed",
            reviewStatus: "not_required",
            uploadedAt: "2026-04-01T20:15:00.000Z",
            verifiedAt: "2026-04-01T20:16:00.000Z",
          },
          latestJob: expect.objectContaining({
            id: "job-doc-001-active",
            status: "active",
            terminal: false,
            retryable: false,
            metadata: {
              matterId: "matter-001",
              documentId: "doc-001",
              task: "ocr",
              language: "eng",
            },
          }),
          latestExtraction: {
            id: "extraction-doc-001",
            engine: "tesseract",
            status: "completed",
            language: "eng",
            confidence: 0.93,
            createdAt: "2026-05-02T12:11:00.000Z",
            completedAt: "2026-05-02T12:12:00.000Z",
            metadata: {
              language: "eng",
              textLength: 243,
            },
          },
          reviewSuggestions: {
            reviewerOnly: true,
            mutating: false,
            summaryCounts: {
              classification: 1,
              duplicate_or_supersession: 0,
              matter_contact: 3,
              missing_metadata: 0,
              retention_review: 1,
              total: 5,
            },
            groups: expect.objectContaining({
              classification: [
                expect.objectContaining({
                  classification: "financial",
                  confidence: 0.88,
                  metadataKeys: ["suggestedClassification", "classificationConfidence"],
                }),
              ],
              matter_contact: expect.arrayContaining([
                expect.objectContaining({ label: "Matter 2026-0001" }),
                expect.objectContaining({ contactId: "contact-ada", role: "client" }),
              ]),
              retention_review: [
                expect.objectContaining({
                  label: "Legal hold active",
                  tone: "risk",
                }),
              ],
            }),
          },
          retentionHoldReview: {
            reviewerOnly: true,
            mutating: false,
            destructiveAction: false,
            retentionDeadlineEnforced: false,
            legalHoldOverride: false,
            retainedExportBody: false,
            status: "blocked_by_hold",
            blockers: ["legal_hold"],
            sourceCueCounts: expect.objectContaining({ retention_review: 1 }),
          },
        }),
      ],
    });
    const documentItem = response.json().documents[0];
    expect(documentItem.document).not.toHaveProperty("firmId");
    expect(documentItem.document).not.toHaveProperty("storageKey");
    expect(documentItem.document).not.toHaveProperty("checksumSha256");
    expect(documentItem.document).not.toHaveProperty("reviewMetadata");
    expect(documentItem.latestJob.metadata).not.toHaveProperty("storageKey");
    expect(documentItem.latestJob.metadata).not.toHaveProperty("providerPayload");
    expect(documentItem.latestExtraction).not.toHaveProperty("extractedText");
    expect(documentItem.latestExtraction).not.toHaveProperty("textStorageKey");
    expect(documentItem.latestExtraction.metadata).not.toHaveProperty("storageKey");
    expect(documentItem.latestExtraction.metadata).not.toHaveProperty("token");
    expect(documentItem.latestExtraction.metadata).not.toHaveProperty("providerPayload");
    expect(JSON.stringify(documentItem.reviewSuggestions)).not.toContain("private");
    expect(JSON.stringify(documentItem.reviewSuggestions)).not.toContain("storageKey");
    expect(JSON.stringify(documentItem.reviewSuggestions)).not.toContain("providerPayload");
    const serialized = JSON.stringify(response.json());
    expect(serialized).not.toContain("doc-matter-002");
    expect(serialized).not.toContain("job-other-matter");
    expect(serialized).not.toContain("extraction-other-matter");
    expect(serialized).not.toContain("Synthetic other-matter OCR text");
  });

  it("filters metadata search posture with tag cues while redacting raw OCR text", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createDocumentUploadIntent({
      id: "doc-search-unmatched",
      firmId,
      matterId: "matter-001",
      title: "Lease photos.pdf",
      storageKey: "matters/matter-001/lease-photos.pdf",
      checksumSha256: "6".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-search-unmatched",
      checksumSha256: "6".repeat(64),
      scanStatus: "passed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-other-matter-search",
      firmId,
      matterId: "matter-002",
      title: "Other matter financial memo.pdf",
      storageKey: "matters/matter-002/financial-memo.pdf",
      checksumSha256: "7".repeat(64),
      classification: "financial",
      legalHold: true,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-other-matter-search",
      checksumSha256: "7".repeat(64),
      scanStatus: "passed",
    });
    await repository.createDocumentTextExtraction({
      id: "extraction-doc-001-search",
      firmId,
      documentId: "doc-001",
      engine: "tesseract",
      status: "completed",
      language: "eng",
      confidence: 0.84,
      textStorageKey: "matters/matter-001/doc-001-private.txt",
      extractedText: "Hidden raw OCR body needle must not match or render.",
      metadata: {
        suggestedClassification: "financial",
        classificationConfidence: 0.84,
        storageKey: "matters/matter-001/doc-001-private.txt",
        token: "private-token",
        arbitraryPrivateNeedle: "metadata-only-secret",
      },
      createdAt: "2026-05-02T13:00:00.000Z",
      completedAt: "2026-05-02T13:01:00.000Z",
    });
    await repository.createDocumentTextExtraction({
      id: "extraction-other-matter-search",
      firmId,
      documentId: "doc-other-matter-search",
      engine: "tesseract",
      status: "completed",
      language: "eng",
      confidence: 0.99,
      extractedText: "Other matter text must stay out of matter-001 posture.",
      metadata: { suggestedClassification: "financial" },
      createdAt: "2026-05-02T13:00:00.000Z",
      completedAt: "2026-05-02T13:01:00.000Z",
    });

    const filtered = await testServer({ repository, ocrJobQueue: fakeOcrQueue().queue }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001&q=financial&classification=privileged&ocrStatus=completed&cueGroup=classification&tag=cue%3Aclassification",
    });
    const retentionFiltered = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001&cueGroup=retention_review",
    });
    const rawTextSearch = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001&q=Hidden%20raw%20OCR%20body%20needle",
    });
    const privateMetadataSearch = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001&q=metadata-only-secret",
    });

    expect(filtered.statusCode).toBe(200);
    expect(filtered.json()).toMatchObject({
      matterId: "matter-001",
      metadataSearch: {
        reviewOnly: true,
        mutating: false,
        filters: {
          q: "financial",
          classification: "privileged",
          ocrStatus: "completed",
          cueGroup: "classification",
          tag: "cue:classification",
        },
        totalCount: 2,
        matchedCount: 1,
        ocrPosture: {
          rawTextSearch: false,
          rawTextReturned: false,
          statusCounts: {
            completed: 1,
            not_available: 1,
          },
        },
        results: [
          expect.objectContaining({
            documentId: "doc-001",
            title: "BC tenancy retainer and review plan.pdf",
            classification: "privileged",
            ocrStatus: "completed",
            tagKeys: expect.arrayContaining([
              "classification:privileged",
              "ocr:completed",
              "ocr_confidence:medium",
              "cue:classification",
              "cue:retention_review",
            ]),
            matchedFields: expect.arrayContaining([
              "Classification",
              "Metadata tag",
              "OCR status",
              "Reviewer cue",
            ]),
            cueCounts: expect.objectContaining({ classification: 1 }),
          }),
        ],
      },
      documents: expect.arrayContaining([
        expect.objectContaining({
          document: expect.objectContaining({ id: "doc-001" }),
          metadataTags: expect.arrayContaining([
            expect.objectContaining({ key: "classification:privileged" }),
            expect.objectContaining({ key: "ocr:completed" }),
            expect.objectContaining({ key: "cue:classification" }),
          ]),
        }),
      ]),
    });
    expect(retentionFiltered.statusCode).toBe(200);
    expect(retentionFiltered.json().metadataSearch).toMatchObject({
      filters: { cueGroup: "retention_review" },
      totalCount: 2,
      matchedCount: 1,
      results: [
        expect.objectContaining({
          documentId: "doc-001",
          matchedFields: ["Reviewer cue"],
          cueCounts: expect.objectContaining({ retention_review: 1 }),
        }),
      ],
    });
    expect(rawTextSearch.json().metadataSearch).toMatchObject({ totalCount: 2, matchedCount: 0 });
    expect(privateMetadataSearch.json().metadataSearch).toMatchObject({
      totalCount: 2,
      matchedCount: 0,
    });
    expect(JSON.stringify(filtered.json())).not.toContain("Hidden raw OCR body needle");
    expect(JSON.stringify(filtered.json())).not.toContain("metadata-only-secret");
    expect(JSON.stringify(filtered.json())).not.toContain("doc-001-private.txt");
    expect(JSON.stringify(filtered.json())).not.toContain("private-token");
    expect(JSON.stringify(filtered.json())).not.toContain("doc-other-matter-search");
  });

  it("summarizes visible document review queue states without cross-matter counts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createDocumentUploadIntent({
      id: "doc-review-pending",
      firmId,
      matterId: "matter-001",
      title: "External evidence.pdf",
      storageKey: "matters/matter-001/external-evidence.pdf",
      checksumSha256: "1".repeat(64),
      classification: "general",
      legalHold: false,
      externalUploadLinkId: "external-upload-link-001",
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-review-pending",
      checksumSha256: "1".repeat(64),
      scanStatus: "passed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-duplicate-review",
      firmId,
      matterId: "matter-001",
      title: "Duplicate retainer.pdf",
      storageKey: "matters/matter-001/duplicate-retainer.pdf",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-duplicate-review",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
      scanStatus: "passed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-superseded-review",
      firmId,
      matterId: "matter-001",
      title: "Old notice.pdf",
      storageKey: "matters/matter-001/old-notice.pdf",
      checksumSha256: "2".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-superseded-review",
      checksumSha256: "2".repeat(64),
      scanStatus: "passed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-superseding-review",
      firmId,
      matterId: "matter-001",
      title: "Updated notice.pdf",
      storageKey: "matters/matter-001/updated-notice.pdf",
      checksumSha256: "3".repeat(64),
      classification: "general",
      legalHold: false,
      supersedesDocumentId: "doc-superseded-review",
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-superseding-review",
      checksumSha256: "3".repeat(64),
      scanStatus: "passed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-failed-scan-review",
      firmId,
      matterId: "matter-001",
      title: "Failed scan.pdf",
      storageKey: "matters/matter-001/failed-scan.pdf",
      checksumSha256: "4".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-failed-scan-review",
      checksumSha256: "4".repeat(64),
      scanStatus: "failed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-other-matter-review",
      firmId,
      matterId: "matter-002",
      title: "Other matter review.pdf",
      storageKey: "matters/matter-002/review.pdf",
      checksumSha256: "5".repeat(64),
      classification: "general",
      legalHold: false,
      externalUploadLinkId: "external-upload-link-002",
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-other-matter-review",
      checksumSha256: "5".repeat(64),
      scanStatus: "failed",
    });

    const response = await testServer({
      repository,
      authUser: user("licensee", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      reviewQueue: {
        needsReviewCount: 1,
        duplicateCandidateCount: 1,
        supersessionCount: 2,
        failedScanCount: 1,
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("doc-other-matter-review");
  });

  it("applies matter access to the document processing workbench", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const denied = await testServer({
      repository,
      authUser: user("licensee", ["matter-002"]),
    }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });
    expect(denied.statusCode).toBe(403);

    const allowed = await testServer({
      repository,
      authUser: user("licensee", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().documents).toEqual([
      expect.objectContaining({
        document: expect.objectContaining({ id: "doc-001", matterId: "matter-001" }),
      }),
    ]);
  });

  it("returns 503 when the OCR queue is not configured", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ message: "OCR queue is not configured" });
  });

  it("marks a durable OCR job failed when BullMQ enqueue fails", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableOcrProvider(repository);
    const failingQueue: ApiJobQueue = {
      async add() {
        throw new Error("Redis unavailable with private connection details");
      },
    };

    const response = await testServer({ repository, ocrJobQueue: failingQueue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "QUEUE_ENQUEUE_FAILED" });
    const [job] = await repository.listJobLifecycleRecords(firmId, { queueName: "ocr" });
    expect(job).toMatchObject({
      jobName: "extract_document_text",
      status: "failed",
      attemptsMade: 1,
      errorMessage: "Job enqueue failed; retry after the worker queue is available.",
      metadata: expect.objectContaining({
        documentId: "doc-001",
        matterId: "matter-001",
        enqueueStatus: "failed",
      }),
    });
    expect(job.errorMessage).not.toContain("private connection details");
  });

  it("requires an enabled OCR provider before creating durable OCR jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue, jobs } = fakeOcrQueue();
    const notConfigured = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });
    await enableOcrProvider(repository, false);
    const disabled = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });

    expect(notConfigured.statusCode).toBe(503);
    expect(notConfigured.json()).toMatchObject({ message: "OCR provider is not configured" });
    expect(disabled.statusCode).toBe(503);
    expect(disabled.json()).toMatchObject({ message: "OCR provider is disabled" });
    expect(jobs).toEqual([]);
    await expect(repository.listJobLifecycleRecords(firmId, { queueName: "ocr" })).resolves.toEqual(
      [],
    );
  });

  it("requires document storage before accepting OCR jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableOcrProvider(repository);
    const { queue, jobs } = fakeOcrQueue();

    const response = await testServer({ repository, ocrJobQueue: queue, s3: null }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });
    const workbench = await testServer({ repository, ocrJobQueue: queue, s3: null }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ message: "OCR document storage is not configured" });
    expect(jobs).toEqual([]);
    await expect(repository.listJobLifecycleRecords(firmId, { queueName: "ocr" })).resolves.toEqual(
      [],
    );
    expect(workbench.statusCode).toBe(200);
    expect(workbench.json()).toMatchObject({
      status: "disabled",
      reason: "storage_not_configured",
      providerReadiness: expect.arrayContaining([
        expect.objectContaining({
          kind: "ocr",
          status: "disabled",
          reason: "storage_not_configured",
          providerStatus: "configured",
          queueStatus: "configured",
          storageRequired: true,
          storageConfigured: false,
        }),
      ]),
      evidencePacket: expect.objectContaining({
        reason: "storage_not_configured",
        providerReadinessCounts: {
          ready: 0,
          disabled: 1,
          reserved: 3,
          actionable: 1,
        },
      }),
      documents: expect.arrayContaining([
        expect.objectContaining({
          document: expect.objectContaining({ id: "doc-001" }),
          queueEligibility: { eligible: false, reason: "ocr_storage_not_configured" },
        }),
      ]),
    });
  });

  it("marks unsupported document types as ineligible for OCR before enqueue", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableOcrProvider(repository);
    const { queue, jobs } = fakeOcrQueue();
    await repository.createDocumentUploadIntent({
      id: "doc-unsupported-ocr",
      firmId,
      matterId: "matter-001",
      title: "Plain text notes.txt",
      storageKey: "matters/matter-001/plain-text-notes.txt",
      checksumSha256: "9".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-unsupported-ocr",
      checksumSha256: "9".repeat(64),
      scanStatus: "passed",
    });

    const response = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-unsupported-ocr/queue",
      payload: { language: "eng" },
    });
    const workbench = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message: "Document file type is not supported for OCR",
    });
    expect(jobs).toEqual([]);
    await expect(repository.listJobLifecycleRecords(firmId, { queueName: "ocr" })).resolves.toEqual(
      [],
    );
    expect(workbench.statusCode).toBe(200);
    expect(workbench.json().documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          document: expect.objectContaining({ id: "doc-unsupported-ocr" }),
          queueEligibility: { eligible: false, reason: "unsupported_file_type" },
        }),
      ]),
    );
  });

  it("allows duplicate-checksum verified documents to queue OCR", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableOcrProvider(repository);
    const { queue, jobs } = fakeOcrQueue();
    await repository.createDocumentUploadIntent({
      id: "doc-duplicate",
      firmId,
      matterId: "matter-001",
      title: "Duplicate retainer.pdf",
      storageKey: "matters/matter-001/doc-duplicate.pdf",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
      classification: "general",
      legalHold: false,
    });
    const duplicate = await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-duplicate",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
      scanStatus: "passed",
    });
    expect(duplicate.checksumStatus).toBe("duplicate");

    const response = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-duplicate/queue",
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      documentId: "doc-duplicate",
      job: { targetResourceId: "doc-duplicate" },
    });
    expect(jobs[0]?.data).toEqual(
      expect.objectContaining({
        resourceId: "doc-duplicate",
        metadata: expect.objectContaining({ checksumStatus: "duplicate" }),
      }),
    );
  });

  it("keeps duplicate-checksum document completion scoped to the same matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createDocumentUploadIntent({
      id: "doc-cross-matter-checksum",
      firmId,
      matterId: "matter-002",
      title: "Cross matter retainer.pdf",
      storageKey: "matters/matter-002/cross-matter-retainer.pdf",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
      classification: "general",
      legalHold: false,
    });

    const completed = await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-cross-matter-checksum",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
    });

    expect(completed).toMatchObject({
      checksumStatus: "verified",
      uploadStatus: "verified",
    });
    expect(completed.duplicateOfDocumentId).toBeUndefined();
  });

  it("replays OCR queue requests for the same document without adding duplicate jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableOcrProvider(repository);
    const { queue, jobs } = fakeOcrQueue();
    const server = testServer({ repository, ocrJobQueue: queue });

    const first = await server.inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });
    const replay = await server.inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });

    expect(first.statusCode).toBe(202);
    expect(replay.statusCode).toBe(202);
    expect(replay.json().job.id).toBe(first.json().job.id);
    expect(replay.json().job.idempotencyKeyPresent).toBe(true);
    expect(jobs).toHaveLength(1);
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "ocr" }),
    ).resolves.toHaveLength(1);
  });

  it("rejects cross-matter and unverified document processing", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableOcrProvider(repository);
    const { queue, jobs } = fakeOcrQueue();
    const wrongMatter = await testServer({
      repository,
      ocrJobQueue: queue,
      authUser: user("licensee", ["matter-002"]),
    }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
    });
    expect(wrongMatter.statusCode).toBe(403);

    const intent = await repository.createDocumentUploadIntent({
      id: "doc-unverified",
      firmId,
      matterId: "matter-001",
      title: "Unverified upload.pdf",
      storageKey: "matters/matter-001/doc-unverified.pdf",
      checksumSha256: "b".repeat(64),
      classification: "general",
      legalHold: false,
    });
    expect(intent.uploadStatus).toBe("intent_created");
    const unverified = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-unverified/queue",
    });
    expect(unverified.statusCode).toBe(409);

    await repository.createDocumentUploadIntent({
      id: "doc-rejected",
      firmId,
      matterId: "matter-001",
      title: "Rejected upload.pdf",
      storageKey: "matters/matter-001/doc-rejected.pdf",
      checksumSha256: "c".repeat(64),
      classification: "general",
      legalHold: false,
    });
    const rejected = await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-rejected",
      checksumSha256: "d".repeat(64),
    });
    expect(rejected.uploadStatus).toBe("rejected");
    expect(rejected.checksumStatus).toBe("mismatch");
    const rejectedQueue = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-rejected/queue",
    });
    expect(rejectedQueue.statusCode).toBe(409);

    await repository.createDocumentUploadIntent({
      id: "doc-scan-queued",
      firmId,
      matterId: "matter-001",
      title: "Scan queued upload.pdf",
      storageKey: "matters/matter-001/doc-scan-queued.pdf",
      checksumSha256: "e".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-scan-queued",
      checksumSha256: "e".repeat(64),
      scanStatus: "queued",
    });
    const queuedScan = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-scan-queued/queue",
    });
    expect(queuedScan.statusCode).toBe(409);
    expect(queuedScan.json()).toMatchObject({
      message: "Document scan must pass before OCR processing",
    });

    await repository.updateDocumentScanStatus({
      firmId,
      documentId: "doc-scan-queued",
      scanStatus: "pending",
    });
    const pendingScan = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-scan-queued/queue",
    });
    expect(pendingScan.statusCode).toBe(409);
    expect(pendingScan.json()).toMatchObject({
      message: "Document scan must pass before OCR processing",
    });

    const workbench = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });
    expect(workbench.json().documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          document: expect.objectContaining({ id: "doc-scan-queued" }),
          queueEligibility: { eligible: false, reason: "scan_required" },
        }),
      ]),
    );
    expect(jobs).toEqual([]);
  });
});
