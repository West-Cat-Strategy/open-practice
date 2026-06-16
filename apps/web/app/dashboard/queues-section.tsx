import { Clock3, Power, RotateCcw, Save, X } from "lucide-react";
import type { AiOperationalProposalRecord } from "@open-practice/domain";
import type { DashboardLaneFreshnessCue } from "../dashboard-utils";
import type {
  AiOperationalProposalsResponse,
  ProvidersStatusResponse,
  QueuesResponse,
  SavedOperationalViewDefinition,
  TaskDeadlineWorkbenchResponse,
  WorkerHealthResponse,
  WorkflowHistoryItem,
  WorkflowHistoryResponse,
  WorkflowHistoryStatus,
  WorkerRunQueueFilter,
  WorkerRunSummaryItem,
} from "../types";
import type { ConnectorOperationsResponse } from "../_features/connectors/models";
import {
  describeAiOperationalProposalGeneration,
  formatAiOperationalProposalKind,
} from "../ai-operational-proposals-dashboard";
import {
  compactConnectorActionReason,
  connectorDisplayName,
  connectorOutboxStatusTone,
  describeConnectorOutboxDeadLetterAction,
  describeConnectorOutboxRetryAction,
  summarizeConnectorPayload,
  type ConnectorRecoveryAction,
  type PendingConnectorRecovery,
} from "../connector-outbox-dashboard";

export interface ProviderPostureRow {
  key: string;
  label: string;
  status: string;
  detail: string;
  tone: "neutral" | "ready" | "risk";
}

export interface WorkerRunStatusSummary {
  label: string;
  tone: "neutral" | "ready" | "risk";
}

export interface QueuesSectionProps {
  activeSavedOperationalViewDefinition?: SavedOperationalViewDefinition | null;
  activeSavedOperationalViewId?: string;
  aiOperationalProposals: AiOperationalProposalsResponse;
  aiOperationalProposalStatus: string;
  aiOperationalProposalReviewBusyId?: string;
  activeWorkerRuns: {
    jobs: WorkerRunSummaryItem[];
  };
  archivingOperationalViewId?: string;
  compactDate: (value?: string) => string;
  compactProviderStatus: (value?: string) => string;
  compactStatus: (value?: string) => string;
  connectorOperations: ConnectorOperationsResponse;
  connectorRecoveryBusyKey?: string;
  connectorRecoveryNow: Date;
  connectorRecoveryStatus: string;
  connectorOperationsSummary: string;
  canReviewAiOperationalProposals: boolean;
  displayedQueues: QueuesResponse;
  formatSavedOperationalViewDefinition: (definition: SavedOperationalViewDefinition) => string;
  formatWorkerRunAttempts: (job: WorkerRunSummaryItem) => string;
  formatWorkerRunTiming: (job: WorkerRunSummaryItem) => string;
  canManageDocumentProcessingProvider: boolean;
  ocrProviderUpdateStatus: string;
  ocrProviderUpdating: boolean;
  onApplyQueueOperationalViewDefinition: (definition: SavedOperationalViewDefinition) => void;
  onArchiveQueueOperationalViewDefinition: (definition: SavedOperationalViewDefinition) => void;
  onCancelConnectorRecovery: () => void;
  onClearQueueOperationalViewDefinition: () => void;
  onConfirmConnectorRecovery: () => void;
  onRefreshProviders: () => void;
  onRefreshQueues: () => void;
  onRequestConnectorRecovery: (
    item: ConnectorOperationsResponse["outbox"][number],
    action: ConnectorRecoveryAction,
  ) => void;
  onReviewAiOperationalProposal: (
    record: AiOperationalProposalRecord,
    decision: "approved" | "rejected",
  ) => void;
  onSaveQueueOperationalViewDefinition: () => void;
  onSelectMatter: (matterId: string) => void;
  onSetOcrProviderEnabled: (enabled: boolean) => void;
  onWorkerRunFilterChange: (filter: WorkerRunQueueFilter) => void;
  providerFreshnessCue: DashboardLaneFreshnessCue;
  providerRows: ProviderPostureRow[];
  providerStatus: ProvidersStatusResponse;
  providerStatusSummary: string;
  providerRefreshing: boolean;
  canManageConnectorRecovery: boolean;
  pendingConnectorRecovery?: PendingConnectorRecovery | null;
  queueFreshnessCue: DashboardLaneFreshnessCue;
  queueSummary: string;
  queueRefreshing: boolean;
  savedOperationalViewDefinitions: SavedOperationalViewDefinition[];
  savedOperationalViewStatus: string;
  savingOperationalView: boolean;
  taskDeadlineSummary: string;
  taskWorkbench: TaskDeadlineWorkbenchResponse;
  workerHealth: WorkerHealthResponse;
  workerHealthStateTone: "neutral" | "ready" | "risk";
  workerHealthSummary: string;
  workflowHistory: WorkflowHistoryResponse;
  workflowHistorySafeContext: (workflow: WorkflowHistoryItem) => string;
  workflowHistoryStatus: (status: WorkflowHistoryStatus) => WorkerRunStatusSummary;
  workflowHistorySummary: string;
  workerRunFilter: WorkerRunQueueFilter;
  workerRunFilterOptions: Array<{ key: WorkerRunQueueFilter; label: string }>;
  workerRunSafeContext: (job: WorkerRunSummaryItem) => string;
  workerRunStatus: (job: WorkerRunSummaryItem) => WorkerRunStatusSummary;
  workerRunSummary: string;
}

export function QueuesSection({
  activeSavedOperationalViewDefinition,
  activeSavedOperationalViewId,
  aiOperationalProposals,
  aiOperationalProposalStatus,
  aiOperationalProposalReviewBusyId = "",
  activeWorkerRuns,
  archivingOperationalViewId,
  compactDate,
  compactProviderStatus,
  compactStatus,
  connectorOperations,
  connectorRecoveryBusyKey = "",
  connectorRecoveryNow,
  connectorRecoveryStatus,
  connectorOperationsSummary,
  canReviewAiOperationalProposals,
  displayedQueues,
  formatSavedOperationalViewDefinition,
  formatWorkerRunAttempts,
  formatWorkerRunTiming,
  canManageDocumentProcessingProvider,
  ocrProviderUpdateStatus,
  ocrProviderUpdating,
  onApplyQueueOperationalViewDefinition,
  onArchiveQueueOperationalViewDefinition,
  onCancelConnectorRecovery,
  onClearQueueOperationalViewDefinition,
  onConfirmConnectorRecovery,
  onRefreshProviders,
  onRefreshQueues,
  onRequestConnectorRecovery,
  onReviewAiOperationalProposal,
  onSaveQueueOperationalViewDefinition,
  onSelectMatter,
  onSetOcrProviderEnabled,
  onWorkerRunFilterChange,
  providerFreshnessCue,
  providerRows,
  providerStatus,
  providerStatusSummary,
  providerRefreshing,
  canManageConnectorRecovery,
  pendingConnectorRecovery,
  queueFreshnessCue,
  queueSummary,
  queueRefreshing,
  savedOperationalViewDefinitions,
  savedOperationalViewStatus,
  savingOperationalView,
  taskDeadlineSummary,
  taskWorkbench,
  workerHealth,
  workerHealthStateTone,
  workerHealthSummary,
  workflowHistory,
  workflowHistorySafeContext,
  workflowHistoryStatus,
  workflowHistorySummary,
  workerRunFilter,
  workerRunFilterOptions,
  workerRunSafeContext,
  workerRunStatus,
  workerRunSummary,
}: QueuesSectionProps) {
  const displayedQueueItems = displayedQueues.sections.flatMap((section) => section.items);

  return (
    <>
      <DashboardLaneRefreshPanel
        cue={queueFreshnessCue}
        label="Queue data"
        onRefresh={onRefreshQueues}
        refreshing={queueRefreshing}
      />
      <div className="detail-grid queue-summary-grid">
        <div>
          <span className="field-label">Queue sections</span>
          <strong>{displayedQueues.sections.length}</strong>
        </div>
        <div>
          <span className="field-label">Open items</span>
          <strong>{displayedQueueItems.length}</strong>
        </div>
        <div>
          <span className="field-label">High priority</span>
          <strong>{displayedQueueItems.filter((item) => item.priority === "high").length}</strong>
        </div>
        <div>
          <span className="field-label">My deadlines</span>
          <strong>{taskWorkbench.counters.my.overdue + taskWorkbench.counters.my.today}</strong>
        </div>
        <div>
          <span className="field-label">Hydration</span>
          <strong>Route-backed</strong>
        </div>
      </div>
      <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
        {queueSummary}
      </p>
      <p className="inline-empty">{taskDeadlineSummary}</p>

      <TaskDeadlineReviewBlock
        compactDate={compactDate}
        onSelectMatter={onSelectMatter}
        taskWorkbench={taskWorkbench}
      />

      <SavedQueueViewsBlock
        activeSavedOperationalViewDefinition={activeSavedOperationalViewDefinition}
        activeSavedOperationalViewId={activeSavedOperationalViewId}
        archivingOperationalViewId={archivingOperationalViewId}
        compactDate={compactDate}
        formatSavedOperationalViewDefinition={formatSavedOperationalViewDefinition}
        onApplyQueueOperationalViewDefinition={onApplyQueueOperationalViewDefinition}
        onArchiveQueueOperationalViewDefinition={onArchiveQueueOperationalViewDefinition}
        onClearQueueOperationalViewDefinition={onClearQueueOperationalViewDefinition}
        onSaveQueueOperationalViewDefinition={onSaveQueueOperationalViewDefinition}
        savedOperationalViewDefinitions={savedOperationalViewDefinitions}
        savedOperationalViewStatus={savedOperationalViewStatus}
        savingOperationalView={savingOperationalView}
      />

      <AiOperationalProposalsBlock
        aiOperationalProposals={aiOperationalProposals}
        canReviewAiOperationalProposals={canReviewAiOperationalProposals}
        compactDate={compactDate}
        compactStatus={compactStatus}
        onReviewAiOperationalProposal={onReviewAiOperationalProposal}
        reviewBusyId={aiOperationalProposalReviewBusyId}
        status={aiOperationalProposalStatus}
      />

      <ProviderPostureBlock
        compactProviderStatus={compactProviderStatus}
        providerFreshnessCue={providerFreshnessCue}
        onRefreshProviders={onRefreshProviders}
        providerRows={providerRows}
        providerStatus={providerStatus}
        providerStatusSummary={providerStatusSummary}
        providerRefreshing={providerRefreshing}
        canManageDocumentProcessingProvider={canManageDocumentProcessingProvider}
        ocrProviderUpdateStatus={ocrProviderUpdateStatus}
        ocrProviderUpdating={ocrProviderUpdating}
        onSetOcrProviderEnabled={onSetOcrProviderEnabled}
      />

      <WorkerHealthBlock
        compactDate={compactDate}
        compactStatus={compactStatus}
        workerHealth={workerHealth}
        workerHealthStateTone={workerHealthStateTone}
        workerHealthSummary={workerHealthSummary}
      />

      <ConnectorOperationsBlock
        canManageConnectorRecovery={canManageConnectorRecovery}
        compactDate={compactDate}
        compactStatus={compactStatus}
        connectorOperations={connectorOperations}
        connectorRecoveryBusyKey={connectorRecoveryBusyKey}
        connectorRecoveryNow={connectorRecoveryNow}
        connectorRecoveryStatus={connectorRecoveryStatus}
        connectorOperationsSummary={connectorOperationsSummary}
        onCancelConnectorRecovery={onCancelConnectorRecovery}
        onConfirmConnectorRecovery={onConfirmConnectorRecovery}
        onRequestConnectorRecovery={onRequestConnectorRecovery}
        pendingConnectorRecovery={pendingConnectorRecovery}
      />

      <WorkerRunsBlock
        activeWorkerRuns={activeWorkerRuns}
        formatWorkerRunAttempts={formatWorkerRunAttempts}
        formatWorkerRunTiming={formatWorkerRunTiming}
        onWorkerRunFilterChange={onWorkerRunFilterChange}
        workerRunFilter={workerRunFilter}
        workerRunFilterOptions={workerRunFilterOptions}
        workerRunSafeContext={workerRunSafeContext}
        workerRunStatus={workerRunStatus}
        workerRunSummary={workerRunSummary}
      />

      <WorkflowHistoryBlock
        compactDate={compactDate}
        workflowHistory={workflowHistory}
        workflowHistorySafeContext={workflowHistorySafeContext}
        workflowHistoryStatus={workflowHistoryStatus}
        workflowHistorySummary={workflowHistorySummary}
      />

      <QueueRowsBlock displayedQueues={displayedQueues} onSelectMatter={onSelectMatter} />
    </>
  );
}

function formatTaskReviewVisibility(visibility: string): string {
  if (visibility === "staff_only") {
    return "Staff only";
  }
  if (visibility === "matter_team") {
    return "Matter team";
  }
  return visibility.replaceAll("_", " ");
}

function taskReviewSchedulingLabel(
  item: TaskDeadlineWorkbenchResponse["taskReview"]["items"][number],
): string {
  if (item.scheduling.needsReviewCount > 0) {
    return `${item.scheduling.needsReviewCount} scheduling review`;
  }
  if (item.scheduling.requestCount > 0) {
    return `${item.scheduling.reviewedCount} reviewed scheduling cue`;
  }
  return "No scheduling cue";
}

function TaskDeadlineReviewBlock({
  compactDate,
  onSelectMatter,
  taskWorkbench,
}: Pick<QueuesSectionProps, "compactDate" | "onSelectMatter" | "taskWorkbench">) {
  const review = taskWorkbench.taskReview;
  const reviewItems = review.items.slice(0, 6);

  return (
    <>
      <div className="section-title">
        <h3>Task/deadline review</h3>
        <span>{review.summary.open} open</span>
      </div>
      <div className="detail-grid queue-summary-grid">
        <div>
          <span className="field-label">High priority</span>
          <strong>{review.summary.highPriority}</strong>
          <small>{review.summary.overdue} overdue</small>
        </div>
        <div>
          <span className="field-label">Due today</span>
          <strong>{review.summary.dueToday}</strong>
          <small>{review.summary.myOpen} assigned to you</small>
        </div>
        <div>
          <span className="field-label">Unassigned</span>
          <strong>{review.summary.unassigned}</strong>
          <small>Matter-team review</small>
        </div>
        <div>
          <span className="field-label">Scheduling reviews</span>
          <strong>{review.summary.schedulingReviewCount}</strong>
          <small>Staff review only</small>
        </div>
      </div>
      <div className="party-list queue-section-list">
        {reviewItems.map((item) => (
          <button
            className="party-row queue-item-row"
            key={item.id}
            onClick={() => onSelectMatter(item.matterId)}
            type="button"
          >
            <span>
              <strong>{item.title}</strong>
              <small>
                {item.matterNumber} · {item.matterTitle}
              </small>
              <small>
                {compactDate(item.dueAt)} · {item.bucket} · {item.assignment.label} ·{" "}
                {formatTaskReviewVisibility(item.privacy.visibility)} ·{" "}
                {taskReviewSchedulingLabel(item)}
              </small>
            </span>
            <em className={item.tone === "risk" ? "risk" : undefined}>{item.priority}</em>
          </button>
        ))}
        {reviewItems.length === 0 ? (
          <p className="inline-empty">No task/deadline review items.</p>
        ) : null}
      </div>
    </>
  );
}

function DashboardLaneRefreshPanel({
  cue,
  label,
  onRefresh,
  refreshing,
}: {
  cue: DashboardLaneFreshnessCue;
  label: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className={`lane-refresh-panel ${cue.tone}`} data-stale={cue.stale ? "true" : "false"}>
      <span>
        <strong>{label}</strong>
        <small>{cue.detail}</small>
      </span>
      <button
        aria-label={`Refresh ${label.toLowerCase()}`}
        className="secondary-button compact-button lane-refresh-button"
        disabled={refreshing}
        onClick={onRefresh}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={16} />
        {refreshing ? "Refreshing" : cue.label}
      </button>
    </div>
  );
}

function AiOperationalProposalsBlock({
  aiOperationalProposals,
  canReviewAiOperationalProposals,
  compactDate,
  compactStatus,
  onReviewAiOperationalProposal,
  reviewBusyId,
  status,
}: Pick<
  QueuesSectionProps,
  | "aiOperationalProposals"
  | "canReviewAiOperationalProposals"
  | "compactDate"
  | "compactStatus"
  | "onReviewAiOperationalProposal"
> & {
  reviewBusyId: string;
  status: string;
}) {
  const proposals = aiOperationalProposals.proposals.slice(0, 6);
  const summary = aiOperationalProposals.summary;
  const reviewedCount = summary.approved + summary.rejected;

  return (
    <>
      <div className="section-title">
        <h3>AI operational proposals</h3>
        <span>{compactStatus(aiOperationalProposals.generation.status)}</span>
      </div>
      <p className="inline-empty" role="status" aria-live="polite">
        {status}
      </p>
      <div className="detail-grid queue-summary-grid">
        <div>
          <span className="field-label">Proposal rows</span>
          <strong>{summary.total}</strong>
          <small>{describeAiOperationalProposalGeneration(aiOperationalProposals)}</small>
        </div>
        <div>
          <span className="field-label">Proposed</span>
          <strong>{summary.proposed}</strong>
          <small>Awaiting review</small>
        </div>
        <div>
          <span className="field-label">Reviewed</span>
          <strong>{reviewedCount}</strong>
          <small>Status-only approvals and rejections</small>
        </div>
        <div>
          <span className="field-label">Families</span>
          <strong>{Object.values(summary.byKind).filter((count) => count > 0).length}</strong>
          <small>Deadlines, tasks, docs, billing, updates</small>
        </div>
      </div>
      <div className="party-list queue-section-list">
        {proposals.map((proposal) => {
          const busy = reviewBusyId === proposal.id;
          return (
            <div className="party-row queue-item-row" key={proposal.id}>
              <span>
                <strong>{proposal.proposal.title}</strong>
                <small>
                  {formatAiOperationalProposalKind(proposal.kind)} ·{" "}
                  {proposal.source.sourceLabel ?? proposal.source.sourceType} · matter{" "}
                  {proposal.matterId}
                </small>
                <small>{proposal.proposal.summary}</small>
                <small>{proposal.proposal.proposedAction}</small>
                <small>
                  {proposal.providerKey} · {proposal.providerModel} · source{" "}
                  {proposal.source.sourceTextLength} chars · created{" "}
                  {compactDate(proposal.createdAt)}
                </small>
              </span>
              {canReviewAiOperationalProposals && proposal.status === "proposed" ? (
                <span className="queue-row-actions">
                  <button
                    className="secondary-button compact-button"
                    disabled={busy}
                    onClick={() => onReviewAiOperationalProposal(proposal, "approved")}
                    type="button"
                  >
                    {busy ? "Recording" : "Approve"}
                  </button>
                  <button
                    className="secondary-button compact-button"
                    disabled={busy}
                    onClick={() => onReviewAiOperationalProposal(proposal, "rejected")}
                    type="button"
                  >
                    Reject
                  </button>
                </span>
              ) : (
                <em>{proposal.reviewDecision ?? proposal.status}</em>
              )}
            </div>
          );
        })}
        {proposals.length === 0 ? (
          <p className="inline-empty">No AI operational proposals are queued for review.</p>
        ) : null}
      </div>
    </>
  );
}

function ConnectorOperationsBlock({
  canManageConnectorRecovery,
  compactDate,
  compactStatus,
  connectorOperations,
  connectorRecoveryBusyKey,
  connectorRecoveryNow,
  connectorRecoveryStatus,
  connectorOperationsSummary,
  onCancelConnectorRecovery,
  onConfirmConnectorRecovery,
  onRequestConnectorRecovery,
  pendingConnectorRecovery,
}: Pick<
  QueuesSectionProps,
  | "canManageConnectorRecovery"
  | "compactDate"
  | "compactStatus"
  | "connectorOperations"
  | "connectorRecoveryBusyKey"
  | "connectorRecoveryNow"
  | "connectorRecoveryStatus"
  | "connectorOperationsSummary"
  | "onCancelConnectorRecovery"
  | "onConfirmConnectorRecovery"
  | "onRequestConnectorRecovery"
  | "pendingConnectorRecovery"
>) {
  const connectorById = new Map(
    connectorOperations.connectors.map((connector) => [connector.id, connector]),
  );

  return (
    <>
      <div className="section-title">
        <h3>Connector outbox</h3>
        <span>{compactStatus(connectorOperations.status)}</span>
      </div>
      <p className="inline-empty">{connectorOperationsSummary}</p>
      <div className="detail-grid queue-summary-grid">
        <div>
          <span className="field-label">Connectors</span>
          <strong>{connectorOperations.connectors.length}</strong>
        </div>
        <div>
          <span className="field-label">Outbox rows</span>
          <strong>{connectorOperations.outbox.length}</strong>
        </div>
        <div>
          <span className="field-label">Pending</span>
          <strong>
            {connectorOperations.outbox.filter((item) => item.status === "pending").length}
          </strong>
        </div>
        <div>
          <span className="field-label">Leased</span>
          <strong>{connectorOperations.outbox.filter((item) => item.leasePresent).length}</strong>
        </div>
        <div>
          <span className="field-label">Dead letter</span>
          <strong>
            {connectorOperations.outbox.filter((item) => item.status === "dead_letter").length}
          </strong>
        </div>
      </div>
      <div className="party-list queue-section-list">
        {connectorOperations.connectors.map((connector) => (
          <div className="party-row" key={connector.id}>
            <span>
              <strong>{connector.displayName}</strong>
              <small>
                {connector.type} · {connector.key} · {connector.id}
              </small>
            </span>
            <em className={connector.status === "error" ? "risk" : undefined}>
              {compactStatus(connector.status)}
            </em>
          </div>
        ))}
        {connectorOperations.connectors.length === 0 ? (
          <p className="inline-empty">No connector registry records are visible.</p>
        ) : null}
      </div>
      <div className="party-list queue-section-list">
        {connectorOperations.outbox.map((item) => {
          const connector = connectorById.get(item.connectorId);
          const tone = connectorOutboxStatusTone(item);
          const retryAction = describeConnectorOutboxRetryAction(item, canManageConnectorRecovery);
          const deadLetterAction = describeConnectorOutboxDeadLetterAction(
            item,
            canManageConnectorRecovery,
            connectorRecoveryNow,
          );
          const retryTitle = retryAction.available
            ? "Retry connector delivery"
            : `Retry disabled: ${compactConnectorActionReason(retryAction.disabledReason)}`;
          const deadLetterTitle = deadLetterAction.available
            ? "Move connector delivery to dead letter"
            : `Dead-letter disabled: ${compactConnectorActionReason(
                deadLetterAction.disabledReason,
              )}`;
          const pendingRecovery =
            pendingConnectorRecovery && pendingConnectorRecovery.outboxId === item.id
              ? pendingConnectorRecovery
              : undefined;
          const recoveryBusy = Boolean(connectorRecoveryBusyKey);
          return (
            <div className="party-row" key={item.id}>
              <span>
                <strong>
                  {connectorDisplayName(connector)} · {item.eventType}
                </strong>
                <small>
                  {item.id} · {item.status} · attempts {item.attemptCount}/{item.maxAttempts} ·
                  idempotency key {item.idempotencyKeyPresent ? "present" : "absent"} · lease{" "}
                  {item.leasePresent ? "present" : "absent"}
                </small>
                <small>{summarizeConnectorPayload(item.payloadSummary)}</small>
                <small>
                  next {compactDate(item.nextAttemptAt)} · leased until{" "}
                  {compactDate(item.leasedUntil)} · delivered {compactDate(item.deliveredAt)} · dead
                  letter {compactDate(item.deadLetteredAt)}
                </small>
                {item.lastErrorSummary ? <small>{item.lastErrorSummary}</small> : null}
                {pendingRecovery ? (
                  <small className="connector-recovery-confirmation">
                    Confirm {pendingRecovery.action === "retry" ? "retry" : "dead-letter"} for{" "}
                    {item.id}.
                    <button
                      className="primary-button compact-button row-button"
                      disabled={recoveryBusy}
                      onClick={onConfirmConnectorRecovery}
                      type="button"
                    >
                      Confirm
                    </button>
                    <button
                      className="secondary-button compact-button row-button"
                      disabled={recoveryBusy}
                      onClick={onCancelConnectorRecovery}
                      type="button"
                    >
                      Cancel
                    </button>
                  </small>
                ) : null}
              </span>
              <span className="queue-row-actions">
                {canManageConnectorRecovery ? (
                  <>
                    <button
                      aria-label={`Retry ${item.id}`}
                      className="secondary-button compact-button row-button"
                      disabled={!retryAction.available || recoveryBusy}
                      onClick={() => onRequestConnectorRecovery(item, "retry")}
                      title={retryTitle}
                      type="button"
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                    </button>
                    <button
                      aria-label={`Dead-letter ${item.id}`}
                      className="secondary-button compact-button row-button"
                      disabled={!deadLetterAction.available || recoveryBusy}
                      onClick={() => onRequestConnectorRecovery(item, "dead_letter")}
                      title={deadLetterTitle}
                      type="button"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </>
                ) : null}
                <em className={tone === "risk" ? "risk" : undefined}>
                  {compactStatus(item.status)}
                </em>
              </span>
            </div>
          );
        })}
        {connectorOperations.outbox.length === 0 ? (
          <p className="inline-empty">No connector outbox rows are visible.</p>
        ) : null}
        {connectorRecoveryStatus ? (
          <p className="inline-empty" role="status" aria-live="polite">
            {connectorRecoveryStatus}
          </p>
        ) : null}
      </div>
    </>
  );
}

function SavedQueueViewsBlock({
  activeSavedOperationalViewDefinition,
  activeSavedOperationalViewId,
  archivingOperationalViewId,
  compactDate,
  formatSavedOperationalViewDefinition,
  onApplyQueueOperationalViewDefinition,
  onArchiveQueueOperationalViewDefinition,
  onClearQueueOperationalViewDefinition,
  onSaveQueueOperationalViewDefinition,
  savedOperationalViewDefinitions,
  savedOperationalViewStatus,
  savingOperationalView,
}: Pick<
  QueuesSectionProps,
  | "activeSavedOperationalViewDefinition"
  | "activeSavedOperationalViewId"
  | "archivingOperationalViewId"
  | "compactDate"
  | "formatSavedOperationalViewDefinition"
  | "onApplyQueueOperationalViewDefinition"
  | "onArchiveQueueOperationalViewDefinition"
  | "onClearQueueOperationalViewDefinition"
  | "onSaveQueueOperationalViewDefinition"
  | "savedOperationalViewDefinitions"
  | "savedOperationalViewStatus"
  | "savingOperationalView"
>) {
  return (
    <>
      <div className="section-title">
        <h3>Saved views</h3>
        <span className="row-actions">
          {activeSavedOperationalViewDefinition ? (
            <button
              className="secondary-button compact-button row-button"
              onClick={onClearQueueOperationalViewDefinition}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={16} />
              Clear focus
            </button>
          ) : null}
          <button
            className="secondary-button compact-button row-button"
            disabled={savingOperationalView}
            onClick={onSaveQueueOperationalViewDefinition}
            type="button"
          >
            <Save aria-hidden="true" size={16} />
            {savingOperationalView ? "Saving" : "Save current focus"}
          </button>
        </span>
      </div>
      {activeSavedOperationalViewDefinition ? (
        <p className="inline-empty">
          Applied saved focus: {activeSavedOperationalViewDefinition.name}
        </p>
      ) : null}
      <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
        {savedOperationalViewStatus}
      </p>
      <div className="party-list queue-section-list">
        {savedOperationalViewDefinitions.map((definition) => (
          <div className="party-row" key={definition.id}>
            <span>
              <strong>{definition.name}</strong>
              <small>{formatSavedOperationalViewDefinition(definition)}</small>
              <small>updated {compactDate(definition.updatedAt)}</small>
            </span>
            <span className="row-actions">
              <button
                aria-label={`Apply ${definition.name}`}
                className="secondary-button compact-button row-button"
                disabled={activeSavedOperationalViewId === definition.id}
                onClick={() => onApplyQueueOperationalViewDefinition(definition)}
                type="button"
              >
                <Clock3 aria-hidden="true" size={16} />
                {activeSavedOperationalViewId === definition.id ? "Applied" : "Apply"}
              </button>
              <button
                aria-label={`Archive ${definition.name}`}
                className="secondary-button compact-button row-button"
                disabled={archivingOperationalViewId === definition.id}
                onClick={() => onArchiveQueueOperationalViewDefinition(definition)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
                {archivingOperationalViewId === definition.id ? "Archiving" : "Archive"}
              </button>
            </span>
          </div>
        ))}
        {savedOperationalViewDefinitions.length === 0 ? (
          <p className="inline-empty">No saved queue views are active.</p>
        ) : null}
      </div>
    </>
  );
}

function ProviderPostureBlock({
  canManageDocumentProcessingProvider,
  compactProviderStatus,
  ocrProviderUpdateStatus,
  ocrProviderUpdating,
  onSetOcrProviderEnabled,
  providerFreshnessCue: freshnessCue,
  onRefreshProviders: onRefresh,
  providerRows,
  providerStatus,
  providerStatusSummary,
  providerRefreshing: refreshing,
}: Pick<
  QueuesSectionProps,
  | "compactProviderStatus"
  | "canManageDocumentProcessingProvider"
  | "ocrProviderUpdateStatus"
  | "ocrProviderUpdating"
  | "onSetOcrProviderEnabled"
  | "providerFreshnessCue"
  | "onRefreshProviders"
  | "providerRows"
  | "providerStatus"
  | "providerStatusSummary"
  | "providerRefreshing"
>) {
  const ocrProviderEnabled = providerStatus.documentProcessing.status === "configured";
  const ocrQueue = providerStatus.documentProcessing.workerQueues.find(
    (queue) => queue.queueName === "ocr",
  );

  return (
    <>
      <DashboardLaneRefreshPanel
        cue={freshnessCue}
        label="Provider posture"
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
      <div className="section-title">
        <h3>Provider posture</h3>
        <span>{compactProviderStatus(providerStatus.liveHealth.status)}</span>
      </div>
      <p className="inline-empty">{providerStatusSummary}</p>
      <div className="party-row">
        <span>
          <strong>Local OCR provider</strong>
          <small>
            Provider {compactProviderStatus(providerStatus.documentProcessing.status)} · OCR queue{" "}
            {compactProviderStatus(ocrQueue?.status)}
          </small>
          <small>{ocrProviderUpdateStatus}</small>
        </span>
        {canManageDocumentProcessingProvider ? (
          <button
            className="secondary-button compact-button row-button"
            disabled={ocrProviderUpdating || refreshing}
            onClick={() => onSetOcrProviderEnabled(!ocrProviderEnabled)}
            type="button"
          >
            <Power aria-hidden="true" size={16} />
            {ocrProviderUpdating
              ? "Updating OCR"
              : ocrProviderEnabled
                ? "Disable OCR"
                : "Enable OCR"}
          </button>
        ) : (
          <em>Read only</em>
        )}
      </div>
      <div className="detail-grid queue-summary-grid">
        <div>
          <span className="field-label">Object storage</span>
          <strong>{compactProviderStatus(providerStatus.objectStorage.status)}</strong>
        </div>
        <div>
          <span className="field-label">Producer queues</span>
          <strong>
            {
              providerStatus.bullmq.producerQueues.filter((queue) => queue.status === "configured")
                .length
            }
            /{providerStatus.bullmq.producerQueues.length}
          </strong>
        </div>
        <div>
          <span className="field-label">Worker queues</span>
          <strong>
            {
              providerStatus.bullmq.workerQueues.filter((queue) => queue.status === "configured")
                .length
            }
            /{providerStatus.bullmq.workerQueues.length}
          </strong>
        </div>
        <div>
          <span className="field-label">Reserved workers</span>
          <strong>{providerStatus.bullmq.reservedWorkerQueues?.length ?? 0}</strong>
        </div>
        <div>
          <span className="field-label">Latest runs</span>
          <strong>{providerStatus.jobs.latestRuns.length}</strong>
        </div>
      </div>
      <div className="party-list queue-section-list">
        {providerRows.map((row) => (
          <div className="party-row" key={row.key}>
            <span>
              <strong>{row.label}</strong>
              <small>{row.detail}</small>
            </span>
            <em className={row.tone === "risk" ? "risk" : undefined}>{row.status}</em>
          </div>
        ))}
      </div>
    </>
  );
}

function WorkerHealthBlock({
  compactDate,
  compactStatus,
  workerHealth,
  workerHealthStateTone,
  workerHealthSummary,
}: Pick<
  QueuesSectionProps,
  "compactDate" | "compactStatus" | "workerHealth" | "workerHealthStateTone" | "workerHealthSummary"
>) {
  return (
    <>
      <div className="section-title">
        <h3>Worker health</h3>
        <span className={workerHealthStateTone === "risk" ? "risk" : undefined}>
          {compactStatus(workerHealth.status)}
        </span>
      </div>
      <p className="inline-empty">{workerHealthSummary}</p>
      <div className="detail-grid queue-summary-grid">
        <div>
          <span className="field-label">Configured</span>
          <strong>{workerHealth.configuredQueues}</strong>
        </div>
        <div>
          <span className="field-label">Active or queued</span>
          <strong>{workerHealth.activeOrQueued}</strong>
        </div>
        <div>
          <span className="field-label">Failed</span>
          <strong>{workerHealth.failed}</strong>
        </div>
        <div>
          <span className="field-label">Stalled</span>
          <strong>{workerHealth.stalled}</strong>
        </div>
        <div>
          <span className="field-label">Observed</span>
          <strong>{compactDate(workerHealth.lastObservedAt)}</strong>
        </div>
      </div>
      <div className="party-list queue-section-list">
        {workerHealth.queues.map((queue) => (
          <div className="party-row" key={queue.queueName}>
            <span>
              <strong>{queue.queueName}</strong>
              <small>
                {queue.status} · {queue.total} runs · {queue.active} active · {queue.queued} queued
                · {queue.failed} failed · {queue.stalled} stalled
              </small>
              {queue.lastObservedAt ? (
                <small>last observed {compactDate(queue.lastObservedAt)}</small>
              ) : null}
            </span>
            <em className={queue.health === "degraded" ? "risk" : undefined}>
              {compactStatus(queue.health)}
            </em>
          </div>
        ))}
        {workerHealth.queues.length === 0 ? (
          <p className="inline-empty">Worker health has not been observed yet.</p>
        ) : null}
      </div>
    </>
  );
}

function WorkerRunsBlock({
  activeWorkerRuns,
  formatWorkerRunAttempts,
  formatWorkerRunTiming,
  onWorkerRunFilterChange,
  workerRunFilter,
  workerRunFilterOptions,
  workerRunSafeContext,
  workerRunStatus,
  workerRunSummary,
}: Pick<
  QueuesSectionProps,
  | "activeWorkerRuns"
  | "formatWorkerRunAttempts"
  | "formatWorkerRunTiming"
  | "onWorkerRunFilterChange"
  | "workerRunFilter"
  | "workerRunFilterOptions"
  | "workerRunSafeContext"
  | "workerRunStatus"
  | "workerRunSummary"
>) {
  return (
    <>
      <div className="section-title">
        <h3>Worker runs</h3>
        <span>{activeWorkerRuns.jobs.length} runs</span>
      </div>
      <div className="row-actions" aria-label="Worker run filters">
        {workerRunFilterOptions.map((filter) => (
          <button
            aria-pressed={workerRunFilter === filter.key}
            className="secondary-button compact-button row-button"
            key={filter.key}
            onClick={() => onWorkerRunFilterChange(filter.key)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>
      <p className="inline-empty">{workerRunSummary}</p>
      <div className="party-list queue-section-list">
        {activeWorkerRuns.jobs.map((job) => {
          const state = workerRunStatus(job);
          return (
            <div className="party-row" key={job.id}>
              <span>
                <strong>
                  {job.queueName} · {job.jobName ?? job.id}
                </strong>
                <small>
                  {formatWorkerRunAttempts(job)} · {formatWorkerRunTiming(job)} ·{" "}
                  {workerRunSafeContext(job)}
                </small>
                {job.errorSummary ? <small>{job.errorSummary}</small> : null}
              </span>
              <em className={state.tone === "risk" ? "risk" : undefined}>{state.label}</em>
            </div>
          );
        })}
        {activeWorkerRuns.jobs.length === 0 ? (
          <p className="inline-empty">No worker runs match this filter.</p>
        ) : null}
      </div>
    </>
  );
}

function WorkflowHistoryBlock({
  compactDate,
  workflowHistory,
  workflowHistorySafeContext,
  workflowHistoryStatus,
  workflowHistorySummary,
}: Pick<
  QueuesSectionProps,
  | "compactDate"
  | "workflowHistory"
  | "workflowHistorySafeContext"
  | "workflowHistoryStatus"
  | "workflowHistorySummary"
>) {
  return (
    <>
      <div className="section-title">
        <h3>Workflow history</h3>
        <span>{workflowHistory.workflows.length} histories</span>
      </div>
      <p className="inline-empty">{workflowHistorySummary}</p>
      <div className="party-list queue-section-list">
        {workflowHistory.workflows.slice(0, 6).map((workflow) => {
          const state = workflowHistoryStatus(workflow.status);
          return (
            <div className="party-row" key={workflow.id}>
              <span>
                <strong>{workflow.title}</strong>
                <small>
                  {workflow.stepCount} steps · last {compactDate(workflow.lastObservedAt)} ·{" "}
                  {workflowHistorySafeContext(workflow)}
                </small>
                <small>
                  {workflow.steps
                    .slice(0, 3)
                    .map((step) => `${step.source}: ${step.label}`)
                    .join(" · ")}
                </small>
              </span>
              <em className={state.tone === "risk" ? "risk" : undefined}>{state.label}</em>
            </div>
          );
        })}
        {workflowHistory.workflows.length === 0 ? (
          <p className="inline-empty">No workflow-step history is available yet.</p>
        ) : null}
      </div>
    </>
  );
}

function QueueRowsBlock({
  displayedQueues,
  onSelectMatter,
}: Pick<QueuesSectionProps, "displayedQueues" | "onSelectMatter">) {
  return (
    <div className="party-list queue-section-list">
      {displayedQueues.sections.map((section) => (
        <section className="queue-section" key={section.key}>
          <div className="section-title">
            <h3>{section.label}</h3>
            <span>{section.items.length} items</span>
          </div>
          {section.items.map((item) =>
            item.matterId ? (
              <button
                className="party-row queue-item-row"
                key={item.id}
                onClick={() => onSelectMatter(item.matterId!)}
                type="button"
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.status}</small>
                </span>
                <em className={item.priority === "high" ? "risk" : undefined}>{item.priority}</em>
              </button>
            ) : (
              <div className="party-row queue-item-row static-row" key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.status} · no linked matter</small>
                </span>
                <em className={item.priority === "high" ? "risk" : undefined}>{item.priority}</em>
              </div>
            ),
          )}
          {section.items.length === 0 ? (
            <p className="inline-empty">No items in this queue.</p>
          ) : null}
        </section>
      ))}
      {displayedQueues.sections.length === 0 ? (
        <p className="inline-empty">No operational queues were returned.</p>
      ) : null}
    </div>
  );
}
