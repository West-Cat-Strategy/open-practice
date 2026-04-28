CREATE TABLE "trust_client_balances" (
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"client_id" text NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trust_client_balances_firm_id_matter_id_client_id_pk" PRIMARY KEY("firm_id","matter_id","client_id"),
	CONSTRAINT "trust_client_balances_non_negative_balance" CHECK ("trust_client_balances"."balance_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "trust_client_balances" ADD CONSTRAINT "trust_client_balances_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_client_balances" ADD CONSTRAINT "trust_client_balances_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_client_balances" ADD CONSTRAINT "trust_client_balances_client_id_contacts_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "trust_client_balances" ("firm_id", "matter_id", "client_id", "balance_cents", "updated_at")
SELECT
	"trust_ledger_entries"."firm_id",
	"trust_ledger_entries"."matter_id",
	"trust_ledger_entries"."client_id",
	SUM("trust_ledger_entries"."credit_cents" - "trust_ledger_entries"."debit_cents")::integer,
	COALESCE(MAX("trust_transactions"."posted_at"), now())
FROM "trust_ledger_entries"
INNER JOIN "ledger_accounts"
	ON "ledger_accounts"."id" = "trust_ledger_entries"."account_id"
	AND "ledger_accounts"."firm_id" = "trust_ledger_entries"."firm_id"
LEFT JOIN "trust_transactions"
	ON "trust_transactions"."id" = "trust_ledger_entries"."transaction_id"
WHERE "ledger_accounts"."type" = 'client_liability'
GROUP BY
	"trust_ledger_entries"."firm_id",
	"trust_ledger_entries"."matter_id",
	"trust_ledger_entries"."client_id"
ON CONFLICT ("firm_id", "matter_id", "client_id") DO UPDATE SET
	"balance_cents" = EXCLUDED."balance_cents",
	"updated_at" = EXCLUDED."updated_at";--> statement-breakpoint
ALTER TABLE "trust_transaction_approvals" ADD CONSTRAINT "trust_transaction_approvals_transaction_id_trust_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."trust_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trust_transaction_approvals_reviewer_decision_idx" ON "trust_transaction_approvals" USING btree ("firm_id","transaction_id","decided_by_user_id");--> statement-breakpoint
ALTER TABLE "trust_reconciliations" ADD CONSTRAINT "trust_reconciliations_valid_period" CHECK ("trust_reconciliations"."statement_period_end" > "trust_reconciliations"."statement_period_start");--> statement-breakpoint
ALTER TABLE "trust_reconciliations" ADD CONSTRAINT "trust_reconciliations_status_value" CHECK ("trust_reconciliations"."status" in ('draft', 'matched', 'exception', 'reviewed'));--> statement-breakpoint
ALTER TABLE "trust_transaction_approvals" ADD CONSTRAINT "trust_transaction_approvals_decision_value" CHECK ("trust_transaction_approvals"."decision" in ('approved', 'rejected'));
