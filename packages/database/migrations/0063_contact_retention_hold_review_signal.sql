ALTER TABLE "contact_data_quality_resolutions"
  DROP CONSTRAINT "contact_data_quality_resolutions_signal_kind_value";

ALTER TABLE "contact_data_quality_resolutions"
  ADD CONSTRAINT "contact_data_quality_resolutions_signal_kind_value"
  CHECK ("contact_data_quality_resolutions"."signal_kind" in ('duplicate_candidate', 'protected_party_cue', 'conflict_revalidation', 'retention_hold_review'));
