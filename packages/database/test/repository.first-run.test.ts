import { describe, expect, it } from "vitest";
import { DrizzleOpenPracticeRepository } from "../src/repository/drizzle.js";
import { FirstRunSetupConflictError } from "../src/repository/contracts.js";
import * as schema from "../src/schema.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now, setupInput } from "./repository.fixtures.js";

type DrizzleDb = ConstructorParameters<typeof DrizzleOpenPracticeRepository>[0];

function drizzleRepositoryWithSetupRows(input: {
  firms?: Record<string, unknown>[];
  users?: Record<string, unknown>[];
}) {
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        limit: async () => {
          if (table === schema.firms) return input.firms ?? [];
          if (table === schema.users) return input.users ?? [];
          return [];
        },
      }),
    }),
  } as unknown as DrizzleDb;
  return new DrizzleOpenPracticeRepository(db);
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

  it("resolves the sole configured firm for single-tenant auth", async () => {
    const input = setupInput();
    const memory = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    await memory.completeFirstRunSetup(input);

    await expect(memory.resolveConfiguredFirm()).resolves.toEqual({
      status: "ready",
      firm: input.firm,
    });
    await expect(
      drizzleRepositoryWithSetupRows({
        firms: [{ ...input.firm, createdAt: new Date(now) }],
        users: [{ id: input.owner.id }],
      }).resolveConfiguredFirm(),
    ).resolves.toEqual({
      status: "ready",
      firm: input.firm,
    });
  });

  it("reports setup-required or blocked firm resolution states", async () => {
    await expect(
      new InMemoryOpenPracticeRepository({ seedSampleData: false }).resolveConfiguredFirm(),
    ).resolves.toEqual({ status: "setup_required" });
    await expect(drizzleRepositoryWithSetupRows({}).resolveConfiguredFirm()).resolves.toEqual({
      status: "setup_required",
    });

    const firms = [
      { id: "firm-one", name: "Firm One", defaultProvince: "BC", createdAt: new Date(now) },
      { id: "firm-two", name: "Firm Two", defaultProvince: "ON", createdAt: new Date(now) },
    ];
    const blockedMemory = new InMemoryOpenPracticeRepository({
      seedSampleData: false,
      firms: [
        { id: "firm-one", name: "Firm One", defaultProvince: "BC" },
        { id: "firm-two", name: "Firm Two", defaultProvince: "ON" },
      ],
    });

    await expect(blockedMemory.resolveConfiguredFirm()).resolves.toMatchObject({
      status: "blocked",
    });
    await expect(
      drizzleRepositoryWithSetupRows({
        firms,
        users: [{ id: "user-one" }],
      }).resolveConfiguredFirm(),
    ).resolves.toMatchObject({
      status: "blocked",
    });
  });

  it("blocks single-tenant firm resolution for partial first-run state", async () => {
    const input = setupInput();
    await expect(
      new InMemoryOpenPracticeRepository({
        seedSampleData: false,
        firms: [input.firm],
      }).resolveConfiguredFirm(),
    ).resolves.toMatchObject({
      status: "blocked",
    });
    await expect(
      drizzleRepositoryWithSetupRows({
        firms: [{ ...input.firm, createdAt: new Date(now) }],
      }).resolveConfiguredFirm(),
    ).resolves.toMatchObject({
      status: "blocked",
    });
  });
});
