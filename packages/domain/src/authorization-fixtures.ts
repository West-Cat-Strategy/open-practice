import type { Action, ResourceKind } from "./permissions.js";

export type AuthorizationFixtureFamily = "matter" | "contact" | "document" | "job" | "portal_link";

export type AuthorizationFixtureRelation =
  | "firm_wide_reviewer"
  | "assigned_matter_staff"
  | "unassigned_matter_staff"
  | "standalone_contact_creator"
  | "external_portal_contact"
  | "account_bound_portal_grant_holder"
  | "public_share_token_holder"
  | "expired_public_share_token_holder"
  | "revoked_public_share_token_holder"
  | "unverified_public_share_token_holder";

export type AuthorizationFixtureDecision = "allow" | "deny";

export interface AuthorizationFixtureCase {
  id: string;
  family: AuthorizationFixtureFamily;
  resource: ResourceKind;
  action: Action;
  relation: AuthorizationFixtureRelation;
  expectedDecision: AuthorizationFixtureDecision;
  listVisible: boolean;
  subjectId: string;
  matterId?: string;
  contactId?: string;
  resourceId?: string;
  rationale: string;
}

export const authorizationRelationVocabulary: Record<AuthorizationFixtureRelation, string> = {
  firm_wide_reviewer:
    "Owner administrators and auditors can review firm-wide records without matter assignment.",
  assigned_matter_staff:
    "Staff with a role permission and matching matter assignment can see matter-scoped records.",
  unassigned_matter_staff:
    "Staff with a role permission but no matching assignment cannot see matter-scoped records.",
  standalone_contact_creator:
    "Staff can list their own unlinked standalone contacts without widening matter-scoped records.",
  external_portal_contact:
    "Client-external users are limited to active portal grants for their contact and matter.",
  account_bound_portal_grant_holder:
    "Client portal file visibility requires an active grant bound to the portal account.",
  public_share_token_holder:
    "Valid public share tokens expose only safe document metadata for the linked matter.",
  expired_public_share_token_holder:
    "Expired public share tokens are hidden and logged as denied public access.",
  revoked_public_share_token_holder:
    "Revoked public share tokens are hidden and logged as denied public access.",
  unverified_public_share_token_holder:
    "Email-verified share links deny public reads until verification completes.",
};

export const authorizationFixtureCases: AuthorizationFixtureCase[] = [
  {
    id: "matter:firm-wide:list-all",
    family: "matter",
    resource: "matter",
    action: "read",
    relation: "firm_wide_reviewer",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "user-admin",
    rationale: "Firm-wide reviewers can list the full synthetic matter set.",
  },
  {
    id: "matter:assigned:list-visible",
    family: "matter",
    resource: "matter",
    action: "read",
    relation: "assigned_matter_staff",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "user-licensee",
    matterId: "matter-001",
    resourceId: "matter-001",
    rationale: "Assigned staff can read and list their assigned matter.",
  },
  {
    id: "matter:unassigned:list-hidden",
    family: "matter",
    resource: "matter",
    action: "read",
    relation: "unassigned_matter_staff",
    expectedDecision: "deny",
    listVisible: false,
    subjectId: "user-licensee",
    matterId: "matter-002",
    resourceId: "matter-002",
    rationale: "Matter-scoped staff cannot read or list unassigned matter records.",
  },
  {
    id: "contact:firm-wide:list-all",
    family: "contact",
    resource: "contact",
    action: "read",
    relation: "firm_wide_reviewer",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "user-admin",
    resourceId: "contact-northstar",
    rationale: "Firm-wide reviewers can list all synthetic contact dossiers.",
  },
  {
    id: "contact:assigned:client-visible",
    family: "contact",
    resource: "contact",
    action: "read",
    relation: "assigned_matter_staff",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "user-licensee",
    matterId: "matter-001",
    resourceId: "contact-ada",
    rationale: "Assigned staff can list the client contact linked through their visible matter.",
  },
  {
    id: "contact:assigned:counterparty-visible",
    family: "contact",
    resource: "contact",
    action: "read",
    relation: "assigned_matter_staff",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "user-licensee",
    matterId: "matter-001",
    resourceId: "contact-river",
    rationale:
      "Assigned staff can list the counterparty contact linked through their visible matter.",
  },
  {
    id: "contact:unassigned:list-hidden",
    family: "contact",
    resource: "contact",
    action: "read",
    relation: "unassigned_matter_staff",
    expectedDecision: "allow",
    listVisible: false,
    subjectId: "user-licensee",
    matterId: "matter-002",
    resourceId: "contact-northstar",
    rationale:
      "Staff with route-level contact read access do not list contacts linked only to unassigned matters.",
  },
  {
    id: "contact:standalone-creator:list-visible",
    family: "contact",
    resource: "contact",
    action: "read",
    relation: "standalone_contact_creator",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "user-staff",
    resourceId: "contact-standalone-creator",
    rationale: "Staff can list their own standalone contact when it is not linked to a matter.",
  },
  {
    id: "contact:portal-client:staff-list-denied",
    family: "contact",
    resource: "contact",
    action: "read",
    relation: "external_portal_contact",
    expectedDecision: "deny",
    listVisible: false,
    subjectId: "client-ada",
    matterId: "matter-001",
    contactId: "contact-ada",
    resourceId: "contact-ada",
    rationale: "Client-external portal users cannot access staff contact dossier/list routes.",
  },
  {
    id: "document:assigned:read-visible",
    family: "document",
    resource: "document",
    action: "read",
    relation: "assigned_matter_staff",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "user-licensee",
    matterId: "matter-001",
    resourceId: "doc-shareable-001",
    rationale: "Assigned staff can read matter documents through existing matter-scope checks.",
  },
  {
    id: "document:unassigned:read-hidden",
    family: "document",
    resource: "document",
    action: "read",
    relation: "unassigned_matter_staff",
    expectedDecision: "deny",
    listVisible: false,
    subjectId: "user-licensee",
    matterId: "matter-002",
    resourceId: "doc-hidden-002",
    rationale: "Documents inherit matter-scope visibility and are hidden outside assignment.",
  },
  {
    id: "document:portal-grant:metadata-visible",
    family: "document",
    resource: "document",
    action: "read",
    relation: "account_bound_portal_grant_holder",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "client-ada",
    matterId: "matter-001",
    contactId: "contact-ada",
    resourceId: "doc-portal-visible-001",
    rationale: "Account-bound portal grants expose only explicit per-file metadata.",
  },
  {
    id: "job:firm-wide:no-matter-visible",
    family: "job",
    resource: "job",
    action: "read",
    relation: "firm_wide_reviewer",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "user-admin",
    resourceId: "job-firm-wide-report",
    rationale: "Firm-wide reviewers can inspect redacted lifecycle jobs without matter metadata.",
  },
  {
    id: "job:assigned:matter-job-visible",
    family: "job",
    resource: "job",
    action: "read",
    relation: "assigned_matter_staff",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "user-licensee",
    matterId: "matter-001",
    resourceId: "job-assigned",
    rationale: "Matter-scoped staff can list jobs whose safe metadata names an assigned matter.",
  },
  {
    id: "job:unassigned:matter-job-hidden",
    family: "job",
    resource: "job",
    action: "read",
    relation: "unassigned_matter_staff",
    expectedDecision: "deny",
    listVisible: false,
    subjectId: "user-licensee",
    matterId: "matter-002",
    resourceId: "job-unassigned",
    rationale: "Matter-scoped job lists skip jobs for unassigned matters instead of leaking them.",
  },
  {
    id: "job:unassigned:no-matter-hidden",
    family: "job",
    resource: "job",
    action: "read",
    relation: "unassigned_matter_staff",
    expectedDecision: "deny",
    listVisible: false,
    subjectId: "user-licensee",
    resourceId: "job-firm-wide-report",
    rationale: "Non-admin job readers do not see jobs that lack safe matter metadata.",
  },
  {
    id: "portal-link:public-share:metadata-visible",
    family: "portal_link",
    resource: "share_link",
    action: "read",
    relation: "public_share_token_holder",
    expectedDecision: "allow",
    listVisible: true,
    subjectId: "public-share-token",
    matterId: "matter-001",
    resourceId: "share-link-active",
    rationale: "Valid share tokens list sanitized share and document metadata only.",
  },
  {
    id: "portal-link:expired-share:hidden",
    family: "portal_link",
    resource: "share_link",
    action: "read",
    relation: "expired_public_share_token_holder",
    expectedDecision: "deny",
    listVisible: false,
    subjectId: "expired-share-token",
    matterId: "matter-001",
    resourceId: "share-link-expired",
    rationale: "Expired share tokens return a hidden result and record an expired outcome.",
  },
  {
    id: "portal-link:revoked-share:hidden",
    family: "portal_link",
    resource: "share_link",
    action: "read",
    relation: "revoked_public_share_token_holder",
    expectedDecision: "deny",
    listVisible: false,
    subjectId: "revoked-share-token",
    matterId: "matter-001",
    resourceId: "share-link-revoked",
    rationale: "Revoked share tokens return a hidden result and record a revoked outcome.",
  },
  {
    id: "portal-link:email-unverified:denied",
    family: "portal_link",
    resource: "share_link",
    action: "read",
    relation: "unverified_public_share_token_holder",
    expectedDecision: "deny",
    listVisible: false,
    subjectId: "email-verification-share-token",
    matterId: "matter-001",
    resourceId: "share-link-email-verification",
    rationale: "Email-verification share links deny reads until the verification code is accepted.",
  },
];
