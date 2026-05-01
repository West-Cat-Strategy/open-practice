CREATE TABLE "calendar_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"label" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
-- OP-T34 makes calendar events matter-scoped; legacy rows without a matter cannot be exposed safely.
DELETE FROM "calendar_events" WHERE "matter_id" IS NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "matter_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "uid" text;--> statement-breakpoint
UPDATE "calendar_events" SET "uid" = "id" || '@open-practice.local' WHERE "uid" IS NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "uid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "status" text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "updated_by_user_id" text;--> statement-breakpoint
UPDATE "calendar_events" AS "event"
SET "created_by_user_id" = "matter"."responsible_user_id",
    "updated_by_user_id" = "matter"."responsible_user_id"
FROM "matters" AS "matter"
WHERE "event"."firm_id" = "matter"."firm_id"
  AND "event"."matter_id" = "matter"."id"
  AND ("event"."created_by_user_id" IS NULL OR "event"."updated_by_user_id" IS NULL);--> statement-breakpoint
UPDATE "calendar_events" AS "event"
SET "created_by_user_id" = "users"."id",
    "updated_by_user_id" = "users"."id"
FROM "users"
WHERE "event"."firm_id" = "users"."firm_id"
  AND ("event"."created_by_user_id" IS NULL OR "event"."updated_by_user_id" IS NULL);--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "created_by_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "updated_by_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_credentials" ADD CONSTRAINT "calendar_credentials_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_credentials" ADD CONSTRAINT "calendar_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_credentials" ADD CONSTRAINT "calendar_credentials_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_credentials_username_idx" ON "calendar_credentials" USING btree ("username");--> statement-breakpoint
CREATE INDEX "calendar_credentials_user_active_idx" ON "calendar_credentials" USING btree ("firm_id","user_id","revoked_at");--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_firm_matter_uid_idx" ON "calendar_events" USING btree ("firm_id","matter_id","uid") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "calendar_events_matter_start_idx" ON "calendar_events" USING btree ("firm_id","matter_id","starts_at");
