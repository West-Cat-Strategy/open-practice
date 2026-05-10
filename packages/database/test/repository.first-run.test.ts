import { describe, expect, it } from "vitest";
import { FirstRunSetupConflictError } from "../src/repository/contracts.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now, setupInput } from "./repository.fixtures.js";

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
