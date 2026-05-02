import { describe, expect, it } from "vitest";
import {
  describeCalendarAttendeeRole,
  describeExternalUploaderRole,
  describeGenericMatterPartyRole,
  describeMatterPartyRole,
  describeMeetingGuestRole,
  describePortalContactRole,
  describePortalPermission,
  describeProfessionalRole,
  describeSignatureSignerRole,
  describeWorkflowParticipantRole,
  participantRoleVocabulary,
} from "./participant-roles.js";

describe("participant role vocabulary", () => {
  it("describes core workflow roles with matter-scoped metadata", () => {
    expect(describeWorkflowParticipantRole("owner")).toMatchObject({
      label: "Owner",
      family: "matter_assignment",
      audience: "internal",
      matterScoped: true,
    });
    expect(describeWorkflowParticipantRole("assignee").description).toContain("matter-scoped");
    expect(describeWorkflowParticipantRole("reviewer").label).toBe("Reviewer");
    expect(describeWorkflowParticipantRole("follower").label).toBe("Follower");
    expect(describeWorkflowParticipantRole("external_party")).toMatchObject({
      label: "External party",
      audience: "external",
    });
  });

  it("standardizes existing professional, matter-party, and meeting guest roles", () => {
    expect(describeProfessionalRole("owner_admin")).toMatchObject({
      label: "Owner/admin",
      family: "workspace_access",
      matterScoped: false,
    });
    expect(describeProfessionalRole("client_external")).toMatchObject({
      label: "External portal user",
      audience: "external",
      matterScoped: true,
    });
    expect(describeMatterPartyRole("opposing_party")).toMatchObject({
      label: "Opposing party",
      family: "matter_party",
    });
    expect(describeGenericMatterPartyRole()).toMatchObject({
      label: "Matter party",
      family: "matter_party",
    });
    expect(describeMeetingGuestRole()).toMatchObject({
      label: "Meeting guest",
      family: "calendar",
    });
    expect(describeCalendarAttendeeRole("optional")).toMatchObject({
      label: "Optional guest",
      family: "calendar",
    });
  });

  it("describes portal contacts, uploaders, and signer roles without provider assumptions", () => {
    expect(describePortalContactRole()).toMatchObject({
      label: "Portal contact",
      family: "portal_access",
    });
    expect(describeExternalUploaderRole()).toMatchObject({
      label: "Uploader",
      family: "document_upload",
    });
    expect(describeSignatureSignerRole("client")).toMatchObject({
      label: "Client signer",
      family: "signature",
      value: "client",
    });
    expect(describeSignatureSignerRole("estate_trustee")).toMatchObject({
      label: "Estate trustee signer",
      family: "signature",
      value: "estate_trustee",
    });
    expect(describePortalPermission("upload_documents")).toMatchObject({
      label: "Document uploader",
      family: "portal_access",
      value: "upload_documents",
    });
  });

  it("keeps the published vocabulary unique by family and value", () => {
    const keys = participantRoleVocabulary.map(
      (descriptor) => `${descriptor.family}:${descriptor.value}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(participantRoleVocabulary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "owner_admin", label: "Owner/admin" }),
        expect.objectContaining({ value: "third_party", label: "Third party" }),
        expect.objectContaining({ value: "signer", label: "Signer" }),
      ]),
    );
  });
});
