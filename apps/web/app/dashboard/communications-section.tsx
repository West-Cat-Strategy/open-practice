import type { ReactNode } from "react";
import {
  describeCommunicationsDeliveryState,
  describeCommunicationsHistoryState,
  summarizeInboundEmailMatterDraftReviewCues,
} from "../communications-inbox-dashboard";
import { describeEmailDeliveryState } from "../email-delivery-dashboard";
import type { EmailDeliveryDashboardResponse } from "../_features/email-delivery/models";
import type { CommunicationsInboxDashboardResponse, MatterSummary } from "../types";
import { InboundParserReplayInventoryPanel } from "./inbound-parser-replay-inventory-panel";

export function CommunicationsSection({
  activeCommunicationsInbox,
  activeEmailDeliveries,
  activeMatter,
  compactDate,
  compactStatus,
  emailTemplateDraftsPanel,
  inboundParserReplayInventory,
}: {
  activeCommunicationsInbox?: CommunicationsInboxDashboardResponse["inboxByMatterId"][string];
  activeEmailDeliveries: EmailDeliveryDashboardResponse["emailsByMatterId"][string];
  activeMatter: MatterSummary;
  compactDate: (value?: string) => string;
  compactStatus: (value?: string) => string;
  emailTemplateDraftsPanel?: ReactNode;
  inboundParserReplayInventory: CommunicationsInboxDashboardResponse["inboundParserReplayInventory"];
}) {
  return (
    <>
      <InboundParserReplayInventoryPanel
        compactDate={compactDate}
        inventory={inboundParserReplayInventory}
      />

      <div className="detail-grid compact-detail-grid">
        <div>
          <span className="field-label">Matter</span>
          <strong>{activeMatter.number}</strong>
          <small>{activeMatter.title}</small>
        </div>
        <div>
          <span className="field-label">Inbox status</span>
          <strong>{activeCommunicationsInbox?.status.replaceAll("_", " ") ?? "unavailable"}</strong>
          <small>Loaded through existing matter-scoped communications routes.</small>
        </div>
        <div>
          <span className="field-label">Inbound</span>
          <strong>{activeCommunicationsInbox?.inboundEmail.length ?? 0}</strong>
          <small>Body and provider metadata stay redacted.</small>
        </div>
        <div>
          <span className="field-label">Outbound</span>
          <strong>{activeCommunicationsInbox?.outboundDeliveryHistory.length ?? 0}</strong>
          <small>Delivery state only; no provider-side mutation.</small>
        </div>
      </div>

      {emailTemplateDraftsPanel}

      <div className="section-title">
        <h3>Client communications</h3>
        <span>
          {activeCommunicationsInbox
            ? `${activeCommunicationsInbox.channelHistory.length} history entries`
            : "unavailable"}
        </span>
      </div>
      <div className="detail-grid compact-detail-grid">
        <div>
          <span className="field-label">Conversation topics</span>
          <strong>{activeCommunicationsInbox?.conversations.length ?? 0}</strong>
        </div>
        <div>
          <span className="field-label">History entries</span>
          <strong>{activeCommunicationsInbox?.channelHistory.length ?? 0}</strong>
        </div>
        <div>
          <span className="field-label">Update drafts</span>
          <strong>{activeCommunicationsInbox?.clientUpdateDraftRequests.length ?? 0}</strong>
        </div>
        <div>
          <span className="field-label">Channel status</span>
          <strong>
            {activeCommunicationsInbox
              ? `${compactStatus(activeCommunicationsInbox.channelState.inboundEmailStatus)} / ${compactStatus(activeCommunicationsInbox.channelState.outboundEmailStatus)}`
              : "unavailable"}
          </strong>
        </div>
      </div>

      <div className="party-list">
        {activeCommunicationsInbox?.channelHistory.slice(0, 4).map((item) => {
          const state = describeCommunicationsHistoryState(item);
          return (
            <div className="party-row" key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.detail} · {compactStatus(item.direction)} · {compactDate(item.occurredAt)}
                </small>
                {item.consentStatus ? (
                  <small>Consent {compactStatus(item.consentStatus)}</small>
                ) : null}
              </span>
              <em className={state.tone === "risk" ? "risk" : undefined}>{state.label}</em>
            </div>
          );
        })}
        {activeCommunicationsInbox?.inboundEmail.slice(0, 3).map((message) => {
          const reviewCues = summarizeInboundEmailMatterDraftReviewCues(message.matterDraft);
          return (
            <div className="party-row" key={message.id}>
              <span>
                <strong>{compactStatus(message.triage?.status ?? message.status)}</strong>
                <small>
                  received {compactDate(message.receivedAt)} · {message.attachmentCount} attachment
                  {message.attachmentCount === 1 ? "" : "s"}
                </small>
                {message.labels.length > 0 ? (
                  <small>{message.labels.map(compactStatus).join(", ")}</small>
                ) : null}
                {reviewCues ? (
                  <small>
                    {reviewCues.duplicateCandidates} · {reviewCues.existingMatterCandidates} ·{" "}
                    {reviewCues.checklistStates} · {reviewCues.boundary}
                  </small>
                ) : null}
              </span>
              <em>{message.status.replaceAll("_", " ")}</em>
            </div>
          );
        })}
        {activeCommunicationsInbox?.outboundDeliveryHistory.slice(0, 3).map((email) => {
          const state = describeCommunicationsDeliveryState(email);
          return (
            <div className="party-row" key={email.id}>
              <span>
                <strong>{email.templateKey}</strong>
                <small>
                  {email.recipientCount} recipients · {email.attemptCount} attempts ·{" "}
                  {compactDate(email.lastAttemptAt ?? email.queuedAt)}
                </small>
                {email.failureSummary ? <small>{email.failureSummary}</small> : null}
                <small>{state.detail}</small>
              </span>
              <em className={state.tone === "risk" ? "risk" : undefined}>{state.label}</em>
            </div>
          );
        })}
        {activeCommunicationsInbox?.conversations.slice(0, 3).map((thread) => (
          <div className="party-row" key={thread.id}>
            <span>
              <strong>{thread.topic}</strong>
              <small>
                {compactStatus(thread.notificationBoundary)} · {compactDate(thread.updatedAt)}
              </small>
            </span>
            <em>{compactStatus(thread.status)}</em>
          </div>
        ))}
        {activeCommunicationsInbox?.contactCues.slice(0, 3).map((cue) => {
          const linkedRole = cue.matterLinks[0]?.role;
          const reviewCount = cue.cueSummary.conflictCueCount + cue.cueSummary.qualitySignalCount;
          return (
            <div className="party-row" key={cue.contact.id}>
              <span>
                <strong>{cue.contact.displayName}</strong>
                <small>
                  {cue.contact.kind} · {linkedRole ? compactStatus(linkedRole) : "matter link"}
                </small>
              </span>
              <em className={reviewCount > 0 ? "risk" : undefined}>
                {reviewCount > 0 ? `${reviewCount} cues` : "clear"}
              </em>
            </div>
          );
        })}
        {activeCommunicationsInbox &&
        activeCommunicationsInbox.inboundEmail.length === 0 &&
        activeCommunicationsInbox.outboundDeliveryHistory.length === 0 &&
        activeCommunicationsInbox.conversations.length === 0 &&
        activeCommunicationsInbox.channelHistory.length === 0 &&
        activeCommunicationsInbox.clientUpdateDraftRequests.length === 0 &&
        activeCommunicationsInbox.contactCues.length === 0 ? (
          <p className="inline-empty">No client communications are linked to this matter.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Email delivery history</h3>
        <span>{activeEmailDeliveries.length} recent records</span>
      </div>
      <div className="party-list">
        {activeEmailDeliveries.map((email) => {
          const state = describeEmailDeliveryState(email);
          const latestEvent = email.events.at(-1);
          return (
            <div className="party-row" key={email.id}>
              <span>
                <strong>{email.templateKey}</strong>
                <small>
                  {email.recipientCount} recipients · {email.attemptCount} attempts ·{" "}
                  {compactDate(email.lastAttemptAt ?? email.queuedAt)}
                  {latestEvent ? ` · ${latestEvent.eventType}` : ""}
                </small>
                {email.failureSummary ? <small>{email.failureSummary}</small> : null}
                <small>{state.detail}</small>
              </span>
              <em className={state.tone === "risk" ? "risk" : undefined}>{state.label}</em>
            </div>
          );
        })}
        {activeEmailDeliveries.length === 0 ? (
          <p className="inline-empty">No outbound email history is linked to this matter.</p>
        ) : null}
      </div>
    </>
  );
}
