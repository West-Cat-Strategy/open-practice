CREATE INDEX "audit_events_firm_action_sequence_idx" ON "audit_events" USING btree ("firm_id","action","sequence");--> statement-breakpoint
CREATE INDEX "audit_events_firm_resource_sequence_idx" ON "audit_events" USING btree ("firm_id","resource_type","resource_id","sequence");
