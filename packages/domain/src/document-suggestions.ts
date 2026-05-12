import type {
  Contact,
  DocumentClassification,
  DocumentRecord,
  Matter,
  MatterParty,
} from "./models.js";
import type { DocumentTextExtractionRecord } from "./operations.js";

export type DocumentReviewSuggestionGroup =
  | "classification"
  | "duplicate_or_supersession"
  | "matter_contact"
  | "missing_metadata";

export interface DocumentReviewSuggestionCue {
  id: string;
  group: DocumentReviewSuggestionGroup;
  label: string;
  detail?: string;
  tone: "neutral" | "ready" | "risk";
  documentId?: string;
  relatedDocumentId?: string;
  classification?: DocumentClassification;
  confidence?: number;
  status?: string;
  role?: string;
  contactId?: string;
  contactName?: string;
  metadataKeys?: string[];
}

export interface DocumentReviewSuggestions {
  reviewerOnly: true;
  mutating: false;
  summaryCounts: Record<DocumentReviewSuggestionGroup | "total", number>;
  groups: Record<DocumentReviewSuggestionGroup, DocumentReviewSuggestionCue[]>;
}

type MatterWithParties = Pick<
  Matter,
  "id" | "number" | "title" | "practiceArea" | "jurisdiction"
> & {
  parties?: Array<MatterParty & { contact?: Pick<Contact, "id" | "kind" | "displayName"> }>;
};

const suggestionGroups: DocumentReviewSuggestionGroup[] = [
  "classification",
  "duplicate_or_supersession",
  "matter_contact",
  "missing_metadata",
];

const classificationValues = new Set<DocumentClassification>([
  "general",
  "privileged",
  "work_product",
  "financial",
  "identity",
]);

const classificationMetadataKeys = [
  "classification",
  "suggestedClassification",
  "documentClassification",
  "classificationConfidence",
  "confidence",
] as const;

function emptyGroups(): Record<DocumentReviewSuggestionGroup, DocumentReviewSuggestionCue[]> {
  return {
    classification: [],
    duplicate_or_supersession: [],
    matter_contact: [],
    missing_metadata: [],
  };
}

function metadataClassification(metadata: Record<string, unknown>): {
  classification?: DocumentClassification;
  confidence?: number;
  keys: string[];
} {
  const keys = classificationMetadataKeys.filter((key) => metadata[key] !== undefined);
  const rawClassification =
    metadata.suggestedClassification ?? metadata.documentClassification ?? metadata.classification;
  const classification =
    typeof rawClassification === "string" &&
    classificationValues.has(rawClassification as DocumentClassification)
      ? (rawClassification as DocumentClassification)
      : undefined;
  const rawConfidence = metadata.classificationConfidence ?? metadata.confidence;
  const confidence = typeof rawConfidence === "number" ? rawConfidence : undefined;
  return { classification, confidence, keys };
}

function latestRelatedDocument(
  documents: DocumentRecord[],
  documentId: string | undefined,
): DocumentRecord | undefined {
  if (!documentId) return undefined;
  return documents.find((document) => document.id === documentId);
}

function addMissingMetadataCue(
  cues: DocumentReviewSuggestionCue[],
  document: DocumentRecord,
  id: string,
  label: string,
  detail?: string,
): void {
  cues.push({
    id,
    group: "missing_metadata",
    label,
    detail,
    tone: "risk",
    documentId: document.id,
  });
}

export function buildDocumentReviewSuggestions(input: {
  document: DocumentRecord;
  sameMatterDocuments: DocumentRecord[];
  latestExtraction?: DocumentTextExtractionRecord;
  matter?: MatterWithParties;
}): DocumentReviewSuggestions {
  const groups = emptyGroups();
  const { document, latestExtraction } = input;

  if (latestExtraction?.status === "completed") {
    const metadata = metadataClassification(latestExtraction.metadata);
    if (metadata.classification || metadata.keys.length > 0) {
      groups.classification.push({
        id: `${document.id}:classification`,
        group: "classification",
        label: metadata.classification
          ? `Extraction suggests ${metadata.classification.replaceAll("_", " ")}`
          : "Extraction includes classification metadata",
        detail:
          metadata.classification && metadata.classification !== document.classification
            ? `Current classification is ${document.classification.replaceAll("_", " ")}.`
            : "Review before changing any document metadata.",
        tone:
          metadata.classification && metadata.classification !== document.classification
            ? "risk"
            : "neutral",
        documentId: document.id,
        classification: metadata.classification,
        confidence: metadata.confidence,
        status: latestExtraction.status,
        metadataKeys: metadata.keys,
      });
    }
  }

  const duplicate = latestRelatedDocument(
    input.sameMatterDocuments,
    document.duplicateOfDocumentId,
  );
  if (document.duplicateOfDocumentId) {
    groups.duplicate_or_supersession.push({
      id: `${document.id}:duplicate`,
      group: "duplicate_or_supersession",
      label: "Possible duplicate",
      detail: duplicate
        ? `Matches ${duplicate.title} (${duplicate.classification.replaceAll("_", " ")}).`
        : "Matches a document outside this workbench projection.",
      tone: "risk",
      documentId: document.id,
      relatedDocumentId: document.duplicateOfDocumentId,
      classification: duplicate?.classification,
    });
  }

  const superseded = latestRelatedDocument(
    input.sameMatterDocuments,
    document.supersedesDocumentId,
  );
  if (document.supersedesDocumentId) {
    groups.duplicate_or_supersession.push({
      id: `${document.id}:supersedes`,
      group: "duplicate_or_supersession",
      label: "Supersession candidate",
      detail: superseded
        ? `May replace ${superseded.title}.`
        : "References a prior document not included in this workbench projection.",
      tone: "neutral",
      documentId: document.id,
      relatedDocumentId: document.supersedesDocumentId,
      classification: superseded?.classification,
    });
  }

  const superseding = input.sameMatterDocuments.find(
    (candidate) => candidate.supersedesDocumentId === document.id,
  );
  if (document.supersededAt || superseding) {
    groups.duplicate_or_supersession.push({
      id: `${document.id}:superseded-by`,
      group: "duplicate_or_supersession",
      label: "Superseded document",
      detail: superseding
        ? `A newer same-matter document references ${document.title}.`
        : "Document has a superseded timestamp.",
      tone: "neutral",
      documentId: document.id,
      relatedDocumentId: superseding?.id,
      classification: superseding?.classification,
      status: document.supersededAt ? "superseded" : undefined,
    });
  }

  if (input.matter) {
    groups.matter_contact.push({
      id: `${document.id}:matter`,
      group: "matter_contact",
      label: `Matter ${input.matter.number}`,
      detail: `${input.matter.title} · ${input.matter.practiceArea} · ${input.matter.jurisdiction}`,
      tone: "neutral",
      documentId: document.id,
    });
    for (const party of input.matter.parties ?? []) {
      groups.matter_contact.push({
        id: `${document.id}:contact:${party.id}`,
        group: "matter_contact",
        label: party.contact?.displayName ?? "Matter contact",
        detail: party.adverse ? "Adverse party cue" : "Matter party cue",
        tone: party.adverse ? "risk" : "neutral",
        documentId: document.id,
        role: party.role,
        contactId: party.contactId,
        contactName: party.contact?.displayName,
      });
    }
  }

  if (document.reviewStatus === "needs_metadata" || document.reviewReason === "missing_metadata") {
    addMissingMetadataCue(
      groups.missing_metadata,
      document,
      `${document.id}:review-metadata`,
      "Reviewer requested metadata",
      document.reviewReason
        ? `Review reason is ${document.reviewReason.replaceAll("_", " ")}.`
        : undefined,
    );
  }
  if (!document.uploadedAt) {
    addMissingMetadataCue(
      groups.missing_metadata,
      document,
      `${document.id}:uploaded-at`,
      "Missing upload timestamp",
    );
  }
  if (document.uploadStatus === "verified" && !document.verifiedAt) {
    addMissingMetadataCue(
      groups.missing_metadata,
      document,
      `${document.id}:verified-at`,
      "Missing verification timestamp",
    );
  }
  if (!latestExtraction) {
    addMissingMetadataCue(
      groups.missing_metadata,
      document,
      `${document.id}:extraction`,
      "No extraction summary",
      "Queue OCR or review source metadata before relying on suggestions.",
    );
  } else {
    if (!latestExtraction.language) {
      addMissingMetadataCue(
        groups.missing_metadata,
        document,
        `${document.id}:language`,
        "Missing extraction language",
      );
    }
    if (latestExtraction.status === "failed") {
      addMissingMetadataCue(
        groups.missing_metadata,
        document,
        `${document.id}:extraction-failed`,
        "Extraction failed",
      );
    }
    if (typeof latestExtraction.confidence === "number" && latestExtraction.confidence < 0.75) {
      addMissingMetadataCue(
        groups.missing_metadata,
        document,
        `${document.id}:low-confidence`,
        "Low extraction confidence",
        `${Math.round(latestExtraction.confidence * 100)}% confidence.`,
      );
    }
  }

  const summaryCounts = Object.fromEntries(
    suggestionGroups.map((group) => [group, groups[group].length]),
  ) as Record<DocumentReviewSuggestionGroup, number>;
  return {
    reviewerOnly: true,
    mutating: false,
    summaryCounts: {
      ...summaryCounts,
      total: suggestionGroups.reduce((total, group) => total + groups[group].length, 0),
    },
    groups,
  };
}
