ALTER TABLE "manual_payments"
  ADD COLUMN "reconciled_at" timestamp with time zone,
  ADD COLUMN "reconciled_by_user_id" text REFERENCES "users"("id"),
  ADD COLUMN "reconciliation_notes" text,
  ADD COLUMN "reconciliation_evidence" jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE "manual_payments"
SET "reconciled_at" = "received_at",
    "reconciled_by_user_id" = "received_by_user_id",
    "reconciliation_evidence" = '{}'::jsonb
WHERE "status" = 'received'
  AND "reconciled_at" IS NULL;
