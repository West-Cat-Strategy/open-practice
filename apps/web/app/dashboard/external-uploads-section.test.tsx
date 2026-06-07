import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  ExternalUploadLinkRecord,
  ExternalUploadReviewItem,
} from "../_features/external-uploads/models";
import { ExternalUploadsSection } from "./external-uploads-section";

const syntheticUpload: ExternalUploadLinkRecord = {
  id: "external-upload-link-synthetic",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  requestedByUserId: "user_synthetic",
  expiresAt: "2035-06-06T18:00:00.000Z",
  maxUploads: 3,
  usedUploads: 1,
  createdAt: "2026-06-06T00:00:00.000Z",
};

const syntheticDocument: ExternalUploadReviewItem = {
  id: "external-upload-document-synthetic",
  matterId: "matter_synthetic",
  externalUploadLinkId: "external-upload-link-synthetic",
  title: "Synthetic uploaded lease",
  version: 1,
  classification: "general",
  legalHold: false,
  uploadStatus: "verified",
  checksumStatus: "verified",
  scanStatus: "passed",
  reviewStatus: "pending_review",
  reviewMetadata: {},
  uploadedAt: "2026-06-06T00:00:00.000Z",
  verifiedAt: "2026-06-06T00:01:00.000Z",
  accessLogProof: {
    total: 1,
    latestAt: "2026-06-06T00:01:00.000Z",
    outcomes: ["accepted"],
  },
};

function noop(): void {}

describe("ExternalUploadsSection", () => {
  it("renders external upload operations without changing copy or classes", () => {
    const html = renderToStaticMarkup(
      createElement(ExternalUploadsSection, {
        activeExternalUploadDocuments: [syntheticDocument],
        activeExternalUploads: [syntheticUpload],
        activeMatterNumber: "OP-2026-001",
        creatingExternalUpload: false,
        externalUploadCreateDisabled: false,
        externalUploadExpiresAt: "2035-06-06T10:00",
        externalUploadMaxUploads: "3",
        externalUploadReviewNotesByDocumentId: {},
        externalUploadReviewReasonsByDocumentId: {},
        externalUploadStatus: "No link created.",
        externalUploadStatusResponse: {
          status: "available",
          provider: "s3",
          reason: "configured",
        },
        externalUploadToken: "synthetic-upload-token",
        reviewingExternalUploadDocumentId: "",
        revokingExternalUploadId: "",
        onCreateExternalUploadLink: noop,
        onReviewExternalUploadDocument: noop,
        onRevokeExternalUploadLink: noop,
        onSetExternalUploadExpiresAt: noop,
        onSetExternalUploadMaxUploads: noop,
        onSetExternalUploadReviewNote: noop,
        onSetExternalUploadReviewReason: noop,
      }),
    );

    expect(html).toContain('class="detail-grid"');
    expect(html).toContain("Create status");
    expect(html).toContain("Provider");
    expect(html).toContain("Reason");
    expect(html).toContain("Active links");
    expect(html).toContain("Create link");
    expect(html).toContain("OP-2026-001");
    expect(html).toContain("One-time token");
    expect(html).toContain("External upload links");
    expect(html).toContain('class="party-row upload-link-row"');
    expect(html).toContain("external-upload-link-synthetic");
    expect(html).toContain("Uploaded document review");
    expect(html).toContain('class="party-row upload-review-row"');
    expect(html).toContain("Synthetic uploaded lease");
    expect(html).toContain("Review reason for Synthetic uploaded lease");
    expect(html).toContain("Private review note for Synthetic uploaded lease");
    expect(html).toContain("No link created.");
  });
});
