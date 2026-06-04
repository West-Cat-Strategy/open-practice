ALTER TABLE "auth_sessions" ADD COLUMN "fresh_authenticated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "calendar_guest_links" ALTER COLUMN "updated_by_user_id" DROP NOT NULL;
