import { describe, expect, it } from "vitest";
import {
  buildDocumentRetentionHoldReview,
  buildDocumentMetadataSearchPosture,
  buildDocumentMetadataTags,
  buildDocumentReviewSuggestions,
} from "./document-suggestions.js";
import type { DocumentRecord, Matter } from "./models.js";
import type { DocumentTextExtractionRecord } from "./operations.js";

const baseDocument: DocumentRecord = {
  id: "doc-001",
  firmId: "firm-west-legal",
  matterId: "matter-001",
  title: "Residential tenancy evidence",
  storageKey: "matters/matter-001/doc-001.pdf",
  checksumSha256: "a".repeat(64),
  version: 1,
  classification: "general",
  legalHold: false,
  uploadStatus: "verified",
  checksumStatus: "verified",
  scanStatus: "passed",
  reviewStatus: "not_required",
  reviewMetadata: {},
  uploadedAt: "2026-05-01T10:00:00.000Z",
  verifiedAt: "2026-05-01T10:01:00.000Z",
};

function extraction(
  overrides: Partial<DocumentTextExtractionRecord> = {},
): DocumentTextExtractionRecord {
  return {
    id: "extraction-001",
    firmId: "firm-west-legal",
    documentId: "doc-001",
    engine: "tesseract",
    status: "completed",
    language: "eng",
    confidence: 0.92,
    extractedText: "Private extracted text must not enter suggestions.",
    textStorageKey: "matters/matter-001/doc-001.txt",
    metadata: {
      suggestedClassification: "financial",
      classificationConfidence: 0.84,
      storageKey: "private/storage/key",
      providerPayload: { raw: true },
      arbitraryPrivateNote: "do not expose",
    },
    createdAt: "2026-05-01T10:02:00.000Z",
    completedAt: "2026-05-01T10:03:00.000Z",
    ...overrides,
  };
}

function matter(overrides: Partial<Matter> = {}): Matter {
  return {
    id: "matter-001",
    firmId: "firm-west-legal",
    number: "2026-0001",
    title: "Morgan tenancy dispute",
    practiceArea: "Residential tenancy",
    status: "open",
    jurisdiction: "BC",
    responsibleUserId: "user-licensee",
    ...overrides,
  };
}

describe("document review suggestions", () => {
  it("builds reviewer-only non-mutating cues without raw extraction metadata", () => {
    const suggestions = buildDocumentReviewSuggestions({
      document: {
        ...baseDocument,
        duplicateOfDocumentId: "doc-duplicate",
        supersedesDocumentId: "doc-old",
      },
      sameMatterDocuments: [
        baseDocument,
        {
          ...baseDocument,
          id: "doc-duplicate",
          title: "Earlier evidence",
          classification: "privileged",
        },
        { ...baseDocument, id: "doc-old", title: "Old evidence" },
      ],
      latestExtraction: extraction(),
      matter: {
        ...matter(),
        parties: [
          {
            id: "party-client",
            firmId: "firm-west-legal",
            matterId: "matter-001",
            contactId: "contact-client",
            role: "client",
            adverse: false,
            confidential: true,
            contact: {
              id: "contact-client",
              kind: "person",
              displayName: "Synthetic Client",
            },
          },
        ],
      },
    });

    expect(suggestions).toMatchObject({
      reviewerOnly: true,
      mutating: false,
      summaryCounts: {
        classification: 1,
        duplicate_or_supersession: 2,
        matter_contact: 2,
        missing_metadata: 0,
        retention_review: 1,
        total: 6,
      },
    });
    expect(suggestions.groups.classification[0]).toMatchObject({
      classification: "financial",
      confidence: 0.84,
      metadataKeys: ["suggestedClassification", "classificationConfidence"],
    });
    expect(suggestions.groups.duplicate_or_supersession).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relatedDocumentId: "doc-duplicate" }),
        expect.objectContaining({ relatedDocumentId: "doc-old" }),
      ]),
    );
    expect(suggestions.groups.matter_contact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Matter 2026-0001" }),
        expect.objectContaining({ contactId: "contact-client", role: "client" }),
      ]),
    );
    expect(suggestions.groups.retention_review).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Supersession review",
          relatedDocumentId: "doc-old",
        }),
      ]),
    );
    expect(JSON.stringify(suggestions)).not.toContain("Private extracted text");
    expect(JSON.stringify(suggestions)).not.toContain("storage/key");
    expect(JSON.stringify(suggestions)).not.toContain("providerPayload");
    expect(JSON.stringify(suggestions)).not.toContain("arbitraryPrivateNote");
  });

  it("flags missing metadata and low-confidence extraction states", () => {
    const suggestions = buildDocumentReviewSuggestions({
      document: {
        ...baseDocument,
        reviewStatus: "needs_metadata",
        reviewReason: "missing_metadata",
        uploadedAt: undefined,
        verifiedAt: undefined,
      },
      sameMatterDocuments: [baseDocument],
      latestExtraction: extraction({
        language: "",
        confidence: 0.42,
        metadata: {},
      }),
    });

    expect(suggestions.groups.missing_metadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Reviewer requested metadata" }),
        expect.objectContaining({ label: "Missing upload timestamp" }),
        expect.objectContaining({ label: "Missing verification timestamp" }),
        expect.objectContaining({ label: "Missing extraction language" }),
        expect.objectContaining({ label: "Low extraction confidence" }),
      ]),
    );
    expect(suggestions.summaryCounts.missing_metadata).toBe(5);
    expect(suggestions.summaryCounts.retention_review).toBe(1);
    expect(suggestions.summaryCounts.total).toBe(6);
  });

  it("adds read-only retention-review cues from hold, supersession, upload, and review state", () => {
    const supersedingDocument: DocumentRecord = {
      ...baseDocument,
      id: "doc-new",
      title: "Updated tenancy evidence",
      supersedesDocumentId: "doc-old",
    };
    const suggestions = buildDocumentReviewSuggestions({
      document: {
        ...baseDocument,
        id: "doc-old",
        title: "Prior tenancy evidence",
        legalHold: true,
        uploadStatus: "uploaded",
        checksumStatus: "pending",
        scanStatus: "queued",
        reviewStatus: "pending_review",
        reviewReason: "missing_metadata",
        externalUploadLinkId: "external-upload-link-001",
        supersededAt: "2026-05-02T12:00:00.000Z",
      },
      sameMatterDocuments: [
        {
          ...baseDocument,
          id: "doc-old",
          title: "Prior tenancy evidence",
          legalHold: true,
          uploadStatus: "uploaded",
          checksumStatus: "pending",
          scanStatus: "queued",
          reviewStatus: "pending_review",
          supersededAt: "2026-05-02T12:00:00.000Z",
        },
        supersedingDocument,
      ],
      latestExtraction: extraction({ metadata: {} }),
    });

    expect(suggestions).toMatchObject({
      reviewerOnly: true,
      mutating: false,
      summaryCounts: {
        duplicate_or_supersession: 1,
        missing_metadata: 1,
        retention_review: 6,
        total: 8,
      },
    });
    expect(suggestions.groups.retention_review).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Legal hold active", tone: "risk" }),
        expect.objectContaining({
          label: "Superseded record review",
          tone: "neutral",
          relatedDocumentId: "doc-new",
        }),
        expect.objectContaining({ label: "Upload state review" }),
        expect.objectContaining({ label: "Checksum state review" }),
        expect.objectContaining({ label: "Scan state review" }),
        expect.objectContaining({
          label: "External upload review",
          detail:
            "External upload review status is pending review. Review reason is missing metadata.",
        }),
      ]),
    );
    expect(JSON.stringify(suggestions)).not.toContain("external-upload-link-001");
    expect(JSON.stringify(suggestions)).not.toContain("Private extracted text");
  });

  it("derives bounded retention and hold posture from cues and recorded metadata", () => {
    const document: DocumentRecord = {
      ...baseDocument,
      legalHold: true,
      reviewMetadata: {
        source: "external_upload_review",
        note: "Synthetic private note should not be serialized.",
        storageKey: "matters/matter-001/private.pdf",
        retentionHoldReview: {
          decision: "ready_for_reviewer_packet",
          reason: "legal_hold",
          reviewAfter: "2026-07-01T00:00:00.000Z",
          minimumRetainThrough: "2026-08-01T00:00:00.000Z",
          recordedByUserId: "user-licensee",
          recordedAt: "2026-06-20T10:00:00.000Z",
          sourceCueCounts: {
            classification: 0,
            duplicate_or_supersession: 0,
            matter_contact: 0,
            missing_metadata: 0,
            retention_review: 1,
            total: 1,
          },
        },
      },
    };
    const suggestions = buildDocumentReviewSuggestions({
      document,
      sameMatterDocuments: [document],
      latestExtraction: extraction({ metadata: {} }),
    });
    const posture = buildDocumentRetentionHoldReview({ document, reviewSuggestions: suggestions });

    expect(posture).toMatchObject({
      reviewerOnly: true,
      mutating: false,
      destructiveAction: false,
      retentionDeadlineEnforced: false,
      legalHoldOverride: false,
      retainedExportBody: false,
      status: "blocked_by_hold",
      blockers: ["legal_hold"],
      dispositionMetadata: {
        candidateState: "blocked_by_hold",
        readyForReviewerPacket: false,
        blockerCounts: { total: 1, legalHold: 1, uploadIntegrity: 0, reviewState: 0 },
        sourceCueCounts: { retention_review: 1, total: 1 },
        reviewAfter: "2026-07-01T00:00:00.000Z",
        minimumRetainThrough: "2026-08-01T00:00:00.000Z",
        destructiveAction: false,
        objectDeletion: false,
        retentionDeadlineEnforced: false,
        legalHoldReleaseCommand: false,
        retainedExportBody: false,
        rawPayloadRetention: false,
        complianceClaim: false,
      },
      latestDecision: {
        decision: "ready_for_reviewer_packet",
        reason: "legal_hold",
        recordedByUserId: "user-licensee",
        sourceCueCounts: { retention_review: 1, total: 1 },
      },
    });
    expect(JSON.stringify(posture)).not.toContain("Synthetic private");
    expect(JSON.stringify(posture)).not.toContain("storageKey");
    expect(JSON.stringify(posture)).not.toContain("private.pdf");
  });

  it("derives non-destructive disposition candidate states from reviewer metadata", () => {
    const decisionMetadata = {
      reason: "practice_review" as const,
      recordedByUserId: "user-licensee",
      recordedAt: "2026-06-20T10:00:00.000Z",
      sourceCueCounts: {
        classification: 0,
        duplicate_or_supersession: 0,
        matter_contact: 0,
        missing_metadata: 0,
        retention_review: 0,
        total: 0,
      },
    };
    const decisions = [
      {
        decision: "ready_for_reviewer_packet" as const,
        candidateState: "ready_for_reviewer_packet",
        readyForReviewerPacket: true,
      },
      {
        decision: "reviewed_keep" as const,
        candidateState: "reviewed_keep",
        readyForReviewerPacket: false,
      },
      {
        decision: "reviewed_superseded" as const,
        candidateState: "reviewed_superseded",
        readyForReviewerPacket: false,
      },
    ];

    for (const decision of decisions) {
      const posture = buildDocumentRetentionHoldReview({
        document: {
          ...baseDocument,
          reviewMetadata: {
            privateReviewerNote: "Synthetic disposition note must stay private.",
            providerPayload: { private: true },
            retentionHoldReview: {
              ...decisionMetadata,
              decision: decision.decision,
              reviewAfter: "2026-07-01T00:00:00.000Z",
              minimumRetainThrough: "2026-08-01T00:00:00.000Z",
            },
          },
        },
        reviewSuggestions: buildDocumentReviewSuggestions({
          document: baseDocument,
          sameMatterDocuments: [baseDocument],
        }),
      });

      expect(posture.dispositionMetadata).toMatchObject({
        candidateState: decision.candidateState,
        readyForReviewerPacket: decision.readyForReviewerPacket,
        blockerCounts: { total: 0, legalHold: 0, uploadIntegrity: 0, reviewState: 0 },
        reviewAfter: "2026-07-01T00:00:00.000Z",
        minimumRetainThrough: "2026-08-01T00:00:00.000Z",
        destructiveAction: false,
        objectDeletion: false,
        retentionDeadlineEnforced: false,
        legalHoldReleaseCommand: false,
        retainedExportBody: false,
        rawPayloadRetention: false,
        complianceClaim: false,
      });
      expect(JSON.stringify(posture.dispositionMetadata)).not.toContain("Synthetic disposition");
      expect(JSON.stringify(posture.dispositionMetadata)).not.toContain("providerPayload");
    }

    const noDecision = buildDocumentRetentionHoldReview({
      document: baseDocument,
      reviewSuggestions: buildDocumentReviewSuggestions({
        document: baseDocument,
        sameMatterDocuments: [baseDocument],
      }),
    });
    expect(noDecision.dispositionMetadata).toMatchObject({
      candidateState: "not_ready",
      readyForReviewerPacket: false,
      blockerCounts: { total: 0, legalHold: 0, uploadIntegrity: 0, reviewState: 0 },
      destructiveAction: false,
      objectDeletion: false,
      retentionDeadlineEnforced: false,
      legalHoldReleaseCommand: false,
      retainedExportBody: false,
      rawPayloadRetention: false,
      complianceClaim: false,
    });
  });

  it("builds metadata-only tags and search summaries without OCR body text", () => {
    const latestExtraction = extraction();
    const suggestions = buildDocumentReviewSuggestions({
      document: baseDocument,
      sameMatterDocuments: [baseDocument],
      latestExtraction,
      matter: matter(),
    });
    const metadataTags = buildDocumentMetadataTags({
      document: baseDocument,
      latestExtraction,
      latestJobStatus: "completed",
      reviewSuggestions: suggestions,
    });
    const search = buildDocumentMetadataSearchPosture({
      entries: [
        {
          document: baseDocument,
          latestExtraction,
          latestJobStatus: "completed",
          reviewSuggestions: suggestions,
          metadataTags,
        },
      ],
      filters: { q: "financial", tag: "ocr:completed" },
    });

    expect(metadataTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "classification:general" }),
        expect.objectContaining({ key: "ocr:completed" }),
        expect.objectContaining({ key: "ocr_language:eng" }),
        expect.objectContaining({ key: "ocr_confidence:high" }),
        expect.objectContaining({ key: "cue:classification" }),
      ]),
    );
    expect(search).toMatchObject({
      reviewOnly: true,
      mutating: false,
      filters: { q: "financial", tag: "ocr:completed" },
      totalCount: 1,
      matchedCount: 1,
      ocrPosture: {
        rawTextSearch: false,
        rawTextReturned: false,
        statusCounts: { completed: 1 },
      },
      results: [
        expect.objectContaining({
          documentId: "doc-001",
          title: "Residential tenancy evidence",
          ocrStatus: "completed",
          matchedFields: expect.arrayContaining(["Metadata tag", "Reviewer cue"]),
          cueCounts: expect.objectContaining({ classification: 1, total: 2 }),
        }),
      ],
    });
    expect(JSON.stringify(search)).not.toContain("Private extracted text");
    expect(JSON.stringify(search)).not.toContain("textStorageKey");
    expect(JSON.stringify(search)).not.toContain("storage/key");
    expect(JSON.stringify(search)).not.toContain("providerPayload");
    expect(JSON.stringify(search)).not.toContain("arbitraryPrivateNote");
  });

  it("does not treat raw OCR text or arbitrary metadata as searchable posture", () => {
    const latestExtraction = extraction({
      metadata: {
        suggestedClassification: "financial",
        privateSearchNeedle: "needle-only-in-private-metadata",
      },
    });
    const suggestions = buildDocumentReviewSuggestions({
      document: baseDocument,
      sameMatterDocuments: [baseDocument],
      latestExtraction,
    });

    const rawTextSearch = buildDocumentMetadataSearchPosture({
      entries: [{ document: baseDocument, latestExtraction, reviewSuggestions: suggestions }],
      filters: { q: "private extracted text" },
    });
    const privateMetadataSearch = buildDocumentMetadataSearchPosture({
      entries: [{ document: baseDocument, latestExtraction, reviewSuggestions: suggestions }],
      filters: { q: "needle-only-in-private-metadata" },
    });
    const safeTagSearch = buildDocumentMetadataSearchPosture({
      entries: [{ document: baseDocument, latestExtraction, reviewSuggestions: suggestions }],
      filters: { classification: "general", reviewStatus: "not_required", scanStatus: "passed" },
    });

    expect(rawTextSearch.matchedCount).toBe(0);
    expect(privateMetadataSearch.matchedCount).toBe(0);
    expect(safeTagSearch.matchedCount).toBe(1);
    expect(safeTagSearch.results[0]?.matchedFields).toEqual([
      "Classification",
      "Review status",
      "Scan status",
    ]);
  });
});
