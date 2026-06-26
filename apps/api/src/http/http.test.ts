import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ApiAuthContext } from "../server.js";
import { requireAccess } from "./auth-guards.js";
import { isPublicRoute, redactPublicTokenUrl } from "./auth-helpers.js";
import {
  ApiHttpError,
  UNEXPECTED_API_ERROR_CODE,
  UNEXPECTED_API_ERROR_MESSAGE,
} from "./response.js";
import { parseRequestPart, validateRequestPart } from "./validation.js";

interface TestApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function successEnvelope<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

function errorEnvelope(code: string, message: string, details?: unknown): TestApiErrorEnvelope {
  return {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

function normalizeApiError(error: unknown): {
  statusCode: number;
  body: TestApiErrorEnvelope;
} {
  if (error instanceof ApiHttpError) {
    return {
      statusCode: error.statusCode,
      body: errorEnvelope(error.code, error.message, error.details),
    };
  }

  if (error instanceof Error) {
    const statusCode =
      "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    return {
      statusCode,
      body: errorEnvelope(UNEXPECTED_API_ERROR_CODE, UNEXPECTED_API_ERROR_MESSAGE),
    };
  }

  return {
    statusCode: 500,
    body: errorEnvelope("UNKNOWN_ERROR", "Unknown API error"),
  };
}

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

  it("redacts generic Error messages in normalized API envelopes", () => {
    const result = normalizeApiError(
      Object.assign(new Error("postgres://private.example.test leaked"), { statusCode: 500 }),
    );

    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({
      success: false,
      error: {
        code: UNEXPECTED_API_ERROR_CODE,
        message: UNEXPECTED_API_ERROR_MESSAGE,
      },
    });
    expect(JSON.stringify(result.body)).not.toContain("postgres://private.example.test");
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

  it("keeps public token routes outside the session-auth hook", () => {
    expect(isPublicRoute("GET", "/api/portal/shares")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/shares/token-001/email-verification")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/shares/email-verification")).toBe(true);
    expect(isPublicRoute("GET", "/api/portal/intake-forms")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/intake-forms/token-001/draft")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/intake-forms/draft")).toBe(true);
    expect(isPublicRoute("GET", "/api/portal/guest-sessions/token-001")).toBe(true);
    expect(isPublicRoute("GET", "/api/portal/guest-sessions")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/guest-sessions/token-001/check-in")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/guest-sessions/check-in")).toBe(true);
    expect(isPublicRoute("GET", "/api/portal/appointment-bookings/token-001")).toBe(true);
    expect(isPublicRoute("GET", "/api/portal/appointment-bookings")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/appointment-bookings/token-001/book")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/appointment-bookings/book")).toBe(true);
    expect(isPublicRoute("GET", "/api/public/appointment-booking/profile-001/slots")).toBe(true);
    expect(isPublicRoute("POST", "/api/public/appointment-booking/profile-001/bookings")).toBe(
      true,
    );
    expect(isPublicRoute("GET", "/api/portal/email-receipts/token-001")).toBe(true);
    expect(isPublicRoute("GET", "/api/portal/email-receipts")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/email-receipts/token-001")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/email-receipts")).toBe(true);
    expect(isPublicRoute("GET", "/api/portal/mail/receipts/token-001")).toBe(true);
    expect(isPublicRoute("GET", "/api/portal/mail/receipts")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/mail/receipts/token-001")).toBe(true);
    expect(isPublicRoute("POST", "/api/portal/mail/receipts")).toBe(true);
    expect(isPublicRoute("POST", "/api/inbound-email/provider-webhooks/mailgun/raw-mime")).toBe(
      true,
    );
    expect(isPublicRoute("POST", "/api/portal/mail/receipts/token-001/acknowledge")).toBe(false);
  });

  it("redacts public token path material before request logging", () => {
    expect(redactPublicTokenUrl("/api/portal/shares/raw-token/email-verification")).toBe(
      "/api/portal/shares/:token/email-verification",
    );
    expect(redactPublicTokenUrl("/api/portal/external-uploads/raw-token/intents")).toBe(
      "/api/portal/external-uploads/:token/intents",
    );
    expect(
      redactPublicTokenUrl(
        "/api/portal/intake-forms/raw-token/items/evidence/documents/document-001/complete",
      ),
    ).toBe("/api/portal/intake-forms/:token/items/evidence/documents/document-001/complete");
    expect(redactPublicTokenUrl("/api/portal/guest-sessions/raw-token/check-in")).toBe(
      "/api/portal/guest-sessions/:token/check-in",
    );
    expect(redactPublicTokenUrl("/api/portal/appointment-bookings/raw-token/book")).toBe(
      "/api/portal/appointment-bookings/:token/book",
    );
    expect(redactPublicTokenUrl("/api/portal/email-receipts/raw-token")).toBe(
      "/api/portal/email-receipts/:token",
    );
  });
});
