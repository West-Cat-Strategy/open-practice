CREATE TABLE trust_posting_requests (
  id text PRIMARY KEY NOT NULL,
  firm_id text NOT NULL REFERENCES firms(id),
  transaction_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  status text DEFAULT 'pending_approval' NOT NULL,
  proposed_posted_at timestamp with time zone NOT NULL,
  entries jsonb DEFAULT '[]'::jsonb NOT NULL,
  matter_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
  client_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
  account_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
  reverses_transaction_id text REFERENCES trust_transactions(id),
  prepared_by_user_id text NOT NULL REFERENCES users(id),
  prepared_at timestamp with time zone NOT NULL,
  preparation_notes text,
  reviewed_by_user_id text REFERENCES users(id),
  reviewed_at timestamp with time zone,
  review_notes text,
  rejection_reason text,
  ledger_transaction_id text REFERENCES trust_transactions(id),
  CONSTRAINT trust_posting_requests_status_value
    CHECK (status in ('pending_approval', 'posted', 'rejected')),
  CONSTRAINT trust_posting_requests_entries_present
    CHECK (jsonb_array_length(entries) > 0),
  CONSTRAINT trust_posting_requests_checker_differs
    CHECK (reviewed_by_user_id is null or reviewed_by_user_id <> prepared_by_user_id),
  CONSTRAINT trust_posting_requests_posted_fields
    CHECK (
      status <> 'posted'
      OR (
        reviewed_by_user_id is not null
        AND reviewed_at is not null
        AND ledger_transaction_id is not null
      )
    ),
  CONSTRAINT trust_posting_requests_rejected_fields
    CHECK (
      status <> 'rejected'
      OR (
        reviewed_by_user_id is not null
        AND reviewed_at is not null
        AND rejection_reason is not null
        AND length(trim(rejection_reason)) > 0
        AND ledger_transaction_id is null
      )
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX trust_posting_requests_idempotency_idx
  ON trust_posting_requests (firm_id, idempotency_key);
--> statement-breakpoint
CREATE INDEX trust_posting_requests_status_prepared_idx
  ON trust_posting_requests (firm_id, status, prepared_at);
--> statement-breakpoint
CREATE INDEX trust_posting_requests_transaction_idx
  ON trust_posting_requests (firm_id, transaction_id);
