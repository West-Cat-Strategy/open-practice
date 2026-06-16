import { Clock3, FileText, Plus, Save } from "lucide-react";

import {
  describePaymentSettlementReview,
  type PaymentSettlementReviewSummary,
} from "../billing-dashboard";
import type {
  BillingDashboardResponse,
  BillingExpenseItem,
  BillingInvoiceSummary,
  BillingPaymentRequestSummary,
  BillingPaymentSummary,
  BillingTimeItem,
} from "../_features/billing/models";
import type { MatterSummary } from "../types";

interface BillingSectionProps {
  activeBalanceDueCents: number;
  activeCaptureReviewCount: number;
  activeCaptureReviewExpenses: BillingExpenseItem[];
  activeCaptureReviewTime: BillingTimeItem[];
  activeInvoices: BillingInvoiceSummary[];
  activeManualPayments: BillingPaymentSummary[];
  activeMatter: Pick<MatterSummary, "number">;
  activePaymentRequests: BillingPaymentRequestSummary[];
  activeSettlementReviewSummary: PaymentSettlementReviewSummary;
  activeUnbilledExpenseCents: number;
  activeUnbilledExpenses: BillingExpenseItem[];
  activeUnbilledTime: BillingTimeItem[];
  activeUnbilledTimeCents: number;
  billingDashboard: BillingDashboardResponse;
  canCreateDraftInvoice: boolean;
  cents: (value: number) => string;
  createDraftInvoice: () => Promise<void>;
  createExpenseDraft: () => Promise<void>;
  createTimerDraft: () => Promise<void>;
  creatingDraftInvoice: boolean;
  creatingExpenseDraft: boolean;
  creatingTimerDraft: boolean;
  draftInvoiceDueAt: string;
  draftInvoiceStatus: string;
  draftInvoiceTaxName: string;
  draftInvoiceTaxRate: string;
  expenseDraftAmount: string;
  expenseDraftCategory: string;
  expenseDraftDate: string;
  expenseDraftDescription: string;
  expenseDraftProfileKey: string;
  expenseDraftReimbursable: boolean;
  expenseDraftStatus: string;
  minutes: (value: number) => string;
  setDraftInvoiceDueAt: (value: string) => void;
  setDraftInvoiceTaxName: (value: string) => void;
  setDraftInvoiceTaxRate: (value: string) => void;
  setExpenseDraftAmount: (value: string) => void;
  setExpenseDraftCategory: (value: string) => void;
  setExpenseDraftDate: (value: string) => void;
  setExpenseDraftDescription: (value: string) => void;
  setExpenseDraftProfileKey: (value: string) => void;
  setExpenseDraftReimbursable: (value: boolean) => void;
  setTimerDraftBillable: (value: boolean) => void;
  setTimerDraftNarrative: (value: string) => void;
  setTimerDraftRate: (value: string) => void;
  setTimerDraftStartedAt: (value: string) => void;
  setTimerDraftStoppedAt: (value: string) => void;
  startTimerDraft: () => void;
  stopTimerDraft: () => void;
  timerDraftBillable: boolean;
  timerDraftNarrative: string;
  timerDraftRate: string;
  timerDraftStartedAt: string;
  timerDraftStatus: string;
  timerDraftStoppedAt: string;
}

export function BillingSection({
  activeBalanceDueCents,
  activeCaptureReviewCount,
  activeCaptureReviewExpenses,
  activeCaptureReviewTime,
  activeInvoices,
  activeManualPayments,
  activeMatter,
  activePaymentRequests,
  activeSettlementReviewSummary,
  activeUnbilledExpenseCents,
  activeUnbilledExpenses,
  activeUnbilledTime,
  activeUnbilledTimeCents,
  billingDashboard,
  canCreateDraftInvoice,
  cents,
  createDraftInvoice,
  createExpenseDraft,
  createTimerDraft,
  creatingDraftInvoice,
  creatingExpenseDraft,
  creatingTimerDraft,
  draftInvoiceDueAt,
  draftInvoiceStatus,
  draftInvoiceTaxName,
  draftInvoiceTaxRate,
  expenseDraftAmount,
  expenseDraftCategory,
  expenseDraftDate,
  expenseDraftDescription,
  expenseDraftProfileKey,
  expenseDraftReimbursable,
  expenseDraftStatus,
  minutes,
  setDraftInvoiceDueAt,
  setDraftInvoiceTaxName,
  setDraftInvoiceTaxRate,
  setExpenseDraftAmount,
  setExpenseDraftCategory,
  setExpenseDraftDate,
  setExpenseDraftDescription,
  setExpenseDraftProfileKey,
  setExpenseDraftReimbursable,
  setTimerDraftBillable,
  setTimerDraftNarrative,
  setTimerDraftRate,
  setTimerDraftStartedAt,
  setTimerDraftStoppedAt,
  startTimerDraft,
  stopTimerDraft,
  timerDraftBillable,
  timerDraftNarrative,
  timerDraftRate,
  timerDraftStartedAt,
  timerDraftStatus,
  timerDraftStoppedAt,
}: BillingSectionProps) {
  const selectedExpenseProfile = billingDashboard.expenseCategoryProfiles.find(
    (profile) => profile.key === expenseDraftProfileKey,
  );

  return (
    <>
      <div className="detail-grid billing-summary-grid">
        <div>
          <span className="field-label">Approved time</span>
          <strong>{cents(activeUnbilledTimeCents)}</strong>
        </div>
        <div>
          <span className="field-label">Approved expenses</span>
          <strong>{cents(activeUnbilledExpenseCents)}</strong>
        </div>
        <div>
          <span className="field-label">Draft / issued invoices</span>
          <strong>
            {
              activeInvoices.filter((invoice) => ["draft", "issued"].includes(invoice.status))
                .length
            }
          </strong>
        </div>
        <div>
          <span className="field-label">Balance due</span>
          <strong>{cents(activeBalanceDueCents)}</strong>
        </div>
        <div>
          <span className="field-label">Payment requests</span>
          <strong>{cents(billingDashboard.summary.hostedPaymentRequestCents)}</strong>
        </div>
        <div>
          <span className="field-label">Locked periods</span>
          <strong>
            {billingDashboard.summary.activeLockedPeriodCount}/
            {billingDashboard.summary.lockedPeriodCount}
          </strong>
        </div>
        <div>
          <span className="field-label">Active rate rules</span>
          <strong>{billingDashboard.summary.activeRateRuleCount}</strong>
        </div>
      </div>

      <div className="section-title">
        <h3>Billing controls</h3>
        <span>
          {billingDashboard.periodLocks.length + billingDashboard.rateRules.length} records
        </span>
      </div>
      <div className="party-list">
        {billingDashboard.periodLocks.map((lock) => (
          <div className="party-row" key={lock.id}>
            <span>
              <strong>{lock.reason ?? "Locked billing period"}</strong>
              <small>
                {new Date(lock.periodStart).toLocaleDateString("en-CA")} -{" "}
                {new Date(lock.periodEnd).toLocaleDateString("en-CA")}
              </small>
            </span>
            <em>locked</em>
          </div>
        ))}
        {billingDashboard.rateRules.map((rule) => (
          <div className="party-row" key={rule.id}>
            <span>
              <strong>{rule.label}</strong>
              <small>
                {rule.scope}
                {rule.matterId ? ` · ${rule.matterId}` : ""}
                {rule.userId ? ` · ${rule.userId}` : ""}
              </small>
            </span>
            <em>{cents(rule.rateCents)}/hr</em>
          </div>
        ))}
        {billingDashboard.periodLocks.length === 0 && billingDashboard.rateRules.length === 0 ? (
          <p className="inline-empty">No billing locks or rate rules are active.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Capture review drafts</h3>
        <span>{activeCaptureReviewCount} pending</span>
      </div>
      <div className="billing-capture-grid">
        <section className="billing-capture-panel" aria-label="Local timer draft">
          <div className="section-title compact">
            <h4>Local timer</h4>
            <span>{timerDraftBillable ? "billable" : "non-billable"}</span>
          </div>
          <div className="billing-action-row">
            <button
              className="compact-button"
              disabled={creatingTimerDraft}
              onClick={startTimerDraft}
              type="button"
            >
              <Clock3 size={16} />
              Start
            </button>
            <button
              className="compact-button"
              disabled={creatingTimerDraft}
              onClick={stopTimerDraft}
              type="button"
            >
              <Save size={16} />
              Stop
            </button>
            <label className="billing-toggle-field">
              <input
                checked={timerDraftBillable}
                disabled={creatingTimerDraft}
                onChange={(event) => setTimerDraftBillable(event.target.checked)}
                type="checkbox"
              />
              <span>Billable</span>
            </label>
          </div>
          <div className="billing-action-row">
            <label className="search-field compact">
              <span>Rate / hr</span>
              <input
                disabled={creatingTimerDraft}
                inputMode="decimal"
                min={0}
                onChange={(event) => setTimerDraftRate(event.target.value)}
                step={0.01}
                type="number"
                value={timerDraftRate}
              />
            </label>
            <label className="search-field compact">
              <span>Started</span>
              <input
                disabled={creatingTimerDraft}
                onChange={(event) => setTimerDraftStartedAt(event.target.value)}
                type="datetime-local"
                value={timerDraftStartedAt.slice(0, 16)}
              />
            </label>
            <label className="search-field compact">
              <span>Stopped</span>
              <input
                disabled={creatingTimerDraft}
                onChange={(event) => setTimerDraftStoppedAt(event.target.value)}
                type="datetime-local"
                value={timerDraftStoppedAt.slice(0, 16)}
              />
            </label>
          </div>
          <label className="search-field compact">
            <span>Narrative</span>
            <input
              disabled={creatingTimerDraft}
              onChange={(event) => setTimerDraftNarrative(event.target.value)}
              placeholder="Matter preparation"
              value={timerDraftNarrative}
            />
          </label>
          <button
            className="primary-button"
            disabled={creatingTimerDraft}
            onClick={() => void createTimerDraft()}
            type="button"
          >
            <Plus size={16} />
            {creatingTimerDraft ? "Creating..." : "Create draft"}
          </button>
          <p aria-atomic="true" aria-live="polite" className="inline-empty" role="status">
            {timerDraftStatus}
          </p>
        </section>

        <section className="billing-capture-panel" aria-label="Expense review draft">
          <div className="section-title compact">
            <h4>Expense profile</h4>
            <span>{selectedExpenseProfile?.label ?? "Custom"}</span>
          </div>
          <div className="billing-action-row">
            <label className="search-field compact">
              <span>Profile</span>
              <select
                disabled={creatingExpenseDraft}
                onChange={(event) => {
                  const profile = billingDashboard.expenseCategoryProfiles.find(
                    (candidate) => candidate.key === event.target.value,
                  );
                  setExpenseDraftProfileKey(event.target.value);
                  if (profile) setExpenseDraftReimbursable(profile.defaultReimbursable);
                }}
                value={expenseDraftProfileKey}
              >
                <option value="">Custom</option>
                {billingDashboard.expenseCategoryProfiles.map((profile) => (
                  <option key={profile.key} value={profile.key}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="search-field compact">
              <span>Amount</span>
              <input
                disabled={creatingExpenseDraft}
                inputMode="decimal"
                min={0}
                onChange={(event) => setExpenseDraftAmount(event.target.value)}
                step={0.01}
                type="number"
                value={expenseDraftAmount}
              />
            </label>
            <label className="search-field compact">
              <span>Incurred</span>
              <input
                disabled={creatingExpenseDraft}
                onChange={(event) => setExpenseDraftDate(event.target.value)}
                type="date"
                value={expenseDraftDate}
              />
            </label>
          </div>
          <div className="billing-action-row">
            <label className="search-field compact">
              <span>Category</span>
              <input
                disabled={creatingExpenseDraft || Boolean(expenseDraftProfileKey)}
                onChange={(event) => setExpenseDraftCategory(event.target.value)}
                placeholder={selectedExpenseProfile?.category ?? "Custom category"}
                value={expenseDraftCategory}
              />
            </label>
            <label className="search-field compact">
              <span>Description</span>
              <input
                disabled={creatingExpenseDraft}
                onChange={(event) => setExpenseDraftDescription(event.target.value)}
                placeholder="Filing receipt"
                value={expenseDraftDescription}
              />
            </label>
            <label className="billing-toggle-field">
              <input
                checked={expenseDraftReimbursable}
                disabled={creatingExpenseDraft}
                onChange={(event) => setExpenseDraftReimbursable(event.target.checked)}
                type="checkbox"
              />
              <span>Reimbursable</span>
            </label>
          </div>
          <button
            className="primary-button"
            disabled={creatingExpenseDraft}
            onClick={() => void createExpenseDraft()}
            type="button"
          >
            <Plus size={16} />
            {creatingExpenseDraft ? "Creating..." : "Create draft"}
          </button>
          <p aria-atomic="true" aria-live="polite" className="inline-empty" role="status">
            {expenseDraftStatus}{" "}
            {selectedExpenseProfile
              ? selectedExpenseProfile.reviewCue
              : "Custom expense drafts stay in draft review."}
          </p>
        </section>
      </div>
      <div className="party-list">
        {activeCaptureReviewTime.map((entry) => (
          <div className="party-row" key={entry.id}>
            <span>
              <strong>{entry.narrative}</strong>
              <small>
                {entry.status} · {minutes(entry.minutes)} · {cents(entry.rateCents)}/hr
              </small>
            </span>
            <em>review</em>
          </div>
        ))}
        {activeCaptureReviewExpenses.map((entry) => (
          <div className="party-row" key={entry.id}>
            <span>
              <strong>{entry.description}</strong>
              <small>
                {entry.status} · {entry.category}
                {entry.categoryProfileKey ? ` · ${entry.categoryProfileKey}` : ""}
              </small>
            </span>
            <em>{cents(entry.amountCents)}</em>
          </div>
        ))}
        {activeCaptureReviewCount === 0 ? (
          <p className="inline-empty">No draft time or expense records need review.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Create draft invoice</h3>
        <span>{activeMatter.number}</span>
      </div>
      <div className="billing-action-row">
        <label className="search-field compact">
          <span>Due date</span>
          <input
            disabled={creatingDraftInvoice}
            onChange={(event) => setDraftInvoiceDueAt(event.target.value)}
            type="date"
            value={draftInvoiceDueAt}
          />
        </label>
        <label className="search-field compact">
          <span>Tax label</span>
          <input
            disabled={creatingDraftInvoice}
            onChange={(event) => setDraftInvoiceTaxName(event.target.value)}
            placeholder="GST"
            value={draftInvoiceTaxName}
          />
        </label>
        <label className="search-field compact">
          <span>Tax rate %</span>
          <input
            disabled={creatingDraftInvoice}
            inputMode="decimal"
            min={0}
            onChange={(event) => setDraftInvoiceTaxRate(event.target.value)}
            step={0.01}
            type="number"
            value={draftInvoiceTaxRate}
          />
        </label>
        <button
          className="primary-button"
          disabled={creatingDraftInvoice || !canCreateDraftInvoice}
          onClick={() => void createDraftInvoice()}
          type="button"
        >
          <FileText size={16} />
          {creatingDraftInvoice ? "Creating..." : "Create draft"}
        </button>
      </div>
      <p aria-atomic="true" aria-live="polite" className="inline-empty" role="status">
        {draftInvoiceStatus}
      </p>

      <div className="section-title">
        <h3>Unbilled approved time and expenses</h3>
        <span>{cents(activeUnbilledTimeCents + activeUnbilledExpenseCents)}</span>
      </div>
      <div className="party-list">
        {activeUnbilledTime.map((entry) => (
          <div className="party-row" key={entry.id}>
            <span>
              <strong>{entry.narrative}</strong>
              <small>
                {minutes(entry.minutes)} · {cents(entry.rateCents)}/hr
                {entry.rateSnapshot?.source === "rate_rule"
                  ? ` · ${entry.rateSnapshot.label ?? "rate rule"}`
                  : " · manual rate"}
              </small>
            </span>
            <em>{cents(entry.amountCents)}</em>
          </div>
        ))}
        {activeUnbilledExpenses.map((entry) => (
          <div className="party-row" key={entry.id}>
            <span>
              <strong>{entry.description}</strong>
              <small>{entry.category}</small>
            </span>
            <em>{cents(entry.amountCents)}</em>
          </div>
        ))}
        {activeUnbilledTime.length === 0 && activeUnbilledExpenses.length === 0 ? (
          <p className="inline-empty">
            No approved unbilled time or reimbursable expenses are linked to this matter.
          </p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Invoices and balances</h3>
        <span>{activeInvoices.length} records</span>
      </div>
      <div className="party-list">
        {activeInvoices.map((invoice) => (
          <div className="party-row" key={invoice.id}>
            <span>
              <strong>{invoice.number}</strong>
              <small>
                {invoice.status}
                {invoice.dueAt
                  ? ` · due ${new Date(invoice.dueAt).toLocaleDateString("en-CA")}`
                  : ""}
              </small>
            </span>
            <em className={invoice.balanceDueCents > 0 ? "risk" : undefined}>
              {cents(invoice.balanceDueCents)}
            </em>
          </div>
        ))}
        {activeInvoices.length === 0 ? (
          <p className="inline-empty">No draft or issued invoices are linked to this matter.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Payment request shells</h3>
        <span>{activePaymentRequests.length} records</span>
      </div>
      <div className="party-list">
        {activePaymentRequests.map((paymentRequest) => (
          <div className="party-row" key={paymentRequest.id}>
            <span>
              <strong>{paymentRequest.status.replaceAll("_", " ")}</strong>
              <small>
                {paymentRequest.delivery.status.replaceAll("_", " ")} · reminder{" "}
                {paymentRequest.reminder.status.replaceAll("_", " ")}
                {paymentRequest.paymentPlan.status !== "not_offered"
                  ? ` · plan ${paymentRequest.paymentPlan.status.replaceAll("_", " ")}`
                  : ""}
                {paymentRequest.creditWriteOffPosture.status !== "none"
                  ? ` · ${paymentRequest.creditWriteOffPosture.status.replaceAll("_", " ")}`
                  : ""}
                {paymentRequest.processor.status === "checkout_session_created"
                  ? ` · ${paymentRequest.processor.provider ?? "processor"} checkout`
                  : ""}
                {paymentRequest.evidencePresent ? " · evidence" : ""}
              </small>
            </span>
            <em>{cents(paymentRequest.amountCents)}</em>
          </div>
        ))}
        {activePaymentRequests.length === 0 ? (
          <p className="inline-empty">
            No hosted payment request shells have been recorded for this matter.
          </p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Settlement webhook review</h3>
        <span>Manual reconciliation required</span>
      </div>
      <div className="detail-grid billing-summary-grid">
        <div>
          <span className="field-label">Received</span>
          <strong>{activeSettlementReviewSummary.receivedEventCount}</strong>
        </div>
        <div>
          <span className="field-label">Pending</span>
          <strong>{activeSettlementReviewSummary.pendingEventCount}</strong>
        </div>
        <div>
          <span className="field-label">Mismatch</span>
          <strong>{activeSettlementReviewSummary.amountMismatchCount}</strong>
        </div>
        <div>
          <span className="field-label">Refunds</span>
          <strong>{activeSettlementReviewSummary.refundOrChargebackReviewCount}</strong>
        </div>
      </div>
      <div className="party-list">
        {activePaymentRequests
          .filter((paymentRequest) => paymentRequest.processor.settlementReview)
          .map((paymentRequest) => (
            <div className="party-row" key={`${paymentRequest.id}:settlement`}>
              <span>
                <strong>
                  {paymentRequest.processor.settlementReview?.status.replaceAll("_", " ")}
                </strong>
                <small>{describePaymentSettlementReview(paymentRequest)}</small>
                <small>
                  No invoice balance mutation · No trust posting · No refunds or chargebacks
                </small>
              </span>
              <em>No automatic reconciliation</em>
            </div>
          ))}
        {activePaymentRequests.every(
          (paymentRequest) => !paymentRequest.processor.settlementReview,
        ) ? (
          <p className="inline-empty">
            No processor settlement evidence has been received for this matter.
          </p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Manual payment history</h3>
        <span>{activeManualPayments.length} payments</span>
      </div>
      <div className="party-list">
        {activeManualPayments.map((payment) => (
          <div className="party-row" key={payment.id}>
            <span>
              <strong>{payment.reference ?? "Manual payment"}</strong>
              <small>
                {new Date(payment.receivedAt).toLocaleDateString("en-CA")}
                {` · ${payment.status.replaceAll("_", " ")}`}
                {payment.evidencePresent ? " · evidence" : ""}
                {payment.reconciliationEvidencePresent ? " · reviewer evidence" : ""}
              </small>
            </span>
            <em>
              {payment.status === "pending_reconciliation"
                ? "Pending reconciliation"
                : cents(payment.amountCents)}
            </em>
          </div>
        ))}
        {activeManualPayments.length === 0 ? (
          <p className="inline-empty">No manual payments have been recorded for this matter.</p>
        ) : null}
      </div>
    </>
  );
}
