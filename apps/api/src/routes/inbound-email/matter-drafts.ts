import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  ContactDossier,
  ContactDuplicateMatchedField,
  ContactStatus,
} from "@open-practice/domain";
import type { MatterSummary } from "@open-practice/database";
import { requireAccess } from "../../http/auth-guards.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import {
  assertInboundEmailAccess,
  inboundEmailMessageParamsSchema,
  serializeInboundEmailMatterDraft,
} from "./shared.js";
import type { InboundEmailRouteDependencies } from "./shared.js";

const provinceSchema = z.enum(["BC", "ON", "CANADA", "OTHER"]);

const matterDraftBodySchema = z
  .object({
    redactedBodySummary: z.string().trim().min(1).max(600),
    proposedMatter: z
      .object({
        title: z.string().trim().min(1).max(160),
        practiceArea: z.string().trim().min(1).max(120),
        jurisdiction: provinceSchema,
        client: z
          .object({
            kind: z.enum(["person", "organization"]),
            displayName: z.string().trim().min(1).max(160),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

type MatterDraftBody = z.infer<typeof matterDraftBodySchema>;

type MatterDraftReviewSeverity = "blocker" | "review" | "info";
type MatterDraftChecklistState = "complete" | "needs_attention" | "review";

type MatterDraftReviewCues = {
  duplicateCandidates: Array<{
    contactId: string;
    displayName: string;
    kind: "person" | "organization";
    status: ContactStatus;
    matchedFields: ContactDuplicateMatchedField[];
    matchCount: number;
    visibleSharedMatterCount: number;
    severity: MatterDraftReviewSeverity;
  }>;
  existingMatterCandidates: Array<{
    matterId: string;
    number: string;
    title: string;
    status: string;
    practiceArea: string;
    jurisdiction: "BC" | "ON" | "CANADA" | "OTHER";
    matchReasons: string[];
  }>;
  checklist: Array<{
    key: string;
    label: string;
    description: string;
    state: MatterDraftChecklistState;
    count?: number;
    source: "draft" | "existing_matter";
    matterId?: string;
  }>;
  boundary: {
    automaticMatterCreation: false;
    bodyRedacted: true;
    metadataRedacted: true;
    matterPermissionsExpanded: false;
  };
};

type MatterDraftMetadataBase = {
  status: "drafted";
  createdAt: string;
  createdByUserId: string;
  source: {
    inboundMessageId: string;
    providerMessageIdPresent: boolean;
    receivedAt: string;
    recipientCount: number;
    subjectPresent: boolean;
    senderSummary: string;
    attachmentCount: number;
  };
  redactedBodySummary: string;
  proposedMatter: {
    title: string;
    practiceArea: string;
    jurisdiction: "BC" | "ON" | "CANADA" | "OTHER";
    client: {
      kind: "person" | "organization";
      displayName: string;
    };
  };
  automaticMatterCreation: false;
  bodyRedacted: true;
  metadataRedacted: true;
};

function senderSummary(fromAddress: string): string {
  const domain = fromAddress.includes("@") ? fromAddress.split("@").pop()?.trim() : undefined;
  return domain ? `redacted sender at ${domain.slice(0, 120)}` : "redacted sender";
}

function normalizedReviewText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function reviewTokens(value: string): Set<string> {
  return new Set(
    normalizedReviewText(value)
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

function sharedTokenCount(left: string, right: string): number {
  const rightTokens = reviewTokens(right);
  return Array.from(reviewTokens(left)).filter((token) => rightTokens.has(token)).length;
}

function reviewTextMatches(left: string | undefined, right: string): boolean {
  if (!left) return false;
  const normalizedLeft = normalizedReviewText(left);
  const normalizedRight = normalizedReviewText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  return normalizedLeft.length > 8 && normalizedRight.length > 8
    ? normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)
    : false;
}

function contactNameMatches(
  contact: ContactDossier["contact"] | MatterSummary["parties"][number]["contact"],
  proposedName: string,
): boolean {
  return [
    contact.displayName,
    contact.canonicalName,
    ...(contact.aliases ?? []),
    ...(contact.formerNames ?? []),
  ].some((name) => reviewTextMatches(name, proposedName));
}

function upsertDuplicateCandidate(
  candidates: Map<string, MatterDraftReviewCues["duplicateCandidates"][number]>,
  candidate: MatterDraftReviewCues["duplicateCandidates"][number],
): void {
  const existing = candidates.get(candidate.contactId);
  if (!existing || candidate.matchCount > existing.matchCount) {
    candidates.set(candidate.contactId, candidate);
    return;
  }
  if (candidate.matchCount === existing.matchCount) {
    candidates.set(candidate.contactId, {
      ...existing,
      matchedFields: Array.from(
        new Set([...existing.matchedFields, ...candidate.matchedFields]),
      ).sort() as ContactDuplicateMatchedField[],
      visibleSharedMatterCount: Math.max(
        existing.visibleSharedMatterCount,
        candidate.visibleSharedMatterCount,
      ),
    });
  }
}

function buildDuplicateCandidates(input: {
  dossiers: ContactDossier[];
  proposedClientName: string;
}): MatterDraftReviewCues["duplicateCandidates"] {
  const candidates = new Map<string, MatterDraftReviewCues["duplicateCandidates"][number]>();
  for (const dossier of input.dossiers) {
    if (contactNameMatches(dossier.contact, input.proposedClientName)) {
      upsertDuplicateCandidate(candidates, {
        contactId: dossier.contact.id,
        displayName: dossier.contact.displayName,
        kind: dossier.contact.kind,
        status: dossier.contact.status ?? "active",
        matchedFields: ["name"],
        matchCount: 1,
        visibleSharedMatterCount: dossier.matters.length,
        severity: "review",
      });
    }

    for (const signal of dossier.qualityReview.signals) {
      const duplicateReview = signal.duplicateReview;
      if (
        !duplicateReview ||
        !reviewTextMatches(duplicateReview.candidate.displayName, input.proposedClientName)
      ) {
        continue;
      }
      upsertDuplicateCandidate(candidates, {
        contactId: duplicateReview.candidate.contactId,
        displayName: duplicateReview.candidate.displayName,
        kind: duplicateReview.candidate.kind,
        status: duplicateReview.candidate.status,
        matchedFields: duplicateReview.matchedFields,
        matchCount: duplicateReview.matchCount,
        visibleSharedMatterCount: duplicateReview.sharedVisibleMatterCount,
        severity: signal.severity,
      });
    }
  }
  return Array.from(candidates.values())
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .slice(0, 5);
}

function matterMatchReasons(
  matter: MatterSummary,
  proposedMatter: MatterDraftBody["proposedMatter"],
): string[] {
  const reasons = new Set<string>();
  if (matter.jurisdiction === proposedMatter.jurisdiction) reasons.add("jurisdiction");
  if (reviewTextMatches(matter.practiceArea, proposedMatter.practiceArea))
    reasons.add("practice area");
  if (
    reviewTextMatches(matter.title, proposedMatter.title) ||
    sharedTokenCount(matter.title, proposedMatter.title) >= 2
  ) {
    reasons.add("title terms");
  }
  if (
    matter.parties.some((party) =>
      contactNameMatches(party.contact, proposedMatter.client.displayName),
    )
  ) {
    reasons.add("visible client name");
  }
  return Array.from(reasons);
}

function buildExistingMatterCandidates(input: {
  matters: MatterSummary[];
  proposedMatter: MatterDraftBody["proposedMatter"];
}): MatterDraftReviewCues["existingMatterCandidates"] {
  return input.matters
    .map((matter) => ({ matter, matchReasons: matterMatchReasons(matter, input.proposedMatter) }))
    .filter(({ matchReasons }) => {
      if (matchReasons.includes("visible client name") || matchReasons.includes("title terms")) {
        return true;
      }
      return matchReasons.includes("practice area") && matchReasons.includes("jurisdiction");
    })
    .sort(
      (left, right) =>
        right.matchReasons.length - left.matchReasons.length ||
        left.matter.number.localeCompare(right.matter.number),
    )
    .slice(0, 4)
    .map(({ matter, matchReasons }) => ({
      matterId: matter.id,
      number: matter.number,
      title: matter.title,
      status: matter.status,
      practiceArea: matter.practiceArea,
      jurisdiction: matter.jurisdiction,
      matchReasons,
    }));
}

function buildChecklist(input: {
  attachmentCount: number;
  providerMessageIdPresent: boolean;
  bodyRedacted: true;
  metadataRedacted: true;
  existingMatterCandidates: MatterDraftReviewCues["existingMatterCandidates"];
  matters: MatterSummary[];
}): MatterDraftReviewCues["checklist"] {
  const existingMatterIds = new Set(
    input.existingMatterCandidates.map((candidate) => candidate.matterId),
  );
  const existingMatterChecklist = input.matters
    .filter((matter) => existingMatterIds.has(matter.id))
    .flatMap((matter) =>
      matter.setupProfile.checklist.map((cue) => ({
        key: `existing_${matter.id}_${cue.key}`,
        label: cue.label,
        description: cue.description,
        state: cue.state,
        count: cue.count,
        source: "existing_matter" as const,
        matterId: matter.id,
      })),
    )
    .slice(0, 6);

  return [
    {
      key: "source_attachment_review",
      label: "Attachment review",
      description:
        input.attachmentCount > 0
          ? "Inbound source reports attachments for staff review."
          : "Inbound source reports no attachments.",
      state: input.attachmentCount > 0 ? "review" : "complete",
      count: input.attachmentCount,
      source: "draft" as const,
    },
    {
      key: "source_identity",
      label: "Source identity",
      description: input.providerMessageIdPresent
        ? "Source message identity is present as a boolean cue."
        : "No source message identity cue is present.",
      state: input.providerMessageIdPresent ? "review" : "needs_attention",
      source: "draft" as const,
    },
    {
      key: "body_redaction",
      label: "Body redaction",
      description: "Draft review uses a staff-authored redacted summary.",
      state: input.bodyRedacted ? "complete" : "needs_attention",
      source: "draft" as const,
    },
    {
      key: "metadata_redaction",
      label: "Metadata redaction",
      description: "Raw source metadata remains outside the matter draft.",
      state: input.metadataRedacted ? "complete" : "needs_attention",
      source: "draft" as const,
    },
    ...existingMatterChecklist,
  ];
}

function buildMatterDraftReviewCues(input: {
  matterDraft: MatterDraftMetadataBase;
  matters: MatterSummary[];
  dossiers: ContactDossier[];
}): MatterDraftReviewCues {
  const existingMatterCandidates = buildExistingMatterCandidates({
    matters: input.matters,
    proposedMatter: input.matterDraft.proposedMatter,
  });
  return {
    duplicateCandidates: buildDuplicateCandidates({
      dossiers: input.dossiers,
      proposedClientName: input.matterDraft.proposedMatter.client.displayName,
    }),
    existingMatterCandidates,
    checklist: buildChecklist({
      attachmentCount: input.matterDraft.source.attachmentCount,
      providerMessageIdPresent: input.matterDraft.source.providerMessageIdPresent,
      bodyRedacted: input.matterDraft.bodyRedacted,
      metadataRedacted: input.matterDraft.metadataRedacted,
      existingMatterCandidates,
      matters: input.matters,
    }),
    boundary: {
      automaticMatterCreation: false,
      bodyRedacted: true,
      metadataRedacted: true,
      matterPermissionsExpanded: false,
    },
  };
}

function buildMatterDraftMetadata(input: {
  body: MatterDraftBody;
  createdAt: string;
  createdByUserId: string;
  message: {
    id: string;
    messageId?: string;
    fromAddress: string;
    toAddresses: string[];
    subject: string;
    receivedAt: string;
  };
  attachmentCount: number;
}): MatterDraftMetadataBase {
  return {
    status: "drafted",
    createdAt: input.createdAt,
    createdByUserId: input.createdByUserId,
    source: {
      inboundMessageId: input.message.id,
      providerMessageIdPresent: Boolean(input.message.messageId),
      receivedAt: input.message.receivedAt,
      recipientCount: input.message.toAddresses.length,
      subjectPresent: input.message.subject.trim().length > 0,
      senderSummary: senderSummary(input.message.fromAddress),
      attachmentCount: input.attachmentCount,
    },
    redactedBodySummary: input.body.redactedBodySummary.trim(),
    proposedMatter: {
      title: input.body.proposedMatter.title.trim(),
      practiceArea: input.body.proposedMatter.practiceArea.trim(),
      jurisdiction: input.body.proposedMatter.jurisdiction,
      client: {
        kind: input.body.proposedMatter.client.kind,
        displayName: input.body.proposedMatter.client.displayName.trim(),
      },
    },
    automaticMatterCreation: false,
    bodyRedacted: true,
    metadataRedacted: true,
  };
}

export function registerInboundEmailMatterDraftRoutes(
  server: FastifyInstance,
  { repository }: InboundEmailRouteDependencies,
): void {
  server.post("/api/inbound-email/messages/:id/matter-draft", async (request) => {
    const params = parseRequestPart(inboundEmailMessageParamsSchema, request.params, "params");
    const body = parseRequestPart(matterDraftBodySchema, request.body ?? {}, "body");
    const message = await repository.getInboundEmailMessage(request.auth.firmId, params.id);
    if (!message) {
      throw Object.assign(new Error("Inbound email message was not found"), { statusCode: 404 });
    }
    if (message.matterId) {
      throw Object.assign(new Error("Matter draft requires an unscoped inbound email"), {
        statusCode: 400,
      });
    }

    assertInboundEmailAccess(request.auth, {
      resource: "inbound_email",
      action: "read",
    });
    assertInboundEmailAccess(request.auth, {
      resource: "inbound_email",
      action: "update",
    });
    const matterCreateAccess = requireAccess(request.auth, {
      resource: "matter",
      action: "create",
    });
    if (!matterCreateAccess.ok) throw matterCreateAccess.error;

    const attachments = await repository.listInboundEmailAttachments(
      request.auth.firmId,
      message.id,
    );
    const createdAt = new Date().toISOString();
    const matterDraft = buildMatterDraftMetadata({
      body,
      createdAt,
      createdByUserId: request.auth.user.id,
      message,
      attachmentCount: attachments.length,
    });
    const [matters, dossiers] = await Promise.all([
      repository.listMattersForUser(request.auth.user),
      repository.listContactDossiersForUser(request.auth.user),
    ]);
    const reviewCues = buildMatterDraftReviewCues({ matterDraft, matters, dossiers });
    const matterDraftWithReviewCues = {
      ...matterDraft,
      reviewCues,
    };
    const updated = await repository.updateInboundEmailMessage(request.auth.firmId, message.id, {
      metadata: {
        ...message.metadata,
        matterDraft: matterDraftWithReviewCues,
      },
    });

    await appendRouteAuditEvent(repository, request.auth, {
      action: "inbound_email.matter_draft.confirmed",
      resourceType: "inbound_email",
      resourceId: updated.id,
      metadata: {
        sourceMessageId: updated.id,
        providerMessageIdPresent: Boolean(updated.messageId),
        receivedAt: updated.receivedAt,
        recipientCount: updated.toAddresses.length,
        attachmentCount: attachments.length,
        subjectPresent: updated.subject.trim().length > 0,
        redactedSummaryLength: matterDraft.redactedBodySummary.length,
        proposedTitleLength: matterDraft.proposedMatter.title.length,
        proposedPracticeArea: matterDraft.proposedMatter.practiceArea,
        proposedJurisdiction: matterDraft.proposedMatter.jurisdiction,
        clientKind: matterDraft.proposedMatter.client.kind,
        duplicateCandidateCount: reviewCues.duplicateCandidates.length,
        existingMatterCandidateCount: reviewCues.existingMatterCandidates.length,
        checklistCueCount: reviewCues.checklist.length,
        automaticMatterCreation: false,
        matterPermissionsExpanded: false,
      },
    });

    return {
      status: "drafted",
      message: {
        id: updated.id,
        matterId: updated.matterId,
        status: updated.status,
        matterDraft: serializeInboundEmailMatterDraft(updated.metadata.matterDraft),
      },
    };
  });
}
