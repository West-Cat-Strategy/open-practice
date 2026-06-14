ALTER TABLE "portal_grants" ADD COLUMN "account_user_id" text;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD CONSTRAINT "portal_grants_account_user_id_users_id_fk" FOREIGN KEY ("account_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "portal_document_access" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "document_id" text NOT NULL,
  "portal_grant_id" text NOT NULL,
  "permission" text NOT NULL,
  "granted_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "portal_document_access" ADD CONSTRAINT "portal_document_access_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document_access" ADD CONSTRAINT "portal_document_access_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document_access" ADD CONSTRAINT "portal_document_access_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document_access" ADD CONSTRAINT "portal_document_access_portal_grant_id_portal_grants_id_fk" FOREIGN KEY ("portal_grant_id") REFERENCES "public"."portal_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document_access" ADD CONSTRAINT "portal_document_access_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portal_document_access_firm_matter_document_idx" ON "portal_document_access" USING btree ("firm_id","matter_id","document_id");--> statement-breakpoint
CREATE INDEX "portal_document_access_firm_grant_idx" ON "portal_document_access" USING btree ("firm_id","portal_grant_id");--> statement-breakpoint
ALTER TABLE "portal_document_access" ADD CONSTRAINT "portal_document_access_permission_value" CHECK ("portal_document_access"."permission" = 'view_document');
