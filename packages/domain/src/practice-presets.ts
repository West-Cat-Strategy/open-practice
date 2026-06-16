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

function emptyEmbeddedIntakeDefinition(): EmbeddedIntakeTemplateDefinition {
  return {
    schemaVersion: 1,
    questions: [],
    branchRules: [],
    packages: [],
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
}): PresetIntakeTemplate {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    description: input.description,
    provider: "embedded",
    externalTemplateId: input.externalTemplateId,
    active: true,
    definitionVersion: 1,
    definition: emptyEmbeddedIntakeDefinition(),
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

export const PRACTICE_PRESET_CATALOG: readonly PracticePreset[] = [
  {
    ...generalCanadaPresetBase,
    draftTemplates: [
      draftTemplate({
        preset: generalCanadaPresetBase,
        id: "draft-template-preset-general-canada-matter-summary",
        name: "Matter Summary Note",
        category: "general-practice",
        description: "Editable note for matter scope, key dates, parties, and next actions.",
        editorJson: doc([
          heading("Matter Summary Note"),
          paragraph("Matter: [Matter number and title]"),
          paragraph("Client objective: [Short operational summary]"),
          heading("Parties and Contacts", 2),
          bulletList(["Client: [Name]", "Other parties: [Names]", "Internal owner: [User]"]),
          heading("Next Actions", 2),
          bulletList(["[Action item]", "[Deadline or follow-up]"]),
        ]),
      }),
    ],
    intakeTemplates: [
      intakeTemplate({
        preset: generalCanadaPresetBase,
        id: "intake-template-preset-general-canada",
        name: "General Matter Intake",
        category: "general-practice",
        description: "Collects contact, matter scope, dates, documents, and urgency details.",
        externalTemplateId: "embedded:preset:general-canada:intake",
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
        description: "Editable chronology for notices, communications, evidence, and deadlines.",
        editorJson: doc([
          heading("Tenancy Issue Chronology"),
          paragraph("Rental address: [Address]"),
          paragraph("Client role: [Tenant/Landlord/Other]"),
          heading("Timeline", 2),
          bulletList(["[Date] - [Event or notice]", "[Date] - [Response or follow-up]"]),
          heading("Evidence to Collect", 2),
          bulletList(["Tenancy agreement", "Notices", "Photos or correspondence"]),
        ]),
      }),
    ],
    intakeTemplates: [
      intakeTemplate({
        preset: bcResidentialTenancyPresetBase,
        id: "intake-template-preset-bc-tenancy",
        name: "BC Residential Tenancy Intake",
        category: "residential-tenancy",
        description: "Collects rental address, party role, notices, dates, and evidence status.",
        externalTemplateId: "embedded:preset:bc-residential-tenancy:intake",
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
          "Editable preparation checklist for identity, documents, and appointment notes.",
        editorJson: doc([
          heading("Notarial Appointment Checklist"),
          paragraph("Appointment date: [Date and time]"),
          paragraph("Client: [Name]"),
          heading("Preparation", 2),
          bulletList([
            "Identity reviewed: [Yes/No]",
            "Documents received: [List]",
            "Special handling notes: [Notes]",
          ]),
        ]),
      }),
    ],
    intakeTemplates: [
      intakeTemplate({
        preset: bcNotarialPresetBase,
        id: "intake-template-preset-bc-notarial",
        name: "BC Notarial Intake",
        category: "notarial",
        description: "Collects appointment purpose, identity details, document list, and timing.",
        externalTemplateId: "embedded:preset:bc-notarial:intake",
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
        description: "Editable checklist for corporate records, registry details, and follow-up.",
        editorJson: doc([
          heading("Business Records Request Checklist"),
          paragraph("Organization: [Legal name]"),
          paragraph("Registry or business number: [Identifier]"),
          heading("Requested Records", 2),
          bulletList([
            "Minute book or records summary",
            "Director/officer details",
            "Recent filings or resolutions",
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
          "Collects organization identifiers, records requested, contacts, and deadlines.",
        externalTemplateId: "embedded:preset:canada-small-business-records:intake",
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
