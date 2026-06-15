import type {
  ActivityTimelineEntry,
  Contact,
  ContactDataQualityResolutionRecord,
  ContactDossier,
  ContactRelationshipRecord,
  MatterParty,
  PortalGrant,
  User,
} from "@open-practice/domain";

export interface ContactDataQualityResolutionListOptions {
  contactId?: string;
  matterId?: string;
}

export interface ContactListOptions {
  search?: string;
  kind?: Contact["kind"];
  status?: Contact["status"];
  roleCategory?: NonNullable<Contact["roleCategories"]>[number];
  limit?: number;
  offset?: number;
}

export interface ContactUpdateInput {
  firmId: string;
  contactId: string;
  updates: Partial<
    Pick<
      Contact,
      | "kind"
      | "status"
      | "roleCategories"
      | "canonicalName"
      | "displayName"
      | "givenName"
      | "middleName"
      | "familyName"
      | "title"
      | "pronouns"
      | "organizationLegalName"
      | "organizationOperatingName"
      | "organizationRegisteredName"
      | "organizationType"
      | "website"
      | "aliases"
      | "formerNames"
      | "identifiers"
      | "contactMethods"
      | "preferredContactMethodId"
      | "preferredLanguage"
      | "timezone"
      | "communicationNotes"
      | "accessibilityNotes"
      | "privateNotes"
      | "notes"
      | "riskFlags"
      | "conflictSensitive"
      | "adverse"
      | "confidentialityMarker"
      | "doNotContact"
      | "updatedByUserId"
    >
  >;
}

export interface ContactRelationshipUpdateInput {
  firmId: string;
  relationshipId: string;
  updates: Partial<
    Pick<
      ContactRelationshipRecord,
      | "relationshipKind"
      | "label"
      | "reciprocalLabel"
      | "matterId"
      | "source"
      | "status"
      | "effectiveOn"
      | "endedOn"
      | "notes"
      | "privateNotes"
      | "includeInConflictCheck"
      | "updatedByUserId"
    >
  >;
}

export interface MatterContactAssociationUpdateInput {
  firmId: string;
  associationId: string;
  updates: Partial<
    Pick<
      MatterParty,
      | "role"
      | "adverse"
      | "confidential"
      | "status"
      | "side"
      | "startedOn"
      | "endedOn"
      | "notes"
      | "privateNotes"
      | "conflictCheckIncluded"
      | "updatedByUserId"
    >
  >;
}

export interface ContactRepository {
  listContactsForUser(user: User, options?: ContactListOptions): Promise<Contact[]>;
  listContactDossiersForUser(user: User): Promise<ContactDossier[]>;
  createContact(contact: Contact): Promise<Contact>;
  updateContact(input: ContactUpdateInput): Promise<Contact | undefined>;
  createContactRelationship(
    relationship: ContactRelationshipRecord,
  ): Promise<ContactRelationshipRecord>;
  updateContactRelationship(
    input: ContactRelationshipUpdateInput,
  ): Promise<ContactRelationshipRecord | undefined>;
  createMatterContactAssociation(party: MatterParty): Promise<MatterParty>;
  updateMatterContactAssociation(
    input: MatterContactAssociationUpdateInput,
  ): Promise<MatterParty | undefined>;
  getContact(firmId: string, contactId: string): Promise<Contact | undefined>;
  listContactTimelineForUser(user: User, contactId: string): Promise<ActivityTimelineEntry[]>;
  listContactPortalGrantsForUser(user: User, contactId: string): Promise<PortalGrant[]>;
  createContactDataQualityResolution(
    resolution: ContactDataQualityResolutionRecord,
  ): Promise<ContactDataQualityResolutionRecord>;
  listContactDataQualityResolutions(
    firmId: string,
    options?: ContactDataQualityResolutionListOptions,
  ): Promise<ContactDataQualityResolutionRecord[]>;
}
