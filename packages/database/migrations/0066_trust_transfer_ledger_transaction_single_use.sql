CREATE UNIQUE INDEX "billing_trust_transfer_requests_ledger_transaction_single_use_idx"
ON "billing_trust_transfer_requests" ("ledger_transaction_id")
WHERE "ledger_transaction_id" IS NOT NULL;
