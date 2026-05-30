CREATE TABLE "document_assembly_set_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"practice_area" text,
	"document_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_merge_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE "document_assembly_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"definition_id" text,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"population_status" text NOT NULL,
	"source_draft_id" text,
	"intake_session_id" text,
	"package_id" text,
	"document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signature_request_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "document_assembly_packages_status_value" CHECK ("document_assembly_packages"."status" in ('planning', 'ready_for_generation', 'assembled', 'blocked')),
	CONSTRAINT "document_assembly_packages_population_status_value" CHECK ("document_assembly_packages"."population_status" in ('needs_review', 'ready', 'populated', 'blocked'))
);

CREATE TABLE "signature_envelopes" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"assembly_package_id" text,
	"signature_request_id" text,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"signer_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"field_placements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"validation_status" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "signature_envelopes_status_value" CHECK ("signature_envelopes"."status" in ('draft', 'ready', 'sent', 'completed', 'blocked')),
	CONSTRAINT "signature_envelopes_validation_status_value" CHECK ("signature_envelopes"."validation_status" in ('unchecked', 'valid', 'needs_review', 'invalid'))
);

ALTER TABLE "document_assembly_set_definitions" ADD CONSTRAINT "document_assembly_set_definitions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "document_assembly_packages" ADD CONSTRAINT "document_assembly_packages_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "document_assembly_packages" ADD CONSTRAINT "document_assembly_packages_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "document_assembly_packages" ADD CONSTRAINT "document_assembly_packages_definition_id_document_assembly_set_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."document_assembly_set_definitions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "document_assembly_packages" ADD CONSTRAINT "document_assembly_packages_source_draft_id_drafts_id_fk" FOREIGN KEY ("source_draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "document_assembly_packages" ADD CONSTRAINT "document_assembly_packages_intake_session_id_intake_sessions_id_fk" FOREIGN KEY ("intake_session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "document_assembly_packages" ADD CONSTRAINT "document_assembly_packages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_assembly_package_id_document_assembly_packages_id_fk" FOREIGN KEY ("assembly_package_id") REFERENCES "public"."document_assembly_packages"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "document_assembly_sets_firm_active_idx" ON "document_assembly_set_definitions" USING btree ("firm_id","active");
CREATE INDEX "document_assembly_packages_matter_status_idx" ON "document_assembly_packages" USING btree ("firm_id","matter_id","status");
CREATE INDEX "document_assembly_packages_definition_idx" ON "document_assembly_packages" USING btree ("definition_id");
CREATE INDEX "signature_envelopes_package_idx" ON "signature_envelopes" USING btree ("assembly_package_id");
CREATE INDEX "signature_envelopes_matter_status_idx" ON "signature_envelopes" USING btree ("firm_id","matter_id","status");
