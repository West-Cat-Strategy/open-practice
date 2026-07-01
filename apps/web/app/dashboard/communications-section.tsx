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
import { DashboardSectionHeader, DashboardStatusNote, DashboardSummaryGrid } from "./shared-panels";

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

      <DashboardSummaryGrid
        className="compact-detail-grid"
        items={[
          {
            label: "Matter",
            value: activeMatter.number,
            detail: activeMatter.title,
          },
          {
            label: "Inbox status",
            value: activeCommunicationsInbox?.status.replaceAll("_", " ") ?? "unavailable",
            detail: "Loaded through existing matter-scoped communications routes.",
          },
          {
            label: "Inbound",
            value: activeCommunicationsInbox?.inboundEmail.length ?? 0,
            detail: "Body and provider metadata stay redacted.",
          },
          {
            label: "Outbound",
            value: activeCommunicationsInbox?.outboundDeliveryHistory.length ?? 0,
            detail: "Delivery state only; no provider-side mutation.",
          },
        ]}
      />

      {emailTemplateDraftsPanel}

      <DashboardSectionHeader
        meta={
          activeCommunicationsInbox
            ? `${activeCommunicationsInbox.channelHistory.length} history entries`
            : "unavailable"
        }
        title="Client communications"
      />
      <DashboardSummaryGrid
        className="compact-detail-grid"
        items={[
          {
            label: "Conversation topics",
            value: activeCommunicationsInbox?.conversations.length ?? 0,
          },
          {
            label: "History entries",
            value: activeCommunicationsInbox?.channelHistory.length ?? 0,
          },
          {
            label: "Update drafts",
            value: activeCommunicationsInbox?.clientUpdateDraftRequests.length ?? 0,
          },
          {
            label: "Channel status",
            value: activeCommunicationsInbox
              ? `${compactStatus(activeCommunicationsInbox.channelState.inboundEmailStatus)} / ${compactStatus(activeCommunicationsInbox.channelState.outboundEmailStatus)}`
              : "unavailable",
          },
        ]}
      />

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
          <DashboardStatusNote>
            No client communications are linked to this matter.
          </DashboardStatusNote>
        ) : null}
      </div>

      <DashboardSectionHeader
        meta={`${activeEmailDeliveries.length} recent records`}
        title="Email delivery history"
      />
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
          <DashboardStatusNote>
            No outbound email history is linked to this matter.
          </DashboardStatusNote>
        ) : null}
      </div>
    </>
  );
}
