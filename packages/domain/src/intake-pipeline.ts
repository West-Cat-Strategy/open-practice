import type { CalendarEventRecord } from "./models.js";
import type { PublicConsultationIntakeRecord } from "./operations.js";
import type { IntakeFormLinkRecord, IntakeFormReviewRecord } from "./intake.js";
import type { IntakeSessionRecord } from "./signatures.js";

export type IntakePipelineSourceType = "public_consultation" | "intake_session";

export type IntakePipelineLeadStatus =
  | "new"
  | "contacted"
  | "conflict_review"
  | "qualified"
  | "converted"
  | "closed";

export type IntakePipelineConflictReviewPosture =
  | "not_started"
  | "needs_review"
  | "reviewing"
  | "reviewed";

export interface IntakePipelineSourceAttribution {
  type: IntakePipelineSourceType;
  label: string;
  channel: "website" | "staff_intake";
  sourceUrlPresent: boolean;
}

export interface IntakePipelineRequestLink {
  kind: "public_consultation" | "intake_form" | "interview";
  id?: string;
  status: "pending" | "active" | "submitted" | "reviewed" | "revoked" | "available";
  createdAt?: string;
  submittedAt?: string;
  urlPresent?: boolean;
}

export interface IntakePipelineAppointmentLink {
  eventId: string;
  matterId: string;
  startsAt: string;
  status: CalendarEventRecord["status"];
}

export interface IntakePipelineLeadRecord {
  id: string;
  firmId: string;
  sourceType: IntakePipelineSourceType;
  sourceRecordId: string;
  matterId?: string;
  displayName: string;
  leadStatus: IntakePipelineLeadStatus;
  sourceAttribution: IntakePipelineSourceAttribution;
  conflictReview: {
    posture: IntakePipelineConflictReviewPosture;
    opposingPartyCount: number;
  };
  requestLinks: IntakePipelineRequestLink[];
  appointmentLinks: IntakePipelineAppointmentLink[];
  convertedMatterId?: string;
  conversionCount: number;
  createdAt: string;
  updatedAt: string;
  auditSafe: true;
}

export interface IntakePipelineSummary {
  totalLeads: number;
  conversionCount: number;
  byLeadStatus: Record<IntakePipelineLeadStatus, number>;
  bySourceType: Record<IntakePipelineSourceType, number>;
  conflictReview: Record<IntakePipelineConflictReviewPosture, number>;
}

export interface IntakePipelineSnapshot {
  leads: IntakePipelineLeadRecord[];
  summary: IntakePipelineSummary;
}

export interface BuildIntakePipelineSnapshotInput {
  publicConsultationIntakes: PublicConsultationIntakeRecord[];
  intakeSessions: IntakeSessionRecord[];
  intakeFormLinks: IntakeFormLinkRecord[];
  intakeFormReviews: IntakeFormReviewRecord[];
  calendarEvents: CalendarEventRecord[];
}

const leadStatuses = [
  "new",
  "contacted",
  "conflict_review",
  "qualified",
  "converted",
  "closed",
] as const satisfies readonly IntakePipelineLeadStatus[];

const sourceTypes = [
  "public_consultation",
  "intake_session",
] as const satisfies readonly IntakePipelineSourceType[];

const conflictPostures = [
  "not_started",
  "needs_review",
  "reviewing",
  "reviewed",
] as const satisfies readonly IntakePipelineConflictReviewPosture[];

function zeroCounts<T extends string>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

const safeSourceLabelPattern = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;

function safeMetadataLabel(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return safeSourceLabelPattern.test(trimmed) ? trimmed : undefined;
}

function publicLeadStatus(intake: PublicConsultationIntakeRecord): IntakePipelineLeadStatus {
  if (intake.status === "converted") return "converted";
  if (intake.status === "dismissed") return "closed";
  if (intake.opposingPartyNames.length > 0) return "conflict_review";
  return "new";
}

function publicConflictPosture(
  intake: PublicConsultationIntakeRecord,
): IntakePipelineConflictReviewPosture {
  if (intake.status !== "pending" || intake.reviewedAt) return "reviewed";
  return intake.opposingPartyNames.length > 0 ? "needs_review" : "not_started";
}

function formLinkStatus(link: IntakeFormLinkRecord): IntakePipelineRequestLink["status"] {
  if (link.revokedAt) return "revoked";
  if (link.submittedAt) return "submitted";
  return "active";
}

function intakeLeadStatus(input: {
  linkCount: number;
  submittedCount: number;
  reviews: IntakeFormReviewRecord[];
}): IntakePipelineLeadStatus {
  if (input.reviews.some((review) => review.decision === "accepted")) return "converted";
  if (input.reviews.some((review) => review.decision === "rejected")) return "closed";
  if (input.reviews.some((review) => review.decision === "request_more_info")) return "contacted";
  if (input.submittedCount > 0) return "qualified";
  if (input.linkCount > 0) return "contacted";
  return "new";
}

function intakeConflictPosture(input: {
  submittedCount: number;
  reviewCount: number;
}): IntakePipelineConflictReviewPosture {
  if (input.reviewCount > 0) return "reviewed";
  if (input.submittedCount > 0) return "reviewing";
  return "not_started";
}

function publicConsultationLead(intake: PublicConsultationIntakeRecord): IntakePipelineLeadRecord {
  const sourceLabel = safeMetadataLabel(intake.metadata, "source") ?? "public_consultation_form";
  return {
    id: `public-consultation:${intake.id}`,
    firmId: intake.firmId,
    sourceType: "public_consultation",
    sourceRecordId: intake.id,
    displayName: intake.clientName,
    leadStatus: publicLeadStatus(intake),
    sourceAttribution: {
      type: "public_consultation",
      label: sourceLabel,
      channel: "website",
      sourceUrlPresent: Boolean(intake.sourceUrl),
    },
    conflictReview: {
      posture: publicConflictPosture(intake),
      opposingPartyCount: intake.opposingPartyNames.length,
    },
    requestLinks: [
      {
        kind: "public_consultation",
        id: intake.id,
        status: intake.status === "pending" ? "pending" : "reviewed",
        submittedAt: intake.submittedAt,
        urlPresent: Boolean(intake.sourceUrl),
      },
    ],
    appointmentLinks: [],
    convertedMatterId: intake.convertedMatterId,
    conversionCount: intake.convertedMatterId ? 1 : 0,
    createdAt: intake.submittedAt,
    updatedAt: intake.reviewedAt ?? intake.submittedAt,
    auditSafe: true,
  };
}

function intakeSessionLead(input: {
  session: IntakeSessionRecord;
  links: IntakeFormLinkRecord[];
  reviews: IntakeFormReviewRecord[];
  events: CalendarEventRecord[];
}): IntakePipelineLeadRecord {
  const submittedCount = input.links.filter((link) => link.submittedAt).length;
  const sourceLabel =
    safeMetadataLabel(input.session.evidence, "source") ?? `intake_${input.session.provider}`;
  const conversionCount = input.reviews.filter((review) => review.decision === "accepted").length;
  const appointmentLinks = input.events
    .filter((event) => !event.deletedAt)
    .map((event) => ({
      eventId: event.id,
      matterId: event.matterId,
      startsAt: event.startsAt,
      status: event.status,
    }));

  return {
    id: `intake-session:${input.session.id}`,
    firmId: input.session.firmId,
    sourceType: "intake_session",
    sourceRecordId: input.session.id,
    matterId: input.session.matterId,
    displayName: input.session.clientContactId ?? input.session.matterId,
    leadStatus: intakeLeadStatus({
      linkCount: input.links.length,
      submittedCount,
      reviews: input.reviews,
    }),
    sourceAttribution: {
      type: "intake_session",
      label: sourceLabel,
      channel: "staff_intake",
      sourceUrlPresent: Boolean(input.session.interviewUrl),
    },
    conflictReview: {
      posture: intakeConflictPosture({
        submittedCount,
        reviewCount: input.reviews.length,
      }),
      opposingPartyCount: 0,
    },
    requestLinks: [
      ...(input.session.interviewUrl
        ? [
            {
              kind: "interview" as const,
              id: input.session.id,
              status: "available" as const,
              createdAt: input.session.createdAt,
              urlPresent: true,
            },
          ]
        : []),
      ...input.links.map((link) => ({
        kind: "intake_form" as const,
        id: link.id,
        status: formLinkStatus(link),
        createdAt: link.createdAt,
        submittedAt: link.submittedAt,
        urlPresent: false,
      })),
    ],
    appointmentLinks,
    convertedMatterId: conversionCount > 0 ? input.session.matterId : undefined,
    conversionCount,
    createdAt: input.session.createdAt,
    updatedAt: input.session.updatedAt,
    auditSafe: true,
  };
}

function summarize(leads: IntakePipelineLeadRecord[]): IntakePipelineSummary {
  const summary: IntakePipelineSummary = {
    totalLeads: leads.length,
    conversionCount: 0,
    byLeadStatus: zeroCounts(leadStatuses),
    bySourceType: zeroCounts(sourceTypes),
    conflictReview: zeroCounts(conflictPostures),
  };
  for (const lead of leads) {
    summary.conversionCount += lead.conversionCount;
    summary.byLeadStatus[lead.leadStatus] += 1;
    summary.bySourceType[lead.sourceType] += 1;
    summary.conflictReview[lead.conflictReview.posture] += 1;
  }
  return summary;
}

export function buildIntakePipelineSnapshot(
  input: BuildIntakePipelineSnapshotInput,
): IntakePipelineSnapshot {
  const linksBySessionId = new Map<string, IntakeFormLinkRecord[]>();
  for (const link of input.intakeFormLinks) {
    const existing = linksBySessionId.get(link.intakeSessionId) ?? [];
    existing.push(link);
    linksBySessionId.set(link.intakeSessionId, existing);
  }

  const reviewsBySessionId = new Map<string, IntakeFormReviewRecord[]>();
  for (const review of input.intakeFormReviews) {
    const existing = reviewsBySessionId.get(review.intakeSessionId) ?? [];
    existing.push(review);
    reviewsBySessionId.set(review.intakeSessionId, existing);
  }

  const eventsByMatterId = new Map<string, CalendarEventRecord[]>();
  for (const event of input.calendarEvents) {
    const existing = eventsByMatterId.get(event.matterId) ?? [];
    existing.push(event);
    eventsByMatterId.set(event.matterId, existing);
  }

  const leads = [
    ...input.publicConsultationIntakes.map(publicConsultationLead),
    ...input.intakeSessions.map((session) =>
      intakeSessionLead({
        session,
        links: linksBySessionId.get(session.id) ?? [],
        reviews: reviewsBySessionId.get(session.id) ?? [],
        events: eventsByMatterId.get(session.matterId) ?? [],
      }),
    ),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    leads,
    summary: summarize(leads),
  };
}
