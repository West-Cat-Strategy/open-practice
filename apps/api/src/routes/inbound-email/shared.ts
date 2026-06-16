import { z } from "zod";
import type {
  AccessRequest,
  InboundEmailAttachmentRecord,
  InboundEmailMessageRecord,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import type { ApiAuthContext } from "../../server.js";
import type { ApiRouteDependencies } from "../types.js";

export type InboundEmailRouteDependencies = ApiRouteDependencies;

export const MAILGUN_PROVIDER_KEY = "mailgun";
export const MAILGUN_RAW_MIME_JOB_NAME = "parse_inbound_email";
export const MAILGUN_RAW_MIME_SOURCE = "mailgun.raw_mime_webhook";
export const INBOUND_EMAIL_JOB_MAX_ATTEMPTS = 4;

export const inboundEmailMessageParamsSchema = z.object({ id: z.string().min(1) });

export type StaffTriageFollowUp = {
  channel?: "email" | "phone" | "portal" | "sms" | "in_person";
  consentStatus?: "unknown" | "consented" | "declined" | "do_not_contact";
  dueAt?: string;
};
export type StaffTriagePrivateNote = {
  authorUserId: string;
  createdAt: string;
  text: string;
};

type InboundEmailMatterDraft = {
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

export function assertInboundEmailAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function assertJobRecoveryAccess(context: ApiAuthContext): void {
  const access = requireAccess(context, { resource: "job", action: "update" });
  if (!access.ok) throw access.error;
}

export function serializeInboundEmailAttachment(attachment: InboundEmailAttachmentRecord) {
  const safe = { ...attachment } as Omit<InboundEmailAttachmentRecord, "storageKey"> &
    Partial<Pick<InboundEmailAttachmentRecord, "storageKey">>;
  delete safe.storageKey;
  return safe;
}

export function currentPrivateNotes(triage: Record<string, unknown>): StaffTriagePrivateNote[] {
  return Array.isArray(triage.privateNotes)
    ? triage.privateNotes.filter(
        (note): note is StaffTriagePrivateNote =>
          Boolean(note) &&
          typeof note === "object" &&
          !Array.isArray(note) &&
          typeof (note as Record<string, unknown>).authorUserId === "string" &&
          typeof (note as Record<string, unknown>).createdAt === "string" &&
          typeof (note as Record<string, unknown>).text === "string",
      )
    : [];
}

export function safeFollowUp(input: unknown): StaffTriageFollowUp | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const followUp = input as Record<string, unknown>;
  const output: StaffTriageFollowUp = {};
  if (["email", "phone", "portal", "sms", "in_person"].includes(String(followUp.channel))) {
    output.channel = followUp.channel as StaffTriageFollowUp["channel"];
  }
  if (
    ["unknown", "consented", "declined", "do_not_contact"].includes(String(followUp.consentStatus))
  ) {
    output.consentStatus = followUp.consentStatus as StaffTriageFollowUp["consentStatus"];
  }
  if (typeof followUp.dueAt === "string") output.dueAt = followUp.dueAt;
  return Object.values(output).some((value) => value !== undefined) ? output : undefined;
}

export function serializeStaffTriageDetail(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  if (typeof input.status === "string") output.status = input.status;
  if (typeof input.assignedToUserId === "string") output.assignedToUserId = input.assignedToUserId;
  if (Array.isArray(input.contactIds)) {
    output.contactIds = input.contactIds.filter((id): id is string => typeof id === "string");
  }
  const privateNotes = currentPrivateNotes(input);
  if (privateNotes.length > 0) {
    output.privateNoteCount = privateNotes.length;
    output.latestPrivateNoteAt = privateNotes.at(-1)?.createdAt;
  }
  const followUp = safeFollowUp(input.followUp);
  if (followUp) output.followUp = followUp;
  if (typeof input.updatedAt === "string") output.updatedAt = input.updatedAt;
  if (typeof input.updatedByUserId === "string") output.updatedByUserId = input.updatedByUserId;
  return Object.keys(output).length > 0 ? output : undefined;
}

export function serializeInboundEmailMatterDraft(
  value: unknown,
): InboundEmailMatterDraft | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const source =
    input.source && typeof input.source === "object" && !Array.isArray(input.source)
      ? (input.source as Record<string, unknown>)
      : {};
  const proposedMatter =
    input.proposedMatter &&
    typeof input.proposedMatter === "object" &&
    !Array.isArray(input.proposedMatter)
      ? (input.proposedMatter as Record<string, unknown>)
      : {};
  const client =
    proposedMatter.client &&
    typeof proposedMatter.client === "object" &&
    !Array.isArray(proposedMatter.client)
      ? (proposedMatter.client as Record<string, unknown>)
      : {};
  if (
    input.status !== "drafted" ||
    typeof input.createdAt !== "string" ||
    typeof input.createdByUserId !== "string" ||
    typeof source.inboundMessageId !== "string" ||
    typeof source.receivedAt !== "string" ||
    typeof source.senderSummary !== "string" ||
    typeof input.redactedBodySummary !== "string" ||
    typeof proposedMatter.title !== "string" ||
    typeof proposedMatter.practiceArea !== "string" ||
    !["BC", "ON", "CANADA", "OTHER"].includes(String(proposedMatter.jurisdiction)) ||
    !["person", "organization"].includes(String(client.kind)) ||
    typeof client.displayName !== "string"
  ) {
    return undefined;
  }
  return {
    status: "drafted",
    createdAt: input.createdAt,
    createdByUserId: input.createdByUserId,
    source: {
      inboundMessageId: source.inboundMessageId,
      providerMessageIdPresent: source.providerMessageIdPresent === true,
      receivedAt: source.receivedAt,
      recipientCount: typeof source.recipientCount === "number" ? source.recipientCount : 0,
      subjectPresent: source.subjectPresent === true,
      senderSummary: source.senderSummary,
      attachmentCount: typeof source.attachmentCount === "number" ? source.attachmentCount : 0,
    },
    redactedBodySummary: input.redactedBodySummary,
    proposedMatter: {
      title: proposedMatter.title,
      practiceArea: proposedMatter.practiceArea,
      jurisdiction:
        proposedMatter.jurisdiction as InboundEmailMatterDraft["proposedMatter"]["jurisdiction"],
      client: {
        kind: client.kind as InboundEmailMatterDraft["proposedMatter"]["client"]["kind"],
        displayName: client.displayName,
      },
    },
    automaticMatterCreation: false,
    bodyRedacted: true,
    metadataRedacted: true,
  };
}

export function serializeInboundEmailMessage(message: InboundEmailMessageRecord) {
  const safe = { ...message } as Omit<
    InboundEmailMessageRecord,
    "rawStorageKey" | "parsedHtmlStorageKey"
  > &
    Partial<Pick<InboundEmailMessageRecord, "rawStorageKey" | "parsedHtmlStorageKey">>;
  delete safe.rawStorageKey;
  delete safe.parsedHtmlStorageKey;
  const { metadata } = safe;
  const staffTriage = serializeStaffTriageDetail(metadata.staffTriage);
  const matterDraft = serializeInboundEmailMatterDraft(metadata.matterDraft);
  return {
    ...safe,
    metadata: {
      ...(staffTriage ? { staffTriage } : { staffTriage: undefined }),
      ...(matterDraft ? { matterDraft } : { matterDraft: undefined }),
    },
  };
}
