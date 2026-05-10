import type {
  EmbeddedIntakeFormItem,
  EmbeddedIntakeTemplateDefinitionV2,
  IntakeFormItemActionRecord,
  IntakeVariableMapping,
  IntakeVariableTargetScope,
  IntakeTemplateRecord,
  IntakeVariableProposal,
} from "@open-practice/domain";
import type {
  IntakeFormLinkSummary,
  IntakeFormsDashboardResponse,
  IntakeTemplatePreviewResponse,
  MatterSummary,
} from "./types";

export interface IntakeFormLinkCreateFormState {
  intakeSessionId: string;
  expiresAtLocal: string;
}

export type IntakePreviewAnswers = Record<string, string | boolean>;

export const clientVariableFields = ["displayName", "notes"] as const;
export const matterVariableFields = ["title", "practiceArea", "jurisdiction"] as const;
export const questionTypes = ["text", "textarea", "select", "boolean", "date"] as const;
export const itemKinds = ["display", "question", "upload", "signature"] as const;

export const blankIntakeFormDefinition: EmbeddedIntakeTemplateDefinitionV2 = {
  schemaVersion: 2,
  questions: [
    {
      id: "client_display_name",
      label: "Client name",
      type: "text",
      required: true,
      variableMapping: { targetScope: "client", targetField: "displayName" },
    },
    {
      id: "matter_title",
      label: "Matter title",
      type: "text",
      required: true,
      variableMapping: { targetScope: "matter", targetField: "title" },
    },
  ],
  branchRules: [],
  packages: [],
  sections: [
    {
      id: "client-basics",
      title: "Client basics",
      items: [
        {
          id: "intro",
          kind: "display",
          body: "Synthetic intake details for staff review.",
        },
        {
          id: "client-name-item",
          kind: "question",
          questionId: "client_display_name",
        },
        {
          id: "matter-title-item",
          kind: "question",
          questionId: "matter_title",
        },
        {
          id: "supporting-upload",
          kind: "upload",
          label: "Supporting document",
          required: false,
          acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
        },
        {
          id: "client-attestation",
          kind: "signature",
          label: "Client attestation",
          required: true,
          consentText:
            "I confirm that these intake answers are accurate to the best of my knowledge.",
        },
      ],
    },
  ],
};

export function buildIntakeFormLinkListPath(matterId: string): string {
  return `/api/intake-form-links?matterId=${encodeURIComponent(matterId)}`;
}

export function buildIntakePortalPath(token: string): string {
  return `/intake-forms/${encodeURIComponent(token)}`;
}

export function buildIntakeVariableProposalListPath(matterId: string): string {
  return `/api/intake-variable-proposals?matterId=${encodeURIComponent(matterId)}`;
}

export function buildIntakeTemplatePreviewPayload(input: {
  definition: EmbeddedIntakeTemplateDefinitionV2;
  matterId?: string;
  answers: IntakePreviewAnswers;
  selectedPackageIds?: string[];
}): {
  definition: EmbeddedIntakeTemplateDefinitionV2;
  matterId?: string;
  answers: IntakePreviewAnswers;
  selectedPackageIds?: string[];
} {
  return {
    definition: input.definition,
    ...(input.matterId ? { matterId: input.matterId } : {}),
    answers: input.answers,
    ...(input.selectedPackageIds ? { selectedPackageIds: input.selectedPackageIds } : {}),
  };
}

export function describeIntakeTemplatePreview(
  result: IntakeTemplatePreviewResponse | null,
): string {
  if (!result) return "Preview checks have not run.";
  if (result.status === "pass") return "Preview passed with no checks.";
  const warnings = result.checks.filter((check) => check.severity === "warning").length;
  const blocking = result.checks.filter((check) => check.severity === "blocking").length;
  if (blocking > 0) return `Preview blocked by ${blocking} check${blocking === 1 ? "" : "s"}.`;
  return `Preview has ${warnings} warning${warnings === 1 ? "" : "s"}.`;
}

export function previewStatusClass(result: IntakeTemplatePreviewResponse | null): string {
  if (!result) return "muted";
  if (result.status === "blocked") return "risk";
  if (result.status === "warnings") return "warning";
  return "success";
}

export function buildIntakeFormLinkCreatePayload(input: IntakeFormLinkCreateFormState): {
  intakeSessionId: string;
  expiresAt?: string;
} {
  const expiresAt = input.expiresAtLocal.trim()
    ? new Date(input.expiresAtLocal).toISOString()
    : undefined;
  return {
    intakeSessionId: input.intakeSessionId,
    ...(expiresAt ? { expiresAt } : {}),
  };
}

export function getIntakeFormLinkState(
  link: IntakeFormLinkSummary,
  now = new Date(),
): "active" | "expired" | "revoked" | "submitted" {
  if (link.revokedAt) return "revoked";
  if (link.submittedAt || link.status === "submitted") return "submitted";
  if (Date.parse(link.expiresAt) <= now.getTime()) return "expired";
  return "active";
}

export function upsertIntakeFormLink(
  linksByMatterId: Record<string, IntakeFormLinkSummary[]>,
  link: IntakeFormLinkSummary,
): Record<string, IntakeFormLinkSummary[]> {
  const matterLinks = linksByMatterId[link.matterId] ?? [];
  const nextMatterLinks = matterLinks.some((candidate) => candidate.id === link.id)
    ? matterLinks.map((candidate) => (candidate.id === link.id ? link : candidate))
    : [link, ...matterLinks];

  return {
    ...linksByMatterId,
    [link.matterId]: nextMatterLinks,
  };
}

export function upsertIntakeVariableProposal(
  proposalsByMatterId: Record<string, IntakeVariableProposal[]>,
  proposal: IntakeVariableProposal,
): Record<string, IntakeVariableProposal[]> {
  const matterProposals = proposalsByMatterId[proposal.matterId] ?? [];
  const nextMatterProposals = matterProposals.some((candidate) => candidate.id === proposal.id)
    ? matterProposals.map((candidate) => (candidate.id === proposal.id ? proposal : candidate))
    : [proposal, ...matterProposals];

  return {
    ...proposalsByMatterId,
    [proposal.matterId]: nextMatterProposals,
  };
}

export function buildIntakeTemplateEditorValue(template?: IntakeTemplateRecord): string {
  return JSON.stringify(template?.definition ?? blankIntakeFormDefinition, null, 2);
}

export function cloneIntakeDefinition(
  definition: EmbeddedIntakeTemplateDefinitionV2,
): EmbeddedIntakeTemplateDefinitionV2 {
  return JSON.parse(JSON.stringify(definition)) as EmbeddedIntakeTemplateDefinitionV2;
}

export function coerceIntakeDefinitionV2(
  template?: IntakeTemplateRecord,
): EmbeddedIntakeTemplateDefinitionV2 {
  if (template?.definition.schemaVersion === 2) return cloneIntakeDefinition(template.definition);
  return cloneIntakeDefinition(blankIntakeFormDefinition);
}

export function variableTargetFields(scope: IntakeVariableTargetScope): readonly string[] {
  return scope === "client" ? clientVariableFields : matterVariableFields;
}

export function buildVariableMapping(
  scope: IntakeVariableTargetScope,
  field: string,
): IntakeVariableMapping | undefined {
  if (field.length === 0) return undefined;
  if (!variableTargetFields(scope).includes(field)) return undefined;
  return { targetScope: scope, targetField: field as IntakeVariableMapping["targetField"] };
}

export function summarizeIntakeItemAction(action: IntakeFormItemActionRecord): string {
  const label =
    action.kind === "upload"
      ? "upload"
      : action.signatureRequestId
        ? "signature request"
        : "signature";
  return `${label}: ${action.status.replaceAll("_", " ")}`;
}

export function currentProposalValue(
  proposal: IntakeVariableProposal,
  matter?: MatterSummary,
): string {
  if (!matter) return "unknown";
  if (proposal.targetScope === "matter") {
    if (proposal.targetField === "title") return matter.title;
    if (proposal.targetField === "practiceArea") return matter.practiceArea;
    if (proposal.targetField === "jurisdiction") return matter.jurisdiction;
    return "unknown";
  }
  const contact = matter.parties
    .map((party) => party.contact)
    .find((candidate) => candidate.id === proposal.targetRecordId);
  if (!contact) return "unknown";
  if (proposal.targetField === "displayName") return contact.displayName;
  if (proposal.targetField === "notes") return contact.notes ?? "";
  return "unknown";
}

export function makeIntakeItem(
  kind: (typeof itemKinds)[number],
  index: number,
): EmbeddedIntakeFormItem {
  const suffix = `${kind}-${index + 1}`;
  if (kind === "display") return { id: suffix, kind, body: "Client-facing text." };
  if (kind === "question") return { id: suffix, kind, questionId: "client_display_name" };
  if (kind === "upload") {
    return {
      id: suffix,
      kind,
      label: "Supporting document",
      required: false,
      acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
    };
  }
  return {
    id: suffix,
    kind,
    label: "Client attestation",
    required: true,
    consentText: "I confirm these intake answers are accurate.",
  };
}

export async function loadIntakeFormsDashboardData(input: {
  matters: MatterSummary[];
  listLinksForMatter: (matterId: string) => Promise<{
    links: IntakeFormLinkSummary[];
    actionsByLinkId?: Record<string, IntakeFormItemActionRecord[]>;
  }>;
  listProposalsForMatter: (matterId: string) => Promise<IntakeVariableProposal[]>;
}): Promise<IntakeFormsDashboardResponse> {
  const entries = await Promise.all(
    input.matters.map(async (matter) => {
      const [linkPayload, proposals] = await Promise.all([
        input.listLinksForMatter(matter.id),
        input.listProposalsForMatter(matter.id),
      ]);
      return [matter.id, { ...linkPayload, proposals }] as const;
    }),
  );

  return {
    linksByMatterId: Object.fromEntries(entries.map(([matterId, data]) => [matterId, data.links])),
    actionsByLinkId: Object.assign(
      {},
      ...entries.map(([, data]) => data.actionsByLinkId ?? {}),
    ) as Record<string, IntakeFormItemActionRecord[]>,
    proposalsByMatterId: Object.fromEntries(
      entries.map(([matterId, data]) => [matterId, data.proposals]),
    ),
  };
}
