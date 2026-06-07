import {
  billingPeriodLocksOverlap,
  billingRateRulesOverlapAtSameActiveScope,
  validateBillingPeriodLock,
  validateBillingRateRule,
  type BillingPeriodLockRecord,
  type BillingRateRuleRecord,
} from "@open-practice/domain";
import { clone } from "../contracts.js";

export interface MemoryBillingControlsStore {
  billingPeriodLocks: BillingPeriodLockRecord[];
  billingRateRules: BillingRateRuleRecord[];
}

export function listMemoryBillingPeriodLocks(
  store: MemoryBillingControlsStore,
  firmId: string,
): BillingPeriodLockRecord[] {
  return clone(
    store.billingPeriodLocks
      .filter((lock) => lock.firmId === firmId)
      .sort((left, right) => left.periodStart.localeCompare(right.periodStart)),
  );
}

export function createMemoryBillingPeriodLock(
  store: MemoryBillingControlsStore,
  lock: BillingPeriodLockRecord,
): BillingPeriodLockRecord {
  validateBillingPeriodLock(lock);
  const overlaps = store.billingPeriodLocks.some((candidate) =>
    billingPeriodLocksOverlap(candidate, lock),
  );
  if (overlaps) throw new Error("Billing period lock overlaps an existing lock");
  store.billingPeriodLocks = [...store.billingPeriodLocks, clone(lock)];
  return clone(lock);
}

export function listMemoryBillingRateRules(
  store: MemoryBillingControlsStore,
  firmId: string,
  options: { activeOnly?: boolean; matterId?: string; userId?: string } = {},
): BillingRateRuleRecord[] {
  return clone(
    store.billingRateRules
      .filter(
        (rule) =>
          rule.firmId === firmId &&
          (!options.activeOnly || rule.active) &&
          (!options.matterId || !rule.matterId || rule.matterId === options.matterId) &&
          (!options.userId || !rule.userId || rule.userId === options.userId),
      )
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom)),
  );
}

export function createMemoryBillingRateRule(
  store: MemoryBillingControlsStore,
  rule: BillingRateRuleRecord,
): BillingRateRuleRecord {
  validateBillingRateRule(rule);
  const overlaps = store.billingRateRules.some((candidate) =>
    billingRateRulesOverlapAtSameActiveScope(candidate, rule),
  );
  if (overlaps) throw new Error("Billing rate rule overlaps an active rule at the same scope");
  store.billingRateRules = [...store.billingRateRules, clone(rule)];
  return clone(rule);
}
