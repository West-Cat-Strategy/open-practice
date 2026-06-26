import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  buildDraftExportDocument,
  defaultSignatureRequestEnvelopeMetadata,
  draftExportFormats,
  UnknownDraftMergeFieldError,
  type AnswerSnapshotRecord,
  type Contact,
  type DraftMergeContext,
  type EmbeddedIntakePackageDocument,
  type EmbeddedIntakeTemplateDefinition,
  type IntakeFormItemActionRecord,
  type IntakeFormLinkRecord,
  type IntakeFormReviewRecord,
  type PortalDocumentAccess,
  type PortalGrant,
  type SignatureProviderEventRecord,
  type SignatureRequestRecord,
  type SignatureRequestSignerRecord,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import { activePortalGrant, portalDocumentAccessVisible } from "../client-portal/shared.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "../delivery-confirmation.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "../outbound-email.js";
import type { ApiAuthContext } from "../../server.js";
import type { IntakeFormRouteDependencies } from "./shared.js";
import { getTemplateForSession, intakeTemplateParamsSchema } from "./shared.js";

const engagementLetterBodySchema = z.object({
  packageId: z.string().min(1),
  packageDocumentId: z.string().min(1),
  portalGrantId: z.string().min(1),
  format: z.enum(draftExportFormats).default("pdf"),
  deliveryConfirmation: deliveryConfirmationSchema.optional(),
});

type SubmittedReviewPayload = {
  link: IntakeFormLinkRecord;
  snapshot: AnswerSnapshotRecord;
  actions: IntakeFormItemActionRecord[];
  reviews: IntakeFormReviewRecord[];
};

function assertRouteAccess(
  context: ApiAuthContext,
  request: Parameters<typeof requireAccess>[1],
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

async function getSubmittedReviewPayload(
  repository: IntakeFormRouteDependencies["repository"],
  firmId: string,
  linkId: string,
): Promise<SubmittedReviewPayload> {
  const link = await repository.getIntakeFormLink(firmId, linkId);
  if (!link) throw Object.assign(new Error("Intake form link was not found"), { statusCode: 404 });
  if (!link.submittedAt || !link.answerSnapshotId) {
    throw new ApiHttpError(
      409,
      "INTAKE_FORM_REVIEW_NOT_READY",
      "Intake form link is not ready for review",
      { linkId },
    );
  }
  const snapshot = (
    await repository.listAnswerSnapshots(firmId, { intakeSessionId: link.intakeSessionId })
  ).find((candidate) => candidate.id === link.answerSnapshotId);
  if (!snapshot) {
    throw new ApiHttpError(
      409,
      "INTAKE_FORM_REVIEW_SNAPSHOT_MISSING",
      "Submitted intake answer snapshot is not available",
      { linkId },
    );
  }
  const [actions, reviews] = await Promise.all([
    repository.listIntakeFormItemActions(firmId, { formLinkId: link.id }),
    repository.listIntakeFormReviews(firmId, { formLinkId: link.id }),
  ]);
  return { link, snapshot, actions, reviews };
}

function acceptedReview(payload: SubmittedReviewPayload): IntakeFormReviewRecord | undefined {
  return payload.reviews.find((review) => review.decision === "accepted");
}

function sanitizeExportFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function contactIdentifier(contact: Contact, type: "email" | "phone"): string | undefined {
  return contact.identifiers.find((identifier) => identifier.type === type)?.value;
}

function contactMethodValue(contact: Contact, type: "email" | "phone"): string | undefined {
  return contact.contactMethods?.find((method) => method.type === type && method.value)?.value;
}

function contactAddress(contact: Contact): string | undefined {
  const method = contact.contactMethods?.find(
    (candidate) => candidate.type === "address" && (candidate.value || candidate.address),
  );
  if (!method) return undefined;
  if (method.value) return method.value;
  const address = method.address;
  if (!address) return undefined;
  return [
    address.line1,
    address.line2,
    address.city,
    address.province,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function answerValueLabel(
  question: EmbeddedIntakeTemplateDefinition["questions"][number],
  value: unknown,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (question.type === "select") {
    const option = question.options?.find((candidate) => candidate.value === value);
    if (option) return option.label;
  }
  if (Array.isArray(value)) {
    const labels = value
      .map((item) =>
        typeof item === "string" || typeof item === "number" || typeof item === "boolean"
          ? String(item)
          : undefined,
      )
      .filter((item): item is string => Boolean(item));
    return labels.length > 0 ? labels.join(", ") : undefined;
  }
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function clientAnswerOverlay(input: {
  definition: EmbeddedIntakeTemplateDefinition;
  snapshot: AnswerSnapshotRecord;
}): Partial<NonNullable<DraftMergeContext["client"]>> {
  const overlay: Partial<NonNullable<DraftMergeContext["client"]>> = {};
  for (const question of input.definition.questions) {
    const mapping = question.variableMapping;
    if (!mapping || mapping.targetScope !== "client") continue;
    const value = answerValueLabel(question, input.snapshot.answers[question.id]);
    if (!value) continue;
    switch (mapping.targetField) {
      case "displayName":
      case "email":
      case "phone":
      case "address":
      case "preferredLanguage":
      case "timezone":
      case "communicationNotes":
      case "notes":
        overlay[mapping.targetField] = value;
        break;
      default:
        break;
    }
  }
  return overlay;
}

async function buildEngagementDraftMergeContext(input: {
  context: ApiAuthContext;
  repository: IntakeFormRouteDependencies["repository"];
  matterId: string;
  contact: Contact;
  definition: EmbeddedIntakeTemplateDefinition;
  snapshot: AnswerSnapshotRecord;
}): Promise<DraftMergeContext> {
  const [overview, settings, matters] = await Promise.all([
    input.repository.getOverview(input.context.firmId),
    input.repository.getFirmSettings(input.context.firmId),
    input.repository.listMattersForUser(input.context.user),
  ]);
  const matter = matters.find((candidate) => candidate.id === input.matterId);
  if (!matter) throw Object.assign(new Error("Matter was not found"), { statusCode: 404 });
  const overlay = clientAnswerOverlay({
    definition: input.definition,
    snapshot: input.snapshot,
  });
  return {
    firm: {
      name: overview.firm.name,
      officeEmail: settings?.officeEmail,
      officePhone: settings?.officePhone,
    },
    matter: {
      number: matter.number,
      title: matter.title,
      practiceArea: matter.practiceArea,
      jurisdiction: matter.jurisdiction,
    },
    client: {
      displayName: input.contact.displayName,
      email: contactIdentifier(input.contact, "email") ?? contactMethodValue(input.contact, "email"),
      phone: contactIdentifier(input.contact, "phone") ?? contactMethodValue(input.contact, "phone"),
      address: contactAddress(input.contact),
      preferredLanguage: input.contact.preferredLanguage,
      timezone: input.contact.timezone,
      communicationNotes: input.contact.communicationNotes,
      notes: input.contact.notes,
      ...overlay,
    },
  };
}

function findSelectedPackageDocument(input: {
  definition: EmbeddedIntakeTemplateDefinition;
  snapshot: AnswerSnapshotRecord;
  packageId: string;
  packageDocumentId: string;
}): EmbeddedIntakePackageDocument {
  if (!input.snapshot.resolution.selectedPackageIds.includes(input.packageId)) {
    throw new ApiHttpError(
      409,
      "INTAKE_ENGAGEMENT_PACKAGE_NOT_SELECTED",
      "Selected package was not included in the accepted intake answers",
      { packageId: input.packageId },
    );
  }
  const resolved = input.snapshot.resolution.packageDocuments.find(
    (candidate) =>
      candidate.packageId === input.packageId &&
      candidate.packageDocumentId === input.packageDocumentId,
  );
  if (!resolved) {
    throw new ApiHttpError(
      409,
      "INTAKE_ENGAGEMENT_DOCUMENT_NOT_SELECTED",
      "Selected package document was not included in the accepted intake answers",
      { packageId: input.packageId, packageDocumentId: input.packageDocumentId },
    );
  }
  const packageDefinition = input.definition.packages.find(
    (candidate) => candidate.id === input.packageId,
  );
  const document = packageDefinition?.documents.find(
    (candidate) => candidate.id === input.packageDocumentId,
  );
  if (!document) {
    throw new ApiHttpError(
      409,
      "INTAKE_ENGAGEMENT_DOCUMENT_UNAVAILABLE",
      "Selected package document is not available",
      { packageId: input.packageId, packageDocumentId: input.packageDocumentId },
    );
  }
  if (document.sourceKind !== "draft_template" || !document.sourceId) {
    throw new ApiHttpError(
      409,
      "INTAKE_ENGAGEMENT_SOURCE_REQUIRED",
      "Selected package document must be backed by an active draft template",
      { packageId: input.packageId, packageDocumentId: input.packageDocumentId },
    );
  }
  return document;
}

async function confirmedPortalGrant(input: {
  context: ApiAuthContext;
  repository: IntakeFormRouteDependencies["repository"];
  matterId: string;
  contactId?: string;
  portalGrantId: string;
  now: string;
}): Promise<PortalGrant> {
  if (!input.contactId) {
    throw new ApiHttpError(
      409,
      "INTAKE_ENGAGEMENT_CONTACT_REQUIRED",
      "Accepted intake link must be associated with a client contact",
      { matterId: input.matterId },
    );
  }
  const [grant, matter] = await Promise.all([
    input.repository
      .listPortalGrants(input.context.firmId)
      .then((grants) => grants.find((candidate) => candidate.id === input.portalGrantId)),
    input.repository
      .listMattersForUser(input.context.user)
      .then((matters) => matters.find((candidate) => candidate.id === input.matterId)),
  ]);
  if (!matter) throw Object.assign(new Error("Matter was not found"), { statusCode: 404 });
  if (
    !grant ||
    grant.matterId !== input.matterId ||
    grant.contactId !== input.contactId ||
    !activePortalGrant(grant, input.now) ||
    !grant.permissions.includes("view_documents")
  ) {
    throw new ApiHttpError(
      409,
      "INTAKE_ENGAGEMENT_PORTAL_GRANT_REQUIRED",
      "Active document-view portal grant for the intake client is required before sending",
      {
        matterId: input.matterId,
        portalGrantId: input.portalGrantId,
      },
    );
  }
  const party = matter.parties.find((candidate) => candidate.contactId === input.contactId);
  if (!party || party.adverse) {
    throw new ApiHttpError(
      409,
      "INTAKE_ENGAGEMENT_CONTACT_NOT_ELIGIBLE",
      "Client contact is not eligible for portal document access",
      { matterId: input.matterId },
    );
  }
  if (party.confidential && !grant.accountUserId) {
    throw new ApiHttpError(
      409,
      "INTAKE_ENGAGEMENT_PORTAL_ACCOUNT_REQUIRED",
      "Client portal account setup required before sending a confidential client file",
      { matterId: input.matterId, portalGrantId: input.portalGrantId },
    );
  }
  return grant;
}

function assertValidRecipientEmail(email: string | undefined): string {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) {
    throw new ApiHttpError(
      409,
      "INTAKE_ENGAGEMENT_RECIPIENT_UNAVAILABLE",
      "A client email address is required before sending the engagement letter",
    );
  }
  return parsed.data;
}

async function assertEmailNoticeConfigured(input: {
  repository: IntakeFormRouteDependencies["repository"];
  firmId: string;
  emailJobQueue: IntakeFormRouteDependencies["emailJobQueue"];
}): Promise<void> {
  const providers = await input.repository.listProviderSettings(input.firmId, { kind: "smtp" });
  if (!providers.some((provider) => provider.enabled)) {
    throw new ApiHttpError(503, "SMTP_NOT_CONFIGURED", "SMTP email delivery is not configured");
  }
  if (!input.emailJobQueue) {
    throw new ApiHttpError(503, "EMAIL_QUEUE_NOT_CONFIGURED", "Email queue is not configured");
  }
}

export function registerIntakeEngagementLetterRoutes(
  server: FastifyInstance,
  dependencies: IntakeFormRouteDependencies,
): void {
  const { repository, s3, draftExportRenderer, signatureProvider, emailJobQueue } = dependencies;

  server.post("/api/intake-form-links/:id/engagement-letter", async (request, reply) => {
    const params = parseRequestPart(intakeTemplateParamsSchema, request.params, "params");
    const body = parseRequestPart(engagementLetterBodySchema, request.body ?? {}, "body");
    const payload = await getSubmittedReviewPayload(repository, request.auth.firmId, params.id);
    assertRouteAccess(request.auth, {
      resource: "intake_session",
      action: "approve",
      matterId: payload.link.matterId,
    });
    assertRouteAccess(request.auth, {
      resource: "document",
      action: "create",
      matterId: payload.link.matterId,
    });
    assertRouteAccess(request.auth, {
      resource: "client_portal",
      action: "update",
      matterId: payload.link.matterId,
    });
    if (!acceptedReview(payload)) {
      throw new ApiHttpError(
        409,
        "INTAKE_ENGAGEMENT_REVIEW_REQUIRED",
        "Accepted submitted intake review required before sending an engagement letter",
        { formLinkId: payload.link.id },
      );
    }
    if (payload.snapshot.resolution.requiredIncompleteItemIds?.length) {
      throw new ApiHttpError(
        409,
        "INTAKE_ENGAGEMENT_INTAKE_INCOMPLETE",
        "Accepted intake still has incomplete required items",
        { requiredIncompleteItemCount: payload.snapshot.resolution.requiredIncompleteItemIds.length },
      );
    }
    if (!s3) {
      throw new ApiHttpError(
        503,
        "INTAKE_ENGAGEMENT_STORAGE_NOT_CONFIGURED",
        "Document storage is not configured",
      );
    }
    if (!draftExportRenderer) {
      throw new ApiHttpError(
        503,
        "INTAKE_ENGAGEMENT_RENDERER_NOT_CONFIGURED",
        "Draft export renderer is not configured",
      );
    }

    const session = await repository.getIntakeSession(request.auth.firmId, payload.link.intakeSessionId);
    if (!session) throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    const template = await getTemplateForSession(repository, request.auth.firmId, session);
    const packageDocument = findSelectedPackageDocument({
      definition: template.definition,
      snapshot: payload.snapshot,
      packageId: body.packageId,
      packageDocumentId: body.packageDocumentId,
    });
    const requiresSignature = packageDocument.requiresSignature === true;
    const configuredSignatureProvider = signatureProvider;
    let signatureSubmissionProvider: NonNullable<typeof signatureProvider> | undefined;
    if (requiresSignature) {
      assertRouteAccess(request.auth, {
        resource: "signature_request",
        action: "create",
        matterId: payload.link.matterId,
      });
      if (!configuredSignatureProvider) {
        throw new ApiHttpError(
          503,
          "INTAKE_ENGAGEMENT_SIGNATURE_PROVIDER_NOT_CONFIGURED",
          "Signature provider is not configured",
        );
      }
      signatureSubmissionProvider = configuredSignatureProvider;
    }
    const draftTemplate = (
      await repository.listDraftTemplates(request.auth.firmId, { activeOnly: true })
    ).find((candidate) => candidate.id === packageDocument.sourceId);
    if (!draftTemplate) {
      throw new ApiHttpError(
        409,
        "INTAKE_ENGAGEMENT_SOURCE_UNAVAILABLE",
        "Draft template source for the selected package document is unavailable",
        { packageId: body.packageId, packageDocumentId: body.packageDocumentId },
      );
    }
    const contactId = payload.link.clientContactId ?? session.clientContactId;
    const contact = contactId ? await repository.getContact(request.auth.firmId, contactId) : undefined;
    if (!contact) {
      throw new ApiHttpError(
        409,
        "INTAKE_ENGAGEMENT_CONTACT_REQUIRED",
        "Accepted intake link must be associated with an available client contact",
        { matterId: payload.link.matterId },
      );
    }
    const now = new Date().toISOString();
    const grant = await confirmedPortalGrant({
      context: request.auth,
      repository,
      matterId: payload.link.matterId,
      contactId,
      portalGrantId: body.portalGrantId,
      now,
    });
    const mergeContext = await buildEngagementDraftMergeContext({
      context: request.auth,
      repository,
      matterId: payload.link.matterId,
      contact,
      definition: template.definition,
      snapshot: payload.snapshot,
    });
    const recipientEmail = assertValidRecipientEmail(mergeContext.client?.email);
    requireEmailDeliveryConfirmation(body.deliveryConfirmation, { recipientCount: 1 });
    await assertEmailNoticeConfigured({
      repository,
      firmId: request.auth.firmId,
      emailJobQueue,
    });

    let exportDocument;
    try {
      exportDocument = buildDraftExportDocument({
        title: packageDocument.title,
        editorJson: draftTemplate.editorJson,
        mergeContext,
      });
    } catch (error) {
      if (error instanceof UnknownDraftMergeFieldError) {
        throw Object.assign(error, { statusCode: 400, details: { fields: error.fields } });
      }
      throw error;
    }

    const rendered = await draftExportRenderer({ format: body.format, document: exportDocument });
    const checksumSha256 = createHash("sha256").update(rendered.buffer).digest("hex");
    const checksumSha256Base64 = createHash("sha256").update(rendered.buffer).digest("base64");
    const documentId = crypto.randomUUID();
    const generatedDocumentId = crypto.randomUUID();
    const filename = `${sanitizeExportFilename(exportDocument.title)}.${rendered.extension}`;
    const storageKey = `matters/${payload.link.matterId}/engagement-letters/${documentId}-${filename}`;

    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: storageKey,
        Body: rendered.buffer,
        ContentType: rendered.contentType,
        ContentLength: rendered.buffer.byteLength,
        ChecksumSHA256: checksumSha256Base64,
        ...(s3.serverSideEncryption ? { ServerSideEncryption: s3.serverSideEncryption } : {}),
        Metadata: {
          "open-practice-matter-id": payload.link.matterId,
          "open-practice-form-link-id": payload.link.id,
          "open-practice-package-id": body.packageId,
          "open-practice-package-document-id": body.packageDocumentId,
          "open-practice-export-format": body.format,
        },
      }),
    );

    const document = await repository.createDocumentUploadIntent({
      id: documentId,
      firmId: request.auth.firmId,
      matterId: payload.link.matterId,
      title: filename,
      storageKey,
      checksumSha256,
      sizeBytes: rendered.buffer.byteLength,
      classification: "general",
      legalHold: false,
    });
    const verifiedDocument = await repository.completeDocumentUpload({
      firmId: request.auth.firmId,
      documentId: document.id,
      checksumSha256,
      scanStatus: "passed",
    });
    const portalAccessPreview: PortalDocumentAccess = {
      id: "preview",
      firmId: request.auth.firmId,
      matterId: payload.link.matterId,
      documentId: verifiedDocument.id,
      portalGrantId: grant.id,
      permission: "view_document",
      grantedByUserId: request.auth.user.id,
      createdAt: now,
    };
    if (
      !portalDocumentAccessVisible({
        access: portalAccessPreview,
        document: verifiedDocument,
        grant,
        now,
      })
    ) {
      throw new ApiHttpError(
        422,
        "INTAKE_ENGAGEMENT_DOCUMENT_NOT_SHAREABLE",
        "Generated engagement letter is not eligible for client portal access",
        { matterId: payload.link.matterId, documentId: verifiedDocument.id },
      );
    }
    const generatedDocument = await repository.createGeneratedDocument({
      id: generatedDocumentId,
      firmId: request.auth.firmId,
      matterId: payload.link.matterId,
      intakeSessionId: payload.link.intakeSessionId,
      provider: "embedded",
      externalId: `intake-engagement:${payload.link.id}:${body.packageId}:${body.packageDocumentId}:${documentId}`,
      title: exportDocument.title,
      documentId: verifiedDocument.id,
      packageId: body.packageId,
      packageDocumentId: body.packageDocumentId,
      storageKey,
      checksumSha256,
      evidence: {
        source: "intake_engagement_letter",
        formLinkId: payload.link.id,
        answerSnapshotId: payload.snapshot.id,
        templateId: payload.snapshot.resolution.templateId,
        templateVersion: payload.snapshot.resolution.templateVersion,
        packageId: body.packageId,
        packageDocumentId: body.packageDocumentId,
        draftTemplateId: draftTemplate.id,
        format: body.format,
        byteLength: rendered.buffer.byteLength,
        visibleQuestionCount: payload.snapshot.resolution.visibleQuestionIds.length,
        selectedPackageCount: payload.snapshot.resolution.selectedPackageIds.length,
        requiresSignature,
      },
      createdAt: now,
    });
    const portalDocumentAccess = await repository.createPortalDocumentAccess({
      id: `portal-document-access-${crypto.randomUUID()}`,
      firmId: request.auth.firmId,
      matterId: payload.link.matterId,
      documentId: verifiedDocument.id,
      portalGrantId: grant.id,
      permission: "view_document",
      grantedByUserId: request.auth.user.id,
      createdAt: now,
    });

    let signatureRequest: SignatureRequestRecord | undefined;
    if (requiresSignature) {
      if (!signatureSubmissionProvider) {
        throw new ApiHttpError(
          503,
          "INTAKE_ENGAGEMENT_SIGNATURE_PROVIDER_NOT_CONFIGURED",
          "Signature provider is not configured",
        );
      }
      const submission = await signatureSubmissionProvider.createSubmission({
        matterId: payload.link.matterId,
        documentId: verifiedDocument.id,
        title: exportDocument.title,
        consentText: "Please review and sign this engagement letter.",
        signers: [{ name: mergeContext.client?.displayName ?? contact.displayName, email: recipientEmail, role: "client" }],
      });
      const envelopeMetadata = defaultSignatureRequestEnvelopeMetadata();
      const requestRecord: SignatureRequestRecord = {
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        matterId: payload.link.matterId,
        documentId: verifiedDocument.id,
        title: exportDocument.title,
        requestedByUserId: request.auth.user.id,
        provider: submission.provider,
        externalId: submission.externalId,
        status: submission.status ?? "sent",
        signingUrl: submission.signingUrl,
        consentText: "Please review and sign this engagement letter.",
        evidence: submission.evidence ?? {},
        ...envelopeMetadata,
        createdAt: now,
      };
      const signerRecord: SignatureRequestSignerRecord = {
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        signatureRequestId: requestRecord.id,
        name: mergeContext.client?.displayName ?? contact.displayName,
        email: recipientEmail,
        role: "client",
        status: requestRecord.status,
        signingUrl: submission.signingUrl,
      };
      const event: SignatureProviderEventRecord = {
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        signatureRequestId: requestRecord.id,
        provider: requestRecord.provider,
        externalId: requestRecord.externalId,
        status: requestRecord.status,
        occurredAt: now,
        evidence: requestRecord.evidence,
      };
      const created = await repository.createSignatureRequest({
        request: requestRecord,
        signers: [signerRecord],
        event,
      });
      signatureRequest = created.request;
    }

    const queuedEmail = await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
      matterId: payload.link.matterId,
      templateKey: "intake.engagement_letter.sent",
      to: [recipientEmail],
      subject: "Engagement letter ready",
      textBody: "Your engagement letter is ready in the client portal.",
      relatedResourceType: signatureRequest ? "signature_request" : "document",
      relatedResourceId: signatureRequest?.id ?? verifiedDocument.id,
      metadata: {
        formLinkId: payload.link.id,
        answerSnapshotId: payload.snapshot.id,
        documentId: verifiedDocument.id,
        generatedDocumentId: generatedDocument.id,
        portalDocumentAccessId: portalDocumentAccess.id,
        portalGrantId: grant.id,
        packageId: body.packageId,
        packageDocumentId: body.packageDocumentId,
        signatureRequestId: signatureRequest?.id,
        recipientCount: 1,
      },
      required: true,
    });

    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake.engagement_letter.sent",
      resourceType: "generated_document",
      resourceId: generatedDocument.id,
      occurredAt: now,
      metadata: {
        matterId: payload.link.matterId,
        intakeSessionId: payload.link.intakeSessionId,
        formLinkId: payload.link.id,
        answerSnapshotId: payload.snapshot.id,
        documentId: verifiedDocument.id,
        generatedDocumentId: generatedDocument.id,
        portalDocumentAccessId: portalDocumentAccess.id,
        portalGrantId: grant.id,
        packageId: body.packageId,
        packageDocumentId: body.packageDocumentId,
        signatureRequestId: signatureRequest?.id,
        format: body.format,
        byteLength: rendered.buffer.byteLength,
        recipientCount: 1,
        queuedEmailId: queuedEmail?.email.id,
        emailQueued: Boolean(queuedEmail),
        signatureStatus: signatureRequest?.status,
        documentStatus: verifiedDocument.uploadStatus,
        scanStatus: verifiedDocument.scanStatus,
      },
    });

    reply.code(201);
    return {
      engagementLetter: {
        formLinkId: payload.link.id,
        intakeSessionId: payload.link.intakeSessionId,
        answerSnapshotId: payload.snapshot.id,
        packageId: body.packageId,
        packageDocumentId: body.packageDocumentId,
        documentId: verifiedDocument.id,
        generatedDocumentId: generatedDocument.id,
        portalDocumentAccessId: portalDocumentAccess.id,
        signatureRequestId: signatureRequest?.id,
        status: "sent",
        documentStatus: verifiedDocument.uploadStatus,
        scanStatus: verifiedDocument.scanStatus,
        signatureStatus: signatureRequest?.status,
        emailQueued: Boolean(queuedEmail),
        queuedEmail: queuedEmail ? summarizeQueuedRouteEmail(queuedEmail) : undefined,
      },
    };
  });
}
