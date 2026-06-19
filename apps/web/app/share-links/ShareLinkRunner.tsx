"use client";

import { CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  buildShareEmailVerificationPath,
  buildPublicSharePath,
  describePublicShareStatus,
  isShareEmailVerificationRequired,
  publicShareErrorMessage,
  shareLinkAttentionItems,
  type PublicShareErrorBody,
  type PublicShareLinkResponse,
} from "../share-link-portal";
import {
  publicTokenHeaders,
  publicTokenNetworkErrorMessage,
  readPublicTokenError,
} from "../publicTokenClient";
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
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const attentionItems = shareLinkAttentionItems({ payload, verificationRequired });

  useEffect(() => {
    let cancelled = false;
    async function loadShare(): Promise<void> {
      try {
        const response = await fetch(`${apiBaseUrl}${buildPublicSharePath(token)}`, {
          headers: publicTokenHeaders(token),
        });
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
      } catch (error) {
        if (!cancelled) setStatus(publicTokenNetworkErrorMessage("Load", error));
      }
    }
    void loadShare();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, token]);

  async function completeEmailVerification(): Promise<void> {
    const code = verificationCode.trim();
    if (!code) {
      setStatus("Enter the email verification code from the share message.");
      return;
    }
    setVerifying(true);
    setStatus("Completing email verification...");
    try {
      const response = await fetch(`${apiBaseUrl}${buildShareEmailVerificationPath(token)}`, {
        method: "POST",
        headers: publicTokenHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ verificationCode: code }),
      });
      if (!response.ok) {
        const body = (await readPublicTokenError(response)) as PublicShareErrorBody;
        setStatus(publicShareErrorMessage(body, `Email verification failed: ${response.status}`));
        return;
      }
      const nextPayload = (await response.json()) as PublicShareLinkResponse;
      setPayload(nextPayload);
      setVerificationRequired(false);
      setVerificationCode("");
      setStatus(describePublicShareStatus(nextPayload));
    } catch (error) {
      setStatus(publicTokenNetworkErrorMessage("Email verification", error));
    } finally {
      setVerifying(false);
    }
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
            <small>Enter the verification code from the email-delivered share message.</small>
          </div>
          <input
            aria-label="Email verification code"
            className="compact-input"
            disabled={verifying}
            onChange={(event) => setVerificationCode(event.target.value)}
            value={verificationCode}
          />
          <button
            className="secondary-button"
            disabled={verifying || !verificationCode.trim()}
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
            <h2>Shared documents</h2>
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
