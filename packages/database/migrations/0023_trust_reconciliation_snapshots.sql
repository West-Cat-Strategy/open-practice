ALTER TABLE "trust_reconciliations" ADD COLUMN "beginning_balance_cents" integer;--> statement-breakpoint
ALTER TABLE "trust_reconciliations" ADD COLUMN "ending_balance_cents" integer;--> statement-breakpoint
ALTER TABLE "trust_reconciliations" ADD COLUMN "statement_rows" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "trust_reconciliations" ADD COLUMN "variance_explanation" text;--> statement-breakpoint
UPDATE "trust_reconciliations" SET "beginning_balance_cents" = 0 WHERE "beginning_balance_cents" IS NULL;--> statement-breakpoint
UPDATE "trust_reconciliations" SET "ending_balance_cents" = "actual_balance_cents" WHERE "ending_balance_cents" IS NULL;--> statement-breakpoint
ALTER TABLE "trust_reconciliations" ALTER COLUMN "beginning_balance_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trust_reconciliations" ALTER COLUMN "ending_balance_cents" SET NOT NULL;
