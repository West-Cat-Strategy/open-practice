import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "../server.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    ...overrides,
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("billing routes", () => {
  it("returns legacy top-level error shape for invalid billing requests", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        matterId: "matter-001",
        minutes: 0,
        rateCents: 18000,
        narrative: "Draft invoice review.",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(response.json()).not.toHaveProperty("success");
  });

  it("keeps unauthorized matter access at 403", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/time-entries?matterId=matter-002",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Time entry access required",
    });
  });

  it("denies non-billing roles from the billing dashboard", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/billing/dashboard",
      headers: {
        "x-open-practice-user-id": "user-staff",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
  });

  it("returns the direct payload shape for successful migrated routes", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-route-test",
        matterId: "matter-001",
        minutes: 45,
        rateCents: 18000,
        narrative: "Prepare billing route extraction test.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "time-route-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      userId: "user-admin",
      minutes: 45,
      rateCents: 18000,
      narrative: "Prepare billing route extraction test.",
      billable: true,
      billingStatus: "draft",
    });
    expect(response.json()).not.toHaveProperty("success");
  });
});
