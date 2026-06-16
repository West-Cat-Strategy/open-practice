import { describe, expect, it } from "vitest";
import type { DocumentRecord, PortalGrant, User } from "./models.js";
import type { JobLifecycleRecord } from "./operations.js";
import {
  authorizationFixtureCases,
  authorizationRelationVocabulary,
} from "./authorization-fixtures.js";
import {
  canReadJobLifecycleRecord,
  canAccess,
  canShareDocumentThroughPortal,
  dashboardCapabilities,
  redactJobMetadata,
} from "./permissions.js";
import { sampleFirm, samplePortalGrants, sampleUsers } from "./sample-data.js";

const baseDocument: DocumentRecord = {
  id: "doc-external-upload",
  firmId: "firm-west-legal",
  matterId: "matter-001",
  title: "External upload.pdf",
  storageKey: "external-uploads/link-001/doc-external-upload.pdf",
  checksumSha256: "a".repeat(64),
  version: 1,
  classification: "general",
  legalHold: false,
  uploadStatus: "verified",
  checksumStatus: "verified",
  scanStatus: "passed",
  reviewStatus: "not_required",
  reviewMetadata: {},
};

const grant: PortalGrant = {
  id: "grant-001",
  firmId: "firm-west-legal",
  matterId: "matter-001",
  contactId: "contact-client",
  grantedByUserId: "user-admin",
  permissions: ["view_documents"],
};

function fixtureCase(id: string) {
  const match = authorizationFixtureCases.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing authorization fixture case ${id}`);
  return match;
}

function sampleUser(id: string): User {
  const match = sampleUsers.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing sample user ${id}`);
  return match;
}

function jobRecord(input: {
  id: string;
  matterId?: string;
  reportScope?: string;
}): JobLifecycleRecord {
  return {
    id: input.id,
    firmId: sampleFirm.id,
    queueName: "reports",
    jobName: "audit_export",
    status: "completed",
    targetResourceType: "audit_export",
    targetResourceId: input.id,
    attemptsMade: 1,
    maxAttempts: 1,
    queuedAt: "2026-05-02T10:00:00.000Z",
    finishedAt: "2026-05-02T10:01:00.000Z",
    metadata: {
      ...(input.matterId ? { matterId: input.matterId } : {}),
      ...(input.reportScope ? { reportScope: input.reportScope } : {}),
    },
  };
}

describe("authorization fixture catalogue", () => {
  it("catalogues the current OP relation vocabulary without canonical auth rewrites", () => {
    expect(Object.keys(authorizationRelationVocabulary).sort()).toEqual([
      "account_bound_portal_grant_holder",
      "assigned_matter_staff",
      "expired_public_share_token_holder",
      "external_portal_contact",
      "firm_wide_reviewer",
      "public_share_token_holder",
      "revoked_public_share_token_holder",
      "unassigned_matter_staff",
      "unverified_public_share_token_holder",
    ]);
    expect(authorizationFixtureCases.map((candidate) => candidate.id)).toEqual([
      "matter:firm-wide:list-all",
      "matter:assigned:list-visible",
      "matter:unassigned:list-hidden",
      "document:assigned:read-visible",
      "document:unassigned:read-hidden",
      "document:portal-grant:metadata-visible",
      "job:firm-wide:no-matter-visible",
      "job:assigned:matter-job-visible",
      "job:unassigned:matter-job-hidden",
      "job:unassigned:no-matter-hidden",
      "portal-link:public-share:metadata-visible",
      "portal-link:expired-share:hidden",
      "portal-link:revoked-share:hidden",
      "portal-link:email-unverified:denied",
    ]);
  });

  it("keeps matter and document fixture decisions aligned with RBAC plus matter scope", () => {
    for (const id of [
      "matter:firm-wide:list-all",
      "matter:assigned:list-visible",
      "matter:unassigned:list-hidden",
      "document:assigned:read-visible",
      "document:unassigned:read-hidden",
    ]) {
      const item = fixtureCase(id);
      expect(
        canAccess({
          user: sampleUser(item.subjectId),
          firmId: sampleFirm.id,
          resource: item.resource,
          action: item.action,
          matterId: item.matterId,
        }),
      ).toBe(item.expectedDecision === "allow");
    }
  });

  it("keeps portal document and job list-visible fixtures aligned with current helpers", () => {
    const externalUser: User = {
      id: "client-ada",
      firmId: sampleFirm.id,
      displayName: "Synthetic Portal Client",
      email: "ada@example.test",
      role: "client_external",
      assignedMatterIds: [],
      mfaEnabled: true,
    };
    const portalCase = fixtureCase("document:portal-grant:metadata-visible");
    expect(
      canAccess({
        user: externalUser,
        firmId: sampleFirm.id,
        resource: portalCase.resource,
        action: portalCase.action,
        matterId: portalCase.matterId,
        contactId: portalCase.contactId,
        portalGrants: samplePortalGrants,
        now: "2026-04-10T12:00:00.000Z",
      }),
    ).toBe(true);

    const owner = sampleUser("user-admin");
    const licensee = sampleUser("user-licensee");
    expect(
      canReadJobLifecycleRecord({
        user: owner,
        firmId: sampleFirm.id,
        record: jobRecord({ id: fixtureCase("job:firm-wide:no-matter-visible").resourceId! }),
      }),
    ).toBe(true);
    expect(
      canReadJobLifecycleRecord({
        user: licensee,
        firmId: sampleFirm.id,
        record: jobRecord({
          id: fixtureCase("job:assigned:matter-job-visible").resourceId!,
          matterId: "matter-001",
        }),
      }),
    ).toBe(true);
    expect(
      canReadJobLifecycleRecord({
        user: licensee,
        firmId: sampleFirm.id,
        record: jobRecord({
          id: fixtureCase("job:unassigned:matter-job-hidden").resourceId!,
          matterId: "matter-002",
        }),
      }),
    ).toBe(false);
    expect(
      canReadJobLifecycleRecord({
        user: licensee,
        firmId: sampleFirm.id,
        record: jobRecord({
          id: fixtureCase("job:unassigned:no-matter-hidden").resourceId!,
          reportScope: "firm",
        }),
      }),
    ).toBe(false);
  });
});

describe("portal document sharing permissions", () => {
  it("requires accepted review state before sharing external-upload documents", () => {
    expect(
      canShareDocumentThroughPortal({
        document: {
          ...baseDocument,
          externalUploadLinkId: "link-001",
          reviewStatus: "pending_review",
        },
        grant,
      }),
    ).toBe(false);

    expect(
      canShareDocumentThroughPortal({
        document: { ...baseDocument, externalUploadLinkId: "link-001", reviewStatus: "accepted" },
        grant,
      }),
    ).toBe(true);
  });

  it("allows accepted external-upload duplicates without treating pending duplicates as shareable", () => {
    expect(
      canShareDocumentThroughPortal({
        document: {
          ...baseDocument,
          checksumStatus: "duplicate",
          duplicateOfDocumentId: "doc-existing",
          externalUploadLinkId: "link-001",
          reviewStatus: "pending_review",
        },
        grant,
      }),
    ).toBe(false);

    expect(
      canShareDocumentThroughPortal({
        document: {
          ...baseDocument,
          checksumStatus: "duplicate",
          duplicateOfDocumentId: "doc-existing",
          externalUploadLinkId: "link-001",
          reviewStatus: "accepted",
        },
        grant,
      }),
    ).toBe(true);
  });
});

describe("matter creation permissions", () => {
  const licenseeWithoutMatters: User = {
    id: "user-licensee",
    firmId: "firm-west-legal",
    displayName: "Synthetic Licensee",
    email: "licensee@example.test",
    role: "licensee",
    assignedMatterIds: [],
    mfaEnabled: true,
  };

  it("allows authorized internal users to create the first matter without existing matter scope", () => {
    expect(
      canAccess({
        user: licenseeWithoutMatters,
        firmId: "firm-west-legal",
        resource: "matter",
        action: "create",
      }),
    ).toBe(true);
  });

  it("keeps matter create denied for roles without create access", () => {
    expect(
      canAccess({
        user: { ...licenseeWithoutMatters, role: "firm_member" },
        firmId: "firm-west-legal",
        resource: "matter",
        action: "create",
      }),
    ).toBe(false);
  });

  it("keeps matter-scoped access and dashboard capabilities server-derived", () => {
    const licensee = sampleUsers.find((candidate) => candidate.id === "user-licensee")!;
    const bookkeeper: User = {
      id: "user-bookkeeper",
      firmId: sampleFirm.id,
      displayName: "Synthetic Bookkeeper",
      email: "bookkeeper@example.test",
      role: "billing_bookkeeper",
      assignedMatterIds: ["matter-001"],
      mfaEnabled: true,
    };

    expect(
      canAccess({
        user: licensee,
        firmId: sampleFirm.id,
        resource: "matter",
        action: "read",
        matterId: "matter-002",
      }),
    ).toBe(false);
    expect(
      canAccess({
        user: licensee,
        firmId: sampleFirm.id,
        resource: "signature_request",
        action: "approve",
        matterId: "matter-001",
      }),
    ).toBe(true);
    expect(
      canAccess({
        user: bookkeeper,
        firmId: sampleFirm.id,
        resource: "calendar_event",
        action: "read",
        matterId: "matter-001",
      }),
    ).toBe(false);
    expect(
      dashboardCapabilities({ user: licensee, firmId: sampleFirm.id, matterId: "matter-001" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "funds", enabled: true }),
        expect.objectContaining({ key: "drafting", enabled: true }),
        expect.objectContaining({ key: "calendar", enabled: true }),
        expect.objectContaining({ key: "audit", enabled: true }),
      ]),
    );
    expect(
      dashboardCapabilities({ user: bookkeeper, firmId: sampleFirm.id, matterId: "matter-001" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "drafting", enabled: false }),
        expect.objectContaining({ key: "calendar", enabled: false }),
      ]),
    );
  });

  it("requires active portal grants for external client document reads", () => {
    const externalUser: User = {
      id: "user-client",
      firmId: sampleFirm.id,
      displayName: "Ada Morgan",
      email: "ada@example.test",
      role: "client_external",
      assignedMatterIds: [],
      mfaEnabled: true,
    };

    expect(
      canAccess({
        user: externalUser,
        firmId: sampleFirm.id,
        matterId: "matter-001",
        contactId: "contact-ada",
        portalGrants: samplePortalGrants,
        resource: "document",
        action: "read",
        now: "2026-04-10T12:00:00.000Z",
      }),
    ).toBe(true);

    expect(
      canAccess({
        user: externalUser,
        firmId: sampleFirm.id,
        matterId: "matter-001",
        contactId: "contact-ada",
        portalGrants: [{ ...samplePortalGrants[0]!, revokedAt: "2026-04-09" }],
        resource: "document",
        action: "read",
        now: "2026-04-10T12:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("allows client portal reads for any active grant while keeping files permissioned", () => {
    const externalUser: User = {
      id: "user-client",
      firmId: sampleFirm.id,
      displayName: "Ada Morgan",
      email: "ada@example.test",
      role: "client_external",
      assignedMatterIds: [],
      mfaEnabled: true,
    };
    const signOnlyGrant: PortalGrant = {
      ...samplePortalGrants[0]!,
      permissions: ["sign"],
    };

    expect(
      canAccess({
        user: externalUser,
        firmId: sampleFirm.id,
        matterId: "matter-001",
        contactId: "contact-ada",
        portalGrants: [signOnlyGrant],
        resource: "client_portal",
        action: "read",
        now: "2026-04-10T12:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      canAccess({
        user: externalUser,
        firmId: sampleFirm.id,
        matterId: "matter-001",
        contactId: "contact-ada",
        portalGrants: [signOnlyGrant],
        resource: "document",
        action: "read",
        now: "2026-04-10T12:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("keeps AI proposal review matter-scoped and staff-only", () => {
    expect(
      canAccess({
        user: { ...licenseeWithoutMatters, assignedMatterIds: ["matter-001"] },
        firmId: "firm-west-legal",
        resource: "ai_proposal",
        action: "approve",
        matterId: "matter-001",
      }),
    ).toBe(true);
    expect(
      canAccess({
        user: { ...licenseeWithoutMatters, role: "firm_member", assignedMatterIds: ["matter-002"] },
        firmId: "firm-west-legal",
        resource: "ai_proposal",
        action: "approve",
        matterId: "matter-001",
      }),
    ).toBe(false);
    expect(
      canAccess({
        user: { ...licenseeWithoutMatters, role: "client_external", assignedMatterIds: [] },
        firmId: "firm-west-legal",
        resource: "ai_proposal",
        action: "read",
        matterId: "matter-001",
      }),
    ).toBe(false);
  });

  it("keeps legal research artifacts matter-scoped and staff-only", () => {
    expect(
      canAccess({
        user: { ...licenseeWithoutMatters, assignedMatterIds: ["matter-001"] },
        firmId: "firm-west-legal",
        resource: "legal_research",
        action: "approve",
        matterId: "matter-001",
      }),
    ).toBe(true);
    expect(
      canAccess({
        user: { ...licenseeWithoutMatters, role: "firm_member", assignedMatterIds: ["matter-002"] },
        firmId: "firm-west-legal",
        resource: "legal_research",
        action: "update",
        matterId: "matter-001",
      }),
    ).toBe(false);
    expect(
      canAccess({
        user: { ...licenseeWithoutMatters, role: "auditor", assignedMatterIds: [] },
        firmId: "firm-west-legal",
        resource: "legal_research",
        action: "read",
        matterId: "matter-001",
      }),
    ).toBe(true);
    expect(
      canAccess({
        user: { ...licenseeWithoutMatters, role: "auditor", assignedMatterIds: [] },
        firmId: "firm-west-legal",
        resource: "legal_research",
        action: "approve",
        matterId: "matter-001",
      }),
    ).toBe(false);
    expect(
      canAccess({
        user: { ...licenseeWithoutMatters, role: "billing_bookkeeper", assignedMatterIds: [] },
        firmId: "firm-west-legal",
        resource: "legal_research",
        action: "read",
        matterId: "matter-001",
      }),
    ).toBe(false);
  });
});

describe("matterless calendar permissions", () => {
  const licenseeWithoutMatters: User = {
    id: "user-licensee",
    firmId: "firm-west-legal",
    displayName: "Synthetic Licensee",
    email: "licensee@example.test",
    role: "licensee",
    assignedMatterIds: [],
    mfaEnabled: true,
  };

  it("requires explicit client visibility for non-admin matterless calendar writes", () => {
    expect(
      canAccess({
        user: licenseeWithoutMatters,
        firmId: "firm-west-legal",
        resource: "calendar_event",
        action: "read",
      }),
    ).toBe(true);

    expect(
      canAccess({
        user: licenseeWithoutMatters,
        firmId: "firm-west-legal",
        resource: "calendar_event",
        action: "create",
      }),
    ).toBe(false);

    expect(
      canAccess({
        user: licenseeWithoutMatters,
        firmId: "firm-west-legal",
        resource: "calendar_event",
        action: "create",
        contactId: "contact-visible",
      }),
    ).toBe(true);
  });
});

describe("job metadata redaction", () => {
  it("keeps connector delivery retry counts while dropping raw delivery identifiers and payloads", () => {
    expect(
      redactJobMetadata({
        resourceType: "connector_outbox",
        resourceId: "connector-outbox-001",
        eventCount: 1,
        failedCount: 1,
        deadLetterCount: 0,
        retryScheduledCount: 1,
        retryScheduleFailedCount: 0,
        nextRetryAt: "2026-05-12T12:05:00.000Z",
        connectorId: "connector-private",
        failedIds: ["connector-outbox-001"],
        rawBody: "Synthetic connector body must not be exposed",
        token: "synthetic-token",
      }),
    ).toEqual({
      resourceType: "connector_outbox",
      resourceId: "connector-outbox-001",
      eventCount: 1,
      failedCount: 1,
      deadLetterCount: 0,
      retryScheduledCount: 1,
      retryScheduleFailedCount: 0,
      nextRetryAt: "2026-05-12T12:05:00.000Z",
    });
  });

  it("allows async draft assist routing and length metadata without raw text", () => {
    expect(
      redactJobMetadata({
        draftAssistRecordId: "assist-001",
        draftId: "draft-001",
        documentId: "doc-001",
        sourceType: "draft",
        sourceTextLength: 42,
        instructionLength: 18,
        evidenceKeyCount: 2,
        provider: "fake-local-ai",
        providerModel: "fake-model",
        suggestedTextLength: 57,
        summaryLength: 16,
        generatedText: "Synthetic generated text",
        sourceText: "Synthetic source text",
        evidence: { private: "value" },
      }),
    ).toEqual({
      draftAssistRecordId: "assist-001",
      draftId: "draft-001",
      documentId: "doc-001",
      sourceType: "draft",
      sourceTextLength: 42,
      instructionLength: 18,
      evidenceKeyCount: 2,
      provider: "fake-local-ai",
      providerModel: "fake-model",
      suggestedTextLength: 57,
      summaryLength: 16,
    });
  });

  it("keeps async export safe counts while dropping export bodies", () => {
    expect(
      redactJobMetadata({
        exportKind: "billing",
        matterId: "matter-001",
        requestedByUserId: "user-admin",
        recordCount: 4,
        timeEntryCount: 1,
        expenseEntryCount: 1,
        invoiceCount: 1,
        paymentCount: 1,
        enqueueStatus: "queued_for_local_report_worker",
        narrative: "Synthetic private billing narrative",
        ledgerMemo: "Synthetic private ledger memo",
        recipientEmail: "client@example.test",
        exportBody: [{ private: "Synthetic export content" }],
      }),
    ).toEqual({
      matterId: "matter-001",
      requestedByUserId: "user-admin",
      recordCount: 4,
      timeEntryCount: 1,
      expenseEntryCount: 1,
      invoiceCount: 1,
      enqueueStatus: "queued_for_local_report_worker",
    });

    expect(
      redactJobMetadata({
        exportKind: "trust",
        recordCount: 7,
        trustTransferRequestCount: 1,
        ledgerAccountCount: 3,
        ledgerEntryCount: 2,
        balanceCount: 1,
        trustBalanceCount: 1,
        accountNames: ["Synthetic private account name"],
        ledgerEntries: [{ memo: "Synthetic private ledger memo" }],
      }),
    ).toEqual({
      recordCount: 7,
      trustTransferRequestCount: 1,
    });
  });

  it("keeps conversation export routing and counts while dropping message bodies", () => {
    expect(
      redactJobMetadata({
        reportType: "conversation_thread",
        reportScope: "matter",
        matterId: "matter-001",
        threadId: "thread-export-001",
        requestedByUserId: "user-admin",
        messageCount: 2,
        enqueueStatus: "queued_for_local_report_worker",
        bodyText: "Synthetic privileged message body",
        exportBody: [{ bodyText: "Synthetic export content" }],
        metadataValues: { privateNote: "Synthetic private note" },
      }),
    ).toEqual({
      reportType: "conversation_thread",
      reportScope: "matter",
      matterId: "matter-001",
      threadId: "thread-export-001",
      requestedByUserId: "user-admin",
      messageCount: 2,
      enqueueStatus: "queued_for_local_report_worker",
    });
  });

  it("allows AI proposal routing metadata while dropping generated and source text", () => {
    expect(
      redactJobMetadata({
        proposalId: "proposal-001",
        proposalKind: "task_creation",
        proposalKinds: "deadline_extraction,task_creation",
        proposalKindCount: 2,
        proposalCount: 2,
        draftId: "draft-001",
        sourceType: "draft",
        sourceTextLength: 42,
        provider: "fake-local-ai",
        providerModel: "fake-model",
        proposalTitleLength: 21,
        proposalSummaryLength: 34,
        generatedProposal: "Synthetic generated proposal",
        sourceText: "Synthetic source text",
      }),
    ).toEqual({
      proposalId: "proposal-001",
      proposalKind: "task_creation",
      proposalKinds: "deadline_extraction,task_creation",
      proposalKindCount: 2,
      proposalCount: 2,
      draftId: "draft-001",
      sourceType: "draft",
      sourceTextLength: 42,
      provider: "fake-local-ai",
      providerModel: "fake-model",
      proposalTitleLength: 21,
      proposalSummaryLength: 34,
    });
  });

  it("allows legal research provider job boundary metadata while dropping prompts and source bodies", () => {
    expect(
      redactJobMetadata({
        matterId: "matter-001",
        requestType: "citation_review",
        sourceTypes: "case_law,statute",
        sourceTypeCount: 2,
        citationReferenceCount: 3,
        contextLinkCount: 1,
        artifactCount: 2,
        requestedByUserId: "user-licensee",
        provider: "reserved_legal_research_provider",
        providerStatus: "reserved",
        providerConfigured: false,
        citationReviewRequired: true,
        sourceTextIncluded: false,
        promptIncluded: false,
        providerEvidenceStored: false,
        citationVerificationClaims: false,
        downstreamMutation: false,
        reviewOnly: true,
        prompt: "Synthetic research prompt must not be exposed",
        sourceText: "Synthetic source text must not be exposed",
        providerEvidence: { private: "Synthetic provider evidence" },
        sourceUrl: "https://private.example.test/source",
      }),
    ).toEqual({
      matterId: "matter-001",
      requestType: "citation_review",
      sourceTypes: "case_law,statute",
      sourceTypeCount: 2,
      citationReferenceCount: 3,
      contextLinkCount: 1,
      artifactCount: 2,
      requestedByUserId: "user-licensee",
      provider: "reserved_legal_research_provider",
      providerStatus: "reserved",
      providerConfigured: false,
      citationReviewRequired: true,
      sourceTextIncluded: false,
      promptIncluded: false,
      providerEvidenceStored: false,
      citationVerificationClaims: false,
      downstreamMutation: false,
      reviewOnly: true,
    });
  });
});
