CREATE TYPE "public"."conversation_thread_export_state" AS ENUM('not_requested', 'requested', 'exported');--> statement-breakpoint
CREATE TYPE "public"."conversation_thread_notification_boundary" AS ENUM('disabled', 'internal_only');--> statement-breakpoint
CREATE TYPE "public"."conversation_thread_status" AS ENUM('open', 'closed', 'revoked');--> statement-breakpoint
CREATE TABLE "conversation_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"topic" text NOT NULL,
	"status" "conversation_thread_status" DEFAULT 'open' NOT NULL,
	"retention_until" timestamp with time zone,
	"export_state" "conversation_thread_export_state" DEFAULT 'not_requested' NOT NULL,
	"access_revoked_at" timestamp with time zone,
	"notification_boundary" "conversation_thread_notification_boundary" DEFAULT 'disabled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_threads_firm_matter_updated_idx" ON "conversation_threads" USING btree ("firm_id","matter_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_threads_firm_matter_topic_idx" ON "conversation_threads" USING btree ("firm_id","matter_id","topic");
