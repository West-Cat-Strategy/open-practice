import { describe, expect, it } from "vitest";
import {
  buildExternalUploadIntentPayload,
  buildExternalUploadPutHeaders,
  buildPublicExternalUploadCompletePath,
  buildPublicExternalUploadIntentPath,
  buildPublicExternalUploadPath,
  canRetryExternalUploadDocument,
  canUploadExternalDocument,
  describeExternalUploadDocumentStatus,
  describeExternalUploadCompletion,
  describeExternalUploadPutFailure,
  externalUploadAttentionItems,
  externalUploadLifecycleMessage,
  publicExternalUploadErrorMessage,
  remainingUploadCount,
  upsertPublicExternalUploadDocument,
  type PublicExternalUploadDocument,
  type PublicExternalUploadPayload,
} from "./runner-utils";

function payload(overrides: Partial<PublicExternalUploadPayload["upload"]> = {}) {
  return {
    upload: {
      id: "external-upload-001",
      status: "active",
      expiresAt: "2099-01-01T00:00:00.000Z",
      maxUploads: 2,
      usedUploads: 0,
      ...overrides,
    },
    acceptedClassifications: ["general", "privileged", "work_product", "financial", "identity"],
    documents: [],
  } satisfies PublicExternalUploadPayload;
}

function document(
  overrides: Partial<PublicExternalUploadDocument> = {},
): PublicExternalUploadDocument {
  return {
    id: "doc-001",
    title: "synthetic evidence.pdf",
    classification: "general",
    legalHold: false,
    uploadStatus: "verified",
    checksumStatus: "verified",
    scanStatus: "queued",
    reviewStatus: "pending_review",
    ...overrides,
  };
}

describe("public external upload runner helpers", () => {
  it("builds token-scoped paths without exposing token material elsewhere", () => {
    expect(buildPublicExternalUploadPath("token with / slash")).toBe(
      "/api/portal/external-uploads/token%20with%20%2F%20slash",
    );
    expect(buildPublicExternalUploadIntentPath("token")).toBe(
      "/api/portal/external-uploads/token/intents",
    );
    expect(buildPublicExternalUploadCompletePath("token", "document 001")).toBe(
      "/api/portal/external-uploads/token/documents/document%20001/complete",
    );
  });

  it("describes loading, active, denied, and exhausted states", () => {
    expect(externalUploadLifecycleMessage(null)).toBe("Loading upload link...");
    expect(externalUploadLifecycleMessage(payload())).toBe("Upload link ready. 2 uploads remain.");
    expect(externalUploadLifecycleMessage(payload({ usedUploads: 1 }))).toBe(
      "Upload link ready. 1 upload remains.",
    );
    expect(externalUploadLifecycleMessage(payload({ status: "exhausted", usedUploads: 2 }))).toBe(
      "This upload link has already been used.",
    );
    expect(externalUploadLifecycleMessage(payload({ status: "revoked" }))).toBe(
      "This upload link is revoked.",
    );
    expect(publicExternalUploadErrorMessage({}, "Upload link unavailable: 403")).toBe(
      "Upload link unavailable: 403",
    );
  });

  it("locks uploads when the public link is not active or has no remaining uses", () => {
    expect(canUploadExternalDocument(payload())).toBe(true);
    expect(remainingUploadCount(payload({ usedUploads: 3 }))).toBe(0);
    expect(canUploadExternalDocument(payload({ usedUploads: 2 }))).toBe(false);
    expect(canUploadExternalDocument(payload({ status: "exhausted", usedUploads: 1 }))).toBe(false);
    expect(
      canRetryExternalUploadDocument(payload(), document({ reviewStatus: "retry_requested" })),
    ).toBe(true);
    expect(
      canRetryExternalUploadDocument(
        payload({ status: "exhausted", usedUploads: 2 }),
        document({ reviewStatus: "retry_requested" }),
      ),
    ).toBe(false);
  });

  it("summarizes upload actions without exposing matter details", () => {
    expect(externalUploadAttentionItems(payload())).toEqual([
      {
        id: "external-upload-open",
        title: "Upload requested documents",
        detail: "2 uploads remain on this secure link.",
        status: "open",
      },
    ]);

    expect(
      externalUploadAttentionItems({
        ...payload({ usedUploads: 1 }),
        documents: [
          document({ id: "retry-doc", title: "blurry scan.pdf", reviewStatus: "retry_requested" }),
          document({
            id: "metadata-doc",
            title: "bank statement.pdf",
            reviewStatus: "needs_metadata",
          }),
        ],
      }),
    ).toEqual([
      {
        id: "external-upload-open",
        title: "Upload requested document",
        detail: "One upload remains on this secure link.",
        status: "open",
      },
      {
        id: "external-upload-retry-retry-doc",
        title: "Replace blurry scan.pdf",
        detail: "Staff requested a replacement upload for this document.",
        status: "retry",
        tone: "risk",
      },
      {
        id: "external-upload-metadata-metadata-doc",
        title: "Follow up on bank statement.pdf",
        detail: "Staff needs more information and will follow up outside this page.",
        status: "follow up",
        tone: "risk",
      },
    ]);
  });

  it("builds intent payloads and describes completion, review, or failed PUT states", () => {
    expect(
      buildExternalUploadIntentPayload({
        file: { name: "synthetic evidence.pdf", type: "application/pdf" },
        checksumSha256: "a".repeat(64),
        classification: "privileged",
        legalHold: true,
      }),
    ).toEqual({
      filename: "synthetic evidence.pdf",
      checksumSha256: "a".repeat(64),
      contentType: "application/pdf",
      classification: "privileged",
      legalHold: true,
    });
    expect(
      buildExternalUploadPutHeaders({
        file: { type: "text/plain" },
        requiredHeaders: {
          "x-amz-checksum-sha256": "signed-base64-checksum",
          "x-amz-meta-open-practice-upload-scope": "external-upload",
        },
      }),
    ).toEqual({
      "Content-Type": "text/plain",
      "x-amz-checksum-sha256": "signed-base64-checksum",
      "x-amz-meta-open-practice-upload-scope": "external-upload",
    });
    expect(describeExternalUploadPutFailure(500)).toBe("Upload failed: 500");
    expect(
      describeExternalUploadCompletion({
        id: "doc-001",
        title: "synthetic evidence.pdf",
        version: 1,
        classification: "privileged",
        legalHold: true,
        uploadStatus: "verified",
        checksumStatus: "verified",
        scanStatus: "queued",
        reviewStatus: "pending_review",
      }),
    ).toBe("Upload complete. The document is ready for staff review.");
    expect(describeExternalUploadDocumentStatus(document())).toEqual({
      label: "Awaiting review",
      detail: "Upload complete. Staff review is pending.",
      tone: "neutral",
    });
    expect(
      describeExternalUploadDocumentStatus(
        document({ reviewStatus: "accepted", reviewedAt: "2026-05-11T10:30:00.000Z" }),
      ),
    ).toMatchObject({ label: "Accepted", tone: "ready" });
    expect(
      describeExternalUploadDocumentStatus(document({ reviewStatus: "needs_metadata" })),
    ).toEqual({
      label: "Needs metadata",
      detail: "Staff needs more information and will follow up outside this page.",
      tone: "risk",
    });
    expect(
      describeExternalUploadDocumentStatus(document({ reviewStatus: "retry_requested" })),
    ).toEqual({
      label: "Retry requested",
      detail: "Please upload a clearer replacement if this link still accepts uploads.",
      tone: "risk",
    });
    expect(describeExternalUploadDocumentStatus(document({ reviewStatus: "discarded" }))).toEqual({
      label: "Not accepted",
      detail: "Staff did not accept this upload and may follow up separately.",
      tone: "risk",
    });
    expect(
      describeExternalUploadDocumentStatus(
        document({ uploadStatus: "rejected", checksumStatus: "mismatch" }),
      ),
    ).toEqual({
      label: "Upload check failed",
      detail:
        "The file could not be verified. Upload another copy if this link still accepts files.",
      tone: "risk",
    });
    expect(
      upsertPublicExternalUploadDocument([document()], document({ title: "Updated.pdf" })),
    ).toEqual([document({ title: "Updated.pdf" })]);
    expect(upsertPublicExternalUploadDocument([], document())).toEqual([document()]);
  });
});
