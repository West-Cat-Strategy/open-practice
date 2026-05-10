import type { ChangeEvent, ReactNode, RefObject } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { ConflictCandidate } from "@open-practice/domain";
import type { OpenPracticeSidebarNavigationSection } from "../../routes/routeCatalog";
import { describeDisabledNavigationReason } from "../dashboard-utils";
import { focusItemToneClass, type OperationalFocusSummary } from "../operational-focus-panel";
import {
  describeConflictResult,
  formatConflictProspectiveRole,
  type ConflictProspectiveRole,
} from "../conflict-check-dashboard";
import type { MatterSummary, QueuesResponse, SessionResponse } from "../types";

type LocalDashboardSectionKey = OpenPracticeSidebarNavigationSection["key"];

export type DashboardMetric = {
  label: string;
  value: string;
  icon: LucideIcon;
};

export function DashboardSidebar({
  activeSection,
  navigationSections,
  navIcons,
  onSelectSection,
}: {
  activeSection: LocalDashboardSectionKey;
  navigationSections: OpenPracticeSidebarNavigationSection[];
  navIcons: Record<LocalDashboardSectionKey, LucideIcon>;
  onSelectSection: (section: LocalDashboardSectionKey) => void;
}) {
  return (
    <aside className="sidebar dashboard-sidebar" aria-label="Primary">
      <div className="brand dashboard-brand">
        <span className="brand-mark">OP</span>
        <div>
          <strong>Open Practice</strong>
          <span>Apache-2.0 core</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="Dashboard sections">
        {navigationSections.map(({ key, label, enabled }) => {
          const Icon = navIcons[key];
          const disabledReason = describeDisabledNavigationReason({ key, label, enabled });
          const disabledReasonId = `nav-disabled-${key}`;
          return (
            <button
              aria-current={key === activeSection ? "page" : undefined}
              aria-describedby={disabledReason ? disabledReasonId : undefined}
              aria-disabled={!enabled}
              className={key === activeSection ? "nav-item active" : "nav-item"}
              disabled={!enabled}
              key={label}
              onClick={() => onSelectSection(key)}
              type="button"
            >
              <Icon size={18} />
              <span>
                <strong>{label}</strong>
                {disabledReason ? (
                  <small className="nav-disabled-reason" id={disabledReasonId}>
                    {disabledReason}
                  </small>
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>

      <section className="security-card dashboard-security-card">
        <ShieldCheck size={20} />
        <strong>Server-enforced controls</strong>
        <p>Data is loaded through authenticated API requests and matter-scoped permissions.</p>
      </section>
    </aside>
  );
}

export function DashboardTopbar({
  firmName,
  session,
  formatProfessionalRole,
}: {
  firmName: string;
  session: SessionResponse;
  formatProfessionalRole: (role: SessionResponse["user"]["role"]) => string;
}) {
  return (
    <header className="topbar dashboard-topbar">
      <div className="topbar-heading">
        <p className="eyebrow">BC / Ontario / Canada small-practice workspace</p>
        <h1 id="dashboard-title">{firmName}</h1>
      </div>
      <div className="user-pill topbar-user-pill">
        <span>{session.user.displayName}</span>
        <strong>{formatProfessionalRole(session.user.role)}</strong>
      </div>
    </header>
  );
}

export function DashboardMetrics({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="metric-grid dashboard-metrics" aria-label="Practice metrics">
      {metrics.map((metric) => (
        <article className="metric-card" key={metric.label}>
          <metric.icon size={19} />
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </article>
      ))}
    </section>
  );
}

export function OperationalFocusPanel({
  operationalFocus,
  operationalFocusEmpty,
  onOpenQueues,
}: {
  operationalFocus: OperationalFocusSummary;
  operationalFocusEmpty?: string;
  onOpenQueues: () => void;
}) {
  return (
    <section className="panel operational-focus-panel" aria-labelledby="operational-focus-title">
      <div className="panel-header operational-focus-header">
        <div>
          <p className="eyebrow">Operations focus</p>
          <h2 id="operational-focus-title">What needs attention</h2>
        </div>
        <button className="text-button" onClick={onOpenQueues} type="button">
          <Clock3 size={16} aria-hidden="true" />
          Open queues
        </button>
      </div>
      <div className="operational-focus-summary" aria-label="Operations focus summary">
        <span>
          <strong>{operationalFocus.attentionCount}</strong>
          Attention
        </span>
        <span>
          <strong>{operationalFocus.activeCount}</strong>
          Active
        </span>
        <span>
          <strong>{operationalFocus.providerRiskCount}</strong>
          Provider risks
        </span>
      </div>
      <div className="operational-focus-list">
        {operationalFocus.items.map((item) => (
          <article
            className={`operational-focus-item ${focusItemToneClass(item.tone)}`}
            key={item.key}
          >
            <span className="operational-focus-item-value">{item.value}</span>
            <span>
              <strong>{item.label}</strong>
              {item.detail ? (
                <small>
                  {item.section} · {item.detail}
                </small>
              ) : (
                <small>{item.section}</small>
              )}
            </span>
          </article>
        ))}
        {operationalFocusEmpty ? <p className="inline-empty">{operationalFocusEmpty}</p> : null}
      </div>
    </section>
  );
}

export function MatterContextPanel({
  activeMatter,
  filteredMatters,
  matterSearch,
  onMatterSearchChange,
  onSelectMatter,
}: {
  activeMatter: MatterSummary;
  filteredMatters: MatterSummary[];
  matterSearch: string;
  onMatterSearchChange: (value: string) => void;
  onSelectMatter: (matterId: string) => void;
}) {
  return (
    <section
      className="panel matter-context-panel dashboard-matter-context"
      aria-labelledby="matter-context-title"
    >
      <div className="panel-header matter-context-header">
        <div>
          <p className="eyebrow">Matter command centre</p>
          <h2 id="matter-context-title">Active files</h2>
        </div>
        <label className="search-field matter-search-field">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search matters"
            onChange={(event) => onMatterSearchChange(event.target.value)}
            placeholder="Search matters"
            value={matterSearch}
          />
        </label>
      </div>
      <div className="matter-strip">
        {filteredMatters.map((matter) => (
          <button
            className={matter.id === activeMatter.id ? "matter-row selected" : "matter-row"}
            key={matter.id}
            onClick={() => onSelectMatter(matter.id)}
            type="button"
          >
            <span>
              <strong>{matter.title}</strong>
              <small>
                {matter.number} · {matter.practiceArea}
              </small>
            </span>
            <em>{matter.status}</em>
          </button>
        ))}
        {filteredMatters.length === 0 ? <p className="inline-empty">No matters match.</p> : null}
      </div>
    </section>
  );
}

export function MatterDetailShell({
  activeMatter,
  activeSection,
  activeSectionLabel,
  children,
  detailPanelRef,
  matterActionSections,
  onSelectSection,
}: {
  activeMatter: MatterSummary;
  activeSection: LocalDashboardSectionKey;
  activeSectionLabel: string;
  children: ReactNode;
  detailPanelRef: RefObject<HTMLElement | null>;
  matterActionSections: OpenPracticeSidebarNavigationSection[];
  onSelectSection: (section: LocalDashboardSectionKey) => void;
}) {
  return (
    <article
      className="panel matter-detail matter-detail-panel"
      aria-labelledby="matter-detail-title"
      id="matter-workspace"
      ref={detailPanelRef}
      tabIndex={-1}
    >
      <div className="panel-header matter-detail-header">
        <div>
          <p className="eyebrow">{activeMatter.number}</p>
          <h2 id="matter-detail-title">{activeSectionLabel}</h2>
        </div>
        <span className="status-chip">{activeMatter.jurisdiction}</span>
      </div>
      <div className="matter-action-strip matter-detail-action-strip" aria-label="Matter actions">
        {matterActionSections.map((section) => {
          const disabledReason = describeDisabledNavigationReason(section);
          return (
            <button
              aria-current={section.key === activeSection ? "page" : undefined}
              aria-label={disabledReason ? `${section.label}: ${disabledReason}` : section.label}
              className={
                section.key === activeSection ? "action-strip-button active" : "action-strip-button"
              }
              disabled={!section.enabled}
              key={section.key}
              onClick={() => onSelectSection(section.key)}
              title={disabledReason ?? section.label}
              type="button"
            >
              {section.label}
            </button>
          );
        })}
      </div>
      {children}
    </article>
  );
}

export function ContextRail({
  conflictAliases,
  conflictIdentifiers,
  conflictName,
  conflictProspectiveRole,
  conflictResults,
  conflictStatus,
  queueSummary,
  queues,
  taskDeadlineSummary,
  onConflictAliasesChange,
  onConflictIdentifiersChange,
  onConflictNameChange,
  onConflictProspectiveRoleChange,
  onRunConflictCheck,
}: {
  conflictAliases: string;
  conflictIdentifiers: string;
  conflictName: string;
  conflictProspectiveRole: ConflictProspectiveRole | "";
  conflictResults: ConflictCandidate[];
  conflictStatus: string;
  queueSummary: string;
  queues: QueuesResponse;
  taskDeadlineSummary: string;
  onConflictAliasesChange: (value: string) => void;
  onConflictIdentifiersChange: (value: string) => void;
  onConflictNameChange: (value: string) => void;
  onConflictProspectiveRoleChange: (value: ConflictProspectiveRole | "") => void;
  onRunConflictCheck: () => void;
}) {
  return (
    <aside className="context-rail matter-context-rail" aria-label="Matter review tools">
      <article className="panel conflict-panel context-rail-panel">
        <div className="panel-header context-rail-header">
          <div>
            <p className="eyebrow">Conflict review</p>
            <h2>Prospective client check</h2>
          </div>
          <AlertTriangle size={20} />
        </div>
        <label className="search-field">
          <span>Prospective name</span>
          <input
            value={conflictName}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onConflictNameChange(event.target.value)
            }
            placeholder="Client, organization, alias, or adverse party"
          />
        </label>
        <label className="search-field">
          <span>Aliases</span>
          <textarea
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              onConflictAliasesChange(event.target.value)
            }
            placeholder="Comma-separated or one per line"
            rows={2}
            value={conflictAliases}
          />
        </label>
        <label className="search-field">
          <span>Prospective role</span>
          <select
            onChange={(event) =>
              onConflictProspectiveRoleChange(event.target.value as ConflictProspectiveRole | "")
            }
            value={conflictProspectiveRole}
          >
            <option value="">Unspecified role</option>
            {(["client", "opposing_party", "third_party"] as const).map((role) => (
              <option key={role} value={role}>
                {formatConflictProspectiveRole(role)}
              </option>
            ))}
          </select>
        </label>
        <label className="search-field">
          <span>Identifiers</span>
          <textarea
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              onConflictIdentifiersChange(event.target.value)
            }
            placeholder="email: person@example.test"
            rows={2}
            value={conflictIdentifiers}
          />
        </label>
        <button
          className="primary-button"
          disabled={conflictName.trim().length === 0}
          onClick={onRunConflictCheck}
          type="button"
        >
          <Search size={16} />
          Run conflict check
        </button>
        <div className="conflict-results">
          <p>{conflictStatus}</p>
          {conflictResults.length > 0
            ? conflictResults.map((result, index) => (
                <div className="conflict-row" key={`${result.contactId}-${index}`}>
                  {result.severity === "blocker" ? (
                    <AlertTriangle size={17} />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}
                  <span>
                    <strong>{result.severity}</strong>
                    <small>{describeConflictResult(result)}</small>
                    <small>{result.reason}</small>
                  </span>
                </div>
              ))
            : null}
        </div>
      </article>

      <article className="panel queue-panel context-rail-panel">
        <div className="panel-header context-rail-header">
          <div>
            <p className="eyebrow">Operational queues</p>
            <h2>Review work</h2>
          </div>
          <Clock3 size={20} />
        </div>
        <p className="inline-empty">{queueSummary}</p>
        <p className="inline-empty">{taskDeadlineSummary}</p>
        <div className="party-list">
          {queues.sections.flatMap((section) =>
            section.items.slice(0, 3).map((item) => (
              <div className="party-row" key={`${section.key}-${item.id}`}>
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {section.label} · {item.status}
                  </small>
                </span>
                <em className={item.priority === "high" ? "risk" : undefined}>{item.priority}</em>
              </div>
            )),
          )}
          {queues.sections.every((section) => section.items.length === 0) ? (
            <p className="inline-empty">No queue items need attention.</p>
          ) : null}
        </div>
      </article>
    </aside>
  );
}
