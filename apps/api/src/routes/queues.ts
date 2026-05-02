import type { FastifyInstance } from "fastify";
import { canAccess, canShareDocumentThroughPortal } from "@open-practice/domain";
import { hasFirmWideLedgerAccess } from "../http/auth-guards.js";
import type { ApiRouteDependencies } from "./types.js";

export function registerQueuesRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/queues", async (request) => {
    const matters = await repository.listMattersForUser(request.auth.user);
    const grants = await repository.listPortalGrants(request.auth.firmId);
    const signatures = await repository.listSignatureRequests(request.auth.firmId);
    const intake = await repository.listIntakeSessions(request.auth.firmId);
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
    const documents = matters.flatMap((matter) => matter.documents);

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
          items: visibleIntake
            .filter((session) => session.status !== "completed")
            .map((session) => ({
              id: session.id,
              matterId: session.matterId,
              title: session.templateId,
              status: session.status,
              priority: session.status === "provider_error" ? "high" : "medium",
            })),
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
