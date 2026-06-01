CREATE TABLE "ai_operational_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"source" jsonb NOT NULL,
	"provider_key" text NOT NULL,
	"provider_model" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"review_decision" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "ai_operational_proposals_kind_value" CHECK ("ai_operational_proposals"."kind" in ('deadline_extraction', 'task_creation', 'document_organization', 'draft_invoice_cue', 'client_update_draft')),
	CONSTRAINT "ai_operational_proposals_status_value" CHECK ("ai_operational_proposals"."status" in ('proposed', 'approved', 'rejected')),
	CONSTRAINT "ai_operational_proposals_source_type_value" CHECK ("ai_operational_proposals"."source"->>'sourceType' in ('draft', 'document')),
	CONSTRAINT "ai_operational_proposals_draft_source_id" CHECK ("ai_operational_proposals"."source"->>'sourceType' <> 'draft' or length(trim(coalesce("ai_operational_proposals"."source"->>'draftId', ''))) > 0),
	CONSTRAINT "ai_operational_proposals_document_source_id" CHECK ("ai_operational_proposals"."source"->>'sourceType' <> 'document' or length(trim(coalesce("ai_operational_proposals"."source"->>'documentId', ''))) > 0),
	CONSTRAINT "ai_operational_proposals_source_text_length" CHECK (jsonb_typeof("ai_operational_proposals"."source"->'sourceTextLength') = 'number' and ("ai_operational_proposals"."source"->>'sourceTextLength')::integer >= 0),
	CONSTRAINT "ai_operational_proposals_proposal_title" CHECK (length(trim(coalesce("ai_operational_proposals"."proposal"->>'title', ''))) > 0),
	CONSTRAINT "ai_operational_proposals_proposal_summary" CHECK (length(trim(coalesce("ai_operational_proposals"."proposal"->>'summary', ''))) > 0),
	CONSTRAINT "ai_operational_proposals_proposal_action" CHECK (length(trim(coalesce("ai_operational_proposals"."proposal"->>'proposedAction', ''))) > 0),
	CONSTRAINT "ai_operational_proposals_review_decision_value" CHECK ("ai_operational_proposals"."review_decision" is null or "ai_operational_proposals"."review_decision" in ('approved', 'rejected')),
	CONSTRAINT "ai_operational_proposals_status_only_review" CHECK ((
        "ai_operational_proposals"."status" = 'proposed'
        and "ai_operational_proposals"."review_decision" is null
        and "ai_operational_proposals"."reviewed_by_user_id" is null
        and "ai_operational_proposals"."reviewed_at" is null
      ) or (
        "ai_operational_proposals"."status" in ('approved', 'rejected')
        and "ai_operational_proposals"."review_decision" = "ai_operational_proposals"."status"
        and "ai_operational_proposals"."reviewed_by_user_id" is not null
        and "ai_operational_proposals"."reviewed_at" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "ai_operational_proposals" ADD CONSTRAINT "ai_operational_proposals_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_operational_proposals" ADD CONSTRAINT "ai_operational_proposals_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_operational_proposals" ADD CONSTRAINT "ai_operational_proposals_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_operational_proposals" ADD CONSTRAINT "ai_operational_proposals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ai_operational_proposals_firm_matter_idx" ON "ai_operational_proposals" USING btree ("firm_id","matter_id","created_at");
--> statement-breakpoint
CREATE INDEX "ai_operational_proposals_firm_status_idx" ON "ai_operational_proposals" USING btree ("firm_id","status","created_at");
--> statement-breakpoint
CREATE INDEX "ai_operational_proposals_firm_kind_idx" ON "ai_operational_proposals" USING btree ("firm_id","kind","created_at");
