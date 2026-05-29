CREATE TABLE "integration_developer_apps" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"client_id" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"redirect_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"regional_endpoint" jsonb DEFAULT '{"region":"ca","posture":"cue_only"}'::jsonb NOT NULL,
	"rate_limit" jsonb DEFAULT '{"mode":"documented","windowSeconds":60,"maxRequests":60,"enforcement":"reserved"}'::jsonb NOT NULL,
	"custom_action_placeholders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_developer_apps_status_value" CHECK ("integration_developer_apps"."status" in ('draft', 'active', 'paused', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "integration_api_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"app_id" text NOT NULL,
	"label" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secret_reference" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "integration_api_credentials_status_value" CHECK ("integration_api_credentials"."status" in ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "integration_webhook_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"app_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"status" text DEFAULT 'paused' NOT NULL,
	"event_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"destination_url" text NOT NULL,
	"destination_host" text NOT NULL,
	"signing_secret_reference" jsonb,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_webhook_subscriptions_status_value" CHECK ("integration_webhook_subscriptions"."status" in ('active', 'paused', 'disabled'))
);
--> statement-breakpoint
ALTER TABLE "integration_developer_apps" ADD CONSTRAINT "integration_developer_apps_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_developer_apps" ADD CONSTRAINT "integration_developer_apps_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_developer_apps" ADD CONSTRAINT "integration_developer_apps_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_api_credentials" ADD CONSTRAINT "integration_api_credentials_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_api_credentials" ADD CONSTRAINT "integration_api_credentials_app_id_integration_developer_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."integration_developer_apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_api_credentials" ADD CONSTRAINT "integration_api_credentials_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhook_subscriptions" ADD CONSTRAINT "integration_webhook_subscriptions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhook_subscriptions" ADD CONSTRAINT "integration_webhook_subscriptions_app_id_integration_developer_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."integration_developer_apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhook_subscriptions" ADD CONSTRAINT "integration_webhook_subscriptions_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhook_subscriptions" ADD CONSTRAINT "integration_webhook_subscriptions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_developer_apps_firm_client_idx" ON "integration_developer_apps" USING btree ("firm_id","client_id");--> statement-breakpoint
CREATE INDEX "integration_developer_apps_firm_connector_status_idx" ON "integration_developer_apps" USING btree ("firm_id","connector_id","status");--> statement-breakpoint
CREATE INDEX "integration_api_credentials_firm_app_status_idx" ON "integration_api_credentials" USING btree ("firm_id","app_id","status");--> statement-breakpoint
CREATE INDEX "integration_webhook_subscriptions_firm_app_status_idx" ON "integration_webhook_subscriptions" USING btree ("firm_id","app_id","status");--> statement-breakpoint
CREATE INDEX "integration_webhook_subscriptions_connector_status_idx" ON "integration_webhook_subscriptions" USING btree ("connector_id","status");
