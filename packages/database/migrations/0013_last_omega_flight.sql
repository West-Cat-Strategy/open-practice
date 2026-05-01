CREATE TABLE "draft_assist_records" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"source_type" text NOT NULL,
	"draft_id" text,
	"document_id" text,
	"task" text NOT NULL,
	"provider_key" text NOT NULL,
	"provider_model" text NOT NULL,
	"status" text NOT NULL,
	"suggested_text" text NOT NULL,
	"summary" text,
	"review_decision" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draft_assist_records" ADD CONSTRAINT "draft_assist_records_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_assist_records" ADD CONSTRAINT "draft_assist_records_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_assist_records" ADD CONSTRAINT "draft_assist_records_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_assist_records" ADD CONSTRAINT "draft_assist_records_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_assist_records" ADD CONSTRAINT "draft_assist_records_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_assist_records" ADD CONSTRAINT "draft_assist_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "draft_assist_records_firm_matter_idx" ON "draft_assist_records" USING btree ("firm_id","matter_id");--> statement-breakpoint
CREATE INDEX "draft_assist_records_firm_draft_idx" ON "draft_assist_records" USING btree ("firm_id","draft_id");--> statement-breakpoint
CREATE INDEX "draft_assist_records_firm_document_idx" ON "draft_assist_records" USING btree ("firm_id","document_id");