import type {
  Contact,
  DocumentClassification,
  DocumentRecord,
  DocumentScanStatus,
  DocumentUploadReviewStatus,
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

export type DocumentMetadataTagGroup =
  | "classification"
  | "review_status"
  | "scan_status"
  | "legal_hold"
  | "ocr"
  | "reviewer_cue";

export type DocumentMetadataOcrStatus = "not_available" | "queued" | "completed" | "failed";

export interface DocumentMetadataTag {
  key: string;
  label: string;
  value: string;
  group: DocumentMetadataTagGroup;
  tone: "neutral" | "ready" | "risk";
  count?: number;
}

export interface DocumentMetadataSearchFilters {
  q?: string;
  classification?: DocumentClassification;
  reviewStatus?: DocumentUploadReviewStatus;
  scanStatus?: DocumentScanStatus;
  ocrStatus?: DocumentMetadataOcrStatus;
  cueGroup?: DocumentReviewSuggestionGroup;
  tag?: string;
}

export type DocumentMetadataSearchDocument = Pick<
  DocumentRecord,
  | "id"
  | "matterId"
  | "title"
  | "version"
  | "classification"
  | "legalHold"
  | "uploadStatus"
  | "checksumStatus"
  | "scanStatus"
  | "reviewStatus"
  | "reviewDecision"
  | "reviewReason"
  | "reviewedAt"
  | "duplicateOfDocumentId"
  | "uploadedAt"
  | "verifiedAt"
>;

export interface DocumentMetadataSearchEntry {
  document: DocumentMetadataSearchDocument;
  latestExtraction?: DocumentTextExtractionRecord;
  latestJobStatus?: string;
  reviewSuggestions?: DocumentReviewSuggestions;
  metadataTags?: DocumentMetadataTag[];
}

export interface DocumentMetadataSearchResultSummary {
  documentId: string;
  title: string;
  matterId: string;
  classification: DocumentClassification;
  reviewStatus: DocumentUploadReviewStatus;
  scanStatus: DocumentScanStatus;
  legalHold: boolean;
  ocrStatus: DocumentMetadataOcrStatus;
  tagKeys: string[];
  matchedFields: string[];
  cueCounts: Record<DocumentReviewSuggestionGroup | "total", number>;
}

export interface DocumentMetadataSearchPosture {
  reviewOnly: true;
  mutating: false;
  filters: DocumentMetadataSearchFilters;
  totalCount: number;
  matchedCount: number;
  tags: DocumentMetadataTag[];
  ocrPosture: {
    rawTextSearch: false;
    rawTextReturned: false;
    searchableFields: string[];
    statusCounts: Record<DocumentMetadataOcrStatus, number>;
  };
  results: DocumentMetadataSearchResultSummary[];
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

function formatMetadataValue(value: string): string {
  return value.replaceAll("_", " ");
}

function normalizeSearch(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

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

function documentOcrStatus(input: {
  latestExtraction?: DocumentTextExtractionRecord;
  latestJobStatus?: string;
}): DocumentMetadataOcrStatus {
  if (input.latestExtraction?.status === "completed") return "completed";
  if (input.latestExtraction?.status === "failed") return "failed";
  if (input.latestExtraction?.status === "queued") return "queued";
  if (input.latestJobStatus === "queued" || input.latestJobStatus === "active") return "queued";
  if (input.latestJobStatus === "failed" || input.latestJobStatus === "dead_letter") {
    return "failed";
  }
  return "not_available";
}

function confidenceBucket(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.75) return "medium";
  return "low";
}

function pushMetadataTag(tags: DocumentMetadataTag[], tag: DocumentMetadataTag): void {
  if (tags.some((candidate) => candidate.key === tag.key)) return;
  tags.push(tag);
}

function emptyCueCounts(): Record<DocumentReviewSuggestionGroup | "total", number> {
  return {
    classification: 0,
    duplicate_or_supersession: 0,
    matter_contact: 0,
    missing_metadata: 0,
    total: 0,
  };
}

export function buildDocumentMetadataTags(input: {
  document: DocumentMetadataSearchDocument;
  latestExtraction?: DocumentTextExtractionRecord;
  latestJobStatus?: string;
  reviewSuggestions?: DocumentReviewSuggestions;
}): DocumentMetadataTag[] {
  const tags: DocumentMetadataTag[] = [];
  pushMetadataTag(tags, {
    key: `classification:${input.document.classification}`,
    label: `Classification: ${formatMetadataValue(input.document.classification)}`,
    value: input.document.classification,
    group: "classification",
    tone: input.document.classification === "privileged" ? "risk" : "neutral",
  });
  pushMetadataTag(tags, {
    key: `review:${input.document.reviewStatus}`,
    label: `Review: ${formatMetadataValue(input.document.reviewStatus)}`,
    value: input.document.reviewStatus,
    group: "review_status",
    tone:
      input.document.reviewStatus === "accepted" || input.document.reviewStatus === "not_required"
        ? "ready"
        : "risk",
  });
  pushMetadataTag(tags, {
    key: `scan:${input.document.scanStatus}`,
    label: `Scan: ${formatMetadataValue(input.document.scanStatus)}`,
    value: input.document.scanStatus,
    group: "scan_status",
    tone: input.document.scanStatus === "failed" ? "risk" : "neutral",
  });
  if (input.document.legalHold) {
    pushMetadataTag(tags, {
      key: "legal_hold",
      label: "Legal hold",
      value: "legal_hold",
      group: "legal_hold",
      tone: "risk",
    });
  }

  const ocrStatus = documentOcrStatus(input);
  pushMetadataTag(tags, {
    key: `ocr:${ocrStatus}`,
    label: `OCR: ${formatMetadataValue(ocrStatus)}`,
    value: ocrStatus,
    group: "ocr",
    tone: ocrStatus === "completed" ? "ready" : ocrStatus === "failed" ? "risk" : "neutral",
  });
  if (input.latestExtraction?.language) {
    pushMetadataTag(tags, {
      key: `ocr_language:${input.latestExtraction.language}`,
      label: `OCR language: ${input.latestExtraction.language}`,
      value: input.latestExtraction.language,
      group: "ocr",
      tone: "neutral",
    });
  }
  if (typeof input.latestExtraction?.confidence === "number") {
    const bucket = confidenceBucket(input.latestExtraction.confidence);
    pushMetadataTag(tags, {
      key: `ocr_confidence:${bucket}`,
      label: `OCR confidence: ${bucket}`,
      value: bucket,
      group: "ocr",
      tone: bucket === "low" ? "risk" : bucket === "high" ? "ready" : "neutral",
    });
  }

  const suggestionCounts = input.reviewSuggestions?.summaryCounts ?? emptyCueCounts();
  for (const group of suggestionGroups) {
    const count = suggestionCounts[group] ?? 0;
    if (count === 0) continue;
    pushMetadataTag(tags, {
      key: `cue:${group}`,
      label: `Cue: ${formatMetadataValue(group)}`,
      value: group,
      group: "reviewer_cue",
      tone: group === "missing_metadata" ? "risk" : "neutral",
      count,
    });
  }

  return tags;
}

function safeSearchFields(input: {
  document: DocumentMetadataSearchDocument;
  tags: DocumentMetadataTag[];
  latestExtraction?: DocumentTextExtractionRecord;
  latestJobStatus?: string;
  reviewSuggestions?: DocumentReviewSuggestions;
}): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [
    { label: "Title", value: input.document.title },
    { label: "Classification", value: formatMetadataValue(input.document.classification) },
    { label: "Review status", value: formatMetadataValue(input.document.reviewStatus) },
    { label: "Scan status", value: formatMetadataValue(input.document.scanStatus) },
    { label: "Upload status", value: formatMetadataValue(input.document.uploadStatus) },
    { label: "Checksum status", value: formatMetadataValue(input.document.checksumStatus) },
    { label: "OCR status", value: formatMetadataValue(documentOcrStatus(input)) },
    ...input.tags.flatMap((tag) => [
      { label: "Metadata tag", value: tag.key },
      { label: "Metadata tag", value: tag.label },
      { label: "Metadata tag", value: formatMetadataValue(tag.value) },
    ]),
  ];
  if (input.document.legalHold) fields.push({ label: "Legal hold", value: "legal hold" });
  if (input.latestExtraction?.language) {
    fields.push({ label: "OCR language", value: input.latestExtraction.language });
  }
  if (typeof input.latestExtraction?.confidence === "number") {
    fields.push({
      label: "OCR confidence",
      value: confidenceBucket(input.latestExtraction.confidence),
    });
  }
  if (input.latestJobStatus) {
    fields.push({ label: "OCR job status", value: formatMetadataValue(input.latestJobStatus) });
  }
  for (const group of suggestionGroups) {
    for (const cue of input.reviewSuggestions?.groups[group] ?? []) {
      fields.push({ label: "Reviewer cue", value: cue.label });
      if (cue.detail) fields.push({ label: "Reviewer cue", value: cue.detail });
      if (cue.role) fields.push({ label: "Reviewer cue", value: formatMetadataValue(cue.role) });
      if (cue.contactName) fields.push({ label: "Reviewer cue", value: cue.contactName });
      if (cue.classification) {
        fields.push({ label: "Reviewer cue", value: formatMetadataValue(cue.classification) });
      }
      if (cue.status)
        fields.push({ label: "Reviewer cue", value: formatMetadataValue(cue.status) });
    }
  }
  return fields;
}

function normalizeFilters(filters: DocumentMetadataSearchFilters): DocumentMetadataSearchFilters {
  return {
    q: filters.q?.trim() || undefined,
    classification: filters.classification,
    reviewStatus: filters.reviewStatus,
    scanStatus: filters.scanStatus,
    ocrStatus: filters.ocrStatus,
    cueGroup: filters.cueGroup,
    tag: filters.tag?.trim() || undefined,
  };
}

function matchedFieldLabels(input: {
  entry: DocumentMetadataSearchEntry;
  tags: DocumentMetadataTag[];
  filters: DocumentMetadataSearchFilters;
}): string[] {
  const labels = new Set<string>();
  const { document } = input.entry;
  const { filters } = input;
  const ocrStatus = documentOcrStatus(input.entry);
  if (filters.classification && document.classification === filters.classification) {
    labels.add("Classification");
  }
  if (filters.reviewStatus && document.reviewStatus === filters.reviewStatus) {
    labels.add("Review status");
  }
  if (filters.scanStatus && document.scanStatus === filters.scanStatus) labels.add("Scan status");
  if (filters.ocrStatus && ocrStatus === filters.ocrStatus) labels.add("OCR status");
  if (
    filters.cueGroup &&
    (input.entry.reviewSuggestions?.summaryCounts[filters.cueGroup] ?? 0) > 0
  ) {
    labels.add("Reviewer cue");
  }
  const normalizedTag = normalizeSearch(filters.tag);
  if (
    normalizedTag &&
    input.tags.some(
      (tag) =>
        normalizeSearch(tag.key) === normalizedTag ||
        normalizeSearch(tag.value) === normalizedTag ||
        normalizeSearch(tag.label) === normalizedTag,
    )
  ) {
    labels.add("Metadata tag");
  }
  const normalizedQuery = normalizeSearch(filters.q);
  if (normalizedQuery) {
    for (const field of safeSearchFields({
      document,
      tags: input.tags,
      latestExtraction: input.entry.latestExtraction,
      latestJobStatus: input.entry.latestJobStatus,
      reviewSuggestions: input.entry.reviewSuggestions,
    })) {
      if (normalizeSearch(field.value).includes(normalizedQuery)) labels.add(field.label);
    }
  }
  return [...labels].sort();
}

function documentMatchesFilters(input: {
  entry: DocumentMetadataSearchEntry;
  tags: DocumentMetadataTag[];
  filters: DocumentMetadataSearchFilters;
}): { matched: boolean; matchedFields: string[] } {
  const { document } = input.entry;
  const { filters } = input;
  const ocrStatus = documentOcrStatus(input.entry);
  if (filters.classification && document.classification !== filters.classification) {
    return { matched: false, matchedFields: [] };
  }
  if (filters.reviewStatus && document.reviewStatus !== filters.reviewStatus) {
    return { matched: false, matchedFields: [] };
  }
  if (filters.scanStatus && document.scanStatus !== filters.scanStatus) {
    return { matched: false, matchedFields: [] };
  }
  if (filters.ocrStatus && ocrStatus !== filters.ocrStatus) {
    return { matched: false, matchedFields: [] };
  }
  if (
    filters.cueGroup &&
    (input.entry.reviewSuggestions?.summaryCounts[filters.cueGroup] ?? 0) === 0
  ) {
    return { matched: false, matchedFields: [] };
  }
  const normalizedTag = normalizeSearch(filters.tag);
  if (
    normalizedTag &&
    !input.tags.some(
      (tag) =>
        normalizeSearch(tag.key) === normalizedTag ||
        normalizeSearch(tag.value) === normalizedTag ||
        normalizeSearch(tag.label) === normalizedTag,
    )
  ) {
    return { matched: false, matchedFields: [] };
  }
  const matchedFields = matchedFieldLabels(input);
  if (filters.q && !matchedFields.length) return { matched: false, matchedFields: [] };
  return { matched: true, matchedFields };
}

export function buildDocumentMetadataSearchPosture(input: {
  entries: DocumentMetadataSearchEntry[];
  filters?: DocumentMetadataSearchFilters;
}): DocumentMetadataSearchPosture {
  const filters = normalizeFilters(input.filters ?? {});
  const tagCounts = new Map<string, DocumentMetadataTag>();
  const statusCounts: Record<DocumentMetadataOcrStatus, number> = {
    not_available: 0,
    queued: 0,
    completed: 0,
    failed: 0,
  };
  const results: DocumentMetadataSearchResultSummary[] = [];

  for (const entry of input.entries) {
    const tags = entry.metadataTags ?? buildDocumentMetadataTags(entry);
    const ocrStatus = documentOcrStatus(entry);
    statusCounts[ocrStatus] += 1;
    for (const tag of tags) {
      const current = tagCounts.get(tag.key);
      tagCounts.set(
        tag.key,
        current ? { ...current, count: (current.count ?? 0) + 1 } : { ...tag, count: 1 },
      );
    }

    const match = documentMatchesFilters({ entry, tags, filters });
    if (!match.matched) continue;
    results.push({
      documentId: entry.document.id,
      title: entry.document.title,
      matterId: entry.document.matterId,
      classification: entry.document.classification,
      reviewStatus: entry.document.reviewStatus,
      scanStatus: entry.document.scanStatus,
      legalHold: entry.document.legalHold,
      ocrStatus,
      tagKeys: tags.map((tag) => tag.key),
      matchedFields: match.matchedFields,
      cueCounts: entry.reviewSuggestions?.summaryCounts ?? emptyCueCounts(),
    });
  }

  return {
    reviewOnly: true,
    mutating: false,
    filters,
    totalCount: input.entries.length,
    matchedCount: results.length,
    tags: [...tagCounts.values()].sort((left, right) => left.key.localeCompare(right.key)),
    ocrPosture: {
      rawTextSearch: false,
      rawTextReturned: false,
      searchableFields: [
        "document_title",
        "op_authored_metadata",
        "reviewer_cue_labels",
        "ocr_status",
      ],
      statusCounts,
    },
    results,
  };
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
