CREATE TABLE "contact_quality_review_decisions" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "contact_id" text NOT NULL,
  "signal_kind" text NOT NULL,
  "decision" text NOT NULL,
  "matter_id" text,
  "related_contact_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_record_id" text,
  "decided_by_user_id" text NOT NULL,
  "decided_at" timestamp with time zone NOT NULL,
  "reason" text,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_quality_review_decisions_signal_kind_value" CHECK ("contact_quality_review_decisions"."signal_kind" in ('duplicate_candidate', 'protected_party_cue', 'conflict_revalidation')),
  CONSTRAINT "contact_quality_review_decisions_decision_pairing" CHECK (
    ("contact_quality_review_decisions"."signal_kind" = 'duplicate_candidate' and "contact_quality_review_decisions"."decision" in ('duplicate_confirmed', 'not_duplicate', 'needs_more_review')) or
    ("contact_quality_review_decisions"."signal_kind" = 'protected_party_cue' and "contact_quality_review_decisions"."decision" in ('protected_party_handling_confirmed', 'protected_party_handling_not_required', 'needs_more_review')) or
    ("contact_quality_review_decisions"."signal_kind" = 'conflict_revalidation' and "contact_quality_review_decisions"."decision" in ('conflict_revalidation_required', 'conflict_revalidation_not_required', 'needs_more_review'))
  ),
  CONSTRAINT "contact_quality_review_decisions_signal_reference_shape" CHECK (
    ("contact_quality_review_decisions"."signal_kind" = 'duplicate_candidate' and jsonb_array_length("contact_quality_review_decisions"."related_contact_ids") > 0 and "contact_quality_review_decisions"."matter_id" is null and "contact_quality_review_decisions"."source_record_id" is null) or
    ("contact_quality_review_decisions"."signal_kind" = 'protected_party_cue' and jsonb_array_length("contact_quality_review_decisions"."related_contact_ids") = 0 and "contact_quality_review_decisions"."matter_id" is not null and "contact_quality_review_decisions"."source_record_id" is null) or
    ("contact_quality_review_decisions"."signal_kind" = 'conflict_revalidation' and jsonb_array_length("contact_quality_review_decisions"."related_contact_ids") = 0 and "contact_quality_review_decisions"."matter_id" is not null and "contact_quality_review_decisions"."source_record_id" is not null)
  ),
  CONSTRAINT "contact_quality_review_decisions_review_only_evidence" CHECK (not ("contact_quality_review_decisions"."evidence" ?| array[
    'matchedValue',
    'rawMatchedValue',
    'mergeContactId',
    'targetContactId',
    'sourceContactId',
    'contactPatch',
    'contactRewrite',
    'contactUpdate',
    'contactNotes',
    'conflictDisposition',
    'conflictCheckDisposition',
    'disposition'
  ]))
);
--> statement-breakpoint
ALTER TABLE "contact_quality_review_decisions" ADD CONSTRAINT "contact_quality_review_decisions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_quality_review_decisions" ADD CONSTRAINT "contact_quality_review_decisions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_quality_review_decisions" ADD CONSTRAINT "contact_quality_review_decisions_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_quality_review_decisions" ADD CONSTRAINT "contact_quality_review_decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "contact_quality_review_decisions_contact_signal_idx" ON "contact_quality_review_decisions" USING btree ("firm_id","contact_id","signal_kind","decided_at");
--> statement-breakpoint
CREATE INDEX "contact_quality_review_decisions_matter_signal_idx" ON "contact_quality_review_decisions" USING btree ("firm_id","matter_id","signal_kind");
