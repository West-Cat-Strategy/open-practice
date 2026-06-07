import type {
  Contact,
  ContactDataQualityResolutionRecord,
  ContactDossier,
  ContactRelationshipRecord,
  User,
} from "@open-practice/domain";

export interface ContactDataQualityResolutionListOptions {
  contactId?: string;
  matterId?: string;
}

export interface ContactRepository {
  listContactDossiersForUser(user: User): Promise<ContactDossier[]>;
  createContactRelationship(
    relationship: ContactRelationshipRecord,
  ): Promise<ContactRelationshipRecord>;
  getContact(firmId: string, contactId: string): Promise<Contact | undefined>;
  createContactDataQualityResolution(
    resolution: ContactDataQualityResolutionRecord,
  ): Promise<ContactDataQualityResolutionRecord>;
  listContactDataQualityResolutions(
    firmId: string,
    options?: ContactDataQualityResolutionListOptions,
  ): Promise<ContactDataQualityResolutionRecord[]>;
}
