CREATE TABLE "hosted_payment_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"client_contact_id" text,
	"status" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"hosted_path" text NOT NULL,
	"delivery_state" jsonb DEFAULT '{"status":"not_sent","channel":"none","recipientCount":0}'::jsonb NOT NULL,
	"reminder_state" jsonb DEFAULT '{"status":"not_scheduled","reminderCount":0}'::jsonb NOT NULL,
	"payment_plan_placeholder" jsonb DEFAULT '{"status":"not_offered","enforcement":"none"}'::jsonb NOT NULL,
	"credit_write_off_posture" jsonb DEFAULT '{"status":"none","movement":"none"}'::jsonb NOT NULL,
	"processor_state" jsonb DEFAULT '{"status":"not_started"}'::jsonb NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "hosted_payment_requests_status_value" CHECK ("hosted_payment_requests"."status" in ('ready_to_send', 'sent', 'viewed', 'cancelled', 'expired')),
	CONSTRAINT "hosted_payment_requests_positive_amount" CHECK ("hosted_payment_requests"."amount_cents" > 0),
	CONSTRAINT "hosted_payment_requests_cad_currency" CHECK ("hosted_payment_requests"."currency" = 'CAD')
);
--> statement-breakpoint
ALTER TABLE "hosted_payment_requests" ADD CONSTRAINT "hosted_payment_requests_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosted_payment_requests" ADD CONSTRAINT "hosted_payment_requests_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosted_payment_requests" ADD CONSTRAINT "hosted_payment_requests_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosted_payment_requests" ADD CONSTRAINT "hosted_payment_requests_client_contact_id_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosted_payment_requests" ADD CONSTRAINT "hosted_payment_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hosted_payment_requests_firm_invoice_idx" ON "hosted_payment_requests" USING btree ("firm_id","invoice_id");--> statement-breakpoint
CREATE INDEX "hosted_payment_requests_matter_status_idx" ON "hosted_payment_requests" USING btree ("firm_id","matter_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "hosted_payment_requests_hosted_path_idx" ON "hosted_payment_requests" USING btree ("hosted_path");
