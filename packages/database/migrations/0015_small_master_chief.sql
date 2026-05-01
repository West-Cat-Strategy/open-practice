CREATE TABLE "intake_form_item_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"intake_session_id" text NOT NULL,
	"form_link_id" text NOT NULL,
	"item_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"document_id" text,
	"signature_request_id" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "intake_form_links" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"intake_session_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"client_contact_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_variable_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"intake_session_id" text NOT NULL,
	"answer_snapshot_id" text NOT NULL,
	"source_question_id" text NOT NULL,
	"target_scope" text NOT NULL,
	"target_field" text NOT NULL,
	"target_record_id" text NOT NULL,
	"proposed_value" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD COLUMN "intake_form_link_id" text;--> statement-breakpoint
ALTER TABLE "intake_form_item_actions" ADD CONSTRAINT "intake_form_item_actions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_form_item_actions" ADD CONSTRAINT "intake_form_item_actions_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_form_item_actions" ADD CONSTRAINT "intake_form_item_actions_intake_session_id_intake_sessions_id_fk" FOREIGN KEY ("intake_session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_form_item_actions" ADD CONSTRAINT "intake_form_item_actions_form_link_id_intake_form_links_id_fk" FOREIGN KEY ("form_link_id") REFERENCES "public"."intake_form_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_form_item_actions" ADD CONSTRAINT "intake_form_item_actions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_form_item_actions" ADD CONSTRAINT "intake_form_item_actions_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_form_links" ADD CONSTRAINT "intake_form_links_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_form_links" ADD CONSTRAINT "intake_form_links_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_form_links" ADD CONSTRAINT "intake_form_links_intake_session_id_intake_sessions_id_fk" FOREIGN KEY ("intake_session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_form_links" ADD CONSTRAINT "intake_form_links_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_form_links" ADD CONSTRAINT "intake_form_links_client_contact_id_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_variable_proposals" ADD CONSTRAINT "intake_variable_proposals_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_variable_proposals" ADD CONSTRAINT "intake_variable_proposals_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_variable_proposals" ADD CONSTRAINT "intake_variable_proposals_intake_session_id_intake_sessions_id_fk" FOREIGN KEY ("intake_session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_variable_proposals" ADD CONSTRAINT "intake_variable_proposals_answer_snapshot_id_answer_snapshots_id_fk" FOREIGN KEY ("answer_snapshot_id") REFERENCES "public"."answer_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_variable_proposals" ADD CONSTRAINT "intake_variable_proposals_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intake_form_item_actions_link_item_idx" ON "intake_form_item_actions" USING btree ("form_link_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_form_links_token_hash_idx" ON "intake_form_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "intake_form_links_matter_expiry_idx" ON "intake_form_links" USING btree ("matter_id","expires_at");--> statement-breakpoint
CREATE INDEX "intake_variable_proposals_matter_status_idx" ON "intake_variable_proposals" USING btree ("matter_id","status");--> statement-breakpoint
CREATE INDEX "intake_variable_proposals_snapshot_idx" ON "intake_variable_proposals" USING btree ("answer_snapshot_id");--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_intake_form_link_id_intake_form_links_id_fk" FOREIGN KEY ("intake_form_link_id") REFERENCES "public"."intake_form_links"("id") ON DELETE no action ON UPDATE no action;