CREATE TABLE "legal_research_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"source_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"document_analysis" jsonb,
	"timeline" jsonb,
	"checkpoint" jsonb,
	"review_decision" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_only" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "legal_research_artifacts_kind_value" CHECK ("legal_research_artifacts"."kind" in ('cited_source_note', 'matter_context_attachment', 'document_analysis_status', 'strategy_timeline_note', 'review_checkpoint')),
	CONSTRAINT "legal_research_artifacts_status_value" CHECK ("legal_research_artifacts"."status" in ('draft', 'ready_for_review', 'reviewed', 'rejected')),
	CONSTRAINT "legal_research_artifacts_title_present" CHECK (length(trim("legal_research_artifacts"."title")) > 0),
	CONSTRAINT "legal_research_artifacts_note_length" CHECK ("legal_research_artifacts"."note" is null or length("legal_research_artifacts"."note") <= 4000),
	CONSTRAINT "legal_research_artifacts_source_references_array" CHECK (jsonb_typeof("legal_research_artifacts"."source_references") = 'array'),
	CONSTRAINT "legal_research_artifacts_context_links_array" CHECK (jsonb_typeof("legal_research_artifacts"."context_links") = 'array'),
	CONSTRAINT "legal_research_artifacts_review_decision_value" CHECK ("legal_research_artifacts"."review_decision" is null or "legal_research_artifacts"."review_decision" in ('reviewed', 'rejected')),
	CONSTRAINT "legal_research_artifacts_status_only_review" CHECK ((
        "legal_research_artifacts"."status" in ('draft', 'ready_for_review')
        and "legal_research_artifacts"."review_decision" is null
        and "legal_research_artifacts"."reviewed_by_user_id" is null
        and "legal_research_artifacts"."reviewed_at" is null
      ) or (
        "legal_research_artifacts"."status" in ('reviewed', 'rejected')
        and "legal_research_artifacts"."review_decision" = "legal_research_artifacts"."status"
        and "legal_research_artifacts"."reviewed_by_user_id" is not null
        and "legal_research_artifacts"."reviewed_at" is not null
      )),
	CONSTRAINT "legal_research_artifacts_review_only" CHECK ("legal_research_artifacts"."review_only" = true)
);
--> statement-breakpoint
ALTER TABLE "legal_research_artifacts" ADD CONSTRAINT "legal_research_artifacts_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_research_artifacts" ADD CONSTRAINT "legal_research_artifacts_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_research_artifacts" ADD CONSTRAINT "legal_research_artifacts_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_research_artifacts" ADD CONSTRAINT "legal_research_artifacts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "legal_research_artifacts_firm_matter_idx" ON "legal_research_artifacts" USING btree ("firm_id","matter_id","updated_at");
--> statement-breakpoint
CREATE INDEX "legal_research_artifacts_firm_status_idx" ON "legal_research_artifacts" USING btree ("firm_id","status","updated_at");
--> statement-breakpoint
CREATE INDEX "legal_research_artifacts_firm_kind_idx" ON "legal_research_artifacts" USING btree ("firm_id","kind","updated_at");
