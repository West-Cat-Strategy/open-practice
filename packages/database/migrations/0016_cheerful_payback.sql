CREATE TABLE "calendar_event_attendees" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'required' NOT NULL,
	"response_status" text DEFAULT 'needs_action' NOT NULL,
	"invitation_status" text DEFAULT 'not_sent' NOT NULL,
	"invited_at" timestamp with time zone,
	"invitation_email_id" text,
	"invitation_job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	CONSTRAINT "calendar_event_attendees_role_value" CHECK ("calendar_event_attendees"."role" in ('required', 'optional')),
	CONSTRAINT "calendar_event_attendees_response_status_value" CHECK ("calendar_event_attendees"."response_status" in ('needs_action', 'accepted', 'tentative', 'declined')),
	CONSTRAINT "calendar_event_attendees_invitation_status_value" CHECK ("calendar_event_attendees"."invitation_status" in ('not_sent', 'queued', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_invitation_email_id_email_outbox_id_fk" FOREIGN KEY ("invitation_email_id") REFERENCES "public"."email_outbox"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_invitation_job_id_job_lifecycle_records_id_fk" FOREIGN KEY ("invitation_job_id") REFERENCES "public"."job_lifecycle_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_attendees_firm_event_email_idx" ON "calendar_event_attendees" USING btree ("firm_id","event_id","email") WHERE "calendar_event_attendees"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "calendar_event_attendees_event_active_idx" ON "calendar_event_attendees" USING btree ("firm_id","matter_id","event_id","deleted_at");