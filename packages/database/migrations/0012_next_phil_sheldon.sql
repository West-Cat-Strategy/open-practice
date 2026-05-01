ALTER TABLE "answer_snapshots" ADD COLUMN "resolution" jsonb DEFAULT '{"templateId":"","templateVersion":1,"visibleQuestionIds":[],"eligiblePackageIds":[],"selectedPackageIds":[],"packageDocuments":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD COLUMN "package_id" text;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD COLUMN "package_document_id" text;--> statement-breakpoint
ALTER TABLE "intake_templates" ADD COLUMN "definition_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_templates" ADD COLUMN "definition" jsonb DEFAULT '{"schemaVersion":1,"questions":[],"branchRules":[],"packages":[]}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "intake_templates"
SET
  "definition_version" = 1,
  "definition" = '{"schemaVersion":1,"questions":[{"id":"issue_type","label":"Issue type","type":"select","required":true,"options":[{"value":"repair","label":"Repair or maintenance"},{"value":"deposit","label":"Security deposit"},{"value":"notice","label":"Notice to end tenancy"}]},{"id":"urgent","label":"Urgent deadline","type":"boolean"},{"id":"repair_details","label":"Repair details","type":"textarea"}],"branchRules":[{"id":"repair-package","questionId":"issue_type","operator":"equals","value":"repair","showQuestionIds":["repair_details"],"eligiblePackageIds":["repair_notice_package"]},{"id":"urgent-review-package","questionId":"urgent","operator":"equals","value":true,"eligiblePackageIds":["urgent_review_package"]}],"packages":[{"id":"repair_notice_package","title":"Repair notice package","default":true,"documents":[{"id":"repair_notice_letter","title":"Repair notice letter"},{"id":"client_instruction_summary","title":"Client instruction summary"}]},{"id":"urgent_review_package","title":"Urgent review package","documents":[{"id":"urgent_review_memo","title":"Urgent review memo"}]}]}'::jsonb
WHERE "id" = 'intake-template-001';
