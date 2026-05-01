import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { MatterSummary } from "@open-practice/database";
import { createApiServer } from "../server.js";

const jwtSecret = "test-intake-form-secret-at-least-32-chars";
const checksum = "f".repeat(64);
const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

function s3Config(): NonNullable<CreateServerOptions["s3"]> {
  return {
    bucket: "open-practice-test-documents",
    client: new S3Client({
      endpoint: "http://127.0.0.1:9000",
      forcePathStyle: true,
      region: "local",
      credentials: {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
      },
    }),
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

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("intake form builder routes", () => {
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
        contentType: "application/pdf",
      },
    });
    expect(uploadIntent.statusCode).toBe(200);
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
    const submitted = await server.inject({
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

    expect(completeUpload.statusCode).toBe(200);
    expect(completeUpload.json()).toMatchObject({
      action: expect.objectContaining({
        status: "uploaded",
        evidence: expect.objectContaining({ contentType: "application/pdf" }),
      }),
    });
    expect(signature.statusCode).toBe(200);
    expect(signature.json()).toMatchObject({
      action: expect.objectContaining({
        status: "completed",
        evidence: expect.objectContaining({
          mode: "embedded_intake_attestation",
          consentText: "I confirm these synthetic intake answers are accurate.",
          userAgent: expect.any(String),
        }),
      }),
    });
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json()).toMatchObject({
      status: "submitted",
      proposals: [
        expect.objectContaining({ targetScope: "client", status: "pending" }),
        expect.objectContaining({ targetScope: "matter", status: "pending" }),
      ],
    });
    const proposalId = submitted
      .json<{ proposals: Array<{ id: string; targetScope: string }> }>()
      .proposals.find((proposal) => proposal.targetScope === "matter")!.id;
    const clientProposalId = submitted
      .json<{ proposals: Array<{ id: string; targetScope: string }> }>()
      .proposals.find((proposal) => proposal.targetScope === "client")!.id;

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
        intakeFormLinkId: created.json().link.id,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "upload", resourceType: "document" }),
        expect.objectContaining({ action: "sign", resourceType: "intake_form_item" }),
        expect.objectContaining({ action: "submit", resourceType: "answer_snapshot" }),
      ]),
    );
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
        expiresAt: "2026-06-01T00:00:00.000Z",
      },
      headers: {
        "x-open-practice-user-id": "user-staff",
      },
    });

    expect(crossMatterList.statusCode).toBe(403);
    expect(crossMatterCreate.statusCode).toBe(200);
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
      link: expect.objectContaining({ id: activeLinkId, status: "active" }),
      template: expect.objectContaining({ name: "Residential tenancy intake" }),
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
    expect(resubmitted.statusCode).toBe(403);
    expect(submittedLoad.statusCode).toBe(200);
    expect(submittedLoad.json()).toMatchObject({
      link: expect.objectContaining({ status: "submitted" }),
    });
    expect(JSON.stringify(submittedLoad.json())).not.toContain("tokenHash");

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
          action: "view",
          metadata: { outcome: "denied", reason: "submitted" },
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
