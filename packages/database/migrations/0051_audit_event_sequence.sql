ALTER TABLE "audit_events" ADD COLUMN "sequence" integer;
--> statement-breakpoint
WITH RECURSIVE "audit_chain" AS (
  SELECT
    "id",
    "firm_id",
    "hash",
    1::integer AS "sequence"
  FROM "audit_events"
  WHERE "previous_hash" = repeat('0', 64)
  UNION ALL
  SELECT
    "child"."id",
    "child"."firm_id",
    "child"."hash",
    "audit_chain"."sequence" + 1
  FROM "audit_events" "child"
  INNER JOIN "audit_chain"
    ON "child"."firm_id" = "audit_chain"."firm_id"
   AND "child"."previous_hash" = "audit_chain"."hash"
), "ordered_audit_events" AS (
  SELECT "id", "sequence"
  FROM "audit_chain"
)
UPDATE "audit_events"
SET "sequence" = "ordered_audit_events"."sequence"
FROM "ordered_audit_events"
WHERE "audit_events"."id" = "ordered_audit_events"."id";
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "audit_events"
    WHERE "sequence" IS NULL
  ) THEN
    RAISE EXCEPTION 'audit_events sequence backfill could not walk every per-firm hash chain';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "audit_events" ALTER COLUMN "sequence" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "audit_events_firm_sequence_idx" ON "audit_events" USING btree ("firm_id","sequence");
