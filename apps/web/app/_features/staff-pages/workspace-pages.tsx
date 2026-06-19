import type { Metadata } from "next";
import { StaffPage, type StaffPageDefinition, type StaffPageSearchParams } from "./shared";

export type WorkspaceStaffPageKey =
  | "matters"
  | "contacts"
  | "communications"
  | "documents"
  | "research"
  | "drafting"
  | "calendar";

type WorkspaceStaffPageComponentName =
  | "WorkspaceMattersPage"
  | "WorkspaceContactsPage"
  | "WorkspaceCommunicationsPage"
  | "WorkspaceDocumentsPage"
  | "WorkspaceResearchPage"
  | "WorkspaceDraftingPage"
  | "WorkspaceCalendarPage";

export interface WorkspaceStaffPageDefinition {
  key: WorkspaceStaffPageKey;
  sectionKey: StaffPageDefinition["sectionKey"];
  componentName: WorkspaceStaffPageComponentName;
  title: string;
  shortLabel: string;
  canonicalPath: `/workspace/${WorkspaceStaffPageKey}`;
  currentDashboardHref: `/?section=${string}`;
  currentDashboardLabel: string;
  scopeLabel: string;
  contextLabel: string;
  primarySurface: string;
}

interface WorkspaceStaffPageProps {
  searchParams?: StaffPageSearchParams;
}

export const workspaceStaffPageDefinitions = {
  matters: {
    key: "matters",
    sectionKey: "matters",
    componentName: "WorkspaceMattersPage",
    title: "Matters",
    shortLabel: "Matters",
    canonicalPath: "/workspace/matters",
    currentDashboardHref: "/?section=matters",
    currentDashboardLabel: "Matter command center",
    scopeLabel: "Firm workspace",
    contextLabel: "Selected matter",
    primarySurface: "Matter setup, activity, lifecycle, and linked work queues",
  },
  contacts: {
    key: "contacts",
    sectionKey: "contacts",
    componentName: "WorkspaceContactsPage",
    title: "Contacts",
    shortLabel: "Contacts",
    canonicalPath: "/workspace/contacts",
    currentDashboardHref: "/?section=contacts",
    currentDashboardLabel: "Contacts workspace",
    scopeLabel: "Firm workspace",
    contextLabel: "Visible contacts",
    primarySurface: "CRM dossiers, timelines, quality cues, and contact-linked matters",
  },
  communications: {
    key: "communications",
    sectionKey: "communications",
    componentName: "WorkspaceCommunicationsPage",
    title: "Communications",
    shortLabel: "Comms",
    canonicalPath: "/workspace/communications",
    currentDashboardHref: "/?section=communications",
    currentDashboardLabel: "Matter communications",
    scopeLabel: "Matter workspace",
    contextLabel: "Selected matter",
    primarySurface: "Client communication history, delivery state, and unscoped inbound review",
  },
  documents: {
    key: "documents",
    sectionKey: "documents",
    componentName: "WorkspaceDocumentsPage",
    title: "Documents",
    shortLabel: "Documents",
    canonicalPath: "/workspace/documents",
    currentDashboardHref: "/?section=documents",
    currentDashboardLabel: "Documents workspace",
    scopeLabel: "Matter workspace",
    contextLabel: "Selected matter",
    primarySurface: "Document metadata, processing, assembly, and portal visibility",
  },
  research: {
    key: "research",
    sectionKey: "research",
    componentName: "WorkspaceResearchPage",
    title: "Research",
    shortLabel: "Research",
    canonicalPath: "/workspace/research",
    currentDashboardHref: "/?section=research",
    currentDashboardLabel: "Research workspace",
    scopeLabel: "Matter workspace",
    contextLabel: "Selected matter",
    primarySurface: "Research artifacts, citation review, and provider job posture",
  },
  drafting: {
    key: "drafting",
    sectionKey: "drafting",
    componentName: "WorkspaceDraftingPage",
    title: "Drafting",
    shortLabel: "Drafting",
    canonicalPath: "/workspace/drafting",
    currentDashboardHref: "/?section=drafting",
    currentDashboardLabel: "Drafting workspace",
    scopeLabel: "Matter workspace",
    contextLabel: "Selected matter",
    primarySurface: "Templates, matter drafts, assist review, and export-ready output",
  },
  calendar: {
    key: "calendar",
    sectionKey: "calendar",
    componentName: "WorkspaceCalendarPage",
    title: "Calendar",
    shortLabel: "Calendar",
    canonicalPath: "/workspace/calendar",
    currentDashboardHref: "/?section=calendar",
    currentDashboardLabel: "Calendar radar",
    scopeLabel: "Mixed workspace",
    contextLabel: "Firm, client, or matter",
    primarySurface: "Calendar events, reminders, scheduling requests, and meeting handoff",
  },
} satisfies Record<WorkspaceStaffPageKey, WorkspaceStaffPageDefinition>;

export const workspaceStaffPageMetadata = {
  matters: buildWorkspaceStaffPageMetadata(workspaceStaffPageDefinitions.matters),
  contacts: buildWorkspaceStaffPageMetadata(workspaceStaffPageDefinitions.contacts),
  communications: buildWorkspaceStaffPageMetadata(workspaceStaffPageDefinitions.communications),
  documents: buildWorkspaceStaffPageMetadata(workspaceStaffPageDefinitions.documents),
  research: buildWorkspaceStaffPageMetadata(workspaceStaffPageDefinitions.research),
  drafting: buildWorkspaceStaffPageMetadata(workspaceStaffPageDefinitions.drafting),
  calendar: buildWorkspaceStaffPageMetadata(workspaceStaffPageDefinitions.calendar),
} satisfies Record<WorkspaceStaffPageKey, Metadata>;

function buildWorkspaceStaffPageMetadata(definition: WorkspaceStaffPageDefinition): Metadata {
  return {
    title: `${definition.title} | Open Practice Workspace`,
  };
}

export function WorkspaceMattersPage({ searchParams }: WorkspaceStaffPageProps = {}) {
  return (
    <StaffPage definition={workspaceStaffPageDefinitions.matters} searchParams={searchParams} />
  );
}

export function WorkspaceContactsPage({ searchParams }: WorkspaceStaffPageProps = {}) {
  return (
    <StaffPage definition={workspaceStaffPageDefinitions.contacts} searchParams={searchParams} />
  );
}

export function WorkspaceCommunicationsPage({ searchParams }: WorkspaceStaffPageProps = {}) {
  return (
    <StaffPage
      definition={workspaceStaffPageDefinitions.communications}
      searchParams={searchParams}
    />
  );
}

export function WorkspaceDocumentsPage({ searchParams }: WorkspaceStaffPageProps = {}) {
  return (
    <StaffPage definition={workspaceStaffPageDefinitions.documents} searchParams={searchParams} />
  );
}

export function WorkspaceResearchPage({ searchParams }: WorkspaceStaffPageProps = {}) {
  return (
    <StaffPage definition={workspaceStaffPageDefinitions.research} searchParams={searchParams} />
  );
}

export function WorkspaceDraftingPage({ searchParams }: WorkspaceStaffPageProps = {}) {
  return (
    <StaffPage definition={workspaceStaffPageDefinitions.drafting} searchParams={searchParams} />
  );
}

export function WorkspaceCalendarPage({ searchParams }: WorkspaceStaffPageProps = {}) {
  return (
    <StaffPage definition={workspaceStaffPageDefinitions.calendar} searchParams={searchParams} />
  );
}
