import {
  describeExternalUploadReviewState,
  externalUploadReviewReasons,
  getExternalUploadLinkState,
  type ExternalUploadReviewDecision,
  type ExternalUploadReviewReason,
} from "../external-uploads-dashboard";
import { compactDate, compactStatus } from "../_features/dashboard/formatters";
import type {
  ExternalUploadLinkRecord,
  ExternalUploadReviewItem,
  ExternalUploadsStatusResponse,
} from "../_features/external-uploads/models";
import { OneTimeSecretPanel } from "./shared-panels";

export interface ExternalUploadsSectionProps {
  activeExternalUploadDocuments: ExternalUploadReviewItem[];
  activeExternalUploads: ExternalUploadLinkRecord[];
  activeMatterNumber: string;
  creatingExternalUpload: boolean;
  externalUploadCreateDisabled: boolean;
  externalUploadExpiresAt: string;
  externalUploadMaxUploads: string;
  externalUploadReviewNotesByDocumentId: Record<string, string>;
  externalUploadReviewReasonsByDocumentId: Record<string, ExternalUploadReviewReason | "">;
  externalUploadStatus: string;
  externalUploadStatusResponse: ExternalUploadsStatusResponse;
  externalUploadToken: string;
  reviewingExternalUploadDocumentId: string;
  revokingExternalUploadId: string;
  onCreateExternalUploadLink: () => void;
  onReviewExternalUploadDocument: (
    document: ExternalUploadReviewItem,
    decision: ExternalUploadReviewDecision,
  ) => void;
  onRevokeExternalUploadLink: (uploadId: string) => void;
  onSetExternalUploadExpiresAt: (value: string) => void;
  onSetExternalUploadMaxUploads: (value: string) => void;
  onSetExternalUploadReviewNote: (documentId: string, value: string) => void;
  onSetExternalUploadReviewReason: (
    documentId: string,
    value: ExternalUploadReviewReason | "",
  ) => void;
}

export function ExternalUploadsSection({
  activeExternalUploadDocuments,
  activeExternalUploads,
  activeMatterNumber,
  creatingExternalUpload,
  externalUploadCreateDisabled,
  externalUploadExpiresAt,
  externalUploadMaxUploads,
  externalUploadReviewNotesByDocumentId,
  externalUploadReviewReasonsByDocumentId,
  externalUploadStatus,
  externalUploadStatusResponse,
  externalUploadToken,
  reviewingExternalUploadDocumentId,
  revokingExternalUploadId,
  onCreateExternalUploadLink,
  onReviewExternalUploadDocument,
  onRevokeExternalUploadLink,
  onSetExternalUploadExpiresAt,
  onSetExternalUploadMaxUploads,
  onSetExternalUploadReviewNote,
  onSetExternalUploadReviewReason,
}: ExternalUploadsSectionProps) {
  return (
    <>
      <div className="detail-grid">
        <div>
          <span className="field-label">Create status</span>
          <strong>{compactStatus(externalUploadStatusResponse.status)}</strong>
        </div>
        <div>
          <span className="field-label">Provider</span>
          <strong>{compactStatus(externalUploadStatusResponse.provider)}</strong>
        </div>
        <div>
          <span className="field-label">Reason</span>
          <strong>{compactStatus(externalUploadStatusResponse.reason)}</strong>
        </div>
        <div>
          <span className="field-label">Active links</span>
          <strong>
            {
              activeExternalUploads.filter(
                (upload) => getExternalUploadLinkState(upload) === "active",
              ).length
            }
          </strong>
        </div>
      </div>

      <div className="section-title">
        <h3>Create link</h3>
        <span>{activeMatterNumber}</span>
      </div>
      <div className="upload-create-grid">
        <label className="search-field compact">
          <span>Max uploads</span>
          <input
            disabled={externalUploadCreateDisabled}
            min={1}
            onChange={(event) => onSetExternalUploadMaxUploads(event.target.value)}
            type="number"
            value={externalUploadMaxUploads}
          />
        </label>
        <label className="search-field compact">
          <span>Expiry</span>
          <input
            disabled={externalUploadCreateDisabled}
            onChange={(event) => onSetExternalUploadExpiresAt(event.target.value)}
            type="datetime-local"
            value={externalUploadExpiresAt}
          />
        </label>
        <button
          className="primary-button"
          disabled={externalUploadCreateDisabled}
          onClick={() => onCreateExternalUploadLink()}
          type="button"
        >
          {creatingExternalUpload ? "Creating..." : "Create link"}
        </button>
      </div>
      {externalUploadToken ? (
        <OneTimeSecretPanel items={[{ label: "One-time token", value: externalUploadToken }]} />
      ) : null}
      <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
        {externalUploadStatus}
      </p>

      <div className="section-title">
        <h3>External upload links</h3>
        <span>{activeExternalUploads.length} records</span>
      </div>
      <div className="party-list">
        {activeExternalUploads.map((upload) => {
          const linkState = getExternalUploadLinkState(upload);
          return (
            <div className="party-row upload-link-row" key={upload.id}>
              <span>
                <strong>{upload.id}</strong>
                <small>
                  {upload.usedUploads}/{upload.maxUploads} used · expires{" "}
                  {compactDate(upload.expiresAt)} · created {compactDate(upload.createdAt)}
                </small>
              </span>
              <div className="row-actions">
                <em className={linkState === "active" ? undefined : "risk"}>{linkState}</em>
                {!upload.revokedAt ? (
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={revokingExternalUploadId === upload.id}
                    onClick={() => onRevokeExternalUploadLink(upload.id)}
                    type="button"
                  >
                    {revokingExternalUploadId === upload.id ? "Revoking..." : "Revoke"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {activeExternalUploads.length === 0 ? (
          <p className="inline-empty">No external upload links for this matter.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Uploaded document review</h3>
        <span>{activeExternalUploadDocuments.length} records</span>
      </div>
      <div className="party-list">
        {activeExternalUploadDocuments.map((document) => {
          const reviewState = describeExternalUploadReviewState(document);
          const reviewKey = `${document.id}:`;
          return (
            <div className="party-row upload-review-row" key={document.id}>
              <span>
                <strong>{document.title}</strong>
                <small>
                  {compactStatus(document.uploadStatus)} · {compactStatus(document.checksumStatus)}{" "}
                  checksum · {compactStatus(document.scanStatus)} scan
                  {document.duplicateOfDocumentId
                    ? ` · duplicate of ${document.duplicateOfDocumentId}`
                    : ""}
                </small>
                {document.accessLogProof ? (
                  <small>
                    Access proof: {document.accessLogProof.total} log
                    {document.accessLogProof.total === 1 ? "" : "s"}
                    {document.accessLogProof.outcomes.length
                      ? ` · ${document.accessLogProof.outcomes.join(", ")}`
                      : ""}
                  </small>
                ) : null}
              </span>
              <div className="row-actions upload-review-actions">
                <em className={reviewState.tone === "risk" ? "risk" : undefined}>
                  {reviewState.label}
                </em>
                <select
                  aria-label={`Review reason for ${document.title}`}
                  className="compact-select"
                  disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                  onChange={(event) =>
                    onSetExternalUploadReviewReason(
                      document.id,
                      event.target.value as ExternalUploadReviewReason | "",
                    )
                  }
                  value={externalUploadReviewReasonsByDocumentId[document.id] ?? ""}
                >
                  <option value="">Reason</option>
                  {externalUploadReviewReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {compactStatus(reason)}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Private review note for ${document.title}`}
                  className="compact-input"
                  disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                  maxLength={500}
                  onChange={(event) =>
                    onSetExternalUploadReviewNote(document.id, event.target.value)
                  }
                  placeholder="Private note"
                  value={externalUploadReviewNotesByDocumentId[document.id] ?? ""}
                />
                <button
                  className="secondary-button compact-button row-button"
                  disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                  onClick={() => onReviewExternalUploadDocument(document, "accept")}
                  type="button"
                >
                  Accept
                </button>
                <button
                  className="secondary-button compact-button row-button"
                  disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                  onClick={() => onReviewExternalUploadDocument(document, "request_metadata")}
                  type="button"
                >
                  Metadata
                </button>
                <button
                  className="secondary-button compact-button row-button"
                  disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                  onClick={() => onReviewExternalUploadDocument(document, "request_retry")}
                  type="button"
                >
                  Retry
                </button>
                <button
                  className="secondary-button compact-button row-button"
                  disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                  onClick={() => onReviewExternalUploadDocument(document, "discard")}
                  type="button"
                >
                  Discard
                </button>
              </div>
            </div>
          );
        })}
        {activeExternalUploadDocuments.length === 0 ? (
          <p className="inline-empty">No uploaded external documents need review.</p>
        ) : null}
      </div>
    </>
  );
}
