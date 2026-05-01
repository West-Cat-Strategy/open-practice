ALTER TABLE "intake_templates" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "intake_templates" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_templates" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_templates" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_templates" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;