CREATE TABLE "calendar_event_reminders" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "event_id" text NOT NULL,
  "remind_at" timestamp with time zone NOT NULL,
  "channel" text DEFAULT 'dashboard' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by_user_id" text NOT NULL,
  "updated_by_user_id" text NOT NULL,
  CONSTRAINT "calendar_event_reminders_channel_value" CHECK ("calendar_event_reminders"."channel" in ('dashboard')),
  CONSTRAINT "calendar_event_reminders_status_value" CHECK ("calendar_event_reminders"."status" in ('pending', 'acknowledged', 'dismissed', 'cancelled'))
);

ALTER TABLE "calendar_event_reminders"
  ADD CONSTRAINT "calendar_event_reminders_firm_id_firms_id_fk"
  FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "calendar_event_reminders"
  ADD CONSTRAINT "calendar_event_reminders_matter_id_matters_id_fk"
  FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "calendar_event_reminders"
  ADD CONSTRAINT "calendar_event_reminders_event_id_calendar_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "calendar_event_reminders"
  ADD CONSTRAINT "calendar_event_reminders_created_by_user_id_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "calendar_event_reminders"
  ADD CONSTRAINT "calendar_event_reminders_updated_by_user_id_users_id_fk"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "calendar_event_reminders_event_active_idx"
  ON "calendar_event_reminders" USING btree ("firm_id", "matter_id", "event_id", "deleted_at");

CREATE INDEX "calendar_event_reminders_status_due_idx"
  ON "calendar_event_reminders" USING btree ("firm_id", "status", "remind_at");
