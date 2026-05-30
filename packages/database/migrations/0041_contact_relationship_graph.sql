CREATE TABLE "contact_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"related_contact_id" text NOT NULL,
	"relationship_kind" text NOT NULL,
	"label" text NOT NULL,
	"matter_id" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "contact_relationships_kind_value" CHECK ("contact_relationships"."relationship_kind" in ('authorized_representative', 'employee_of', 'family_contact', 'opposing_party_for', 'referral_source')),
	CONSTRAINT "contact_relationships_source_value" CHECK ("contact_relationships"."source" in ('manual', 'matter_party', 'intake')),
	CONSTRAINT "contact_relationships_status_value" CHECK ("contact_relationships"."status" in ('active', 'review_needed', 'ended')),
	CONSTRAINT "contact_relationships_label_present" CHECK (length(trim("contact_relationships"."label")) > 0),
	CONSTRAINT "contact_relationships_different_contacts" CHECK ("contact_relationships"."contact_id" <> "contact_relationships"."related_contact_id")
);
--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_related_contact_id_contacts_id_fk" FOREIGN KEY ("related_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_relationships_contact_status_idx" ON "contact_relationships" USING btree ("firm_id","contact_id","status");--> statement-breakpoint
CREATE INDEX "contact_relationships_related_contact_status_idx" ON "contact_relationships" USING btree ("firm_id","related_contact_id","status");--> statement-breakpoint
CREATE INDEX "contact_relationships_matter_status_idx" ON "contact_relationships" USING btree ("firm_id","matter_id","status");
