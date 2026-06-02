import { S3Client } from "@aws-sdk/client-s3";
import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { MatterSummary } from "@open-practice/database";
import { hashToken } from "../http/auth-helpers.js";
import { createApiServer } from "../server.js";
import { PUBLIC_TOKEN_UPLOAD_INTENT_RATE_LIMIT } from "./public-token-rate-limits.js";

const jwtSecret = "test-intake-form-secret-at-least-32-chars";
const checksum = "f".repeat(64);
const fileSizeBytes = 4096;
const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

function futureIso(msFromNow = 7 * 24 * 60 * 60 * 1000): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

function s3Config(
  checksumSha256 = checksum,
  contentLength = fileSizeBytes,
): NonNullable<CreateServerOptions["s3"]> {
  const client = new S3Client({
    endpoint: "http://127.0.0.1:9000",
    forcePathStyle: true,
    region: "local",
    credentials: {
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    },
  });
  (
    client as unknown as { send: () => Promise<{ ChecksumSHA256: string; ContentLength: number }> }
  ).send = async () => ({
    ChecksumSHA256: Buffer.from(checksumSha256, "hex").toString("base64"),
    ContentLength: contentLength,
  });
  return {
    bucket: "open-practice-test-documents",
    client,
  };
}

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    jwtSecret,
    publicWebBaseUrl: "http://localhost:3001",
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
    ...overrides,
  });
  servers.push(server);
  return { repository, server };
}

async function restrictEvidenceUpload(repository: OpenPracticeRepository): Promise<void> {
  const template = (await repository.listIntakeTemplates("firm-west-legal")).find(
    (candidate) => candidate.id === "intake-template-001",
  );
  if (!template || template.definition.schemaVersion !== 2) {
    throw new Error("Seeded V2 intake template is required for this test");
  }
  const definition = JSON.parse(JSON.stringify(template.definition)) as typeof template.definition;
  if (definition.schemaVersion !== 2) throw new Error("Seeded V2 intake template is required");
  for (const item of definition.sections.flatMap((section) => section.items)) {
    if (item.id === "evidence-upload" && item.kind === "upload") {
      item.acceptedFileTypes = ["application/pdf", "image/png", "image/jpeg"];
    }
  }
  await repository.updateIntakeTemplate({ ...template, definition });
}

async function setClientSignatureDocument(
  repository: OpenPracticeRepository,
  documentId: string,
): Promise<void> {
  const template = (await repository.listIntakeTemplates("firm-west-legal")).find(
    (candidate) => candidate.id === "intake-template-001",
  );
  if (!template || template.definition.schemaVersion !== 2) {
    throw new Error("Seeded V2 intake template is required for this test");
  }
  const definition = JSON.parse(JSON.stringify(template.definition)) as typeof template.definition;
  if (definition.schemaVersion !== 2) throw new Error("Seeded V2 intake template is required");
  for (const item of definition.sections.flatMap((section) => section.items)) {
    if (item.id === "client-attestation" && item.kind === "signature") {
      item.documentId = documentId;
    }
  }
  await repository.updateIntakeTemplate({ ...template, definition });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("intake form builder routes", () => {
  it("previews intake template QA checks without persisting form records", async () => {
    const { repository, server } = testServer();
    await setClientSignatureDocument(repository, "doc-001");
    const [template] = await repository.listIntakeTemplates("firm-west-legal");
    if (!template || template.definition.schemaVersion !== 2) {
      throw new Error("Seeded V2 intake template is required for this test");
    }

    const beforeLinks = await repository.listIntakeFormLinks("firm-west-legal");
    const response = await server.inject({
      method: "POST",
      url: "/api/intake-templates/preview",
      payload: {
        matterId: "matter-001",
        definition: template.definition,
        answers: { issue_type: "repair" },
        selectedPackageIds: ["repair_notice_package"],
      },
    });
    const afterLinks = await repository.listIntakeFormLinks("firm-west-legal");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "warnings",
      preview: {
        visibleQuestionIds: expect.arrayContaining(["issue_type", "repair_details"]),
        requiredIncompleteItemIds: expect.arrayContaining([
          "evidence-upload",
          "client-attestation",
        ]),
        eligiblePackageIds: expect.arrayContaining(["repair_notice_package"]),
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("signature_document_unverified");
    expect(afterLinks).toEqual(beforeLinks);
  });

  it("blocks preview when a document-backed signature points outside the selected matter", async () => {
    const { repository, server } = testServer();
    await setClientSignatureDocument(repository, "doc-001");
    const [template] = await repository.listIntakeTemplates("firm-west-legal");
    if (!template) throw new Error("Seeded intake template is required for this test");

    const response = await server.inject({
      method: "POST",
      url: "/api/intake-templates/preview",
      payload: {
        matterId: "matter-002",
        definition: template.definition,
        answers: {},
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "blocked",
      checks: expect.arrayContaining([
        expect.objectContaining({
          code: "signature_document_unavailable",
          severity: "blocking",
          itemId: "client-attestation",
        }),
      ]),
    });
  });

  it("returns blocked QA output for invalid preview definitions", async () => {
    const { server } = testServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/intake-templates/preview",
      payload: {
        definition: {
          schemaVersion: 2,
          questions: [{ id: "client_name", label: "Client name", type: "text" }],
          branchRules: [],
          packages: [{ id: "base", title: "Base", documents: [{ id: "doc", title: "Doc" }] }],
          sections: [
            {
              id: "client-basics",
              title: "Client basics",
              items: [{ id: "client-name-item", kind: "question", questionId: "missing" }],
            },
          ],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "blocked",
      checks: [
        expect.objectContaining({
          code: "invalid_definition",
          severity: "blocking",
        }),
      ],
      preview: null,
    });
  });

  it("creates tokenized form links and hides token hashes on list responses", async () => {
    const { server } = testServer();

    const created = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-001",
        expiresAt: "2099-06-01T00:00:00.000Z",
      },
    });
    const listed = await server.inject({
      method: "GET",
      url: "/api/intake-form-links?matterId=matter-001",
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      token: expect.any(String),
      portalUrl: expect.stringMatching(/^http:\/\/localhost:3001\/intake-forms\//),
      link: expect.objectContaining({
        matterId: "matter-001",
        intakeSessionId: "intake-session-001",
        status: "active",
      }),
    });
    expect(created.json().link).not.toHaveProperty("tokenHash");
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      links: [expect.objectContaining({ id: created.json().link.id, status: "active" })],
      actionsByLinkId: expect.objectContaining({ [created.json().link.id]: [] }),
    });
    expect(JSON.stringify(listed.json())).not.toContain("tokenHash");
  });

  it("returns staff-only intake template QA previews without public tokens or answers", async () => {
    const { server } = testServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/intake-templates/intake-template-001/qa-preview",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      template: {
        id: "intake-template-001",
        provider: "embedded",
        definitionVersion: 2,
      },
      qa: {
        summary: {
          schemaVersion: 2,
          branchRuleCount: 2,
          previewCount: 3,
          blockingIssueCount: 0,
        },
        previews: expect.arrayContaining([
          expect.objectContaining({
            id: "branch:repair-package",
            matchedBranchRuleIds: ["repair-package"],
            visibleQuestionIds: expect.arrayContaining(["repair_details"]),
          }),
        ]),
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("tokenHash");
    for (const preview of response.json<{ qa: { previews: Array<Record<string, unknown>> } }>().qa
      .previews) {
      expect(preview).not.toHaveProperty("answers");
    }
  });

  it("runs public upload, signature, submission, and reviewed variable merge", async () => {
    const { repository, server } = testServer({ s3: s3Config() });
    await restrictEvidenceUpload(repository);
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-001",
        expiresAt: "2099-06-01T00:00:00.000Z",
      },
    });
    const token = created.json<{ token: string }>().token;
    const linkId = created.json<{ link: { id: string } }>().link.id;

    const incomplete = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/submit`,
      payload: {
        answers: {
          issue_type: "repair",
          urgent: true,
          client_display_name: "Ada M.",
          matter_title: "Ada tenancy repairs",
        },
      },
    });
    expect(incomplete.statusCode).toBe(409);
    expect(incomplete.json()).toMatchObject({
      code: "INTAKE_FORM_INCOMPLETE",
      details: { requiredIncompleteItemIds: ["evidence-upload", "client-attestation"] },
    });

    const rejectedUploadIntent = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/items/evidence-upload/uploads`,
      payload: {
        filename: "repair notes.txt",
        checksumSha256: checksum,
        fileSizeBytes,
        contentType: "text/plain",
      },
    });
    expect(rejectedUploadIntent.statusCode).toBe(409);
    expect(rejectedUploadIntent.json()).toMatchObject({
      code: "INTAKE_FORM_UPLOAD_TYPE_NOT_ACCEPTED",
      details: {
        contentType: "text/plain",
        acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
      },
    });

    const uploadIntent = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/items/evidence-upload/uploads`,
      payload: {
        filename: "repair photos.pdf",
        checksumSha256: checksum,
        fileSizeBytes,
        contentType: "application/pdf",
      },
    });
    expect(uploadIntent.statusCode).toBe(200);
    expect(uploadIntent.json()).toMatchObject({
      requiredHeaders: {
        "x-amz-checksum-sha256": expect.any(String),
        "x-amz-meta-open-practice-upload-scope": "intake-form",
        "x-amz-meta-open-practice-size-bytes": String(fileSizeBytes),
      },
      maxFileSizeBytes: expect.any(Number),
    });
    expect(uploadIntent.json<{ uploadUrl: string }>().uploadUrl).not.toContain(linkId);
    const uploadUrl = new URL(uploadIntent.json<{ uploadUrl: string }>().uploadUrl);
    const signedHeaders = uploadUrl.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];
    expect(signedHeaders).toContain("content-length");
    const documentId = uploadIntent.json<{ document: { id: string } }>().document.id;

    const completeUpload = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/items/evidence-upload/documents/${documentId}/complete`,
      payload: { checksumSha256: checksum },
    });
    const signature = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/items/client-attestation/signature`,
      payload: {
        status: "completed",
        consentText: "I confirm these synthetic intake answers are accurate.",
      },
    });
    const submitPayload = {
      clientSubmissionId: "browser-submit-001",
      answers: {
        issue_type: "repair",
        urgent: true,
        client_display_name: "Ada M.",
        matter_title: "Ada tenancy repairs",
      },
    };
    const submitted = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/submit`,
      payload: submitPayload,
    });

    expect(completeUpload.statusCode).toBe(200);
    expect(completeUpload.json()).toMatchObject({
      action: expect.objectContaining({
        status: "uploaded",
        itemId: "evidence-upload",
        kind: "upload",
        documentId,
      }),
    });
    expect(completeUpload.json().action).not.toHaveProperty("evidence");
    expect(signature.statusCode).toBe(200);
    expect(signature.json()).toMatchObject({
      action: expect.objectContaining({
        status: "completed",
        itemId: "client-attestation",
        kind: "signature",
      }),
    });
    expect(signature.json().action).not.toHaveProperty("evidence");
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json()).toMatchObject({
      status: "submitted",
      link: expect.objectContaining({ status: "submitted" }),
      submission: {
        capturedAt: expect.any(String),
        answerCount: 4,
      },
      proposalCount: 2,
    });
    const submittedLinkId = created.json<{ link: { id: string } }>().link.id;
    const storedSubmittedLink = await repository.getIntakeFormLink(
      "firm-west-legal",
      submittedLinkId,
    );
    expect(storedSubmittedLink).toEqual(
      expect.objectContaining({
        answerSnapshotId: expect.any(String),
        clientSubmissionId: "browser-submit-001",
        submissionFingerprint: expect.any(String),
      }),
    );
    const snapshotId = storedSubmittedLink!.answerSnapshotId!;
    const publicSubmissionBody = JSON.stringify(submitted.json());
    expect(publicSubmissionBody).not.toContain(submittedLinkId);
    expect(publicSubmissionBody).not.toContain(snapshotId);
    expect(publicSubmissionBody).not.toContain("firm-west-legal");
    expect(publicSubmissionBody).not.toContain("matter-001");
    expect(publicSubmissionBody).not.toContain("intake-session-001");
    expect(publicSubmissionBody).not.toContain("user-admin");
    await expect(
      repository.getTaskDeadline("firm-west-legal", `intake-review:${submittedLinkId}`),
    ).resolves.toEqual(
      expect.objectContaining({
        matterId: "matter-001",
        title: "Review submitted intake form",
      }),
    );
    const snapshotsAfterSubmit = await repository.listAnswerSnapshots("firm-west-legal", {
      intakeSessionId: "intake-session-001",
    });
    const proposalsAfterSubmit = await repository.listIntakeVariableProposals("firm-west-legal", {
      matterId: "matter-001",
    });
    const replayed = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/submit`,
      payload: submitPayload,
    });
    const conflictingReplay = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/submit`,
      payload: {
        ...submitPayload,
        answers: { ...submitPayload.answers, matter_title: "Changed tenancy repairs" },
      },
    });

    expect(replayed.statusCode).toBe(200);
    expect(replayed.json()).toMatchObject({
      status: "submitted",
      link: expect.objectContaining({ status: "submitted" }),
      submission: {
        capturedAt: expect.any(String),
        answerCount: 4,
      },
      proposalCount: proposalsAfterSubmit.length,
    });
    expect(JSON.stringify(replayed.json())).not.toContain(snapshotId);
    expect(conflictingReplay.statusCode).toBe(409);
    expect(conflictingReplay.json()).toMatchObject({
      code: "INTAKE_FORM_SUBMISSION_CONFLICT",
    });
    await expect(
      repository.listAnswerSnapshots("firm-west-legal", { intakeSessionId: "intake-session-001" }),
    ).resolves.toHaveLength(snapshotsAfterSubmit.length);
    await expect(
      repository.listIntakeVariableProposals("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toHaveLength(proposalsAfterSubmit.length);

    const reviewLoad = await server.inject({
      method: "GET",
      url: `/api/intake-form-links/${encodeURIComponent(submittedLinkId)}/review`,
    });
    const queuesBeforeReview = await server.inject({ method: "GET", url: "/api/queues" });

    expect(reviewLoad.statusCode).toBe(200);
    expect(reviewLoad.json()).toMatchObject({
      link: expect.objectContaining({ id: submittedLinkId, answerSnapshotId: snapshotId }),
      snapshot: expect.objectContaining({
        id: snapshotId,
        answers: expect.objectContaining({ client_display_name: "Ada M." }),
      }),
      reviews: [],
    });
    expect(queuesBeforeReview.json()).toMatchObject({
      sections: expect.arrayContaining([
        expect.objectContaining({
          key: "task-deadlines",
          items: expect.arrayContaining([
            expect.objectContaining({
              id: `intake-review:${submittedLinkId}`,
              title: "Review submitted intake form",
            }),
          ]),
        }),
        expect.objectContaining({
          key: "intake",
          items: expect.arrayContaining([
            expect.objectContaining({
              id: submittedLinkId,
              status: "pending_review",
              title: "Submitted intake review",
            }),
          ]),
        }),
      ]),
    });
    expect(JSON.stringify(queuesBeforeReview.json())).not.toContain("Ada M.");
    expect(JSON.stringify(queuesBeforeReview.json())).not.toContain("Ada tenancy repairs");

    const acceptedReview = await server.inject({
      method: "POST",
      url: `/api/intake-form-links/${encodeURIComponent(submittedLinkId)}/review/accept`,
    });
    expect(acceptedReview.statusCode).toBe(200);
    expect(acceptedReview.json()).toMatchObject({
      review: {
        decision: "accepted",
        answerSnapshotId: snapshotId,
        formLinkId: submittedLinkId,
      },
    });
    await expect(
      repository.getTaskDeadline("firm-west-legal", `intake-review:${submittedLinkId}`),
    ).resolves.toEqual(expect.objectContaining({ completedAt: expect.any(String) }));
    await expect(
      repository.listIntakeVariableProposals("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String), status: "pending" }),
      ]),
    );
    const proposalId = proposalsAfterSubmit.find(
      (proposal) => proposal.targetScope === "matter",
    )!.id;
    const clientProposalId = proposalsAfterSubmit.find(
      (proposal) => proposal.targetScope === "client",
    )!.id;

    const approved = await server.inject({
      method: "POST",
      url: `/api/intake-variable-proposals/${encodeURIComponent(proposalId)}/approve`,
    });
    const rejectedWithoutReason = await server.inject({
      method: "POST",
      url: `/api/intake-variable-proposals/${encodeURIComponent(clientProposalId)}/reject`,
      payload: {},
    });
    const rejected = await server.inject({
      method: "POST",
      url: `/api/intake-variable-proposals/${encodeURIComponent(clientProposalId)}/reject`,
      payload: { reason: "Synthetic mismatch after staff review." },
    });
    const matters = await repository.listMattersForUser(
      (await repository.getUser("firm-west-legal", "user-admin"))!,
    );
    const matter = matters.find((candidate: MatterSummary) => candidate.id === "matter-001")!;

    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: "approved", appliedAt: expect.any(String) });
    expect(rejectedWithoutReason.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({
      status: "rejected",
      rejectionReason: "Synthetic mismatch after staff review.",
    });
    expect(matter.title).toBe("Ada tenancy repairs");
    await expect(
      repository.listAccessLogs("firm-west-legal", {
        intakeFormLinkId: submittedLinkId,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "upload", resourceType: "document" }),
        expect.objectContaining({ action: "sign", resourceType: "intake_form_item" }),
        expect.objectContaining({ action: "submit", resourceType: "answer_snapshot" }),
      ]),
    );
  });

  it("rejects public intake upload completion when storage size differs from the intent", async () => {
    const { repository, server } = testServer({ s3: s3Config(checksum, fileSizeBytes + 1) });
    await restrictEvidenceUpload(repository);
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-001",
        expiresAt: "2099-06-01T00:00:00.000Z",
      },
    });
    const token = created.json<{ token: string }>().token;
    const uploadIntent = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/items/evidence-upload/uploads`,
      payload: {
        filename: "repair photos.pdf",
        checksumSha256: checksum,
        fileSizeBytes,
        contentType: "application/pdf",
      },
    });

    const completeUpload = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/items/evidence-upload/documents/${
        uploadIntent.json<{ document: { id: string } }>().document.id
      }/complete`,
      payload: { checksumSha256: checksum },
    });

    expect(uploadIntent.statusCode).toBe(200);
    expect(completeUpload.statusCode).toBe(400);
    expect(completeUpload.json()).toMatchObject({
      code: "UPLOAD_SIZE_MISMATCH",
      details: { expectedSizeBytes: fileSizeBytes, actualSizeBytes: fileSizeBytes + 1 },
    });
  });

  it("creates document-backed signature requests from public signature items", async () => {
    const { repository, server } = testServer({ s3: s3Config() });
    await setClientSignatureDocument(repository, "doc-001");
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-001",
        expiresAt: "2099-06-01T00:00:00.000Z",
      },
    });
    const token = created.json<{ token: string }>().token;
    const linkId = created.json<{ link: { id: string } }>().link.id;

    const signature = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/items/client-attestation/signature`,
      payload: {
        status: "completed",
        consentText: "I confirm these synthetic intake answers are accurate.",
        evidence: { acceptedInBrowser: true },
      },
    });

    expect(signature.statusCode).toBe(200);
    const signatureAction = signature.json<{
      action: { signatureRequestId: string };
    }>().action;
    expect(signature.json()).toMatchObject({
      action: expect.objectContaining({
        status: "completed",
        itemId: "client-attestation",
        kind: "signature",
        documentId: "doc-001",
        signatureRequestId: expect.any(String),
      }),
      signatureRequest: {
        id: signatureAction.signatureRequestId,
        status: "completed",
      },
    });
    expect(signature.json().action).not.toHaveProperty("evidence");
    const [storedAction] = await repository.listIntakeFormItemActions("firm-west-legal", {
      formLinkId: linkId,
      itemId: "client-attestation",
    });
    expect(storedAction?.evidence).toMatchObject({
      mode: "embedded_intake_signature_request",
      provider: "embedded",
      documentId: "doc-001",
      signatureRequestId: signatureAction.signatureRequestId,
      signerCount: 1,
    });
    expect(storedAction?.evidence).not.toHaveProperty("consentText");
    expect(storedAction?.evidence).not.toHaveProperty("ip");
    await expect(repository.listSignatureRequests("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: signatureAction.signatureRequestId,
          matterId: "matter-001",
          documentId: "doc-001",
          title: "Client attestation",
          status: "completed",
        }),
      ]),
    );
    await expect(
      repository.listSignatureProviderEvents("firm-west-legal", {
        signatureRequestId: signatureAction.signatureRequestId,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ status: "sent" }),
      expect.objectContaining({
        status: "completed",
        evidence: expect.objectContaining({
          mode: "embedded_intake_signature_request",
          signerId: expect.any(String),
          consentText: "I confirm these synthetic intake answers are accurate.",
        }),
      }),
    ]);
    await expect(
      repository.listAccessLogs("firm-west-legal", {
        intakeFormLinkId: linkId,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "sign",
          resourceType: "signature_request",
          resourceId: signatureAction.signatureRequestId,
          metadata: expect.objectContaining({
            documentId: "doc-001",
            signatureRequestId: signatureAction.signatureRequestId,
          }),
        }),
      ]),
    );
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "intake_signature_request.created",
          resourceType: "signature_request",
          resourceId: signatureAction.signatureRequestId,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            documentId: "doc-001",
            provider: "embedded",
            status: "completed",
            signerCount: 1,
          }),
        }),
      ]),
      valid: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const auditEvent = audit.events.find(
      (event) => event.action === "intake_signature_request.created",
    );
    expect(auditEvent?.metadata).not.toHaveProperty("consentText");
    expect(auditEvent?.metadata).not.toHaveProperty("signers");
  });

  it("requests more information with a fresh child token link returned once", async () => {
    const { repository, server } = testServer();
    const parentLink = await repository.createIntakeFormLink({
      id: "intake-form-link-review-parent",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      intakeSessionId: "intake-session-001",
      tokenHash: hashToken("parent-token", jwtSecret),
      requestedByUserId: "user-admin",
      clientContactId: "contact-ada",
      expiresAt: "2099-06-01T00:00:00.000Z",
      createdAt: "2026-05-01T12:00:00.000Z",
    });
    const snapshot = await repository.createAnswerSnapshot({
      id: "answer-snapshot-review-parent",
      firmId: "firm-west-legal",
      intakeSessionId: "intake-session-001",
      capturedAt: "2026-05-01T12:05:00.000Z",
      answers: { matter_title: "Synthetic private answer" },
      resolution: {
        templateId: "intake-template-001",
        templateVersion: 2,
        visibleQuestionIds: ["matter_title"],
        matchedBranchRuleIds: [],
        eligiblePackageIds: [],
        selectedPackageIds: [],
        packageSummaries: [],
        packageDocuments: [],
      },
    });
    await repository.markIntakeFormLinkSubmitted({
      firmId: "firm-west-legal",
      id: parentLink.id,
      submittedAt: "2026-05-01T12:06:00.000Z",
      answerSnapshotId: snapshot.id,
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/intake-form-links/${parentLink.id}/review/request-more-info`,
      payload: {
        reason: "Synthetic follow-up request.",
        expiresAt: "2099-06-08T00:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      review: {
        decision: "request_more_info",
        formLinkId: parentLink.id,
        answerSnapshotId: snapshot.id,
        followUpFormLinkId: expect.any(String),
        reason: "Synthetic follow-up request.",
      },
      followUp: {
        link: expect.objectContaining({
          parentFormLinkId: parentLink.id,
          status: "active",
        }),
        token: expect.any(String),
        portalUrl: expect.stringMatching(/^http:\/\/localhost:3001\/intake-forms\//),
      },
    });
    const body = response.json<{
      followUp: { link: { id: string }; token: string; portalUrl: string };
      review: { followUpFormLinkId: string };
    }>();
    expect(body.followUp.link).not.toHaveProperty("answerSnapshotId");
    const storedFollowUp = await repository.getIntakeFormLink(
      "firm-west-legal",
      body.followUp.link.id,
    );
    expect(storedFollowUp).toEqual(
      expect.objectContaining({
        id: body.review.followUpFormLinkId,
        parentFormLinkId: parentLink.id,
        tokenHash: expect.any(String),
      }),
    );
    expect(storedFollowUp?.tokenHash).not.toBe(body.followUp.token);
    expect(storedFollowUp?.tokenHash).toBe(hashToken(body.followUp.token, jwtSecret));
    const listed = await server.inject({
      method: "GET",
      url: "/api/intake-form-links?matterId=matter-001",
    });
    expect(JSON.stringify(listed.json())).not.toContain(body.followUp.token);
    expect(JSON.stringify(listed.json())).not.toContain("Synthetic private answer");
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "intake_form_review.request_more_info",
          metadata: expect.objectContaining({
            formLinkId: parentLink.id,
            answerSnapshotId: snapshot.id,
            followUpFormLinkId: body.review.followUpFormLinkId,
          }),
        }),
      ]),
      valid: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const reviewAudit = audit.events.find(
      (event) => event.action === "intake_form_review.request_more_info",
    );
    expect(reviewAudit?.metadata).not.toHaveProperty("reason");
    expect(JSON.stringify(reviewAudit?.metadata)).not.toContain("Synthetic private answer");
  });

  it("rejects document-backed signature items with missing document or signer email", async () => {
    const { repository, server } = testServer();
    await setClientSignatureDocument(repository, "missing-document");
    const missingDocumentLink = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-001",
        expiresAt: "2099-06-01T00:00:00.000Z",
      },
    });
    const missingDocument = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${missingDocumentLink.json<{ token: string }>().token}/items/client-attestation/signature`,
      payload: {
        status: "completed",
        consentText: "I confirm these synthetic intake answers are accurate.",
      },
    });

    expect(missingDocument.statusCode).toBe(409);
    expect(missingDocument.json()).toMatchObject({
      code: "INTAKE_SIGNATURE_DOCUMENT_UNAVAILABLE",
    });
    await expect(repository.listSignatureRequests("firm-west-legal")).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ documentId: "missing-document" })]),
    );

    await setClientSignatureDocument(repository, "doc-001");
    await repository.createIntakeSession({
      id: "intake-session-no-email",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      templateId: "intake-template-001",
      provider: "embedded",
      externalId: "embedded:intake-session-no-email",
      status: "in_progress",
      clientContactId: "contact-northstar",
      evidence: { mode: "test" },
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z",
    });
    const missingEmailLink = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-no-email",
        expiresAt: "2099-06-01T00:00:00.000Z",
      },
    });
    const missingEmail = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${missingEmailLink.json<{ token: string }>().token}/items/client-attestation/signature`,
      payload: {
        status: "completed",
        consentText: "I confirm these synthetic intake answers are accurate.",
      },
    });

    expect(missingEmail.statusCode).toBe(409);
    expect(missingEmail.json()).toMatchObject({
      code: "INTAKE_SIGNATURE_SIGNER_UNAVAILABLE",
    });
    await expect(
      repository.listIntakeFormItemActions("firm-west-legal", {
        formLinkId: missingEmailLink.json<{ link: { id: string } }>().link.id,
      }),
    ).resolves.toEqual([]);
  });

  it("enforces matter scope for link listing and proposal review", async () => {
    const { server } = testServer({ devUserId: "user-licensee" });
    const crossMatterList = await server.inject({
      method: "GET",
      url: "/api/intake-form-links?matterId=matter-002",
    });
    const crossMatterCreate = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-001",
        expiresAt: futureIso(),
      },
      headers: {
        "x-open-practice-user-id": "user-staff",
      },
    });

    expect(crossMatterList.statusCode).toBe(403);
    expect(crossMatterCreate.statusCode).toBe(200);
  });

  it("rate-limits public intake upload intents without leaking token material", async () => {
    const { repository, server } = testServer({ s3: s3Config() });
    await restrictEvidenceUpload(repository);
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-001",
        expiresAt: "2099-06-01T00:00:00.000Z",
      },
    });
    const token = created.json<{ token: string }>().token;
    const tokenHash = hashToken(token, jwtSecret);
    let limited = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${token}/items/evidence-upload/uploads`,
      payload: {
        filename: "repair notes.txt",
        checksumSha256: checksum,
        fileSizeBytes,
        contentType: "text/plain",
      },
    });

    for (let index = 0; index < PUBLIC_TOKEN_UPLOAD_INTENT_RATE_LIMIT.max; index += 1) {
      limited = await server.inject({
        method: "POST",
        url: `/api/portal/intake-forms/${token}/items/evidence-upload/uploads`,
        payload: {
          filename: `repair notes ${index}.txt`,
          checksumSha256: checksum,
          fileSizeBytes,
          contentType: "text/plain",
        },
      });
    }

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests",
    });
    expect(limited.body).not.toContain(token);
    expect(limited.body).not.toContain(tokenHash);
    expect(limited.body).not.toContain("tokenHash");
  });

  it("returns stable public link states and logs granted and denied access", async () => {
    const { repository, server } = testServer({ s3: s3Config() });
    await restrictEvidenceUpload(repository);
    const active = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-001",
        expiresAt: "2099-06-01T00:00:00.000Z",
      },
    });
    const activeToken = active.json<{ token: string }>().token;
    const activeLinkId = active.json<{ link: { id: string } }>().link.id;

    const loaded = await server.inject({
      method: "GET",
      url: `/api/portal/intake-forms/${activeToken}`,
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json()).toMatchObject({
      link: expect.objectContaining({ status: "active" }),
      draft: null,
      template: expect.objectContaining({ name: "Residential tenancy intake" }),
    });
    for (const question of loaded.json().template.definition.questions) {
      expect(question).not.toHaveProperty("variableMapping");
    }
    expect(loaded.json().template.definition.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ id: "evidence-upload", kind: "upload" }),
            expect.objectContaining({ id: "client-attestation", kind: "signature" }),
          ]),
        }),
      ]),
    );
    const loadedBody = JSON.stringify(loaded.json());
    expect(loadedBody).not.toContain("classification");
    expect(loadedBody).not.toContain("legalHold");
    expect(loadedBody).not.toContain("documentId");
    expect(JSON.stringify(loaded.json())).not.toContain(activeLinkId);
    const draft = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${activeToken}/draft`,
      payload: {
        answers: {
          issue_type: "repair",
          urgent: true,
          client_display_name: "Ada M.",
        },
      },
    });
    const draftLoad = await server.inject({
      method: "GET",
      url: `/api/portal/intake-forms/${activeToken}`,
    });
    expect(draft.statusCode).toBe(200);
    expect(draft.json()).toMatchObject({
      status: "draft_saved",
      draftUpdatedAt: expect.any(String),
    });
    expect(draftLoad.json()).toMatchObject({
      draft: {
        answers: expect.objectContaining({
          issue_type: "repair",
          urgent: true,
          client_display_name: "Ada M.",
        }),
        updatedAt: draft.json<{ draftUpdatedAt: string }>().draftUpdatedAt,
      },
    });

    const expired = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-001",
        expiresAt: "2000-01-01T00:00:00.000Z",
      },
    });
    const expiredToken = expired.json<{ token: string }>().token;
    const expiredLinkId = expired.json<{ link: { id: string } }>().link.id;
    const expiredLoad = await server.inject({
      method: "GET",
      url: `/api/portal/intake-forms/${expiredToken}`,
    });
    expect(expiredLoad.statusCode).toBe(403);
    expect(expiredLoad.json()).toMatchObject({
      code: "INTAKE_FORM_LINK_UNAVAILABLE",
    });

    const revoked = await server.inject({
      method: "POST",
      url: "/api/intake-form-links",
      payload: {
        intakeSessionId: "intake-session-001",
        expiresAt: "2099-06-01T00:00:00.000Z",
      },
    });
    const revokedToken = revoked.json<{ token: string }>().token;
    const revokedLinkId = revoked.json<{ link: { id: string } }>().link.id;
    const revoke = await server.inject({
      method: "POST",
      url: `/api/intake-form-links/${revokedLinkId}/revoke`,
    });
    const revokedLoad = await server.inject({
      method: "GET",
      url: `/api/portal/intake-forms/${revokedToken}`,
    });
    expect(revoke.statusCode).toBe(200);
    expect(revokedLoad.statusCode).toBe(403);

    const submittedToken = activeToken;
    await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${submittedToken}/items/client-attestation/signature`,
      payload: {
        status: "completed",
        consentText: "I confirm these synthetic intake answers are accurate.",
      },
    });
    const uploadIntent = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${submittedToken}/items/evidence-upload/uploads`,
      payload: {
        filename: "repair photos.pdf",
        checksumSha256: checksum,
        fileSizeBytes,
        contentType: "application/pdf",
      },
    });
    const documentId = uploadIntent.json<{ document: { id: string } }>().document.id;
    await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${submittedToken}/items/evidence-upload/documents/${documentId}/complete`,
      payload: { checksumSha256: checksum },
    });
    const submitted = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${submittedToken}/submit`,
      payload: {
        answers: {
          issue_type: "repair",
          urgent: true,
          client_display_name: "Ada M.",
          matter_title: "Ada tenancy repairs",
        },
      },
    });
    const resubmitted = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${submittedToken}/submit`,
      payload: {
        answers: {
          issue_type: "repair",
          urgent: true,
          client_display_name: "Ada M.",
          matter_title: "Ada tenancy repairs",
        },
      },
    });
    const submittedLoad = await server.inject({
      method: "GET",
      url: `/api/portal/intake-forms/${submittedToken}`,
    });

    expect(submitted.statusCode).toBe(200);
    expect(resubmitted.statusCode).toBe(409);
    expect(resubmitted.json()).toMatchObject({ code: "INTAKE_FORM_SUBMISSION_CONFLICT" });
    expect(submittedLoad.statusCode).toBe(200);
    expect(submittedLoad.json()).toMatchObject({
      link: expect.objectContaining({ status: "submitted" }),
      draft: null,
    });
    const draftAfterSubmit = await server.inject({
      method: "POST",
      url: `/api/portal/intake-forms/${submittedToken}/draft`,
      payload: { answers: { issue_type: "repair" } },
    });
    expect(draftAfterSubmit.statusCode).toBe(403);
    const submittedLoadBody = JSON.stringify(submittedLoad.json());
    expect(submittedLoadBody).not.toContain(activeLinkId);
    expect(submittedLoadBody).not.toContain("tokenHash");
    expect(submittedLoadBody).not.toContain("firm-west-legal");
    expect(submittedLoadBody).not.toContain("matter-001");
    expect(submittedLoadBody).not.toContain("intake-session-001");
    expect(submittedLoadBody).not.toContain("user-admin");

    await expect(
      repository.listAccessLogs("firm-west-legal", { intakeFormLinkId: activeLinkId }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "view",
          metadata: { outcome: "granted", status: "active" },
        }),
        expect.objectContaining({
          action: "view",
          metadata: { outcome: "granted", status: "submitted" },
        }),
        expect.objectContaining({
          action: "submit",
          metadata: { outcome: "submission_conflict" },
        }),
      ]),
    );
    await expect(
      repository.listAccessLogs("firm-west-legal", { intakeFormLinkId: expiredLinkId }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "view",
          metadata: { outcome: "denied", reason: "expired" },
        }),
      ]),
    );
    await expect(
      repository.listAccessLogs("firm-west-legal", { intakeFormLinkId: revokedLinkId }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "view",
          metadata: { outcome: "denied", reason: "revoked" },
        }),
      ]),
    );
  });
});
