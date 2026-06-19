import { type LedgerAccount } from "@open-practice/domain";
import { describe, expect, it } from "vitest";
import type { OpenPracticeDatabase } from "../src/runtime.js";
import { listDrizzleFilteredAuditEvents } from "../src/repository/audit/drizzle.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

describe("repository audit event ordering", () => {
  it("appends audit events with monotonic per-firm sequences", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    const appended = await Promise.all(
      ["audit-sequence-001", "audit-sequence-002", "audit-sequence-003"].map((id) =>
        repository.appendAuditEvent({
          id,
          firmId: "firm-west-legal",
          actorId: "user-admin",
          action: "matter.timeline_sensitive",
          resourceType: "matter",
          resourceId: "matter-001",
          occurredAt: "2026-04-08T17:00:00.000Z",
          metadata: { matterId: "matter-001" },
        }),
      ),
    );

    expect(appended.map((event) => event.sequence)).toEqual([3, 4, 5]);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      valid: true,
      events: expect.arrayContaining([
        expect.objectContaining({ id: "audit-sequence-001", sequence: 3 }),
        expect.objectContaining({ id: "audit-sequence-002", sequence: 4 }),
        expect.objectContaining({ id: "audit-sequence-003", sequence: 5 }),
      ]),
    });
  });

  it("recomputes chain fields for legacy recordAuditEvent calls", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await repository.recordAuditEvent({
      id: "audit-record-legacy",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      action: "matter.timeline_sensitive",
      resourceType: "matter",
      resourceId: "matter-001",
      sequence: 999,
      occurredAt: "2026-04-08T17:00:00.000Z",
      metadata: { matterId: "matter-001" },
      previousHash: "forged-previous-hash",
      hash: "forged-hash",
    });

    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      valid: true,
      events: expect.arrayContaining([
        expect.objectContaining({
          id: "audit-record-legacy",
          sequence: 3,
          previousHash: expect.not.stringMatching(/^forged/),
          hash: expect.not.stringMatching(/^forged/),
        }),
      ]),
    });
  });
});

describe("repository filtered audit event reads", () => {
  it("filters memory audit events by action, matter, resource, and combined predicates in sequence order", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });

    await repository.appendAuditEvent({
      id: "audit-resource-matter",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      action: "matter.updated",
      resourceType: "matter",
      resourceId: "matter-001",
      occurredAt: "2026-06-19T17:04:00.000Z",
      metadata: { safeSummary: "Synthetic matter resource event." },
    });
    await repository.appendAuditEvent({
      id: "audit-metadata-matter-id",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      action: "invoice.approved",
      resourceType: "invoice",
      resourceId: "invoice-001",
      occurredAt: "2026-06-19T17:03:00.000Z",
      metadata: { matterId: "matter-001", invoiceId: "invoice-001" },
    });
    await repository.appendAuditEvent({
      id: "audit-metadata-matter-ids",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      action: "ledger.transaction_approval.decided",
      resourceType: "ledger_transaction_approval",
      resourceId: "approval-001",
      occurredAt: "2026-06-19T17:02:00.000Z",
      metadata: { matterIds: ["matter-001", "matter-002"], decision: "approved" },
    });
    await repository.appendAuditEvent({
      id: "audit-previous-matter-id",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      action: "inbound_email.triage.updated",
      resourceType: "inbound_email",
      resourceId: "email-001",
      occurredAt: "2026-06-19T17:01:00.000Z",
      metadata: { previousMatterId: "matter-001" },
    });
    await repository.appendAuditEvent({
      id: "audit-other-matter",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      action: "invoice.approved",
      resourceType: "invoice",
      resourceId: "invoice-002",
      occurredAt: "2026-06-19T17:00:00.000Z",
      metadata: { matterId: "matter-002", invoiceId: "invoice-002" },
    });
    await repository.appendAuditEvent({
      id: "audit-other-firm",
      firmId: "firm-east-legal",
      actorId: "user-admin",
      action: "invoice.approved",
      resourceType: "invoice",
      resourceId: "invoice-003",
      occurredAt: "2026-06-19T17:05:00.000Z",
      metadata: { matterId: "matter-001", invoiceId: "invoice-003" },
    });

    await expect(
      repository.listFilteredAuditEvents("firm-west-legal", { actions: ["invoice.approved"] }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "audit-metadata-matter-id", sequence: 2 }),
      expect.objectContaining({ id: "audit-other-matter", sequence: 5 }),
    ]);
    await expect(
      repository.listFilteredAuditEvents("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "audit-resource-matter", sequence: 1 }),
      expect.objectContaining({ id: "audit-metadata-matter-id", sequence: 2 }),
      expect.objectContaining({ id: "audit-metadata-matter-ids", sequence: 3 }),
      expect.objectContaining({ id: "audit-previous-matter-id", sequence: 4 }),
    ]);
    await expect(
      repository.listFilteredAuditEvents("firm-west-legal", {
        resourceType: "invoice",
        resourceId: "invoice-001",
      }),
    ).resolves.toEqual([expect.objectContaining({ id: "audit-metadata-matter-id" })]);
    await expect(
      repository.listFilteredAuditEvents("firm-west-legal", {
        actions: ["invoice.approved"],
        matterId: "matter-001",
      }),
    ).resolves.toEqual([expect.objectContaining({ id: "audit-metadata-matter-id" })]);
  });

  it("does not fall back to a full audit read for empty action filters", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.listFilteredAuditEvents("firm-west-legal", { actions: [] }),
    ).resolves.toEqual([]);
    await expect(
      listDrizzleFilteredAuditEvents(
        {
          select: () => {
            throw new Error("empty action filters must not query audit_events");
          },
        } as unknown as OpenPracticeDatabase,
        "firm-west-legal",
        { actions: [] },
      ),
    ).resolves.toEqual([]);
  });
});

describe("repository operations activity redaction", () => {
  it("builds audit-safe matter activity across existing matter records", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await repository.appendAuditEvent({
      id: "audit-timeline-sensitive",
      firmId: "firm-west-legal",
      actorId: "user-licensee",
      action: "matter.timeline_sensitive",
      resourceType: "matter",
      resourceId: "matter-001",
      occurredAt: "2026-04-08T17:00:00.000Z",
      metadata: {
        matterId: "matter-001",
        safeSummary: "kept",
        tokenHash: "timeline-token-hash",
        textBody: "Synthetic body that must not be surfaced.",
        evidence: { storageKey: "timeline/evidence.json" },
      },
    });
    await repository.createGeneratedDocument({
      id: "generated-timeline",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      intakeSessionId: "intake-session-001",
      provider: "embedded",
      externalId: "embedded:generated-timeline",
      title: "Synthetic generated chronology",
      documentId: "doc-001",
      packageId: "package-alpha",
      packageDocumentId: "chronology",
      storageKey: "generated/private/chronology.pdf",
      checksumSha256: "generated-checksum",
      evidence: { body: "private generated document evidence" },
      createdAt: "2026-04-08T18:00:00.000Z",
    });
    await repository.createShareLink({
      id: "share-timeline",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "share-token-hash",
      grantedByUserId: "user-licensee",
      permissions: ["view_documents"],
      requireEmailVerification: true,
      createdAt: "2026-04-09T17:00:00.000Z",
    });
    await repository.createExternalUploadLink({
      id: "upload-timeline",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "upload-token-hash",
      requestedByUserId: "user-licensee",
      expiresAt: "2026-04-16T17:00:00.000Z",
      maxUploads: 2,
      usedUploads: 1,
      createdAt: "2026-04-09T18:00:00.000Z",
    });
    await repository.createAccessLog({
      id: "access-share-timeline",
      firmId: "firm-west-legal",
      shareLinkId: "share-timeline",
      resourceType: "document",
      resourceId: "doc-001",
      action: "download",
      occurredAt: "2026-04-10T17:00:00.000Z",
      ipAddress: "127.0.0.1",
      userAgent: "Synthetic private browser",
      metadata: { tokenHash: "share-token-hash" },
    });
    await repository.createAccessLog({
      id: "access-upload-timeline",
      firmId: "firm-west-legal",
      externalUploadLinkId: "upload-timeline",
      resourceType: "document",
      resourceId: "doc-uploaded",
      action: "upload",
      occurredAt: "2026-04-10T18:00:00.000Z",
      metadata: { body: "private upload metadata" },
    });
    await repository.createDocumentUploadIntent({
      id: "doc-upload-review-timeline",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      title: "Synthetic externally uploaded record",
      storageKey: "external/private/upload-review.pdf",
      checksumSha256: "upload-review-checksum",
      classification: "general",
      legalHold: false,
      reviewStatus: "pending_review",
      externalUploadLinkId: "upload-timeline",
    });
    await repository.reviewUploadedDocument({
      firmId: "firm-west-legal",
      documentId: "doc-upload-review-timeline",
      status: "accepted",
      decision: "accept",
      reason: "other",
      metadata: {
        reviewerNote: "Private review note",
        storageKey: "review/private/evidence.json",
      },
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-04-10T19:00:00.000Z",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-upload-review-pending",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      title: "Synthetic pending external upload",
      storageKey: "external/private/pending-review.pdf",
      checksumSha256: "pending-review-checksum",
      classification: "general",
      legalHold: false,
      reviewStatus: "pending_review",
      externalUploadLinkId: "upload-timeline",
    });
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-timeline",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        templateKey: "signature.requested",
        status: "queued",
        to: ["private-client@example.test"],
        cc: ["private-staff@example.test"],
        bcc: ["private-bcc@example.test"],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Private subject must not surface",
        htmlBody: "<p>Private HTML body</p>",
        textBody: "Private text body",
        relatedResourceType: "signature_request",
        relatedResourceId: "sig-001",
        queuedAt: "2026-04-11T16:00:00.000Z",
        attemptCount: 0,
        metadata: {
          idempotencyFingerprint: "email-timeline-fingerprint",
          providerMessageId: "provider-private-message",
          tokenHash: "email-token-hash",
        },
      },
      event: {
        id: "email-event-timeline",
        firmId: "firm-west-legal",
        emailId: "email-timeline",
        eventType: "queued",
        occurredAt: "2026-04-11T16:00:00.000Z",
        jobId: "job-email-timeline",
        source: "api",
        metadata: { providerMessageId: "provider-private-message" },
      },
      job: {
        id: "job-email-timeline",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-timeline",
        attemptsMade: 0,
        maxAttempts: 5,
        queuedAt: "2026-04-11T16:00:00.000Z",
        metadata: { emailId: "email-timeline", matterId: "matter-001" },
      },
    });
    await repository.recordEmailDeliveryResult({
      firmId: "firm-west-legal",
      emailId: "email-timeline",
      status: "failed",
      occurredAt: "2026-04-11T16:03:00.000Z",
      attemptNumber: 1,
      jobId: "job-email-timeline",
      source: "worker",
      terminal: true,
      errorMessage: " SMTP refused private-client@example.test with transient detail ",
      metadata: { providerMessageId: "provider-private-message" },
    });
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-timeline-other",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        templateKey: "intake.generated",
        status: "queued",
        to: ["other-private@example.test"],
        cc: [],
        bcc: [],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Other private subject",
        htmlBody: "",
        textBody: "Other private body",
        queuedAt: "2026-04-11T16:30:00.000Z",
        attemptCount: 0,
        metadata: { tokenHash: "other-email-token-hash" },
      },
      event: {
        id: "email-event-timeline-other",
        firmId: "firm-west-legal",
        emailId: "email-timeline-other",
        eventType: "queued",
        occurredAt: "2026-04-11T16:30:00.000Z",
        source: "api",
        metadata: {},
      },
      job: {
        id: "job-email-timeline-other",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-timeline-other",
        attemptsMade: 0,
        maxAttempts: 5,
        queuedAt: "2026-04-11T16:30:00.000Z",
        metadata: { emailId: "email-timeline-other", matterId: "matter-002" },
      },
    });
    await repository.createPayment({
      payment: {
        id: "payment-timeline",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        clientContactId: "contact-ada",
        receivedAt: "2026-04-11T17:00:00.000Z",
        amountCents: 1000,
        method: "eft",
        reference: "private-reference",
        status: "received",
        receivedByUserId: "user-licensee",
        notes: "Private payment note",
        evidence: { receiptStorageKey: "payments/private-receipt.pdf" },
      },
      allocations: [],
    });

    const user = (await repository.getUser("firm-west-legal", "user-admin"))!;
    const matters = await repository.listMattersForUser(user);
    const matter = matters.find((candidate) => candidate.id === "matter-001")!;
    const otherMatter = matters.find((candidate) => candidate.id === "matter-002")!;
    const entriesById = new Map(matter.activity.map((entry) => [entry.id, entry]));

    expect(matter.activity.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining([
        "billing",
        "calendar",
        "contact",
        "document",
        "email",
        "intake",
        "ledger",
        "portal",
        "share",
        "signature",
        "task",
        "upload",
      ]),
    );
    expect(entriesById.get("audit-timeline-sensitive")?.metadata).toEqual({
      matterId: "matter-001",
      safeSummary: "kept",
    });
    expect(entriesById.get("share:share-timeline")?.metadata).not.toHaveProperty("tokenHash");
    expect(entriesById.get("upload-link:upload-timeline")?.metadata).not.toHaveProperty(
      "tokenHash",
    );
    expect(entriesById.get("upload-review:doc-upload-review-timeline")).toMatchObject({
      kind: "upload",
      actorId: "user-licensee",
      metadata: {
        documentId: "doc-upload-review-timeline",
        externalUploadLinkId: "upload-timeline",
        reviewStatus: "accepted",
        reviewDecision: "accept",
        reviewReason: "other",
        reviewedByUserId: "user-licensee",
      },
    });
    expect(entriesById.has("upload-review:doc-upload-review-pending")).toBe(false);
    expect(entriesById.get("email:email-timeline")).toMatchObject({
      kind: "email",
      matterId: "matter-001",
      metadata: {
        templateKey: "signature.requested",
        status: "failed",
        recipientCount: 3,
        relatedResourceType: "signature_request",
        relatedResourceId: "sig-001",
        attemptCount: 1,
        failureSummary: expect.stringContaining("[redacted-email]"),
      },
    });
    expect(entriesById.get("payment:payment-timeline")?.metadata).not.toHaveProperty("evidence");
    expect(JSON.stringify(matter.activity)).not.toContain("share-token-hash");
    expect(JSON.stringify(matter.activity)).not.toContain("upload-review-checksum");
    expect(JSON.stringify(matter.activity)).not.toContain("external/private/upload-review.pdf");
    expect(JSON.stringify(matter.activity)).not.toContain("Private review note");
    expect(JSON.stringify(matter.activity)).not.toContain("Private subject must not surface");
    expect(JSON.stringify(matter.activity)).not.toContain("Private HTML body");
    expect(JSON.stringify(matter.activity)).not.toContain("Private text body");
    expect(JSON.stringify(matter.activity)).not.toContain("private-client@example.test");
    expect(JSON.stringify(matter.activity)).not.toContain("provider-private-message");
    expect(JSON.stringify(matter.activity)).not.toContain("email-token-hash");
    expect(JSON.stringify(matter.activity)).not.toContain("Private payment note");
    expect(JSON.stringify(matter.activity)).not.toContain("generated/private/chronology.pdf");
    expect(otherMatter.activity.map((entry) => entry.id)).not.toEqual(
      expect.arrayContaining([
        "share:share-timeline",
        "upload-link:upload-timeline",
        "upload-review:doc-upload-review-timeline",
        "email:email-timeline",
      ]),
    );
  });
});

describe("repository matter setup projection", () => {
  it("keeps memory matter activity lookup maps scoped when child ids collide across firms", async () => {
    const repository = new InMemoryOpenPracticeRepository({
      seedSampleData: false,
      firms: [
        { id: "firm-west-collision", name: "West Collision Firm", defaultProvince: "BC" },
        { id: "firm-east-collision", name: "East Collision Firm", defaultProvince: "ON" },
      ],
      users: [
        {
          id: "user-west-collision",
          firmId: "firm-west-collision",
          displayName: "West Synthetic Owner",
          email: "west-collision@example.test",
          role: "owner_admin",
          assignedMatterIds: [],
          mfaEnabled: false,
        },
        {
          id: "user-east-collision",
          firmId: "firm-east-collision",
          displayName: "East Synthetic Owner",
          email: "east-collision@example.test",
          role: "owner_admin",
          assignedMatterIds: [],
          mfaEnabled: false,
        },
      ],
    });
    const contactId = "contact-collision-client";
    const westMatterId = "matter-west-collision";
    const eastMatterId = "matter-east-collision";

    await repository.createMatterWithClient({
      firmId: "firm-west-collision",
      actorUserId: "user-west-collision",
      matterId: westMatterId,
      contactId,
      partyId: "party-west-collision",
      title: "West synthetic collision matter",
      practiceArea: "Residential tenancy",
      jurisdiction: "BC",
      openedOn: "2026-04-25",
      occurredAt: "2026-04-25T12:00:00.000Z",
      auditEventId: "audit-west-collision",
      client: {
        kind: "person",
        displayName: "West Synthetic Client",
        identifiers: [{ type: "email", value: "west-client@example.test" }],
      },
    });
    await repository.createMatterWithClient({
      firmId: "firm-east-collision",
      actorUserId: "user-east-collision",
      matterId: eastMatterId,
      contactId,
      partyId: "party-east-collision",
      title: "East synthetic collision matter",
      practiceArea: "Civil litigation",
      jurisdiction: "ON",
      openedOn: "2026-04-25",
      occurredAt: "2026-04-25T12:05:00.000Z",
      auditEventId: "audit-east-collision",
      client: {
        kind: "person",
        displayName: "East Synthetic Client",
        identifiers: [{ type: "email", value: "east-client@example.test" }],
      },
    });

    await repository.createDocumentUploadIntent({
      id: "doc-west-collision",
      firmId: "firm-west-collision",
      matterId: westMatterId,
      title: "West synthetic document",
      storageKey: "synthetic/west/collision.pdf",
      checksumSha256: "west-collision-checksum",
      classification: "general",
      legalHold: false,
    });
    await repository.createDocumentUploadIntent({
      id: "doc-east-collision",
      firmId: "firm-east-collision",
      matterId: eastMatterId,
      title: "East synthetic document",
      storageKey: "synthetic/east/collision.pdf",
      checksumSha256: "east-collision-checksum",
      classification: "general",
      legalHold: false,
    });
    await repository.createTimeEntry({
      id: "time-west-collision",
      firmId: "firm-west-collision",
      matterId: westMatterId,
      userId: "user-west-collision",
      performedAt: "2026-04-25T13:00:00.000Z",
      minutes: 30,
      rateCents: 10000,
      narrative: "Synthetic west work",
      billable: true,
      billingStatus: "draft",
    });
    await repository.createTimeEntry({
      id: "time-east-collision",
      firmId: "firm-east-collision",
      matterId: eastMatterId,
      userId: "user-east-collision",
      performedAt: "2026-04-25T13:05:00.000Z",
      minutes: 45,
      rateCents: 10000,
      narrative: "Synthetic east work",
      billable: true,
      billingStatus: "draft",
    });
    await repository.createExpenseEntry({
      id: "expense-west-collision",
      firmId: "firm-west-collision",
      matterId: westMatterId,
      incurredAt: "2026-04-25",
      amountCents: 1200,
      category: "filing",
      description: "Synthetic west expense",
      reimbursable: true,
      billingStatus: "draft",
    });
    await repository.createExpenseEntry({
      id: "expense-east-collision",
      firmId: "firm-east-collision",
      matterId: eastMatterId,
      incurredAt: "2026-04-25",
      amountCents: 1800,
      category: "filing",
      description: "Synthetic east expense",
      reimbursable: true,
      billingStatus: "draft",
    });
    await repository.createShareLink({
      id: "share-collision",
      firmId: "firm-west-collision",
      matterId: westMatterId,
      tokenHash: "share-token-west-collision",
      grantedByUserId: "user-west-collision",
      permissions: ["view_documents"],
      requireEmailVerification: false,
      createdAt: "2026-04-25T14:00:00.000Z",
    });
    await repository.createShareLink({
      id: "share-collision",
      firmId: "firm-east-collision",
      matterId: eastMatterId,
      tokenHash: "share-token-east-collision",
      grantedByUserId: "user-east-collision",
      permissions: ["view_documents"],
      requireEmailVerification: false,
      createdAt: "2026-04-25T14:05:00.000Z",
    });
    await repository.createExternalUploadLink({
      id: "upload-collision",
      firmId: "firm-west-collision",
      matterId: westMatterId,
      tokenHash: "upload-token-west-collision",
      requestedByUserId: "user-west-collision",
      expiresAt: "2026-05-01T00:00:00.000Z",
      maxUploads: 2,
      usedUploads: 0,
      createdAt: "2026-04-25T14:10:00.000Z",
    });
    await repository.createExternalUploadLink({
      id: "upload-collision",
      firmId: "firm-east-collision",
      matterId: eastMatterId,
      tokenHash: "upload-token-east-collision",
      requestedByUserId: "user-east-collision",
      expiresAt: "2026-05-01T00:00:00.000Z",
      maxUploads: 2,
      usedUploads: 0,
      createdAt: "2026-04-25T14:15:00.000Z",
    });
    await repository.createAccessLog({
      id: "access-share-west-collision",
      firmId: "firm-west-collision",
      shareLinkId: "share-collision",
      resourceType: "document",
      resourceId: "doc-west-collision",
      action: "view",
      occurredAt: "2026-04-25T14:20:00.000Z",
      metadata: {},
    });
    await repository.createAccessLog({
      id: "access-upload-west-collision",
      firmId: "firm-west-collision",
      externalUploadLinkId: "upload-collision",
      resourceType: "document",
      resourceId: "doc-west-collision",
      action: "upload",
      occurredAt: "2026-04-25T14:25:00.000Z",
      metadata: {},
    });
    (
      repository as unknown as {
        ledgerAccounts: LedgerAccount[];
      }
    ).ledgerAccounts = [
      {
        id: "acct-collision",
        firmId: "firm-west-collision",
        name: "West collision expense",
        type: "expense",
      },
      {
        id: "acct-west-offset",
        firmId: "firm-west-collision",
        name: "West collision revenue",
        type: "operating_revenue",
      },
      {
        id: "acct-collision",
        firmId: "firm-east-collision",
        name: "East collision trust",
        type: "trust_asset",
      },
    ];
    await repository.postLedgerTransaction({
      id: "ledger-west-collision",
      firmId: "firm-west-collision",
      idempotencyKey: "ledger-west-collision",
      postedByUserId: "user-west-collision",
      postedAt: "2026-04-25T14:30:00.000Z",
      entries: [
        {
          firmId: "firm-west-collision",
          matterId: westMatterId,
          clientId: contactId,
          accountId: "acct-collision",
          debitCents: 500,
          creditCents: 0,
          memo: "Synthetic west collision debit",
        },
        {
          firmId: "firm-west-collision",
          matterId: westMatterId,
          clientId: contactId,
          accountId: "acct-west-offset",
          debitCents: 0,
          creditCents: 500,
          memo: "Synthetic west collision credit",
        },
      ],
    });

    const westUser = (await repository.getUser("firm-west-collision", "user-west-collision"))!;
    const eastUser = (await repository.getUser("firm-east-collision", "user-east-collision"))!;
    const [westMatter] = await repository.listMattersForUser(westUser);
    const [eastMatter] = await repository.listMattersForUser(eastUser);
    const entriesById = new Map(westMatter?.activity.map((entry) => [entry.id, entry]));

    expect(westMatter).toMatchObject({
      id: westMatterId,
      firmId: "firm-west-collision",
      title: "West synthetic collision matter",
    });
    expect(entriesById.get("party:party-west-collision")).toMatchObject({
      title: "Matter party: West Synthetic Client",
    });
    expect(entriesById.get("access:access-share-west-collision")).toMatchObject({
      kind: "share",
      matterId: westMatterId,
    });
    expect(entriesById.get("access:access-upload-west-collision")).toMatchObject({
      kind: "upload",
      matterId: westMatterId,
    });
    expect(
      entriesById.get("ledger:ledger-west-collision:matter-west-collision:2026-04-25T14:30:00.000Z")
        ?.metadata,
    ).toMatchObject({
      accountTypes: ["expense", "operating_revenue"],
    });
    expect(westMatter?.activity.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "audit-west-collision",
        "share:share-collision",
        "upload-link:upload-collision",
        "time:time-west-collision",
        "expense:expense-west-collision",
      ]),
    );
    expect(westMatter?.activity.map((entry) => entry.id)).not.toEqual(
      expect.arrayContaining([
        "audit-east-collision",
        "time:time-east-collision",
        "expense:expense-east-collision",
      ]),
    );
    expect(JSON.stringify(westMatter?.activity)).not.toContain("East Synthetic Client");
    expect(JSON.stringify(westMatter?.activity)).not.toContain(eastMatterId);
    expect(
      JSON.stringify(
        entriesById.get(
          "ledger:ledger-west-collision:matter-west-collision:2026-04-25T14:30:00.000Z",
        ),
      ),
    ).not.toContain("trust_asset");
    expect(westMatter?.setupProfile.financialSnapshot).toMatchObject({
      unbilledTimeEntryCount: 1,
      unbilledMinutes: 30,
      unbilledExpenseCount: 1,
      unbilledExpenseCents: 1200,
    });

    expect(eastMatter).toMatchObject({
      id: eastMatterId,
      firmId: "firm-east-collision",
      title: "East synthetic collision matter",
    });
    expect(eastMatter?.activity.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "audit-east-collision",
        "party:party-east-collision",
        "time:time-east-collision",
        "expense:expense-east-collision",
      ]),
    );
  });

  it("returns setup profiles only for authorized matter summaries", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const user = (await repository.getUser("firm-west-legal", "user-licensee"))!;
    const matters = await repository.listMattersForUser(user);

    expect(matters.map((matter) => matter.id)).toEqual(["matter-001"]);
    expect(matters[0]?.setupProfile).toMatchObject({
      stage: { key: "open", label: "Open" },
      responsibleUser: {
        state: "assigned",
        responsibleUserId: "user-licensee",
      },
    });
    expect(matters[0]?.setupProfile.fieldDefinitions.map((field) => field.key)).toEqual([
      "practiceArea",
      "jurisdiction",
      "openedOn",
      "status",
    ]);
    expect(matters[0]?.setupProfile.checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "parties", state: "complete" }),
        expect.objectContaining({ key: "documents", state: "complete" }),
        expect.objectContaining({ key: "trust_balance", state: expect.any(String) }),
        expect.objectContaining({ key: "unbilled_work", state: expect.any(String) }),
      ]),
    );
  });
});
