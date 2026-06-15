ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'former_client';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'related_party';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'court_tribunal';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'lawyer';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'paralegal';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'authorized_non_lawyer_provider';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'legal_representative';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'insurer';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'expert';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'vendor';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'referral_source';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'internal_team_member';--> statement-breakpoint
ALTER TYPE "party_role" ADD VALUE IF NOT EXISTS 'other';--> statement-breakpoint

ALTER TABLE "contacts" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "role_categories" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "canonical_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "given_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "middle_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "family_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "pronouns" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "organization_legal_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "organization_operating_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "organization_registered_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "organization_type" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "former_names" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "contact_methods" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "preferred_contact_method_id" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "preferred_language" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "communication_notes" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "accessibility_notes" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "private_notes" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "conflict_sensitive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "adverse" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "confidentiality_marker" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "do_not_contact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "updated_by_user_id" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_firm_status_idx" ON "contacts" USING btree ("firm_id","status");--> statement-breakpoint
CREATE INDEX "contacts_firm_kind_status_idx" ON "contacts" USING btree ("firm_id","kind","status");--> statement-breakpoint
CREATE INDEX "contacts_firm_canonical_name_idx" ON "contacts" USING btree ("firm_id","canonical_name");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_confidentiality_marker_value" CHECK ("contacts"."confidentiality_marker" in ('standard', 'confidential', 'restricted'));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_status_value" CHECK ("contacts"."status" in ('prospective', 'active', 'inactive', 'archived', 'former', 'restricted'));--> statement-breakpoint

ALTER TABLE "contact_relationships" ADD COLUMN "reciprocal_label" text;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD COLUMN "effective_on" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD COLUMN "ended_on" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD COLUMN "private_notes" text;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD COLUMN "include_in_conflict_check" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD COLUMN "updated_by_user_id" text;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_relationships" DROP CONSTRAINT "contact_relationships_kind_value";--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_kind_value" CHECK ("contact_relationships"."relationship_kind" in ('authorized_representative', 'director_of', 'employee_of', 'employer_of', 'expert_for', 'family_contact', 'family_member', 'guardian_of', 'insurer_for', 'lawyer_for', 'officer_of', 'owned_by', 'owner_of', 'parent_of', 'paralegal_for', 'partner_of', 'subsidiary_of', 'agent_for', 'opposing_counsel_for', 'opposing_party_for', 'referral_source', 'spouse_partner', 'witness_against', 'witness_for', 'custom'));--> statement-breakpoint
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_date_order" CHECK ("contact_relationships"."ended_on" is null or "contact_relationships"."effective_on" is null or "contact_relationships"."ended_on" >= "contact_relationships"."effective_on");--> statement-breakpoint

ALTER TABLE "matter_parties" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD COLUMN "side" text;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD COLUMN "started_on" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD COLUMN "ended_on" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD COLUMN "private_notes" text;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD COLUMN "conflict_check_included" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD COLUMN "updated_by_user_id" text;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD CONSTRAINT "matter_parties_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD CONSTRAINT "matter_parties_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matter_parties_matter_status_idx" ON "matter_parties" USING btree ("firm_id","matter_id","status");--> statement-breakpoint
CREATE INDEX "matter_parties_contact_status_idx" ON "matter_parties" USING btree ("firm_id","contact_id","status");--> statement-breakpoint
CREATE INDEX "matter_parties_role_status_idx" ON "matter_parties" USING btree ("firm_id","role","status");--> statement-breakpoint
ALTER TABLE "matter_parties" ADD CONSTRAINT "matter_parties_status_value" CHECK ("matter_parties"."status" in ('active', 'inactive'));--> statement-breakpoint
ALTER TABLE "matter_parties" ADD CONSTRAINT "matter_parties_side_value" CHECK ("matter_parties"."side" is null or "matter_parties"."side" in ('client', 'opposing', 'neutral', 'internal', 'court', 'other'));--> statement-breakpoint
ALTER TABLE "matter_parties" ADD CONSTRAINT "matter_parties_date_order" CHECK ("matter_parties"."ended_on" is null or "matter_parties"."started_on" is null or "matter_parties"."ended_on" >= "matter_parties"."started_on");--> statement-breakpoint

ALTER TABLE "portal_grants" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD COLUMN "revoked_by_user_id" text;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD COLUMN "updated_by_user_id" text;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD CONSTRAINT "portal_grants_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD CONSTRAINT "portal_grants_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portal_grants_firm_matter_contact_status_idx" ON "portal_grants" USING btree ("firm_id","matter_id","contact_id","status");--> statement-breakpoint
CREATE INDEX "portal_grants_firm_account_status_idx" ON "portal_grants" USING btree ("firm_id","account_user_id","status");
