ALTER TABLE "calendar_events" ADD COLUMN "meeting_link_mode" text DEFAULT 'blank' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "meeting_link_url" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "meeting_room_id" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "meeting_provider_key" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_meeting_link_mode_value" CHECK ("calendar_events"."meeting_link_mode" in ('blank', 'external_url', 'hosted_webrtc'));
