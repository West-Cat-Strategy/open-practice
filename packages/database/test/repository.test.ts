import { describe, expect, it } from "vitest";
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
