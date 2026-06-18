CREATE TABLE "billing_expense_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "code" text NOT NULL,
  "label" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "default_reimbursable" boolean DEFAULT true NOT NULL,
  "reimbursable_allowed" boolean DEFAULT true NOT NULL,
  "matter_id" text,
  "practice_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "jurisdictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "review_cue" text,
  "created_by_user_id" text,
  "updated_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "billing_expense_categories_code_format"
    CHECK ("billing_expense_categories"."code" ~ '^[a-z0-9_]+$'),
  CONSTRAINT "billing_expense_categories_reimbursable_default_allowed"
    CHECK ("billing_expense_categories"."reimbursable_allowed" OR "billing_expense_categories"."default_reimbursable" = false),
  CONSTRAINT "billing_expense_categories_practice_areas_array"
    CHECK (jsonb_typeof("billing_expense_categories"."practice_areas") = 'array'),
  CONSTRAINT "billing_expense_categories_jurisdictions_array"
    CHECK (jsonb_typeof("billing_expense_categories"."jurisdictions") = 'array')
);
--> statement-breakpoint
ALTER TABLE "billing_expense_categories"
  ADD CONSTRAINT "billing_expense_categories_firm_id_firms_id_fk"
  FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_expense_categories"
  ADD CONSTRAINT "billing_expense_categories_matter_id_matters_id_fk"
  FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_expense_categories"
  ADD CONSTRAINT "billing_expense_categories_created_by_user_id_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_expense_categories"
  ADD CONSTRAINT "billing_expense_categories_updated_by_user_id_users_id_fk"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_expense_categories_firm_code_idx"
  ON "billing_expense_categories" USING btree ("firm_id","code");
--> statement-breakpoint
CREATE INDEX "billing_expense_categories_firm_active_idx"
  ON "billing_expense_categories" USING btree ("firm_id","active");
--> statement-breakpoint
CREATE INDEX "billing_expense_categories_matter_idx"
  ON "billing_expense_categories" USING btree ("matter_id");
--> statement-breakpoint
INSERT INTO "billing_expense_categories" (
  "id",
  "firm_id",
  "code",
  "label",
  "active",
  "default_reimbursable",
  "reimbursable_allowed",
  "practice_areas",
  "jurisdictions",
  "review_cue",
  "created_at",
  "updated_at"
)
SELECT
  "firms"."id" || ':expense-category:' || "seed"."code",
  "firms"."id",
  "seed"."code",
  "seed"."label",
  true,
  "seed"."default_reimbursable",
  true,
  '[]'::jsonb,
  '[]'::jsonb,
  "seed"."review_cue",
  now(),
  now()
FROM "firms"
CROSS JOIN (
  VALUES
    ('filing_service', 'Filing and service', true, 'Attach receipt or registry confirmation before billing approval.'),
    ('courier_postage', 'Courier and postage', true, 'Confirm matter purpose and delivery evidence before approval.'),
    ('research_database', 'Research database', false, 'Confirm client billing agreement before marking reimbursable.'),
    ('travel_meal', 'Travel and meals', false, 'Review policy, purpose, and receipts before approval.')
) AS "seed"("code", "label", "default_reimbursable", "review_cue")
ON CONFLICT ("firm_id", "code") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "expense_entries" ADD COLUMN "category_code" text;
--> statement-breakpoint
CREATE INDEX "expense_entries_firm_category_code_idx"
  ON "expense_entries" USING btree ("firm_id","category_code");
