import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "../server.js";

const jwtSecret = "test-e2e-support-secret-at-least-32-chars";
const servers: Array<{ close: () => Promise<void> }> = [];

function testServer(options: { e2eSupport?: boolean } = {}) {
  const repository = new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    jwtSecret,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    e2eSupport: options.e2eSupport,
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
  });
  servers.push(server);
  return { repository, server };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("e2e support routes", () => {
  it("creates a completed synthetic document only when e2e support is enabled", async () => {
    const { repository, server } = testServer({ e2eSupport: true });

    const response = await server.inject({
      method: "POST",
      url: "/api/e2e/shareable-document",
      payload: {
        matterId: "matter-001",
        title: "Synthetic route-test disclosure.pdf",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      document: {
        matterId: "matter-001",
        title: "Synthetic route-test disclosure.pdf",
        uploadStatus: "verified",
        checksumStatus: "verified",
        scanStatus: "passed",
      },
    });
    await expect(repository.listMatterDocuments("firm-west-legal", "matter-001")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Synthetic route-test disclosure.pdf",
          storageKey: expect.stringContaining("e2e/matter-001/"),
        }),
      ]),
    );
  });

  it("does not register e2e support routes by default", async () => {
    const { server } = testServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/e2e/shareable-document",
      payload: {
        matterId: "matter-001",
        title: "Synthetic route-test disclosure.pdf",
      },
    });

    expect(response.statusCode).toBe(404);
  });
});
