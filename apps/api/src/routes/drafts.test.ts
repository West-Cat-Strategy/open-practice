import type { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "../server.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

const editorJson = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Synthetic drafting note" }],
    },
  ],
};

const licenseeHeaders = {
  "x-open-practice-user-id": "user-licensee",
  "x-open-practice-firm-id": "firm-west-legal",
};

const staffHeaders = {
  "x-open-practice-user-id": "user-staff",
  "x-open-practice-firm-id": "firm-west-legal",
};

function s3Config(
  calls: unknown[],
  serverSideEncryption?: "AES256",
): NonNullable<CreateServerOptions["s3"]> {
  return {
    bucket: "open-practice-test-documents",
    serverSideEncryption,
    client: {
      async send(command: unknown) {
        calls.push(command);
        return {};
      },
    } as unknown as S3Client,
  };
}

function draftPayload(overrides: Record<string, unknown> = {}) {
  return {
    matterId: "matter-001",
    title: "Synthetic draft",
    editorJson,
    ...overrides,
  };
}

function templatePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Synthetic drafting template",
    description: "Reusable synthetic template for API permission regression coverage.",
    editorJson,
    category: "correspondence",
    metadata: { source: "route-test" },
    ...overrides,
  };
}

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
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
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("draft routes", () => {
  it("lists seeded basic draft templates", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/draft-templates",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "draft-template-legal-letter",
          category: "correspondence",
          active: true,
          editorJson: expect.objectContaining({ type: "doc" }),
        }),
        expect.objectContaining({
          id: "draft-template-meeting-notes",
          category: "internal",
          active: true,
          editorJson: expect.objectContaining({ type: "doc" }),
        }),
      ]),
    );
  });

  it("lets firm staff read templates but blocks template creation without permission", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const listed = await server.inject({
      method: "GET",
      url: "/api/draft-templates",
      headers: staffHeaders,
    });
    const deniedCreate = await server.inject({
      method: "POST",
      url: "/api/draft-templates",
      headers: staffHeaders,
      payload: templatePayload(),
    });
    const adminCreate = await server.inject({
      method: "POST",
      url: "/api/draft-templates",
      payload: templatePayload({ name: "Admin-created synthetic template" }),
    });

    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "draft-template-legal-letter" })]),
    );
    expect(deniedCreate.statusCode).toBe(403);
    expect(deniedCreate.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Draft template access required",
    });
    expect(adminCreate.statusCode).toBe(200);
    expect(adminCreate.json()).toMatchObject({
      firmId: "firm-west-legal",
      name: "Admin-created synthetic template",
      category: "correspondence",
      active: true,
      editorJson,
    });
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "draft_template.created",
          resourceType: "draft_template",
          resourceId: adminCreate.json<{ id: string }>().id,
          metadata: {
            templateId: adminCreate.json<{ id: string }>().id,
            status: "active",
          },
        }),
      ]),
      valid: true,
    });
  });

  it("creates sanitized draft snapshots and increments versions on update", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const created = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: draftPayload({
        title: "Demand letter draft",
        renderedHtml: '<h1 data-draft-block="title">Demand</h1><script>alert("xss")</script>',
        metadata: { templateId: "draft-template-legal-letter" },
      }),
    });
    const updated = await server.inject({
      method: "PUT",
      url: `/api/drafts/${created.json<{ id: string }>().id}`,
      payload: {
        title: "Updated demand letter draft",
        renderedHtml: '<p style="position:fixed">Updated</p>',
      },
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      title: "Demand letter draft",
      editorJson,
      renderedHtml: '<h1 data-draft-block="title">Demand</h1>',
      version: 1,
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      title: "Updated demand letter draft",
      renderedHtml: "<p>Updated</p>",
      version: 2,
      updatedByUserId: "user-admin",
    });
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "draft.created",
          resourceType: "draft",
          resourceId: created.json<{ id: string }>().id,
          metadata: {
            matterId: "matter-001",
            draftId: created.json<{ id: string }>().id,
            version: 1,
          },
        }),
        expect.objectContaining({
          action: "draft.updated",
          resourceType: "draft",
          resourceId: created.json<{ id: string }>().id,
          metadata: {
            matterId: "matter-001",
            draftId: created.json<{ id: string }>().id,
            version: 2,
          },
        }),
      ]),
      valid: true,
    });
  });

  it("records concise audit metadata after deleting drafts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const created = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: draftPayload({ title: "Delete audit draft" }),
    });
    const draftId = created.json<{ id: string }>().id;

    const deleted = await server.inject({
      method: "DELETE",
      url: `/api/drafts/${draftId}`,
    });
    const readback = await server.inject({
      method: "GET",
      url: `/api/drafts/${draftId}`,
    });

    expect(created.statusCode).toBe(200);
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ ok: true });
    expect(readback.statusCode).toBe(404);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "draft.deleted",
          resourceType: "draft",
          resourceId: draftId,
          metadata: {
            matterId: "matter-001",
            draftId,
            version: 1,
          },
        }),
      ]),
      valid: true,
    });
  });

  it("creates matter drafts from selected active templates", async () => {
    const server = testServer();
    const templates = await server.inject({
      method: "GET",
      url: "/api/draft-templates",
    });
    const legalLetterTemplate = templates
      .json<Array<{ id: string; editorJson: typeof editorJson }>>()
      .find((template) => template.id === "draft-template-legal-letter")!;

    const created = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: {
        matterId: "matter-001",
        title: "Template-backed letter",
        templateId: legalLetterTemplate.id,
      },
    });
    const listed = await server.inject({
      method: "GET",
      url: "/api/drafts?matterId=matter-001",
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      matterId: "matter-001",
      title: "Template-backed letter",
      editorJson: legalLetterTemplate.editorJson,
      version: 1,
      metadata: { templateId: legalLetterTemplate.id },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.json<{ id: string }>().id,
          metadata: { templateId: legalLetterTemplate.id },
        }),
      ]),
    );
  });

  it("rejects ambiguous or unseeded draft creation input", async () => {
    const server = testServer();
    const ambiguous = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: {
        matterId: "matter-001",
        title: "Ambiguous draft",
        editorJson,
        templateId: "draft-template-legal-letter",
      },
    });
    const missingSeed = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: {
        matterId: "matter-001",
        title: "Unseeded draft",
      },
    });

    expect(ambiguous.statusCode).toBe(400);
    expect(missingSeed.statusCode).toBe(400);
    expect(ambiguous.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(missingSeed.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
  });

  it("returns 404 for inactive or foreign template selections", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const [seedTemplate] = await repository.listDraftTemplates("firm-west-legal");
    await repository.createDraftTemplate({
      ...seedTemplate!,
      id: "draft-template-inactive",
      active: false,
    });
    await repository.createDraftTemplate({
      ...seedTemplate!,
      id: "draft-template-foreign",
      firmId: "firm-other",
    });
    const server = testServer({ repository });

    for (const templateId of ["draft-template-inactive", "draft-template-foreign"]) {
      const response = await server.inject({
        method: "POST",
        url: "/api/drafts",
        payload: {
          matterId: "matter-001",
          title: "Unavailable template",
          templateId,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: "Error",
        message: "Draft template was not found",
      });
    }
  });

  it("rejects invalid TipTap document JSON", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/drafts",
      payload: draftPayload({
        title: "Invalid draft",
        editorJson: { type: "paragraph" },
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
  });

  it("keeps matter-scoped draft lists limited to assigned matters", async () => {
    const server = testServer();
    const matterOne = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: draftPayload({ title: "Assigned matter draft" }),
    });
    const matterTwo = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: draftPayload({ matterId: "matter-002", title: "Restricted matter draft" }),
    });
    const assignedMatterList = await server.inject({
      method: "GET",
      url: "/api/drafts?matterId=matter-001",
      headers: licenseeHeaders,
    });
    const noMatterList = await server.inject({
      method: "GET",
      url: "/api/drafts",
      headers: licenseeHeaders,
    });
    const otherMatterList = await server.inject({
      method: "GET",
      url: "/api/drafts?matterId=matter-002",
      headers: licenseeHeaders,
    });
    const deniedCreate = await server.inject({
      method: "POST",
      url: "/api/drafts",
      headers: licenseeHeaders,
      payload: draftPayload({ matterId: "matter-002", title: "Denied restricted matter draft" }),
    });

    expect(matterOne.statusCode).toBe(200);
    expect(matterTwo.statusCode).toBe(200);
    expect(assignedMatterList.statusCode).toBe(200);
    expect(
      assignedMatterList.json<Array<{ matterId?: string; title: string }>>().map((draft) => ({
        matterId: draft.matterId,
        title: draft.title,
      })),
    ).toEqual([{ matterId: "matter-001", title: "Assigned matter draft" }]);
    expect(noMatterList.statusCode).toBe(403);
    expect(noMatterList.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Draft access required",
    });
    expect(otherMatterList.statusCode).toBe(403);
    expect(otherMatterList.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Draft access required",
    });
    expect(deniedCreate.statusCode).toBe(403);
    expect(deniedCreate.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Draft access required",
    });
  });

  it("keeps unauthorized matter reads and updates at 403 without mutating drafts", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: draftPayload({
        matterId: "matter-002",
        title: "Restricted matter draft",
      }),
    });
    const draftId = created.json<{ id: string }>().id;
    const read = await server.inject({
      method: "GET",
      url: `/api/drafts/${draftId}`,
      headers: licenseeHeaders,
    });
    const update = await server.inject({
      method: "PUT",
      url: `/api/drafts/${draftId}`,
      headers: licenseeHeaders,
      payload: {
        title: "Unauthorized title update",
      },
    });
    const adminReadback = await server.inject({
      method: "GET",
      url: `/api/drafts/${draftId}`,
    });

    expect(created.statusCode).toBe(200);
    expect(read.statusCode).toBe(403);
    expect(read.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Draft access required",
    });
    expect(update.statusCode).toBe(403);
    expect(update.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Draft access required",
    });
    expect(adminReadback.statusCode).toBe(200);
    expect(adminReadback.json()).toMatchObject({
      title: "Restricted matter draft",
      version: 1,
      updatedByUserId: "user-admin",
    });
  });

  it("exports saved matter drafts to PDF and DOCX with generated-document metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const s3Calls: unknown[] = [];
    const server = testServer({ repository, s3: s3Config(s3Calls, "AES256") });
    const created = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: draftPayload({
        title: "Merge letter {{ matter.number }}",
        editorJson: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "{{ firm.name }}" }],
            },
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Dear " },
                { type: "text", text: "{{ client.displayName }}", marks: [{ type: "bold" }] },
                { type: "text", text: ", this concerns {{ matter.title }}." },
              ],
            },
          ],
        },
      }),
    });

    for (const format of ["pdf", "docx"] as const) {
      const exported = await server.inject({
        method: "POST",
        url: `/api/drafts/${created.json<{ id: string }>().id}/exports`,
        payload: { format, title: `Office export ${format}` },
      });

      expect(exported.statusCode).toBe(200);
      expect(exported.json()).toMatchObject({
        format,
        title: `Office export ${format}`,
        contentType:
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        document: {
          firmId: "firm-west-legal",
          matterId: "matter-001",
          classification: "work_product",
          legalHold: true,
          uploadStatus: "verified",
          checksumStatus: expect.stringMatching(/^(verified|duplicate)$/),
          scanStatus: "passed",
        },
        generatedDocument: {
          firmId: "firm-west-legal",
          matterId: "matter-001",
          provider: "embedded",
          evidence: {
            source: "draft_export",
            draftId: created.json<{ id: string }>().id,
            draftVersion: 1,
            format,
            byteLength: expect.any(Number),
          },
        },
      });
      expect(exported.json<{ byteLength: number }>().byteLength).toBeGreaterThan(100);
      expect(exported.json<{ checksumSha256: string }>().checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    }

    expect(s3Calls).toHaveLength(2);
    expect(
      s3Calls.map(
        (command) =>
          (
            command as {
              input: {
                ChecksumSHA256?: string;
                Metadata?: Record<string, string>;
                ServerSideEncryption?: string;
              };
            }
          ).input,
      ),
    ).toEqual([
      expect.objectContaining({
        ChecksumSHA256: expect.any(String),
        ServerSideEncryption: "AES256",
        Metadata: expect.objectContaining({
          "open-practice-matter-id": "matter-001",
          "open-practice-draft-id": created.json<{ id: string }>().id,
          "open-practice-export-format": "pdf",
        }),
      }),
      expect.objectContaining({
        ChecksumSHA256: expect.any(String),
        ServerSideEncryption: "AES256",
        Metadata: expect.objectContaining({
          "open-practice-matter-id": "matter-001",
          "open-practice-draft-id": created.json<{ id: string }>().id,
          "open-practice-export-format": "docx",
        }),
      }),
    ]);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "draft.export.created",
          resourceType: "generated_document",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            draftId: created.json<{ id: string }>().id,
            draftVersion: 1,
            documentId: expect.any(String),
            generatedDocumentId: expect.any(String),
            format: "pdf",
            checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            byteLength: expect.any(Number),
          }),
        }),
        expect.objectContaining({
          action: "draft.export.created",
          metadata: expect.objectContaining({ format: "docx" }),
        }),
      ]),
      valid: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(JSON.stringify(audit.events)).not.toContain("Dear Ada Morgan");
    expect(JSON.stringify(audit.events)).not.toContain("West Coast Legal Services Collective");
  });

  it("rejects draft exports when storage is not configured", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: draftPayload({ title: "No storage export" }),
    });

    const exported = await server.inject({
      method: "POST",
      url: `/api/drafts/${created.json<{ id: string }>().id}/exports`,
      payload: { format: "pdf" },
    });

    expect(exported.statusCode).toBe(503);
    expect(exported.json()).toMatchObject({
      error: "ApiHttpError",
      code: "DOCUMENT_EXPORT_STORAGE_NOT_CONFIGURED",
      message: "Document export storage is not configured",
    });
  });

  it("rejects unknown merge fields before uploading or creating document records", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const s3Calls: unknown[] = [];
    const server = testServer({ repository, s3: s3Config(s3Calls) });
    const created = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: draftPayload({
        title: "Unknown merge field",
        editorJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Unsupported {{ intake.answer }}" }],
            },
          ],
        },
      }),
    });

    const exported = await server.inject({
      method: "POST",
      url: `/api/drafts/${created.json<{ id: string }>().id}/exports`,
      payload: { format: "docx" },
    });

    expect(exported.statusCode).toBe(400);
    expect(exported.json()).toMatchObject({
      error: "UnknownDraftMergeFieldError",
      message: "Unknown draft merge field: intake.answer",
    });
    expect(s3Calls).toHaveLength(0);
    await expect(
      repository.listMatterDocuments("firm-west-legal", "matter-001"),
    ).resolves.toHaveLength(1);
  });

  it("keeps cross-matter draft exports behind matter-scoped access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const s3Calls: unknown[] = [];
    const server = testServer({ repository, s3: s3Config(s3Calls) });
    const created = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: draftPayload({ matterId: "matter-002", title: "Restricted export" }),
    });

    const exported = await server.inject({
      method: "POST",
      url: `/api/drafts/${created.json<{ id: string }>().id}/exports`,
      headers: licenseeHeaders,
      payload: { format: "pdf" },
    });

    expect(exported.statusCode).toBe(403);
    expect(exported.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Draft access required",
    });
    expect(s3Calls).toHaveLength(0);
  });
});
