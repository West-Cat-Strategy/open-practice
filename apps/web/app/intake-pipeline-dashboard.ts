import type {
  IntakePipelineDashboardResponse,
  IntakePipelineResponse,
  IntakePipelineSubmissionsOperations,
  IntakePipelineSummary,
} from "./types";

export function buildIntakePipelinePath(): string {
  return "/api/intake-pipeline";
}

export function emptyIntakePipelineSummary(): IntakePipelineSummary {
  return {
    totalLeads: 0,
    conversionCount: 0,
    byLeadStatus: {
      new: 0,
      contacted: 0,
      conflict_review: 0,
      qualified: 0,
      converted: 0,
      closed: 0,
    },
    bySourceType: {
      public_consultation: 0,
      intake_session: 0,
    },
    conflictReview: {
      not_started: 0,
      needs_review: 0,
      reviewing: 0,
      reviewed: 0,
    },
    followUpReview: {
      totalItems: 0,
      highPriorityCount: 0,
      sourceUrlPresentCount: 0,
      defaultedSourceCount: 0,
      byAction: {
        review_conflict: 0,
        review_public_request: 0,
        review_submitted_intake: 0,
        send_follow_up_form: 0,
        schedule_consultation: 0,
        confirm_conversion: 0,
        none: 0,
      },
      byPosture: {
        staff_review: 0,
        waiting_on_client: 0,
        consultation_scheduled: 0,
        converted: 0,
        closed: 0,
      },
      automationBoundary: {
        automaticMatterCreation: false,
        campaignAutomation: false,
        smsDelivery: false,
        bulkDelivery: false,
        adSpendIngestion: false,
        automaticClientContact: false,
      },
    },
  };
}

export function emptySubmissionsOperations(): IntakePipelineSubmissionsOperations {
  return {
    summary: {
      totalSubmissions: 0,
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
      byStatus: {
        pending_staff_review: 0,
        conflict_review: 0,
        waiting_on_client: 0,
        scheduled_consultation: 0,
        converted: 0,
        closed: 0,
      },
      byAssignmentPosture: {
        review_owner_assigned: 0,
        matter_assigned: 0,
        firm_queue: 0,
        unassigned: 0,
      },
      automationBoundary: {
        automaticMatterCreation: false,
        campaignAutomation: false,
        smsDelivery: false,
        bulkDelivery: false,
        adSpendIngestion: false,
        automaticClientContact: false,
      },
    },
    rows: [],
    auditSafe: true,
  };
}

export function emptyIntakePipelineDashboard(
  status: IntakePipelineDashboardResponse["status"] = "unavailable",
): IntakePipelineDashboardResponse {
  return {
    leads: [],
    summary: emptyIntakePipelineSummary(),
    submissionsOperations: emptySubmissionsOperations(),
    status,
  };
}

export function intakePipelineStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function intakePipelineFollowUpActionLabel(action: string): string {
  switch (action) {
    case "review_conflict":
      return "Conflict review";
    case "review_public_request":
      return "Review public request";
    case "review_submitted_intake":
      return "Review submitted intake";
    case "send_follow_up_form":
      return "Follow-up form review";
    case "schedule_consultation":
      return "Consultation follow-up";
    case "confirm_conversion":
      return "Conversion source check";
    case "none":
      return "No follow-up";
    default:
      return intakePipelineStatusLabel(action);
  }
}

export function intakePipelineSourceQualityLabel(quality: string): string {
  return quality === "tracked" ? "Source tracked" : "Source defaulted";
}

export function intakePipelineSubmissionsStatusLabel(status: string): string {
  switch (status) {
    case "pending_staff_review":
      return "Pending staff review";
    case "conflict_review":
      return "Conflict review";
    case "waiting_on_client":
      return "Waiting on client";
    case "scheduled_consultation":
      return "Consultation scheduled";
    case "converted":
      return "Converted";
    case "closed":
      return "Closed";
    default:
      return intakePipelineStatusLabel(status);
  }
}

export function intakePipelineAssignmentPostureLabel(posture: string): string {
  switch (posture) {
    case "review_owner_assigned":
      return "Review owner";
    case "matter_assigned":
      return "Matter assigned";
    case "firm_queue":
      return "Firm queue";
    case "unassigned":
      return "Unassigned";
    default:
      return intakePipelineStatusLabel(posture);
  }
}

export function intakePipelineSourceLabel(
  sourceType: IntakePipelineResponse["leads"][number]["sourceType"],
): string {
  return sourceType === "public_consultation" ? "Public consultation" : "Intake session";
}

export function intakePipelineSummaryLine(summary: IntakePipelineSummary): string {
  const needsReview = summary.conflictReview.needs_review + summary.conflictReview.reviewing;
  return `${summary.totalLeads} leads · ${summary.conversionCount} conversions · ${needsReview} conflict reviews · ${summary.followUpReview.highPriorityCount} high-priority follow-ups`;
}

export function intakePipelineSubmissionsSummaryLine(
  operations: IntakePipelineSubmissionsOperations,
): string {
  const summary = operations.summary;
  return `${summary.totalSubmissions} submissions · ${summary.pendingStaffReviewCount + summary.conflictReviewCount} staff reviews · ${summary.waitingOnClientCount} waiting · ${summary.unassignedCount} unassigned`;
}
