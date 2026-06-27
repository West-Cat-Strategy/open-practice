import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { blankIntakeFormDefinition } from "../intake-forms-dashboard";
import {
  emptyIntakePipelineSummary,
  emptySubmissionsOperations,
} from "../intake-pipeline-dashboard";
import type {
  IntakeFormsDashboardResponse,
  IntakePipelineDashboardResponse,
  IntakeSessionsResponse,
  IntakeVariableProposalsResponse,
  MatterSummary,
  PublicConsultationIntake,
  PublicConsultationIntakeSettings,
  SessionResponse,
} from "../types";
import { IntakeSection } from "./intake-section";

type IntakeSectionProps = Parameters<typeof IntakeSection>[0];

const syntheticMatter = {
  id: "matter_synthetic",
  firmId: "firm_synthetic",
  number: "OP-2026-001",
  title: "Synthetic intake matter",
  practiceArea: "Civil",
  status: "intake",
  jurisdiction: "BC",
  responsibleUserId: "user_synthetic",
  parties: [],
  documents: [],
  timeEntries: [],
  expenses: [],
  activity: [],
  lifecycleTransitions: [],
  trustBalanceCents: 0,
  setupProfile: {
    stage: {
      key: "intake",
      label: "Intake",
      description: "Synthetic intake stage.",
    },
    responsibleUser: {
      state: "assigned",
      responsibleUserId: "user_synthetic",
      responsibleUserDisplayName: "Synthetic Staff",
      assignedUserIds: ["user_synthetic"],
      assignedUserDisplayNames: ["Synthetic Staff"],
      label: "Assigned",
      description: "Synthetic responsible user posture.",
    },
    fieldDefinitions: [],
    checklist: [],
    financialSnapshot: {
      trustBalanceCents: 0,
      unbilledTimeEntryCount: 0,
      unbilledMinutes: 0,
      unbilledExpenseCount: 0,
      unbilledExpenseCents: 0,
      cues: [],
      caution: "Synthetic financial snapshot.",
    },
  },
} satisfies MatterSummary;

const syntheticSession: SessionResponse = {
  user: {
    id: "user_synthetic",
    firmId: "firm_synthetic",
    displayName: "Synthetic Staff",
    email: "staff@example.test",
    role: "owner_admin",
    assignedMatterIds: ["matter_synthetic"],
    mfaEnabled: true,
  },
};

const syntheticTemplate: IntakeSessionsResponse["templates"][number] = {
  id: "template_synthetic",
  firmId: "firm_synthetic",
  name: "Synthetic intake form",
  description: "Synthetic staff intake template.",
  category: "intake",
  provider: "embedded",
  externalTemplateId: "template_synthetic",
  active: true,
  definitionVersion: 2,
  definition: blankIntakeFormDefinition,
  createdAt: "2026-06-06T00:00:00.000Z",
  updatedAt: "2026-06-06T00:00:00.000Z",
  metadata: {},
};

const syntheticIntakeSession: IntakeSessionsResponse["sessions"][number] = {
  id: "intake_session_synthetic",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  templateId: "template_synthetic",
  provider: "embedded",
  externalId: "embedded_session_synthetic",
  status: "in_progress",
  evidence: {},
  createdAt: "2026-06-06T00:00:00.000Z",
  updatedAt: "2026-06-06T00:00:00.000Z",
};

const activeFormLink: IntakeFormsDashboardResponse["linksByMatterId"][string][number] = {
  id: "form_link_active",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  intakeSessionId: "intake_session_synthetic",
  requestedByUserId: "user_synthetic",
  expiresAt: "2035-06-06T00:00:00.000Z",
  createdAt: "2026-06-06T00:00:00.000Z",
  status: "active",
};

const submittedFormLink: IntakeFormsDashboardResponse["linksByMatterId"][string][number] = {
  ...activeFormLink,
  id: "form_link_submitted",
  submittedAt: "2026-06-06T12:00:00.000Z",
  status: "submitted",
};

const syntheticItemAction: IntakeFormsDashboardResponse["actionsByLinkId"][string][number] = {
  id: "item_action_synthetic",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  intakeSessionId: "intake_session_synthetic",
  formLinkId: "form_link_active",
  itemId: "supporting-upload",
  kind: "upload",
  status: "intent_created",
  evidence: {},
  createdAt: "2026-06-06T00:00:00.000Z",
};

const syntheticProposal: IntakeVariableProposalsResponse["proposals"][number] = {
  id: "proposal_synthetic",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  intakeSessionId: "intake_session_synthetic",
  answerSnapshotId: "answer_snapshot_synthetic",
  sourceQuestionId: "matter_title",
  targetScope: "matter",
  targetField: "title",
  targetRecordId: "matter_synthetic",
  proposedValue: "Updated synthetic matter",
  status: "pending",
  createdAt: "2026-06-06T00:00:00.000Z",
};

const syntheticLead: IntakePipelineDashboardResponse["leads"][number] = {
  id: "lead_synthetic",
  firmId: "firm_synthetic",
  sourceType: "public_consultation",
  sourceRecordId: "public_intake_synthetic",
  matterId: "matter_synthetic",
  displayName: "Synthetic Intake Lead",
  leadStatus: "conflict_review",
  sourceAttribution: {
    type: "public_consultation",
    label: "Website consultation form",
    labelOrigin: "metadata",
    channel: "website",
    sourceUrlPresent: true,
  },
  conflictReview: {
    posture: "needs_review",
    opposingPartyCount: 1,
  },
  followUpReview: {
    action: "review_public_request",
    posture: "staff_review",
    priority: "high",
    reason: "Synthetic follow-up review.",
    lastActivityAt: "2026-06-06T00:00:00.000Z",
    sourceQuality: "tracked",
    automationBoundary: {
      automaticMatterCreation: false,
      campaignAutomation: false,
      smsDelivery: false,
      bulkDelivery: false,
      adSpendIngestion: false,
      automaticClientContact: false,
    },
    auditSafe: true,
  },
  requestLinks: [{ kind: "public_consultation", id: "public_intake_synthetic", status: "pending" }],
  appointmentLinks: [],
  conversionCount: 0,
  createdAt: "2026-06-06T00:00:00.000Z",
  updatedAt: "2026-06-06T00:00:00.000Z",
  auditSafe: true,
};

const pipelineSummary = {
  ...emptyIntakePipelineSummary(),
  totalLeads: 1,
  conflictReview: {
    ...emptyIntakePipelineSummary().conflictReview,
    needs_review: 1,
  },
  followUpReview: {
    ...emptyIntakePipelineSummary().followUpReview,
    totalItems: 1,
    highPriorityCount: 1,
  },
};

const submissionsOperations = {
  ...emptySubmissionsOperations(),
  summary: {
    ...emptySubmissionsOperations().summary,
    totalSubmissions: 1,
    pendingStaffReviewCount: 1,
    assignedCount: 1,
    highPriorityCount: 1,
    byStatus: {
      ...emptySubmissionsOperations().summary.byStatus,
      pending_staff_review: 1,
    },
    byAssignmentPosture: {
      ...emptySubmissionsOperations().summary.byAssignmentPosture,
      review_owner_assigned: 1,
    },
  },
  rows: [
    {
      id: syntheticLead.id,
      sourceType: syntheticLead.sourceType,
      sourceLabel: syntheticLead.sourceAttribution.label,
      displayName: syntheticLead.displayName,
      matterId: syntheticLead.matterId,
      status: "pending_staff_review" as const,
      assignmentPosture: "review_owner_assigned" as const,
      leadStatus: syntheticLead.leadStatus,
      conflictPosture: syntheticLead.conflictReview.posture,
      opposingPartyCount: syntheticLead.conflictReview.opposingPartyCount,
      followUpAction: syntheticLead.followUpReview.action,
      followUpPosture: syntheticLead.followUpReview.posture,
      followUpPriority: syntheticLead.followUpReview.priority,
      lastActivityAt: syntheticLead.followUpReview.lastActivityAt,
      sourceQuality: syntheticLead.followUpReview.sourceQuality,
      requestLinkCount: 1,
      requestLinkStatuses: {
        pending: 1,
        active: 0,
        submitted: 0,
        reviewed: 0,
        revoked: 0,
        available: 0,
      },
      appointmentCount: 0,
      appointmentStatuses: { confirmed: 0, tentative: 0, cancelled: 0 },
      conversionCount: 0,
      exportSafeSummary:
        "Synthetic Intake Lead pending staff review · Website consultation form source · high priority · review owner assigned · 1 request links · 0 appointments · 0 conversions",
      automationBoundary: syntheticLead.followUpReview.automationBoundary,
      auditSafe: true as const,
    },
  ],
  auditSafe: true as const,
};

const syntheticPublicConsultationIntake: PublicConsultationIntake = {
  id: "public_intake_synthetic",
  firmId: "firm_synthetic",
  status: "pending",
  clientName: "Synthetic Public Client",
  telephone: "555-0100",
  email: "public@example.test",
  opposingPartyNames: ["Synthetic Opposing Party"],
  matterDescription: "Synthetic public consultation request.",
  disclosureAcceptedAt: "2026-06-06T00:00:00.000Z",
  submittedAt: "2026-06-06T00:00:00.000Z",
  metadata: {},
};

const publicConsultationSettings: PublicConsultationIntakeSettings = {
  enabled: true,
  senderAddress: "intake@example.test",
  recipientEmails: ["staff@example.test"],
  allowedOrigins: ["https://example.test"],
  submissionTokenConfigured: true,
  reviewOwnerUserId: "user_synthetic",
};

function noop(): void {}

function baseProps(overrides: Partial<IntakeSectionProps> = {}): IntakeSectionProps {
  return {
    activeFiscalHostMetadata: {
      programMetadata: { hostName: "Synthetic Fiscal Host", programCode: "SYN" },
      restrictedFundMetadata: { fundCode: "FUND-SYN", reviewStatus: "reviewed" },
    },
    activeIntakeFormLinks: [activeFormLink, submittedFormLink],
    activeIntakeSessions: [syntheticIntakeSession],
    activeIntakeVariableProposals: [syntheticProposal],
    activeLegalClinicProfile: {
      id: "clinic_profile_synthetic",
      firmId: "firm_synthetic",
      matterId: "matter_synthetic",
      programId: "clinic_program_synthetic",
      eligibilityStatus: "likely_eligible",
      referralStatus: "referral_needed",
      nextReviewDate: "2035-06-06T00:00:00.000Z",
      clinicRelationshipRole: "community_partner",
      createdAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z",
      updatedByUserId: "user_synthetic",
      metadata: {},
    },
    activeLegalClinicProgram: {
      id: "clinic_program_synthetic",
      firmId: "firm_synthetic",
      name: "Synthetic Clinic",
      status: "active",
      serviceArea: "Synthetic service area",
      eligibilitySummary: "Synthetic eligibility.",
      defaultReferralStatus: "referral_needed",
      createdAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z",
      metadata: {},
    },
    activeMatter: syntheticMatter,
    activeMatterPipelineLeads: [syntheticLead],
    activePendingIntakeReviewLinks: [submittedFormLink],
    activePendingIntakeVariableProposals: [syntheticProposal],
    confirmPendingDelivery: noop,
    convertPublicConsultationIntake: noop,
    creatingEngagementLetterLinkId: "",
    creatingIntakeFormLink: false,
    decideSubmittedIntakeReview: noop,
    dismissPublicConsultationIntake: noop,
    intakeFormActionsByLinkId: { form_link_active: [syntheticItemAction] },
    intakeFormExpiresAt: "2035-06-06T09:00",
    intakeFormPortalUrl: "https://example.test/intake-forms#synthetic",
    intakeEngagementPortalGrantId: "",
    intakeFormNotificationEmail: "",
    intakeFormStatus: "Synthetic form link ready.",
    intakeFormToken: "synthetic-intake-token",
    intakePipeline: {
      leads: [syntheticLead],
      summary: pipelineSummary,
      submissionsOperations,
      status: "available",
    },
    intakePreviewAnswers: { client_display_name: "Synthetic Client" },
    intakePreviewResult: null,
    intakePreviewStatus: "Preview checks have not run.",
    intakeReviewDetailsByLinkId: {},
    intakeReviewReasons: {},
    intakeTemplateDefinition: blankIntakeFormDefinition,
    intakeTemplateName: "Synthetic intake form",
    intakeTemplateStatus: "Template editor ready.",
    intakeTemplates: [syntheticTemplate],
    loadSubmittedIntakeReview: noop,
    loadingIntakeReviewLinkId: "",
    openEngagementLetterConfirmation: noop,
    openIntakeFormLinkConfirmation: noop,
    openIntakeSessionConfirmation: noop,
    pendingDeliveryConfirmation: null,
    pendingPublicConsultationIntakes: [syntheticPublicConsultationIntake],
    previewingIntakeTemplate: false,
    previewIntakeTemplate: noop,
    proposalRejectionReasons: {},
    publicConsultation: {
      settings: publicConsultationSettings,
      intakes: [syntheticPublicConsultationIntake],
      status: "available",
    },
    publicConsultationBusyIntakeId: "",
    publicConsultationDismissReasons: {},
    publicConsultationEnabled: true,
    publicConsultationOrigins: "https://example.test",
    publicConsultationRecipients: "staff@example.test",
    publicConsultationReviewOwner: "user_synthetic",
    publicConsultationSender: "intake@example.test",
    publicConsultationSettings,
    publicConsultationSettingsDisabled: false,
    publicConsultationStatus: "Public consultation intake settings ready.",
    recentIntakePipelineLeads: [syntheticLead],
    refreshPublicConsultationIntakes: noop,
    refreshingPublicConsultationIntakes: false,
    reviewIntakeVariableProposal: noop,
    reviewingIntakeFormLinkId: "",
    reviewingIntakeProposalId: "",
    revokeIntakeFormLink: noop,
    revokingIntakeFormLinkId: "",
    runPublicConsultationConflictCheck: noop,
    saveIntakeTemplate: noop,
    savePublicConsultationSettings: noop,
    savingIntakeTemplate: false,
    savingPublicConsultationSettings: false,
    selectIntakeTemplate: noop,
    selectedIntakeTemplate: syntheticTemplate,
    selectedIntakeTemplateId: syntheticTemplate.id,
    session: syntheticSession,
    setIntakeFormExpiresAt: noop,
    setIntakeEngagementPortalGrantId: noop,
    setIntakeFormNotificationEmail: noop,
    setIntakeReviewReasons: noop,
    setIntakeTemplateDefinition: noop,
    setIntakeTemplateName: noop,
    setPendingDeliveryConfirmation: noop,
    setProposalRejectionReasons: noop,
    setPublicConsultationDismissReasons: noop,
    setPublicConsultationEnabled: noop,
    setPublicConsultationOrigins: noop,
    setPublicConsultationRecipients: noop,
    setPublicConsultationReviewOwner: noop,
    setPublicConsultationSender: noop,
    startNewIntakeTemplate: noop,
    startingIntakeSession: false,
    updateIntakePreviewAnswer: noop,
    ...overrides,
  };
}

describe("IntakeSection", () => {
  it("renders intake operations without changing copy or classes", () => {
    const html = renderToStaticMarkup(createElement(IntakeSection, baseProps()));

    expect(html).toContain("Templates");
    expect(html).toContain("Pipeline leads");
    expect(html).toContain("Intake pipeline");
    expect(html).toContain("1 leads · 0 conversions · 1 conflict reviews");
    expect(html).toContain('class="party-row upload-link-row"');
    expect(html).toContain("Synthetic Intake Lead");
    expect(html).toContain("Website consultation form");
    expect(html).toContain("Review public request");
    expect(html).toContain("Current matter pipeline: conflict review");
    expect(html).toContain("Submissions operations");
    expect(html).toContain("1 submissions · 1 staff reviews · 0 waiting · 0 unassigned");
    expect(html).toContain("Pending staff review");
    expect(html).toContain("Review owner");
    expect(html).toContain("1 request links · 0 appointment links");
    expect(html).toContain("Synthetic Intake Lead pending staff review");
    expect(html).toContain("Public consultation requests");
    expect(html).toContain("Synthetic Public Client");
    expect(html).toContain("opposing parties: Synthetic Opposing Party");
    expect(html).toContain("Eligibility and referral");
    expect(html).toContain("Synthetic Clinic");
    expect(html).toContain("Synthetic Fiscal Host / SYN");
    expect(html).toContain("Form builder");
    expect(html).toContain('class="intake-builder-grid"');
    expect(html).toContain("Synthetic intake form");
    expect(html).toContain("QA scenarios");
    expect(html).toContain("Preview checks");
    expect(html).toContain("Client form links");
    expect(html).toContain("One-time token");
    expect(html).toContain("Client form URL");
    expect(html).toContain(
      '<p class="inline-empty" role="status" aria-live="polite" aria-atomic="true">Synthetic form link ready.</p>',
    );
    expect(html).toContain("Submitted review");
    expect(html).toContain("Load the staff review payload before recording a decision.");
    expect(html).toContain("Variable proposals");
    expect(html).toContain("Updated synthetic matter");
    expect(html).toContain("Intake sessions");
    expect(html).toContain("embedded · updated 2026-06-05");
  });

  it("keeps access-denied and empty-state copy visible", () => {
    const html = renderToStaticMarkup(
      createElement(
        IntakeSection,
        baseProps({
          activeIntakeFormLinks: [],
          activeIntakeSessions: [],
          activeIntakeVariableProposals: [],
          activeMatterPipelineLeads: [],
          activePendingIntakeReviewLinks: [],
          activePendingIntakeVariableProposals: [],
          intakePipeline: {
            leads: [],
            summary: emptyIntakePipelineSummary(),
            submissionsOperations: emptySubmissionsOperations(),
            status: "access_denied",
          },
          intakeTemplates: [],
          pendingPublicConsultationIntakes: [],
          recentIntakePipelineLeads: [],
          selectedIntakeTemplate: undefined,
          selectedIntakeTemplateId: "",
        }),
      ),
    );

    expect(html).toContain("Intake pipeline is unavailable for this role.");
    expect(html).toContain("Submissions operations are unavailable for this role.");
    expect(html).toContain("No public consultation requests are pending review.");
    expect(html).toContain("No form links are linked to this matter.");
    expect(html).toContain("No submitted intake forms are linked to this matter.");
    expect(html).toContain("No variable proposals are waiting for review.");
    expect(html).toContain("No intake sessions are linked to this matter.");
  });
});
