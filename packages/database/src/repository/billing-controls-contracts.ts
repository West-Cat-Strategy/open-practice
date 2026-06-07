import type { BillingPeriodLockRecord, BillingRateRuleRecord } from "@open-practice/domain";

export interface BillingControlsRepository {
  listBillingPeriodLocks(firmId: string): Promise<BillingPeriodLockRecord[]>;
  createBillingPeriodLock(lock: BillingPeriodLockRecord): Promise<BillingPeriodLockRecord>;
  listBillingRateRules(
    firmId: string,
    options?: { activeOnly?: boolean; matterId?: string; userId?: string },
  ): Promise<BillingRateRuleRecord[]>;
  createBillingRateRule(rule: BillingRateRuleRecord): Promise<BillingRateRuleRecord>;
}
