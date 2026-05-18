CREATE TYPE "public"."conversation_message_kind" AS ENUM('internal_note', 'client_message', 'imported_email');--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"kind" "conversation_message_kind" DEFAULT 'internal_note' NOT NULL,
	"body_text" text NOT NULL,
	"authored_at" timestamp with time zone NOT NULL,
	"authored_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_thread_id_conversation_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."conversation_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_authored_by_user_id_users_id_fk" FOREIGN KEY ("authored_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_messages_firm_matter_thread_authored_idx" ON "conversation_messages" USING btree ("firm_id","matter_id","thread_id","authored_at");
