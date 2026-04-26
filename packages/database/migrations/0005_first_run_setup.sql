CREATE TABLE "firm_settings" (
	"firm_id" text PRIMARY KEY NOT NULL,
	"business_address" jsonb NOT NULL,
	"office_email" text NOT NULL,
	"office_phone" text NOT NULL,
	"practice_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invoice_prefix" text NOT NULL,
	"default_payment_terms_days" integer NOT NULL,
	"trust_account_label" text NOT NULL,
	"trust_funds_caveat_accepted_at" timestamp with time zone NOT NULL,
	"trust_funds_caveat_accepted_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "firm_settings" ADD CONSTRAINT "firm_settings_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD CONSTRAINT "firm_settings_trust_funds_caveat_accepted_by_user_id_users_id_fk" FOREIGN KEY ("trust_funds_caveat_accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
