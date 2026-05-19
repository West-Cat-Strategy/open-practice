CREATE TABLE "billing_rate_presets" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text,
  "user_id" text,
  "label" text NOT NULL,
  "rate_cents" integer NOT NULL,
  "currency" text DEFAULT 'CAD' NOT NULL,
  "effective_from" timestamp with time zone NOT NULL,
  "effective_to" timestamp with time zone,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "billing_rate_presets_non_negative_rate" CHECK ("rate_cents" >= 0),
  CONSTRAINT "billing_rate_presets_valid_effective_range" CHECK (
    "effective_to" IS NULL OR "effective_to" >= "effective_from"
  )
);

ALTER TABLE "billing_rate_presets"
  ADD CONSTRAINT "billing_rate_presets_firm_id_firms_id_fk"
  FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "billing_rate_presets"
  ADD CONSTRAINT "billing_rate_presets_matter_id_matters_id_fk"
  FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "billing_rate_presets"
  ADD CONSTRAINT "billing_rate_presets_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "billing_rate_presets"
  ADD CONSTRAINT "billing_rate_presets_created_by_user_id_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "billing_rate_presets_scope_effective_idx"
  ON "billing_rate_presets" USING btree ("firm_id", "matter_id", "user_id", "effective_from");

CREATE TABLE "billing_period_locks" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text,
  "starts_on" text NOT NULL,
  "ends_on" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "locked_by_user_id" text NOT NULL,
  "locked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "released_by_user_id" text,
  "released_at" timestamp with time zone,
  "reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "billing_period_locks_valid_period" CHECK ("starts_on" <= "ends_on"),
  CONSTRAINT "billing_period_locks_status_value" CHECK ("status" IN ('active', 'released'))
);

ALTER TABLE "billing_period_locks"
  ADD CONSTRAINT "billing_period_locks_firm_id_firms_id_fk"
  FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "billing_period_locks"
  ADD CONSTRAINT "billing_period_locks_matter_id_matters_id_fk"
  FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "billing_period_locks"
  ADD CONSTRAINT "billing_period_locks_locked_by_user_id_users_id_fk"
  FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "billing_period_locks"
  ADD CONSTRAINT "billing_period_locks_released_by_user_id_users_id_fk"
  FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "billing_period_locks_active_scope_idx"
  ON "billing_period_locks" USING btree ("firm_id", "matter_id", "status", "starts_on", "ends_on");
