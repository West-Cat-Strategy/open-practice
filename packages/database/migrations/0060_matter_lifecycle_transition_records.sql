CREATE TYPE matter_lifecycle_transition AS ENUM ('pause', 'close', 'archive', 'reopen');
--> statement-breakpoint
CREATE TYPE matter_lifecycle_readiness AS ENUM ('ready', 'blocked');
--> statement-breakpoint
CREATE TABLE matter_lifecycle_transition_records (
  id text PRIMARY KEY NOT NULL,
  firm_id text NOT NULL REFERENCES firms(id),
  matter_id text NOT NULL REFERENCES matters(id),
  transition matter_lifecycle_transition NOT NULL,
  current_status matter_status NOT NULL,
  target_status matter_status NOT NULL,
  readiness matter_lifecycle_readiness NOT NULL,
  reason text NOT NULL,
  blockers jsonb DEFAULT '[]'::jsonb NOT NULL,
  reviewed_by_user_id text NOT NULL REFERENCES users(id),
  reviewed_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX matter_lifecycle_transition_records_firm_matter_reviewed_idx
  ON matter_lifecycle_transition_records (firm_id, matter_id, reviewed_at);
