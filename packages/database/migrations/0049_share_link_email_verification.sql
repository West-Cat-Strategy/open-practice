ALTER TABLE "share_links" ADD COLUMN "email_verification_code_hash" text;
--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "email_verification_expires_at" timestamp with time zone;
