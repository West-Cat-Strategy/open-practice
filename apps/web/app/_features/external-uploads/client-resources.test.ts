import { afterEach, describe, expect, it, vi } from "vitest";

import {
  requestExternalUploadDocumentReview,
  requestExternalUploadLinkCreation,
  requestExternalUploadLinkRevocation,
} from "./client-resources";

const headers = { "x-open-practice-user-id": "user-admin" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestPath(input: RequestInfo | URL): string {
  const url = new URL(input instanceof Request ? input.url : String(input));
  return `${url.pathname}${url.search}`;
}

function requestBody(init?: RequestInit): unknown {
  return JSON.parse(String(init?.body));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("external upload client resources", () => {
  it("creates upload links through the existing dashboard JSON client", async () => {
    const upload = {
      id: "external-upload-link-synthetic",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      requestedByUserId: "user-admin",
      expiresAt: "2026-05-01T16:30:00.000Z",
      maxUploads: 3,
      usedUploads: 0,
      createdAt: "2026-05-01T15:30:00.000Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      expect(requestPath(input)).toBe("/api/external-uploads");
      expect(init).toEqual(expect.objectContaining({ method: "POST", credentials: "include" }));
      const requestHeaders = new Headers(init?.headers);
      expect(requestHeaders.get("x-open-practice-user-id")).toBe("user-admin");
      expect(requestHeaders.get("content-type")).toBe("application/json");
      expect(requestBody(init)).toEqual({
        matterId: "matter-001",
        maxUploads: 3,
        expiresAt: new Date("2026-05-01T09:30").toISOString(),
      });
      return jsonResponse({ upload, token: "synthetic-token" });
    });

    await expect(
      requestExternalUploadLinkCreation({
        apiBaseUrl: "https://open-practice.local",
        headers,
        matterId: "matter-001",
        maxUploads: "3",
        expiresAtLocal: "2026-05-01T09:30",
      }),
    ).resolves.toEqual({ upload, token: "synthetic-token" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("revokes upload links without changing response-status handling", async () => {
    const upload = {
      id: "external/upload/001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      requestedByUserId: "user-admin",
      expiresAt: "2026-05-01T16:30:00.000Z",
      maxUploads: 1,
      usedUploads: 0,
      createdAt: "2026-05-01T15:30:00.000Z",
      revokedAt: "2026-05-01T15:45:00.000Z",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      expect(requestPath(input)).toBe("/api/external-uploads/external%2Fupload%2F001/revoke");
      expect(init).toEqual(expect.objectContaining({ method: "POST", credentials: "include" }));
      const requestHeaders = new Headers(init?.headers);
      expect(requestHeaders.get("x-open-practice-user-id")).toBe("user-admin");
      expect(requestHeaders.get("content-type")).toBe("application/json");
      return jsonResponse({ upload });
    });

    const response = await requestExternalUploadLinkRevocation({
      apiBaseUrl: "https://open-practice.local",
      headers,
      uploadId: "external/upload/001",
    });

    await expect(response.json()).resolves.toEqual({ upload });
  });

  it("reviews uploaded documents with the existing review payload shape", async () => {
    const reviewItem = {
      id: "external/document/001",
      matterId: "matter-001",
      title: "Synthetic pleading",
      version: 1,
      classification: "pleading",
      legalHold: false,
      uploadStatus: "verified",
      checksumStatus: "passed",
      scanStatus: "passed",
      reviewStatus: "needs_metadata",
      reviewDecision: "request_metadata",
      reviewMetadata: {},
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      expect(requestPath(input)).toBe(
        "/api/external-uploads/documents/external%2Fdocument%2F001/review",
      );
      expect(init).toEqual(expect.objectContaining({ method: "PATCH", credentials: "include" }));
      const requestHeaders = new Headers(init?.headers);
      expect(requestHeaders.get("x-open-practice-user-id")).toBe("user-admin");
      expect(requestHeaders.get("content-type")).toBe("application/json");
      expect(requestBody(init)).toEqual({
        decision: "request_metadata",
        reason: "missing_metadata",
        duplicateOfDocumentId: "document-duplicate-synthetic",
        note: "Needs signed page",
      });
      return jsonResponse({ reviewItem });
    });

    const response = await requestExternalUploadDocumentReview({
      apiBaseUrl: "https://open-practice.local",
      headers,
      documentId: "external/document/001",
      decision: "request_metadata",
      reason: "missing_metadata",
      duplicateOfDocumentId: "document-duplicate-synthetic",
      note: "  Needs signed page  ",
    });

    await expect(response.json()).resolves.toEqual({ reviewItem });
  });
});
