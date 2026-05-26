CREATE TYPE "public"."public_consultation_intake_status" AS ENUM('pending', 'converted', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."provider_setting_kind" ADD VALUE IF NOT EXISTS 'public_intake';--> statement-breakpoint
ALTER TABLE "email_outbox" ALTER COLUMN "matter_id" DROP NOT NULL;--> statement-breakpoint
CREATE TABLE "public_consultation_intakes" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"status" "public_consultation_intake_status" DEFAULT 'pending' NOT NULL,
	"client_name" text NOT NULL,
	"telephone" text NOT NULL,
	"email" text,
	"opposing_party_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"matter_description" text NOT NULL,
	"source_url" text,
	"disclosure_accepted_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"dismissed_reason" text,
	"converted_matter_id" text,
	"notification_email_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "public_consultation_intakes" ADD CONSTRAINT "public_consultation_intakes_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_consultation_intakes" ADD CONSTRAINT "public_consultation_intakes_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_consultation_intakes" ADD CONSTRAINT "public_consultation_intakes_converted_matter_id_matters_id_fk" FOREIGN KEY ("converted_matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_consultation_intakes_firm_status_submitted_idx" ON "public_consultation_intakes" USING btree ("firm_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "public_consultation_intakes_converted_matter_idx" ON "public_consultation_intakes" USING btree ("converted_matter_id");
