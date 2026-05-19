CREATE TABLE "calendar_meeting_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "event_id" text NOT NULL,
  "status" text DEFAULT 'lobby_closed' NOT NULL,
  "retention_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "created_by_user_id" text NOT NULL,
  "updated_by_user_id" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "calendar_meeting_sessions_status_value" CHECK ("calendar_meeting_sessions"."status" in ('lobby_closed', 'lobby_open', 'locked', 'ended'))
);
--> statement-breakpoint
CREATE TABLE "calendar_guest_links" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "event_id" text NOT NULL,
  "session_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "status" text DEFAULT 'issued' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "retention_until" timestamp with time zone,
  "checked_in_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "admitted_at" timestamp with time zone,
  "denied_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_user_id" text NOT NULL,
  "updated_by_user_id" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "calendar_guest_links_status_value" CHECK ("calendar_guest_links"."status" in ('issued', 'waiting', 'admitted', 'denied', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "calendar_meeting_sessions" ADD CONSTRAINT "calendar_meeting_sessions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_meeting_sessions" ADD CONSTRAINT "calendar_meeting_sessions_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_meeting_sessions" ADD CONSTRAINT "calendar_meeting_sessions_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_meeting_sessions" ADD CONSTRAINT "calendar_meeting_sessions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_meeting_sessions" ADD CONSTRAINT "calendar_meeting_sessions_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_guest_links" ADD CONSTRAINT "calendar_guest_links_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_guest_links" ADD CONSTRAINT "calendar_guest_links_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_guest_links" ADD CONSTRAINT "calendar_guest_links_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_guest_links" ADD CONSTRAINT "calendar_guest_links_session_id_calendar_meeting_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."calendar_meeting_sessions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_guest_links" ADD CONSTRAINT "calendar_guest_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_guest_links" ADD CONSTRAINT "calendar_guest_links_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "calendar_meeting_sessions_firm_matter_event_idx" ON "calendar_meeting_sessions" USING btree ("firm_id", "matter_id", "event_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_guest_links_token_hash_idx" ON "calendar_guest_links" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "calendar_guest_links_session_status_idx" ON "calendar_guest_links" USING btree ("firm_id", "matter_id", "event_id", "session_id", "status");
--> statement-breakpoint
CREATE INDEX "calendar_guest_links_expiry_idx" ON "calendar_guest_links" USING btree ("firm_id", "expires_at");
