import { describe, expect, it } from "vitest";
import { buildDocumentReviewSuggestions } from "./document-suggestions.js";
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
        total: 5,
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
    expect(suggestions.summaryCounts.total).toBe(5);
  });
});
