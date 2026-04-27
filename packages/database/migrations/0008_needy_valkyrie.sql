ALTER TABLE "firm_settings" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "business_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "practitioner_profile" jsonb;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD COLUMN "device_type" text DEFAULT 'singleDevice' NOT NULL;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD COLUMN "backed_up" boolean DEFAULT false NOT NULL;