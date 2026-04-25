ALTER TABLE "documents" ADD COLUMN "supersedes_document_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "trust_transaction_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"decided_by_user_id" text NOT NULL,
	"decision" text NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "trust_reconciliations" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"account_id" text NOT NULL,
	"statement_period_start" timestamp with time zone NOT NULL,
	"statement_period_end" timestamp with time zone NOT NULL,
	"expected_balance_cents" integer NOT NULL,
	"actual_balance_cents" integer NOT NULL,
	"status" text NOT NULL,
	"reviewed_by_user_id" text,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trust_transaction_approvals" ADD CONSTRAINT "trust_transaction_approvals_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_transaction_approvals" ADD CONSTRAINT "trust_transaction_approvals_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_reconciliations" ADD CONSTRAINT "trust_reconciliations_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_reconciliations" ADD CONSTRAINT "trust_reconciliations_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_reconciliations" ADD CONSTRAINT "trust_reconciliations_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
