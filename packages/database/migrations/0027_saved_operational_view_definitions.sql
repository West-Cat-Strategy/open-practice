CREATE TYPE "saved_operational_view_surface" AS ENUM ('queues');
CREATE TYPE "saved_operational_view_status" AS ENUM ('active', 'archived');

CREATE TABLE "saved_operational_view_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL REFERENCES "firms"("id"),
  "owner_user_id" text NOT NULL REFERENCES "users"("id"),
  "surface" "saved_operational_view_surface" NOT NULL,
  "name" text NOT NULL,
  "filters" jsonb NOT NULL,
  "columns" jsonb NOT NULL,
  "sort" jsonb NOT NULL,
  "row_limit" integer NOT NULL,
  "dashboard_behavior" jsonb NOT NULL,
  "permission_scope" jsonb NOT NULL,
  "status" "saved_operational_view_status" NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "archived_at" timestamp with time zone,
  CONSTRAINT "saved_operational_views_positive_row_limit" CHECK ("row_limit" > 0)
);

CREATE INDEX "saved_operational_views_owner_surface_status_idx"
  ON "saved_operational_view_definitions" ("firm_id", "owner_user_id", "surface", "status");

CREATE INDEX "saved_operational_views_firm_surface_name_idx"
  ON "saved_operational_view_definitions" ("firm_id", "surface", "name");
