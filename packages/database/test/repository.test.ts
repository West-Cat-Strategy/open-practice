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

async function createInboundMessageWithAttachment(
  repository: InMemoryOpenPracticeRepository,
  options: {
    messageId: string;
    attachmentId: string;
    matterId?: string;
    checksumSha256?: string;
  },
) {
  const matterId = options.matterId ?? "matter-002";
  const message = await repository.createInboundEmailMessage({
    id: options.messageId,
    firmId: "firm-west-legal",
    matterId,
    fromAddress: "client@example.test",
    toAddresses: [`${matterId}@open-practice.test`],
    subject: "Filed materials",
    receivedAt: now,
    rawStorageKey: `inbound/raw/${options.messageId}.eml`,
    labels: [],
    status: "triaged",
    metadata: {},
  });
  const attachmentInput = {
    id: options.attachmentId,
    firmId: "firm-west-legal",
    inboundMessageId: message.id,
    filename: "filing.pdf",
    contentType: "application/pdf",
    sizeBytes: 128,
    storageKey: `inbound/${message.id}/filing.pdf`,
  };
  const attachment = await repository.createInboundEmailAttachment(
    options.checksumSha256
      ? { ...attachmentInput, checksumSha256: options.checksumSha256 }
      : attachmentInput,
  );
  return { message, attachment };
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
    await expect(repository.listIntakeTemplates(input.firm.id)).resolves.toEqual([]);
    await expect(repository.listMattersForUser(input.owner)).resolves.toHaveLength(1);
  });

  it("creates selected preset draft and intake templates during first-run setup", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const input = setupInput();

    await repository.completeFirstRunSetup({
      ...input,
      selectedPresetIds: ["bc-residential-tenancy", "general-canada"],
    });

    await expect(repository.listDraftTemplates(input.firm.id)).resolves.toMatchObject([
      { id: "draft-template-legal-letter", metadata: { source: "open-practice-basic" } },
      { id: "draft-template-meeting-notes", metadata: { source: "open-practice-basic" } },
      {
        id: "draft-template-preset-general-canada-matter-summary",
        category: "general-practice",
        metadata: { source: "open-practice-preset", presetId: "general-canada" },
      },
      {
        id: "draft-template-preset-bc-tenancy-chronology",
        category: "residential-tenancy",
        metadata: { presetId: "bc-residential-tenancy" },
      },
    ]);
    await expect(repository.listIntakeTemplates(input.firm.id)).resolves.toMatchObject([
      {
        id: "intake-template-preset-general-canada",
        category: "general-practice",
        description: expect.any(String),
        createdAt: now,
        metadata: { presetId: "general-canada", editable: true },
      },
      {
        id: "intake-template-preset-bc-tenancy",
        category: "residential-tenancy",
        metadata: { presetId: "bc-residential-tenancy" },
      },
    ]);
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

  it("records matter-scoped email delivery history in memory", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-history-001",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        templateKey: "signature.requested",
        status: "queued",
        to: ["client@example.test"],
        cc: ["staff@example.test"],
        bcc: [],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Synthetic signature request",
        htmlBody: "",
        textBody: "Synthetic body",
        relatedResourceType: "signature_request",
        relatedResourceId: "sig-001",
        queuedAt: now,
        attemptCount: 0,
        metadata: { matterId: "matter-001", provider: "mailpit" },
      },
      event: {
        id: "email-event-history-queued",
        firmId: "firm-west-legal",
        emailId: "email-history-001",
        eventType: "queued",
        occurredAt: now,
        jobId: "job-email-history-001",
        source: "api",
        metadata: { provider: "mailpit" },
      },
      job: {
        id: "job-email-history-001",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-history-001",
        attemptsMade: 0,
        maxAttempts: 5,
        queuedAt: now,
        metadata: { emailId: "email-history-001", matterId: "matter-001" },
      },
    });
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-history-other-matter",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        templateKey: "intake.generated",
        status: "queued",
        to: ["staff@example.test"],
        cc: [],
        bcc: [],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Synthetic intake notice",
        htmlBody: "",
        textBody: "Synthetic body",
        queuedAt: "2026-04-25T13:00:00.000Z",
        attemptCount: 0,
        metadata: { matterId: "matter-002", provider: "mailpit" },
      },
      event: {
        id: "email-event-history-other",
        firmId: "firm-west-legal",
        emailId: "email-history-other-matter",
        eventType: "queued",
        occurredAt: "2026-04-25T13:00:00.000Z",
        source: "api",
        metadata: { provider: "mailpit" },
      },
      job: {
        id: "job-email-history-other",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-history-other-matter",
        attemptsMade: 0,
        maxAttempts: 5,
        queuedAt: "2026-04-25T13:00:00.000Z",
        metadata: { emailId: "email-history-other-matter", matterId: "matter-002" },
      },
    });

    await repository.recordEmailDeliveryResult({
      firmId: "firm-west-legal",
      emailId: "email-history-001",
      status: "sending",
      occurredAt: "2026-04-25T12:01:00.000Z",
      attemptNumber: 1,
      jobId: "job-email-history-001",
      source: "worker",
      metadata: { provider: "mailpit" },
    });
    await repository.recordEmailDeliveryResult({
      firmId: "firm-west-legal",
      emailId: "email-history-001",
      status: "failed",
      occurredAt: "2026-04-25T12:02:00.000Z",
      attemptNumber: 1,
      jobId: "job-email-history-001",
      source: "worker",
      terminal: true,
      errorMessage: " SMTP refused synthetic message ".repeat(20),
      metadata: { provider: "mailpit", terminal: true },
    });

    await expect(
      repository.listEmailOutbox("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toMatchObject([
      {
        id: "email-history-001",
        matterId: "matter-001",
        status: "failed",
        attemptCount: 1,
        lastAttemptAt: "2026-04-25T12:02:00.000Z",
        terminalFailureAt: "2026-04-25T12:02:00.000Z",
        terminalFailureReason: expect.stringContaining("SMTP refused synthetic message"),
      },
    ]);
    await expect(
      repository.listEmailOutbox("other-firm", { matterId: "matter-001" }),
    ).resolves.toEqual([]);
    const events = await repository.listEmailEvents("firm-west-legal", {
      emailId: "email-history-001",
    });
    expect(events.map((event) => event.eventType)).toEqual(["queued", "sending", "failed"]);
    expect(events.at(-1)).toMatchObject({
      attemptNumber: 1,
      jobId: "job-email-history-001",
      source: "worker",
      errorMessage: expect.stringContaining("SMTP refused synthetic message"),
    });
    expect(events.at(-1)?.errorMessage?.length).toBeLessThanOrEqual(240);
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
      {
        id: "calendar-event-002",
        matterId: "matter-001",
        attendees: [{ id: "calendar-attendee-001", email: "ada.morgan@example.test" }],
      },
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

  it("creates, updates, soft-deletes, and replaces calendar event attendees", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const attendee = await repository.upsertCalendarEventAttendee({
      id: "calendar-attendee-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      eventId: "calendar-event-001",
      name: "Synthetic Attendee",
      email: "synthetic.attendee@example.test",
      role: "required",
      responseStatus: "needs_action",
      invitationStatus: "not_sent",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
    });

    await expect(
      repository.listCalendarEventAttendees("firm-west-legal", "matter-001", "calendar-event-001"),
    ).resolves.toMatchObject([{ id: attendee.id, invitationStatus: "not_sent" }]);

    await expect(
      repository.upsertCalendarEventAttendee({
        ...attendee,
        responseStatus: "accepted",
        invitationStatus: "queued",
        invitationEmailId: "email-test",
        invitationJobId: "job-test",
        invitedAt: "2026-04-25T12:05:00.000Z",
        updatedAt: "2026-04-25T12:05:00.000Z",
      }),
    ).resolves.toMatchObject({
      responseStatus: "accepted",
      invitationStatus: "queued",
      invitationEmailId: "email-test",
    });

    await expect(
      repository.deleteCalendarEventAttendee({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: "calendar-event-001",
        attendeeId: attendee.id,
        deletedAt: "2026-04-25T12:10:00.000Z",
        updatedByUserId: "user-licensee",
      }),
    ).resolves.toMatchObject({ deletedAt: "2026-04-25T12:10:00.000Z" });

    await expect(
      repository.replaceCalendarEventAttendees({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: "calendar-event-001",
        replacedAt: "2026-04-25T12:15:00.000Z",
        updatedByUserId: "user-licensee",
        attendees: [
          {
            ...attendee,
            id: "calendar-attendee-replaced",
            email: "replacement@example.test",
            invitationStatus: "not_sent",
            invitationEmailId: undefined,
            invitationJobId: undefined,
            invitedAt: undefined,
            deletedAt: undefined,
            createdAt: "2026-04-25T12:15:00.000Z",
            updatedAt: "2026-04-25T12:15:00.000Z",
          },
        ],
      }),
    ).resolves.toMatchObject([{ id: "calendar-attendee-replaced" }]);

    await expect(
      repository.listCalendarEventAttendees("firm-west-legal", "matter-002", "calendar-event-001"),
    ).resolves.toEqual([]);
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
    await repository.createInboundEmailAddress({
      id: "inbound-address-001",
      firmId: "firm-west-legal",
      address: "matter-001@open-practice.test",
      matterId: "matter-001",
      enabled: true,
      createdAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-disabled",
      firmId: "firm-west-legal",
      address: "archive@open-practice.test",
      enabled: false,
      createdAt: now,
    });

    await expect(repository.listInboundEmailAddresses("firm-west-legal")).resolves.toMatchObject([
      {
        id: "inbound-address-001",
        address: "matter-001@open-practice.test",
        matterId: "matter-001",
        enabled: true,
      },
      {
        id: "inbound-address-disabled",
        address: "archive@open-practice.test",
        enabled: false,
      },
    ]);
    await expect(
      repository.createInboundEmailAddress({
        id: "inbound-address-duplicate",
        firmId: "firm-west-legal",
        address: "MATTER-001@open-practice.test",
        matterId: "matter-001",
        enabled: true,
        createdAt: now,
      }),
    ).rejects.toThrow(/already exists/);

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

    const promoted = await repository.promoteInboundEmailAttachmentToDocument({
      firmId: "firm-west-legal",
      messageId: message.id,
      attachmentId: "inbound-attachment-001",
      matterId: "matter-001",
      title: "Filed materials.pdf",
      classification: "work_product",
      legalHold: true,
      now,
    });
    expect(promoted).toMatchObject({
      created: true,
      attachment: { id: "inbound-attachment-001", documentId: promoted.document.id },
      document: {
        title: "Filed materials.pdf",
        matterId: "matter-001",
        storageKey: "inbound/message-001/filing.pdf",
        checksumSha256: "a".repeat(64),
        classification: "work_product",
        legalHold: true,
        uploadStatus: "verified",
        checksumStatus: "verified",
        scanStatus: "queued",
        uploadedAt: now,
        verifiedAt: now,
      },
    });
    await expect(
      repository.listInboundEmailAttachments("firm-west-legal", message.id),
    ).resolves.toMatchObject([{ documentId: promoted.document.id }]);

    await expect(
      repository.promoteInboundEmailAttachmentToDocument({
        firmId: "firm-west-legal",
        messageId: message.id,
        attachmentId: "inbound-attachment-001",
        matterId: "matter-001",
        title: "Duplicate call.pdf",
        classification: "general",
        legalHold: false,
      }),
    ).resolves.toMatchObject({
      created: false,
      document: { id: promoted.document.id, title: "Filed materials.pdf" },
    });
  });

  it("marks promoted inbound attachments as duplicates when their checksum already exists", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { message, attachment } = await createInboundMessageWithAttachment(repository, {
      messageId: "inbound-message-duplicate",
      attachmentId: "inbound-attachment-duplicate",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
    });

    await expect(
      repository.promoteInboundEmailAttachmentToDocument({
        firmId: "firm-west-legal",
        messageId: message.id,
        attachmentId: attachment.id,
        matterId: "matter-002",
        title: "Duplicate retainer.pdf",
        classification: "general",
        legalHold: false,
        now,
      }),
    ).resolves.toMatchObject({
      created: true,
      document: {
        checksumStatus: "duplicate",
        duplicateOfDocumentId: "doc-001",
        uploadStatus: "verified",
        scanStatus: "queued",
      },
    });
  });

  it("rejects inbound attachment promotion when the attachment has no checksum", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { message, attachment } = await createInboundMessageWithAttachment(repository, {
      messageId: "inbound-message-missing-checksum",
      attachmentId: "inbound-attachment-missing-checksum",
    });

    await expect(
      repository.promoteInboundEmailAttachmentToDocument({
        firmId: "firm-west-legal",
        messageId: message.id,
        attachmentId: attachment.id,
        matterId: "matter-002",
        title: "Missing checksum.pdf",
        classification: "general",
        legalHold: false,
        now,
      }),
    ).rejects.toThrow(/checksum is required/);
    await expect(
      repository.listInboundEmailAttachments("firm-west-legal", message.id),
    ).resolves.toMatchObject([{ id: attachment.id }]);
    await expect(repository.listMatterDocuments("firm-west-legal", "matter-002")).resolves.toEqual(
      [],
    );
  });

  it("preserves embedded intake template definitions and answer resolution snapshots", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const [template] = await repository.listIntakeTemplates("firm-west-legal");
    const resolution = {
      templateId: template.id,
      templateVersion: template.definitionVersion,
      visibleQuestionIds: [
        "issue_type",
        "urgent",
        "repair_details",
        "client_display_name",
        "matter_title",
      ],
      visibleFormItemIds: [
        "intro",
        "client-name-item",
        "matter-title-item",
        "issue-type-item",
        "urgent-item",
        "repair-details-item",
        "evidence-upload",
        "client-attestation",
      ],
      requiredIncompleteItemIds: ["evidence-upload", "client-attestation"],
      eligiblePackageIds: ["repair_notice_package"],
      selectedPackageIds: ["repair_notice_package"],
      packageDocuments: [
        {
          packageId: "repair_notice_package",
          packageDocumentId: "repair_notice_letter",
          title: "Repair notice letter",
        },
      ],
    };

    expect(template).toMatchObject({
      id: "intake-template-001",
      definitionVersion: 2,
      definition: expect.objectContaining({
        schemaVersion: 2,
        sections: expect.arrayContaining([expect.objectContaining({ id: "issue-details" })]),
        packages: expect.arrayContaining([
          expect.objectContaining({ id: "repair_notice_package" }),
        ]),
      }),
    });
    await repository.createAnswerSnapshot({
      id: "answer-snapshot-resolution",
      firmId: "firm-west-legal",
      intakeSessionId: "intake-session-001",
      capturedAt: now,
      answers: { issue_type: "repair" },
      resolution,
    });
    await expect(
      repository.listAnswerSnapshots("firm-west-legal", {
        intakeSessionId: "intake-session-001",
      }),
    ).resolves.toEqual([expect.objectContaining({ resolution })]);
    await expect(
      repository.createGeneratedDocument({
        id: "generated-package-doc",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-session-001",
        provider: "embedded",
        externalId: "embedded:intake-session-001:repair_notice_package:repair_notice_letter",
        title: "Repair notice letter",
        packageId: "repair_notice_package",
        packageDocumentId: "repair_notice_letter",
        evidence: {},
        createdAt: now,
      }),
    ).resolves.toMatchObject({
      packageId: "repair_notice_package",
      packageDocumentId: "repair_notice_letter",
    });
  });

  it("maps draft assist records and review decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const created = await repository.createDraftAssistRecord({
      id: "draft-assist-record-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      sourceType: "draft",
      draftId: "draft-001",
      task: "summarize",
      providerKey: "fake-local-ai",
      providerModel: "fake-model",
      status: "suggested",
      suggestedText: "Synthetic suggestion",
      summary: "Synthetic summary",
      createdByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      metadata: { sourceTextLength: 24 },
    });
    const reviewed = await repository.updateDraftAssistRecord({
      ...created,
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-05-01T00:05:00.000Z",
      updatedAt: "2026-05-01T00:05:00.000Z",
    });

    expect(reviewed).toMatchObject({
      id: "draft-assist-record-test",
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedByUserId: "user-admin",
    });
    await expect(
      repository.listDraftAssistRecords("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual([expect.objectContaining({ id: "draft-assist-record-test" })]);
    await expect(
      repository.listDraftAssistRecords("firm-west-legal", { draftId: "missing" }),
    ).resolves.toEqual([]);
  });
});
