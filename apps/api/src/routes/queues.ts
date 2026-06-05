import type { FastifyInstance } from "fastify";
import {
  buildTaskDeadlineWorkbench,
  canAccess,
  canShareDocumentThroughPortal,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireStaffAccess } from "../http/auth-guards.js";
import type { ApiRouteDependencies } from "./types.js";

export function registerQueuesRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/queues", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const matters = await repository.listMattersForUser(request.auth.user);
    const grants = await repository.listPortalGrants(request.auth.firmId);
    const signatures = await repository.listSignatureRequests(request.auth.firmId);
    const intake = await repository.listIntakeSessions(request.auth.firmId);
    const intakeLinks = await repository.listIntakeFormLinks(request.auth.firmId);
    const intakeReviews = await repository.listIntakeFormReviews(request.auth.firmId);
    const canReadAudit = canAccess({
      user: request.auth.user,
      firmId: request.auth.firmId,
      resource: "audit_log",
      action: "read",
    });
    const canReadFirmLedger = hasFirmWideLedgerAccess(request.auth.user);
    const audit = canReadAudit ? await repository.listAuditEvents(request.auth.firmId) : undefined;
    const reconciliations = canReadFirmLedger
      ? await repository.listLedgerReconciliations(request.auth.firmId)
      : [];
    const matterIds = new Set(matters.map((matter) => matter.id));
    const visibleSignatures = signatures.filter((signature) => matterIds.has(signature.matterId));
    const visibleIntake = intake.filter((session) => matterIds.has(session.matterId));
    const reviewedIntakeLinkIds = new Set(intakeReviews.map((review) => review.formLinkId));
    const visibleSubmittedIntakeLinks = intakeLinks.filter(
      (link) =>
        matterIds.has(link.matterId) &&
        Boolean(link.submittedAt) &&
        Boolean(link.answerSnapshotId) &&
        !reviewedIntakeLinkIds.has(link.id),
    );
    const documents = matters.flatMap((matter) => matter.documents);
    const taskWorkbench = buildTaskDeadlineWorkbench({
      tasks: await repository.listTaskDeadlines(request.auth.firmId, {
        matterIds: [...matterIds],
      }),
      matterParties: matters.flatMap((matter) => matter.parties),
      userId: request.auth.user.id,
    });

    return {
      sections: [
        {
          key: "matters",
          label: "Matter work",
          items: matters
            .filter((matter) => matter.status === "intake" || matter.activity.length === 0)
            .map((matter) => ({
              id: matter.id,
              matterId: matter.id,
              title: matter.title,
              status: matter.status,
              priority: matter.status === "intake" ? "medium" : "low",
            })),
        },
        {
          key: "task-deadlines",
          label: "Task deadlines",
          items: taskWorkbench.tasks
            .filter((task) => task.completionStatus === "open" && task.bucket !== "unscheduled")
            .map((task) => ({
              id: task.id,
              matterId: task.matterId,
              title: task.title,
              status: task.bucket,
              priority: task.bucket === "overdue" ? "high" : "medium",
            })),
        },
        {
          key: "documents",
          label: "Document review",
          items: documents
            .filter(
              (document) =>
                !grants.some((grant) => canShareDocumentThroughPortal({ document, grant })),
            )
            .map((document) => ({
              id: document.id,
              matterId: document.matterId,
              title: document.title,
              status: `${document.uploadStatus}/${document.checksumStatus}/${document.scanStatus}/${document.reviewStatus}`,
              priority:
                document.legalHold ||
                document.checksumStatus === "mismatch" ||
                document.scanStatus === "failed" ||
                ["needs_metadata", "retry_requested", "discarded"].includes(document.reviewStatus)
                  ? "high"
                  : "medium",
            })),
        },
        {
          key: "signatures",
          label: "Signature follow-up",
          items: visibleSignatures
            .filter((signature) => !["completed", "declined"].includes(signature.status))
            .map((signature) => ({
              id: signature.id,
              matterId: signature.matterId,
              title: signature.title,
              status: signature.status,
              priority: signature.status === "provider_error" ? "high" : "medium",
            })),
        },
        {
          key: "intake",
          label: "Intake automation",
          items: [
            ...visibleIntake
              .filter((session) => session.status !== "completed")
              .map((session) => ({
                id: session.id,
                matterId: session.matterId,
                title: session.templateId,
                status: session.status,
                priority: session.status === "provider_error" ? "high" : "medium",
              })),
            ...visibleSubmittedIntakeLinks.map((link) => ({
              id: link.id,
              matterId: link.matterId,
              title: "Submitted intake review",
              status: "pending_review",
              priority: "high",
            })),
          ],
        },
        {
          key: "ledger",
          label: "Ledger exceptions",
          items: reconciliations
            .filter((reconciliation) => reconciliation.status === "exception")
            .map((reconciliation) => ({
              id: reconciliation.id,
              title: reconciliation.accountId,
              status: reconciliation.status,
              priority: "high",
            })),
        },
        {
          key: "audit",
          label: "Audit review",
          items:
            !audit || audit.valid
              ? []
              : [
                  {
                    id: "audit-chain",
                    title: "Audit chain validation",
                    status: "invalid",
                    priority: "high",
                  },
                ],
        },
      ],
    };
  });
}
