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

export type IntakePipelineSourceLabelOrigin = "metadata" | "default";

export interface IntakePipelineSourceAttribution {
  type: IntakePipelineSourceType;
  label: string;
  labelOrigin: IntakePipelineSourceLabelOrigin;
  channel: "website" | "staff_intake";
  sourceUrlPresent: boolean;
}

export type IntakePipelineFollowUpAction =
  | "review_conflict"
  | "review_public_request"
  | "review_submitted_intake"
  | "send_follow_up_form"
  | "schedule_consultation"
  | "confirm_conversion"
  | "none";

export type IntakePipelineFollowUpPosture =
  | "staff_review"
  | "waiting_on_client"
  | "consultation_scheduled"
  | "converted"
  | "closed";

export type IntakePipelineFollowUpPriority = "high" | "normal" | "low";

export type IntakePipelineSourceAttributionQuality = "tracked" | "defaulted";

export type IntakePipelineSubmissionsOperationStatus =
  | "pending_staff_review"
  | "conflict_review"
  | "waiting_on_client"
  | "scheduled_consultation"
  | "converted"
  | "closed";

export type IntakePipelineSubmissionsAssignmentPosture =
  | "review_owner_assigned"
  | "matter_assigned"
  | "firm_queue"
  | "unassigned";

export interface IntakePipelineFollowUpAutomationBoundary {
  automaticMatterCreation: false;
  campaignAutomation: false;
  smsDelivery: false;
  bulkDelivery: false;
  adSpendIngestion: false;
  automaticClientContact: false;
}

export interface IntakePipelineFollowUpReview {
  action: IntakePipelineFollowUpAction;
  posture: IntakePipelineFollowUpPosture;
  priority: IntakePipelineFollowUpPriority;
  reason: string;
  lastActivityAt: string;
  sourceQuality: IntakePipelineSourceAttributionQuality;
  automationBoundary: IntakePipelineFollowUpAutomationBoundary;
  auditSafe: true;
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
  followUpReview: IntakePipelineFollowUpReview;
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
  followUpReview: {
    totalItems: number;
    highPriorityCount: number;
    sourceUrlPresentCount: number;
    defaultedSourceCount: number;
    byAction: Record<IntakePipelineFollowUpAction, number>;
    byPosture: Record<IntakePipelineFollowUpPosture, number>;
    automationBoundary: IntakePipelineFollowUpAutomationBoundary;
  };
}

export type IntakePipelineRequestLinkStatus = IntakePipelineRequestLink["status"];
export type IntakePipelineAppointmentStatus = CalendarEventRecord["status"];

export interface IntakePipelineSubmissionsOperationRow {
  id: string;
  sourceType: IntakePipelineSourceType;
  sourceLabel: string;
  displayName: string;
  matterId?: string;
  status: IntakePipelineSubmissionsOperationStatus;
  assignmentPosture: IntakePipelineSubmissionsAssignmentPosture;
  leadStatus: IntakePipelineLeadStatus;
  conflictPosture: IntakePipelineConflictReviewPosture;
  opposingPartyCount: number;
  followUpAction: IntakePipelineFollowUpAction;
  followUpPosture: IntakePipelineFollowUpPosture;
  followUpPriority: IntakePipelineFollowUpPriority;
  lastActivityAt: string;
  sourceQuality: IntakePipelineSourceAttributionQuality;
  requestLinkCount: number;
  requestLinkStatuses: Record<IntakePipelineRequestLinkStatus, number>;
  appointmentCount: number;
  appointmentStatuses: Record<IntakePipelineAppointmentStatus, number>;
  conversionCount: number;
  exportSafeSummary: string;
  automationBoundary: IntakePipelineFollowUpAutomationBoundary;
  auditSafe: true;
}

export interface IntakePipelineSubmissionsOperationsSummary {
  totalSubmissions: number;
  pendingStaffReviewCount: number;
  conflictReviewCount: number;
  waitingOnClientCount: number;
  scheduledConsultationCount: number;
  convertedCount: number;
  closedCount: number;
  assignedCount: number;
  unassignedCount: number;
  highPriorityCount: number;
  defaultedSourceCount: number;
  byStatus: Record<IntakePipelineSubmissionsOperationStatus, number>;
  byAssignmentPosture: Record<IntakePipelineSubmissionsAssignmentPosture, number>;
  automationBoundary: IntakePipelineFollowUpAutomationBoundary;
}

export interface IntakePipelineSubmissionsOperations {
  summary: IntakePipelineSubmissionsOperationsSummary;
  rows: IntakePipelineSubmissionsOperationRow[];
  auditSafe: true;
}

export interface IntakePipelineSnapshot {
  leads: IntakePipelineLeadRecord[];
  summary: IntakePipelineSummary;
  submissionsOperations: IntakePipelineSubmissionsOperations;
}

export interface BuildIntakePipelineSnapshotInput {
  publicConsultationIntakes: PublicConsultationIntakeRecord[];
  intakeSessions: IntakeSessionRecord[];
  intakeFormLinks: IntakeFormLinkRecord[];
  intakeFormReviews: IntakeFormReviewRecord[];
  calendarEvents: CalendarEventRecord[];
  publicConsultationReviewOwnerUserId?: string;
  assignedMatterIds?: string[];
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

const followUpActions = [
  "review_conflict",
  "review_public_request",
  "review_submitted_intake",
  "send_follow_up_form",
  "schedule_consultation",
  "confirm_conversion",
  "none",
] as const satisfies readonly IntakePipelineFollowUpAction[];

const followUpPostures = [
  "staff_review",
  "waiting_on_client",
  "consultation_scheduled",
  "converted",
  "closed",
] as const satisfies readonly IntakePipelineFollowUpPosture[];

const submissionsOperationStatuses = [
  "pending_staff_review",
  "conflict_review",
  "waiting_on_client",
  "scheduled_consultation",
  "converted",
  "closed",
] as const satisfies readonly IntakePipelineSubmissionsOperationStatus[];

const submissionsAssignmentPostures = [
  "review_owner_assigned",
  "matter_assigned",
  "firm_queue",
  "unassigned",
] as const satisfies readonly IntakePipelineSubmissionsAssignmentPosture[];

const requestLinkStatuses = [
  "pending",
  "active",
  "submitted",
  "reviewed",
  "revoked",
  "available",
] as const satisfies readonly IntakePipelineRequestLinkStatus[];

const appointmentStatuses = [
  "confirmed",
  "tentative",
  "cancelled",
] as const satisfies readonly IntakePipelineAppointmentStatus[];

function zeroCounts<T extends string>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

const safeSourceLabelPattern = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;
const noFollowUpAutomationBoundary: IntakePipelineFollowUpAutomationBoundary = {
  automaticMatterCreation: false,
  campaignAutomation: false,
  smsDelivery: false,
  bulkDelivery: false,
  adSpendIngestion: false,
  automaticClientContact: false,
};

function safeMetadataLabel(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return safeSourceLabelPattern.test(trimmed) ? trimmed : undefined;
}

function safeSourceAttribution(input: {
  metadata: Record<string, unknown>;
  key: string;
  fallback: string;
  type: IntakePipelineSourceType;
  channel: IntakePipelineSourceAttribution["channel"];
  sourceUrlPresent: boolean;
}): IntakePipelineSourceAttribution {
  const label = safeMetadataLabel(input.metadata, input.key);
  return {
    type: input.type,
    label: label ?? input.fallback,
    labelOrigin: label ? "metadata" : "default",
    channel: input.channel,
    sourceUrlPresent: input.sourceUrlPresent,
  };
}

function sourceQuality(
  sourceAttribution: IntakePipelineSourceAttribution,
): IntakePipelineSourceAttributionQuality {
  return sourceAttribution.labelOrigin === "metadata" || sourceAttribution.sourceUrlPresent
    ? "tracked"
    : "defaulted";
}

function buildFollowUpReview(input: {
  action: IntakePipelineFollowUpAction;
  posture: IntakePipelineFollowUpPosture;
  priority: IntakePipelineFollowUpPriority;
  reason: string;
  lastActivityAt: string;
  sourceAttribution: IntakePipelineSourceAttribution;
}): IntakePipelineFollowUpReview {
  return {
    action: input.action,
    posture: input.posture,
    priority: input.priority,
    reason: input.reason,
    lastActivityAt: input.lastActivityAt,
    sourceQuality: sourceQuality(input.sourceAttribution),
    automationBoundary: noFollowUpAutomationBoundary,
    auditSafe: true,
  };
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

function publicFollowUpReview(
  intake: PublicConsultationIntakeRecord,
  sourceAttribution: IntakePipelineSourceAttribution,
): IntakePipelineFollowUpReview {
  if (intake.status === "converted") {
    return buildFollowUpReview({
      action: "confirm_conversion",
      posture: "converted",
      priority: "low",
      reason: "Converted request ready for source attribution review",
      lastActivityAt: intake.reviewedAt ?? intake.submittedAt,
      sourceAttribution,
    });
  }
  if (intake.status === "dismissed") {
    return buildFollowUpReview({
      action: "none",
      posture: "closed",
      priority: "low",
      reason: "Closed request retained for source reporting",
      lastActivityAt: intake.reviewedAt ?? intake.submittedAt,
      sourceAttribution,
    });
  }
  if (intake.opposingPartyNames.length > 0) {
    return buildFollowUpReview({
      action: "review_conflict",
      posture: "staff_review",
      priority: "high",
      reason: "Conflict review required before follow-up",
      lastActivityAt: intake.submittedAt,
      sourceAttribution,
    });
  }
  return buildFollowUpReview({
    action: "review_public_request",
    posture: "staff_review",
    priority: "normal",
    reason: "Public request ready for staff follow-up review",
    lastActivityAt: intake.submittedAt,
    sourceAttribution,
  });
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

function intakeFollowUpReview(input: {
  sourceAttribution: IntakePipelineSourceAttribution;
  createdAt: string;
  updatedAt: string;
  links: IntakeFormLinkRecord[];
  reviews: IntakeFormReviewRecord[];
  submittedCount: number;
  appointmentCount: number;
}): IntakePipelineFollowUpReview {
  if (input.reviews.some((review) => review.decision === "accepted")) {
    const latestAcceptedReview = input.reviews
      .filter((review) => review.decision === "accepted")
      .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt))[0];
    return buildFollowUpReview({
      action: "confirm_conversion",
      posture: "converted",
      priority: "low",
      reason: "Accepted intake retained for source attribution review",
      lastActivityAt: latestAcceptedReview?.decidedAt ?? input.updatedAt,
      sourceAttribution: input.sourceAttribution,
    });
  }
  if (input.reviews.some((review) => review.decision === "rejected")) {
    const latestRejectedReview = input.reviews
      .filter((review) => review.decision === "rejected")
      .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt))[0];
    return buildFollowUpReview({
      action: "none",
      posture: "closed",
      priority: "low",
      reason: "Rejected intake retained for source reporting",
      lastActivityAt: latestRejectedReview?.decidedAt ?? input.updatedAt,
      sourceAttribution: input.sourceAttribution,
    });
  }
  if (input.submittedCount > input.reviews.length) {
    const latestSubmission = input.links
      .filter((link) => link.submittedAt)
      .sort((left, right) => (right.submittedAt ?? "").localeCompare(left.submittedAt ?? ""))[0];
    return buildFollowUpReview({
      action: "review_submitted_intake",
      posture: "staff_review",
      priority: "high",
      reason: "Submitted intake ready for staff review",
      lastActivityAt: latestSubmission?.submittedAt ?? input.updatedAt,
      sourceAttribution: input.sourceAttribution,
    });
  }
  if (input.reviews.some((review) => review.decision === "request_more_info")) {
    const latestReview = input.reviews
      .filter((review) => review.decision === "request_more_info")
      .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt))[0];
    return buildFollowUpReview({
      action: "send_follow_up_form",
      posture: "waiting_on_client",
      priority: "normal",
      reason: "More-information request is awaiting client response",
      lastActivityAt: latestReview?.decidedAt ?? input.updatedAt,
      sourceAttribution: input.sourceAttribution,
    });
  }
  if (input.appointmentCount > 0) {
    return buildFollowUpReview({
      action: "schedule_consultation",
      posture: "consultation_scheduled",
      priority: "low",
      reason: "Consultation appointment is scheduled for staff review",
      lastActivityAt: input.updatedAt,
      sourceAttribution: input.sourceAttribution,
    });
  }
  if (input.links.length > 0) {
    const latestLink = [...input.links].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )[0];
    return buildFollowUpReview({
      action: "send_follow_up_form",
      posture: "waiting_on_client",
      priority: "normal",
      reason: "Intake form is awaiting client response",
      lastActivityAt: latestLink?.createdAt ?? input.updatedAt,
      sourceAttribution: input.sourceAttribution,
    });
  }
  return buildFollowUpReview({
    action: "schedule_consultation",
    posture: "staff_review",
    priority: "normal",
    reason: "Lead is ready for manual consultation follow-up",
    lastActivityAt: input.createdAt,
    sourceAttribution: input.sourceAttribution,
  });
}

function publicConsultationLead(intake: PublicConsultationIntakeRecord): IntakePipelineLeadRecord {
  const sourceAttribution = safeSourceAttribution({
    metadata: intake.metadata,
    key: "source",
    fallback: "public_consultation_form",
    type: "public_consultation",
    channel: "website",
    sourceUrlPresent: Boolean(intake.sourceUrl),
  });
  return {
    id: `public-consultation:${intake.id}`,
    firmId: intake.firmId,
    sourceType: "public_consultation",
    sourceRecordId: intake.id,
    displayName: intake.clientName,
    leadStatus: publicLeadStatus(intake),
    sourceAttribution,
    conflictReview: {
      posture: publicConflictPosture(intake),
      opposingPartyCount: intake.opposingPartyNames.length,
    },
    followUpReview: publicFollowUpReview(intake, sourceAttribution),
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
  const sourceAttribution = safeSourceAttribution({
    metadata: input.session.evidence,
    key: "source",
    fallback: `intake_${input.session.provider}`,
    type: "intake_session",
    channel: "staff_intake",
    sourceUrlPresent: Boolean(input.session.interviewUrl),
  });
  const conversionCount = input.reviews.filter((review) => review.decision === "accepted").length;
  const appointmentLinks = input.events
    .filter((event): event is CalendarEventRecord & { matterId: string } =>
      Boolean(event.matterId && !event.deletedAt),
    )
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
    sourceAttribution,
    conflictReview: {
      posture: intakeConflictPosture({
        submittedCount,
        reviewCount: input.reviews.length,
      }),
      opposingPartyCount: 0,
    },
    followUpReview: intakeFollowUpReview({
      sourceAttribution,
      createdAt: input.session.createdAt,
      updatedAt: input.session.updatedAt,
      links: input.links,
      reviews: input.reviews,
      submittedCount,
      appointmentCount: appointmentLinks.length,
    }),
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
    followUpReview: {
      totalItems: leads.length,
      highPriorityCount: 0,
      sourceUrlPresentCount: 0,
      defaultedSourceCount: 0,
      byAction: zeroCounts(followUpActions),
      byPosture: zeroCounts(followUpPostures),
      automationBoundary: noFollowUpAutomationBoundary,
    },
  };
  for (const lead of leads) {
    summary.conversionCount += lead.conversionCount;
    summary.byLeadStatus[lead.leadStatus] += 1;
    summary.bySourceType[lead.sourceType] += 1;
    summary.conflictReview[lead.conflictReview.posture] += 1;
    if (lead.followUpReview.priority === "high") summary.followUpReview.highPriorityCount += 1;
    if (lead.sourceAttribution.sourceUrlPresent) summary.followUpReview.sourceUrlPresentCount += 1;
    if (lead.followUpReview.sourceQuality === "defaulted") {
      summary.followUpReview.defaultedSourceCount += 1;
    }
    summary.followUpReview.byAction[lead.followUpReview.action] += 1;
    summary.followUpReview.byPosture[lead.followUpReview.posture] += 1;
  }
  return summary;
}

function submissionsOperationStatus(
  lead: IntakePipelineLeadRecord,
): IntakePipelineSubmissionsOperationStatus {
  if (lead.followUpReview.posture === "converted") return "converted";
  if (lead.followUpReview.posture === "closed") return "closed";
  if (lead.followUpReview.posture === "waiting_on_client") return "waiting_on_client";
  if (lead.followUpReview.posture === "consultation_scheduled") return "scheduled_consultation";
  if (lead.followUpReview.action === "review_conflict") return "conflict_review";
  return "pending_staff_review";
}

function submissionsAssignmentPosture(input: {
  lead: IntakePipelineLeadRecord;
  publicConsultationReviewOwnerUserId?: string;
  assignedMatterIds: Set<string>;
}): IntakePipelineSubmissionsAssignmentPosture {
  if (input.lead.sourceType === "public_consultation") {
    return input.publicConsultationReviewOwnerUserId ? "review_owner_assigned" : "unassigned";
  }
  if (input.lead.matterId && input.assignedMatterIds.has(input.lead.matterId)) {
    return "matter_assigned";
  }
  return input.lead.matterId ? "firm_queue" : "unassigned";
}

function operationPriorityRank(row: IntakePipelineSubmissionsOperationRow): number {
  if (row.followUpPriority === "high" && row.status === "conflict_review") return 0;
  if (row.followUpPriority === "high" && row.status === "pending_staff_review") return 1;
  if (row.status === "pending_staff_review") return 2;
  if (row.status === "waiting_on_client") return 3;
  if (row.status === "scheduled_consultation") return 4;
  if (row.status === "converted") return 5;
  return 6;
}

function statusCounts<T extends string>(
  values: readonly T[],
  records: readonly T[],
): Record<T, number> {
  const counts = zeroCounts(values);
  for (const record of records) {
    counts[record] += 1;
  }
  return counts;
}

function operationSummaryText(input: {
  lead: IntakePipelineLeadRecord;
  status: IntakePipelineSubmissionsOperationStatus;
  assignmentPosture: IntakePipelineSubmissionsAssignmentPosture;
}): string {
  return [
    `${input.lead.displayName} ${input.status.replaceAll("_", " ")}`,
    `${input.lead.sourceAttribution.label} source`,
    `${input.lead.followUpReview.priority} priority`,
    `${input.assignmentPosture.replaceAll("_", " ")}`,
    `${input.lead.requestLinks.length} request links`,
    `${input.lead.appointmentLinks.length} appointments`,
    `${input.lead.conversionCount} conversions`,
  ].join(" · ");
}

function buildSubmissionsOperations(input: {
  leads: IntakePipelineLeadRecord[];
  publicConsultationReviewOwnerUserId?: string;
  assignedMatterIds?: string[];
}): IntakePipelineSubmissionsOperations {
  const assignedMatterIds = new Set(input.assignedMatterIds ?? []);
  const rows = input.leads
    .map((lead): IntakePipelineSubmissionsOperationRow => {
      const status = submissionsOperationStatus(lead);
      const assignmentPosture = submissionsAssignmentPosture({
        lead,
        publicConsultationReviewOwnerUserId: input.publicConsultationReviewOwnerUserId,
        assignedMatterIds,
      });
      return {
        id: lead.id,
        sourceType: lead.sourceType,
        sourceLabel: lead.sourceAttribution.label,
        displayName: lead.displayName,
        matterId: lead.matterId,
        status,
        assignmentPosture,
        leadStatus: lead.leadStatus,
        conflictPosture: lead.conflictReview.posture,
        opposingPartyCount: lead.conflictReview.opposingPartyCount,
        followUpAction: lead.followUpReview.action,
        followUpPosture: lead.followUpReview.posture,
        followUpPriority: lead.followUpReview.priority,
        lastActivityAt: lead.followUpReview.lastActivityAt,
        sourceQuality: lead.followUpReview.sourceQuality,
        requestLinkCount: lead.requestLinks.length,
        requestLinkStatuses: statusCounts(
          requestLinkStatuses,
          lead.requestLinks.map((link) => link.status),
        ),
        appointmentCount: lead.appointmentLinks.length,
        appointmentStatuses: statusCounts(
          appointmentStatuses,
          lead.appointmentLinks.map((appointment) => appointment.status),
        ),
        conversionCount: lead.conversionCount,
        exportSafeSummary: operationSummaryText({ lead, status, assignmentPosture }),
        automationBoundary: noFollowUpAutomationBoundary,
        auditSafe: true,
      };
    })
    .sort((left, right) => {
      const rank = operationPriorityRank(left) - operationPriorityRank(right);
      if (rank !== 0) return rank;
      return right.lastActivityAt.localeCompare(left.lastActivityAt);
    });

  const summary: IntakePipelineSubmissionsOperationsSummary = {
    totalSubmissions: rows.length,
    pendingStaffReviewCount: 0,
    conflictReviewCount: 0,
    waitingOnClientCount: 0,
    scheduledConsultationCount: 0,
    convertedCount: 0,
    closedCount: 0,
    assignedCount: 0,
    unassignedCount: 0,
    highPriorityCount: 0,
    defaultedSourceCount: 0,
    byStatus: zeroCounts(submissionsOperationStatuses),
    byAssignmentPosture: zeroCounts(submissionsAssignmentPostures),
    automationBoundary: noFollowUpAutomationBoundary,
  };

  for (const row of rows) {
    summary.byStatus[row.status] += 1;
    summary.byAssignmentPosture[row.assignmentPosture] += 1;
    if (row.status === "pending_staff_review") summary.pendingStaffReviewCount += 1;
    if (row.status === "conflict_review") summary.conflictReviewCount += 1;
    if (row.status === "waiting_on_client") summary.waitingOnClientCount += 1;
    if (row.status === "scheduled_consultation") summary.scheduledConsultationCount += 1;
    if (row.status === "converted") summary.convertedCount += 1;
    if (row.status === "closed") summary.closedCount += 1;
    if (row.assignmentPosture === "unassigned") {
      summary.unassignedCount += 1;
    } else {
      summary.assignedCount += 1;
    }
    if (row.followUpPriority === "high") summary.highPriorityCount += 1;
    if (row.sourceQuality === "defaulted") summary.defaultedSourceCount += 1;
  }

  return {
    summary,
    rows,
    auditSafe: true,
  };
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
    if (!event.matterId) continue;
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
    submissionsOperations: buildSubmissionsOperations({
      leads,
      publicConsultationReviewOwnerUserId: input.publicConsultationReviewOwnerUserId,
      assignedMatterIds: input.assignedMatterIds,
    }),
  };
}
