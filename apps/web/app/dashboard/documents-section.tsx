import { Search, X } from "lucide-react";

import type { DocumentAssemblyWorkbenchResponse } from "../_features/document-assembly/models";
import {
  documentMetadataClassificationOptions,
  documentMetadataCueGroupOptions,
  documentMetadataOcrStatusOptions,
  documentMetadataReviewStatusOptions,
  documentMetadataScanStatusOptions,
} from "../_features/dashboard/formatters";
import type {
  DocumentMetadataTag,
  DocumentProcessingWorkbenchItem,
  DocumentProcessingWorkbenchResponse,
} from "../_features/document-processing/models";
import {
  compactDocumentMetadataTag,
  compactDocumentProcessingReason,
  describeDocumentQueueAction,
  describeDocumentReviewSuggestion,
  describeLatestDocumentJob,
  describeLatestExtraction,
  documentProcessingGroupLabel,
  documentProcessingGroupOrder,
  documentReviewSuggestionGroupLabel,
  documentReviewSuggestionGroupOrder,
  emptyDocumentReviewSuggestions,
} from "../document-processing-dashboard";
import { DocumentAssemblyDashboardBlock } from "./document-assembly-dashboard-block";

interface DocumentsSectionProps {
  activeDocumentAssembly: DocumentAssemblyWorkbenchResponse;
  activeDocumentMetadataFilterCount: number;
  activeDocumentMetadataTags: DocumentMetadataTag[];
  activeDocumentProcessing: DocumentProcessingWorkbenchResponse;
  activeDocumentProcessingRows: DocumentProcessingWorkbenchItem[];
  activeMatterNumber: string;
  documentMetadataClassificationFilter: string;
  documentMetadataCueGroupFilter: string;
  documentMetadataOcrStatusFilter: string;
  documentMetadataQuery: string;
  documentMetadataReviewStatusFilter: string;
  documentMetadataScanStatusFilter: string;
  documentMetadataSearchSummary: string;
  documentProcessingStatus: string;
  documentProcessingSummary: string;
  documentReviewSuggestionsSummary: string;
  queueingDocumentId: string;
  onClearDocumentMetadataSearch: () => Promise<void> | void;
  onDocumentMetadataClassificationFilterChange: (value: string) => void;
  onDocumentMetadataCueGroupFilterChange: (value: string) => void;
  onDocumentMetadataOcrStatusFilterChange: (value: string) => void;
  onDocumentMetadataQueryChange: (value: string) => void;
  onDocumentMetadataReviewStatusFilterChange: (value: string) => void;
  onDocumentMetadataScanStatusFilterChange: (value: string) => void;
  onQueueDocumentOcr: (documentId: string) => Promise<void> | void;
  onRefreshDocumentMetadataSearch: () => Promise<void> | void;
  onSelectDocumentMetadataTag: (tag: string) => Promise<void> | void;
}

export function DocumentsSection({
  activeDocumentAssembly,
  activeDocumentMetadataFilterCount,
  activeDocumentMetadataTags,
  activeDocumentProcessing,
  activeDocumentProcessingRows,
  activeMatterNumber,
  documentMetadataClassificationFilter,
  documentMetadataCueGroupFilter,
  documentMetadataOcrStatusFilter,
  documentMetadataQuery,
  documentMetadataReviewStatusFilter,
  documentMetadataScanStatusFilter,
  documentMetadataSearchSummary,
  documentProcessingStatus,
  documentProcessingSummary,
  documentReviewSuggestionsSummary,
  queueingDocumentId,
  onClearDocumentMetadataSearch,
  onDocumentMetadataClassificationFilterChange,
  onDocumentMetadataCueGroupFilterChange,
  onDocumentMetadataOcrStatusFilterChange,
  onDocumentMetadataQueryChange,
  onDocumentMetadataReviewStatusFilterChange,
  onDocumentMetadataScanStatusFilterChange,
  onQueueDocumentOcr,
  onRefreshDocumentMetadataSearch,
  onSelectDocumentMetadataTag,
}: DocumentsSectionProps) {
  return (
    <>
      <div className="detail-grid">
        <div>
          <span className="field-label">Workbench</span>
          <strong>{compactDocumentProcessingReason(activeDocumentProcessing.status)}</strong>
        </div>
        <div>
          <span className="field-label">Provider state</span>
          <strong>
            {
              activeDocumentProcessing.providerStatus.filter(
                (provider) => provider.status === "configured",
              ).length
            }
            /{activeDocumentProcessing.providerStatus.length}
          </strong>
        </div>
        <div>
          <span className="field-label">Worker queues</span>
          <strong>
            {
              activeDocumentProcessing.workerQueues.filter((queue) => queue.status === "configured")
                .length
            }
            /
            {
              activeDocumentProcessing.workerQueues.filter((queue) => queue.status !== "reserved")
                .length
            }
          </strong>
        </div>
        <div>
          <span className="field-label">Jobs</span>
          <strong>
            {activeDocumentProcessing.summary.queued + activeDocumentProcessing.summary.active}{" "}
            active · {activeDocumentProcessing.summary.failed} failed
          </strong>
        </div>
      </div>
      <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
        {documentProcessingStatus} {documentProcessingSummary} {documentReviewSuggestionsSummary}
      </p>
      <DocumentAssemblyDashboardBlock workbench={activeDocumentAssembly} />
      <div className="document-metadata-search-panel">
        <label className="search-field compact">
          <span>Metadata search</span>
          <input
            onChange={(event) => onDocumentMetadataQueryChange(event.target.value)}
            placeholder="title, cue, status"
            value={documentMetadataQuery}
          />
        </label>
        <label className="search-field compact">
          <span>Classification</span>
          <select
            onChange={(event) => onDocumentMetadataClassificationFilterChange(event.target.value)}
            value={documentMetadataClassificationFilter}
          >
            <option value="">Any</option>
            {documentMetadataClassificationOptions.map((option) => (
              <option key={option} value={option}>
                {compactDocumentProcessingReason(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="search-field compact">
          <span>Review</span>
          <select
            onChange={(event) => onDocumentMetadataReviewStatusFilterChange(event.target.value)}
            value={documentMetadataReviewStatusFilter}
          >
            <option value="">Any</option>
            {documentMetadataReviewStatusOptions.map((option) => (
              <option key={option} value={option}>
                {compactDocumentProcessingReason(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="search-field compact">
          <span>Scan</span>
          <select
            onChange={(event) => onDocumentMetadataScanStatusFilterChange(event.target.value)}
            value={documentMetadataScanStatusFilter}
          >
            <option value="">Any</option>
            {documentMetadataScanStatusOptions.map((option) => (
              <option key={option} value={option}>
                {compactDocumentProcessingReason(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="search-field compact">
          <span>OCR</span>
          <select
            onChange={(event) => onDocumentMetadataOcrStatusFilterChange(event.target.value)}
            value={documentMetadataOcrStatusFilter}
          >
            <option value="">Any</option>
            {documentMetadataOcrStatusOptions.map((option) => (
              <option key={option} value={option}>
                {compactDocumentProcessingReason(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="search-field compact">
          <span>Cue</span>
          <select
            onChange={(event) => onDocumentMetadataCueGroupFilterChange(event.target.value)}
            value={documentMetadataCueGroupFilter}
          >
            <option value="">Any</option>
            {documentMetadataCueGroupOptions.map((option) => (
              <option key={option} value={option}>
                {compactDocumentProcessingReason(option)}
              </option>
            ))}
          </select>
        </label>
        <div className="document-metadata-search-actions">
          <span>{activeDocumentMetadataFilterCount} active filters</span>
          <button
            className="secondary-button compact-button"
            onClick={() => void onRefreshDocumentMetadataSearch()}
            type="button"
          >
            <Search aria-hidden="true" size={16} />
            Search
          </button>
          <button
            className="secondary-button compact-button"
            disabled={activeDocumentMetadataFilterCount === 0}
            onClick={() => void onClearDocumentMetadataSearch()}
            type="button"
          >
            <X aria-hidden="true" size={16} />
            Clear
          </button>
        </div>
      </div>
      <p className="inline-empty">{documentMetadataSearchSummary}</p>
      {activeDocumentMetadataTags.length > 0 ? (
        <div className="document-metadata-tags" aria-label="Document metadata tags">
          {activeDocumentMetadataTags.map((tag) => (
            <button
              className={`metadata-tag ${tag.tone}`}
              key={tag.key}
              onClick={() => void onSelectDocumentMetadataTag(tag.key)}
              type="button"
            >
              {compactDocumentMetadataTag(tag)}
            </button>
          ))}
        </div>
      ) : null}
      {activeDocumentMetadataFilterCount > 0 ? (
        <div className="party-list document-metadata-results">
          {(activeDocumentProcessing.metadataSearch?.results ?? []).map((result) => (
            <div className="party-row" key={result.documentId}>
              <span>
                <strong>{result.title}</strong>
                <small>
                  {compactDocumentProcessingReason(result.classification)} · review{" "}
                  {compactDocumentProcessingReason(result.reviewStatus)} · scan{" "}
                  {compactDocumentProcessingReason(result.scanStatus)} · OCR{" "}
                  {compactDocumentProcessingReason(result.ocrStatus)}
                </small>
                <small>
                  {result.matchedFields.length > 0
                    ? `Matched ${result.matchedFields.join(", ")}`
                    : "Metadata posture match"}{" "}
                  · {result.tagKeys.length} tag cues · {result.cueCounts.total} reviewer cues
                </small>
              </span>
              <em>{result.legalHold ? "legal hold" : "review only"}</em>
            </div>
          ))}
          {activeDocumentProcessing.metadataSearch?.results.length === 0 ? (
            <p className="inline-empty">No document metadata matches.</p>
          ) : null}
        </div>
      ) : null}

      {activeDocumentProcessing.providerStatus.length > 0 ? (
        <>
          <div className="section-title">
            <h3>Providers and workers</h3>
            <span>{activeMatterNumber}</span>
          </div>
          <div className="party-list">
            {activeDocumentProcessing.providerStatus.map((provider) => (
              <div className="party-row" key={`provider:${provider.kind}`}>
                <span>
                  <strong>{compactDocumentProcessingReason(provider.kind)}</strong>
                  <small>
                    {compactDocumentProcessingReason(provider.reason)} ·{" "}
                    {provider.providers?.filter((candidate) => candidate.enabled).length ?? 0}{" "}
                    enabled providers
                  </small>
                </span>
                <em className={provider.status === "disabled" ? "risk" : undefined}>
                  {compactDocumentProcessingReason(provider.status)}
                </em>
              </div>
            ))}
            {activeDocumentProcessing.workerQueues.map((queue) => (
              <div className="party-row" key={`queue:${queue.queueName}`}>
                <span>
                  <strong>{compactDocumentProcessingReason(queue.queueName)}</strong>
                  <small>
                    {queue.status === "reserved"
                      ? `reserved ${compactDocumentProcessingReason(queue.task)}`
                      : "actionable"}
                    {queue.reason ? ` · ${compactDocumentProcessingReason(queue.reason)}` : ""}
                  </small>
                </span>
                <em className={queue.status === "not_configured" ? "risk" : undefined}>
                  {compactDocumentProcessingReason(queue.status)}
                </em>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="section-title">
        <h3>Document processing workbench</h3>
        <span>{activeDocumentProcessingRows.length} documents</span>
      </div>
      <div className="party-list queue-section-list">
        {documentProcessingGroupOrder.map((group) => {
          const groupRows = activeDocumentProcessingRows.filter((item) => item.group === group);
          if (groupRows.length === 0) return null;
          return (
            <section className="queue-section" key={group}>
              <div className="section-title">
                <h3>{documentProcessingGroupLabel(group)}</h3>
                <span>{groupRows.length}</span>
              </div>
              {groupRows.map((item) => {
                const action = describeDocumentQueueAction(item, activeDocumentProcessing);
                const job = describeLatestDocumentJob(item.latestJob);
                const reviewSuggestions =
                  item.reviewSuggestions ?? emptyDocumentReviewSuggestions();
                return (
                  <div className="party-row upload-review-row" key={item.document.id}>
                    <span>
                      <strong>{item.document.title}</strong>
                      <small>
                        v{item.document.version} ·{" "}
                        {compactDocumentProcessingReason(item.document.classification)} · upload{" "}
                        {compactDocumentProcessingReason(item.document.uploadStatus)} · checksum{" "}
                        {compactDocumentProcessingReason(item.document.checksumStatus)} · scan{" "}
                        {compactDocumentProcessingReason(item.document.scanStatus)} · review{" "}
                        {compactDocumentProcessingReason(item.document.reviewStatus)}
                        {item.document.legalHold ? " · legal hold" : ""}
                      </small>
                      <small>
                        Job {job.label} · {describeLatestExtraction(item.latestExtraction)}
                        {item.latestJob?.errorSummary ? ` · ${item.latestJob.errorSummary}` : ""}
                      </small>
                      {item.metadataTags?.length ? (
                        <small>
                          Tags{" "}
                          {item.metadataTags
                            .slice(0, 5)
                            .map((tag) => tag.label)
                            .join(" · ")}
                        </small>
                      ) : null}
                      {action.disabledReason ? (
                        <small>Disabled: {action.disabledReason}</small>
                      ) : null}
                      {reviewSuggestions.summaryCounts.total > 0 ? (
                        <div className="document-suggestions">
                          <small>
                            Reviewer suggestions · {reviewSuggestions.summaryCounts.total} cues ·
                            read only
                          </small>
                          {documentReviewSuggestionGroupOrder.map((suggestionGroup) => {
                            const cues = reviewSuggestions.groups[suggestionGroup] ?? [];
                            if (cues.length === 0) return null;
                            return (
                              <div className="document-suggestion-group" key={suggestionGroup}>
                                <small>{documentReviewSuggestionGroupLabel(suggestionGroup)}</small>
                                {cues.map((cue) => (
                                  <small
                                    className={cue.tone === "risk" ? "risk" : undefined}
                                    key={cue.id}
                                  >
                                    {cue.label}
                                    {describeDocumentReviewSuggestion(cue)
                                      ? ` · ${describeDocumentReviewSuggestion(cue)}`
                                      : ""}
                                  </small>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </span>
                    <div className="row-actions upload-review-actions">
                      <em className={action.tone === "risk" ? "risk" : undefined}>
                        {documentProcessingGroupLabel(item.group)}
                      </em>
                      <button
                        className="secondary-button compact-button row-button"
                        disabled={!action.canQueue || queueingDocumentId.length > 0}
                        onClick={() => void onQueueDocumentOcr(item.document.id)}
                        type="button"
                      >
                        {queueingDocumentId === item.document.id ? "Queueing..." : action.label}
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
        {activeDocumentProcessingRows.length === 0 ? (
          <p className="inline-empty">No documents are linked to this matter.</p>
        ) : null}
      </div>
    </>
  );
}
