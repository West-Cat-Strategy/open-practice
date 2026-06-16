import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import type {
  ContactIdentifier,
  ContactMethod,
  ContactDataQualityResolutionRecord,
  ContactDossier,
  ContactDossierQualitySignal,
  MatterParty,
  PortalGrant,
} from "@open-practice/domain";
import {
  contactDataQualityResolutionDecisions,
  contactDossierQualitySignalKinds,
  contactRelationshipKinds,
  contactRelationshipSources,
  contactRelationshipStatuses,
  contactRoleCategories,
  contactStatuses,
  contactTimelineActivityFilters,
  filterContactTimelineEntries,
  type JobLifecycleRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { rethrowIdempotencyConflict } from "./idempotency.js";
import type { ApiJobQueue } from "./types.js";

const CONTACT_HISTORY_EXPORT_DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const CONTACT_HISTORY_EXPORT_JOB_NAME = "contact_history_export";
const CONTACT_HISTORY_EXPORT_RESOURCE_TYPE = "contact_history_export";
const CONTACT_HISTORY_EXPORT_REPORT_TYPE = "contact_history_export";
const CONTACT_HISTORY_EXPORT_REPORT_SCOPE = "contact";
const CONTACT_HISTORY_EXPORT_RETENTION_POSTURE =
  "queued_regenerated_download_no_retained_export_body";
const CONTACT_HISTORY_EXPORT_LEGAL_HOLD_POSTURE =
  "respects_existing_matter_visibility_no_hold_override";
const CONTACT_HISTORY_EXPORT_PRIVACY_POSTURE = "redacted_authorized_projection_only";

const contactDataQualityResolutionsQuerySchema = z.object({
  contactId: z.string().min(1).optional(),
  matterId: z.string().min(1).optional(),
});

const contactKindSchema = z.enum(["person", "organization"]);
const contactStatusSchema = z.enum(contactStatuses);
const contactRoleCategorySchema = z.enum(contactRoleCategories);
const contactIdentifierTypeSchema = z.enum([
  "email",
  "phone",
  "tax_id",
  "registry_id",
  "business_number",
  "court_file",
  "custom",
]);
const contactMethodTypeSchema = z.enum(["email", "phone", "address", "website"]);
const contactMethodLabelSchema = z.enum([
  "work",
  "home",
  "mobile",
  "billing",
  "service",
  "registered_office",
  "other",
]);
const portalGrantStatusSchema = z.enum([
  "not_invited",
  "invited",
  "active",
  "suspended",
  "revoked",
  "expired",
]);
const portalPermissionSchema = z.enum([
  "view_matter_summary",
  "view_documents",
  "upload_documents",
  "message",
  "view_messages",
  "send_messages",
  "view_invoices",
  "view_appointments_tasks",
  "view_signature_requests",
  "complete_intake",
  "manage_organization_users",
  "sign",
]);
const matterPartyRoleSchema = z.enum([
  "client",
  "prospective_client",
  "former_client",
  "opposing_party",
  "opposing_counsel",
  "related_party",
  "witness",
  "court",
  "court_tribunal",
  "lawyer",
  "paralegal",
  "authorized_non_lawyer_provider",
  "legal_representative",
  "insurer",
  "expert",
  "vendor",
  "referral_source",
  "internal_team_member",
  "third_party",
  "notary_client",
  "paralegal_client",
  "other",
]);

const contactIdentifierSchema = z.object({
  type: contactIdentifierTypeSchema,
  value: z.string().trim().min(1).max(320),
  label: z.string().trim().min(1).max(80).optional(),
  conflictCheckIncluded: z.boolean().optional(),
  verified: z.boolean().optional(),
});

const contactMethodSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  type: contactMethodTypeSchema,
  label: contactMethodLabelSchema,
  value: z.string().trim().min(1).max(500).optional(),
  address: z
    .object({
      line1: z.string().trim().max(160).optional(),
      line2: z.string().trim().max(160).optional(),
      city: z.string().trim().max(120).optional(),
      province: z.enum(["BC", "ON", "CANADA", "OTHER"]).optional(),
      postalCode: z.string().trim().max(32).optional(),
      country: z.string().trim().max(80).optional(),
    })
    .optional(),
  preferred: z.boolean().optional(),
  doNotContact: z.boolean().optional(),
  verificationStatus: z.enum(["unverified", "verified", "review_needed"]).optional(),
  conflictCheckIncluded: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
});

const contactMethodUpdateBodySchema = contactMethodSchema.partial();

const contactListQuerySchema = z.object({
  search: z.string().trim().min(1).max(160).optional(),
  kind: contactKindSchema.optional(),
  status: contactStatusSchema.optional(),
  roleCategory: contactRoleCategorySchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const contactTimelineQuerySchema = z.object({
  activity: z.enum(contactTimelineActivityFilters).default("all"),
});

const contactParamsSchema = z.object({
  contactId: z.string().min(1),
});

const contactMethodParamsSchema = contactParamsSchema.extend({
  methodId: z.string().min(1),
});

const relationshipParamsSchema = contactParamsSchema.extend({
  relationshipId: z.string().min(1),
});

const matterAssociationParamsSchema = contactParamsSchema.extend({
  associationId: z.string().min(1),
});

const portalGrantParamsSchema = contactParamsSchema.extend({
  grantId: z.string().min(1),
});

const contactDataQualityResolutionBodySchema = z.object({
  contactId: z.string().min(1),
  signalKind: z.enum(contactDossierQualitySignalKinds),
  decision: z.enum(contactDataQualityResolutionDecisions),
  matterId: z.string().min(1).optional(),
  relatedContactId: z.string().min(1).optional(),
  sourceRecordId: z.string().min(1).optional(),
  resolutionNote: z.string().min(1),
});

const contactHistoryExportBodySchema = z
  .object({
    purpose: z.literal("staff_review"),
    reviewReason: z.string().trim().min(8).max(240),
  })
  .strict();

const contactHistoryExportRequestBodySchema = z
  .object({
    purpose: z.literal("staff_review"),
    reviewReason: z.string().trim().min(8).max(240),
    idempotencyKey: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const contactHistoryExportRequestParamsSchema = contactParamsSchema.extend({
  exportJobId: z.string().min(1),
});

const createContactBodySchema = z.object({
  kind: contactKindSchema,
  status: contactStatusSchema.default("active"),
  roleCategories: z.array(contactRoleCategorySchema).default([]),
  canonicalName: z.string().trim().min(1).max(160).optional(),
  displayName: z.string().trim().min(1).max(160),
  givenName: z.string().trim().min(1).max(80).optional(),
  middleName: z.string().trim().min(1).max(80).optional(),
  familyName: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(80).optional(),
  pronouns: z.string().trim().min(1).max(80).optional(),
  organizationLegalName: z.string().trim().min(1).max(160).optional(),
  organizationOperatingName: z.string().trim().min(1).max(160).optional(),
  organizationRegisteredName: z.string().trim().min(1).max(160).optional(),
  organizationType: z.string().trim().min(1).max(80).optional(),
  website: z.string().trim().url().max(2048).optional(),
  aliases: z.array(z.string().trim().min(1).max(160)).default([]),
  formerNames: z.array(z.string().trim().min(1).max(160)).default([]),
  identifiers: z.array(contactIdentifierSchema).default([]),
  contactMethods: z.array(contactMethodSchema).default([]),
  preferredContactMethodId: z.string().trim().min(1).max(80).optional(),
  preferredLanguage: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  communicationNotes: z.string().trim().max(1000).optional(),
  accessibilityNotes: z.string().trim().max(1000).optional(),
  privateNotes: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  riskFlags: z.array(z.string().trim().min(1).max(80)).default([]),
  conflictSensitive: z.boolean().default(false),
  adverse: z.boolean().default(false),
  confidentialityMarker: z.enum(["standard", "confidential", "restricted"]).default("standard"),
  doNotContact: z.boolean().default(false),
});

const updateContactBodySchema = createContactBodySchema.partial().extend({
  archived: z.boolean().optional(),
});

const namesIdentifiersBodySchema = z.object({
  aliases: z.array(z.string().trim().min(1).max(160)).optional(),
  formerNames: z.array(z.string().trim().min(1).max(160)).optional(),
  identifiers: z.array(contactIdentifierSchema).optional(),
});

const relationshipCreateBodySchema = z.object({
  relatedContactId: z.string().trim().min(1),
  relationshipKind: z.enum(contactRelationshipKinds),
  label: z.string().trim().min(1).max(160),
  reciprocalLabel: z.string().trim().min(1).max(160).optional(),
  matterId: z.string().trim().min(1).optional(),
  source: z.enum(contactRelationshipSources).default("manual"),
  status: z.enum(contactRelationshipStatuses).default("active"),
  effectiveOn: z.string().datetime().optional(),
  endedOn: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
  privateNotes: z.string().trim().max(1000).optional(),
  includeInConflictCheck: z.boolean().default(true),
});

const relationshipUpdateBodySchema = relationshipCreateBodySchema
  .omit({ relatedContactId: true })
  .partial();

const matterAssociationCreateBodySchema = z.object({
  matterId: z.string().trim().min(1),
  role: matterPartyRoleSchema,
  adverse: z.boolean().default(false),
  confidential: z.boolean().default(false),
  status: z.enum(["active", "inactive"]).default("active"),
  side: z.enum(["client", "opposing", "neutral", "internal", "court", "other"]).optional(),
  startedOn: z.string().datetime().optional(),
  endedOn: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
  privateNotes: z.string().trim().max(1000).optional(),
  conflictCheckIncluded: z.boolean().default(true),
});

const matterAssociationUpdateBodySchema = matterAssociationCreateBodySchema
  .omit({ matterId: true })
  .partial();

const portalGrantCreateBodySchema = z.object({
  matterId: z.string().trim().min(1),
  accountUserId: z.string().trim().min(1).optional(),
  status: portalGrantStatusSchema.default("invited"),
  permissions: z.array(portalPermissionSchema).default(["view_matter_summary", "view_documents"]),
  expiresAt: z.string().datetime().optional(),
});

const portalGrantUpdateBodySchema = portalGrantCreateBodySchema
  .omit({ matterId: true })
  .partial()
  .extend({
    revokedAt: z.string().datetime().optional(),
    suspendedAt: z.string().datetime().optional(),
    invitedAt: z.string().datetime().optional(),
    activatedAt: z.string().datetime().optional(),
  });

const contactDataQualityResolutionDecisionsByKind: Record<
  ContactDossierQualitySignal["kind"],
  ReadonlySet<ContactDataQualityResolutionRecord["decision"]>
> = {
  duplicate_candidate: new Set(["acknowledged", "false_positive", "needs_follow_up"]),
  protected_party_cue: new Set(["acknowledged", "needs_follow_up"]),
  conflict_revalidation: new Set([
    "revalidation_requested",
    "revalidation_completed",
    "needs_follow_up",
  ]),
};

function redactSignalMatchedValue(signal: ContactDossierQualitySignal) {
  const { matchedValue, ...redactedSignal } = signal;
  return { redactedSignal, matchedValueRedacted: Boolean(matchedValue) };
}

function serializeContactDossier(dossier: ContactDossier): ContactDossier {
  return {
    ...dossier,
    qualityReview: {
      ...dossier.qualityReview,
      signals: dossier.qualityReview.signals.map(
        (signal) => redactSignalMatchedValue(signal).redactedSignal,
      ),
    },
  };
}

function serializeContactReviewQueueItem(dossier: ContactDossier) {
  return {
    contact: {
      id: dossier.contact.id,
      kind: dossier.contact.kind,
      displayName: dossier.contact.displayName,
      aliasCount: dossier.contact.aliases.length,
      identifierCount: dossier.contact.identifiers.length,
    },
    matters: dossier.matters,
    summary: dossier.qualityReview.summary,
    signals: dossier.qualityReview.signals.map((signal) => {
      const { redactedSignal, matchedValueRedacted } = redactSignalMatchedValue(signal);
      return { ...redactedSignal, matchedValueRedacted };
    }),
    auditSafe: true,
  };
}

function serializeContactSummary(contact: ContactDossier["contact"]) {
  return {
    id: contact.id,
    firmId: contact.firmId,
    kind: contact.kind,
    status: contact.status ?? "active",
    roleCategories: contact.roleCategories ?? [],
    canonicalName: contact.canonicalName,
    displayName: contact.displayName,
    givenName: contact.givenName,
    middleName: contact.middleName,
    familyName: contact.familyName,
    title: contact.title,
    pronouns: contact.pronouns,
    organizationLegalName: contact.organizationLegalName,
    organizationOperatingName: contact.organizationOperatingName,
    organizationRegisteredName: contact.organizationRegisteredName,
    organizationType: contact.organizationType,
    website: contact.website,
    aliases: contact.aliases,
    formerNames: contact.formerNames ?? [],
    identifiers: contact.identifiers,
    contactMethods: contact.contactMethods ?? [],
    preferredContactMethodId: contact.preferredContactMethodId,
    preferredLanguage: contact.preferredLanguage,
    timezone: contact.timezone,
    communicationNotes: contact.communicationNotes,
    accessibilityNotes: contact.accessibilityNotes,
    riskFlags: contact.riskFlags ?? [],
    conflictSensitive: contact.conflictSensitive ?? false,
    adverse: contact.adverse ?? false,
    confidentialityMarker: contact.confidentialityMarker ?? "standard",
    doNotContact: contact.doNotContact ?? false,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

function serializeContactDetail(dossier: ContactDossier, portalGrants: PortalGrant[] = []) {
  const serializedDossier = serializeContactDossier(dossier);
  return {
    contact: serializeContactSummary(dossier.contact),
    matters: dossier.matters,
    relationships: dossier.relationships,
    portal: {
      ...dossier.portal,
      grants: portalGrants.map((grant) => ({
        id: grant.id,
        matterId: grant.matterId,
        contactId: grant.contactId,
        accountUserId: grant.accountUserId,
        grantedByUserId: grant.grantedByUserId,
        status: grant.status ?? "active",
        permissions: grant.permissions,
        expiresAt: grant.expiresAt,
        revokedAt: grant.revokedAt,
        suspendedAt: grant.suspendedAt,
        invitedAt: grant.invitedAt,
        activatedAt: grant.activatedAt,
        createdAt: grant.createdAt,
        updatedAt: grant.updatedAt,
      })),
    },
    crmTaxonomy: dossier.crmTaxonomy,
    conflictCues: dossier.conflictCues,
    qualityReview: serializedDossier.qualityReview,
    conflictHistory: dossier.conflictHistory,
  };
}

type ContactTimelineEntry = Awaited<
  ReturnType<OpenPracticeRepository["listContactTimelineForUser"]>
>[number];

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function metadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function metadataBoolean(metadata: Record<string, unknown>, key: string): boolean | undefined {
  const value = metadata[key];
  return typeof value === "boolean" ? value : undefined;
}

function contactMethodPosture(method: ContactMethod) {
  return {
    id: method.id,
    type: method.type,
    label: method.label,
    preferred: Boolean(method.preferred),
    doNotContact: Boolean(method.doNotContact),
    verificationStatus: method.verificationStatus ?? "unverified",
    conflictCheckIncluded: method.conflictCheckIncluded ?? true,
    valueRedacted: Boolean(method.value),
    addressRedacted: Boolean(method.address),
    notesRedacted: Boolean(method.notes),
  };
}

function contactTimelineExportEntry(entry: ContactTimelineEntry) {
  const metadata = entry.metadata;
  return {
    id: entry.id,
    matterId: entry.matterId,
    occurredAt: entry.occurredAt,
    title:
      entry.kind === "task"
        ? entry.title === "Follow-up review cue"
          ? "Follow-up review cue"
          : "Task deadline cue"
        : entry.title,
    kind: entry.kind,
    actorId: entry.actorId,
    metadata:
      entry.kind === "task"
        ? {
            cueType: typeof metadata.cueType === "string" ? metadata.cueType : undefined,
            contactId: typeof metadata.contactId === "string" ? metadata.contactId : undefined,
            matterId: typeof metadata.matterId === "string" ? metadata.matterId : undefined,
            dueAt: typeof metadata.dueAt === "string" ? metadata.dueAt : undefined,
            bucket: typeof metadata.bucket === "string" ? metadata.bucket : undefined,
            status: typeof metadata.status === "string" ? metadata.status : undefined,
            priority: typeof metadata.priority === "string" ? metadata.priority : undefined,
            assignmentScope:
              typeof metadata.assignmentScope === "string" ? metadata.assignmentScope : undefined,
            reviewBoundary: metadata.reviewBoundary,
          }
        : metadata,
  };
}

function buildContactHistoryExport(input: {
  detail: ReturnType<typeof serializeContactDetail>;
  generatedAt: string;
  generatedByUserId: string;
  purpose: "staff_review";
  resolutions: ContactDataQualityResolutionRecord[];
  reviewReason: string;
  timeline: ContactTimelineEntry[];
}) {
  const { contact } = input.detail;
  const categories = {
    identityPosture: {
      contactId: contact.id,
      kind: contact.kind,
      status: contact.status,
      displayName: contact.displayName,
      roleCategories: contact.roleCategories,
      riskFlags: contact.riskFlags,
      conflictSensitive: contact.conflictSensitive,
      adverse: contact.adverse,
      confidentialityMarker: contact.confidentialityMarker,
      doNotContact: contact.doNotContact,
    },
    namePosture: {
      canonicalName: contact.canonicalName,
      givenName: contact.givenName,
      middleName: contact.middleName,
      familyName: contact.familyName,
      title: contact.title,
      pronouns: contact.pronouns,
      organizationLegalName: contact.organizationLegalName,
      organizationOperatingName: contact.organizationOperatingName,
      organizationRegisteredName: contact.organizationRegisteredName,
      organizationType: contact.organizationType,
      aliasCount: contact.aliases.length,
      aliases: contact.aliases,
      formerNameCount: contact.formerNames.length,
      formerNames: contact.formerNames,
    },
    contactMethodPosture: {
      identifierTypes: Array.from(
        new Set(contact.identifiers.map((identifier) => identifier.type)),
      ),
      identifierCount: contact.identifiers.length,
      methods: contact.contactMethods.map(contactMethodPosture),
      preferredContactMethodId: contact.preferredContactMethodId,
      preferredLanguage: contact.preferredLanguage,
      timezone: contact.timezone,
      communicationNotesPresent: Boolean(contact.communicationNotes?.trim()),
      accessibilityNotesPresent: Boolean(contact.accessibilityNotes?.trim()),
    },
    relationshipPosture: input.detail.relationships,
    matterPartyPosture: input.detail.matters,
    portalAccessPosture: {
      activeGrantCount: input.detail.portal.activeGrantCount,
      permissionLabels: input.detail.portal.permissionLabels,
      grants: input.detail.portal.grants.map((grant) => ({
        id: grant.id,
        matterId: grant.matterId,
        contactId: grant.contactId,
        accountBound: Boolean(grant.accountUserId),
        grantedByUserId: grant.grantedByUserId,
        status: grant.status,
        permissions: grant.permissions,
        expiresAt: grant.expiresAt,
        revokedAt: grant.revokedAt,
        suspendedAt: grant.suspendedAt,
        invitedAt: grant.invitedAt,
        activatedAt: grant.activatedAt,
        createdAt: grant.createdAt,
        updatedAt: grant.updatedAt,
      })),
    },
    conflictReviewPosture: {
      cues: input.detail.conflictCues,
      history: input.detail.conflictHistory,
    },
    dataQualityAndDuplicateReviewPosture: {
      summary: input.detail.qualityReview.summary,
      signals: input.detail.qualityReview.signals,
      resolutions: input.resolutions.map((resolution) => ({
        id: resolution.id,
        contactId: resolution.contactId,
        signalKind: resolution.signalKind,
        decision: resolution.decision,
        matterId: resolution.matterId,
        relatedContactPresent: Boolean(resolution.relatedContactId),
        sourceRecordPresent: Boolean(resolution.sourceRecordId),
        resolutionNotePresent: Boolean(resolution.resolutionNote.trim()),
        recordedByUserId: resolution.recordedByUserId,
        recordedAt: resolution.recordedAt,
      })),
    },
    timelineCues: input.timeline.map(contactTimelineExportEntry),
  };
  return {
    exportRequest: {
      purpose: input.purpose,
      contactId: contact.id,
      generatedAt: input.generatedAt,
      generatedByUserId: input.generatedByUserId,
      reviewReasonPresent: Boolean(input.reviewReason.trim()),
      retentionPosture: "transient_regenerated_no_retained_export_body",
      legalHoldPosture: "respects_existing_matter_visibility_no_hold_override",
      privacyPosture: "redacted_authorized_projection_only",
      storedBody: false,
    },
    export: {
      generatedAt: input.generatedAt,
      generatedByUserId: input.generatedByUserId,
      purpose: input.purpose,
      policyBoundary: {
        rawPrivateContactHistory: false,
        exportBodyStoredInAuditMetadata: false,
        retainedExportArtifact: false,
        deletionAutomation: false,
        retentionDeadline: false,
        jurisdictionCertifiedRecordsClaim: false,
      },
      categories,
    },
  };
}

async function loadContactHistoryExport(input: {
  repository: OpenPracticeRepository;
  firmId: string;
  user: Parameters<OpenPracticeRepository["listContactDossiersForUser"]>[0];
  contactId: string;
  generatedAt: string;
  purpose: "staff_review";
  reviewReason: string;
}) {
  const dossiers = await input.repository.listContactDossiersForUser(input.user);
  const dossier = findVisibleDossier(dossiers, input.contactId);
  const [portalGrants, timeline, resolutions] = await Promise.all([
    input.repository.listContactPortalGrantsForUser(input.user, input.contactId),
    input.repository.listContactTimelineForUser(input.user, input.contactId),
    input.repository.listContactDataQualityResolutions(input.firmId, {
      contactId: input.contactId,
    }),
  ]);
  const detail = serializeContactDetail(dossier, portalGrants);
  const visibleResolutions = filterVisibleResolutions(resolutions, dossiers).filter(
    (resolution) => resolution.contactId === input.contactId,
  );
  const payload = buildContactHistoryExport({
    detail,
    generatedAt: input.generatedAt,
    generatedByUserId: input.user.id,
    purpose: input.purpose,
    resolutions: visibleResolutions,
    reviewReason: input.reviewReason,
    timeline,
  });
  return { detail, payload, timeline };
}

function contactHistoryExportCounts(input: {
  detail: ReturnType<typeof serializeContactDetail>;
  payload: ReturnType<typeof buildContactHistoryExport>;
  timeline: ContactTimelineEntry[];
}) {
  return {
    generatedCategoryCount: Object.keys(input.payload.export.categories).length,
    timelineEntryCount: input.timeline.length,
    matterAssociationCount: input.detail.matters.length,
    portalGrantCount: input.detail.portal.grants.length,
    conflictSummaryCount: input.detail.conflictHistory.length + input.detail.conflictCues.length,
  };
}

function contactHistoryExportJobId(): string {
  return `contact-history-export-${randomUUID()}`;
}

function contactHistoryDownloadExpiresAt(now: Date): string {
  return new Date(now.getTime() + CONTACT_HISTORY_EXPORT_DOWNLOAD_TTL_MS).toISOString();
}

function contactHistoryExportMetadata(input: {
  contactId: string;
  counts: ReturnType<typeof contactHistoryExportCounts>;
  downloadExpiresAt: string;
  enqueueStatus: "queued_for_local_report_worker" | "completed_inline";
  idempotencyKeyPresent: boolean;
  purpose: "staff_review";
  requestedByUserId: string;
  reviewReasonPresent: boolean;
}) {
  return compactMetadata({
    reportType: CONTACT_HISTORY_EXPORT_REPORT_TYPE,
    reportScope: CONTACT_HISTORY_EXPORT_REPORT_SCOPE,
    contactId: input.contactId,
    purpose: input.purpose,
    requestedByUserId: input.requestedByUserId,
    reviewReasonPresent: input.reviewReasonPresent,
    downloadExpiresAt: input.downloadExpiresAt,
    generatedCategoryCount: input.counts.generatedCategoryCount,
    timelineEntryCount: input.counts.timelineEntryCount,
    matterAssociationCount: input.counts.matterAssociationCount,
    portalGrantCount: input.counts.portalGrantCount,
    conflictSummaryCount: input.counts.conflictSummaryCount,
    retentionPosture: CONTACT_HISTORY_EXPORT_RETENTION_POSTURE,
    legalHoldPosture: CONTACT_HISTORY_EXPORT_LEGAL_HOLD_POSTURE,
    privacyPosture: CONTACT_HISTORY_EXPORT_PRIVACY_POSTURE,
    storedBody: false,
    retainedExportArtifact: false,
    deletionAutomation: false,
    retentionDeadline: false,
    legalHoldOverride: false,
    redactedAuthorizedProjection: true,
    exportBodyStoredInJobMetadata: false,
    enqueueStatus: input.enqueueStatus,
    idempotencyKeyPresent: input.idempotencyKeyPresent,
  });
}

function contactHistoryExportContactId(job: JobLifecycleRecord): string | undefined {
  return metadataString(job.metadata, "contactId");
}

function serializeContactHistoryExportRequest(job: JobLifecycleRecord, contactId: string) {
  const metadata = job.metadata;
  return {
    id: job.id,
    jobId: job.id,
    contactId,
    purpose: "staff_review" as const,
    status: job.status,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    failedAt: job.failedAt,
    pollUrl: `/api/contacts/${encodeURIComponent(contactId)}/history-export-requests/${encodeURIComponent(
      job.id,
    )}`,
    downloadUrl: `/api/contacts/${encodeURIComponent(
      contactId,
    )}/history-export-requests/${encodeURIComponent(job.id)}/download`,
    downloadExpiresAt: metadataString(metadata, "downloadExpiresAt"),
    reviewReasonPresent: metadataBoolean(metadata, "reviewReasonPresent") ?? false,
    generatedCategoryCount: metadataNumber(metadata, "generatedCategoryCount"),
    timelineEntryCount: metadataNumber(metadata, "timelineEntryCount"),
    matterAssociationCount: metadataNumber(metadata, "matterAssociationCount"),
    portalGrantCount: metadataNumber(metadata, "portalGrantCount"),
    conflictSummaryCount: metadataNumber(metadata, "conflictSummaryCount"),
    retentionPosture:
      metadataString(metadata, "retentionPosture") ?? CONTACT_HISTORY_EXPORT_RETENTION_POSTURE,
    legalHoldPosture:
      metadataString(metadata, "legalHoldPosture") ?? CONTACT_HISTORY_EXPORT_LEGAL_HOLD_POSTURE,
    privacyPosture:
      metadataString(metadata, "privacyPosture") ?? CONTACT_HISTORY_EXPORT_PRIVACY_POSTURE,
    storedBody: metadataBoolean(metadata, "storedBody") ?? false,
    retainedExportArtifact: metadataBoolean(metadata, "retainedExportArtifact") ?? false,
    deletionAutomation: metadataBoolean(metadata, "deletionAutomation") ?? false,
    retentionDeadline: metadataBoolean(metadata, "retentionDeadline") ?? false,
    legalHoldOverride: metadataBoolean(metadata, "legalHoldOverride") ?? false,
    redactedAuthorizedProjection: metadataBoolean(metadata, "redactedAuthorizedProjection") ?? true,
  };
}

async function findContactHistoryExportJob(input: {
  repository: OpenPracticeRepository;
  firmId: string;
  contactId: string;
  exportJobId: string;
}) {
  return (
    await input.repository.listJobLifecycleRecords(input.firmId, { queueName: "reports" })
  ).find(
    (job) =>
      job.id === input.exportJobId &&
      job.jobName === CONTACT_HISTORY_EXPORT_JOB_NAME &&
      job.targetResourceType === CONTACT_HISTORY_EXPORT_RESOURCE_TYPE &&
      contactHistoryExportContactId(job) === input.contactId,
  );
}

function assertContactHistoryDownloadReady(job: JobLifecycleRecord, now: string): void {
  if (job.status === "failed" || job.status === "dead_letter" || job.status === "skipped") {
    throw new ApiHttpError(
      409,
      "CONTACT_HISTORY_EXPORT_FAILED",
      "Contact-history export did not complete",
    );
  }
  if (job.status !== "completed") {
    throw new ApiHttpError(
      409,
      "CONTACT_HISTORY_EXPORT_NOT_READY",
      "Contact-history export is not ready yet",
    );
  }
  const downloadExpiresAt = metadataString(job.metadata, "downloadExpiresAt");
  if (!downloadExpiresAt || Date.parse(downloadExpiresAt) <= Date.parse(now)) {
    throw new ApiHttpError(
      410,
      "CONTACT_HISTORY_EXPORT_EXPIRED",
      "Contact-history export download link has expired",
    );
  }
}

function visibleMatterIds(dossiers: ContactDossier[]): Set<string> {
  return new Set(dossiers.flatMap((dossier) => dossier.matters.map((matter) => matter.matterId)));
}

function visibleContactIds(dossiers: ContactDossier[]): Set<string> {
  return new Set(dossiers.map((dossier) => dossier.contact.id));
}

function findVisibleDossier(dossiers: ContactDossier[], contactId: string): ContactDossier {
  const dossier = dossiers.find((candidate) => candidate.contact.id === contactId);
  if (!dossier) {
    throw new ApiHttpError(
      403,
      "CONTACT_NOT_VISIBLE",
      "Contact data-quality resolution contact is not visible",
    );
  }
  return dossier;
}

function assertVisibleMatter(dossiers: ContactDossier[], matterId: string): void {
  if (!visibleMatterIds(dossiers).has(matterId)) {
    throw new ApiHttpError(403, "CONTACT_MATTER_NOT_VISIBLE", "Matter is not visible");
  }
}

function assertVisibleRelatedContact(dossiers: ContactDossier[], contactId: string): void {
  if (!visibleContactIds(dossiers).has(contactId)) {
    throw new ApiHttpError(403, "RELATED_CONTACT_NOT_VISIBLE", "Related contact is not visible");
  }
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizedContactMethod(method: z.infer<typeof contactMethodSchema>): ContactMethod {
  return {
    ...method,
    id: method.id ?? `contact-method-${randomUUID()}`,
    verificationStatus: method.verificationStatus ?? "unverified",
    conflictCheckIncluded: method.conflictCheckIncluded ?? true,
  };
}

function assertResolutionScopeVisible(
  dossiers: ContactDossier[],
  input: { contactId: string; matterId?: string; relatedContactId?: string },
): ContactDossier {
  const dossier = findVisibleDossier(dossiers, input.contactId);
  const matterIds = visibleMatterIds(dossiers);
  const contactIds = visibleContactIds(dossiers);

  if (input.matterId && !matterIds.has(input.matterId)) {
    throw new ApiHttpError(
      403,
      "CONTACT_MATTER_NOT_VISIBLE",
      "Contact data-quality resolution matter is not visible",
    );
  }
  if (input.matterId && !dossier.matters.some((matter) => matter.matterId === input.matterId)) {
    throw new ApiHttpError(
      403,
      "CONTACT_MATTER_LINK_NOT_VISIBLE",
      "Contact data-quality resolution contact is not visible on the requested matter",
    );
  }
  if (input.relatedContactId && !contactIds.has(input.relatedContactId)) {
    throw new ApiHttpError(
      403,
      "RELATED_CONTACT_NOT_VISIBLE",
      "Contact data-quality resolution related contact is not visible",
    );
  }

  return dossier;
}

function signalMatchesResolution(
  signal: ContactDossierQualitySignal,
  input: z.infer<typeof contactDataQualityResolutionBodySchema>,
): boolean {
  if (signal.kind !== input.signalKind) return false;
  if (signal.matterId && signal.matterId !== input.matterId) return false;
  if (input.matterId && signal.matterId !== input.matterId) return false;
  if (signal.sourceRecordId && signal.sourceRecordId !== input.sourceRecordId) return false;
  if (input.sourceRecordId && signal.sourceRecordId !== input.sourceRecordId) return false;
  if (input.relatedContactId) {
    return (signal.relatedContactIds ?? []).includes(input.relatedContactId);
  }
  return input.signalKind !== "duplicate_candidate" || !signal.relatedContactIds?.length;
}

function resolutionMatchesVisibleSignal(
  resolution: ContactDataQualityResolutionRecord,
  signal: ContactDossierQualitySignal,
): boolean {
  if (signal.kind !== resolution.signalKind) return false;
  if (signal.matterId && signal.matterId !== resolution.matterId) return false;
  if (resolution.matterId && signal.matterId !== resolution.matterId) return false;
  if (signal.sourceRecordId && signal.sourceRecordId !== resolution.sourceRecordId) return false;
  if (resolution.sourceRecordId && signal.sourceRecordId !== resolution.sourceRecordId) {
    return false;
  }
  if (resolution.relatedContactId) {
    return (signal.relatedContactIds ?? []).includes(resolution.relatedContactId);
  }
  return resolution.signalKind !== "duplicate_candidate" || !signal.relatedContactIds?.length;
}

function filterVisibleResolutions(
  resolutions: ContactDataQualityResolutionRecord[],
  dossiers: ContactDossier[],
): ContactDataQualityResolutionRecord[] {
  const contactIds = visibleContactIds(dossiers);
  const matterIds = visibleMatterIds(dossiers);
  return resolutions.filter(
    (resolution) =>
      contactIds.has(resolution.contactId) &&
      (!resolution.relatedContactId || contactIds.has(resolution.relatedContactId)) &&
      (!resolution.matterId || matterIds.has(resolution.matterId)) &&
      dossiers.some(
        (dossier) =>
          dossier.contact.id === resolution.contactId &&
          dossier.qualityReview.signals.some((signal) =>
            resolutionMatchesVisibleSignal(resolution, signal),
          ),
      ),
  );
}

export function registerContactRoutes(
  server: FastifyInstance,
  options: { repository: OpenPracticeRepository; reportJobQueue?: ApiJobQueue },
): void {
  server.get("/api/contacts/dossiers", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    return dossiers.map(serializeContactDossier);
  });

  server.get("/api/contacts", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const query = parseRequestPart(contactListQuerySchema, request.query, "query");
    const contacts = await options.repository.listContactsForUser(request.auth.user, query);
    return {
      contacts: contacts.map(serializeContactSummary),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: contacts.length,
      },
    };
  });

  server.post("/api/contacts", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "create" });
    if (!access.ok) throw access.error;
    const body = parseRequestPart(createContactBodySchema, request.body, "body");
    const contact = await options.repository.createContact({
      id: `contact-${randomUUID()}`,
      firmId: request.auth.firmId,
      kind: body.kind,
      status: body.status,
      roleCategories: Array.from(new Set(body.roleCategories)),
      canonicalName: body.canonicalName,
      displayName: body.displayName,
      givenName: body.givenName,
      middleName: body.middleName,
      familyName: body.familyName,
      title: body.title,
      pronouns: body.pronouns,
      organizationLegalName: body.organizationLegalName,
      organizationOperatingName: body.organizationOperatingName,
      organizationRegisteredName: body.organizationRegisteredName,
      organizationType: body.organizationType,
      website: body.website,
      aliases: dedupeStrings(body.aliases),
      formerNames: dedupeStrings(body.formerNames),
      identifiers: body.identifiers as ContactIdentifier[],
      contactMethods: body.contactMethods.map(normalizedContactMethod),
      preferredContactMethodId: body.preferredContactMethodId,
      preferredLanguage: body.preferredLanguage,
      timezone: body.timezone,
      communicationNotes: body.communicationNotes,
      accessibilityNotes: body.accessibilityNotes,
      privateNotes: body.privateNotes,
      notes: body.notes,
      riskFlags: dedupeStrings(body.riskFlags),
      conflictSensitive: body.conflictSensitive,
      adverse: body.adverse,
      confidentialityMarker: body.confidentialityMarker,
      doNotContact: body.doNotContact,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact.created",
      resourceType: "contact",
      resourceId: contact.id,
      metadata: {
        contactId: contact.id,
        kind: contact.kind,
        aliasCount: contact.aliases.length,
        identifierTypes: Array.from(
          new Set(contact.identifiers.map((identifier) => identifier.type)),
        ),
        status: contact.status ?? "active",
        roleCategories: contact.roleCategories ?? [],
        contactMethodCount: contact.contactMethods?.length ?? 0,
      },
    });
    return reply.code(201).send({
      contact: serializeContactSummary(contact),
    });
  });

  server.get("/api/contacts/review-queue", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    const items = dossiers
      .filter((dossier) => dossier.qualityReview.signals.length > 0)
      .map(serializeContactReviewQueueItem);
    return {
      summary: {
        totalContacts: dossiers.length,
        reviewItemCount: items.length,
        duplicateCandidateCount: items.reduce(
          (total, item) => total + item.summary.duplicateCandidateCount,
          0,
        ),
        sensitivePartyCueCount: items.reduce(
          (total, item) => total + item.summary.sensitivePartyCueCount,
          0,
        ),
        revalidationPromptCount: items.reduce(
          (total, item) => total + item.summary.revalidationPromptCount,
          0,
        ),
      },
      items,
    };
  });

  server.get("/api/contacts/data-quality-resolutions", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const query = parseRequestPart(
      contactDataQualityResolutionsQuerySchema,
      request.query,
      "query",
    );
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    if (query.contactId || query.matterId) {
      if (query.contactId) {
        assertResolutionScopeVisible(dossiers, {
          contactId: query.contactId,
          matterId: query.matterId,
        });
      } else if (query.matterId && !visibleMatterIds(dossiers).has(query.matterId)) {
        throw new ApiHttpError(
          403,
          "CONTACT_MATTER_NOT_VISIBLE",
          "Contact data-quality resolution matter is not visible",
        );
      }
    }
    const resolutions = await options.repository.listContactDataQualityResolutions(
      request.auth.firmId,
      query,
    );
    return filterVisibleResolutions(resolutions, dossiers);
  });

  server.post("/api/contacts/data-quality-resolutions", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const body = parseRequestPart(contactDataQualityResolutionBodySchema, request.body, "body");
    if (!contactDataQualityResolutionDecisionsByKind[body.signalKind].has(body.decision)) {
      throw new ApiHttpError(
        400,
        "CONTACT_RESOLUTION_DECISION_INVALID",
        "Contact data-quality resolution decision is invalid for the signal kind",
      );
    }
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    const dossier = assertResolutionScopeVisible(dossiers, body);
    if (!dossier.qualityReview.signals.some((signal) => signalMatchesResolution(signal, body))) {
      throw new ApiHttpError(
        403,
        "CONTACT_SIGNAL_NOT_VISIBLE",
        "Contact data-quality resolution signal is not visible",
      );
    }

    const created = await options.repository.createContactDataQualityResolution({
      id: randomUUID(),
      firmId: request.auth.firmId,
      contactId: body.contactId,
      signalKind: body.signalKind,
      decision: body.decision,
      matterId: body.matterId,
      relatedContactId: body.relatedContactId,
      sourceRecordId: body.sourceRecordId,
      resolutionNote: body.resolutionNote,
      recordedByUserId: request.auth.user.id,
      recordedAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact.data_quality_resolution.recorded",
      resourceType: "contact_data_quality_resolution",
      resourceId: created.id,
      metadata: {
        contactId: created.contactId,
        matterId: created.matterId,
        signalKind: created.signalKind,
        decision: created.decision,
        relatedContactPresent: Boolean(created.relatedContactId),
        sourceRecordPresent: Boolean(created.sourceRecordId),
        resolutionNotePresent: Boolean(created.resolutionNote.trim()),
      },
    });
    return created;
  });

  server.get("/api/contacts/:contactId", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    const dossier = findVisibleDossier(dossiers, params.contactId);
    const portalGrants = await options.repository.listContactPortalGrantsForUser(
      request.auth.user,
      params.contactId,
    );
    return serializeContactDetail(dossier, portalGrants);
  });

  server.post("/api/contacts/:contactId/history-export", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "export" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const body = parseRequestPart(contactHistoryExportBodySchema, request.body, "body");
    const generatedAt = new Date().toISOString();
    const { detail, payload, timeline } = await loadContactHistoryExport({
      repository: options.repository,
      firmId: request.auth.firmId,
      user: request.auth.user,
      contactId: params.contactId,
      generatedAt,
      purpose: body.purpose,
      reviewReason: body.reviewReason,
    });
    const counts = contactHistoryExportCounts({ detail, payload, timeline });
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact_history_export.requested",
      resourceType: "contact_history_export",
      resourceId: params.contactId,
      metadata: {
        contactId: params.contactId,
        purpose: body.purpose,
        reviewReasonPresent: Boolean(body.reviewReason.trim()),
        generatedCategoryCount: counts.generatedCategoryCount,
        timelineEntryCount: counts.timelineEntryCount,
        matterAssociationCount: counts.matterAssociationCount,
        portalGrantCount: counts.portalGrantCount,
        conflictSummaryCount: counts.conflictSummaryCount,
        retentionPosture: payload.exportRequest.retentionPosture,
        legalHoldPosture: payload.exportRequest.legalHoldPosture,
        privacyPosture: payload.exportRequest.privacyPosture,
      },
    });
    return payload;
  });

  server.post("/api/contacts/:contactId/history-export-requests", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "export" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const body = parseRequestPart(contactHistoryExportRequestBodySchema, request.body, "body");
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const downloadExpiresAt = contactHistoryDownloadExpiresAt(nowDate);
    const { detail, payload, timeline } = await loadContactHistoryExport({
      repository: options.repository,
      firmId: request.auth.firmId,
      user: request.auth.user,
      contactId: params.contactId,
      generatedAt: now,
      purpose: body.purpose,
      reviewReason: body.reviewReason,
    });
    const jobId = contactHistoryExportJobId();
    const queueConfigured = Boolean(options.reportJobQueue);
    const idempotencyKey =
      body.idempotencyKey ??
      `${CONTACT_HISTORY_EXPORT_JOB_NAME}:${request.auth.user.id}:${params.contactId}:${body.purpose}:${now.slice(
        0,
        10,
      )}`;
    const metadata = contactHistoryExportMetadata({
      contactId: params.contactId,
      counts: contactHistoryExportCounts({ detail, payload, timeline }),
      downloadExpiresAt,
      enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
      idempotencyKeyPresent: Boolean(body.idempotencyKey),
      purpose: body.purpose,
      requestedByUserId: request.auth.user.id,
      reviewReasonPresent: Boolean(body.reviewReason.trim()),
    });

    let job: JobLifecycleRecord;
    try {
      job = await options.repository.createJobLifecycleRecord({
        id: jobId,
        firmId: request.auth.firmId,
        queueName: "reports",
        jobName: CONTACT_HISTORY_EXPORT_JOB_NAME,
        bullJobId: queueConfigured ? jobId : undefined,
        idempotencyKey,
        status: queueConfigured ? "queued" : "completed",
        targetResourceType: CONTACT_HISTORY_EXPORT_RESOURCE_TYPE,
        targetResourceId: jobId,
        attemptsMade: 0,
        maxAttempts: queueConfigured ? 2 : 1,
        queuedAt: now,
        finishedAt: queueConfigured ? undefined : now,
        metadata,
      });
    } catch (error) {
      rethrowIdempotencyConflict(error);
    }
    const created = job.id === jobId;

    if (options.reportJobQueue && created) {
      try {
        await options.reportJobQueue.add(
          CONTACT_HISTORY_EXPORT_JOB_NAME,
          {
            firmId: request.auth.firmId,
            resourceType: CONTACT_HISTORY_EXPORT_RESOURCE_TYPE,
            resourceId: job.id,
            metadata: compactMetadata({
              reportType: CONTACT_HISTORY_EXPORT_REPORT_TYPE,
              reportScope: CONTACT_HISTORY_EXPORT_REPORT_SCOPE,
              contactId: params.contactId,
              purpose: body.purpose,
              requestedByUserId: request.auth.user.id,
              reviewReasonPresent: Boolean(body.reviewReason.trim()),
              downloadExpiresAt,
              retentionPosture: CONTACT_HISTORY_EXPORT_RETENTION_POSTURE,
              legalHoldPosture: CONTACT_HISTORY_EXPORT_LEGAL_HOLD_POSTURE,
              privacyPosture: CONTACT_HISTORY_EXPORT_PRIVACY_POSTURE,
              storedBody: false,
              retainedExportArtifact: false,
              deletionAutomation: false,
              retentionDeadline: false,
              legalHoldOverride: false,
              redactedAuthorizedProjection: true,
              exportBodyStoredInJobMetadata: false,
            }),
          },
          { jobId: job.id },
        );
      } catch (error) {
        await options.repository.updateJobLifecycleRecord(request.auth.firmId, job.id, {
          status: "failed",
          failedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    if (created) {
      await appendRouteAuditEvent(options.repository, request.auth, {
        action: "contact_history_export.requested",
        resourceType: "contact_history_export",
        resourceId: params.contactId,
        metadata: compactMetadata({
          contactId: params.contactId,
          jobId: job.id,
          purpose: body.purpose,
          reviewReasonPresent: Boolean(body.reviewReason.trim()),
          generatedCategoryCount: metadataNumber(metadata, "generatedCategoryCount"),
          timelineEntryCount: metadataNumber(metadata, "timelineEntryCount"),
          matterAssociationCount: metadataNumber(metadata, "matterAssociationCount"),
          portalGrantCount: metadataNumber(metadata, "portalGrantCount"),
          conflictSummaryCount: metadataNumber(metadata, "conflictSummaryCount"),
          downloadExpiresAt,
          enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
          idempotencyKeyPresent: Boolean(body.idempotencyKey),
          retentionPosture: CONTACT_HISTORY_EXPORT_RETENTION_POSTURE,
          legalHoldPosture: CONTACT_HISTORY_EXPORT_LEGAL_HOLD_POSTURE,
          privacyPosture: CONTACT_HISTORY_EXPORT_PRIVACY_POSTURE,
          storedBody: false,
          retainedExportArtifact: false,
          deletionAutomation: false,
          retentionDeadline: false,
          legalHoldOverride: false,
        }),
      });
    }

    reply.status(202);
    return {
      exportRequest: serializeContactHistoryExportRequest(job, params.contactId),
    };
  });

  server.get("/api/contacts/:contactId/history-export-requests/:exportJobId", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "export" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(
      contactHistoryExportRequestParamsSchema,
      request.params,
      "params",
    );
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    findVisibleDossier(dossiers, params.contactId);
    const job = await findContactHistoryExportJob({
      repository: options.repository,
      firmId: request.auth.firmId,
      contactId: params.contactId,
      exportJobId: params.exportJobId,
    });
    if (!job) {
      throw new ApiHttpError(
        404,
        "CONTACT_HISTORY_EXPORT_NOT_FOUND",
        "Contact-history export request was not found",
      );
    }
    return {
      exportRequest: serializeContactHistoryExportRequest(job, params.contactId),
    };
  });

  server.get(
    "/api/contacts/:contactId/history-export-requests/:exportJobId/download",
    async (request) => {
      const access = requireAccess(request.auth, { resource: "contact", action: "export" });
      if (!access.ok) throw access.error;
      const params = parseRequestPart(
        contactHistoryExportRequestParamsSchema,
        request.params,
        "params",
      );
      const job = await findContactHistoryExportJob({
        repository: options.repository,
        firmId: request.auth.firmId,
        contactId: params.contactId,
        exportJobId: params.exportJobId,
      });
      if (!job) {
        throw new ApiHttpError(
          404,
          "CONTACT_HISTORY_EXPORT_NOT_FOUND",
          "Contact-history export request was not found",
        );
      }
      const now = new Date().toISOString();
      assertContactHistoryDownloadReady(job, now);
      const { payload } = await loadContactHistoryExport({
        repository: options.repository,
        firmId: request.auth.firmId,
        user: request.auth.user,
        contactId: params.contactId,
        generatedAt: now,
        purpose: "staff_review",
        reviewReason: "Queued staff review reason present",
      });
      const exportRequest = serializeContactHistoryExportRequest(job, params.contactId);
      await appendRouteAuditEvent(options.repository, request.auth, {
        action: "contact_history_export.downloaded",
        resourceType: "contact_history_export",
        resourceId: params.contactId,
        metadata: compactMetadata({
          contactId: params.contactId,
          jobId: job.id,
          purpose: "staff_review",
          downloadExpiresAt: exportRequest.downloadExpiresAt,
          retentionPosture: exportRequest.retentionPosture,
          legalHoldPosture: exportRequest.legalHoldPosture,
          privacyPosture: exportRequest.privacyPosture,
          storedBody: false,
          retainedExportArtifact: false,
          deletionAutomation: false,
          retentionDeadline: false,
          legalHoldOverride: false,
        }),
      });
      return {
        exportRequest: {
          ...payload.exportRequest,
          ...exportRequest,
          generatedAt: payload.exportRequest.generatedAt,
          generatedByUserId: payload.exportRequest.generatedByUserId,
          storedBody: false,
        },
        export: payload.export,
      };
    },
  );

  server.patch("/api/contacts/:contactId", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const body = parseRequestPart(updateContactBodySchema, request.body, "body");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    findVisibleDossier(dossiers, params.contactId);
    const { archived, aliases, formerNames, riskFlags, contactMethods, ...contactUpdates } = body;
    const updated = await options.repository.updateContact({
      firmId: request.auth.firmId,
      contactId: params.contactId,
      updates: {
        ...contactUpdates,
        ...(aliases ? { aliases: dedupeStrings(aliases) } : {}),
        ...(formerNames ? { formerNames: dedupeStrings(formerNames) } : {}),
        ...(riskFlags ? { riskFlags: dedupeStrings(riskFlags) } : {}),
        ...(contactMethods ? { contactMethods: contactMethods.map(normalizedContactMethod) } : {}),
        ...(archived ? { status: "archived" as const } : {}),
        updatedByUserId: request.auth.user.id,
      },
    });
    if (!updated) {
      throw new ApiHttpError(404, "CONTACT_NOT_FOUND", "Contact was not found");
    }
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: archived ? "contact.archived" : "contact.updated",
      resourceType: "contact",
      resourceId: updated.id,
      metadata: {
        contactId: updated.id,
        status: updated.status ?? "active",
        changedFields: Object.keys(body).sort(),
      },
    });
    return { contact: serializeContactSummary(updated) };
  });

  server.patch("/api/contacts/:contactId/names-identifiers", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const body = parseRequestPart(namesIdentifiersBodySchema, request.body, "body");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    findVisibleDossier(dossiers, params.contactId);
    const updated = await options.repository.updateContact({
      firmId: request.auth.firmId,
      contactId: params.contactId,
      updates: {
        ...(body.aliases ? { aliases: dedupeStrings(body.aliases) } : {}),
        ...(body.formerNames ? { formerNames: dedupeStrings(body.formerNames) } : {}),
        ...(body.identifiers ? { identifiers: body.identifiers as ContactIdentifier[] } : {}),
        updatedByUserId: request.auth.user.id,
      },
    });
    if (!updated) throw new ApiHttpError(404, "CONTACT_NOT_FOUND", "Contact was not found");
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact.updated",
      resourceType: "contact",
      resourceId: updated.id,
      metadata: {
        contactId: updated.id,
        aliasCount: updated.aliases.length,
        formerNameCount: updated.formerNames?.length ?? 0,
        identifierTypes: Array.from(
          new Set(updated.identifiers.map((identifier) => identifier.type)),
        ),
      },
    });
    return { contact: serializeContactSummary(updated) };
  });

  server.post("/api/contacts/:contactId/contact-methods", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const body = parseRequestPart(contactMethodSchema, request.body, "body");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    const dossier = findVisibleDossier(dossiers, params.contactId);
    const method = normalizedContactMethod(body);
    const contactMethods = [...(dossier.contact.contactMethods ?? []), method];
    const updated = await options.repository.updateContact({
      firmId: request.auth.firmId,
      contactId: params.contactId,
      updates: { contactMethods, updatedByUserId: request.auth.user.id },
    });
    if (!updated) throw new ApiHttpError(404, "CONTACT_NOT_FOUND", "Contact was not found");
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact.updated",
      resourceType: "contact",
      resourceId: updated.id,
      metadata: { contactId: updated.id, contactMethodAdded: method.type },
    });
    return reply
      .code(201)
      .send({ contactMethod: method, contact: serializeContactSummary(updated) });
  });

  server.patch("/api/contacts/:contactId/contact-methods/:methodId", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactMethodParamsSchema, request.params, "params");
    const body = parseRequestPart(contactMethodUpdateBodySchema, request.body, "body");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    const dossier = findVisibleDossier(dossiers, params.contactId);
    const existing = dossier.contact.contactMethods ?? [];
    if (!existing.some((method) => method.id === params.methodId)) {
      throw new ApiHttpError(404, "CONTACT_METHOD_NOT_FOUND", "Contact method was not found");
    }
    const contactMethods = existing.map((method) =>
      method.id === params.methodId
        ? normalizedContactMethod({ ...method, ...body, id: params.methodId })
        : method,
    );
    const updated = await options.repository.updateContact({
      firmId: request.auth.firmId,
      contactId: params.contactId,
      updates: { contactMethods, updatedByUserId: request.auth.user.id },
    });
    if (!updated) throw new ApiHttpError(404, "CONTACT_NOT_FOUND", "Contact was not found");
    return { contact: serializeContactSummary(updated) };
  });

  server.delete("/api/contacts/:contactId/contact-methods/:methodId", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactMethodParamsSchema, request.params, "params");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    const dossier = findVisibleDossier(dossiers, params.contactId);
    const existing = dossier.contact.contactMethods ?? [];
    const contactMethods = existing.filter((method) => method.id !== params.methodId);
    if (contactMethods.length === existing.length) {
      throw new ApiHttpError(404, "CONTACT_METHOD_NOT_FOUND", "Contact method was not found");
    }
    const updated = await options.repository.updateContact({
      firmId: request.auth.firmId,
      contactId: params.contactId,
      updates: { contactMethods, updatedByUserId: request.auth.user.id },
    });
    if (!updated) throw new ApiHttpError(404, "CONTACT_NOT_FOUND", "Contact was not found");
    return { contact: serializeContactSummary(updated) };
  });

  server.post("/api/contacts/:contactId/relationships", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const body = parseRequestPart(relationshipCreateBodySchema, request.body, "body");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    findVisibleDossier(dossiers, params.contactId);
    assertVisibleRelatedContact(dossiers, body.relatedContactId);
    if (body.matterId) assertVisibleMatter(dossiers, body.matterId);
    const now = new Date().toISOString();
    const relationship = await options.repository.createContactRelationship({
      id: `contact-relationship-${randomUUID()}`,
      firmId: request.auth.firmId,
      contactId: params.contactId,
      relatedContactId: body.relatedContactId,
      relationshipKind: body.relationshipKind,
      label: body.label,
      reciprocalLabel: body.reciprocalLabel,
      matterId: body.matterId,
      source: body.source,
      status: body.status,
      effectiveOn: body.effectiveOn,
      endedOn: body.endedOn,
      notes: body.notes,
      privateNotes: body.privateNotes,
      includeInConflictCheck: body.includeInConflictCheck,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
    });
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact.relationship.created",
      resourceType: "contact_relationship",
      resourceId: relationship.id,
      metadata: {
        contactId: relationship.contactId,
        relatedContactId: relationship.relatedContactId,
        matterId: relationship.matterId,
        relationshipKind: relationship.relationshipKind,
      },
    });
    return reply.code(201).send({ relationship });
  });

  server.patch("/api/contacts/:contactId/relationships/:relationshipId", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(relationshipParamsSchema, request.params, "params");
    const body = parseRequestPart(relationshipUpdateBodySchema, request.body, "body");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    findVisibleDossier(dossiers, params.contactId);
    if (body.matterId) assertVisibleMatter(dossiers, body.matterId);
    const relationship = await options.repository.updateContactRelationship({
      firmId: request.auth.firmId,
      relationshipId: params.relationshipId,
      updates: { ...body, updatedByUserId: request.auth.user.id },
    });
    if (!relationship || relationship.contactId !== params.contactId) {
      throw new ApiHttpError(404, "CONTACT_RELATIONSHIP_NOT_FOUND", "Relationship was not found");
    }
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact.relationship.updated",
      resourceType: "contact_relationship",
      resourceId: relationship.id,
      metadata: {
        contactId: relationship.contactId,
        relatedContactId: relationship.relatedContactId,
        matterId: relationship.matterId,
        status: relationship.status,
      },
    });
    return { relationship };
  });

  server.post("/api/contacts/:contactId/matter-associations", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const body = parseRequestPart(matterAssociationCreateBodySchema, request.body, "body");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    findVisibleDossier(dossiers, params.contactId);
    assertVisibleMatter(dossiers, body.matterId);
    const now = new Date().toISOString();
    const association: MatterParty = await options.repository.createMatterContactAssociation({
      id: `matter-party-${randomUUID()}`,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      contactId: params.contactId,
      role: body.role,
      adverse: body.adverse,
      confidential: body.confidential,
      status: body.status,
      side: body.side,
      startedOn: body.startedOn,
      endedOn: body.endedOn,
      notes: body.notes,
      privateNotes: body.privateNotes,
      conflictCheckIncluded: body.conflictCheckIncluded,
      createdAt: now,
      updatedAt: now,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
    });
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact.matter_association.created",
      resourceType: "matter_party",
      resourceId: association.id,
      metadata: {
        contactId: association.contactId,
        matterId: association.matterId,
        role: association.role,
        adverse: association.adverse,
        confidential: association.confidential,
      },
    });
    return reply.code(201).send({ association });
  });

  server.patch("/api/contacts/:contactId/matter-associations/:associationId", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(matterAssociationParamsSchema, request.params, "params");
    const body = parseRequestPart(matterAssociationUpdateBodySchema, request.body, "body");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    const dossier = findVisibleDossier(dossiers, params.contactId);
    const visibleAssociation = dossier.matters.find(
      (matter) => matter.associationId === params.associationId,
    );
    if (!visibleAssociation) {
      throw new ApiHttpError(
        403,
        "CONTACT_MATTER_NOT_VISIBLE",
        "Matter association is not visible",
      );
    }
    const association = await options.repository.updateMatterContactAssociation({
      firmId: request.auth.firmId,
      associationId: params.associationId,
      updates: { ...body, updatedByUserId: request.auth.user.id },
    });
    if (!association || association.contactId !== params.contactId) {
      throw new ApiHttpError(
        404,
        "MATTER_CONTACT_ASSOCIATION_NOT_FOUND",
        "Association was not found",
      );
    }
    assertVisibleMatter(dossiers, association.matterId);
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact.matter_association.updated",
      resourceType: "matter_party",
      resourceId: association.id,
      metadata: {
        contactId: association.contactId,
        matterId: association.matterId,
        role: association.role,
        status: association.status ?? "active",
      },
    });
    return { association };
  });

  server.get("/api/contacts/:contactId/portal-access", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    findVisibleDossier(dossiers, params.contactId);
    const grants = await options.repository.listContactPortalGrantsForUser(
      request.auth.user,
      params.contactId,
    );
    return { grants };
  });

  server.post("/api/contacts/:contactId/portal-access", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "client_portal", action: "create" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const body = parseRequestPart(portalGrantCreateBodySchema, request.body, "body");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    findVisibleDossier(dossiers, params.contactId);
    assertVisibleMatter(dossiers, body.matterId);
    const now = new Date().toISOString();
    const grant = await options.repository.createPortalGrant({
      id: `portal-grant-${randomUUID()}`,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      contactId: params.contactId,
      accountUserId: body.accountUserId,
      grantedByUserId: request.auth.user.id,
      status: body.status,
      permissions: Array.from(new Set(body.permissions)) as PortalGrant["permissions"],
      expiresAt: body.expiresAt,
      invitedAt: body.status === "invited" ? now : undefined,
      activatedAt: body.status === "active" ? now : undefined,
      createdAt: now,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "portal.grant.invited",
      resourceType: "portal_grant",
      resourceId: grant.id,
      metadata: {
        contactId: grant.contactId,
        matterId: grant.matterId,
        status: grant.status ?? "active",
        permissions: grant.permissions,
        invitationLinkAvailable: true,
        outboundEmailSent: false,
      },
    });
    return reply.code(201).send({ grant, invitationLink: `/portal/invitations/${grant.id}` });
  });

  server.patch("/api/contacts/:contactId/portal-access/:grantId", async (request) => {
    const access = requireAccess(request.auth, { resource: "client_portal", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(portalGrantParamsSchema, request.params, "params");
    const body = parseRequestPart(portalGrantUpdateBodySchema, request.body, "body");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    findVisibleDossier(dossiers, params.contactId);
    const currentGrants = await options.repository.listContactPortalGrantsForUser(
      request.auth.user,
      params.contactId,
    );
    const currentGrant = currentGrants.find((grant) => grant.id === params.grantId);
    if (!currentGrant) {
      throw new ApiHttpError(404, "PORTAL_GRANT_NOT_FOUND", "Portal grant was not found");
    }
    const now = new Date().toISOString();
    const grant = await options.repository.updatePortalGrant({
      firmId: request.auth.firmId,
      id: params.grantId,
      updates: {
        ...body,
        ...(body.permissions
          ? { permissions: Array.from(new Set(body.permissions)) as PortalGrant["permissions"] }
          : {}),
        ...(body.status === "active" && !body.activatedAt ? { activatedAt: now } : {}),
        ...(body.status === "invited" && !body.invitedAt ? { invitedAt: now } : {}),
        ...(body.status === "suspended" && !body.suspendedAt ? { suspendedAt: now } : {}),
        ...(body.status === "revoked" && !body.revokedAt ? { revokedAt: now } : {}),
        revokedByUserId:
          body.status === "revoked"
            ? request.auth.user.id
            : body.revokedAt
              ? request.auth.user.id
              : undefined,
        updatedByUserId: request.auth.user.id,
      },
    });
    if (!grant || grant.contactId !== params.contactId) {
      throw new ApiHttpError(404, "PORTAL_GRANT_NOT_FOUND", "Portal grant was not found");
    }
    await appendRouteAuditEvent(options.repository, request.auth, {
      action:
        grant.status === "suspended"
          ? "portal.grant.suspended"
          : grant.status === "revoked"
            ? "portal.grant.revoked"
            : "portal.grant.updated",
      resourceType: "portal_grant",
      resourceId: grant.id,
      metadata: {
        contactId: grant.contactId,
        matterId: grant.matterId,
        status: grant.status ?? "active",
        permissions: grant.permissions,
      },
    });
    return { grant };
  });

  server.get("/api/contacts/:contactId/timeline", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactParamsSchema, request.params, "params");
    const query = parseRequestPart(contactTimelineQuerySchema, request.query, "query");
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    findVisibleDossier(dossiers, params.contactId);
    const timeline = await options.repository.listContactTimelineForUser(
      request.auth.user,
      params.contactId,
    );
    return { timeline: filterContactTimelineEntries(timeline, query.activity) };
  });
}
