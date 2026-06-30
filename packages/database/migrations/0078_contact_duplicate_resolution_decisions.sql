CREATE TABLE "contact_duplicate_resolution_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"related_contact_id" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"decision_fingerprint" text NOT NULL,
	"boundaries" jsonb DEFAULT '{"contactMerge":false,"contactFieldMutation":"none","hiddenMatterDisclosure":false,"rawMatchedValueRetention":false,"privateReviewerNoteRetention":false,"conflictCheckMutation":"none","portalPermissionWidening":false,"contactPermissionWidening":false}'::jsonb NOT NULL,
	"reviewed_by_user_id" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_duplicate_resolution_decisions_different_contacts" CHECK ("contact_duplicate_resolution_decisions"."contact_id" <> "contact_duplicate_resolution_decisions"."related_contact_id"),
	CONSTRAINT "contact_duplicate_resolution_decisions_id_format" CHECK ("contact_duplicate_resolution_decisions"."id" ~ '^[A-Za-z0-9_.:-]+$'),
	CONSTRAINT "contact_duplicate_resolution_decisions_decision_value" CHECK ("contact_duplicate_resolution_decisions"."decision" in ('acknowledged_duplicate_candidate', 'not_duplicate', 'needs_follow_up')),
	CONSTRAINT "contact_duplicate_resolution_decisions_reason_value" CHECK ("contact_duplicate_resolution_decisions"."reason" in ('safe_identity_match', 'shared_visible_matter', 'distinct_contact_verified', 'insufficient_safe_evidence', 'reviewer_follow_up_required')),
	CONSTRAINT "contact_duplicate_resolution_decisions_idempotency_key_format" CHECK ("contact_duplicate_resolution_decisions"."idempotency_key" ~ '^[A-Za-z0-9_.:-]+$')
);
--> statement-breakpoint
ALTER TABLE "contact_duplicate_resolution_decisions" ADD CONSTRAINT "contact_duplicate_resolution_decisions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_duplicate_resolution_decisions" ADD CONSTRAINT "contact_duplicate_resolution_decisions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_duplicate_resolution_decisions" ADD CONSTRAINT "contact_duplicate_resolution_decisions_related_contact_id_contacts_id_fk" FOREIGN KEY ("related_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_duplicate_resolution_decisions" ADD CONSTRAINT "contact_duplicate_resolution_decisions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_duplicate_resolution_decisions_contact_reviewed_idx" ON "contact_duplicate_resolution_decisions" USING btree ("firm_id","contact_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "contact_duplicate_resolution_decisions_related_reviewed_idx" ON "contact_duplicate_resolution_decisions" USING btree ("firm_id","related_contact_id","reviewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_duplicate_resolution_decisions_firm_pair_idempotency_idx" ON "contact_duplicate_resolution_decisions" USING btree ("firm_id","contact_id","related_contact_id","idempotency_key");