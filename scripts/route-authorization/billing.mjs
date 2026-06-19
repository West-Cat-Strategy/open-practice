const BILLING_REGISTRAR = "registerBillingRoutes";
const BILLING_TEST_FILE = "apps/api/src/routes/billing.test.ts";

export const INVOICE_GUARD_RESOURCE = "time_entry";
export const PAYMENT_GUARD_RESOURCE = "expense_entry";

const billingRoute = (method, path, resource, action, matterScope) => ({
  method,
  path,
  registrar: BILLING_REGISTRAR,
  testFile: BILLING_TEST_FILE,
  auth: {
    kind: "authenticated",
    resource,
    action,
    matterScope,
  },
});

// Invoice guards intentionally mirror the current permission policy through time_entry.
const invoiceRoute = (method, path, action, matterScope) =>
  billingRoute(method, path, INVOICE_GUARD_RESOURCE, action, matterScope);

// Payment guards intentionally mirror the current permission policy through expense_entry.
const paymentRoute = (method, path, action, matterScope) =>
  billingRoute(method, path, PAYMENT_GUARD_RESOURCE, action, matterScope);

export const BILLING_ROUTE_AUTHORIZATION_MANIFEST = [
  billingRoute("GET", "/api/time-entries", "time_entry", "read", "optional"),
  billingRoute("POST", "/api/time-entries", "time_entry", "create", "required"),
  billingRoute("POST", "/api/time-entries/timer-drafts", "time_entry", "create", "required"),
  billingRoute("PATCH", "/api/time-entries/:id", "time_entry", "update", "derived"),
  billingRoute("POST", "/api/time-entries/:id/submit", "time_entry", "update", "derived"),
  billingRoute("POST", "/api/time-entries/:id/approve", "time_entry", "approve", "derived"),
  billingRoute("POST", "/api/time-entries/:id/write-off", "time_entry", "update", "derived"),
  billingRoute("GET", "/api/expense-entries", "expense_entry", "read", "optional"),
  billingRoute("POST", "/api/expense-entries", "expense_entry", "create", "required"),
  billingRoute("POST", "/api/expense-entries/review-drafts", "expense_entry", "create", "required"),
  billingRoute("PATCH", "/api/expense-entries/:id", "expense_entry", "update", "derived"),
  billingRoute("POST", "/api/expense-entries/:id/submit", "expense_entry", "update", "derived"),
  billingRoute("POST", "/api/expense-entries/:id/approve", "expense_entry", "approve", "derived"),
  billingRoute("POST", "/api/expense-entries/:id/write-off", "expense_entry", "update", "derived"),
  invoiceRoute("GET", "/api/invoices", "read", "optional"),
  invoiceRoute("POST", "/api/invoices", "create", "required"),
  invoiceRoute("GET", "/api/invoices/:id", "read", "derived"),
  invoiceRoute("POST", "/api/invoices/:id/approve", "approve", "derived"),
  invoiceRoute("POST", "/api/invoices/:id/issue", "update", "derived"),
  invoiceRoute("POST", "/api/invoices/:id/void", "delete", "derived"),
  paymentRoute("GET", "/api/payments", "read", "optional"),
  paymentRoute("POST", "/api/payments", "create", "required"),
  paymentRoute("POST", "/api/payments/:paymentId/reconcile", "create", "derived"),
  paymentRoute("GET", "/api/billing/payment-import-review-records", "read", "optional"),
  paymentRoute("POST", "/api/billing/payment-import-review-records", "create", "required"),
  paymentRoute("GET", "/api/billing/payment-requests", "read", "optional"),
  paymentRoute("POST", "/api/billing/payment-requests", "create", "required"),
  paymentRoute("PATCH", "/api/billing/payment-requests/:id", "update", "derived"),
  paymentRoute("POST", "/api/billing/payment-requests/:id/checkout-session", "update", "derived"),
  paymentRoute("POST", "/api/billing/payment-requests/:id/settlement-events", "update", "derived"),
  billingRoute("GET", "/api/billing/trust-transfer-requests", "trust_ledger", "read", "optional"),
  billingRoute(
    "POST",
    "/api/billing/trust-transfer-requests",
    "trust_ledger",
    "create",
    "required",
  ),
  billingRoute(
    "POST",
    "/api/billing/trust-transfer-requests/:id/approve",
    "trust_ledger",
    "approve",
    "derived",
  ),
  billingRoute(
    "POST",
    "/api/billing/trust-transfer-requests/:id/reject",
    "trust_ledger",
    "approve",
    "derived",
  ),
  billingRoute(
    "POST",
    "/api/billing/trust-transfer-requests/:id/link",
    "trust_ledger",
    "approve",
    "derived",
  ),
  billingRoute("GET", "/api/billing/dashboard", "trust_ledger", "read", "optional"),
  billingRoute("GET", "/api/billing/period-locks", "trust_ledger", "read", "firm_wide"),
  billingRoute("POST", "/api/billing/period-locks", "trust_ledger", "create", "firm_wide"),
  billingRoute("GET", "/api/billing/rate-rules", "trust_ledger", "read", "firm_wide"),
  billingRoute("POST", "/api/billing/rate-rules", "trust_ledger", "create", "firm_wide"),
  billingRoute("GET", "/api/billing/expense-categories", "trust_ledger", "read", "firm_wide"),
  billingRoute("POST", "/api/billing/expense-categories", "trust_ledger", "create", "firm_wide"),
  billingRoute(
    "PATCH",
    "/api/billing/expense-categories/:id",
    "trust_ledger",
    "create",
    "firm_wide",
  ),
  billingRoute("POST", "/api/billing/export-requests", "trust_ledger", "export", "optional"),
  billingRoute(
    "GET",
    "/api/billing/export-requests/:exportJobId",
    "trust_ledger",
    "export",
    "derived",
  ),
  billingRoute(
    "GET",
    "/api/billing/export-requests/:exportJobId/download",
    "trust_ledger",
    "export",
    "derived",
  ),
];
