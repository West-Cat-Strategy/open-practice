import { pgEnum } from "drizzle-orm/pg-core";

export const province = pgEnum("province", ["BC", "ON", "CANADA", "OTHER"]);
export const userRole = pgEnum("user_role", [
  "owner_admin",
  "licensee",
  "firm_member",
  "billing_bookkeeper",
  "client_external",
  "auditor",
]);
export const matterStatus = pgEnum("matter_status", [
  "intake",
  "open",
  "paused",
  "closed",
  "archived",
]);
export const jobQueueName = pgEnum("job_queue_name", [
  "email",
  "connectors",
  "document_assembly",
  "inbound_email",
  "reports",
  "ai_triage",
  "ocr",
  "transcription",
  "media",
]);
export const jobLifecycleStatus = pgEnum("job_lifecycle_status", [
  "queued",
  "active",
  "completed",
  "failed",
  "dead_letter",
  "skipped",
]);
