import { CheckCircle2, Clock3, FileText, LockKeyhole } from "lucide-react";
import {
  clientPortalAccessLabel,
  clientPortalActionFamilyLabel,
  clientPortalAttentionCount,
  clientPortalMatterActionGroups,
  clientPortalMatterActionLabel,
  clientPortalMatterBillingGroups,
  clientPortalMoneyLabel,
} from "./client-portal-workspace-utils";
import type { ClientPortalWorkspaceResponse } from "./types";

interface ClientPortalWorkspaceProps {
  workspace: ClientPortalWorkspaceResponse;
}

function toneClass(tone: "neutral" | "ready" | "risk"): string {
  if (tone === "ready") return "ready";
  if (tone === "risk") return "risk";
  return "";
}

export default function ClientPortalWorkspace({ workspace }: ClientPortalWorkspaceProps) {
  const attentionCount = clientPortalAttentionCount(workspace);
  const matterActionGroups = clientPortalMatterActionGroups(workspace);
  const matterBillingGroups = clientPortalMatterBillingGroups(workspace);
  const matterActionCount = matterActionGroups.reduce((sum, group) => sum + group.actionCount, 0);
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
          <h2 id="client-matters-title">Matters</h2>
          <span>{workspace.matters.length} visible</span>
        </div>
        <div className="client-portal-matter-grid">
          {workspace.matters.map((matter) => (
            <article className="client-portal-matter" key={matter.id}>
              <div>
                <strong>{matter.number}</strong>
                <h3>{matter.title}</h3>
                <p>{matter.status}</p>
              </div>
              <span>{clientPortalMatterActionLabel(matter.actionCount)}</span>
            </article>
          ))}
          {workspace.matters.length === 0 ? (
            <p className="inline-empty">No active matter access is linked to this account.</p>
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
          <span>{matterActionCount} summaries</span>
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
