export type PendingDeliveryConfirmation =
  | {
      kind: "calendar-invitations";
      key: string;
      eventId: string;
      includeMeetingLink?: boolean;
      actionLabel: string;
      matterLabel: string;
      summary: string;
      providerState: string;
      recipients: string[];
    }
  | {
      kind: "intake-session-start";
      key: string;
      actionLabel: string;
      matterLabel: string;
      summary: string;
      providerState: string;
      recipients: string[];
    }
  | {
      kind: "intake-form-link";
      key: string;
      actionLabel: string;
      matterLabel: string;
      summary: string;
      providerState: string;
      recipients: string[];
    }
  | {
      kind: "intake-engagement-letter";
      key: string;
      linkId: string;
      actionLabel: string;
      matterLabel: string;
      summary: string;
      providerState: string;
      recipients: string[];
    };

export function OneTimeSecretPanel({
  items,
  className = "",
}: {
  items: Array<{ label: string; value: string }>;
  className?: string;
}) {
  return (
    <div className={["upload-token", className].filter(Boolean).join(" ")}>
      {items.map((item) => (
        <span key={item.label}>
          {item.label}
          <code>{item.value}</code>
        </span>
      ))}
    </div>
  );
}

export function DeliveryConfirmationPanel({
  confirmation,
  busy,
  onCancel,
  onConfirm,
}: {
  confirmation: PendingDeliveryConfirmation;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="delivery-confirmation-panel" role="group" aria-label="Delivery confirmation">
      <div>
        <span className="field-label">Confirm email delivery</span>
        <strong>{confirmation.actionLabel}</strong>
        <small>{confirmation.summary}</small>
      </div>
      <div className="delivery-confirmation-grid">
        <span>
          <small>Matter</small>
          <strong>{confirmation.matterLabel}</strong>
        </span>
        <span>
          <small>Recipients</small>
          <strong>{confirmation.recipients.length}</strong>
        </span>
        <span>
          <small>Channel</small>
          <strong>email</strong>
        </span>
      </div>
      <div className="delivery-recipient-list">
        {confirmation.recipients.map((recipient) => (
          <code key={recipient}>{recipient}</code>
        ))}
      </div>
      <p>{confirmation.providerState}</p>
      <div className="row-actions">
        <button
          className="secondary-button compact-button"
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="primary-button compact-button"
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          {busy ? "Sending..." : "Confirm and send"}
        </button>
      </div>
    </div>
  );
}
