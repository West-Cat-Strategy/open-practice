"use client";

import { CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  buildShareEmailVerificationPath,
  describePublicShareStatus,
  isShareEmailVerificationRequired,
  publicShareErrorMessage,
  shareLinkAttentionItems,
  type PublicShareErrorBody,
  type PublicShareLinkResponse,
} from "../share-link-portal";
import { buildPublicTokenPath, readPublicTokenError } from "../publicTokenClient";
import { PublicStatusMessage, PublicTokenShell } from "../publicTokenUi";
import { PublicTokenNeedsAttention } from "../publicTokenActions";

interface ShareLinkRunnerProps {
  apiBaseUrl: string;
  token: string;
}

export default function ShareLinkRunner({ apiBaseUrl, token }: ShareLinkRunnerProps) {
  const [payload, setPayload] = useState<PublicShareLinkResponse | null>(null);
  const [status, setStatus] = useState("Loading share link...");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const attentionItems = shareLinkAttentionItems({ payload, verificationRequired });

  useEffect(() => {
    let cancelled = false;
    async function loadShare(): Promise<void> {
      const response = await fetch(
        `${apiBaseUrl}${buildPublicTokenPath("/api/portal/shares", token)}`,
      );
      if (cancelled) return;
      if (!response.ok) {
        const body = (await readPublicTokenError(response)) as PublicShareErrorBody;
        if (response.status === 403 && isShareEmailVerificationRequired(body)) {
          setVerificationRequired(true);
          setStatus(
            "Email verification is required before shared document records can be reviewed.",
          );
          return;
        }
        setStatus(publicShareErrorMessage(body, `Share link unavailable: ${response.status}`));
        return;
      }
      const nextPayload = (await response.json()) as PublicShareLinkResponse;
      setPayload(nextPayload);
      setStatus(
        nextPayload.documents.length === 1
          ? "1 shared document metadata record is available."
          : `${nextPayload.documents.length} shared document metadata records are available.`,
      );
    }
    void loadShare();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, token]);

  async function completeEmailVerification(): Promise<void> {
    setVerifying(true);
    setStatus("Completing email verification...");
    const response = await fetch(`${apiBaseUrl}${buildShareEmailVerificationPath(token)}`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = (await readPublicTokenError(response)) as PublicShareErrorBody;
      setStatus(publicShareErrorMessage(body, `Email verification failed: ${response.status}`));
      setVerifying(false);
      return;
    }
    const nextPayload = (await response.json()) as PublicShareLinkResponse;
    setPayload(nextPayload);
    setVerificationRequired(false);
    setStatus(describePublicShareStatus(nextPayload));
    setVerifying(false);
  }

  return (
    <PublicTokenShell
      badge={
        payload ? (
          <span className="user-pill">
            <CheckCircle2 size={16} />
            verified
          </span>
        ) : undefined
      }
      description="Review the shared document metadata made available through this secure link."
      eyebrow="Secure share"
      icon={<FileText size={22} />}
      title="Shared document records"
    >
      <PublicStatusMessage>{status}</PublicStatusMessage>

      <PublicTokenNeedsAttention
        emptyLabel="No action is needed on this share link right now."
        items={attentionItems}
      />

      {verificationRequired ? (
        <div className="public-form-action">
          <div>
            <strong>Email verification</strong>
            <small>
              Complete verification from this email-delivered link to open this metadata view.
            </small>
          </div>
          <button
            className="secondary-button"
            disabled={verifying}
            onClick={() => void completeEmailVerification()}
            type="button"
          >
            <ShieldCheck size={16} />
            {verifying ? "Verifying..." : "Verify email"}
          </button>
        </div>
      ) : null}

      {payload ? (
        <div className="public-form-section">
          <div className="section-title">
            <h2>Document records</h2>
            <span>{payload.documents.length} records</span>
          </div>
          <div className="public-form-items">
            {payload.documents.map((document) => (
              <div className="public-form-action" key={document.id}>
                <div>
                  <strong>{document.title}</strong>
                  <small>
                    {document.classification} · version {document.version}
                  </small>
                </div>
                <FileText size={18} aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </PublicTokenShell>
  );
}
