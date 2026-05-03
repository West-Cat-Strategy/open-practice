CREATE TABLE "connector_delivery_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"outbox_id" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"lease_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error_summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "connector_delivery_attempts_status_value" CHECK ("connector_delivery_attempts"."status" in ('leased', 'delivered', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "connector_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"event_type" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"lease_id" text,
	"leased_until" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"dead_lettered_at" timestamp with time zone,
	"last_error_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_outbox_status_value" CHECK ("connector_outbox"."status" in ('pending', 'leased', 'delivered', 'failed', 'dead_letter', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'disabled' NOT NULL,
	"secret_reference" jsonb,
	"config_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connectors_status_value" CHECK ("connectors"."status" in ('disabled', 'enabled', 'paused', 'error')),
	CONSTRAINT "connectors_type_value" CHECK ("connectors"."type" in ('calendar', 'document_processing', 'email', 'generic', 'inbound_email'))
);
--> statement-breakpoint
ALTER TABLE "answer_snapshots" ALTER COLUMN "resolution" SET DEFAULT '{"templateId":"","templateVersion":1,"visibleQuestionIds":[],"matchedBranchRuleIds":[],"eligiblePackageIds":[],"selectedPackageIds":[],"packageSummaries":[],"packageDocuments":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "connector_delivery_attempts" ADD CONSTRAINT "connector_delivery_attempts_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_delivery_attempts" ADD CONSTRAINT "connector_delivery_attempts_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_delivery_attempts" ADD CONSTRAINT "connector_delivery_attempts_outbox_id_connector_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."connector_outbox"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_outbox" ADD CONSTRAINT "connector_outbox_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_outbox" ADD CONSTRAINT "connector_outbox_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connector_delivery_attempts_outbox_attempt_idx" ON "connector_delivery_attempts" USING btree ("outbox_id","attempt_number");--> statement-breakpoint
CREATE INDEX "connector_delivery_attempts_firm_connector_started_idx" ON "connector_delivery_attempts" USING btree ("firm_id","connector_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_outbox_firm_idempotency_idx" ON "connector_outbox" USING btree ("firm_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "connector_outbox_firm_status_next_attempt_idx" ON "connector_outbox" USING btree ("firm_id","status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "connector_outbox_connector_status_idx" ON "connector_outbox" USING btree ("connector_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "connectors_firm_key_idx" ON "connectors" USING btree ("firm_id","key");--> statement-breakpoint
CREATE INDEX "connectors_firm_type_status_idx" ON "connectors" USING btree ("firm_id","type","status");