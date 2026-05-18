import { describe, expect, it } from "vitest";
import type { DocumentRecord, PortalGrant } from "./models.js";
import { canShareDocumentThroughPortal, redactJobMetadata } from "./permissions.js";

const baseDocument: DocumentRecord = {
  id: "doc-external-upload",
  firmId: "firm-west-legal",
  matterId: "matter-001",
  title: "External upload.pdf",
  storageKey: "external-uploads/link-001/doc-external-upload.pdf",
  checksumSha256: "a".repeat(64),
  version: 1,
  classification: "general",
  legalHold: false,
  uploadStatus: "verified",
  checksumStatus: "verified",
  scanStatus: "passed",
  reviewStatus: "not_required",
  reviewMetadata: {},
};

const grant: PortalGrant = {
  id: "grant-001",
  firmId: "firm-west-legal",
  matterId: "matter-001",
  contactId: "contact-client",
  grantedByUserId: "user-admin",
  permissions: ["view_documents"],
};

describe("portal document sharing permissions", () => {
  it("requires accepted review state before sharing external-upload documents", () => {
    expect(
      canShareDocumentThroughPortal({
        document: {
          ...baseDocument,
          externalUploadLinkId: "link-001",
          reviewStatus: "pending_review",
        },
        grant,
      }),
    ).toBe(false);

    expect(
      canShareDocumentThroughPortal({
        document: { ...baseDocument, externalUploadLinkId: "link-001", reviewStatus: "accepted" },
        grant,
      }),
    ).toBe(true);
  });

  it("allows accepted external-upload duplicates without treating pending duplicates as shareable", () => {
    expect(
      canShareDocumentThroughPortal({
        document: {
          ...baseDocument,
          checksumStatus: "duplicate",
          duplicateOfDocumentId: "doc-existing",
          externalUploadLinkId: "link-001",
          reviewStatus: "pending_review",
        },
        grant,
      }),
    ).toBe(false);

    expect(
      canShareDocumentThroughPortal({
        document: {
          ...baseDocument,
          checksumStatus: "duplicate",
          duplicateOfDocumentId: "doc-existing",
          externalUploadLinkId: "link-001",
          reviewStatus: "accepted",
        },
        grant,
      }),
    ).toBe(true);
  });
});

describe("job metadata redaction", () => {
  it("keeps connector delivery retry counts while dropping raw delivery identifiers and payloads", () => {
    expect(
      redactJobMetadata({
        resourceType: "connector_outbox",
        resourceId: "connector-outbox-001",
        eventCount: 1,
        failedCount: 1,
        deadLetterCount: 0,
        retryScheduledCount: 1,
        retryScheduleFailedCount: 0,
        nextRetryAt: "2026-05-12T12:05:00.000Z",
        connectorId: "connector-private",
        failedIds: ["connector-outbox-001"],
        rawBody: "Synthetic connector body must not be exposed",
        token: "synthetic-token",
      }),
    ).toEqual({
      resourceType: "connector_outbox",
      resourceId: "connector-outbox-001",
      eventCount: 1,
      failedCount: 1,
      deadLetterCount: 0,
      retryScheduledCount: 1,
      retryScheduleFailedCount: 0,
      nextRetryAt: "2026-05-12T12:05:00.000Z",
    });
  });
});
