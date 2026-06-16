ALTER TABLE "signature_requests" ADD COLUMN "signer_order" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "signature_requests" ADD COLUMN "field_placements" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "signature_requests" ADD COLUMN "validation_status" text DEFAULT 'unchecked' NOT NULL;

