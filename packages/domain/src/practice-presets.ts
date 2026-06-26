import type { DraftTemplateRecord, TipTapDocument, TipTapNode } from "./drafting.js";
import type { EmbeddedIntakeTemplateDefinition } from "./intake.js";
import type { Province } from "./models.js";
import type { IntakeTemplateRecord, IntakeTemplateVersionRecord } from "./signatures.js";

export type { Province } from "./models.js";

const PRACTICE_PRESET_VERSION = 1;

export const PRACTICE_PRESET_IDS = [
  "general-canada",
  "bc-residential-tenancy",
  "bc-notarial",
  "canada-small-business-records",
] as const;

export type PracticePresetId = (typeof PRACTICE_PRESET_IDS)[number];

type PresetDraftTemplate = Omit<DraftTemplateRecord, "firmId" | "createdAt" | "updatedAt">;
type PresetIntakeTemplate = Omit<IntakeTemplateRecord, "firmId" | "createdAt" | "updatedAt">;

export interface PracticePreset {
  id: PracticePresetId;
  name: string;
  description: string;
  jurisdictions: readonly Province[];
  practiceAreas: readonly string[];
  draftTemplates: PresetDraftTemplate[];
  intakeTemplates: PresetIntakeTemplate[];
}

export interface BuiltPracticePresetTemplates {
  selectedPresetIds: PracticePresetId[];
  draftTemplates: DraftTemplateRecord[];
  intakeTemplates: IntakeTemplateRecord[];
  intakeTemplateVersions: IntakeTemplateVersionRecord[];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function heading(text: string, level = 1): TipTapNode {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function paragraph(text: string): TipTapNode {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function bulletList(items: string[]): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: item }] }],
    })),
  };
}

function doc(content: TipTapNode[]): TipTapDocument {
  return { type: "doc", content };
}

function intakeDefinition(
  definition: Omit<
    Extract<EmbeddedIntakeTemplateDefinition, { schemaVersion: 2 }>,
    "schemaVersion"
  >,
): EmbeddedIntakeTemplateDefinition {
  return {
    schemaVersion: 2,
    ...definition,
  };
}

function presetMetadata(
  preset: Pick<PracticePreset, "id" | "name" | "jurisdictions" | "practiceAreas">,
) {
  return {
    source: "open-practice-preset",
    presetId: preset.id,
    presetVersion: PRACTICE_PRESET_VERSION,
    presetName: preset.name,
    jurisdictions: preset.jurisdictions,
    practiceAreas: preset.practiceAreas,
    editable: true,
  };
}

function draftTemplate(input: {
  preset: Pick<PracticePreset, "id" | "name" | "jurisdictions" | "practiceAreas">;
  id: string;
  name: string;
  category: string;
  description: string;
  editorJson: TipTapDocument;
}): PresetDraftTemplate {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    description: input.description,
    editorJson: input.editorJson,
    active: true,
    metadata: presetMetadata(input.preset),
  };
}

function intakeTemplate(input: {
  preset: Pick<PracticePreset, "id" | "name" | "jurisdictions" | "practiceAreas">;
  id: string;
  name: string;
  category: string;
  description: string;
  externalTemplateId: string;
  definition: EmbeddedIntakeTemplateDefinition;
}): PresetIntakeTemplate {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    description: input.description,
    provider: "embedded",
    externalTemplateId: input.externalTemplateId,
    active: true,
    definitionVersion: input.definition.schemaVersion,
    definition: input.definition,
    metadata: presetMetadata(input.preset),
  };
}

const generalCanadaPresetBase = {
  id: "general-canada",
  name: "General Canada practice",
  description: "Operational starter templates for broad Canadian matter intake and drafting.",
  jurisdictions: ["CANADA", "OTHER"],
  practiceAreas: ["General practice"],
} as const;

const bcResidentialTenancyPresetBase = {
  id: "bc-residential-tenancy",
  name: "BC residential tenancy",
  description: "Operational starter templates for BC rental housing matter triage.",
  jurisdictions: ["BC"],
  practiceAreas: ["Residential tenancy"],
} as const;

const bcNotarialPresetBase = {
  id: "bc-notarial",
  name: "BC notarial",
  description: "Operational starter templates for BC notarial appointment preparation.",
  jurisdictions: ["BC"],
  practiceAreas: ["Notarial services"],
} as const;

const smallBusinessRecordsPresetBase = {
  id: "canada-small-business-records",
  name: "Canada small-business records",
  description: "Operational starter templates for Canadian small-business record requests.",
  jurisdictions: ["BC", "ON", "CANADA"],
  practiceAreas: ["Business records"],
} as const;

const generalCanadaIntakeDefinition = intakeDefinition({
  questions: [
    {
      id: "client_display_name",
      label: "Client or organization name",
      type: "text",
      required: true,
      variableMapping: { targetScope: "client", targetField: "displayName" },
    },
    {
      id: "matter_title",
      label: "Short matter title",
      type: "text",
      required: true,
      variableMapping: { targetScope: "matter", targetField: "title" },
    },
    {
      id: "practice_area",
      label: "Practice area",
      type: "select",
      required: true,
      options: [
        { value: "General practice", label: "General practice" },
        { value: "Residential tenancy", label: "Residential tenancy" },
        { value: "Notarial services", label: "Notarial services" },
        { value: "Business records", label: "Business records" },
      ],
      variableMapping: { targetScope: "matter", targetField: "practiceArea" },
    },
    {
      id: "jurisdiction",
      label: "Canadian jurisdiction",
      type: "select",
      required: true,
      options: [
        { value: "BC", label: "British Columbia" },
        { value: "ON", label: "Ontario" },
        { value: "CANADA", label: "Canada-wide or federal" },
        { value: "OTHER", label: "Other Canadian context" },
      ],
      variableMapping: { targetScope: "matter", targetField: "jurisdiction" },
    },
    {
      id: "urgency",
      label: "Urgency",
      type: "select",
      required: true,
      options: [
        { value: "standard", label: "Standard review" },
        { value: "time_sensitive", label: "Time-sensitive review" },
      ],
    },
    {
      id: "key_date",
      label: "Key Canadian deadline or review date",
      type: "date",
    },
    {
      id: "documents_available",
      label: "Documents are available for staff review",
      type: "boolean",
    },
  ],
  branchRules: [
    {
      id: "time-sensitive-review",
      questionId: "urgency",
      operator: "equals",
      value: "time_sensitive",
      eligiblePackageIds: ["deadline_review_packet"],
    },
  ],
  packages: [
    {
      id: "matter_opening_packet",
      title: "Matter opening review packet",
      default: true,
      documents: [
        { id: "matter_summary_note", title: "Matter summary note" },
        { id: "client_instruction_summary", title: "Client instruction summary" },
      ],
    },
    {
      id: "deadline_review_packet",
      title: "Deadline review packet",
      documents: [{ id: "deadline_review_note", title: "Canadian deadline review note" }],
    },
  ],
  sections: [
    {
      id: "general-client",
      title: "Client and matter basics",
      items: [
        {
          id: "general-intro",
          kind: "display",
          body: "Synthetic Canadian intake for staff-reviewed matter opening.",
        },
        { id: "general-client-name", kind: "question", questionId: "client_display_name" },
        { id: "general-matter-title", kind: "question", questionId: "matter_title" },
        { id: "general-practice-area", kind: "question", questionId: "practice_area" },
        { id: "general-jurisdiction", kind: "question", questionId: "jurisdiction" },
      ],
    },
    {
      id: "general-review",
      title: "Review posture",
      items: [
        { id: "general-urgency", kind: "question", questionId: "urgency" },
        { id: "general-key-date", kind: "question", questionId: "key_date" },
        { id: "general-documents-ready", kind: "question", questionId: "documents_available" },
        {
          id: "general-supporting-documents",
          kind: "upload",
          label: "Upload optional Canadian matter documents",
          acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
          classification: "privileged",
          legalHold: false,
        },
      ],
    },
  ],
});

const bcResidentialTenancyIntakeDefinition = intakeDefinition({
  questions: [
    {
      id: "client_display_name",
      label: "Preferred client name",
      type: "text",
      required: true,
      variableMapping: { targetScope: "client", targetField: "displayName" },
    },
    {
      id: "matter_title",
      label: "Short BC tenancy matter title",
      type: "text",
      required: true,
      variableMapping: { targetScope: "matter", targetField: "title" },
    },
    {
      id: "rental_address",
      label: "Rental address in BC",
      type: "text",
      required: true,
    },
    {
      id: "client_role",
      label: "Client role",
      type: "select",
      required: true,
      options: [
        { value: "tenant", label: "Tenant" },
        { value: "landlord", label: "Landlord" },
        { value: "other", label: "Other" },
      ],
    },
    {
      id: "issue_type",
      label: "Issue type",
      type: "select",
      required: true,
      options: [
        { value: "repair", label: "Repair or maintenance" },
        { value: "deposit", label: "Security or pet damage deposit" },
        { value: "notice", label: "Notice to end tenancy" },
      ],
    },
    {
      id: "urgent",
      label: "Urgent Residential Tenancy Branch or response deadline",
      type: "boolean",
    },
    {
      id: "repair_details",
      label: "Repair or maintenance details",
      type: "textarea",
    },
  ],
  branchRules: [
    {
      id: "repair-package",
      questionId: "issue_type",
      operator: "equals",
      value: "repair",
      showQuestionIds: ["repair_details"],
      eligiblePackageIds: ["repair_notice_package"],
    },
    {
      id: "urgent-review-package",
      questionId: "urgent",
      operator: "equals",
      value: true,
      eligiblePackageIds: ["urgent_review_package"],
    },
  ],
  packages: [
    {
      id: "repair_notice_package",
      title: "BC repair notice review package",
      default: true,
      documents: [
        { id: "repair_notice_letter", title: "BC repair notice letter" },
        { id: "client_instruction_summary", title: "Client instruction summary" },
      ],
    },
    {
      id: "urgent_review_package",
      title: "Urgent BC tenancy review package",
      documents: [{ id: "urgent_review_memo", title: "Urgent BC tenancy review memo" }],
    },
  ],
  sections: [
    {
      id: "bc-tenancy-basics",
      title: "BC tenancy basics",
      items: [
        {
          id: "bc-tenancy-intro",
          kind: "display",
          body: "Synthetic BC residential tenancy intake for staff triage and document review.",
        },
        { id: "bc-tenancy-client-name", kind: "question", questionId: "client_display_name" },
        { id: "bc-tenancy-matter-title", kind: "question", questionId: "matter_title" },
        { id: "bc-tenancy-rental-address", kind: "question", questionId: "rental_address" },
        { id: "bc-tenancy-client-role", kind: "question", questionId: "client_role" },
      ],
    },
    {
      id: "bc-tenancy-issue",
      title: "Issue and evidence",
      items: [
        { id: "bc-tenancy-issue-type", kind: "question", questionId: "issue_type" },
        { id: "bc-tenancy-urgent", kind: "question", questionId: "urgent" },
        { id: "bc-tenancy-repair-details", kind: "question", questionId: "repair_details" },
        {
          id: "bc-tenancy-evidence-upload",
          kind: "upload",
          label: "Upload tenancy agreement, notice, photos, or correspondence",
          acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
          classification: "privileged",
          legalHold: false,
        },
      ],
    },
  ],
});

const bcNotarialIntakeDefinition = intakeDefinition({
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
      label: "Appointment file title",
      type: "text",
      required: true,
      variableMapping: { targetScope: "matter", targetField: "title" },
    },
    {
      id: "appointment_purpose",
      label: "Appointment purpose",
      type: "select",
      required: true,
      options: [
        { value: "certified_copy", label: "Certified copy preparation" },
        { value: "statutory_declaration", label: "Statutory declaration" },
        { value: "travel_consent", label: "Travel consent or authorization" },
        { value: "other", label: "Other notarial appointment" },
      ],
    },
    {
      id: "appointment_date",
      label: "Preferred appointment date",
      type: "date",
    },
    {
      id: "identity_available",
      label: "Government-issued identity is available for staff review",
      type: "boolean",
    },
    {
      id: "document_list",
      label: "Documents to review",
      type: "textarea",
    },
  ],
  branchRules: [
    {
      id: "identity-follow-up",
      questionId: "identity_available",
      operator: "equals",
      value: false,
      eligiblePackageIds: ["identity_follow_up_packet"],
    },
  ],
  packages: [
    {
      id: "notarial_preparation_packet",
      title: "BC notarial preparation packet",
      default: true,
      documents: [
        { id: "appointment_checklist", title: "Appointment preparation checklist" },
        { id: "document_review_list", title: "Document review list" },
      ],
    },
    {
      id: "identity_follow_up_packet",
      title: "Identity follow-up packet",
      documents: [{ id: "identity_review_note", title: "Identity review note" }],
    },
  ],
  sections: [
    {
      id: "bc-notarial-basics",
      title: "BC notarial appointment basics",
      items: [
        {
          id: "bc-notarial-intro",
          kind: "display",
          body: "Synthetic BC notarial intake for appointment preparation and staff review.",
        },
        { id: "bc-notarial-client", kind: "question", questionId: "client_display_name" },
        { id: "bc-notarial-title", kind: "question", questionId: "matter_title" },
        { id: "bc-notarial-purpose", kind: "question", questionId: "appointment_purpose" },
        { id: "bc-notarial-date", kind: "question", questionId: "appointment_date" },
      ],
    },
    {
      id: "bc-notarial-documents",
      title: "Identity and documents",
      items: [
        { id: "bc-notarial-identity", kind: "question", questionId: "identity_available" },
        { id: "bc-notarial-document-list", kind: "question", questionId: "document_list" },
        {
          id: "bc-notarial-upload",
          kind: "upload",
          label: "Upload documents for notarial preparation",
          acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
          classification: "identity",
          legalHold: false,
        },
      ],
    },
  ],
});

const smallBusinessRecordsIntakeDefinition = intakeDefinition({
  questions: [
    {
      id: "organization_name",
      label: "Organization legal name",
      type: "text",
      required: true,
      variableMapping: { targetScope: "client", targetField: "displayName" },
    },
    {
      id: "matter_title",
      label: "Business records matter title",
      type: "text",
      required: true,
      variableMapping: { targetScope: "matter", targetField: "title" },
    },
    {
      id: "registry_identifier",
      label: "Registry or business number",
      type: "text",
    },
    {
      id: "jurisdiction",
      label: "Primary Canadian jurisdiction",
      type: "select",
      required: true,
      options: [
        { value: "BC", label: "British Columbia" },
        { value: "ON", label: "Ontario" },
        { value: "CANADA", label: "Federal or Canada-wide" },
        { value: "OTHER", label: "Other Canadian context" },
      ],
      variableMapping: { targetScope: "matter", targetField: "jurisdiction" },
    },
    {
      id: "request_type",
      label: "Records requested",
      type: "select",
      required: true,
      options: [
        { value: "minute_book", label: "Minute book or corporate records" },
        { value: "filings", label: "Recent filings or resolutions" },
        { value: "ownership", label: "Director, officer, or ownership records" },
      ],
    },
    {
      id: "target_date",
      label: "Target review date",
      type: "date",
    },
    {
      id: "records_available",
      label: "Records are available for staff review",
      type: "boolean",
    },
  ],
  branchRules: [
    {
      id: "records-follow-up",
      questionId: "records_available",
      operator: "equals",
      value: false,
      eligiblePackageIds: ["records_follow_up_packet"],
    },
  ],
  packages: [
    {
      id: "business_records_review_packet",
      title: "Canadian business records review packet",
      default: true,
      documents: [
        { id: "records_request_checklist", title: "Records request checklist" },
        { id: "registry_detail_summary", title: "Registry detail summary" },
      ],
    },
    {
      id: "records_follow_up_packet",
      title: "Records follow-up packet",
      documents: [{ id: "missing_records_note", title: "Missing records note" }],
    },
  ],
  sections: [
    {
      id: "business-records-basics",
      title: "Business records basics",
      items: [
        {
          id: "business-records-intro",
          kind: "display",
          body: "Synthetic Canadian business records intake for staff review.",
        },
        { id: "business-records-organization", kind: "question", questionId: "organization_name" },
        { id: "business-records-title", kind: "question", questionId: "matter_title" },
        { id: "business-records-registry", kind: "question", questionId: "registry_identifier" },
        { id: "business-records-jurisdiction", kind: "question", questionId: "jurisdiction" },
      ],
    },
    {
      id: "business-records-review",
      title: "Records and timing",
      items: [
        { id: "business-records-request-type", kind: "question", questionId: "request_type" },
        { id: "business-records-target-date", kind: "question", questionId: "target_date" },
        { id: "business-records-available", kind: "question", questionId: "records_available" },
        {
          id: "business-records-upload",
          kind: "upload",
          label: "Upload registry extracts, minute book excerpts, or resolutions",
          acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
          classification: "privileged",
          legalHold: false,
        },
      ],
    },
  ],
});

export const PRACTICE_PRESET_CATALOG: readonly PracticePreset[] = [
  {
    ...generalCanadaPresetBase,
    draftTemplates: [
      draftTemplate({
        preset: generalCanadaPresetBase,
        id: "draft-template-preset-general-canada-matter-summary",
        name: "Canadian Matter Summary Note",
        category: "general-practice",
        description:
          "Editable Canadian matter note for scope, jurisdiction, key dates, parties, and next actions.",
        editorJson: doc([
          heading("Canadian Matter Summary Note"),
          paragraph("Matter: [Matter number and title]"),
          paragraph("Jurisdiction: [Province, territory, federal, or Canada-wide context]"),
          paragraph("Client objective: [Short staff-reviewed operational summary]"),
          heading("Parties and Contacts", 2),
          bulletList([
            "Client or organization: [Name]",
            "Other parties or contacts: [Names]",
            "Internal owner: [User]",
          ]),
          heading("Documents and Dates", 2),
          bulletList([
            "[Document or evidence to review]",
            "[Canadian deadline or limitation date to confirm]",
          ]),
          heading("Next Staff-Reviewed Actions", 2),
          bulletList(["[Action item]", "[Owner]", "[Target date]"]),
        ]),
      }),
    ],
    intakeTemplates: [
      intakeTemplate({
        preset: generalCanadaPresetBase,
        id: "intake-template-preset-general-canada",
        name: "General Matter Intake",
        category: "general-practice",
        description:
          "Collects Canadian contact, matter scope, jurisdiction, dates, documents, and urgency details.",
        externalTemplateId: "embedded:preset:general-canada:intake",
        definition: generalCanadaIntakeDefinition,
      }),
    ],
  },
  {
    ...bcResidentialTenancyPresetBase,
    draftTemplates: [
      draftTemplate({
        preset: bcResidentialTenancyPresetBase,
        id: "draft-template-preset-bc-tenancy-chronology",
        name: "Tenancy Issue Chronology",
        category: "residential-tenancy",
        description:
          "Editable BC residential tenancy chronology for notices, communications, evidence, and review dates.",
        editorJson: doc([
          heading("BC Residential Tenancy Chronology"),
          paragraph("Rental address in BC: [Address]"),
          paragraph("Client role: [Tenant/Landlord/Other]"),
          heading("Timeline", 2),
          bulletList([
            "[Date] - [Notice, repair issue, payment, or communication]",
            "[Date] - [Response, filing step, or follow-up]",
          ]),
          heading("Evidence for Staff Review", 2),
          bulletList([
            "Tenancy agreement or addendum",
            "Residential Tenancy Branch notice or correspondence",
            "Photos, receipts, or messages",
          ]),
          heading("Deadline Review", 2),
          bulletList(["[Response, hearing, or filing date to confirm]"]),
        ]),
      }),
    ],
    intakeTemplates: [
      intakeTemplate({
        preset: bcResidentialTenancyPresetBase,
        id: "intake-template-preset-bc-tenancy",
        name: "BC Residential Tenancy Intake",
        category: "residential-tenancy",
        description:
          "Collects BC rental address, party role, notices, dates, and evidence review posture.",
        externalTemplateId: "embedded:preset:bc-residential-tenancy:intake",
        definition: bcResidentialTenancyIntakeDefinition,
      }),
    ],
  },
  {
    ...bcNotarialPresetBase,
    draftTemplates: [
      draftTemplate({
        preset: bcNotarialPresetBase,
        id: "draft-template-preset-bc-notarial-checklist",
        name: "Notarial Appointment Checklist",
        category: "notarial",
        description:
          "Editable BC notarial preparation checklist for identity, documents, and appointment notes.",
        editorJson: doc([
          heading("BC Notarial Appointment Checklist"),
          paragraph("Appointment date: [Date and time]"),
          paragraph("Client: [Name]"),
          heading("Preparation", 2),
          bulletList([
            "Government-issued identity reviewed: [Yes/No]",
            "Documents received for staff review: [List]",
            "BC appointment logistics or witness notes: [Notes]",
          ]),
          heading("Follow-up", 2),
          bulletList(["[Missing document]", "[Confirmation needed]", "[Target date]"]),
        ]),
      }),
    ],
    intakeTemplates: [
      intakeTemplate({
        preset: bcNotarialPresetBase,
        id: "intake-template-preset-bc-notarial",
        name: "BC Notarial Intake",
        category: "notarial",
        description:
          "Collects BC appointment purpose, identity-review posture, document list, and timing.",
        externalTemplateId: "embedded:preset:bc-notarial:intake",
        definition: bcNotarialIntakeDefinition,
      }),
    ],
  },
  {
    ...smallBusinessRecordsPresetBase,
    draftTemplates: [
      draftTemplate({
        preset: smallBusinessRecordsPresetBase,
        id: "draft-template-preset-canada-small-business-records-request",
        name: "Business Records Request Checklist",
        category: "business-records",
        description:
          "Editable Canadian small-business records checklist for registry details, records, and follow-up.",
        editorJson: doc([
          heading("Canadian Business Records Request Checklist"),
          paragraph("Organization: [Legal name]"),
          paragraph("Registry or business number: [Canadian identifier]"),
          paragraph("Jurisdiction: [BC, ON, federal, or other Canadian context]"),
          heading("Requested Records", 2),
          bulletList([
            "Minute book or records summary",
            "Director/officer details",
            "Recent Canadian filings or resolutions",
          ]),
          heading("Follow-up", 2),
          bulletList(["[Missing item]", "[Responsible person]", "[Target date]"]),
        ]),
      }),
    ],
    intakeTemplates: [
      intakeTemplate({
        preset: smallBusinessRecordsPresetBase,
        id: "intake-template-preset-canada-small-business-records",
        name: "Small-Business Records Intake",
        category: "business-records",
        description:
          "Collects Canadian organization identifiers, records requested, contacts, and review dates.",
        externalTemplateId: "embedded:preset:canada-small-business-records:intake",
        definition: smallBusinessRecordsIntakeDefinition,
      }),
    ],
  },
];

const presetIds = new Set<string>(PRACTICE_PRESET_IDS);

export function isPracticePresetId(value: string): value is PracticePresetId {
  return presetIds.has(value);
}

export function normalizePracticePresetIds(
  selectedPresetIds: readonly string[],
): PracticePresetId[] {
  const normalized = selectedPresetIds.map((id) => id.trim()).filter(Boolean);
  const unknown = normalized.filter((id) => !isPracticePresetId(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown practice preset id: ${unknown[0]}`);
  }
  const selected = new Set(normalized as PracticePresetId[]);
  return PRACTICE_PRESET_IDS.filter((id) => selected.has(id));
}

export function buildPracticePresetTemplates(input: {
  firmId: string;
  timestamp: string;
  selectedPresetIds: readonly string[];
}): BuiltPracticePresetTemplates {
  const selectedPresetIds = normalizePracticePresetIds(input.selectedPresetIds);
  const selectedPresets = PRACTICE_PRESET_CATALOG.filter((preset) =>
    selectedPresetIds.includes(preset.id),
  );
  const intakeTemplates = selectedPresets.flatMap((preset) =>
    preset.intakeTemplates.map((template) => ({
      ...template,
      metadata: cloneJson(template.metadata),
      firmId: input.firmId,
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    })),
  );

  return {
    selectedPresetIds,
    draftTemplates: selectedPresets.flatMap((preset) =>
      preset.draftTemplates.map((template) => ({
        ...template,
        editorJson: cloneJson(template.editorJson),
        metadata: cloneJson(template.metadata),
        firmId: input.firmId,
        createdAt: input.timestamp,
        updatedAt: input.timestamp,
      })),
    ),
    intakeTemplates,
    intakeTemplateVersions: intakeTemplates.map((template) => ({
      id: `${template.id}:v${template.definitionVersion}`,
      firmId: template.firmId,
      templateId: template.id,
      version: template.definitionVersion,
      definitionVersion: template.definitionVersion,
      definition: cloneJson(template.definition),
      publishedAt: input.timestamp,
      metadata: {
        source: "open-practice-preset",
        presetId: template.metadata.presetId,
      },
    })),
  };
}
