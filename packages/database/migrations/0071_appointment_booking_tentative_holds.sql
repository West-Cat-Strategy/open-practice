CREATE TABLE "appointment_booking_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"label" text NOT NULL,
	"public_label" text NOT NULL,
	"description" text,
	"timezone" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"slot_interval_minutes" integer NOT NULL,
	"min_lead_minutes" integer NOT NULL,
	"max_lead_days" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"weekly_windows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	CONSTRAINT "appointment_booking_profiles_label_present" CHECK (length(trim("appointment_booking_profiles"."label")) > 0),
	CONSTRAINT "appointment_booking_profiles_public_label_present" CHECK (length(trim("appointment_booking_profiles"."public_label")) > 0),
	CONSTRAINT "appointment_booking_profiles_status_value" CHECK ("appointment_booking_profiles"."status" in ('active', 'paused')),
	CONSTRAINT "appointment_booking_profiles_duration_positive" CHECK ("appointment_booking_profiles"."duration_minutes" > 0 and "appointment_booking_profiles"."duration_minutes" <= 480),
	CONSTRAINT "appointment_booking_profiles_slot_interval_positive" CHECK ("appointment_booking_profiles"."slot_interval_minutes" > 0 and "appointment_booking_profiles"."slot_interval_minutes" <= 480),
	CONSTRAINT "appointment_booking_profiles_lead_bounds" CHECK ("appointment_booking_profiles"."min_lead_minutes" >= 0 and "appointment_booking_profiles"."max_lead_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "appointment_booking_links" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"matter_id" text,
	"client_contact_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_booking_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"link_id" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'tentative_hold' NOT NULL,
	"calendar_event_id" text NOT NULL,
	"public_consultation_intake_id" text,
	"matter_id" text,
	"client_contact_id" text,
	"requester_name" text NOT NULL,
	"requester_email" text,
	"requester_telephone" text,
	"requested_starts_at" timestamp with time zone NOT NULL,
	"requested_ends_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	"dismissed_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "appointment_booking_requests_source_value" CHECK ("appointment_booking_requests"."source" in ('website', 'direct_link')),
	CONSTRAINT "appointment_booking_requests_status_value" CHECK ("appointment_booking_requests"."status" in ('tentative_hold', 'confirmed', 'dismissed')),
	CONSTRAINT "appointment_booking_requests_requester_name_present" CHECK (length(trim("appointment_booking_requests"."requester_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "appointment_booking_profiles" ADD CONSTRAINT "appointment_booking_profiles_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_profiles" ADD CONSTRAINT "appointment_booking_profiles_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_profiles" ADD CONSTRAINT "appointment_booking_profiles_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_links" ADD CONSTRAINT "appointment_booking_links_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_links" ADD CONSTRAINT "appointment_booking_links_profile_id_appointment_booking_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."appointment_booking_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_links" ADD CONSTRAINT "appointment_booking_links_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_links" ADD CONSTRAINT "appointment_booking_links_client_contact_id_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_links" ADD CONSTRAINT "appointment_booking_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_links" ADD CONSTRAINT "appointment_booking_links_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_requests" ADD CONSTRAINT "appointment_booking_requests_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_requests" ADD CONSTRAINT "appointment_booking_requests_profile_id_appointment_booking_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."appointment_booking_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_requests" ADD CONSTRAINT "appointment_booking_requests_link_id_appointment_booking_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."appointment_booking_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_requests" ADD CONSTRAINT "appointment_booking_requests_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_requests" ADD CONSTRAINT "appointment_booking_requests_public_consultation_intake_id_public_consultation_intakes_id_fk" FOREIGN KEY ("public_consultation_intake_id") REFERENCES "public"."public_consultation_intakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_requests" ADD CONSTRAINT "appointment_booking_requests_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_requests" ADD CONSTRAINT "appointment_booking_requests_client_contact_id_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_requests" ADD CONSTRAINT "appointment_booking_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_booking_profiles_firm_status_idx" ON "appointment_booking_profiles" USING btree ("firm_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_booking_links_token_hash_idx" ON "appointment_booking_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "appointment_booking_links_firm_profile_idx" ON "appointment_booking_links" USING btree ("firm_id","profile_id");--> statement-breakpoint
CREATE INDEX "appointment_booking_requests_firm_status_idx" ON "appointment_booking_requests" USING btree ("firm_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "appointment_booking_requests_matter_status_idx" ON "appointment_booking_requests" USING btree ("firm_id","matter_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_booking_requests_event_idx" ON "appointment_booking_requests" USING btree ("calendar_event_id");
