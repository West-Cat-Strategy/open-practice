import type {
  IntakePipelineDashboardResponse,
  IntakePipelineResponse,
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
  };
}

export function emptyIntakePipelineDashboard(
  status: IntakePipelineDashboardResponse["status"] = "unavailable",
): IntakePipelineDashboardResponse {
  return {
    leads: [],
    summary: emptyIntakePipelineSummary(),
    status,
  };
}

export function intakePipelineStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function intakePipelineSourceLabel(
  sourceType: IntakePipelineResponse["leads"][number]["sourceType"],
): string {
  return sourceType === "public_consultation" ? "Public consultation" : "Intake session";
}

export function intakePipelineSummaryLine(summary: IntakePipelineSummary): string {
  const needsReview = summary.conflictReview.needs_review + summary.conflictReview.reviewing;
  return `${summary.totalLeads} leads · ${summary.conversionCount} conversions · ${needsReview} conflict reviews`;
}
