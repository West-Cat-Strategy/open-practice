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

  it("creates sanitized draft snapshots and increments versions on update", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: {
        matterId: "matter-001",
        title: "Demand letter draft",
        editorJson,
        renderedHtml: '<h1 data-draft-block="title">Demand</h1><script>alert("xss")</script>',
        metadata: { templateId: "draft-template-legal-letter" },
      },
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
  });

  it("rejects invalid TipTap document JSON", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/drafts",
      payload: {
        matterId: "matter-001",
        title: "Invalid draft",
        editorJson: { type: "paragraph" },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
  });

  it("keeps unauthorized matter access at 403", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/drafts",
      payload: {
        matterId: "matter-002",
        title: "Restricted matter draft",
        editorJson,
      },
    });
    const response = await server.inject({
      method: "GET",
      url: `/api/drafts/${created.json<{ id: string }>().id}`,
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(created.statusCode).toBe(200);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Draft access required",
    });
  });
});
