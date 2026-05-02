CREATE TYPE "public"."legal_clinic_eligibility_status" AS ENUM('unknown', 'likely_eligible', 'ineligible', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."legal_clinic_program_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."legal_clinic_referral_status" AS ENUM('not_referred', 'referral_needed', 'referred', 'accepted', 'declined');--> statement-breakpoint
CREATE TABLE "legal_clinic_matter_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"program_id" text NOT NULL,
	"eligibility_status" "legal_clinic_eligibility_status" DEFAULT 'unknown' NOT NULL,
	"referral_source" text,
	"referral_status" "legal_clinic_referral_status" DEFAULT 'not_referred' NOT NULL,
	"referral_date" timestamp with time zone,
	"next_review_date" timestamp with time zone,
	"clinic_relationship_role" text NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_clinic_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"name" text NOT NULL,
	"status" "legal_clinic_program_status" DEFAULT 'active' NOT NULL,
	"service_area" text NOT NULL,
	"eligibility_summary" text NOT NULL,
	"default_referral_source" text,
	"default_referral_status" "legal_clinic_referral_status" DEFAULT 'not_referred' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_clinic_matter_profiles" ADD CONSTRAINT "legal_clinic_matter_profiles_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_clinic_matter_profiles" ADD CONSTRAINT "legal_clinic_matter_profiles_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_clinic_matter_profiles" ADD CONSTRAINT "legal_clinic_matter_profiles_program_id_legal_clinic_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."legal_clinic_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_clinic_matter_profiles" ADD CONSTRAINT "legal_clinic_matter_profiles_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_clinic_programs" ADD CONSTRAINT "legal_clinic_programs_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_clinic_matter_profiles_firm_matter_idx" ON "legal_clinic_matter_profiles" USING btree ("firm_id","matter_id");--> statement-breakpoint
CREATE INDEX "legal_clinic_matter_profiles_program_status_idx" ON "legal_clinic_matter_profiles" USING btree ("firm_id","program_id","referral_status");--> statement-breakpoint
CREATE INDEX "legal_clinic_matter_profiles_review_idx" ON "legal_clinic_matter_profiles" USING btree ("firm_id","next_review_date");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_clinic_programs_firm_name_idx" ON "legal_clinic_programs" USING btree ("firm_id","name");--> statement-breakpoint
CREATE INDEX "legal_clinic_programs_firm_status_idx" ON "legal_clinic_programs" USING btree ("firm_id","status");