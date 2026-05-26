CREATE TABLE "conversation_message_notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "thread_id" text NOT NULL,
  "message_id" text NOT NULL,
  "recipient_user_id" text NOT NULL,
  "read_at" timestamp with time zone,
  "muted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by_user_id" text NOT NULL,
  "updated_by_user_id" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_message_notifications" ADD CONSTRAINT "conversation_message_notifications_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversation_message_notifications" ADD CONSTRAINT "conversation_message_notifications_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversation_message_notifications" ADD CONSTRAINT "conversation_message_notifications_thread_id_conversation_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."conversation_threads"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversation_message_notifications" ADD CONSTRAINT "conversation_message_notifications_message_id_conversation_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."conversation_messages"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversation_message_notifications" ADD CONSTRAINT "conversation_message_notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversation_message_notifications" ADD CONSTRAINT "conversation_message_notifications_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversation_message_notifications" ADD CONSTRAINT "conversation_message_notifications_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "conversation_message_notifications_firm_matter_thread_created_idx" ON "conversation_message_notifications" USING btree ("firm_id","matter_id","thread_id","created_at");
--> statement-breakpoint
CREATE INDEX "conversation_message_notifications_firm_recipient_created_idx" ON "conversation_message_notifications" USING btree ("firm_id","recipient_user_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_message_notifications_firm_message_recipient_idx" ON "conversation_message_notifications" USING btree ("firm_id","message_id","recipient_user_id");
