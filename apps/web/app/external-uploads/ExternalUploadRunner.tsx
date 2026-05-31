"use client";

import { CheckCircle2, FileUp, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { readPublicTokenError } from "../publicTokenClient";
import { PublicTokenNeedsAttention } from "../publicTokenActions";
import { PublicStatusMessage, PublicTokenShell } from "../publicTokenUi";
import {
  buildExternalUploadIntentPayload,
  buildExternalUploadPutHeaders,
  buildPublicExternalUploadCompletePath,
  buildPublicExternalUploadIntentPath,
  buildPublicExternalUploadPath,
  canUploadExternalDocument,
  canRetryExternalUploadDocument,
  describeExternalUploadDocumentStatus,
  describeExternalUploadCompletion,
  describeExternalUploadPutFailure,
  externalUploadAttentionItems,
  externalUploadClassifications,
  externalUploadLifecycleMessage,
  publicExternalUploadErrorMessage,
  type ExternalUploadClassification,
  type PublicExternalUploadDocument,
  type PublicExternalUploadIntentResponse,
  type PublicExternalUploadPayload,
  upsertPublicExternalUploadDocument,
} from "./runner-utils";

interface ExternalUploadRunnerProps {
  apiBaseUrl: string;
  token: string;
}

async function sha256Hex(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function ExternalUploadRunner({ apiBaseUrl, token }: ExternalUploadRunnerProps) {
  const [payload, setPayload] = useState<PublicExternalUploadPayload | null>(null);
  const [status, setStatus] = useState("Loading upload link...");
  const [classification, setClassification] = useState<ExternalUploadClassification>("general");
  const [legalHold, setLegalHold] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [completedDocument, setCompletedDocument] = useState<PublicExternalUploadDocument | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    async function loadUploadLink(): Promise<void> {
      const response = await fetch(`${apiBaseUrl}${buildPublicExternalUploadPath(token)}`);
      if (cancelled) return;
      if (!response.ok) {
        const body = await readPublicTokenError(response);
        setStatus(
          publicExternalUploadErrorMessage(body, `Upload link unavailable: ${response.status}`),
        );
        return;
      }
      const nextPayload = (await response.json()) as PublicExternalUploadPayload;
      setPayload(nextPayload);
      setStatus(externalUploadLifecycleMessage(nextPayload));
      setClassification((current) =>
        nextPayload.acceptedClassifications.includes(current)
          ? current
          : (nextPayload.acceptedClassifications[0] ?? "general"),
      );
    }
    void loadUploadLink();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, token]);

  async function uploadFile(file: File): Promise<void> {
    if (!payload || !canUploadExternalDocument(payload)) return;
    setUploading(true);
    setCompletedDocument(null);
    setStatus(`Preparing ${file.name}...`);
    const checksumSha256 = await sha256Hex(file);
    const intent = await fetch(`${apiBaseUrl}${buildPublicExternalUploadIntentPath(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildExternalUploadIntentPayload({
          file,
          checksumSha256,
          classification,
          legalHold,
        }),
      ),
    });
    if (!intent.ok) {
      const body = await readPublicTokenError(intent);
      setStatus(publicExternalUploadErrorMessage(body, `Upload intent failed: ${intent.status}`));
      setUploading(false);
      return;
    }
    const intentPayload = (await intent.json()) as PublicExternalUploadIntentResponse;
    setStatus(`Uploading ${file.name}...`);
    const put = await fetch(intentPayload.uploadUrl, {
      method: intentPayload.method,
      headers: buildExternalUploadPutHeaders({
        file,
        requiredHeaders: intentPayload.requiredHeaders,
      }),
      body: file,
    });
    if (!put.ok) {
      setStatus(describeExternalUploadPutFailure(put.status));
      setUploading(false);
      return;
    }
    const completed = await fetch(
      `${apiBaseUrl}${buildPublicExternalUploadCompletePath(token, intentPayload.document.id)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checksumSha256 }),
      },
    );
    if (!completed.ok) {
      const body = await readPublicTokenError(completed);
      setStatus(
        publicExternalUploadErrorMessage(body, `Upload completion failed: ${completed.status}`),
      );
      setUploading(false);
      return;
    }
    const completedPayload = (await completed.json()) as { document: PublicExternalUploadDocument };
    setCompletedDocument(completedPayload.document);
    setPayload((current) =>
      current
        ? {
            ...current,
            documents: upsertPublicExternalUploadDocument(
              current.documents,
              completedPayload.document,
            ),
            upload: {
              ...current.upload,
              usedUploads: Math.min(current.upload.maxUploads, current.upload.usedUploads + 1),
              status:
                current.upload.usedUploads + 1 >= current.upload.maxUploads
                  ? "exhausted"
                  : current.upload.status,
            },
          }
        : current,
    );
    setStatus(describeExternalUploadCompletion(completedPayload.document));
    setUploading(false);
  }

  const canUpload = canUploadExternalDocument(payload);
  const acceptedClassifications = payload?.acceptedClassifications ?? externalUploadClassifications;
  const attentionItems = externalUploadAttentionItems(payload);

  return (
    <PublicTokenShell
      badge={
        completedDocument ? (
          <span className="user-pill">
            <CheckCircle2 size={16} />
            received
          </span>
        ) : undefined
      }
      description="Upload requested documents from this secure link."
      eyebrow="Client upload"
      icon={<FileUp size={22} />}
      title="Upload documents"
    >
      <PublicStatusMessage>{status}</PublicStatusMessage>

      {payload ? (
        <PublicTokenNeedsAttention
          emptyLabel="No action is needed on this upload link right now."
          items={attentionItems}
        />
      ) : null}

      {payload ? (
        <div className="public-form-section">
          <div className="section-title">
            <h2>Upload link</h2>
            <span>{payload.upload.status}</span>
          </div>
          <div className="detail-grid public-upload-meta">
            <div>
              <span className="field-label">Uploads used</span>
              <strong>
                {payload.upload.usedUploads} / {payload.upload.maxUploads}
              </strong>
            </div>
            <div>
              <span className="field-label">Expires</span>
              <strong>{new Date(payload.upload.expiresAt).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      ) : null}

      {payload?.documents.length ? (
        <div className="public-form-section">
          <div className="section-title">
            <h2>Uploaded files</h2>
            <span>{payload.documents.length} records</span>
          </div>
          <div className="public-upload-document-list">
            {payload.documents.map((document) => {
              const documentStatus = describeExternalUploadDocumentStatus(document);
              const retryAvailable = canRetryExternalUploadDocument(payload, document);
              return (
                <div className="public-form-action public-upload-document" key={document.id}>
                  <div>
                    <strong>{document.title}</strong>
                    <small>
                      {document.classification.replaceAll("_", " ")} ·{" "}
                      {document.uploadStatus.replaceAll("_", " ")} ·{" "}
                      {document.checksumStatus
                        ? `${document.checksumStatus.replaceAll("_", " ")} checksum · `
                        : ""}
                      {document.scanStatus.replaceAll("_", " ")} scan
                    </small>
                    <small>{documentStatus.detail}</small>
                  </div>
                  <span className={documentStatus.tone === "risk" ? "risk" : undefined}>
                    {documentStatus.label}
                  </span>
                  {document.reviewStatus === "retry_requested" ? (
                    <span className={retryAvailable ? "user-pill" : "risk"}>
                      {retryAvailable ? "upload open" : "retry locked"}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="public-form-section">
        <div className="section-title">
          <h2>Document</h2>
          <span>{canUpload ? "ready" : "locked"}</span>
        </div>
        <label className="form-field public-question">
          <span>Classification</span>
          <select
            disabled={!canUpload || uploading}
            onChange={(event) =>
              setClassification(event.target.value as ExternalUploadClassification)
            }
            value={classification}
          >
            {acceptedClassifications.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="check-row share-check-row public-question">
          <input
            checked={legalHold}
            disabled={!canUpload || uploading}
            onChange={(event) => setLegalHold(event.target.checked)}
            type="checkbox"
          />
          <span>Legal hold</span>
        </label>
        <label className="secondary-button compact-button file-button public-upload-button">
          <Upload size={16} />
          {uploading ? "Uploading..." : "Choose file"}
          <input
            disabled={!canUpload || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
            }}
            type="file"
          />
        </label>
        {!canUpload ? (
          <p className="inline-empty">This upload link is not accepting more documents.</p>
        ) : null}
      </div>

      {completedDocument ? (
        <div className="public-form-section">
          <div className="section-title">
            <h2>Receipt</h2>
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div className="public-form-action public-upload-receipt">
            <div>
              <strong>{completedDocument.title}</strong>
              <small>
                {completedDocument.classification} · {completedDocument.uploadStatus} ·{" "}
                {completedDocument.reviewStatus}
              </small>
            </div>
            <CheckCircle2 size={18} aria-hidden="true" />
          </div>
        </div>
      ) : null}
    </PublicTokenShell>
  );
}
