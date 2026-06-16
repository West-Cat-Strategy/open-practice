import type { FastifyInstance } from "fastify";
import { registerLedgerReadRoutes } from "./ledger/read.js";
import { registerLedgerPostingRequestRoutes } from "./ledger/posting-requests.js";
import { registerLedgerReconciliationRoutes } from "./ledger/reconciliations.js";
import { registerLedgerReportRoutes } from "./ledger/reports.js";
import { registerLedgerTransactionRoutes } from "./ledger/transactions.js";
import type { ApiRouteDependencies } from "./types.js";

export function registerLedgerRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  registerLedgerReadRoutes(server, dependencies);
  registerLedgerReportRoutes(server, dependencies);
  registerLedgerPostingRequestRoutes(server, dependencies);
  registerLedgerTransactionRoutes(server, dependencies);
  registerLedgerReconciliationRoutes(server, dependencies);
}
