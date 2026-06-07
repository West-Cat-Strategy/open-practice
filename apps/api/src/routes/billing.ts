import type { FastifyInstance } from "fastify";
import { registerBillingControlRoutes } from "./billing/controls.js";
import { registerBillingDashboardRoutes } from "./billing/dashboard.js";
import { registerBillingExpenseRoutes } from "./billing/expenses.js";
import { registerBillingExportRoutes } from "./billing/export-requests.js";
import { registerBillingInvoiceRoutes } from "./billing/invoices.js";
import { registerBillingPaymentRoutes } from "./billing/payments.js";
import { registerBillingPaymentRequestRoutes } from "./billing/payment-requests.js";
import { registerBillingTimeEntryRoutes } from "./billing/time-entries.js";
import { registerBillingTrustTransferRequestRoutes } from "./billing/trust-transfer-requests.js";
import type { ApiRouteDependencies } from "./types.js";

export function registerBillingRoutes(
  server: FastifyInstance,
  { repository, reportJobQueue, paymentProcessorProvider, publicWebBaseUrl }: ApiRouteDependencies,
): void {
  registerBillingControlRoutes(server, { repository });
  registerBillingExpenseRoutes(server, { repository });
  registerBillingTimeEntryRoutes(server, { repository });

  registerBillingInvoiceRoutes(server, { repository });

  registerBillingPaymentRoutes(server, { repository });

  registerBillingPaymentRequestRoutes(server, {
    repository,
    paymentProcessorProvider,
    publicWebBaseUrl,
  });
  registerBillingTrustTransferRequestRoutes(server, { repository });

  registerBillingDashboardRoutes(server, { repository });
  registerBillingExportRoutes(server, { repository, reportJobQueue });
}
