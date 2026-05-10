ALTER TABLE "intake_form_links" ADD COLUMN "parent_form_link_id" text;
ALTER TABLE "intake_form_links" ADD COLUMN "answer_snapshot_id" text;
ALTER TABLE "intake_form_links" ADD CONSTRAINT "intake_form_links_parent_form_link_id_intake_form_links_id_fk" FOREIGN KEY ("parent_form_link_id") REFERENCES "public"."intake_form_links"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "intake_form_links" ADD CONSTRAINT "intake_form_links_answer_snapshot_id_answer_snapshots_id_fk" FOREIGN KEY ("answer_snapshot_id") REFERENCES "public"."answer_snapshots"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "intake_form_links_parent_idx" ON "intake_form_links" USING btree ("parent_form_link_id");
CREATE INDEX "intake_form_links_snapshot_idx" ON "intake_form_links" USING btree ("answer_snapshot_id");

CREATE TABLE "intake_form_reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "intake_session_id" text NOT NULL,
  "form_link_id" text NOT NULL,
  "answer_snapshot_id" text NOT NULL,
  "decision" text NOT NULL,
  "decided_by_user_id" text NOT NULL,
  "decided_at" timestamp with time zone NOT NULL,
  "reason" text,
  "follow_up_form_link_id" text,
  CONSTRAINT "intake_form_reviews_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "intake_form_reviews_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "intake_form_reviews_intake_session_id_intake_sessions_id_fk" FOREIGN KEY ("intake_session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "intake_form_reviews_form_link_id_intake_form_links_id_fk" FOREIGN KEY ("form_link_id") REFERENCES "public"."intake_form_links"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "intake_form_reviews_answer_snapshot_id_answer_snapshots_id_fk" FOREIGN KEY ("answer_snapshot_id") REFERENCES "public"."answer_snapshots"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "intake_form_reviews_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "intake_form_reviews_follow_up_form_link_id_intake_form_links_id_fk" FOREIGN KEY ("follow_up_form_link_id") REFERENCES "public"."intake_form_links"("id") ON DELETE no action ON UPDATE no action
);
CREATE UNIQUE INDEX "intake_form_reviews_form_link_idx" ON "intake_form_reviews" USING btree ("form_link_id");
CREATE INDEX "intake_form_reviews_snapshot_idx" ON "intake_form_reviews" USING btree ("answer_snapshot_id");
CREATE INDEX "intake_form_reviews_matter_decision_idx" ON "intake_form_reviews" USING btree ("matter_id","decision");
