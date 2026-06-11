ALTER TABLE "contacts" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "contacts" AS "contact"
SET "created_by_user_id" = "matter"."responsible_user_id"
FROM "matter_parties" AS "party"
JOIN "matters" AS "matter"
  ON "matter"."id" = "party"."matter_id"
 AND "matter"."firm_id" = "party"."firm_id"
WHERE "party"."contact_id" = "contact"."id"
  AND "party"."firm_id" = "contact"."firm_id"
  AND "contact"."created_by_user_id" IS NULL;--> statement-breakpoint
CREATE INDEX "contacts_firm_created_by_idx" ON "contacts" USING btree ("firm_id","created_by_user_id");--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "scope" text DEFAULT 'matter' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "client_contact_id" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "matter_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_client_contact_id_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP INDEX "calendar_events_firm_matter_uid_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_firm_matter_uid_idx" ON "calendar_events" USING btree ("firm_id","matter_id","uid") WHERE "deleted_at" IS NULL AND "matter_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_firm_scope_uid_idx" ON "calendar_events" USING btree ("firm_id","scope","uid") WHERE "deleted_at" IS NULL AND "matter_id" IS NULL AND "client_contact_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_firm_client_uid_idx" ON "calendar_events" USING btree ("firm_id","client_contact_id","uid") WHERE "deleted_at" IS NULL AND "client_contact_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "calendar_events_scope_start_idx" ON "calendar_events" USING btree ("firm_id","scope","starts_at");--> statement-breakpoint
CREATE INDEX "calendar_events_client_start_idx" ON "calendar_events" USING btree ("firm_id","client_contact_id","starts_at");--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_scope_value" CHECK ("calendar_events"."scope" in ('matter', 'firm', 'client'));--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_scope_target" CHECK (("calendar_events"."scope" = 'matter' and "calendar_events"."matter_id" is not null and "calendar_events"."client_contact_id" is null) or ("calendar_events"."scope" = 'firm' and "calendar_events"."matter_id" is null and "calendar_events"."client_contact_id" is null) or ("calendar_events"."scope" = 'client' and "calendar_events"."matter_id" is null and "calendar_events"."client_contact_id" is not null));--> statement-breakpoint
ALTER TABLE "calendar_event_reminders" ADD COLUMN "scope" text DEFAULT 'matter' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event_reminders" ADD COLUMN "client_contact_id" text;--> statement-breakpoint
ALTER TABLE "calendar_event_reminders" ALTER COLUMN "matter_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_client_contact_id_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_event_reminders_scope_due_idx" ON "calendar_event_reminders" USING btree ("firm_id","scope","remind_at");--> statement-breakpoint
CREATE INDEX "calendar_event_reminders_client_due_idx" ON "calendar_event_reminders" USING btree ("firm_id","client_contact_id","remind_at");--> statement-breakpoint
ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_scope_value" CHECK ("calendar_event_reminders"."scope" in ('matter', 'firm', 'client'));--> statement-breakpoint
ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_scope_target" CHECK (("calendar_event_reminders"."scope" = 'matter' and "calendar_event_reminders"."matter_id" is not null and "calendar_event_reminders"."client_contact_id" is null) or ("calendar_event_reminders"."scope" = 'firm' and "calendar_event_reminders"."matter_id" is null and "calendar_event_reminders"."client_contact_id" is null) or ("calendar_event_reminders"."scope" = 'client' and "calendar_event_reminders"."matter_id" is null and "calendar_event_reminders"."client_contact_id" is not null));
