export const financeStaffPages = {
  trustFunds: {
    key: "trust-funds",
    id: "finance.trust-funds",
    componentName: "FinanceTrustFundsPage",
    routeId: "funds",
    sectionKey: "funds",
    area: "finance",
    slug: "trust-funds",
    title: "Trust Funds",
    shortLabel: "Funds",
    canonicalPath: "/finance/trust-funds",
    currentDashboardHref: "/?section=funds",
    currentDashboardLabel: "Trust controls workbench",
    scopeLabel: "Mixed finance",
    contextLabel: "Selected matter and firm trust controls",
    availability: "mixed",
    requiresMatterContext: true,
    primarySurface:
      "Trust balances, posting requests, reconciliation freshness, import posture, and financial command cues",
    sourceModule: "apps/web/app/dashboard/trust-controls-section.tsx",
    resourceModule: "apps/web/app/_features/billing/server-resources.ts",
    summary:
      "Review trust balances, maker-checker posting requests, reconciliation freshness, import posture, and financial command cues.",
    guardrails: [
      "Preserve existing trust-ledger authorization and matter scoping.",
      "Do not add settlement, bank-feed mutation, or automatic trust-posting behavior.",
      "Keep accounting posture reviewer-facing and non-certifying.",
    ],
  },
  billing: {
    key: "billing",
    id: "finance.billing",
    componentName: "FinanceBillingPage",
    routeId: "billing",
    sectionKey: "billing",
    area: "finance",
    slug: "billing",
    title: "Billing",
    shortLabel: "Billing",
    canonicalPath: "/finance/billing",
    currentDashboardHref: "/?section=billing",
    currentDashboardLabel: "Billing workspace",
    scopeLabel: "Mixed finance",
    contextLabel: "Selected matter and firm billing controls",
    availability: "mixed",
    requiresMatterContext: true,
    primarySurface:
      "Time, expenses, invoices, payment requests, manual-payment reconciliation, and expense category controls",
    sourceModule: "apps/web/app/dashboard/billing-section.tsx",
    resourceModule: "apps/web/app/_features/billing/server-resources.ts",
    summary:
      "Review time, expenses, invoices, payment requests, manual-payment reconciliation, and expense category controls.",
    guardrails: [
      "Preserve invoice, payment, and expense API contracts.",
      "Do not allocate payments, process settlement events, or post trust entries from this page.",
      "Keep financial examples synthetic and operational.",
    ],
  },
} as const;

export type FinanceStaffPageKey = keyof typeof financeStaffPages;
export type FinanceStaffPageDefinition = (typeof financeStaffPages)[FinanceStaffPageKey];
