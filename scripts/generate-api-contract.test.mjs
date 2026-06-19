import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildOpenApiContract } from "./generate-api-contract.mjs";

describe("API contract inventory", () => {
  it("renders route authorization metadata as OpenAPI operations", () => {
    const contract = buildOpenApiContract({
      generatedAt: "2026-06-19T12:00:00Z",
      manifest: [
        {
          method: "GET",
          path: "/api/matters/:matterId",
          registrar: "registerMatterRoutes",
          testFile: "apps/api/src/routes/matters.test.ts",
          auth: {
            kind: "authenticated",
            resource: "matter",
            action: "read",
            matterScope: "required",
          },
        },
      ],
    });

    assert.equal(contract.openapi, "3.1.0");
    assert.deepEqual(contract.paths["/api/matters/{matterId}"].get.parameters, [
      {
        name: "matterId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    ]);
    assert.deepEqual(contract.paths["/api/matters/{matterId}"].get["x-open-practice-auth"], {
      kind: "authenticated",
      resource: "matter",
      action: "read",
      matterScope: "required",
    });
  });

  it("rejects duplicate route entries", () => {
    const route = {
      method: "GET",
      path: "/health",
      registrar: "serverHealth",
      testFile: "apps/api/src/server.test.ts",
      auth: { kind: "public" },
    };

    assert.throws(() => buildOpenApiContract({ manifest: [route, route] }), /Duplicate route/);
  });
});
