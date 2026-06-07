import { z } from "zod";
import {
  billingDateFallsInsideLock,
  billingTimerWindowOverlapsLock,
  resolveBillingRateRule,
  type AccessRequest,
  type BillingPeriodLockRecord,
  type BillingRateRuleRecord,
  type BillingRateSnapshot,
  type TimeEntry,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import type { ApiAuthContext } from "../../server.js";
import type { ApiRouteDependencies } from "../types.js";

export const billingEntryQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["draft", "submitted", "approved", "billed", "written_off"]).optional(),
});

export const idParamsSchema = z.object({ id: z.string().min(1) });

export function assertMatterAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function lockedBillingPeriodForTimestamp(
  timestamp: string,
  locks: BillingPeriodLockRecord[],
): BillingPeriodLockRecord | undefined {
  return locks.find((lock) => billingDateFallsInsideLock(timestamp, lock));
}

export async function assertBillingTimestampUnlocked(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  timestamp: string,
  label: string,
): Promise<void> {
  const lockedPeriod = lockedBillingPeriodForTimestamp(
    timestamp,
    await repository.listBillingPeriodLocks(firmId),
  );
  if (!lockedPeriod) return;
  throw Object.assign(
    new Error(
      `${label} is inside locked billing period ${lockedPeriod.periodStart} to ${lockedPeriod.periodEnd}`,
    ),
    { statusCode: 409 },
  );
}

export async function assertBillingTimerWindowUnlocked(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  startedAt: string,
  stoppedAt: string,
): Promise<void> {
  const lockedPeriod = billingTimerWindowOverlapsLock({
    startedAt,
    stoppedAt,
    locks: await repository.listBillingPeriodLocks(firmId),
  });
  if (!lockedPeriod) return;
  throw Object.assign(
    new Error(
      `Timer window overlaps locked billing period ${lockedPeriod.periodStart} to ${lockedPeriod.periodEnd}`,
    ),
    { statusCode: 409 },
  );
}

function snapshotFromRateRule(
  rule: BillingRateRuleRecord,
  resolvedAt: string,
): BillingRateSnapshot {
  return {
    source: "rate_rule",
    rateCents: rule.rateCents,
    resolvedAt,
    rateRuleId: rule.id,
    label: rule.label,
    scope: rule.scope,
    matterId: rule.matterId,
    userId: rule.userId,
    role: rule.role,
  };
}

export async function resolveTimeEntryRate(input: {
  repository: ApiRouteDependencies["repository"];
  auth: ApiAuthContext;
  matterId: string;
  userId: string;
  performedAt: string;
  rateCents?: number;
  resolvedAt: string;
}): Promise<Pick<TimeEntry, "rateCents" | "rateRuleId" | "rateSnapshot">> {
  if (input.rateCents !== undefined) {
    return {
      rateCents: input.rateCents,
      rateSnapshot: {
        source: "manual",
        rateCents: input.rateCents,
        resolvedAt: input.resolvedAt,
      },
    };
  }

  const timekeeper =
    input.userId === input.auth.user.id
      ? input.auth.user
      : await input.repository.getUser(input.auth.firmId, input.userId);
  const rule = resolveBillingRateRule(
    await input.repository.listBillingRateRules(input.auth.firmId, {
      activeOnly: true,
      matterId: input.matterId,
      userId: input.userId,
    }),
    {
      matterId: input.matterId,
      userId: input.userId,
      role: timekeeper?.role,
      performedAt: input.performedAt,
    },
  );

  if (!rule) {
    throw Object.assign(new Error("Rate cents is required when no billing rate rule matches"), {
      statusCode: 400,
    });
  }

  return {
    rateCents: rule.rateCents,
    rateRuleId: rule.id,
    rateSnapshot: snapshotFromRateRule(rule, input.resolvedAt),
  };
}
