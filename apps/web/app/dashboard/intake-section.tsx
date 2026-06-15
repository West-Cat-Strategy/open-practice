import { Plus } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { EmbeddedIntakeTemplateDefinitionV2 } from "@open-practice/domain";

import { compactDate, compactStatus } from "../_features/dashboard/formatters";
import {
  compactSubmittedIntakeReviewActionReason,
  currentProposalValue,
  describeSubmittedIntakeReviewAction,
  getIntakeFormLinkState,
  previewStatusClass,
  submittedIntakeReviewBusyAction,
  summarizeAnswerValue,
  summarizeIntakeItemAction,
  summarizeIntakeReview,
  type IntakeFormReviewLoadResponse,
  type IntakePreviewAnswers,
} from "../intake-forms-dashboard";
import {
  intakePipelineFollowUpActionLabel,
  intakePipelineSourceLabel,
  intakePipelineSourceQualityLabel,
  intakePipelineStatusLabel,
  intakePipelineSummaryLine,
} from "../intake-pipeline-dashboard";
import StructuredIntakeBuilder from "../intake-forms/StructuredIntakeBuilder";
import {
  describeFiscalHostProgramMetadata,
  describeLegalClinicProgram,
  describeRestrictedFundMetadata,
} from "../legal-clinic-dashboard";
import {
  compactPublicConsultationReviewActionReason,
  describePublicConsultationReviewAction,
  publicConsultationOpposingParties,
  publicConsultationReviewBusyAction,
  publicConsultationSettingsSummary,
} from "../public-consultation-intakes-dashboard";
import type {
  FiscalHostWorkflowSelectorSummary,
  IntakeFormsDashboardResponse,
  IntakePipelineDashboardResponse,
  IntakeSessionsResponse,
  IntakeTemplatePreviewResponse,
  IntakeVariableProposalsResponse,
  LegalClinicProgramSummary,
  MatterLegalClinicProfileSummary,
  MatterSummary,
  PublicConsultationDashboardResponse,
  PublicConsultationIntake,
  PublicConsultationIntakeSettings,
  SessionResponse,
} from "../types";
import {
  DeliveryConfirmationPanel,
  OneTimeSecretPanel,
  type PendingDeliveryConfirmation,
} from "./shared-panels";

type DashboardIntakeFormLink = IntakeFormsDashboardResponse["linksByMatterId"][string][number];
type DashboardIntakePipelineLead = IntakePipelineDashboardResponse["leads"][number];
type DashboardIntakeSession = IntakeSessionsResponse["sessions"][number];
type DashboardIntakeTemplate = IntakeSessionsResponse["templates"][number];
type DashboardIntakeVariableProposal = IntakeVariableProposalsResponse["proposals"][number];
type SubmittedIntakeReviewDecision = "accept" | "reject" | "request-more-info";
type IntakeVariableProposalReviewStatus = "approved" | "rejected";

interface IntakeSectionProps {
  activeFiscalHostMetadata: FiscalHostWorkflowSelectorSummary;
  activeIntakeFormLinks: DashboardIntakeFormLink[];
  activeIntakeSessions: DashboardIntakeSession[];
  activeIntakeVariableProposals: DashboardIntakeVariableProposal[];
  activeLegalClinicProfile?: MatterLegalClinicProfileSummary;
  activeLegalClinicProgram?: LegalClinicProgramSummary;
  activeMatter: MatterSummary;
  activeMatterPipelineLeads: DashboardIntakePipelineLead[];
  activePendingIntakeReviewLinks: DashboardIntakeFormLink[];
  activePendingIntakeVariableProposals: DashboardIntakeVariableProposal[];
  creatingIntakeFormLink: boolean;
  intakeFormActionsByLinkId: IntakeFormsDashboardResponse["actionsByLinkId"];
  intakeFormExpiresAt: string;
  intakeFormPortalUrl: string;
  intakeFormStatus: string;
  intakeFormToken: string;
  intakePipeline: IntakePipelineDashboardResponse;
  intakePreviewAnswers: IntakePreviewAnswers;
  intakePreviewResult: IntakeTemplatePreviewResponse | null;
  intakePreviewStatus: string;
  intakeReviewDetailsByLinkId: Record<string, IntakeFormReviewLoadResponse | undefined>;
  intakeReviewReasons: Record<string, string>;
  intakeTemplateDefinition: EmbeddedIntakeTemplateDefinitionV2;
  intakeTemplateName: string;
  intakeTemplateStatus: string;
  intakeTemplates: DashboardIntakeTemplate[];
  loadingIntakeReviewLinkId: string;
  pendingDeliveryConfirmation: PendingDeliveryConfirmation | null;
  pendingPublicConsultationIntakes: PublicConsultationIntake[];
  previewingIntakeTemplate: boolean;
  proposalRejectionReasons: Record<string, string>;
  publicConsultation: PublicConsultationDashboardResponse;
  publicConsultationBusyIntakeId: string;
  publicConsultationDismissReasons: Record<string, string>;
  publicConsultationEnabled: boolean;
  publicConsultationOrigins: string;
  publicConsultationRecipients: string;
  publicConsultationReviewOwner: string;
  publicConsultationSender: string;
  publicConsultationSettings: PublicConsultationIntakeSettings;
  publicConsultationSettingsDisabled: boolean;
  publicConsultationStatus: string;
  recentIntakePipelineLeads: DashboardIntakePipelineLead[];
  refreshingPublicConsultationIntakes: boolean;
  reviewingIntakeFormLinkId: string;
  reviewingIntakeProposalId: string;
  revokingIntakeFormLinkId: string;
  savingIntakeTemplate: boolean;
  savingPublicConsultationSettings: boolean;
  selectedIntakeTemplate?: DashboardIntakeTemplate;
  selectedIntakeTemplateId: string;
  session: SessionResponse;
  startingIntakeSession: boolean;
  confirmPendingDelivery: () => void;
  convertPublicConsultationIntake: (intakeRecord: PublicConsultationIntake) => void | Promise<void>;
  createIntakeFormLink: () => void | Promise<void>;
  decideSubmittedIntakeReview: (
    linkId: string,
    decision: SubmittedIntakeReviewDecision,
  ) => void | Promise<void>;
  dismissPublicConsultationIntake: (intakeRecord: PublicConsultationIntake) => void | Promise<void>;
  loadSubmittedIntakeReview: (linkId: string) => void | Promise<void>;
  openIntakeSessionConfirmation: () => void;
  previewIntakeTemplate: () => void | Promise<void>;
  refreshPublicConsultationIntakes: () => void | Promise<void>;
  reviewIntakeVariableProposal: (
    proposal: DashboardIntakeVariableProposal,
    status: IntakeVariableProposalReviewStatus,
  ) => void | Promise<void>;
  revokeIntakeFormLink: (linkId: string) => void | Promise<void>;
  runPublicConsultationConflictCheck: (
    intakeRecord: PublicConsultationIntake,
  ) => void | Promise<void>;
  saveIntakeTemplate: () => void | Promise<void>;
  savePublicConsultationSettings: (rotateSubmissionToken?: boolean) => void | Promise<void>;
  selectIntakeTemplate: (templateId: string) => void;
  setIntakeFormExpiresAt: (value: string) => void;
  setIntakeReviewReasons: Dispatch<SetStateAction<Record<string, string>>>;
  setIntakeTemplateDefinition: (definition: EmbeddedIntakeTemplateDefinitionV2) => void;
  setIntakeTemplateName: (value: string) => void;
  setPendingDeliveryConfirmation: (confirmation: PendingDeliveryConfirmation | null) => void;
  setProposalRejectionReasons: Dispatch<SetStateAction<Record<string, string>>>;
  setPublicConsultationDismissReasons: Dispatch<SetStateAction<Record<string, string>>>;
  setPublicConsultationEnabled: (value: boolean) => void;
  setPublicConsultationOrigins: (value: string) => void;
  setPublicConsultationRecipients: (value: string) => void;
  setPublicConsultationReviewOwner: (value: string) => void;
  setPublicConsultationSender: (value: string) => void;
  startNewIntakeTemplate: () => void;
  updateIntakePreviewAnswer: (questionId: string, value: string | boolean) => void;
}

export function IntakeSection({
  activeFiscalHostMetadata,
  activeIntakeFormLinks,
  activeIntakeSessions,
  activeIntakeVariableProposals,
  activeLegalClinicProfile,
  activeLegalClinicProgram,
  activeMatter,
  activeMatterPipelineLeads,
  activePendingIntakeReviewLinks,
  activePendingIntakeVariableProposals,
  creatingIntakeFormLink,
  intakeFormActionsByLinkId,
  intakeFormExpiresAt,
  intakeFormPortalUrl,
  intakeFormStatus,
  intakeFormToken,
  intakePipeline,
  intakePreviewAnswers,
  intakePreviewResult,
  intakePreviewStatus,
  intakeReviewDetailsByLinkId,
  intakeReviewReasons,
  intakeTemplateDefinition,
  intakeTemplateName,
  intakeTemplateStatus,
  intakeTemplates,
  loadingIntakeReviewLinkId,
  pendingDeliveryConfirmation,
  pendingPublicConsultationIntakes,
  previewingIntakeTemplate,
  proposalRejectionReasons,
  publicConsultation,
  publicConsultationBusyIntakeId,
  publicConsultationDismissReasons,
  publicConsultationEnabled,
  publicConsultationOrigins,
  publicConsultationRecipients,
  publicConsultationReviewOwner,
  publicConsultationSender,
  publicConsultationSettings,
  publicConsultationSettingsDisabled,
  publicConsultationStatus,
  recentIntakePipelineLeads,
  refreshingPublicConsultationIntakes,
  reviewingIntakeFormLinkId,
  reviewingIntakeProposalId,
  revokingIntakeFormLinkId,
  savingIntakeTemplate,
  savingPublicConsultationSettings,
  selectedIntakeTemplate,
  selectedIntakeTemplateId,
  session,
  startingIntakeSession,
  confirmPendingDelivery,
  convertPublicConsultationIntake,
  createIntakeFormLink,
  decideSubmittedIntakeReview,
  dismissPublicConsultationIntake,
  loadSubmittedIntakeReview,
  openIntakeSessionConfirmation,
  previewIntakeTemplate,
  refreshPublicConsultationIntakes,
  reviewIntakeVariableProposal,
  revokeIntakeFormLink,
  runPublicConsultationConflictCheck,
  saveIntakeTemplate,
  savePublicConsultationSettings,
  selectIntakeTemplate,
  setIntakeFormExpiresAt,
  setIntakeReviewReasons,
  setIntakeTemplateDefinition,
  setIntakeTemplateName,
  setPendingDeliveryConfirmation,
  setProposalRejectionReasons,
  setPublicConsultationDismissReasons,
  setPublicConsultationEnabled,
  setPublicConsultationOrigins,
  setPublicConsultationRecipients,
  setPublicConsultationReviewOwner,
  setPublicConsultationSender,
  startNewIntakeTemplate,
  updateIntakePreviewAnswer,
}: IntakeSectionProps) {
  return (
    <>
      <div className="detail-grid">
        <div>
          <span className="field-label">Templates</span>
          <strong>{intakeTemplates.length}</strong>
        </div>
        <div>
          <span className="field-label">Sessions</span>
          <strong>{activeIntakeSessions.length}</strong>
        </div>
        <div>
          <span className="field-label">Form links</span>
          <strong>{activeIntakeFormLinks.length}</strong>
        </div>
        <div>
          <span className="field-label">Pending reviews</span>
          <strong>{activePendingIntakeReviewLinks.length}</strong>
        </div>
        <div>
          <span className="field-label">Pending proposals</span>
          <strong>{activePendingIntakeVariableProposals.length}</strong>
        </div>
        <div>
          <span className="field-label">Public requests</span>
          <strong>{pendingPublicConsultationIntakes.length}</strong>
        </div>
        <div>
          <span className="field-label">Pipeline leads</span>
          <strong>{intakePipeline.summary.totalLeads}</strong>
        </div>
        <div>
          <span className="field-label">Conversions</span>
          <strong>{intakePipeline.summary.conversionCount}</strong>
        </div>
        <div>
          <span className="field-label">Conflict review</span>
          <strong>
            {intakePipeline.summary.conflictReview.needs_review +
              intakePipeline.summary.conflictReview.reviewing}
          </strong>
        </div>
        <div>
          <span className="field-label">Follow-up reviews</span>
          <strong>{intakePipeline.summary.followUpReview.totalItems}</strong>
        </div>
        <div>
          <span className="field-label">High priority</span>
          <strong>{intakePipeline.summary.followUpReview.highPriorityCount}</strong>
        </div>
        <div>
          <span className="field-label">Defaulted sources</span>
          <strong>{intakePipeline.summary.followUpReview.defaultedSourceCount}</strong>
        </div>
      </div>

      <div className="section-title">
        <h3>Intake pipeline</h3>
        <span>{intakePipelineSummaryLine(intakePipeline.summary)}</span>
      </div>
      <div className="party-list">
        {recentIntakePipelineLeads.map((lead) => (
          <div className="party-row upload-link-row" key={lead.id}>
            <span>
              <strong>{lead.displayName}</strong>
              <small>
                {intakePipelineSourceLabel(lead.sourceType)} ·{" "}
                {intakePipelineStatusLabel(lead.leadStatus)} · {lead.sourceAttribution.label}
              </small>
              <small>
                conflict {intakePipelineStatusLabel(lead.conflictReview.posture)} ·{" "}
                {lead.requestLinks.length} request links · {lead.appointmentLinks.length}{" "}
                appointment links
              </small>
              <small>
                {intakePipelineFollowUpActionLabel(lead.followUpReview.action)} ·{" "}
                {intakePipelineStatusLabel(lead.followUpReview.posture)} ·{" "}
                {intakePipelineSourceQualityLabel(lead.followUpReview.sourceQuality)} ·{" "}
                {lead.followUpReview.priority} priority
              </small>
            </span>
            <em>{lead.conversionCount} conversions</em>
          </div>
        ))}
        {recentIntakePipelineLeads.length === 0 ? (
          <p className="inline-empty">
            {intakePipeline.status === "access_denied"
              ? "Intake pipeline is unavailable for this role."
              : "No intake pipeline leads are available."}
          </p>
        ) : null}
      </div>

      {activeMatterPipelineLeads.length > 0 ? (
        <div className="inline-empty">
          Current matter pipeline:{" "}
          {activeMatterPipelineLeads
            .map((lead) => intakePipelineStatusLabel(lead.leadStatus))
            .join(", ")}
        </div>
      ) : null}

      <div className="section-title">
        <h3>Public consultation requests</h3>
        <span>{pendingPublicConsultationIntakes.length} pending</span>
      </div>
      <div className="upload-create-grid">
        <label className="search-field compact">
          <span>Enabled</span>
          <input
            checked={publicConsultationEnabled}
            disabled={publicConsultationSettingsDisabled}
            onChange={(event) => setPublicConsultationEnabled(event.target.checked)}
            type="checkbox"
          />
        </label>
        <label className="search-field compact">
          <span>Send from</span>
          <input
            disabled={publicConsultationSettingsDisabled}
            onChange={(event) => setPublicConsultationSender(event.target.value)}
            value={publicConsultationSender}
          />
        </label>
        <label className="search-field compact">
          <span>Notify</span>
          <input
            disabled={publicConsultationSettingsDisabled}
            onChange={(event) => setPublicConsultationRecipients(event.target.value)}
            value={publicConsultationRecipients}
          />
        </label>
        <label className="search-field compact">
          <span>Review owner</span>
          <input
            disabled={publicConsultationSettingsDisabled}
            onChange={(event) => setPublicConsultationReviewOwner(event.target.value)}
            placeholder={session.user.id}
            value={publicConsultationReviewOwner}
          />
        </label>
        <button
          className="secondary-button compact-button"
          disabled={refreshingPublicConsultationIntakes}
          onClick={() => void refreshPublicConsultationIntakes()}
          type="button"
        >
          {refreshingPublicConsultationIntakes ? "Refreshing..." : "Refresh requests"}
        </button>
        <button
          className="secondary-button compact-button"
          disabled={savingPublicConsultationSettings || publicConsultationSettingsDisabled}
          onClick={() => void savePublicConsultationSettings(true)}
          type="button"
        >
          Rotate token
        </button>
        <button
          className="primary-button"
          disabled={savingPublicConsultationSettings || publicConsultationSettingsDisabled}
          onClick={() => void savePublicConsultationSettings()}
          type="button"
        >
          {savingPublicConsultationSettings ? "Saving..." : "Save settings"}
        </button>
      </div>
      <label className="form-field">
        <span>Allowed website origins</span>
        <textarea
          disabled={publicConsultationSettingsDisabled}
          onChange={(event) => setPublicConsultationOrigins(event.target.value)}
          value={publicConsultationOrigins}
        />
      </label>
      <p className="inline-empty" role="status" aria-live="polite">
        {publicConsultationStatus} Current settings:{" "}
        {publicConsultationSettingsSummary(publicConsultationSettings)}.
      </p>
      <div className="party-list">
        {pendingPublicConsultationIntakes.map((intakeRecord) => {
          const dismissReason = publicConsultationDismissReasons[intakeRecord.id] ?? "";
          const busyAction = publicConsultationReviewBusyAction(
            publicConsultationBusyIntakeId,
            intakeRecord.id,
          );
          const conflictAction = describePublicConsultationReviewAction({
            action: "conflict_check",
            intake: intakeRecord,
            dashboardStatus: publicConsultation.status,
            busyAction,
          });
          const dismissAction = describePublicConsultationReviewAction({
            action: "dismiss",
            intake: intakeRecord,
            dashboardStatus: publicConsultation.status,
            busyAction,
          });
          const convertAction = describePublicConsultationReviewAction({
            action: "convert",
            intake: intakeRecord,
            dashboardStatus: publicConsultation.status,
            busyAction,
          });
          const conflictActionReason = compactPublicConsultationReviewActionReason(
            conflictAction.disabledReason,
          );
          const dismissActionReason = compactPublicConsultationReviewActionReason(
            dismissAction.disabledReason,
          );
          const convertActionReason = compactPublicConsultationReviewActionReason(
            convertAction.disabledReason,
          );
          return (
            <div className="party-row upload-link-row" key={intakeRecord.id}>
              <span>
                <strong>{intakeRecord.clientName}</strong>
                <small>
                  submitted {compactDate(intakeRecord.submittedAt)} · email{" "}
                  {intakeRecord.email ?? "not provided"}
                  {intakeRecord.telephone ? ` · phone ${intakeRecord.telephone}` : ""}
                </small>
                <small>opposing parties: {publicConsultationOpposingParties(intakeRecord)}</small>
                <small>{intakeRecord.matterDescription}</small>
              </span>
              <div className="row-actions">
                <button
                  aria-label={
                    conflictAction.disabledReason
                      ? `${conflictAction.label}: ${conflictActionReason}`
                      : conflictAction.label
                  }
                  className="secondary-button compact-button row-button"
                  data-action-key={conflictAction.actionKey}
                  disabled={!conflictAction.available}
                  onClick={() => void runPublicConsultationConflictCheck(intakeRecord)}
                  title={
                    conflictAction.disabledReason
                      ? `${conflictAction.label}: ${conflictActionReason}`
                      : conflictAction.label
                  }
                  type="button"
                >
                  {conflictAction.label}
                </button>
                <label className="search-field compact rejection-field">
                  <span>Dismiss reason</span>
                  <input
                    onChange={(event) =>
                      setPublicConsultationDismissReasons((current) => ({
                        ...current,
                        [intakeRecord.id]: event.target.value,
                      }))
                    }
                    value={dismissReason}
                  />
                </label>
                <button
                  aria-label={
                    dismissAction.disabledReason
                      ? `${dismissAction.label}: ${dismissActionReason}`
                      : dismissAction.label
                  }
                  className="secondary-button compact-button row-button"
                  data-action-key={dismissAction.actionKey}
                  disabled={!dismissAction.available}
                  onClick={() => void dismissPublicConsultationIntake(intakeRecord)}
                  title={
                    dismissAction.disabledReason
                      ? `${dismissAction.label}: ${dismissActionReason}`
                      : dismissAction.label
                  }
                  type="button"
                >
                  {dismissAction.label}
                </button>
                <button
                  aria-label={
                    convertAction.disabledReason
                      ? `${convertAction.label}: ${convertActionReason}`
                      : convertAction.label
                  }
                  className="primary-button row-button"
                  data-action-key={convertAction.actionKey}
                  disabled={!convertAction.available}
                  onClick={() => void convertPublicConsultationIntake(intakeRecord)}
                  title={
                    convertAction.disabledReason
                      ? `${convertAction.label}: ${convertActionReason}`
                      : convertAction.label
                  }
                  type="button"
                >
                  {convertAction.label}
                </button>
              </div>
            </div>
          );
        })}
        {pendingPublicConsultationIntakes.length === 0 ? (
          <p className="inline-empty">No public consultation requests are pending review.</p>
        ) : null}
      </div>

      {activeLegalClinicProfile ? (
        <>
          <div className="section-title">
            <h3>Eligibility and referral</h3>
            <span>
              {describeLegalClinicProgram(activeLegalClinicProgram, activeLegalClinicProfile)}
            </span>
          </div>
          <div className="detail-grid">
            <div>
              <span className="field-label">Eligibility</span>
              <strong>{compactStatus(activeLegalClinicProfile.eligibilityStatus)}</strong>
            </div>
            <div>
              <span className="field-label">Referral</span>
              <strong>{compactStatus(activeLegalClinicProfile.referralStatus)}</strong>
            </div>
            <div>
              <span className="field-label">Relationship</span>
              <strong>{activeLegalClinicProfile.clinicRelationshipRole}</strong>
            </div>
            <div>
              <span className="field-label">Next review</span>
              <strong>{compactDate(activeLegalClinicProfile.nextReviewDate)}</strong>
            </div>
            <div>
              <span className="field-label">Fiscal host</span>
              <strong>
                {describeFiscalHostProgramMetadata(activeFiscalHostMetadata.programMetadata)}
              </strong>
            </div>
            <div>
              <span className="field-label">Restricted fund</span>
              <strong>
                {describeRestrictedFundMetadata(activeFiscalHostMetadata.restrictedFundMetadata)}
              </strong>
            </div>
          </div>
        </>
      ) : null}

      <div className="section-title">
        <h3>Form builder</h3>
        <span>{selectedIntakeTemplate?.id ?? "new"}</span>
      </div>
      <div className="intake-builder-grid">
        <div className="party-list intake-template-list">
          {intakeTemplates.map((template) => (
            <button
              className={
                template.id === selectedIntakeTemplateId
                  ? "party-row draft-row selected-template"
                  : "party-row draft-row"
              }
              key={template.id}
              onClick={() => selectIntakeTemplate(template.id)}
              type="button"
            >
              <span>
                <strong>{template.name}</strong>
                <small>
                  v{template.definitionVersion} ·{" "}
                  {template.definition.schemaVersion === 2
                    ? `${template.definition.sections.length} sections`
                    : "legacy"}
                </small>
              </span>
              <em>{template.active ? "active" : "paused"}</em>
            </button>
          ))}
          <button
            className="secondary-button compact-button"
            onClick={startNewIntakeTemplate}
            type="button"
          >
            <Plus size={16} />
            New form
          </button>
        </div>
        <StructuredIntakeBuilder
          definition={intakeTemplateDefinition}
          name={intakeTemplateName}
          onDefinitionChange={setIntakeTemplateDefinition}
          onNameChange={setIntakeTemplateName}
          onSave={() => void saveIntakeTemplate()}
          saving={savingIntakeTemplate}
          status={intakeTemplateStatus}
        />
      </div>

      <div className="section-title">
        <h3>Preview checks</h3>
        <span className={previewStatusClass(intakePreviewResult)}>
          {intakePreviewResult?.status ?? "not run"}
        </span>
      </div>
      <div className="intake-preview-grid">
        <div className="intake-preview-inputs">
          {intakeTemplateDefinition.questions.map((question) => (
            <label className="form-field" key={question.id}>
              <span>{question.label}</span>
              {question.type === "boolean" ? (
                <input
                  checked={Boolean(intakePreviewAnswers[question.id])}
                  onChange={(event) => updateIntakePreviewAnswer(question.id, event.target.checked)}
                  type="checkbox"
                />
              ) : question.type === "select" ? (
                <select
                  onChange={(event) => updateIntakePreviewAnswer(question.id, event.target.value)}
                  value={String(intakePreviewAnswers[question.id] ?? "")}
                >
                  <option value="">No preview answer</option>
                  {(question.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : question.type === "textarea" ? (
                <textarea
                  onChange={(event) => updateIntakePreviewAnswer(question.id, event.target.value)}
                  value={String(intakePreviewAnswers[question.id] ?? "")}
                />
              ) : (
                <input
                  onChange={(event) => updateIntakePreviewAnswer(question.id, event.target.value)}
                  type={question.type === "date" ? "date" : "text"}
                  value={String(intakePreviewAnswers[question.id] ?? "")}
                />
              )}
            </label>
          ))}
          {intakeTemplateDefinition.questions.length === 0 ? (
            <p className="inline-empty">No preview answers are needed.</p>
          ) : null}
        </div>
        <div className="intake-preview-results">
          <div className="row-actions">
            <button
              className="secondary-button compact-button"
              disabled={previewingIntakeTemplate}
              onClick={() => void previewIntakeTemplate()}
              type="button"
            >
              {previewingIntakeTemplate ? "Checking..." : "Preview checks"}
            </button>
          </div>
          <p className="inline-empty">{intakePreviewStatus}</p>
          {intakePreviewResult?.checks.length ? (
            <div className="party-list">
              {intakePreviewResult.checks.map((check, index) => (
                <div className="party-row" key={`${check.code}-${index}`}>
                  <span>
                    <strong>{check.code.replaceAll("_", " ")}</strong>
                    <small>{check.message}</small>
                    <small>
                      {[check.sectionId, check.itemId, check.questionId, check.packageId]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <em className={check.severity === "blocking" ? "risk" : undefined}>
                    {check.severity}
                  </em>
                </div>
              ))}
            </div>
          ) : null}
          {intakePreviewResult?.preview ? (
            <div className="detail-grid intake-preview-summary">
              <div>
                <span className="field-label">Visible items</span>
                <strong>{intakePreviewResult.preview.visibleFormItemIds?.length ?? 0}</strong>
              </div>
              <div>
                <span className="field-label">Required incomplete</span>
                <strong>
                  {intakePreviewResult.preview.requiredIncompleteItemIds?.length ?? 0}
                </strong>
              </div>
              <div>
                <span className="field-label">Packages</span>
                <strong>{intakePreviewResult.preview.packageSummaries.length}</strong>
              </div>
              <div>
                <span className="field-label">Documents</span>
                <strong>{intakePreviewResult.preview.packageDocuments.length}</strong>
              </div>
            </div>
          ) : null}
          {intakePreviewResult?.preview?.requiredIncompleteItemIds?.length ? (
            <p className="field-hint">
              Required before submit:{" "}
              {intakePreviewResult.preview.requiredIncompleteItemIds.join(", ")}
            </p>
          ) : null}
          {intakePreviewResult?.preview?.packageSummaries.length ? (
            <p className="field-hint">
              Package preview:{" "}
              {intakePreviewResult.preview.packageSummaries
                .map((summary) => summary.title)
                .join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="section-title">
        <h3>Client form links</h3>
        <span>{activeMatter.number}</span>
      </div>
      <div className="upload-create-grid">
        <label className="search-field compact">
          <span>Expiry</span>
          <input
            onChange={(event) => setIntakeFormExpiresAt(event.target.value)}
            type="datetime-local"
            value={intakeFormExpiresAt}
          />
        </label>
        <button
          className="secondary-button compact-button"
          disabled={startingIntakeSession || !selectedIntakeTemplate}
          onClick={() => openIntakeSessionConfirmation()}
          type="button"
        >
          <Plus size={16} />
          {startingIntakeSession ? "Starting..." : "Start session"}
        </button>
        <button
          className="primary-button"
          disabled={creatingIntakeFormLink || activeIntakeSessions.length === 0}
          onClick={() => void createIntakeFormLink()}
          type="button"
        >
          {creatingIntakeFormLink ? "Creating..." : "Create link"}
        </button>
      </div>
      {pendingDeliveryConfirmation?.kind === "intake-session-start" ? (
        <DeliveryConfirmationPanel
          busy={startingIntakeSession}
          confirmation={pendingDeliveryConfirmation}
          onCancel={() => setPendingDeliveryConfirmation(null)}
          onConfirm={confirmPendingDelivery}
        />
      ) : null}
      {intakeFormToken ? (
        <OneTimeSecretPanel items={[{ label: "One-time token", value: intakeFormToken }]} />
      ) : null}
      {intakeFormPortalUrl ? (
        <OneTimeSecretPanel items={[{ label: "Client form URL", value: intakeFormPortalUrl }]} />
      ) : null}
      <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
        {intakeFormStatus}
      </p>
      <div className="party-list">
        {activeIntakeFormLinks.map((link) => {
          const linkState = getIntakeFormLinkState(link);
          const itemActions = intakeFormActionsByLinkId[link.id] ?? [];
          return (
            <div className="party-row upload-link-row" key={link.id}>
              <span>
                <strong>{link.id}</strong>
                <small>
                  {link.intakeSessionId} · expires {compactDate(link.expiresAt)} · created{" "}
                  {compactDate(link.createdAt)}
                </small>
                {itemActions.length > 0 ? (
                  <small>{itemActions.map(summarizeIntakeItemAction).join(" · ")}</small>
                ) : null}
              </span>
              <div className="row-actions">
                <em className={linkState === "active" ? undefined : "risk"}>{linkState}</em>
                {!link.revokedAt && !link.submittedAt ? (
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={revokingIntakeFormLinkId === link.id}
                    onClick={() => void revokeIntakeFormLink(link.id)}
                    type="button"
                  >
                    {revokingIntakeFormLinkId === link.id ? "Revoking..." : "Revoke"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {activeIntakeFormLinks.length === 0 ? (
          <p className="inline-empty">No form links are linked to this matter.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Submitted review</h3>
        <span>{activePendingIntakeReviewLinks.length} pending</span>
      </div>
      <div className="party-list">
        {activePendingIntakeReviewLinks.map((link) => {
          const reviewPayload = intakeReviewDetailsByLinkId[link.id];
          const reason = intakeReviewReasons[link.id] ?? "";
          const busyAction = submittedIntakeReviewBusyAction({
            linkId: link.id,
            loadingLinkId: loadingIntakeReviewLinkId,
            reviewingKey: reviewingIntakeFormLinkId,
          });
          const reviewLoaded = Boolean(reviewPayload);
          const reviewDecisionCount = reviewPayload?.reviews.length ?? 0;
          const loadAction = describeSubmittedIntakeReviewAction({
            action: "load",
            reviewLoaded,
            reviewDecisionCount,
            reason,
            busyAction,
          });
          const acceptAction = describeSubmittedIntakeReviewAction({
            action: "accept",
            reviewLoaded,
            reviewDecisionCount,
            reason,
            busyAction,
          });
          const rejectAction = describeSubmittedIntakeReviewAction({
            action: "reject",
            reviewLoaded,
            reviewDecisionCount,
            reason,
            busyAction,
          });
          const moreInfoAction = describeSubmittedIntakeReviewAction({
            action: "request_more_info",
            reviewLoaded,
            reviewDecisionCount,
            reason,
            busyAction,
          });
          const loadActionReason = compactSubmittedIntakeReviewActionReason(
            loadAction.disabledReason,
          );
          const acceptActionReason = compactSubmittedIntakeReviewActionReason(
            acceptAction.disabledReason,
          );
          const rejectActionReason = compactSubmittedIntakeReviewActionReason(
            rejectAction.disabledReason,
          );
          const moreInfoActionReason = compactSubmittedIntakeReviewActionReason(
            moreInfoAction.disabledReason,
          );
          const answers = reviewPayload ? Object.entries(reviewPayload.snapshot.answers) : [];
          return (
            <div className="party-row upload-link-row" key={`review-${link.id}`}>
              <span>
                <strong>{link.id}</strong>
                <small>
                  submitted {compactDate(link.submittedAt)} · session {link.intakeSessionId}
                </small>
                {reviewPayload ? (
                  <>
                    <small>
                      snapshot {reviewPayload.snapshot.id} · captured{" "}
                      {compactDate(reviewPayload.snapshot.capturedAt)}
                    </small>
                    <small>
                      answers:{" "}
                      {answers.length === 0
                        ? "none"
                        : answers
                            .map(
                              ([questionId, value]) =>
                                `${questionId}: ${summarizeAnswerValue(value)}`,
                            )
                            .join(" · ")}
                    </small>
                    {reviewPayload.actions.length > 0 ? (
                      <small>
                        item actions:{" "}
                        {reviewPayload.actions.map(summarizeIntakeItemAction).join(" · ")}
                      </small>
                    ) : null}
                    {reviewPayload.reviews.length > 0 ? (
                      <small>
                        decisions: {reviewPayload.reviews.map(summarizeIntakeReview).join(" · ")}
                      </small>
                    ) : null}
                  </>
                ) : (
                  <small>Load the staff review payload before recording a decision.</small>
                )}
              </span>
              <div className="row-actions">
                <button
                  aria-label={
                    loadAction.disabledReason
                      ? `${loadAction.label}: ${loadActionReason}`
                      : loadAction.label
                  }
                  className="secondary-button compact-button row-button"
                  data-action-key={loadAction.actionKey}
                  disabled={!loadAction.available}
                  onClick={() => void loadSubmittedIntakeReview(link.id)}
                  title={
                    loadAction.disabledReason
                      ? `${loadAction.label}: ${loadActionReason}`
                      : loadAction.label
                  }
                  type="button"
                >
                  {loadAction.label}
                </button>
                {reviewPayload && reviewPayload.reviews.length === 0 ? (
                  <>
                    <label className="search-field compact rejection-field">
                      <span>Decision reason</span>
                      <input
                        onChange={(event) =>
                          setIntakeReviewReasons((current) => ({
                            ...current,
                            [link.id]: event.target.value,
                          }))
                        }
                        value={reason}
                      />
                    </label>
                    <button
                      aria-label={
                        acceptAction.disabledReason
                          ? `${acceptAction.label}: ${acceptActionReason}`
                          : acceptAction.label
                      }
                      className="secondary-button compact-button row-button"
                      data-action-key={acceptAction.actionKey}
                      disabled={!acceptAction.available}
                      onClick={() => void decideSubmittedIntakeReview(link.id, "accept")}
                      title={
                        acceptAction.disabledReason
                          ? `${acceptAction.label}: ${acceptActionReason}`
                          : acceptAction.label
                      }
                      type="button"
                    >
                      {acceptAction.label}
                    </button>
                    <button
                      aria-label={
                        rejectAction.disabledReason
                          ? `${rejectAction.label}: ${rejectActionReason}`
                          : rejectAction.label
                      }
                      className="secondary-button compact-button row-button"
                      data-action-key={rejectAction.actionKey}
                      disabled={!rejectAction.available}
                      onClick={() => void decideSubmittedIntakeReview(link.id, "reject")}
                      title={
                        rejectAction.disabledReason
                          ? `${rejectAction.label}: ${rejectActionReason}`
                          : rejectAction.label
                      }
                      type="button"
                    >
                      {rejectAction.label}
                    </button>
                    <button
                      aria-label={
                        moreInfoAction.disabledReason
                          ? `${moreInfoAction.label}: ${moreInfoActionReason}`
                          : moreInfoAction.label
                      }
                      className="secondary-button compact-button row-button"
                      data-action-key={moreInfoAction.actionKey}
                      disabled={!moreInfoAction.available}
                      onClick={() => void decideSubmittedIntakeReview(link.id, "request-more-info")}
                      title={
                        moreInfoAction.disabledReason
                          ? `${moreInfoAction.label}: ${moreInfoActionReason}`
                          : moreInfoAction.label
                      }
                      type="button"
                    >
                      {moreInfoAction.label}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        {activePendingIntakeReviewLinks.length === 0 ? (
          <p className="inline-empty">No submitted intake forms are pending review.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Variable proposals</h3>
        <span>{activeIntakeVariableProposals.length} records</span>
      </div>
      <div className="party-list">
        {activeIntakeVariableProposals.map((proposal) => (
          <div className="party-row upload-link-row" key={proposal.id}>
            <span>
              <strong>
                {proposal.targetScope}.{proposal.targetField}
              </strong>
              <small>
                proposed {proposal.proposedValue} · current{" "}
                {currentProposalValue(proposal, activeMatter)} · from {proposal.sourceQuestionId}
              </small>
              {proposal.rejectionReason ? <small>reason: {proposal.rejectionReason}</small> : null}
            </span>
            <div className="row-actions">
              <em className={proposal.status === "pending" ? undefined : "risk"}>
                {proposal.status}
              </em>
              {proposal.status === "pending" ? (
                <>
                  <label className="search-field compact rejection-field">
                    <span>Reject reason</span>
                    <input
                      onChange={(event) =>
                        setProposalRejectionReasons((current) => ({
                          ...current,
                          [proposal.id]: event.target.value,
                        }))
                      }
                      value={proposalRejectionReasons[proposal.id] ?? ""}
                    />
                  </label>
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={reviewingIntakeProposalId === proposal.id}
                    onClick={() => void reviewIntakeVariableProposal(proposal, "approved")}
                    type="button"
                  >
                    Approve
                  </button>
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={reviewingIntakeProposalId === proposal.id}
                    onClick={() => void reviewIntakeVariableProposal(proposal, "rejected")}
                    type="button"
                  >
                    Reject
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
        {activeIntakeVariableProposals.length === 0 ? (
          <p className="inline-empty">No variable proposals are waiting for review.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Intake sessions</h3>
        <span>{activeIntakeSessions.length} records</span>
      </div>
      <div className="party-list">
        {activeIntakeSessions.map((sessionRecord) => (
          <div className="party-row" key={sessionRecord.id}>
            <span>
              <strong>
                {intakeTemplates.find((template) => template.id === sessionRecord.templateId)
                  ?.name ?? sessionRecord.templateId}
              </strong>
              <small>
                {sessionRecord.provider} · updated{" "}
                {new Date(sessionRecord.updatedAt).toLocaleDateString("en-CA")}
              </small>
            </span>
            <em>{sessionRecord.status.replace("_", " ")}</em>
          </div>
        ))}
        {activeIntakeSessions.length === 0 ? (
          <p className="inline-empty">No intake sessions are linked to this matter.</p>
        ) : null}
      </div>
    </>
  );
}
