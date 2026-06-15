import type { CalendarAttendeeRole, PartyRole, PortalGrant, ProfessionalRole } from "./models.js";

export type { CalendarAttendeeRole, PartyRole, ProfessionalRole } from "./models.js";

export type ParticipantRoleFamily =
  | "workspace_access"
  | "matter_assignment"
  | "matter_party"
  | "portal_access"
  | "signature"
  | "document_upload"
  | "calendar"
  | "workflow";

export type ParticipantRoleAudience = "internal" | "external" | "mixed";

export interface ParticipantRoleDescriptor {
  key: string;
  family: ParticipantRoleFamily;
  value: string;
  label: string;
  shortLabel: string;
  description: string;
  audience: ParticipantRoleAudience;
  matterScoped: boolean;
}

export type PortalPermission = PortalGrant["permissions"][number];

const workflowParticipantRoleVocabulary = {
  owner: {
    key: "owner",
    family: "matter_assignment",
    value: "owner",
    label: "Owner",
    shortLabel: "Owner",
    description: "Primary internal person accountable for setup or matter coordination.",
    audience: "internal",
    matterScoped: true,
  },
  assignee: {
    key: "assignee",
    family: "matter_assignment",
    value: "assignee",
    label: "Assignee",
    shortLabel: "Assignee",
    description: "Internal person assigned to carry work for a matter-scoped task or item.",
    audience: "internal",
    matterScoped: true,
  },
  reviewer: {
    key: "reviewer",
    family: "workflow",
    value: "reviewer",
    label: "Reviewer",
    shortLabel: "Reviewer",
    description: "Internal person responsible for review, approval, or quality control.",
    audience: "internal",
    matterScoped: true,
  },
  follower: {
    key: "follower",
    family: "workflow",
    value: "follower",
    label: "Follower",
    shortLabel: "Follower",
    description: "Internal person watching a matter-scoped item without owning the next action.",
    audience: "internal",
    matterScoped: true,
  },
  external_party: {
    key: "external_party",
    family: "workflow",
    value: "external_party",
    label: "External party",
    shortLabel: "External",
    description:
      "External participant connected to a matter, portal flow, or provider-neutral workflow.",
    audience: "external",
    matterScoped: true,
  },
} as const satisfies Record<string, ParticipantRoleDescriptor>;

const professionalRoleVocabulary = {
  owner_admin: {
    key: "owner_admin",
    family: "workspace_access",
    value: "owner_admin",
    label: "Owner/admin",
    shortLabel: "Owner",
    description: "Internal administrator with firm setup and cross-matter operational access.",
    audience: "internal",
    matterScoped: false,
  },
  licensee: {
    key: "licensee",
    family: "workspace_access",
    value: "licensee",
    label: "Licensee",
    shortLabel: "Licensee",
    description: "Internal legal professional working on assigned matter-scoped records.",
    audience: "internal",
    matterScoped: true,
  },
  firm_member: {
    key: "firm_member",
    family: "workspace_access",
    value: "firm_member",
    label: "Firm member",
    shortLabel: "Member",
    description: "Internal staff member with access limited by role and matter assignment.",
    audience: "internal",
    matterScoped: true,
  },
  billing_bookkeeper: {
    key: "billing_bookkeeper",
    family: "workspace_access",
    value: "billing_bookkeeper",
    label: "Billing bookkeeper",
    shortLabel: "Billing",
    description: "Internal billing participant with finance-focused operational access.",
    audience: "internal",
    matterScoped: false,
  },
  client_external: {
    key: "client_external",
    family: "workspace_access",
    value: "client_external",
    label: "External portal user",
    shortLabel: "Portal user",
    description: "External participant whose access is limited to active matter portal grants.",
    audience: "external",
    matterScoped: true,
  },
  auditor: {
    key: "auditor",
    family: "workspace_access",
    value: "auditor",
    label: "Auditor",
    shortLabel: "Auditor",
    description: "Internal audit participant with read and export access for review workflows.",
    audience: "internal",
    matterScoped: false,
  },
} as const satisfies Record<ProfessionalRole, ParticipantRoleDescriptor>;

const matterPartyRoleVocabulary = {
  client: {
    key: "client",
    family: "matter_party",
    value: "client",
    label: "Client",
    shortLabel: "Client",
    description: "Matter party represented or served by the firm in the matter.",
    audience: "external",
    matterScoped: true,
  },
  prospective_client: {
    key: "prospective_client",
    family: "matter_party",
    value: "prospective_client",
    label: "Prospective client",
    shortLabel: "Prospect",
    description: "Potential client connected to intake, conflict review, or early matter setup.",
    audience: "external",
    matterScoped: true,
  },
  former_client: {
    key: "former_client",
    family: "matter_party",
    value: "former_client",
    label: "Former client",
    shortLabel: "Former client",
    description: "Former client connected to conflict review or historical matter context.",
    audience: "external",
    matterScoped: true,
  },
  opposing_party: {
    key: "opposing_party",
    family: "matter_party",
    value: "opposing_party",
    label: "Opposing party",
    shortLabel: "Opposing",
    description: "Adverse or opposing matter party requiring conflict and confidentiality caution.",
    audience: "external",
    matterScoped: true,
  },
  opposing_counsel: {
    key: "opposing_counsel",
    family: "matter_party",
    value: "opposing_counsel",
    label: "Opposing counsel",
    shortLabel: "Counsel",
    description: "Legal representative for an opposing or adverse matter party.",
    audience: "external",
    matterScoped: true,
  },
  related_party: {
    key: "related_party",
    family: "matter_party",
    value: "related_party",
    label: "Related party",
    shortLabel: "Related",
    description: "Related person or organization that may affect conflicts or representation.",
    audience: "external",
    matterScoped: true,
  },
  witness: {
    key: "witness",
    family: "matter_party",
    value: "witness",
    label: "Witness",
    shortLabel: "Witness",
    description: "Person or organization connected to matter evidence or testimony.",
    audience: "external",
    matterScoped: true,
  },
  court: {
    key: "court",
    family: "matter_party",
    value: "court",
    label: "Court",
    shortLabel: "Court",
    description: "Court, tribunal, registry, or adjudicative body connected to the matter.",
    audience: "external",
    matterScoped: true,
  },
  court_tribunal: {
    key: "court_tribunal",
    family: "matter_party",
    value: "court_tribunal",
    label: "Court or tribunal",
    shortLabel: "Tribunal",
    description: "Court, tribunal, registry, or adjudicative body connected to the matter.",
    audience: "external",
    matterScoped: true,
  },
  lawyer: {
    key: "lawyer",
    family: "matter_party",
    value: "lawyer",
    label: "Lawyer",
    shortLabel: "Lawyer",
    description: "Lawyer connected to a client, opposing party, or related matter participant.",
    audience: "external",
    matterScoped: true,
  },
  paralegal: {
    key: "paralegal",
    family: "matter_party",
    value: "paralegal",
    label: "Paralegal",
    shortLabel: "Paralegal",
    description: "Paralegal connected to a client, opposing party, or legal service workflow.",
    audience: "external",
    matterScoped: true,
  },
  authorized_non_lawyer_provider: {
    key: "authorized_non_lawyer_provider",
    family: "matter_party",
    value: "authorized_non_lawyer_provider",
    label: "Authorized non-lawyer provider",
    shortLabel: "ALSP",
    description: "Authorized non-lawyer legal service provider connected to the matter or client.",
    audience: "external",
    matterScoped: true,
  },
  legal_representative: {
    key: "legal_representative",
    family: "matter_party",
    value: "legal_representative",
    label: "Legal representative",
    shortLabel: "Representative",
    description: "Legal representative acting for a party in the matter.",
    audience: "external",
    matterScoped: true,
  },
  insurer: {
    key: "insurer",
    family: "matter_party",
    value: "insurer",
    label: "Insurer",
    shortLabel: "Insurer",
    description: "Insurance contact connected to coverage, claims, or risk handling.",
    audience: "external",
    matterScoped: true,
  },
  expert: {
    key: "expert",
    family: "matter_party",
    value: "expert",
    label: "Expert",
    shortLabel: "Expert",
    description: "Expert, consultant, or opinion provider connected to the matter.",
    audience: "external",
    matterScoped: true,
  },
  vendor: {
    key: "vendor",
    family: "matter_party",
    value: "vendor",
    label: "Vendor",
    shortLabel: "Vendor",
    description: "Vendor or service provider connected to the matter.",
    audience: "external",
    matterScoped: true,
  },
  referral_source: {
    key: "referral_source",
    family: "matter_party",
    value: "referral_source",
    label: "Referral source",
    shortLabel: "Referral",
    description: "Referral source linked to client intake or matter origin.",
    audience: "external",
    matterScoped: true,
  },
  internal_team_member: {
    key: "internal_team_member",
    family: "matter_party",
    value: "internal_team_member",
    label: "Internal team member",
    shortLabel: "Team",
    description: "Internal team participant represented as a matter contact.",
    audience: "internal",
    matterScoped: true,
  },
  third_party: {
    key: "third_party",
    family: "matter_party",
    value: "third_party",
    label: "Third party",
    shortLabel: "Third party",
    description: "External matter participant that is not the client, counsel, court, or witness.",
    audience: "external",
    matterScoped: true,
  },
  notary_client: {
    key: "notary_client",
    family: "matter_party",
    value: "notary_client",
    label: "Notary client",
    shortLabel: "Notary client",
    description: "Client participant for notarial service workflows.",
    audience: "external",
    matterScoped: true,
  },
  paralegal_client: {
    key: "paralegal_client",
    family: "matter_party",
    value: "paralegal_client",
    label: "Paralegal client",
    shortLabel: "Paralegal client",
    description: "Client participant for paralegal service workflows.",
    audience: "external",
    matterScoped: true,
  },
  other: {
    key: "other",
    family: "matter_party",
    value: "other",
    label: "Other party",
    shortLabel: "Other",
    description: "Other matter contact role requiring staff review.",
    audience: "external",
    matterScoped: true,
  },
} as const satisfies Record<PartyRole, ParticipantRoleDescriptor>;

const genericMatterPartyRoleDescriptor = {
  key: "matter_party",
  family: "matter_party",
  value: "matter_party",
  label: "Matter party",
  shortLabel: "Party",
  description: "Client, adverse, institutional, or other external participant linked to a matter.",
  audience: "external",
  matterScoped: true,
} as const satisfies ParticipantRoleDescriptor;

const calendarAttendeeRoleVocabulary = {
  required: {
    key: "meeting_guest_required",
    family: "calendar",
    value: "required",
    label: "Required guest",
    shortLabel: "Required",
    description: "Meeting guest expected to attend a matter-scoped calendar event.",
    audience: "mixed",
    matterScoped: true,
  },
  optional: {
    key: "meeting_guest_optional",
    family: "calendar",
    value: "optional",
    label: "Optional guest",
    shortLabel: "Optional",
    description: "Meeting guest invited as optional for a matter-scoped calendar event.",
    audience: "mixed",
    matterScoped: true,
  },
} as const satisfies Record<CalendarAttendeeRole, ParticipantRoleDescriptor>;

const genericMeetingGuestRoleDescriptor = {
  key: "meeting_guest",
  family: "calendar",
  value: "meeting_guest",
  label: "Meeting guest",
  shortLabel: "Guest",
  description: "Participant invited to a matter-scoped calendar event.",
  audience: "mixed",
  matterScoped: true,
} as const satisfies ParticipantRoleDescriptor;

const portalContactRoleDescriptor = {
  key: "portal_contact",
  family: "portal_access",
  value: "portal_contact",
  label: "Portal contact",
  shortLabel: "Portal contact",
  description: "External contact with matter-scoped portal access granted by the firm.",
  audience: "external",
  matterScoped: true,
} as const satisfies ParticipantRoleDescriptor;

const externalUploaderRoleDescriptor = {
  key: "uploader",
  family: "document_upload",
  value: "uploader",
  label: "Uploader",
  shortLabel: "Uploader",
  description: "External participant allowed to upload documents through a matter-scoped link.",
  audience: "external",
  matterScoped: true,
} as const satisfies ParticipantRoleDescriptor;

const genericSignerRoleDescriptor = {
  key: "signer",
  family: "signature",
  value: "signer",
  label: "Signer",
  shortLabel: "Signer",
  description:
    "Participant asked to sign a document through a provider-neutral signature workflow.",
  audience: "external",
  matterScoped: true,
} as const satisfies ParticipantRoleDescriptor;

export const participantRoleVocabulary = [
  ...Object.values(workflowParticipantRoleVocabulary),
  ...Object.values(professionalRoleVocabulary),
  genericMatterPartyRoleDescriptor,
  ...Object.values(matterPartyRoleVocabulary),
  genericMeetingGuestRoleDescriptor,
  ...Object.values(calendarAttendeeRoleVocabulary),
  portalContactRoleDescriptor,
  externalUploaderRoleDescriptor,
  genericSignerRoleDescriptor,
] as const satisfies readonly ParticipantRoleDescriptor[];

export function describeWorkflowParticipantRole(
  role: keyof typeof workflowParticipantRoleVocabulary,
): ParticipantRoleDescriptor {
  return workflowParticipantRoleVocabulary[role];
}

export function describeProfessionalRole(role: ProfessionalRole): ParticipantRoleDescriptor {
  return professionalRoleVocabulary[role];
}

export function describeMatterPartyRole(role: PartyRole): ParticipantRoleDescriptor {
  return matterPartyRoleVocabulary[role];
}

export function describeGenericMatterPartyRole(): ParticipantRoleDescriptor {
  return genericMatterPartyRoleDescriptor;
}

export function describeCalendarAttendeeRole(
  role: CalendarAttendeeRole,
): ParticipantRoleDescriptor {
  return calendarAttendeeRoleVocabulary[role];
}

export function describeMeetingGuestRole(): ParticipantRoleDescriptor {
  return genericMeetingGuestRoleDescriptor;
}

export function describePortalContactRole(): ParticipantRoleDescriptor {
  return portalContactRoleDescriptor;
}

export function describeExternalUploaderRole(): ParticipantRoleDescriptor {
  return externalUploaderRoleDescriptor;
}

export function describeSignatureSignerRole(role?: string): ParticipantRoleDescriptor {
  if (!role) return genericSignerRoleDescriptor;
  if (isMatterPartyRole(role)) {
    const partyRole = describeMatterPartyRole(role);
    return signatureDescriptorFor(`${partyRole.label} signer`, partyRole.shortLabel, role);
  }
  return signatureDescriptorFor(`${humanizeRoleValue(role)} signer`, "Signer", role);
}

export function describePortalPermission(permission: PortalPermission): ParticipantRoleDescriptor {
  const labelByPermission = {
    view_matter_summary: "Matter summary viewer",
    view_documents: "Document viewer",
    upload_documents: "Document uploader",
    message: "Portal messenger",
    view_messages: "Message viewer",
    send_messages: "Message sender",
    view_invoices: "Invoice viewer",
    view_appointments_tasks: "Appointments and tasks viewer",
    view_signature_requests: "Signature request viewer",
    complete_intake: "Intake collaborator",
    manage_organization_users: "Organization user manager",
    sign: "Portal signer",
  } as const satisfies Record<PortalPermission, string>;
  const label = labelByPermission[permission];
  return {
    ...portalContactRoleDescriptor,
    key: `portal_${permission}`,
    value: permission,
    label,
    shortLabel: label,
    description: `${portalContactRoleDescriptor.description} Permission: ${humanizeRoleValue(
      permission,
    ).toLowerCase()}.`,
  };
}

function signatureDescriptorFor(
  label: string,
  shortLabel: string,
  value: string,
): ParticipantRoleDescriptor {
  return {
    ...genericSignerRoleDescriptor,
    value,
    label,
    shortLabel,
  };
}

function isMatterPartyRole(role: string): role is PartyRole {
  return role in matterPartyRoleVocabulary;
}

function humanizeRoleValue(value: string): string {
  const words = value
    .trim()
    .replaceAll("-", "_")
    .split("_")
    .filter((word) => word.length > 0);
  if (words.length === 0) return "Participant";
  const label = words.join(" ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}
