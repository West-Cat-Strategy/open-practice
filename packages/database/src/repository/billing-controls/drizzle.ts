import { and, asc, desc, eq } from "drizzle-orm";
import {
  billingPeriodLocksOverlap,
  billingRateRulesOverlapAtSameActiveScope,
  validateBillingPeriodLock,
  validateBillingRateRule,
  type BillingPeriodLockRecord,
  type BillingRateRuleRecord,
} from "@open-practice/domain";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { clone } from "../contracts.js";
import {
  billingPeriodLockInsert,
  billingRateRuleInsert,
  mapBillingPeriodLockRow,
  mapBillingRateRuleRow,
} from "../drizzle-mappers.js";

export async function listDrizzleBillingPeriodLocks(
  db: OpenPracticeDatabase,
  firmId: string,
): Promise<BillingPeriodLockRecord[]> {
  const rows = await db
    .select()
    .from(schema.billingPeriodLocks)
    .where(eq(schema.billingPeriodLocks.firmId, firmId))
    .orderBy(asc(schema.billingPeriodLocks.periodStart));
  return rows.map(mapBillingPeriodLockRow);
}

export async function createDrizzleBillingPeriodLock(
  db: OpenPracticeDatabase,
  lock: BillingPeriodLockRecord,
): Promise<BillingPeriodLockRecord> {
  validateBillingPeriodLock(lock);
  const overlaps = (await listDrizzleBillingPeriodLocks(db, lock.firmId)).some((candidate) =>
    billingPeriodLocksOverlap(candidate, lock),
  );
  if (overlaps) throw new Error("Billing period lock overlaps an existing lock");
  await db.insert(schema.billingPeriodLocks).values(billingPeriodLockInsert(lock));
  return clone(lock);
}

export async function listDrizzleBillingRateRules(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { activeOnly?: boolean; matterId?: string; userId?: string } = {},
): Promise<BillingRateRuleRecord[]> {
  const filters = [eq(schema.billingRateRules.firmId, firmId)];
  if (options.activeOnly) filters.push(eq(schema.billingRateRules.active, true));
  const rows = await db
    .select()
    .from(schema.billingRateRules)
    .where(and(...filters))
    .orderBy(desc(schema.billingRateRules.effectiveFrom));
  return rows
    .map(mapBillingRateRuleRow)
    .filter(
      (rule) =>
        (!options.matterId || !rule.matterId || rule.matterId === options.matterId) &&
        (!options.userId || !rule.userId || rule.userId === options.userId),
    );
}

export async function createDrizzleBillingRateRule(
  db: OpenPracticeDatabase,
  rule: BillingRateRuleRecord,
): Promise<BillingRateRuleRecord> {
  validateBillingRateRule(rule);
  const overlaps = (await listDrizzleBillingRateRules(db, rule.firmId, { activeOnly: true })).some(
    (candidate) => billingRateRulesOverlapAtSameActiveScope(candidate, rule),
  );
  if (overlaps) throw new Error("Billing rate rule overlaps an active rule at the same scope");
  await db.insert(schema.billingRateRules).values(billingRateRuleInsert(rule));
  return clone(rule);
}
