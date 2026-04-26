import { describe, expect, it } from "vitest";
import { appendAuditEvent, type Firm } from "@open-practice/domain";
import {
  InMemoryOpenPracticeRepository,
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
});
