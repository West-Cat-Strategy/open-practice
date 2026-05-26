import { describe, expect, it } from "vitest";
import type { DocumentRecord, PortalGrant, User } from "./models.js";
import { canAccess, canShareDocumentThroughPortal, redactJobMetadata } from "./permissions.js";

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

describe("matter creation permissions", () => {
  const licenseeWithoutMatters: User = {
    id: "user-licensee",
    firmId: "firm-west-legal",
    displayName: "Synthetic Licensee",
    email: "licensee@example.test",
    role: "licensee",
    assignedMatterIds: [],
    mfaEnabled: true,
  };

  it("allows authorized internal users to create the first matter without existing matter scope", () => {
    expect(
      canAccess({
        user: licenseeWithoutMatters,
        firmId: "firm-west-legal",
        resource: "matter",
        action: "create",
      }),
    ).toBe(true);
  });

  it("keeps matter create denied for roles without create access", () => {
    expect(
      canAccess({
        user: { ...licenseeWithoutMatters, role: "firm_member" },
        firmId: "firm-west-legal",
        resource: "matter",
        action: "create",
      }),
    ).toBe(false);
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

  it("allows async draft assist routing and length metadata without raw text", () => {
    expect(
      redactJobMetadata({
        draftAssistRecordId: "assist-001",
        draftId: "draft-001",
        documentId: "doc-001",
        sourceType: "draft",
        sourceTextLength: 42,
        instructionLength: 18,
        evidenceKeyCount: 2,
        provider: "fake-local-ai",
        providerModel: "fake-model",
        suggestedTextLength: 57,
        summaryLength: 16,
        generatedText: "Synthetic generated text",
        sourceText: "Synthetic source text",
        evidence: { private: "value" },
      }),
    ).toEqual({
      draftAssistRecordId: "assist-001",
      draftId: "draft-001",
      documentId: "doc-001",
      sourceType: "draft",
      sourceTextLength: 42,
      instructionLength: 18,
      evidenceKeyCount: 2,
      provider: "fake-local-ai",
      providerModel: "fake-model",
      suggestedTextLength: 57,
      summaryLength: 16,
    });
  });

  it("keeps async export safe counts while dropping export bodies", () => {
    expect(
      redactJobMetadata({
        exportKind: "billing",
        matterId: "matter-001",
        requestedByUserId: "user-admin",
        recordCount: 4,
        timeEntryCount: 1,
        expenseEntryCount: 1,
        invoiceCount: 1,
        paymentCount: 1,
        enqueueStatus: "queued_for_local_report_worker",
        narrative: "Synthetic private billing narrative",
        ledgerMemo: "Synthetic private ledger memo",
        recipientEmail: "client@example.test",
        exportBody: [{ private: "Synthetic export content" }],
      }),
    ).toEqual({
      matterId: "matter-001",
      requestedByUserId: "user-admin",
      recordCount: 4,
      timeEntryCount: 1,
      expenseEntryCount: 1,
      invoiceCount: 1,
      enqueueStatus: "queued_for_local_report_worker",
    });

    expect(
      redactJobMetadata({
        exportKind: "trust",
        recordCount: 7,
        trustTransferRequestCount: 1,
        ledgerAccountCount: 3,
        ledgerEntryCount: 2,
        balanceCount: 1,
        trustBalanceCount: 1,
        accountNames: ["Synthetic private account name"],
        ledgerEntries: [{ memo: "Synthetic private ledger memo" }],
      }),
    ).toEqual({
      recordCount: 7,
      trustTransferRequestCount: 1,
    });
  });

  it("keeps conversation export routing and counts while dropping message bodies", () => {
    expect(
      redactJobMetadata({
        reportType: "conversation_thread",
        reportScope: "matter",
        matterId: "matter-001",
        threadId: "thread-export-001",
        requestedByUserId: "user-admin",
        messageCount: 2,
        enqueueStatus: "queued_for_local_report_worker",
        bodyText: "Synthetic privileged message body",
        exportBody: [{ bodyText: "Synthetic export content" }],
        metadataValues: { privateNote: "Synthetic private note" },
      }),
    ).toEqual({
      reportType: "conversation_thread",
      reportScope: "matter",
      matterId: "matter-001",
      threadId: "thread-export-001",
      requestedByUserId: "user-admin",
      messageCount: 2,
      enqueueStatus: "queued_for_local_report_worker",
    });
  });
});
