import type {
  DocumentClassification,
  DocumentRecord,
  PortalGrant,
  ProfessionalRole,
  User,
} from "./models.js";

export type ResourceKind =
  | "firm"
  | "contact"
  | "matter"
  | "document"
  | "portal_message"
  | "signature_request"
  | "trust_ledger"
  | "time_entry"
  | "expense_entry"
  | "task"
  | "calendar_event"
  | "audit_log"
  | "intake_session"
  | "job"
  | "email"
  | "inbound_email"
  | "document_processing"
  | "share_link"
  | "external_upload"
  | "auth_credential"
  | "provider_setting"
  | "draft"
  | "draft_template";

export type Action = "create" | "read" | "update" | "delete" | "approve" | "export";

export interface AccessRequest {
  user: User;
  resource: ResourceKind;
  action: Action;
  firmId: string;
  matterId?: string;
  contactId?: string;
  portalGrants?: PortalGrant[];
  now?: string;
}

const rolePermissions: Record<ProfessionalRole, Partial<Record<ResourceKind, Action[]>>> = {
  owner_admin: {
    firm: ["create", "read", "update", "delete", "approve", "export"],
    contact: ["create", "read", "update", "delete", "export"],
    matter: ["create", "read", "update", "delete", "approve", "export"],
    document: ["create", "read", "update", "delete", "approve", "export"],
    portal_message: ["create", "read", "update", "delete", "export"],
    signature_request: ["create", "read", "update", "delete", "approve", "export"],
    trust_ledger: ["create", "read", "approve", "export"],
    time_entry: ["create", "read", "update", "delete", "approve", "export"],
    expense_entry: ["create", "read", "update", "delete", "approve", "export"],
    task: ["create", "read", "update", "delete"],
    calendar_event: ["create", "read", "update", "delete"],
    audit_log: ["read", "export"],
    intake_session: ["create", "read", "update", "delete", "approve", "export"],
    job: ["read", "update", "export"],
    email: ["create", "read", "update", "export"],
    inbound_email: ["create", "read", "update", "delete", "export"],
    document_processing: ["create", "read", "update", "export"],
    share_link: ["create", "read", "update", "delete", "export"],
    external_upload: ["create", "read", "update", "delete", "export"],
    auth_credential: ["create", "read", "update", "delete", "approve"],
    provider_setting: ["create", "read", "update", "delete", "approve", "export"],
    draft: ["create", "read", "update", "delete", "export"],
    draft_template: ["create", "read", "update", "delete", "export"],
  },
  licensee: {
    contact: ["create", "read", "update", "export"],
    matter: ["create", "read", "update", "approve", "export"],
    document: ["create", "read", "update", "delete", "approve", "export"],
    portal_message: ["create", "read", "update", "export"],
    signature_request: ["create", "read", "update", "approve", "export"],
    trust_ledger: ["read", "approve", "export"],
    time_entry: ["create", "read", "update", "delete", "approve", "export"],
    expense_entry: ["create", "read", "update", "delete", "approve", "export"],
    task: ["create", "read", "update", "delete"],
    calendar_event: ["create", "read", "update", "delete"],
    audit_log: ["read"],
    intake_session: ["create", "read", "update", "approve", "export"],
    job: ["read"],
    email: ["create", "read", "update"],
    inbound_email: ["create", "read", "update"],
    document_processing: ["create", "read", "update"],
    share_link: ["create", "read", "update", "delete"],
    external_upload: ["create", "read", "update", "delete"],
    auth_credential: ["create", "read", "update", "delete"],
    draft: ["create", "read", "update", "delete", "export"],
    draft_template: ["create", "read", "update", "export"],
  },
  firm_member: {
    contact: ["create", "read", "update"],
    matter: ["read", "update"],
    document: ["create", "read", "update"],
    portal_message: ["create", "read"],
    signature_request: ["create", "read", "update"],
    time_entry: ["create", "read", "update"],
    expense_entry: ["create", "read", "update"],
    task: ["create", "read", "update", "delete"],
    calendar_event: ["create", "read", "update", "delete"],
    intake_session: ["create", "read", "update"],
    email: ["create", "read"],
    inbound_email: ["read", "update"],
    document_processing: ["create", "read"],
    share_link: ["read"],
    external_upload: ["create", "read"],
    auth_credential: ["read", "update"],
    draft: ["create", "read", "update"],
    draft_template: ["read"],
  },
  billing_bookkeeper: {
    contact: ["read"],
    matter: ["read"],
    trust_ledger: ["create", "read", "export"],
    time_entry: ["create", "read", "update", "approve", "export"],
    expense_entry: ["create", "read", "update", "export"],
    audit_log: ["read"],
    intake_session: ["read"],
    job: ["read"],
    email: ["read"],
    inbound_email: ["read"],
  },
  client_external: {
    document: ["create", "read"],
    portal_message: ["create", "read"],
    signature_request: ["read", "approve"],
    calendar_event: ["read"],
    intake_session: ["read"],
    external_upload: ["create", "read"],
  },
  auditor: {
    firm: ["read"],
    contact: ["read"],
    matter: ["read", "export"],
    document: ["read"],
    signature_request: ["read", "export"],
    trust_ledger: ["read", "export"],
    time_entry: ["read", "export"],
    expense_entry: ["read", "export"],
    audit_log: ["read", "export"],
    intake_session: ["read", "export"],
    job: ["read", "export"],
    email: ["read", "export"],
    inbound_email: ["read", "export"],
    document_processing: ["read", "export"],
    share_link: ["read", "export"],
    external_upload: ["read", "export"],
    auth_credential: ["read"],
    provider_setting: ["read"],
  },
};

const matterScopedResources = new Set<ResourceKind>([
  "matter",
  "document",
  "portal_message",
  "signature_request",
  "trust_ledger",
  "time_entry",
  "expense_entry",
  "task",
  "calendar_event",
  "intake_session",
  "email",
  "inbound_email",
  "document_processing",
  "share_link",
  "external_upload",
  "draft",
]);

const portalPermissionByResourceAction: Partial<
  Record<ResourceKind, Partial<Record<Action, PortalGrant["permissions"][number]>>>
> = {
  document: {
    create: "upload_documents",
    read: "view_documents",
  },
  portal_message: {
    create: "message",
    read: "message",
  },
  external_upload: {
    create: "upload_documents",
    read: "upload_documents",
  },
  signature_request: {
    read: "sign",
    approve: "sign",
  },
};

function hasActivePortalGrant(request: AccessRequest): boolean {
  if (!request.matterId || !request.contactId) return false;

  const requiredPermission = portalPermissionByResourceAction[request.resource]?.[request.action];
  if (!requiredPermission) return false;

  const now = Date.parse(request.now ?? new Date().toISOString());
  return (request.portalGrants ?? []).some((grant) => {
    if (grant.firmId !== request.firmId) return false;
    if (grant.matterId !== request.matterId) return false;
    if (grant.contactId !== request.contactId) return false;
    if (grant.revokedAt) return false;
    if (grant.expiresAt && Date.parse(grant.expiresAt) <= now) return false;
    return grant.permissions.includes(requiredPermission);
  });
}

export function canAccess(request: AccessRequest): boolean {
  if (request.user.firmId !== request.firmId) return false;

  const allowedActions = rolePermissions[request.user.role][request.resource] ?? [];
  if (!allowedActions.includes(request.action)) return false;

  if (request.user.role === "owner_admin" || request.user.role === "auditor") {
    return true;
  }

  if (request.user.role === "billing_bookkeeper" && request.resource === "trust_ledger") {
    return true;
  }

  if (request.user.role === "client_external") {
    return hasActivePortalGrant(request);
  }

  if (matterScopedResources.has(request.resource) && !request.matterId) {
    return false;
  }

  if (request.matterId) {
    return request.user.assignedMatterIds.includes(request.matterId);
  }

  return true;
}

export function assertAccess(request: AccessRequest): void {
  if (!canAccess(request)) {
    throw new Error(
      `Forbidden: ${request.user.displayName} cannot ${request.action} ${request.resource}`,
    );
  }
}

export type DashboardSectionKey =
  | "matters"
  | "funds"
  | "documents"
  | "drafting"
  | "calendar"
  | "billing"
  | "signatures"
  | "intake"
  | "audit";

export interface DashboardSectionCapability {
  key: DashboardSectionKey;
  label: string;
  enabled: boolean;
  resource: ResourceKind;
  actions: Action[];
}

const dashboardSections: Array<{
  key: DashboardSectionKey;
  label: string;
  resource: ResourceKind;
  preferredMatterScopedAction?: Action;
}> = [
  { key: "matters", label: "Matters", resource: "matter", preferredMatterScopedAction: "read" },
  { key: "funds", label: "Funds", resource: "trust_ledger", preferredMatterScopedAction: "read" },
  {
    key: "documents",
    label: "Documents",
    resource: "document",
    preferredMatterScopedAction: "read",
  },
  {
    key: "drafting",
    label: "Drafting",
    resource: "draft",
    preferredMatterScopedAction: "read",
  },
  {
    key: "calendar",
    label: "Calendar",
    resource: "calendar_event",
    preferredMatterScopedAction: "read",
  },
  {
    key: "billing",
    label: "Billing",
    resource: "time_entry",
    preferredMatterScopedAction: "read",
  },
  {
    key: "signatures",
    label: "Signatures",
    resource: "signature_request",
    preferredMatterScopedAction: "read",
  },
  {
    key: "intake",
    label: "Intake",
    resource: "intake_session",
    preferredMatterScopedAction: "read",
  },
  { key: "audit", label: "Audit", resource: "audit_log" },
];

export function dashboardCapabilities(input: {
  user: User;
  firmId: string;
  matterId?: string;
}): DashboardSectionCapability[] {
  return dashboardSections.map((section) => {
    const allowedActions = rolePermissions[input.user.role][section.resource] ?? [];
    const matterId = section.preferredMatterScopedAction ? input.matterId : undefined;
    const enabled = canAccess({
      user: input.user,
      firmId: input.firmId,
      resource: section.resource,
      action: section.preferredMatterScopedAction ?? "read",
      matterId,
    });

    return {
      key: section.key,
      label: section.label,
      enabled,
      resource: section.resource,
      actions: allowedActions,
    };
  });
}

const defaultPortalShareClassifications = new Set<DocumentClassification>([
  "general",
  "financial",
  "identity",
]);

export function canShareDocumentThroughPortal(input: {
  document: DocumentRecord;
  grant: PortalGrant;
  now?: string;
  allowedClassifications?: DocumentClassification[];
}): boolean {
  const allowedClassifications = new Set(
    input.allowedClassifications ?? [...defaultPortalShareClassifications],
  );
  const now = Date.parse(input.now ?? new Date().toISOString());

  if (input.document.firmId !== input.grant.firmId) return false;
  if (input.document.matterId !== input.grant.matterId) return false;
  if (!input.grant.permissions.includes("view_documents")) return false;
  if (input.grant.revokedAt) return false;
  if (input.grant.expiresAt && Date.parse(input.grant.expiresAt) <= now) return false;
  if (input.document.legalHold) return false;
  if (input.document.supersededAt) return false;
  if (!allowedClassifications.has(input.document.classification)) return false;
  if (input.document.uploadStatus !== "verified") return false;
  if (input.document.checksumStatus !== "verified") return false;
  return input.document.scanStatus === "passed" || input.document.scanStatus === "not_required";
}
