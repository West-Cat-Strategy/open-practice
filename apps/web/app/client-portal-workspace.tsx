"use client";

import { CheckCircle2, Clock3, FileSignature, FileText, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";
import {
  clientPortalAccessLabel,
  clientPortalActionFamilyLabel,
  clientPortalAttentionCount,
  clientPortalDocumentsForMatter,
  clientPortalMatterDetails,
  clientPortalMatterActionGroups,
  clientPortalMatterActionLabel,
  clientPortalMatterBillingGroups,
  clientPortalMoneyLabel,
  clientPortalSignaturesForMatter,
} from "./client-portal-workspace-utils";
import type {
  ClientPortalSignatureActionState,
  ClientPortalSignatureSummary,
  ClientPortalWorkspaceResponse,
} from "./types";

interface ClientPortalWorkspaceProps {
  apiBaseUrl?: string;
  workspace: ClientPortalWorkspaceResponse;
}

function toneClass(tone: "neutral" | "ready" | "risk"): string {
  if (tone === "ready") return "ready";
  if (tone === "risk") return "risk";
  return "";
}

function displayStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function compactDate(value: string | undefined): string {
  return value ? value.slice(0, 10) : "Not recorded";
}

function signatureActionStateLabel(state: ClientPortalSignatureActionState): string {
  const labels: Record<ClientPortalSignatureActionState, string> = {
    ready_to_sign: "Ready to sign",
    viewed: "Viewed",
    completed: "Completed",
    declined: "Declined",
  };
  return labels[state];
}

function signatureEventStatusLabel(status: "viewed" | "completed" | "declined"): string {
  const labels: Record<typeof status, string> = {
    viewed: "Signature marked viewed.",
    completed: "Signature completion recorded.",
    declined: "Signature decline recorded.",
  };
  return labels[status];
}

function replaceSignature(
  signatures: ClientPortalSignatureSummary[],
  next: ClientPortalSignatureSummary,
): ClientPortalSignatureSummary[] {
  return signatures.map((signature) => (signature.id === next.id ? next : signature));
}

export default function ClientPortalWorkspace({
  apiBaseUrl = "",
  workspace,
}: ClientPortalWorkspaceProps) {
  const [signatures, setSignatures] = useState(workspace.signatures ?? []);
  const [signatureBusyId, setSignatureBusyId] = useState("");
  const [signatureStatus, setSignatureStatus] = useState("Signature actions ready.");
  const renderWorkspace = useMemo(() => ({ ...workspace, signatures }), [signatures, workspace]);
  const attentionCount = clientPortalAttentionCount(renderWorkspace);
  const matterDetails = clientPortalMatterDetails(renderWorkspace);
  const matterActionGroups = clientPortalMatterActionGroups(renderWorkspace);
  const matterBillingGroups = clientPortalMatterBillingGroups(renderWorkspace);
  const matterActionCount = matterActionGroups.reduce((sum, group) => sum + group.actionCount, 0);
  const sharedFileCount = signatures.length + (renderWorkspace.documents?.length ?? 0);

  async function recordSignatureEvent(
    signatureId: string,
    status: "viewed" | "completed" | "declined",
  ): Promise<void> {
    setSignatureBusyId(`${signatureId}:${status}`);
    setSignatureStatus("Recording signature event...");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/client-portal/signatures/${encodeURIComponent(signatureId)}/events`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            consentText:
              status === "completed"
                ? "Client confirmed signature completion in the portal workspace."
                : undefined,
          }),
        },
      );
      const payload = (await response.json().catch(() => undefined)) as
        | { signature?: ClientPortalSignatureSummary }
        | undefined;
      if (!response.ok || !payload?.signature) {
        setSignatureStatus(`Signature event failed: ${response.status}`);
        return;
      }
      setSignatures((current) => replaceSignature(current, payload.signature!));
      setSignatureStatus(signatureEventStatusLabel(status));
    } catch {
      setSignatureStatus("Signature event failed: network");
    } finally {
      setSignatureBusyId("");
    }
  }

  return (
    <main className="client-portal-shell legal-ops-shell" aria-labelledby="client-portal-title">
      <section className="client-portal-header">
        <div className="client-portal-title">
          <span className="setup-icon-box auth-icon-box" aria-hidden="true">
            <LockKeyhole size={24} />
          </span>
          <div>
            <p className="eyebrow">Client Portal</p>
            <h1 id="client-portal-title">{workspace.account.displayName}</h1>
            <p>{workspace.account.email}</p>
          </div>
        </div>
        <div className="client-portal-status" aria-label="Client portal status">
          <span>{clientPortalAccessLabel(workspace.access)}</span>
          <strong>{attentionCount} need attention</strong>
        </div>
      </section>

      <section className="client-portal-band" aria-labelledby="client-matters-title">
        <div className="section-title">
          <h2 id="client-matters-title">Matter details</h2>
          <span>{matterDetails.length} visible</span>
        </div>
        <div className="client-portal-matter-grid">
          {matterDetails.map((matter) => (
            <article className="client-portal-matter" key={matter.id}>
              <div>
                <strong>{matter.number}</strong>
                <h3>{matter.title}</h3>
                <p>
                  {displayStatus(matter.status)} / {matter.practiceArea} / {matter.jurisdiction}
                </p>
                <dl className="client-portal-detail-list">
                  <div>
                    <dt>Opened</dt>
                    <dd>{compactDate(matter.openedOn)}</dd>
                  </div>
                  <div>
                    <dt>Files</dt>
                    <dd>{matter.documentCount}</dd>
                  </div>
                  <div>
                    <dt>Signatures</dt>
                    <dd>{matter.signatureCount}</dd>
                  </div>
                </dl>
              </div>
              <span>{clientPortalMatterActionLabel(matter.actionCount)}</span>
            </article>
          ))}
          {matterDetails.length === 0 ? (
            <p className="inline-empty">No active matter access is linked to this account.</p>
          ) : null}
        </div>
      </section>

      <section className="client-portal-band" aria-labelledby="client-files-title">
        <div className="section-title">
          <h2 id="client-files-title">Shared files</h2>
          <span>{renderWorkspace.documents?.length ?? 0} visible</span>
        </div>
        <div className="client-portal-action-groups">
          {matterDetails.map((matter) => {
            const documents = clientPortalDocumentsForMatter(renderWorkspace, matter.id);
            if (documents.length === 0) return null;
            return (
              <section className="client-portal-action-group" key={`files:${matter.id}`}>
                <div className="client-portal-action-group-header">
                  <div>
                    <strong>{matter.number}</strong>
                    <span>{matter.title}</span>
                  </div>
                  <em>{documents.length} file metadata rows</em>
                </div>
                <div className="client-portal-files">
                  {documents.map((document) => (
                    <article className="client-portal-file" key={document.id}>
                      <span className="client-portal-action-icon ready">
                        <FileText size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <span>{displayStatus(document.classification)}</span>
                        <strong>{document.title}</strong>
                        <p>
                          v{document.version} / uploaded {compactDate(document.uploadedAt)} /
                          verified {compactDate(document.verifiedAt)}
                        </p>
                      </div>
                      <em>
                        {document.expiresAt
                          ? `Expires ${compactDate(document.expiresAt)}`
                          : "Active access"}
                      </em>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
          {(renderWorkspace.documents?.length ?? 0) === 0 ? (
            <p className="inline-empty">No files are currently shared to this portal.</p>
          ) : null}
        </div>
      </section>

      <section className="client-portal-band" aria-labelledby="client-signatures-title">
        <div className="section-title">
          <h2 id="client-signatures-title">Signatures</h2>
          <span>{signatures.length} requests</span>
        </div>
        <p className="inline-empty" role="status" aria-live="polite">
          {signatureStatus}
        </p>
        <div className="client-portal-action-groups">
          {matterDetails.map((matter) => {
            const matterSignatures = clientPortalSignaturesForMatter(renderWorkspace, matter.id);
            if (matterSignatures.length === 0) return null;
            return (
              <section className="client-portal-action-group" key={`signatures:${matter.id}`}>
                <div className="client-portal-action-group-header">
                  <div>
                    <strong>{matter.number}</strong>
                    <span>{matter.title}</span>
                  </div>
                  <em>{matterSignatures.length} signature request summaries</em>
                </div>
                <div className="client-portal-files">
                  {matterSignatures.map((signature) => {
                    const terminal = ["completed", "declined"].includes(signature.actionState);
                    return (
                      <article className="client-portal-file" key={signature.id}>
                        <span className={`client-portal-action-icon ${terminal ? "ready" : ""}`}>
                          <FileSignature size={18} aria-hidden="true" />
                        </span>
                        <div>
                          <span>{signatureActionStateLabel(signature.actionState)}</span>
                          <strong>{signature.title}</strong>
                          <p>
                            {signature.documentTitle ?? "Document title unavailable"} / signer{" "}
                            {displayStatus(signature.signerStatus)}
                          </p>
                          <dl className="client-portal-action-details">
                            <div>
                              <dt>Created</dt>
                              <dd>{compactDate(signature.createdAt)}</dd>
                            </div>
                            {signature.completedAt ? (
                              <div>
                                <dt>Completed</dt>
                                <dd className="ready">{compactDate(signature.completedAt)}</dd>
                              </div>
                            ) : null}
                            {signature.declinedAt ? (
                              <div>
                                <dt>Declined</dt>
                                <dd className="risk">{compactDate(signature.declinedAt)}</dd>
                              </div>
                            ) : null}
                          </dl>
                        </div>
                        <div className="client-portal-signature-actions">
                          {!terminal && signature.actionState === "ready_to_sign" ? (
                            <button
                              className="secondary-button compact-button"
                              disabled={signatureBusyId.length > 0}
                              onClick={() => void recordSignatureEvent(signature.id, "viewed")}
                              type="button"
                            >
                              {signatureBusyId === `${signature.id}:viewed`
                                ? "Recording..."
                                : "Mark viewed"}
                            </button>
                          ) : null}
                          {!terminal ? (
                            <>
                              <button
                                className="secondary-button compact-button"
                                disabled={signatureBusyId.length > 0}
                                onClick={() => void recordSignatureEvent(signature.id, "completed")}
                                type="button"
                              >
                                {signatureBusyId === `${signature.id}:completed`
                                  ? "Confirming..."
                                  : "Confirm signed"}
                              </button>
                              <button
                                className="secondary-button compact-button"
                                disabled={signatureBusyId.length > 0}
                                onClick={() => void recordSignatureEvent(signature.id, "declined")}
                                type="button"
                              >
                                {signatureBusyId === `${signature.id}:declined`
                                  ? "Declining..."
                                  : "Decline signing"}
                              </button>
                            </>
                          ) : (
                            <em>{signatureActionStateLabel(signature.actionState)}</em>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {signatures.length === 0 ? (
            <p className="inline-empty">No signature requests are ready for this account.</p>
          ) : null}
        </div>
      </section>

      {workspace.billing ? (
        <section className="client-portal-band" aria-labelledby="client-billing-title">
          <div className="section-title">
            <h2 id="client-billing-title">Billing</h2>
            <span>{workspace.billing.billCount} bills</span>
          </div>
          <div className="client-portal-billing-summary">
            <div>
              <span>Balance due</span>
              <strong>
                {clientPortalMoneyLabel(
                  workspace.billing.totalBalanceDueCents,
                  workspace.billing.currency,
                )}
              </strong>
            </div>
            <div>
              <span>Payment requests</span>
              <strong>{workspace.billing.openPaymentRequestCount} open</strong>
            </div>
            <div>
              <span>Needs attention</span>
              <strong>{workspace.billing.attentionBillCount}</strong>
            </div>
          </div>
          <div className="client-portal-bill-groups">
            {matterBillingGroups.map((group) => (
              <section className="client-portal-action-group" key={group.matterId}>
                <div className="client-portal-action-group-header">
                  <div>
                    <strong>{group.matterNumber}</strong>
                    <span>{group.matterTitle}</span>
                  </div>
                  <em>
                    {clientPortalMoneyLabel(group.balanceDueCents, workspace.billing!.currency)} due
                  </em>
                </div>
                <div className="client-portal-bills">
                  {group.bills.map((bill) => (
                    <article className="client-portal-bill" key={bill.id}>
                      <div>
                        <span>Invoice</span>
                        <strong>{bill.invoiceNumber}</strong>
                        <p>
                          {bill.status.replaceAll("_", " ")}
                          {bill.dueAt ? ` / Due ${bill.dueAt}` : ""}
                        </p>
                      </div>
                      <dl>
                        <div>
                          <dt>Total</dt>
                          <dd>{clientPortalMoneyLabel(bill.totalCents, bill.currency)}</dd>
                        </div>
                        <div>
                          <dt>Paid</dt>
                          <dd>{clientPortalMoneyLabel(bill.paidCents, bill.currency)}</dd>
                        </div>
                        <div>
                          <dt>Balance</dt>
                          <dd className={toneClass(bill.tone)}>
                            {clientPortalMoneyLabel(bill.balanceDueCents, bill.currency)}
                          </dd>
                        </div>
                      </dl>
                      <div className="client-portal-payment-requests">
                        {bill.paymentRequests.map((request) => (
                          <span key={request.id}>
                            {request.status.replaceAll("_", " ")} /{" "}
                            {clientPortalMoneyLabel(request.amountCents, request.currency)} /{" "}
                            {request.deliveryStatus.replaceAll("_", " ")}
                          </span>
                        ))}
                        {bill.paymentRequests.length === 0 ? <span>No payment request</span> : null}
                      </div>
                    </article>
                  ))}
                  {group.bills.length === 0 ? (
                    <p className="inline-empty">
                      No client-visible bills are open for this matter.
                    </p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : null}

      <section className="client-portal-band" aria-labelledby="client-actions-title">
        <div className="section-title">
          <h2 id="client-actions-title">Matter action workspace</h2>
          <span>
            {matterActionCount} summaries / {sharedFileCount} file and signature rows
          </span>
        </div>
        <div className="client-portal-action-groups">
          {matterActionGroups.map((group) => (
            <section className="client-portal-action-group" key={group.matterId}>
              <div className="client-portal-action-group-header">
                <div>
                  <strong>{group.matterNumber}</strong>
                  <span>{group.matterTitle}</span>
                </div>
                <em>{group.attentionCount} need attention</em>
              </div>
              <div className="client-portal-actions">
                {group.actions.map((action) => (
                  <article className="client-portal-action" key={action.id}>
                    <span className={`client-portal-action-icon ${toneClass(action.tone)}`}>
                      {action.tone === "ready" ? (
                        <CheckCircle2 size={18} aria-hidden="true" />
                      ) : action.tone === "risk" ? (
                        <Clock3 size={18} aria-hidden="true" />
                      ) : (
                        <FileText size={18} aria-hidden="true" />
                      )}
                    </span>
                    <div>
                      <span>{clientPortalActionFamilyLabel(action.family)}</span>
                      <strong>{action.title}</strong>
                      <p>{action.detail}</p>
                      {action.details && action.details.length > 0 ? (
                        <dl className="client-portal-action-details">
                          {action.details.map((detail) => (
                            <div key={`${action.id}:${detail.label}`}>
                              <dt>{detail.label}</dt>
                              <dd className={toneClass(detail.tone ?? "neutral")}>
                                {detail.value.replaceAll("_", " ")}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                    <em className={toneClass(action.tone)}>{action.status.replaceAll("_", " ")}</em>
                  </article>
                ))}
                {group.actions.length === 0 ? (
                  <p className="inline-empty">No client actions are open for this matter.</p>
                ) : null}
              </div>
            </section>
          ))}
          {matterActionGroups.length === 0 ? (
            <p className="inline-empty">No client actions are open for this account.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
