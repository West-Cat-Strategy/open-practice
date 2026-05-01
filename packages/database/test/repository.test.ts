import { describe, expect, it } from "vitest";
import {
  appendAuditEvent,
  type AccessLogRecord,
  type ExternalUploadLinkRecord,
  type Firm,
} from "@open-practice/domain";
import {
  InMemoryOpenPracticeRepository,
  CalendarEventScopeConflictError,
  CalendarEventUidConflictError,
  FirstRunSetupConflictError,
  type FirstRunSetupInput,
} from "../src/repository.js";

const now = "2026-04-25T12:00:00.000Z";

function setupInput(): FirstRunSetupInput {
  const firm: Firm = {
    id: "firm-north-shore-law",
    name: "North Shore Law",
    defaultProvince: "BC",
  };
  const ownerId = "user-owner";
  const firstMatterId = "matter-first";
  return {
    firm,
    settings: {
      firmId: firm.id,
      businessAddress: {
        line1: "100 Main Street",
        city: "Vancouver",
        province: "BC",
        postalCode: "V6B 1A1",
        country: "Canada",
      },
      officeEmail: "office@example.test",
      officePhone: "604-555-0100",
      practiceAreas: ["Residential tenancy"],
      invoicePrefix: "NSL",
      defaultPaymentTermsDays: 30,
      trustAccountLabel: "Pooled trust",
      trustFundsCaveatAcceptedAt: now,
      trustFundsCaveatAcceptedByUserId: ownerId,
      createdAt: now,
      updatedAt: now,
    },
    owner: {
      id: ownerId,
      firmId: firm.id,
      displayName: "Avery Owner",
      email: "avery@example.test",
      role: "owner_admin",
      assignedMatterIds: [firstMatterId],
      mfaEnabled: false,
    },
    ownerPasswordHash: "pbkdf2:sha256:1:salt:hash",
    ownerPasswordUpdatedAt: now,
    firstContact: {
      id: "contact-first-client",
      firmId: firm.id,
      kind: "person",
      displayName: "First Client",
      aliases: [],
      identifiers: [{ type: "email", value: "client@example.test" }],
    },
    firstMatter: {
      id: firstMatterId,
      firmId: firm.id,
      number: "2026-0001",
      title: "First file",
      practiceArea: "Residential tenancy",
      status: "intake",
      jurisdiction: "BC",
      responsibleUserId: ownerId,
      openedOn: "2026-04-25",
    },
    firstMatterParty: {
      id: "party-first-client",
      firmId: firm.id,
      matterId: firstMatterId,
      contactId: "contact-first-client",
      role: "prospective_client",
      adverse: false,
      confidential: true,
    },
    auditEvent: appendAuditEvent(undefined, {
      id: "audit-first-run",
      firmId: firm.id,
      actorId: ownerId,
      action: "setup.completed",
      resourceType: "firm",
      resourceId: firm.id,
      occurredAt: now,
      metadata: { firstMatterCreated: true },
    }),
  };
}

describe("repository first-run setup", () => {
  it("reports setup as required only for an empty repository", async () => {
    await expect(new InMemoryOpenPracticeRepository().getSetupStatus()).resolves.toEqual({
      required: false,
      blocked: false,
    });
    await expect(
      new InMemoryOpenPracticeRepository({ seedSampleData: false }).getSetupStatus(),
    ).resolves.toEqual({
      required: true,
      blocked: false,
    });
  });

  it("creates firm settings, owner auth, and optional first matter atomically in memory", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const input = setupInput();

    await expect(repository.completeFirstRunSetup(input)).resolves.toMatchObject({
      firm: input.firm,
      owner: input.owner,
      firstMatter: input.firstMatter,
    });

    await expect(repository.getSetupStatus()).resolves.toEqual({ required: false, blocked: false });
    await expect(repository.getFirmSettings(input.firm.id)).resolves.toMatchObject(input.settings);
    await expect(repository.getAuthAccount(input.firm.id, input.owner.id)).resolves.toMatchObject({
      passwordHash: input.ownerPasswordHash,
    });
    await expect(repository.listDraftTemplates(input.firm.id)).resolves.toMatchObject([
      { id: "draft-template-legal-letter" },
      { id: "draft-template-meeting-notes" },
    ]);
    await expect(repository.listMattersForUser(input.owner)).resolves.toHaveLength(1);
  });

  it("rejects a second setup attempt", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    await repository.completeFirstRunSetup(setupInput());

    await expect(repository.completeFirstRunSetup(setupInput())).rejects.toBeInstanceOf(
      FirstRunSetupConflictError,
    );
  });

  it("blocks setup when only part of bootstrap state exists", async () => {
    const firm = setupInput().firm;
    const repository = new InMemoryOpenPracticeRepository({
      seedSampleData: false,
      firms: [firm],
    });

    await expect(repository.getSetupStatus()).resolves.toMatchObject({
      required: false,
      blocked: true,
    });
  });
});

describe("repository operations foundation", () => {
  it("seeds basic draft templates and versions draft updates", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await expect(repository.listDraftTemplates("firm-west-legal")).resolves.toMatchObject([
      {
        id: "draft-template-legal-letter",
        category: "correspondence",
        active: true,
      },
      {
        id: "draft-template-meeting-notes",
        category: "internal",
        active: true,
      },
    ]);

    const created = await repository.createDraft({
      id: "draft-test-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      title: "Draft test",
      editorJson: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Initial" }] }],
      },
      version: 1,
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    });
    const updated = await repository.updateDraft("firm-west-legal", created.id, {
      title: "Updated draft test",
      updatedByUserId: "user-licensee",
    });

    expect(updated).toMatchObject({
      id: created.id,
      title: "Updated draft test",
      version: 2,
      updatedByUserId: "user-licensee",
    });
  });

  it("upserts firm-scoped provider settings", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const createdAt = now;

    await expect(
      repository.upsertProviderSetting({
        id: "provider-smtp-default",
        firmId: "firm-west-legal",
        kind: "smtp",
        key: "default",
        enabled: false,
        encryptedConfig: "sealed:placeholder",
        createdAt,
        updatedAt: createdAt,
      }),
    ).resolves.toMatchObject({ kind: "smtp", enabled: false });

    await repository.upsertProviderSetting({
      id: "provider-smtp-default-updated",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "default",
      enabled: true,
      encryptedConfig: "sealed:updated",
      createdAt,
      updatedAt: "2026-04-25T13:00:00.000Z",
    });

    await expect(
      repository.listProviderSettings("firm-west-legal", { kind: "smtp" }),
    ).resolves.toMatchObject([{ enabled: true, encryptedConfig: "sealed:updated" }]);
  });

  it("records job lifecycle state transitions", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await repository.createJobLifecycleRecord({
      id: "job-email-1",
      firmId: "firm-west-legal",
      queueName: "email",
      jobName: "send",
      status: "queued",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: now,
      metadata: { templateKey: "password_reset" },
    });

    await expect(
      repository.updateJobLifecycleRecord("firm-west-legal", "job-email-1", {
        status: "failed",
        attemptsMade: 1,
        failedAt: "2026-04-25T12:01:00.000Z",
        errorMessage: "SMTP unavailable",
      }),
    ).resolves.toMatchObject({ status: "failed", attemptsMade: 1 });
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { status: "failed" }),
    ).resolves.toMatchObject([{ id: "job-email-1", errorMessage: "SMTP unavailable" }]);
  });

  it("persists share links and access logs in memory", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const share = await repository.createShareLink({
      id: "share-link-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "share-token-hash-001",
      grantedByUserId: "user-admin",
      permissions: ["view_documents"],
      requireEmailVerification: false,
      expiresAt: "2026-05-01T00:00:00.000Z",
      createdAt: now,
    });
    await repository.createShareLink({
      id: "share-link-002",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "share-token-hash-002",
      grantedByUserId: "user-admin",
      permissions: ["view_documents"],
      requireEmailVerification: false,
      expiresAt: "2026-05-01T00:00:00.000Z",
      createdAt: "2026-04-25T13:00:00.000Z",
    });

    await expect(repository.listShareLinks("firm-west-legal")).resolves.toMatchObject([
      { id: "share-link-002", matterId: "matter-001" },
      { id: share.id, matterId: "matter-001" },
    ]);
    await expect(repository.getShareLink("firm-west-legal", share.id)).resolves.toMatchObject({
      id: share.id,
    });
    await expect(repository.getShareLinkByTokenHash("share-token-hash-001")).resolves.toMatchObject(
      { id: share.id },
    );
    await expect(repository.createShareLink({ ...share, id: "duplicate-token" })).rejects.toThrow(
      "Share link token hash already exists",
    );

    await repository.createAccessLog({
      id: "access-log-001",
      firmId: "firm-west-legal",
      shareLinkId: share.id,
      resourceType: "share_link",
      resourceId: share.id,
      action: "view",
      occurredAt: now,
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
      metadata: { outcome: "granted" },
    });
    await repository.createAccessLog({
      id: "access-log-002",
      firmId: "firm-west-legal",
      shareLinkId: share.id,
      resourceType: "share_link",
      resourceId: share.id,
      action: "view",
      occurredAt: "2026-04-25T13:00:00.000Z",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
      metadata: { outcome: "expired" },
    });
    await expect(
      repository.listAccessLogs("firm-west-legal", { shareLinkId: share.id }),
    ).resolves.toMatchObject([
      { resourceId: share.id, metadata: { outcome: "expired" } },
      { resourceId: share.id, metadata: { outcome: "granted" } },
    ]);

    await expect(
      repository.revokeShareLink({
        firmId: "firm-west-legal",
        id: share.id,
        revokedAt: "2026-04-25T13:00:00.000Z",
      }),
    ).resolves.toMatchObject({ revokedAt: "2026-04-25T13:00:00.000Z" });
  });

  it("manages external upload links and access log filters", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const activeLink: ExternalUploadLinkRecord = {
      id: "external-upload-active",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "hash-active-upload",
      requestedByUserId: "user-admin",
      expiresAt: "2026-04-25T13:00:00.000Z",
      maxUploads: 2,
      usedUploads: 0,
      createdAt: now,
    };
    const revokedLink: ExternalUploadLinkRecord = {
      id: "external-upload-revoked",
      firmId: "firm-west-legal",
      matterId: "matter-002",
      tokenHash: "hash-revoked-upload",
      requestedByUserId: "user-admin",
      expiresAt: "2026-04-25T13:00:00.000Z",
      maxUploads: 1,
      usedUploads: 0,
      createdAt: "2026-04-25T12:01:00.000Z",
    };
    const expiredLink: ExternalUploadLinkRecord = {
      id: "external-upload-expired",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "hash-expired-upload",
      requestedByUserId: "user-admin",
      expiresAt: "2026-04-25T11:00:00.000Z",
      maxUploads: 1,
      usedUploads: 0,
      createdAt: "2026-04-25T12:02:00.000Z",
    };

    await repository.createExternalUploadLink(activeLink);
    await repository.createExternalUploadLink(revokedLink);
    await repository.createExternalUploadLink(expiredLink);
    await expect(
      repository.createExternalUploadLink({ ...activeLink, id: "external-upload-duplicate" }),
    ).rejects.toThrow("External upload link token hash already exists");

    await expect(
      repository.listExternalUploadLinks("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual(expect.arrayContaining([activeLink, expiredLink]));
    await expect(
      repository.getExternalUploadLinkByTokenHash(activeLink.tokenHash),
    ).resolves.toEqual(activeLink);

    await expect(
      repository.claimExternalUploadUse({
        firmId: activeLink.firmId,
        id: activeLink.id,
        usedAt: "2026-04-25T12:30:00.000Z",
      }),
    ).resolves.toMatchObject({ usedUploads: 1 });
    await expect(
      repository.claimExternalUploadUse({
        firmId: activeLink.firmId,
        id: activeLink.id,
        usedAt: "2026-04-25T12:31:00.000Z",
      }),
    ).resolves.toMatchObject({ usedUploads: 2 });
    await expect(
      repository.claimExternalUploadUse({
        firmId: activeLink.firmId,
        id: activeLink.id,
        usedAt: "2026-04-25T12:32:00.000Z",
      }),
    ).resolves.toBeUndefined();
    await expect(
      repository.claimExternalUploadUse({
        firmId: expiredLink.firmId,
        id: expiredLink.id,
        usedAt: "2026-04-25T12:00:00.000Z",
      }),
    ).resolves.toBeUndefined();
    await expect(
      repository.revokeExternalUploadLink({
        firmId: revokedLink.firmId,
        id: revokedLink.id,
        revokedAt: "2026-04-25T12:45:00.000Z",
      }),
    ).resolves.toMatchObject({ revokedAt: "2026-04-25T12:45:00.000Z" });
    await expect(
      repository.claimExternalUploadUse({
        firmId: revokedLink.firmId,
        id: revokedLink.id,
        usedAt: "2026-04-25T12:46:00.000Z",
      }),
    ).resolves.toBeUndefined();

    const logs: AccessLogRecord[] = [
      {
        id: "access-share",
        firmId: "firm-west-legal",
        shareLinkId: "share-link-001",
        resourceType: "document",
        resourceId: "document-001",
        action: "view",
        occurredAt: now,
        metadata: {},
      },
      {
        id: "access-upload",
        firmId: "firm-west-legal",
        externalUploadLinkId: activeLink.id,
        resourceType: "document",
        resourceId: "document-uploaded",
        action: "upload",
        occurredAt: "2026-04-25T12:35:00.000Z",
        metadata: { filename: "evidence.pdf" },
      },
      {
        id: "access-other-upload",
        firmId: "firm-west-legal",
        externalUploadLinkId: revokedLink.id,
        resourceType: "document",
        resourceId: "document-other",
        action: "upload",
        occurredAt: "2026-04-25T12:36:00.000Z",
        metadata: {},
      },
    ];
    for (const log of logs) {
      await repository.createAccessLog(log);
    }

    await expect(
      repository.listAccessLogs("firm-west-legal", { shareLinkId: "share-link-001" }),
    ).resolves.toMatchObject([{ id: "access-share" }]);
    await expect(
      repository.listAccessLogs("firm-west-legal", { externalUploadLinkId: activeLink.id }),
    ).resolves.toMatchObject([{ id: "access-upload" }]);
  });

  it("lists matter-scoped calendar events with optional start filters", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.listCalendarEvents("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toMatchObject([
      { id: "calendar-event-001", matterId: "matter-001" },
      { id: "calendar-event-002", matterId: "matter-001" },
    ]);

    await expect(
      repository.listCalendarEvents("firm-west-legal", {
        matterId: "matter-001",
        startsAfter: "2026-05-06T00:00:00.000Z",
      }),
    ).resolves.toMatchObject([{ id: "calendar-event-002", matterId: "matter-001" }]);

    await expect(
      repository.listCalendarEvents("firm-west-legal", { matterId: "matter-002" }),
    ).resolves.toMatchObject([{ id: "calendar-event-003", matterId: "matter-002" }]);
  });

  it("creates, updates, and soft-deletes matter-scoped calendar events", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const event = await repository.upsertCalendarEvent({
      id: "calendar-event-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      uid: "calendar-event-test@example.test",
      title: "Synthetic CalDAV event",
      startsAt: "2026-05-12T16:00:00.000Z",
      endsAt: "2026-05-12T17:00:00.000Z",
      description: "Created by repository test.",
      location: "Office",
      status: "confirmed",
      sequence: 0,
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
    });

    await expect(
      repository.getCalendarEvent("firm-west-legal", "matter-001", event.id),
    ).resolves.toMatchObject({ uid: "calendar-event-test@example.test", sequence: 0 });
    await expect(
      repository.getCalendarEventByUid("firm-west-legal", "matter-001", event.uid),
    ).resolves.toMatchObject({ id: event.id });

    await repository.upsertCalendarEvent({
      ...event,
      title: "Updated synthetic CalDAV event",
      sequence: 1,
      updatedAt: "2026-04-25T12:10:00.000Z",
    });
    await expect(
      repository.getCalendarEvent("firm-west-legal", "matter-001", event.id),
    ).resolves.toMatchObject({ title: "Updated synthetic CalDAV event", sequence: 1 });

    await expect(
      repository.deleteCalendarEvent({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: event.id,
        deletedAt: "2026-04-25T12:15:00.000Z",
        updatedByUserId: "user-licensee",
      }),
    ).resolves.toMatchObject({ deletedAt: "2026-04-25T12:15:00.000Z", sequence: 2 });
    await expect(
      repository.listCalendarEvents("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ id: event.id })]));

    await expect(
      repository.upsertCalendarEvent({
        ...event,
        id: "calendar-event-test-recreated",
        sequence: 0,
        createdAt: "2026-04-25T12:20:00.000Z",
        updatedAt: "2026-04-25T12:20:00.000Z",
      }),
    ).resolves.toMatchObject({
      id: "calendar-event-test-recreated",
      uid: "calendar-event-test@example.test",
    });
  });

  it("rejects calendar event writes that would cross firm or matter scope", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.upsertCalendarEvent({
        id: "calendar-event-001",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        uid: "cross-scope@example.test",
        title: "Cross-scope attempt",
        startsAt: "2026-05-12T16:00:00.000Z",
        endsAt: "2026-05-12T17:00:00.000Z",
        status: "confirmed",
        sequence: 0,
        createdAt: now,
        updatedAt: now,
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      }),
    ).rejects.toBeInstanceOf(CalendarEventScopeConflictError);

    await expect(
      repository.getCalendarEvent("firm-west-legal", "matter-001", "calendar-event-001"),
    ).resolves.toMatchObject({
      matterId: "matter-001",
      title: "Residential tenancy filing deadline",
    });
  });

  it("enforces active-only calendar UID uniqueness per matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.upsertCalendarEvent({
        id: "calendar-event-uid-conflict",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        uid: "calendar-event-001@open-practice.local",
        title: "Duplicate UID attempt",
        startsAt: "2026-05-12T16:00:00.000Z",
        endsAt: "2026-05-12T17:00:00.000Z",
        status: "confirmed",
        sequence: 0,
        createdAt: now,
        updatedAt: now,
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      }),
    ).rejects.toBeInstanceOf(CalendarEventUidConflictError);
  });

  it("stores and revokes calendar app-password credentials", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await expect(
      repository.createCalendarCredential({
        id: "calendar-credential-test",
        firmId: "firm-west-legal",
        userId: "user-licensee",
        username: "firm-west-legal.user-licensee.calendar-credential-test",
        label: "Mina iPhone",
        passwordHash: "pbkdf2:sha256:1:salt:hash",
        createdAt: now,
        createdByUserId: "user-licensee",
      }),
    ).resolves.toMatchObject({ label: "Mina iPhone" });

    await expect(
      repository.getCalendarCredentialByUsername(
        "firm-west-legal.user-licensee.calendar-credential-test",
      ),
    ).resolves.toMatchObject({ id: "calendar-credential-test" });

    await repository.touchCalendarCredential(
      "calendar-credential-test",
      "2026-04-25T12:20:00.000Z",
    );
    await expect(
      repository.listCalendarCredentials("firm-west-legal", "user-licensee"),
    ).resolves.toMatchObject([{ lastUsedAt: "2026-04-25T12:20:00.000Z" }]);

    await expect(
      repository.revokeCalendarCredential({
        firmId: "firm-west-legal",
        userId: "user-licensee",
        credentialId: "calendar-credential-test",
        revokedAt: "2026-04-25T12:30:00.000Z",
      }),
    ).resolves.toMatchObject({ revokedAt: "2026-04-25T12:30:00.000Z" });
    await expect(
      repository.getCalendarCredentialByUsername(
        "firm-west-legal.user-licensee.calendar-credential-test",
      ),
    ).resolves.toBeUndefined();
  });

  it("guards trust approval and reconciliation persistence", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.createLedgerTransactionApproval({
        id: "approval-1",
        firmId: "firm-west-legal",
        transactionId: "trust-retainer",
        decidedByUserId: "user-admin",
        decision: "approved",
        decidedAt: now,
      }),
    ).resolves.toMatchObject({ transactionId: "trust-retainer", decision: "approved" });

    await expect(
      repository.createLedgerTransactionApproval({
        id: "approval-duplicate",
        firmId: "firm-west-legal",
        transactionId: "trust-retainer",
        decidedByUserId: "user-admin",
        decision: "rejected",
        decidedAt: now,
      }),
    ).rejects.toThrow(/already recorded/);
    await expect(
      repository.createLedgerTransactionApproval({
        id: "approval-missing",
        firmId: "firm-west-legal",
        transactionId: "missing-transaction",
        decidedByUserId: "user-admin",
        decision: "approved",
        decidedAt: now,
      }),
    ).rejects.toThrow(/Unknown ledger transaction/);

    await expect(
      repository.createLedgerReconciliation({
        id: "reconciliation-invalid-period",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        statementPeriodStart: "2026-04-30T00:00:00.000Z",
        statementPeriodEnd: "2026-04-01T00:00:00.000Z",
        expectedBalanceCents: 150000,
        actualBalanceCents: 150000,
        status: "matched",
        reviewedByUserId: "user-admin",
        evidence: {},
        createdAt: now,
      }),
    ).rejects.toThrow(/period end/);
    await expect(
      repository.createLedgerReconciliation({
        id: "reconciliation-missing-account",
        firmId: "firm-west-legal",
        accountId: "missing-account",
        statementPeriodStart: "2026-04-01T00:00:00.000Z",
        statementPeriodEnd: "2026-04-30T00:00:00.000Z",
        expectedBalanceCents: 150000,
        actualBalanceCents: 150000,
        status: "matched",
        reviewedByUserId: "user-admin",
        evidence: {},
        createdAt: now,
      }),
    ).rejects.toThrow(/Unknown ledger account/);
  });

  it("stores parsed inbound email messages and attachments", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const message = await repository.createInboundEmailMessage({
      id: "inbound-message-001",
      firmId: "firm-west-legal",
      addressId: "inbound-address-001",
      matterId: "matter-001",
      messageId: "<message-001@example.test>",
      fromAddress: "client@example.test",
      toAddresses: ["matter-001@open-practice.test"],
      subject: "Filed materials",
      receivedAt: now,
      rawStorageKey: "inbound/raw/message-001.eml",
      parsedText: "Please review.",
      parsedHtmlStorageKey: "inbound/message-001/body.html",
      labels: [],
      status: "triaged",
      metadata: { routedAddress: "matter-001@open-practice.test" },
    });

    await expect(repository.listInboundEmailMessages("firm-west-legal")).resolves.toMatchObject([
      {
        id: message.id,
        matterId: "matter-001",
        messageId: "<message-001@example.test>",
        status: "triaged",
      },
    ]);
    await expect(
      repository.getInboundEmailMessage("firm-west-legal", message.id),
    ).resolves.toMatchObject({
      messageId: "<message-001@example.test>",
      subject: "Filed materials",
    });
    await expect(
      repository.updateInboundEmailMessage("firm-west-legal", message.id, {
        status: "triage_pending",
        labels: ["needs-review"],
      }),
    ).resolves.toMatchObject({
      status: "triage_pending",
      labels: ["needs-review"],
    });

    await repository.createInboundEmailAttachment({
      id: "inbound-attachment-001",
      firmId: "firm-west-legal",
      inboundMessageId: message.id,
      filename: "filing.pdf",
      contentType: "application/pdf",
      sizeBytes: 128,
      storageKey: "inbound/message-001/filing.pdf",
      checksumSha256: "a".repeat(64),
    });

    const attachments = await repository.listInboundEmailAttachments("firm-west-legal", message.id);
    expect(attachments).toMatchObject([
      {
        filename: "filing.pdf",
        checksumSha256: "a".repeat(64),
      },
    ]);
    expect(attachments[0]).not.toHaveProperty("documentId");
  });
});
