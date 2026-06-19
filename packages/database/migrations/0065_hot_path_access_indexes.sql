CREATE INDEX "matter_assignments_user_matter_idx"
  ON "matter_assignments" USING btree ("user_id","matter_id");
--> statement-breakpoint
CREATE INDEX "time_entries_firm_matter_status_idx"
  ON "time_entries" USING btree ("firm_id","matter_id","billing_status");
--> statement-breakpoint
CREATE INDEX "expense_entries_firm_matter_status_idx"
  ON "expense_entries" USING btree ("firm_id","matter_id","billing_status");
--> statement-breakpoint
CREATE INDEX "invoices_firm_matter_status_idx"
  ON "invoices" USING btree ("firm_id","matter_id","status");
--> statement-breakpoint
CREATE INDEX "invoice_lines_firm_invoice_idx"
  ON "invoice_lines" USING btree ("firm_id","invoice_id");
--> statement-breakpoint
CREATE INDEX "manual_payments_firm_matter_idx"
  ON "manual_payments" USING btree ("firm_id","matter_id");
--> statement-breakpoint
CREATE INDEX "manual_payments_firm_invoice_idx"
  ON "manual_payments" USING btree ("firm_id","invoice_id");
--> statement-breakpoint
CREATE INDEX "payment_allocations_firm_payment_idx"
  ON "payment_allocations" USING btree ("firm_id","payment_id");
--> statement-breakpoint
CREATE INDEX "payment_allocations_firm_invoice_idx"
  ON "payment_allocations" USING btree ("firm_id","invoice_id");
--> statement-breakpoint
CREATE INDEX "billing_trust_transfer_requests_firm_matter_status_idx"
  ON "billing_trust_transfer_requests" USING btree ("firm_id","matter_id","status");
--> statement-breakpoint
CREATE INDEX "documents_firm_matter_idx"
  ON "documents" USING btree ("firm_id","matter_id");
--> statement-breakpoint
CREATE INDEX "documents_firm_matter_checksum_status_idx"
  ON "documents" USING btree ("firm_id","matter_id","checksum_sha256","checksum_status");
--> statement-breakpoint
CREATE INDEX "signature_requests_firm_matter_idx"
  ON "signature_requests" USING btree ("firm_id","matter_id");
--> statement-breakpoint
CREATE INDEX "signature_request_signers_firm_request_idx"
  ON "signature_request_signers" USING btree ("firm_id","signature_request_id");
--> statement-breakpoint
CREATE INDEX "signature_provider_events_firm_request_occurred_idx"
  ON "signature_provider_events" USING btree ("firm_id","signature_request_id","occurred_at");
--> statement-breakpoint
CREATE INDEX "signature_webhook_attempts_firm_provider_external_idx"
  ON "signature_webhook_attempts" USING btree ("firm_id","provider","external_id");
--> statement-breakpoint
CREATE INDEX "signature_webhook_attempts_firm_received_idx"
  ON "signature_webhook_attempts" USING btree ("firm_id","received_at");
--> statement-breakpoint
CREATE INDEX "ledger_accounts_firm_idx"
  ON "ledger_accounts" USING btree ("firm_id");
--> statement-breakpoint
CREATE INDEX "trust_ledger_entries_firm_matter_idx"
  ON "trust_ledger_entries" USING btree ("firm_id","matter_id");
--> statement-breakpoint
CREATE INDEX "trust_ledger_entries_transaction_idx"
  ON "trust_ledger_entries" USING btree ("transaction_id");
--> statement-breakpoint
CREATE INDEX "trust_transactions_firm_posted_idx"
  ON "trust_transactions" USING btree ("firm_id","posted_at");
--> statement-breakpoint
CREATE INDEX "job_lifecycle_records_firm_queue_queued_idx"
  ON "job_lifecycle_records" USING btree ("firm_id","queue_name","queued_at");
