import { type ChangeEvent, type ReactNode, type RefObject, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  PanelRight,
  PanelRightClose,
  Save,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ConflictCandidate } from "@open-practice/domain";
import type {
  OpenPracticeRouteArea,
  OpenPracticeSidebarNavigationSection,
} from "../../routes/routeCatalog";
import {
  describeDisabledNavigationReason,
  type SavedMatterPresetDefinition,
  type SavedMatterPresetFamily,
} from "../dashboard-utils";
import { focusItemToneClass, type OperationalFocusSummary } from "../operational-focus-panel";
import {
  describeConflictResult,
  formatConflictProspectiveRole,
  type ConflictProspectiveRole,
} from "../conflict-check-dashboard";
import type {
  MatterSummary,
  QueuesResponse,
  SavedOperationalViewDefinition,
  SessionResponse,
} from "../types";

type LocalDashboardSectionKey = OpenPracticeSidebarNavigationSection["key"];

type ActionableOperationalFocusItem = OperationalFocusSummary["items"][number] & {
  targetSection?: LocalDashboardSectionKey;
};

const navigationAreaLabels: Record<OpenPracticeRouteArea, string> = {
  workspace: "Workspace",
  finance: "Finance",
  operations: "Operations",
  review: "Review",
};

const navigationAreaOrder: OpenPracticeRouteArea[] = [
  "workspace",
  "finance",
  "operations",
  "review",
];

const dashboardReviewRailId = "dashboard-review-rail";

export type DashboardMetric = {
  label: string;
  value: string;
  icon: LucideIcon;
};

export function DashboardSidebar({
  activeSection,
  matterState = "populated",
  navigationSections,
  navIcons,
  onSelectSection,
}: {
  activeSection: LocalDashboardSectionKey;
  matterState?: "empty" | "populated";
  navigationSections: OpenPracticeSidebarNavigationSection[];
  navIcons: Record<LocalDashboardSectionKey, LucideIcon>;
  onSelectSection: (section: LocalDashboardSectionKey) => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<OpenPracticeRouteArea, boolean>>({
    workspace: false,
    finance: false,
    operations: false,
    review: false,
  });

  const toggleGroup = (area: OpenPracticeRouteArea) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [area]: !prev[area],
    }));
  };

  const groupedNavigationSections = navigationAreaOrder
    .map((area) => ({
      area,
      sections: navigationSections.filter((section) => section.area === area),
    }))
    .filter((group) => group.sections.length > 0);

  const sidebarClassName = [
    "sidebar",
    "dashboard-sidebar",
    matterState === "empty" ? "zero-matter-sidebar" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={sidebarClassName} data-matter-state={matterState} aria-label="Primary">
      <div className="brand dashboard-brand">
        <span className="brand-mark">OP</span>
        <div>
          <strong>Open Practice</strong>
          <span>Apache-2.0 core</span>
        </div>
      </div>

      <nav className="nav-list grouped-nav-list" aria-label="Dashboard sections">
        {groupedNavigationSections.map((group) => {
          const isCollapsed = collapsedGroups[group.area];
          const groupLabel = navigationAreaLabels[group.area];
          const groupContentId = `nav-area-${group.area}-items`;
          const groupToggleLabel = isCollapsed
            ? `Expand ${groupLabel} navigation`
            : `Collapse ${groupLabel} navigation`;
          return (
            <section
              className={`nav-group ${isCollapsed ? "collapsed" : ""}`}
              key={group.area}
              aria-labelledby={`nav-area-${group.area}`}
            >
              <button
                className="nav-group-header-btn"
                onClick={() => toggleGroup(group.area)}
                type="button"
                aria-controls={groupContentId}
                aria-expanded={!isCollapsed}
                aria-label={groupToggleLabel}
                title={groupToggleLabel}
              >
                <span className="nav-group-label" id={`nav-area-${group.area}`}>
                  {groupLabel}
                </span>
                {isCollapsed ? (
                  <ChevronRight size={14} className="collapse-icon" />
                ) : (
                  <ChevronDown size={14} className="collapse-icon" />
                )}
              </button>

              {!isCollapsed && (
                <div className="nav-group-items" id={groupContentId}>
                  {group.sections.map(({ key, label, title, enabled, disabledReason }) => {
                    const Icon = navIcons[key];
                    const resolvedDisabledReason = describeDisabledNavigationReason({
                      key,
                      label,
                      enabled,
                      disabledReason,
                    });
                    const disabledReasonId = `nav-disabled-${key}`;
                    return (
                      <button
                        aria-current={key === activeSection ? "page" : undefined}
                        aria-describedby={resolvedDisabledReason ? disabledReasonId : undefined}
                        className={[
                          "nav-item",
                          key === activeSection ? "active" : "",
                          enabled ? "" : "disabled",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        disabled={!enabled}
                        key={key}
                        onClick={() => {
                          if (enabled) onSelectSection(key);
                        }}
                        title={resolvedDisabledReason ?? title}
                        type="button"
                      >
                        <Icon size={18} />
                        <span>
                          <strong>{label}</strong>
                          {resolvedDisabledReason ? (
                            <small className="nav-disabled-reason" id={disabledReasonId}>
                              {resolvedDisabledReason}
                            </small>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
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
  isContextRailCollapsed = false,
  onToggleContextRail,
  reviewRailToggleRef,
}: {
  firmName: string;
  session: SessionResponse;
  formatProfessionalRole: (role: SessionResponse["user"]["role"]) => string;
  isContextRailCollapsed?: boolean;
  onToggleContextRail?: () => void;
  reviewRailToggleRef?: RefObject<HTMLButtonElement | null>;
}) {
  const reviewRailToggleLabel = isContextRailCollapsed ? "Show review tools" : "Hide review tools";
  const reviewRailToggleTitle = isContextRailCollapsed
    ? "Show review tools (prospective checks and queues)"
    : "Hide review tools";

  return (
    <header className="topbar dashboard-topbar">
      <div className="topbar-heading">
        <p className="eyebrow">BC / Ontario / Canada small-practice workspace</p>
        <h1 id="dashboard-title">{firmName}</h1>
      </div>
      <div className="topbar-actions-container">
        {onToggleContextRail && (
          <button
            className={`context-rail-toggle-btn ${isContextRailCollapsed ? "collapsed" : ""}`}
            onClick={onToggleContextRail}
            ref={reviewRailToggleRef}
            type="button"
            aria-controls={dashboardReviewRailId}
            aria-expanded={!isContextRailCollapsed}
            aria-label="Toggle review tools"
            title={reviewRailToggleTitle}
          >
            {isContextRailCollapsed ? <PanelRight size={19} /> : <PanelRightClose size={19} />}
            <span>{reviewRailToggleLabel}</span>
          </button>
        )}
        <div className="user-pill topbar-user-pill">
          <span>{session.user.displayName}</span>
          <strong>{formatProfessionalRole(session.user.role)}</strong>
        </div>
      </div>
    </header>
  );
}

export function DashboardReviewRailExpandHandle({
  expandHandleRef,
  onExpand,
}: {
  expandHandleRef?: RefObject<HTMLButtonElement | null>;
  onExpand: () => void;
}) {
  return (
    <button
      className="context-rail-toggle-handle"
      onClick={onExpand}
      ref={expandHandleRef}
      type="button"
      aria-controls={dashboardReviewRailId}
      aria-expanded="false"
      aria-label="Open review tools"
      title="Open review tools"
    >
      <PanelRight size={18} aria-hidden="true" />
    </button>
  );
}

export function DashboardReviewRailCollapsedTarget() {
  return (
    <section
      aria-label="Matter review tools"
      className="context-rail-placeholder"
      data-review-rail-state="collapsed"
      id={dashboardReviewRailId}
      role="region"
    >
      <p>Review tools are collapsed.</p>
    </section>
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
  navigationSections,
  operationalFocus,
  operationalFocusEmpty,
  onOpenQueues,
  onSelectSection,
}: {
  navigationSections?: OpenPracticeSidebarNavigationSection[];
  operationalFocus: OperationalFocusSummary;
  operationalFocusEmpty?: string;
  onOpenQueues: () => void;
  onSelectSection?: (section: LocalDashboardSectionKey) => void;
}) {
  const enabledNavigationSections = new Set(
    (navigationSections ?? []).filter((section) => section.enabled).map((section) => section.key),
  );

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
        {operationalFocus.items.map((item) => {
          const actionableItem = item as ActionableOperationalFocusItem;
          const targetSection =
            actionableItem.targetSection &&
            enabledNavigationSections.has(actionableItem.targetSection)
              ? actionableItem.targetSection
              : undefined;
          const className = `operational-focus-item ${focusItemToneClass(item.tone)}`;
          const itemContent = (
            <>
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
            </>
          );

          if (targetSection && onSelectSection) {
            return (
              <button
                aria-label={`Open ${item.label}`}
                className={className}
                key={item.key}
                onClick={() => onSelectSection(targetSection)}
                type="button"
              >
                {itemContent}
              </button>
            );
          }

          return (
            <article className={className} key={item.key}>
              {itemContent}
            </article>
          );
        })}
        {operationalFocusEmpty ? <p className="inline-empty">{operationalFocusEmpty}</p> : null}
      </div>
    </section>
  );
}

export function MatterContextPanel({
  activeMatter,
  activeSavedMatterViewId,
  archivingSavedMatterViewId,
  filteredMatters,
  formatSavedMatterViewDefinition,
  matterSearch,
  matterPresetOptions,
  onArchiveSavedMatterView,
  onApplySavedMatterView,
  onMatterSearchChange,
  onMatterPresetFamilyChange,
  onSelectMatter,
  onSaveMatterView,
  savedMatterViewDefinitions,
  savedMatterViewStatus,
  savingMatterView,
  selectedMatterPresetFamily,
}: {
  activeMatter: MatterSummary;
  activeSavedMatterViewId?: string;
  archivingSavedMatterViewId?: string;
  filteredMatters: MatterSummary[];
  formatSavedMatterViewDefinition: (definition: SavedOperationalViewDefinition) => string;
  matterSearch: string;
  matterPresetOptions: SavedMatterPresetDefinition[];
  onArchiveSavedMatterView: (definition: SavedOperationalViewDefinition) => void;
  onApplySavedMatterView: (definition: SavedOperationalViewDefinition) => void;
  onMatterSearchChange: (value: string) => void;
  onMatterPresetFamilyChange: (family: SavedMatterPresetFamily) => void;
  onSelectMatter: (matterId: string) => void;
  onSaveMatterView: () => void;
  savedMatterViewDefinitions: SavedOperationalViewDefinition[];
  savedMatterViewStatus: string;
  savingMatterView: boolean;
  selectedMatterPresetFamily: SavedMatterPresetFamily;
}) {
  const visibleMatterLimit = 4;
  const visibleMatters = filteredMatters.slice(0, visibleMatterLimit);
  const hiddenMatterCount = Math.max(filteredMatters.length - visibleMatters.length, 0);
  const activeMatterVisible = visibleMatters.some((matter) => matter.id === activeMatter.id);

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
      <div className="active-matter-card" aria-label="Selected matter">
        <span>
          <small>Selected matter</small>
          <strong>{activeMatter.title}</strong>
          <small>
            {activeMatter.number} · {activeMatter.practiceArea} · {activeMatter.jurisdiction}
          </small>
        </span>
        <em>{activeMatter.status}</em>
      </div>
      <div className="matter-strip">
        {!activeMatterVisible && filteredMatters.length > 0 ? (
          <button
            aria-current="true"
            className="matter-row selected"
            key={activeMatter.id}
            onClick={() => onSelectMatter(activeMatter.id)}
            type="button"
          >
            <span>
              <strong>{activeMatter.title}</strong>
              <small>
                {activeMatter.number} · {activeMatter.practiceArea}
              </small>
            </span>
            <em>{activeMatter.status}</em>
          </button>
        ) : null}
        {visibleMatters.map((matter) => (
          <button
            aria-current={matter.id === activeMatter.id ? "true" : undefined}
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
      {hiddenMatterCount > 0 ? (
        <p className="matter-result-note">
          Showing {visibleMatters.length} of {filteredMatters.length} accessible matters. Refine
          search to narrow the list.
        </p>
      ) : null}
      <details className="saved-matter-views">
        <summary>
          <span>
            <strong>Saved matter views</strong>
            <small>{savedMatterViewDefinitions.length} active</small>
          </span>
        </summary>
        <div className="section-title compact-section-title">
          <h3>Preset focus</h3>
          <div className="matter-view-preset-actions">
            <label className="search-field compact matter-view-preset-select">
              <span>Preset</span>
              <select
                aria-label="Saved matter view preset"
                onChange={(event) =>
                  onMatterPresetFamilyChange(event.target.value as SavedMatterPresetFamily)
                }
                value={selectedMatterPresetFamily}
              >
                {matterPresetOptions.map((preset) => (
                  <option key={preset.family} value={preset.family}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button compact-button row-button"
              disabled={savingMatterView}
              onClick={onSaveMatterView}
              type="button"
            >
              <Save aria-hidden="true" size={16} />
              {savingMatterView ? "Saving" : "Save view"}
            </button>
          </div>
        </div>
        <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
          {savedMatterViewStatus}
        </p>
        <div className="party-list matter-saved-view-list">
          {savedMatterViewDefinitions.map((definition) => (
            <div className="party-row" key={definition.id}>
              <span>
                <strong>{definition.name}</strong>
                <small>{formatSavedMatterViewDefinition(definition)}</small>
              </span>
              <span className="row-actions">
                <button
                  aria-label={`Apply ${definition.name}`}
                  className="secondary-button compact-button row-button"
                  disabled={activeSavedMatterViewId === definition.id}
                  onClick={() => onApplySavedMatterView(definition)}
                  type="button"
                >
                  <Clock3 aria-hidden="true" size={16} />
                  {activeSavedMatterViewId === definition.id ? "Applied" : "Apply"}
                </button>
                <button
                  aria-label={`Archive ${definition.name}`}
                  className="secondary-button compact-button row-button"
                  disabled={archivingSavedMatterViewId === definition.id}
                  onClick={() => onArchiveSavedMatterView(definition)}
                  type="button"
                >
                  <X aria-hidden="true" size={16} />
                  {archivingSavedMatterViewId === definition.id ? "Archiving" : "Archive"}
                </button>
              </span>
            </div>
          ))}
          {savedMatterViewDefinitions.length === 0 ? (
            <p className="inline-empty">No saved matter views are active.</p>
          ) : null}
        </div>
      </details>
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
    <aside
      className="context-rail matter-context-rail"
      id={dashboardReviewRailId}
      aria-label="Matter review tools"
    >
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
