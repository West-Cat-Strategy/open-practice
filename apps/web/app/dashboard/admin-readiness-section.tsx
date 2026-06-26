"use client";

import {
  ClipboardCheck,
  DatabaseBackup,
  FileDown,
  Inbox,
  LockKeyhole,
  Mail,
  MapPinned,
  RefreshCcw,
  Save,
} from "lucide-react";
import { useState } from "react";
import { dashboardApiStatus, requestDashboardJson } from "../api-client";
import type {
  CapabilitiesResponse,
  EmailSettings,
  ImapSettings,
  MatterSummary,
  PracticeOverview,
  ProvidersStatusResponse,
  SessionResponse,
  SetupStatusResponse,
  StaffReportingWorkspaceResponse,
  WorkerHealthResponse,
} from "../types";

type ReadinessTone = "ready" | "review" | "blocked";

export interface AdminReadinessItem {
  key: string;
  title: string;
  detail: string;
  status: string;
  tone: ReadinessTone;
}

export interface AdminReadinessSummary {
  access: AdminReadinessItem[];
  portability: AdminReadinessItem[];
  operations: AdminReadinessItem[];
  providers: AdminReadinessItem[];
}

function roleLabel(role: SessionResponse["user"]["role"]): string {
  return role.replaceAll("_", " ");
}

function setupStatusLabel(setupStatus: SetupStatusResponse): string {
  if (setupStatus.blocked) return "operator review";
  if (setupStatus.required) return "setup required";
  return "complete";
}

function setupStatusDetail(setupStatus: SetupStatusResponse): string {
  if (setupStatus.blocked) {
    return setupStatus.reason ?? "Partial setup state needs operator review before sign-in.";
  }
  if (setupStatus.required) {
    return "First-run owner setup is waiting before staff sign-in.";
  }
  return "First-run setup is complete; owner changes still need explicit staff workflows.";
}

function compactPosture(value?: string): string {
  return value ? value.replaceAll("_", " ") : "none";
}

function compactPostureWithReason(status?: string, reason?: string): string {
  const statusLabel = compactPosture(status);
  const reasonLabel = reason ? compactPosture(reason) : undefined;
  if (!reasonLabel || reasonLabel === statusLabel) return statusLabel;
  return `${statusLabel}: ${reasonLabel}`;
}

type ProviderQueue = ProvidersStatusResponse["bullmq"]["workerQueues"][number];

function queuePosture(queue?: ProviderQueue): string {
  return compactPostureWithReason(queue?.status, queue?.reason);
}

function servicePosture(service: { status: string; provider?: string; reason?: string }): string {
  const posture = compactPostureWithReason(service.status, service.reason);
  if (!service.provider) return posture;
  if (service.status === "configured" && !service.reason) return compactPosture(service.provider);
  return `${posture} · ${compactPosture(service.provider)}`;
}

function summarizeReadinessCues(items: string[], emptyDetail: string): string {
  if (items.length === 0) return emptyDetail;
  const visibleItems = items.slice(0, 4);
  const hiddenCount = items.length - visibleItems.length;
  return `${visibleItems.join("; ")}${hiddenCount > 0 ? `; ${hiddenCount} more` : ""}.`;
}

function buildProviderReadinessItems(status: ProvidersStatusResponse): AdminReadinessItem[] {
  const emailQueue = status.email.queue;
  const ocrQueue = status.documentProcessing.workerQueues.find(
    (queue) => queue.queueName === "ocr",
  );
  const activeOrQueuedJobs = status.jobs.summary.queued + status.jobs.summary.active;
  const optionalProviderKinds = new Set([
    "ai",
    "inbound_email",
    "media",
    "public_intake",
    "transcription",
  ]);
  const requiredBlockers = [
    status.objectStorage.status !== "configured"
      ? `object storage ${compactPostureWithReason(status.objectStorage.status, status.objectStorage.reason)}`
      : undefined,
    status.externalUploads.tokenSigning !== "configured"
      ? `share token signing ${compactPostureWithReason(status.externalUploads.tokenSigning, status.externalUploads.reason)}`
      : undefined,
    status.email.status !== "configured"
      ? `outbound email ${servicePosture(status.email)}`
      : undefined,
    emailQueue?.status !== "configured" ? `email queue ${queuePosture(emailQueue)}` : undefined,
    status.documentProcessing.status !== "configured"
      ? `document processing ${compactPostureWithReason(status.documentProcessing.status, status.documentProcessing.reason)}`
      : undefined,
    ocrQueue?.status !== "configured" ? `OCR queue ${queuePosture(ocrQueue)}` : undefined,
  ].filter((item): item is string => Boolean(item));
  const disabledProviderSettings = status.providerSettings.flatMap((setting) =>
    optionalProviderKinds.has(setting.kind)
      ? setting.providers
          .filter((provider) => !provider.enabled)
          .map(
            (provider) =>
              `${compactPosture(setting.kind)} ${compactPostureWithReason(
                setting.status,
                provider.disabledReason ?? setting.reason ?? "provider_disabled",
              )} · ${compactPosture(provider.key)}`,
          )
      : [],
  );
  const optionalDisabled = [
    status.inboundEmail.status !== "configured"
      ? `inbound email ${servicePosture(status.inboundEmail)}`
      : undefined,
    status.draftAssist.status !== "configured"
      ? `draft assist ${servicePosture(status.draftAssist)}`
      : undefined,
    ...(status.bullmq.reservedWorkerQueues ?? []).map((queue) =>
      queue.status === "reserved"
        ? `${compactPosture(queue.queueName)} reserved for ${compactPosture(queue.task)}`
        : `${compactPosture(queue.queueName)} ${queuePosture(queue)}`,
    ),
    ...disabledProviderSettings,
  ].filter((item): item is string => Boolean(item));
  const watchItems = [
    `live health ${compactPostureWithReason(status.liveHealth.status, status.liveHealth.reason)}`,
    status.jobs.summary.failed > 0
      ? `${status.jobs.summary.failed} failed provider jobs`
      : undefined,
    activeOrQueuedJobs > 0 ? `${activeOrQueuedJobs} active or queued provider jobs` : undefined,
    status.bullmq.reservedWorkerQueues && status.bullmq.reservedWorkerQueues.length > 0
      ? `${status.bullmq.reservedWorkerQueues.length} reserved worker queues`
      : undefined,
  ].filter((item): item is string => Boolean(item));

  return [
    {
      key: "provider-required-blockers",
      title: "Required provider blockers",
      detail: summarizeReadinessCues(
        requiredBlockers,
        "Object storage, share token signing, outbound email, and OCR queue posture are configured.",
      ),
      status: requiredBlockers.length > 0 ? "blocked" : "ready",
      tone: requiredBlockers.length > 0 ? "blocked" : "ready",
    },
    {
      key: "provider-disabled-boundaries",
      title: "Optional disabled boundaries",
      detail: summarizeReadinessCues(
        optionalDisabled,
        "Optional provider boundaries do not show disabled posture in the loaded status.",
      ),
      status: optionalDisabled.length > 0 ? `${optionalDisabled.length} disabled` : "none",
      tone: optionalDisabled.length > 0 ? "review" : "ready",
    },
    {
      key: "provider-watch-items",
      title: "Operator watch items",
      detail: summarizeReadinessCues(
        watchItems,
        "No provider watch items were reported in the loaded read-only posture.",
      ),
      status: status.jobs.summary.failed > 0 ? "watch" : "read only",
      tone: status.jobs.summary.failed > 0 ? "blocked" : "review",
    },
  ];
}

export function buildAdminReadinessSummary(input: {
  capabilities: CapabilitiesResponse;
  matters: MatterSummary[];
  overview: PracticeOverview;
  providerStatus: ProvidersStatusResponse;
  reportingWorkspace: StaffReportingWorkspaceResponse;
  session: SessionResponse;
  setupStatus: SetupStatusResponse;
  workerHealth: WorkerHealthResponse;
}): AdminReadinessSummary {
  const enabledCapabilityCount = input.capabilities.sections.filter(
    (section) => section.enabled,
  ).length;
  const ownerOrAuditor =
    input.session.user.role === "owner_admin" || input.session.user.role === "auditor";
  const exportProfileCount = input.reportingWorkspace.exportProfiles.length;
  const reportDefinitionCount = input.reportingWorkspace.definitions.length;
  const setupLabel = setupStatusLabel(input.setupStatus);

  return {
    access: [
      {
        key: "role-boundary",
        title: "Role boundary",
        detail: `${roleLabel(input.session.user.role)} can review ${enabledCapabilityCount} enabled dashboard surfaces without changing permissions from this panel.`,
        status: ownerOrAuditor ? "reviewable" : "limited",
        tone: ownerOrAuditor ? "ready" : "review",
      },
      {
        key: "support-access",
        title: "Support access",
        detail:
          "No support impersonation or support-session mutation is exposed; assistance stays evidence-driven through audit, reports, and operator-owned exports.",
        status: "disabled",
        tone: "ready",
      },
      {
        key: "setup-posture",
        title: "Owner setup",
        detail: setupStatusDetail(input.setupStatus),
        status: setupLabel,
        tone: input.setupStatus.blocked
          ? "blocked"
          : input.setupStatus.required
            ? "review"
            : "ready",
      },
    ],
    portability: [
      {
        key: "export-readiness",
        title: "Export readiness",
        detail: `${reportDefinitionCount} report definitions and ${exportProfileCount} export profiles are available as bounded staff export metadata.`,
        status: exportProfileCount > 0 ? "available" : "review",
        tone: exportProfileCount > 0 ? "ready" : "review",
      },
      {
        key: "migration-checklist",
        title: "Migration checklist",
        detail: `${input.matters.length} matter summaries are visible for onboarding review; import remains checklist-led and does not create production migration services.`,
        status: "checklist only",
        tone: "review",
      },
      {
        key: "data-boundaries",
        title: "Data boundaries",
        detail:
          "Trust imports, conversation exports, billing exports, and report exports stay on existing review-first paths with redacted job metadata.",
        status: "review-first",
        tone: "ready",
      },
    ],
    operations: [
      {
        key: "regional-privacy",
        title: "Regional and privacy posture",
        detail: `${input.overview.firm.defaultProvince} is the firm default province; this panel records posture only and does not claim regional hosting guarantees.`,
        status: "posture note",
        tone: "review",
      },
      {
        key: "backup-restore",
        title: "Backup and restore evidence",
        detail:
          "Backup and restore proof remains an operator-run release task for PostgreSQL and object storage; no hosted backup guarantee is surfaced here.",
        status: "evidence required",
        tone: "review",
      },
      {
        key: "private-pilot-object-storage-blocker",
        title: "Private-pilot object storage proof",
        detail:
          "Bundled MinIO is proof-gated by local residual-watch: hardened local and self-host Compose services, current source-only MinIO posture, and no same-contract remediation candidate. Successful external HTTPS S3 restore-drill evidence remains manual handoff evidence for an alternate object-storage path.",
        status: "proof-gated",
        tone: "review",
      },
      {
        key: "worker-readiness",
        title: "Worker evidence",
        detail: `${input.workerHealth.configuredQueues} configured queues; ${input.workerHealth.failed} failed and ${input.workerHealth.stalled} stalled runs in the loaded health window.`,
        status: input.workerHealth.status,
        tone: input.workerHealth.status === "healthy" ? "ready" : "review",
      },
    ],
    providers: buildProviderReadinessItems(input.providerStatus),
  };
}

function toneClass(tone: ReadinessTone): string {
  if (tone === "blocked") return "risk";
  if (tone === "ready") return "ready";
  return "";
}

function ReadinessList({ items }: { items: AdminReadinessItem[] }) {
  return (
    <div className="party-list">
      {items.map((item) => (
        <div className="party-row" key={item.key}>
          <span>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </span>
          <em className={toneClass(item.tone)}>{item.status}</em>
        </div>
      ))}
    </div>
  );
}

type EmailSettingsFormState = {
  enabled: boolean;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  fromAddress: string;
};

type ImapSettingsFormState = {
  enabled: boolean;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  mailbox: string;
  pollIntervalSeconds: string;
  markSeen: boolean;
};

function formatPort(port: number | undefined): string {
  return port ? String(port) : "";
}

function settingsStateFromEmail(settings: EmailSettings): EmailSettingsFormState {
  return {
    enabled: settings.enabled,
    host: settings.host ?? "",
    port: formatPort(settings.port),
    secure: settings.secure,
    username: settings.username ?? "",
    password: "",
    fromAddress: settings.fromAddress ?? "",
  };
}

function settingsStateFromImap(settings: ImapSettings): ImapSettingsFormState {
  return {
    enabled: settings.enabled,
    host: settings.host ?? "",
    port: formatPort(settings.port),
    secure: settings.secure,
    username: settings.username ?? "",
    password: "",
    mailbox: settings.mailbox,
    pollIntervalSeconds: String(settings.pollIntervalSeconds),
    markSeen: settings.markSeen,
  };
}

function optionalPort(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

function emailSettingsStatus(settings: EmailSettings): string {
  if (!settings.enabled) return "SMTP is disabled.";
  if (settings.configValid) return "SMTP is enabled with complete settings.";
  return `SMTP is enabled but missing ${settings.missingFields.join(", ")}.`;
}

function imapSettingsStatus(settings: ImapSettings): string {
  if (!settings.enabled) return "IMAP polling is disabled.";
  if (settings.configValid) return "IMAP polling is enabled with complete settings.";
  return `IMAP polling is enabled but missing ${settings.missingFields.join(", ")}.`;
}

export function AdminReadinessSection({
  apiBaseUrl,
  capabilities,
  devHeaders,
  emailSettings,
  imapSettings,
  matters,
  overview,
  providerStatus,
  reportingWorkspace,
  session,
  setupStatus,
  workerHealth,
}: {
  apiBaseUrl: string;
  capabilities: CapabilitiesResponse;
  devHeaders: Record<string, string>;
  emailSettings: EmailSettings;
  imapSettings: ImapSettings;
  matters: MatterSummary[];
  overview: PracticeOverview;
  providerStatus: ProvidersStatusResponse;
  reportingWorkspace: StaffReportingWorkspaceResponse;
  session: SessionResponse;
  setupStatus: SetupStatusResponse;
  workerHealth: WorkerHealthResponse;
}) {
  const summary = buildAdminReadinessSummary({
    capabilities,
    matters,
    overview,
    providerStatus,
    reportingWorkspace,
    session,
    setupStatus,
    workerHealth,
  });
  const canUpdateEmailSettings = session.user.role === "owner_admin";
  const [smtpSettings, setSmtpSettings] = useState(emailSettings);
  const [imapPollingSettings, setImapPollingSettings] = useState(imapSettings);
  const [smtpForm, setSmtpForm] = useState(() => settingsStateFromEmail(emailSettings));
  const [imapForm, setImapForm] = useState(() => settingsStateFromImap(imapSettings));
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [imapSaving, setImapSaving] = useState(false);
  const [imapPolling, setImapPolling] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState(emailSettingsStatus(emailSettings));
  const [imapStatus, setImapStatus] = useState(imapSettingsStatus(imapSettings));

  async function saveSmtpSettings(): Promise<void> {
    setSmtpSaving(true);
    try {
      const payload = {
        enabled: smtpForm.enabled,
        host: smtpForm.host,
        port: optionalPort(smtpForm.port),
        secure: smtpForm.secure,
        username: smtpForm.username,
        ...(smtpForm.password.trim() ? { password: smtpForm.password } : {}),
        fromAddress: smtpForm.fromAddress,
      };
      const response = await requestDashboardJson<{ settings: EmailSettings }>(
        apiBaseUrl,
        "/api/email/settings",
        {
          method: "PUT",
          headers: devHeaders,
          payload,
        },
      );
      setSmtpSettings(response.settings);
      setSmtpForm(settingsStateFromEmail(response.settings));
      setSmtpStatus(`SMTP settings saved. ${emailSettingsStatus(response.settings)}`);
    } catch (error) {
      setSmtpStatus(`SMTP settings save failed: ${dashboardApiStatus(error)}.`);
    } finally {
      setSmtpSaving(false);
    }
  }

  async function saveImapSettings(): Promise<void> {
    setImapSaving(true);
    try {
      const payload = {
        enabled: imapForm.enabled,
        host: imapForm.host,
        port: optionalPort(imapForm.port),
        secure: imapForm.secure,
        username: imapForm.username,
        ...(imapForm.password.trim() ? { password: imapForm.password } : {}),
        mailbox: imapForm.mailbox,
        pollIntervalSeconds: optionalNumber(imapForm.pollIntervalSeconds),
        markSeen: imapForm.markSeen,
      };
      const response = await requestDashboardJson<{ settings: ImapSettings }>(
        apiBaseUrl,
        "/api/inbound-email/settings/imap",
        {
          method: "PUT",
          headers: devHeaders,
          payload,
        },
      );
      setImapPollingSettings(response.settings);
      setImapForm(settingsStateFromImap(response.settings));
      setImapStatus(`IMAP settings saved. ${imapSettingsStatus(response.settings)}`);
    } catch (error) {
      setImapStatus(`IMAP settings save failed: ${dashboardApiStatus(error)}.`);
    } finally {
      setImapSaving(false);
    }
  }

  async function pollImapNow(): Promise<void> {
    setImapPolling(true);
    try {
      await requestDashboardJson(apiBaseUrl, "/api/inbound-email/settings/imap/poll", {
        method: "POST",
        headers: devHeaders,
      });
      setImapStatus("Immediate IMAP poll queued.");
    } catch (error) {
      setImapStatus(`Immediate IMAP poll failed: ${dashboardApiStatus(error)}.`);
    } finally {
      setImapPolling(false);
    }
  }

  return (
    <>
      <div className="detail-grid billing-summary-grid">
        <div>
          <span className="field-label">Current role</span>
          <strong>{roleLabel(session.user.role)}</strong>
        </div>
        <div>
          <span className="field-label">Setup</span>
          <strong>{setupStatusLabel(setupStatus)}</strong>
        </div>
        <div>
          <span className="field-label">Export profiles</span>
          <strong>{reportingWorkspace.exportProfiles.length}</strong>
        </div>
        <div>
          <span className="field-label">Firm default region</span>
          <strong>{overview.firm.defaultProvince}</strong>
        </div>
      </div>

      <div className="section-title">
        <h3>Access and support controls</h3>
        <span>read-only posture · no impersonation</span>
      </div>
      <div className="activity-grid">
        <div className="activity-card">
          <LockKeyhole aria-hidden="true" size={20} />
          <strong>Permission review</strong>
          <small>Shows current access posture without creating roles or grants.</small>
        </div>
        <div className="activity-card">
          <ClipboardCheck aria-hidden="true" size={20} />
          <strong>Operator-owned support</strong>
          <small>Support work stays staff-mediated and audit-reviewable.</small>
        </div>
      </div>
      <ReadinessList items={summary.access} />

      <div className="section-title">
        <h3>Portability and migration</h3>
        <span>checklists and bounded exports</span>
      </div>
      <div className="activity-grid">
        <div className="activity-card">
          <FileDown aria-hidden="true" size={20} />
          <strong>Export posture</strong>
          <small>Uses existing report, billing, trust, audit, and conversation export seams.</small>
        </div>
        <div className="activity-card">
          <DatabaseBackup aria-hidden="true" size={20} />
          <strong>Restore proof</strong>
          <small>Records that backup/restore evidence is required before release handoff.</small>
        </div>
      </div>
      <ReadinessList items={summary.portability} />

      <div className="section-title">
        <h3>Regional, privacy, and training posture</h3>
        <span>operator evidence only</span>
      </div>
      <div className="activity-grid">
        <div className="activity-card">
          <MapPinned aria-hidden="true" size={20} />
          <strong>Regional cues</strong>
          <small>Records firm-default posture without hosting or compliance guarantees.</small>
        </div>
        <div className="activity-card">
          <ClipboardCheck aria-hidden="true" size={20} />
          <strong>Training checklist</strong>
          <small>Points staff back to validation notes and operational docs.</small>
        </div>
      </div>
      <ReadinessList items={summary.operations} />

      <div className="section-title">
        <h3>Provider readiness</h3>
        <span>read-only posture · no toggles</span>
      </div>
      <ReadinessList items={summary.providers} />

      <div className="section-title">
        <h3>Email settings</h3>
        <span>{canUpdateEmailSettings ? "owner-admin editable" : "read only"}</span>
      </div>
      <div className="activity-grid two-column">
        <div className="activity-card">
          <Mail aria-hidden="true" size={20} />
          <strong>Transactional SMTP</strong>
          <small>{smtpSettings.enabled ? "Enabled" : "Disabled"}</small>
          <div className="upload-create-grid">
            <label className="search-field compact">
              <span>Enabled</span>
              <input
                checked={smtpForm.enabled}
                disabled={!canUpdateEmailSettings || smtpSaving}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, enabled: event.target.checked }))
                }
                type="checkbox"
              />
            </label>
            <label className="search-field compact">
              <span>Host</span>
              <input
                disabled={!canUpdateEmailSettings || smtpSaving}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, host: event.target.value }))
                }
                value={smtpForm.host}
              />
            </label>
            <label className="search-field compact">
              <span>Port</span>
              <input
                disabled={!canUpdateEmailSettings || smtpSaving}
                inputMode="numeric"
                min={1}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, port: event.target.value }))
                }
                type="number"
                value={smtpForm.port}
              />
            </label>
            <label className="search-field compact">
              <span>TLS</span>
              <input
                checked={smtpForm.secure}
                disabled={!canUpdateEmailSettings || smtpSaving}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, secure: event.target.checked }))
                }
                type="checkbox"
              />
            </label>
            <label className="search-field compact">
              <span>Username</span>
              <input
                disabled={!canUpdateEmailSettings || smtpSaving}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, username: event.target.value }))
                }
                value={smtpForm.username}
              />
            </label>
            <label className="search-field compact">
              <span>Password</span>
              <input
                disabled={!canUpdateEmailSettings || smtpSaving}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder={smtpSettings.passwordConfigured ? "Configured" : ""}
                type="password"
                value={smtpForm.password}
              />
            </label>
            <label className="search-field compact">
              <span>Send from</span>
              <input
                disabled={!canUpdateEmailSettings || smtpSaving}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, fromAddress: event.target.value }))
                }
                value={smtpForm.fromAddress}
              />
            </label>
            <button
              className="primary-button"
              disabled={!canUpdateEmailSettings || smtpSaving}
              onClick={() => void saveSmtpSettings()}
              type="button"
            >
              <Save aria-hidden="true" size={16} />
              {smtpSaving ? "Saving..." : "Save SMTP"}
            </button>
          </div>
          <p className="inline-empty" role="status" aria-live="polite">
            {smtpStatus} Password{" "}
            {smtpSettings.passwordConfigured ? "configured" : "not configured"}.
          </p>
        </div>

        <div className="activity-card">
          <Inbox aria-hidden="true" size={20} />
          <strong>Inbound IMAP</strong>
          <small>{imapPollingSettings.enabled ? "Enabled" : "Disabled"}</small>
          <div className="upload-create-grid">
            <label className="search-field compact">
              <span>Enabled</span>
              <input
                checked={imapForm.enabled}
                disabled={!canUpdateEmailSettings || imapSaving}
                onChange={(event) =>
                  setImapForm((current) => ({ ...current, enabled: event.target.checked }))
                }
                type="checkbox"
              />
            </label>
            <label className="search-field compact">
              <span>Host</span>
              <input
                disabled={!canUpdateEmailSettings || imapSaving}
                onChange={(event) =>
                  setImapForm((current) => ({ ...current, host: event.target.value }))
                }
                value={imapForm.host}
              />
            </label>
            <label className="search-field compact">
              <span>Port</span>
              <input
                disabled={!canUpdateEmailSettings || imapSaving}
                inputMode="numeric"
                min={1}
                onChange={(event) =>
                  setImapForm((current) => ({ ...current, port: event.target.value }))
                }
                type="number"
                value={imapForm.port}
              />
            </label>
            <label className="search-field compact">
              <span>TLS</span>
              <input
                checked={imapForm.secure}
                disabled={!canUpdateEmailSettings || imapSaving}
                onChange={(event) =>
                  setImapForm((current) => ({ ...current, secure: event.target.checked }))
                }
                type="checkbox"
              />
            </label>
            <label className="search-field compact">
              <span>Username</span>
              <input
                disabled={!canUpdateEmailSettings || imapSaving}
                onChange={(event) =>
                  setImapForm((current) => ({ ...current, username: event.target.value }))
                }
                value={imapForm.username}
              />
            </label>
            <label className="search-field compact">
              <span>Password</span>
              <input
                disabled={!canUpdateEmailSettings || imapSaving}
                onChange={(event) =>
                  setImapForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder={imapPollingSettings.passwordConfigured ? "Configured" : ""}
                type="password"
                value={imapForm.password}
              />
            </label>
            <label className="search-field compact">
              <span>Mailbox</span>
              <input
                disabled={!canUpdateEmailSettings || imapSaving}
                onChange={(event) =>
                  setImapForm((current) => ({ ...current, mailbox: event.target.value }))
                }
                value={imapForm.mailbox}
              />
            </label>
            <label className="search-field compact">
              <span>Poll seconds</span>
              <input
                disabled={!canUpdateEmailSettings || imapSaving}
                inputMode="numeric"
                min={60}
                onChange={(event) =>
                  setImapForm((current) => ({
                    ...current,
                    pollIntervalSeconds: event.target.value,
                  }))
                }
                type="number"
                value={imapForm.pollIntervalSeconds}
              />
            </label>
            <label className="search-field compact">
              <span>Mark seen</span>
              <input
                checked={imapForm.markSeen}
                disabled={!canUpdateEmailSettings || imapSaving}
                onChange={(event) =>
                  setImapForm((current) => ({ ...current, markSeen: event.target.checked }))
                }
                type="checkbox"
              />
            </label>
            <button
              className="secondary-button compact-button"
              disabled={
                !canUpdateEmailSettings ||
                imapPolling ||
                !imapPollingSettings.enabled ||
                !imapPollingSettings.configValid
              }
              onClick={() => void pollImapNow()}
              type="button"
            >
              <RefreshCcw aria-hidden="true" size={16} />
              {imapPolling ? "Queueing..." : "Poll now"}
            </button>
            <button
              className="primary-button"
              disabled={!canUpdateEmailSettings || imapSaving}
              onClick={() => void saveImapSettings()}
              type="button"
            >
              <Save aria-hidden="true" size={16} />
              {imapSaving ? "Saving..." : "Save IMAP"}
            </button>
          </div>
          <p className="inline-empty" role="status" aria-live="polite">
            {imapStatus} Password{" "}
            {imapPollingSettings.passwordConfigured ? "configured" : "not configured"}.
          </p>
          <p className="inline-empty">
            Last successful poll: {imapPollingSettings.lastSuccessfulPollAt ?? "none"}; next poll:{" "}
            {imapPollingSettings.nextPollAt ?? "not scheduled"}.
          </p>
        </div>
      </div>
    </>
  );
}
