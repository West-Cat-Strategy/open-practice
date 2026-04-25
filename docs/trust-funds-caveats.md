# Canadian Trust and Funds Caveats

Open Practice starts with careful funds-tracking infrastructure. It is not yet jurisdiction-certified trust accounting software.

## V1 Defaults

- Separate trust and operating account concepts.
- Matter-level client balances.
- Balanced double-entry transactions.
- No overdrawing a client matter balance.
- Idempotency keys for external bank/payment events.
- Append-only posted entries; corrections require reversing transactions.
- Reconciliation records are planned as first-class records.

## Reference Guidance

- Use **Blnk** as the primary permissive reference for ledger APIs, balances, idempotent transaction posting, and reconciliation boundaries.
- Use **Apache Fineract** selectively for maker-checker approvals, tenant isolation, configurable accounting controls, and reporting patterns.
- Use **LedgerSMB** only as a GPL reference for mature general-ledger and reconciliation reports; do not reuse implementation code.
- Treat **Midaz** as source-available/reference-only because the pinned clone uses Elastic License 2.0 unless legal review confirms otherwise.

## Canadian Context

The product should support configurable workflows for BC, Ontario, and broader Canadian practices, including lawyers, Ontario paralegals, BC notaries, and staff. Regulatory language differs by role and province, so the product must present checklists and prompts as configurable practice-management support, not legal advice.

## Before Compliance Claims

Before claiming trust-account compliance in any province, the project needs jurisdiction-specific review of records, withdrawals, authorization, reconciliation, reporting, retention, mixed trust account interest, and licensee/notary/paralegal rules.
