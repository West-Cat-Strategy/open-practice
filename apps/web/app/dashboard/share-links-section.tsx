import { ContactRound, Link2 } from "lucide-react";

import {
  describeShareLinkState,
  formatSharePermission,
  shareLinkPermissions,
} from "../share-links-dashboard";
import type { MatterSummary } from "../types";
import type {
  ShareLinkPermission,
  ShareLinkRecord,
  ShareLinksStatusResponse,
} from "../_features/share-links/models";
import { OneTimeSecretPanel } from "./shared-panels";

type ClientPortalContactParty = MatterSummary["parties"][number];

interface ShareLinksSectionProps {
  activeClientPortalContacts: ClientPortalContactParty[];
  activeShares: ShareLinkRecord[];
  clientPortalSetupToken: string;
  clientPortalStatus: string;
  creatingClientPortalAccount: boolean;
  creatingShare: boolean;
  requireEmailVerification: boolean;
  revokingShareId: string;
  selectedClientPortalContactId: string;
  shareExpiresAt: string;
  shareLinksCreateAvailable: boolean;
  shareLinksStatus: ShareLinksStatusResponse;
  shareNotificationEmail: string;
  shareOneTimeToken: string;
  sharePermissions: ShareLinkPermission[];
  shareStatus: string;
  onCreateClientPortalAccount: () => void;
  onCreateShareLink: () => void;
  onRevokeShareLink: (share: ShareLinkRecord) => void;
  onSetClientPortalContactId: (value: string) => void;
  onSetRequireEmailVerification: (value: boolean) => void;
  onSetShareExpiresAt: (value: string) => void;
  onSetShareNotificationEmail: (value: string) => void;
  onToggleSharePermission: (permission: ShareLinkPermission) => void;
}

export function ShareLinksSection({
  activeClientPortalContacts,
  activeShares,
  clientPortalSetupToken,
  clientPortalStatus,
  creatingClientPortalAccount,
  creatingShare,
  requireEmailVerification,
  revokingShareId,
  selectedClientPortalContactId,
  shareExpiresAt,
  shareLinksCreateAvailable,
  shareLinksStatus,
  shareNotificationEmail,
  shareOneTimeToken,
  sharePermissions,
  shareStatus,
  onCreateClientPortalAccount,
  onCreateShareLink,
  onRevokeShareLink,
  onSetClientPortalContactId,
  onSetRequireEmailVerification,
  onSetShareExpiresAt,
  onSetShareNotificationEmail,
  onToggleSharePermission,
}: ShareLinksSectionProps) {
  return (
    <>
      <div className="detail-grid share-control-grid">
        <div>
          <span className="field-label">Create status</span>
          <strong>{shareLinksStatus.createStatus}</strong>
        </div>
        <div>
          <span className="field-label">Provider</span>
          <strong>{shareLinksStatus.provider ?? shareLinksStatus.status ?? "shares"}</strong>
        </div>
        <div>
          <span className="field-label">Matter links</span>
          <strong>{activeShares.length}</strong>
        </div>
        <div>
          <span className="field-label">Active links</span>
          <strong>{activeShares.filter((share) => !share.revokedAt).length}</strong>
        </div>
      </div>

      <div className="share-controls">
        <div className="section-title">
          <h3>Create share link</h3>
          <span>{shareLinksStatus.reason ?? "matter-scoped"}</span>
        </div>
        <div className="permission-toggle-grid">
          {shareLinkPermissions.map((permission) => (
            <label className="check-row share-check-row" key={permission}>
              <input
                checked={sharePermissions.includes(permission)}
                disabled={!shareLinksCreateAvailable}
                onChange={() => onToggleSharePermission(permission)}
                type="checkbox"
              />
              <span>{formatSharePermission(permission)}</span>
            </label>
          ))}
          <label className="check-row share-check-row">
            <input
              checked={requireEmailVerification}
              disabled={!shareLinksCreateAvailable}
              onChange={(event) => onSetRequireEmailVerification(event.target.checked)}
              type="checkbox"
            />
            <span>Require email verification</span>
          </label>
        </div>
        <div className="share-form-row">
          <label className="search-field">
            <span>Expiry date</span>
            <input
              disabled={!shareLinksCreateAvailable}
              onChange={(event) => onSetShareExpiresAt(event.target.value)}
              type="date"
              value={shareExpiresAt}
            />
          </label>
          <label className="search-field">
            <span>Notification email</span>
            <input
              disabled={!shareLinksCreateAvailable}
              onChange={(event) => onSetShareNotificationEmail(event.target.value)}
              placeholder="client@example.test"
              type="email"
              value={shareNotificationEmail}
            />
          </label>
          <button
            className="secondary-button compact-button"
            disabled={!shareLinksCreateAvailable || creatingShare}
            onClick={onCreateShareLink}
            type="button"
          >
            <Link2 size={16} />
            {creatingShare ? "Creating..." : "Create link"}
          </button>
        </div>
        {shareOneTimeToken ? (
          <OneTimeSecretPanel items={[{ label: "One-time token", value: shareOneTimeToken }]} />
        ) : null}
        <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
          {shareStatus}
        </p>
      </div>

      <div className="share-controls">
        <div className="section-title">
          <h3>Client account setup</h3>
          <span>{activeClientPortalContacts.length} eligible contacts</span>
        </div>
        <div className="share-form-row">
          <label className="search-field">
            <span>Client contact</span>
            <select
              disabled={activeClientPortalContacts.length === 0}
              onChange={(event) => onSetClientPortalContactId(event.target.value)}
              value={selectedClientPortalContactId}
            >
              {activeClientPortalContacts.map((party) => (
                <option key={party.contactId} value={party.contactId}>
                  {party.contact.displayName}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary-button compact-button"
            disabled={activeClientPortalContacts.length === 0 || creatingClientPortalAccount}
            onClick={onCreateClientPortalAccount}
            type="button"
          >
            <ContactRound size={16} />
            {creatingClientPortalAccount ? "Creating..." : "Create account"}
          </button>
        </div>
        {clientPortalSetupToken ? (
          <OneTimeSecretPanel
            items={[{ label: "Password setup token", value: clientPortalSetupToken }]}
          />
        ) : null}
        <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
          {clientPortalStatus}
        </p>
      </div>

      <div className="section-title">
        <h3>Matter share links</h3>
        <span>{activeShares.length} records</span>
      </div>
      <div className="party-list">
        {activeShares.map((share) => {
          const state = describeShareLinkState(share);
          return (
            <div className="party-row" key={share.id}>
              <span>
                <strong>{share.id}</strong>
                <small>
                  {share.permissions.map(formatSharePermission).join(", ")}
                  {share.expiresAt
                    ? ` · expires ${new Date(share.expiresAt).toLocaleDateString("en-CA")}`
                    : " · no expiry"}
                  {share.requireEmailVerification
                    ? " · email verification required"
                    : " · token access"}
                </small>
              </span>
              <span className="share-row-actions">
                <em className={state.tone === "risk" ? "risk" : undefined}>{state.label}</em>
                <button
                  className="secondary-button compact-button"
                  disabled={Boolean(share.revokedAt) || revokingShareId.length > 0}
                  onClick={() => onRevokeShareLink(share)}
                  type="button"
                >
                  {revokingShareId === share.id ? "Revoking..." : "Revoke"}
                </button>
              </span>
            </div>
          );
        })}
        {activeShares.length === 0 ? (
          <p className="inline-empty">No share links are linked to this matter.</p>
        ) : null}
      </div>
    </>
  );
}
