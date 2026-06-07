import type { AccessRequest, LedgerAccount } from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import type { ApiAuthContext } from "../../server.js";
import type { ApiRouteDependencies } from "../types.js";

export type LedgerRepository = ApiRouteDependencies["repository"];

export function assertLedgerAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export async function assertTrustAssetAccount(
  repository: LedgerRepository,
  firmId: string,
  accountId: string,
  message = "Trust ledger control requires an existing trust asset account",
): Promise<void> {
  const ledger = await repository.getLedger(firmId);
  const account = ledger.accounts.find((candidate) => candidate.id === accountId);
  if (!account || account.type !== "trust_asset") {
    throw new Error(message);
  }
}

export async function getLedgerAccount(
  repository: LedgerRepository,
  firmId: string,
  accountId: string,
): Promise<LedgerAccount> {
  const ledger = await repository.getLedger(firmId);
  const account = ledger.accounts.find((candidate) => candidate.id === accountId);
  if (!account) throw new Error(`Unknown ledger account ${accountId}`);
  return account;
}
