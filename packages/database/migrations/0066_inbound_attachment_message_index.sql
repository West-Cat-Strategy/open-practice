CREATE INDEX "inbound_email_attachments_firm_message_idx"
  ON "inbound_email_attachments" USING btree ("firm_id","inbound_message_id");
