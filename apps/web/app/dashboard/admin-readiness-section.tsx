import { ClipboardCheck, DatabaseBackup, FileDown, LockKeyhole, MapPinned } from "lucide-react";
import type {
  CapabilitiesResponse,
  MatterSummary,
  PracticeOverview,
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
    return setupStatus.setupKeyRequired
      ? "First-run owner setup is waiting behind the configured setup key."
      : "First-run owner setup is waiting before staff sign-in.";
  }
  return "First-run setup is complete; owner changes still need explicit staff workflows.";
}

export function buildAdminReadinessSummary(input: {
  capabilities: CapabilitiesResponse;
  matters: MatterSummary[];
  overview: PracticeOverview;
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
        key: "worker-readiness",
        title: "Worker evidence",
        detail: `${input.workerHealth.configuredQueues} configured queues; ${input.workerHealth.failed} failed and ${input.workerHealth.stalled} stalled runs in the loaded health window.`,
        status: input.workerHealth.status,
        tone: input.workerHealth.status === "healthy" ? "ready" : "review",
      },
    ],
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

export function AdminReadinessSection({
  capabilities,
  matters,
  overview,
  reportingWorkspace,
  session,
  setupStatus,
  workerHealth,
}: {
  capabilities: CapabilitiesResponse;
  matters: MatterSummary[];
  overview: PracticeOverview;
  reportingWorkspace: StaffReportingWorkspaceResponse;
  session: SessionResponse;
  setupStatus: SetupStatusResponse;
  workerHealth: WorkerHealthResponse;
}) {
  const summary = buildAdminReadinessSummary({
    capabilities,
    matters,
    overview,
    reportingWorkspace,
    session,
    setupStatus,
    workerHealth,
  });

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
    </>
  );
}
