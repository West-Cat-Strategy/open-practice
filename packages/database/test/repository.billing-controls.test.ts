import {
  billingRuleScope,
  type BillingExpenseCategoryRecord,
  type BillingPeriodLockRecord,
  type BillingRateRuleRecord,
} from "@open-practice/domain";
import { describe, expect, it } from "vitest";
import { DrizzleOpenPracticeRepository } from "../src/repository/drizzle.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

type DrizzleDb = ConstructorParameters<typeof DrizzleOpenPracticeRepository>[0];

function drizzleRepositoryWithRows(rows: Record<string, unknown>[]) {
  const inserts: unknown[] = [];
  const whereResult = Object.assign(Promise.resolve(rows), {
    orderBy: async () => rows,
  });
  const db = {
    select: () => ({
      from: () => ({
        where: () => whereResult,
      }),
    }),
    insert: () => ({
      values: async (value: unknown) => {
        inserts.push(value);
      },
    }),
  } as unknown as DrizzleDb;
  return { repository: new DrizzleOpenPracticeRepository(db), inserts };
}

function billingPeriodLockRow(lock: BillingPeriodLockRecord): Record<string, unknown> {
  return {
    ...lock,
    periodStart: new Date(lock.periodStart),
    periodEnd: new Date(lock.periodEnd),
    reason: lock.reason ?? null,
    lockedAt: new Date(lock.lockedAt),
  };
}

function billingExpenseCategoryRow(
  category: BillingExpenseCategoryRecord,
): Record<string, unknown> {
  return {
    ...category,
    matterId: category.matterId ?? null,
    reviewCue: category.reviewCue ?? null,
    createdByUserId: category.createdByUserId ?? null,
    updatedByUserId: category.updatedByUserId ?? null,
    createdAt: new Date(category.createdAt),
    updatedAt: new Date(category.updatedAt),
  };
}

function billingRateRuleRow(rule: BillingRateRuleRecord): Record<string, unknown> {
  return {
    ...rule,
    matterId: rule.matterId ?? null,
    userId: rule.userId ?? null,
    role: rule.role ?? null,
    effectiveFrom: new Date(rule.effectiveFrom),
    effectiveUntil: rule.effectiveUntil ? new Date(rule.effectiveUntil) : null,
    createdAt: new Date(rule.createdAt),
    updatedAt: new Date(rule.updatedAt),
  };
}

function syntheticLock(
  id: string,
  periodStart: string,
  periodEnd: string,
): BillingPeriodLockRecord {
  return {
    id,
    firmId: "firm-west-legal",
    periodStart,
    periodEnd,
    lockedByUserId: "user-admin",
    lockedAt: now,
  };
}

function syntheticRateRule(
  id: string,
  effectiveFrom: string,
  effectiveUntil?: string,
): BillingRateRuleRecord {
  return {
    id,
    firmId: "firm-west-legal",
    label: "Synthetic matter user rate",
    matterId: "matter-001",
    userId: "user-licensee",
    scope: billingRuleScope({ matterId: "matter-001", userId: "user-licensee" }),
    rateCents: 20000,
    effectiveFrom,
    effectiveUntil,
    active: true,
    createdByUserId: "user-admin",
    createdAt: now,
    updatedAt: now,
  };
}

function syntheticExpenseCategory(id: string, code = "synthetic_registry_fee") {
  return {
    id,
    firmId: "firm-west-legal",
    code,
    label: "Synthetic registry fee",
    active: true,
    defaultReimbursable: true,
    reimbursableAllowed: true,
    practiceAreas: ["Residential tenancy"],
    jurisdictions: ["BC"],
    reviewCue: "Synthetic receipt review.",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    createdAt: now,
    updatedAt: now,
  } satisfies BillingExpenseCategoryRecord;
}

describe("repository billing controls", () => {
  it("rejects overlapping billing period locks in memory and Drizzle repositories", async () => {
    const existing = syntheticLock(
      "billing-lock-april",
      "2026-04-01T00:00:00.000Z",
      "2026-05-01T00:00:00.000Z",
    );
    const overlapping = syntheticLock(
      "billing-lock-april-overlap",
      "2026-04-15T00:00:00.000Z",
      "2026-05-15T00:00:00.000Z",
    );
    const adjacent = syntheticLock(
      "billing-lock-may",
      "2026-05-01T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
    );

    const memory = new InMemoryOpenPracticeRepository();
    await memory.createBillingPeriodLock(existing);
    await expect(memory.createBillingPeriodLock(overlapping)).rejects.toThrow(
      "Billing period lock overlaps an existing lock",
    );
    await expect(memory.createBillingPeriodLock(adjacent)).resolves.toMatchObject({
      id: "billing-lock-may",
    });

    const drizzleOverlap = drizzleRepositoryWithRows([billingPeriodLockRow(existing)]);
    await expect(drizzleOverlap.repository.createBillingPeriodLock(overlapping)).rejects.toThrow(
      "Billing period lock overlaps an existing lock",
    );
    expect(drizzleOverlap.inserts).toHaveLength(0);

    const drizzleAdjacent = drizzleRepositoryWithRows([billingPeriodLockRow(existing)]);
    await expect(
      drizzleAdjacent.repository.createBillingPeriodLock(adjacent),
    ).resolves.toMatchObject({ id: "billing-lock-may" });
    expect(drizzleAdjacent.inserts).toHaveLength(1);
  });

  it("rejects active same-scope billing rate rule overlaps in memory and Drizzle repositories", async () => {
    const existing = syntheticRateRule(
      "billing-rate-april",
      "2026-04-01T00:00:00.000Z",
      "2026-05-01T00:00:00.000Z",
    );
    const overlapping = syntheticRateRule(
      "billing-rate-overlap",
      "2026-04-15T00:00:00.000Z",
      "2026-05-15T00:00:00.000Z",
    );
    const adjacent = syntheticRateRule("billing-rate-may", "2026-05-01T00:00:00.000Z");

    const memory = new InMemoryOpenPracticeRepository();
    await memory.createBillingRateRule(existing);
    await expect(memory.createBillingRateRule(overlapping)).rejects.toThrow(
      "Billing rate rule overlaps an active rule at the same scope",
    );
    await expect(memory.createBillingRateRule(adjacent)).resolves.toMatchObject({
      id: "billing-rate-may",
    });

    const drizzleOverlap = drizzleRepositoryWithRows([billingRateRuleRow(existing)]);
    await expect(drizzleOverlap.repository.createBillingRateRule(overlapping)).rejects.toThrow(
      "Billing rate rule overlaps an active rule at the same scope",
    );
    expect(drizzleOverlap.inserts).toHaveLength(0);

    const drizzleAdjacent = drizzleRepositoryWithRows([billingRateRuleRow(existing)]);
    await expect(drizzleAdjacent.repository.createBillingRateRule(adjacent)).resolves.toMatchObject(
      {
        id: "billing-rate-may",
      },
    );
    expect(drizzleAdjacent.inserts).toHaveLength(1);
  });

  it("enforces unique immutable expense category codes in memory and Drizzle repositories", async () => {
    const category = syntheticExpenseCategory("expense-category-synthetic");
    const memory = new InMemoryOpenPracticeRepository();

    await expect(memory.createBillingExpenseCategory(category)).resolves.toMatchObject({
      code: "synthetic_registry_fee",
    });
    await expect(
      memory.createBillingExpenseCategory({
        ...syntheticExpenseCategory("expense-category-duplicate"),
        code: "synthetic_registry_fee",
      }),
    ).rejects.toThrow("Billing expense category code already exists");
    await expect(
      memory.updateBillingExpenseCategory("firm-west-legal", category.id, {
        label: "Synthetic registry filing",
        active: false,
        updatedAt: "2026-06-17T12:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      code: "synthetic_registry_fee",
      label: "Synthetic registry filing",
      active: false,
    });

    const drizzleDuplicate = drizzleRepositoryWithRows([billingExpenseCategoryRow(category)]);
    await expect(
      drizzleDuplicate.repository.createBillingExpenseCategory(category),
    ).rejects.toThrow("Billing expense category code already exists");
    expect(drizzleDuplicate.inserts).toHaveLength(0);

    const drizzleCreated = drizzleRepositoryWithRows([]);
    await expect(
      drizzleCreated.repository.createBillingExpenseCategory(
        syntheticExpenseCategory("expense-category-drizzle", "synthetic_courier"),
      ),
    ).resolves.toMatchObject({ code: "synthetic_courier" });
    expect(drizzleCreated.inserts).toHaveLength(1);
  });
});
