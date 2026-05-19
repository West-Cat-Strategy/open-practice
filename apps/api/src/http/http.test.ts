import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ApiAuthContext } from "../server.js";
import { requireAccess } from "./auth-guards.js";
import { isPublicRoute } from "./auth-helpers.js";
import { ApiHttpError, errorEnvelope, normalizeApiError, successEnvelope } from "./response.js";
import { parseRequestPart, validateRequestPart } from "./validation.js";

const context: ApiAuthContext = {
  firmId: "firm-west-legal",
  user: {
    id: "user-licensee",
    firmId: "firm-west-legal",
    displayName: "Avery Chen",
    email: "avery@example.test",
    role: "licensee",
    assignedMatterIds: ["matter-001"],
    mfaEnabled: true,
  },
};

describe("API HTTP helpers", () => {
  it("creates canonical success and error envelopes", () => {
    expect(successEnvelope({ id: "matter-001" })).toEqual({
      success: true,
      data: { id: "matter-001" },
    });
    expect(errorEnvelope("NOT_FOUND", "Matter not found")).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Matter not found" },
    });
  });

  it("normalizes ApiHttpError instances into error envelopes", () => {
    const result = normalizeApiError(
      new ApiHttpError(403, "MATTER_ACCESS_REQUIRED", "Matter access required", {
        matterId: "matter-002",
      }),
    );

    expect(result.statusCode).toBe(403);
    expect(result.body).toEqual({
      success: false,
      error: {
        code: "MATTER_ACCESS_REQUIRED",
        message: "Matter access required",
        details: { matterId: "matter-002" },
      },
    });
  });

  it("returns structured validation errors for request parts", () => {
    const schema = z.object({ matterId: z.string().min(1), minutes: z.number().int().positive() });
    const result = validateRequestPart(schema, { matterId: "", minutes: 0 }, "body");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
      });
      expect(result.error.details).toMatchObject({
        issues: expect.arrayContaining([
          { path: "matterId", message: expect.any(String) },
          { path: "minutes", message: expect.any(String) },
        ]),
      });
    }
  });

  it("parses valid request parts and throws on invalid values", () => {
    const schema = z.object({ id: z.string().min(1) });

    expect(parseRequestPart(schema, { id: "matter-001" }, "params")).toEqual({
      id: "matter-001",
    });
    expect(() => parseRequestPart(schema, { id: "" }, "params")).toThrow(ApiHttpError);
  });

  it("maps authorization checks into deterministic guard results", () => {
    expect(
      requireAccess(context, {
        resource: "matter",
        action: "read",
        matterId: "matter-001",
      }),
    ).toMatchObject({ ok: true });

    const denied = requireAccess(context, {
      resource: "audit_log",
      action: "export",
    });

    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error).toMatchObject({
        statusCode: 403,
        code: "AUDIT_LOG_ACCESS_REQUIRED",
        message: "Audit log access required",
      });
    }
  });

  it("keeps public token mutation routes outside the session-auth hook", () => {
    expect(isPublicRoute("POST", "/api/portal/shares/token-001/email-verification")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/intake-forms/token-001/draft")).toBe(true);
    expect(isPublicRoute("GET", "/api/portal/guest-sessions/token-001")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/guest-sessions/token-001/check-in")).toBe(true);
  });
});
