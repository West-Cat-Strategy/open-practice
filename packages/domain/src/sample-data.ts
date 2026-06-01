import type {
  HostedPaymentRequestRecord,
  InvoiceLineRecord,
  InvoiceRecord,
  ManualPaymentRecord,
  PaymentAllocationRecord,
  TrustTransferRequestRecord,
} from "./billing.js";
import type { AiOperationalProposalRecord } from "./ai-operational-proposals.js";
import type { ContactRelationshipRecord } from "./contacts.js";
import type {
  DocumentAssemblyPackageRecord,
  DocumentAssemblySetDefinitionRecord,
  SignatureEnvelopeRecord,
} from "./document-assembly.js";
import type {
  Contact,
  CalendarEventRecord,
  CalendarSchedulingRequestRecord,
  DocumentRecord,
  ExpenseEntry,
  Firm,
  Matter,
  MatterParty,
  PortalGrant,
  TaskDeadlineRecord,
  TimeEntry,
  User,
} from "./models.js";
import type {
  LedgerAccountingReviewProfileRecord,
  LedgerAccount,
  LedgerEntry,
  LedgerStatementMatchRuleProfileRecord,
} from "./ledger.js";
import type { LegalClinicMatterProfile, LegalClinicProgram } from "./legal-clinics.js";
import type { EmbeddedIntakeTemplateDefinition } from "./intake.js";
import type {
  GeneratedDocumentRecord,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  SignatureProviderEventRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
} from "./signatures.js";
import { appendAuditEvent, type AuditEvent } from "./audit.js";
import { buildBasicDraftTemplates } from "./drafting.js";

export const sampleFirm: Firm = {
  id: "firm-west-legal",
  name: "West Coast Legal Services Collective",
  defaultProvince: "BC",
};

export const sampleUsers: User[] = [
  {
    id: "user-admin",
    firmId: sampleFirm.id,
    displayName: "Avery Chen",
    email: "avery@example.test",
    role: "owner_admin",
    assignedMatterIds: ["matter-001", "matter-002"],
    mfaEnabled: true,
  },
  {
    id: "user-licensee",
    firmId: sampleFirm.id,
    displayName: "Mina Patel",
    email: "mina@example.test",
    role: "licensee",
    assignedMatterIds: ["matter-001"],
    mfaEnabled: true,
  },
  {
    id: "user-staff",
    firmId: sampleFirm.id,
    displayName: "Jordan Lee",
    email: "jordan@example.test",
    role: "firm_member",
    assignedMatterIds: ["matter-001"],
    mfaEnabled: false,
  },
];

export const sampleContacts: Contact[] = [
  {
    id: "contact-ada",
    firmId: sampleFirm.id,
    kind: "person",
    displayName: "Ada Morgan",
    aliases: ["Ada M. Nguyen"],
    identifiers: [{ type: "email", value: "ada@example.test" }],
  },
  {
    id: "contact-northstar",
    firmId: sampleFirm.id,
    kind: "organization",
    displayName: "North Star Holdings Ltd.",
    aliases: ["Northstar Holdings"],
    identifiers: [{ type: "registry_id", value: "BC1234567" }],
  },
  {
    id: "contact-river",
    firmId: sampleFirm.id,
    kind: "organization",
    displayName: "River City Rentals Inc.",
    aliases: [],
    identifiers: [{ type: "email", value: "legal@rivercity.example" }],
  },
];

export const sampleMatters: Matter[] = [
  {
    id: "matter-001",
    firmId: sampleFirm.id,
    number: "2026-0001",
    title: "Morgan tenancy dispute",
    practiceArea: "Residential tenancy",
    status: "open",
    jurisdiction: "BC",
    responsibleUserId: "user-licensee",
    openedOn: "2026-04-01",
  },
  {
    id: "matter-002",
    firmId: sampleFirm.id,
    number: "2026-0002",
    title: "North Star corporate records",
    practiceArea: "Notarial services",
    status: "intake",
    jurisdiction: "BC",
    responsibleUserId: "user-admin",
  },
];

export const sampleMatterParties: MatterParty[] = [
  {
    id: "party-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    contactId: "contact-ada",
    role: "client",
    adverse: false,
    confidential: true,
  },
  {
    id: "party-002",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    contactId: "contact-river",
    role: "opposing_party",
    adverse: true,
    confidential: false,
  },
  {
    id: "party-003",
    firmId: sampleFirm.id,
    matterId: "matter-002",
    contactId: "contact-northstar",
    role: "notary_client",
    adverse: false,
    confidential: true,
  },
];

export const sampleContactRelationships: ContactRelationshipRecord[] = [
  {
    id: "contact-relationship-ada-river-counterparty",
    firmId: sampleFirm.id,
    contactId: "contact-ada",
    relatedContactId: "contact-river",
    relationshipKind: "opposing_party_for",
    label: "Matter counterparty",
    matterId: "matter-001",
    source: "matter_party",
    status: "active",
    createdAt: "2026-05-29T12:00:00.000Z",
    updatedAt: "2026-05-29T12:00:00.000Z",
  },
  {
    id: "contact-relationship-ada-northstar-referral",
    firmId: sampleFirm.id,
    contactId: "contact-ada",
    relatedContactId: "contact-northstar",
    relationshipKind: "referral_source",
    label: "Referral source",
    matterId: "matter-002",
    source: "manual",
    status: "review_needed",
    createdAt: "2026-05-29T12:05:00.000Z",
    updatedAt: "2026-05-29T12:05:00.000Z",
  },
];

export const sampleLegalClinicPrograms: LegalClinicProgram[] = [
  {
    id: "clinic-program-tenancy-stability",
    firmId: sampleFirm.id,
    name: "Tenancy Stability Clinic",
    status: "active",
    serviceArea: "Residential tenancy",
    eligibilitySummary:
      "Synthetic low-barrier screening for tenants with urgent housing stability issues.",
    defaultReferralSource: "community_partner",
    defaultReferralStatus: "referral_needed",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    metadata: { source: "open-practice-sample", providerNeutral: true },
  },
  {
    id: "clinic-program-records-access",
    firmId: sampleFirm.id,
    name: "Records Access Clinic",
    status: "active",
    serviceArea: "Records access",
    eligibilitySummary:
      "Synthetic screening for straightforward records access and identity-document needs.",
    defaultReferralSource: "internal_intake",
    defaultReferralStatus: "not_referred",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    metadata: { source: "open-practice-sample", providerNeutral: true },
  },
];

export const sampleLegalClinicMatterProfiles: LegalClinicMatterProfile[] = [
  {
    id: "clinic-profile-matter-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    programId: "clinic-program-tenancy-stability",
    eligibilityStatus: "likely_eligible",
    referralSource: "community_partner",
    referralStatus: "referred",
    referralDate: "2026-04-01",
    nextReviewDate: "2026-04-08T17:00:00.000Z",
    clinicRelationshipRole: "clinic client",
    notes: "Synthetic operational note for clinic screening.",
    updatedAt: "2026-04-01T18:15:00.000Z",
    createdAt: "2026-04-01T18:15:00.000Z",
    updatedByUserId: "user-licensee",
    metadata: { source: "open-practice-sample" },
  },
  {
    id: "clinic-profile-matter-002",
    firmId: sampleFirm.id,
    matterId: "matter-002",
    programId: "clinic-program-records-access",
    eligibilityStatus: "needs_review",
    referralSource: "internal_intake",
    referralStatus: "not_referred",
    clinicRelationshipRole: "clinic intake prospect",
    notes: "Synthetic screening started for records access clinic.",
    createdAt: "2026-04-02T16:00:00.000Z",
    updatedAt: "2026-04-02T16:00:00.000Z",
    updatedByUserId: "user-admin",
    metadata: { source: "open-practice-sample" },
  },
];

export const sampleDocuments: DocumentRecord[] = [
  {
    id: "doc-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    title: "Retainer agreement.pdf",
    storageKey: "matters/matter-001/retainer-v1.pdf",
    checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
    version: 1,
    classification: "privileged",
    legalHold: true,
    uploadStatus: "verified",
    checksumStatus: "verified",
    scanStatus: "passed",
    reviewStatus: "not_required",
    reviewMetadata: { source: "seed" },
    uploadedAt: "2026-04-01T20:15:00.000Z",
    verifiedAt: "2026-04-01T20:16:00.000Z",
  },
];

export const sampleSignatureRequests: SignatureRequestRecord[] = [
  {
    id: "sig-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    documentId: "doc-001",
    title: "Retainer agreement",
    requestedByUserId: "user-licensee",
    provider: "embedded",
    externalId: "embedded:matter-001:doc-001",
    status: "sent",
    consentText: "I consent to electronic signature.",
    evidence: { mode: "seed" },
    createdAt: "2026-04-03T18:30:00.000Z",
  },
];

export const sampleSignatureRequestSigners: SignatureRequestSignerRecord[] = [
  {
    id: "sig-signer-001",
    firmId: sampleFirm.id,
    signatureRequestId: "sig-001",
    name: "Ada Morgan",
    email: "ada@example.test",
    role: "client",
    status: "sent",
  },
];

export const sampleSignatureProviderEvents: SignatureProviderEventRecord[] = [
  {
    id: "sig-event-001",
    firmId: sampleFirm.id,
    signatureRequestId: "sig-001",
    provider: "embedded",
    externalId: "embedded:matter-001:doc-001",
    status: "sent",
    occurredAt: "2026-04-03T18:30:00.000Z",
    evidence: { mode: "seed" },
  },
];

export const sampleSignatureWebhookAttempts: SignatureWebhookAttemptRecord[] = [];

export const sampleResidentialTenancyIntakeDefinition: EmbeddedIntakeTemplateDefinition = {
  schemaVersion: 2,
  questions: [
    {
      id: "issue_type",
      label: "Issue type",
      type: "select",
      required: true,
      options: [
        { value: "repair", label: "Repair or maintenance" },
        { value: "deposit", label: "Security deposit" },
        { value: "notice", label: "Notice to end tenancy" },
      ],
    },
    {
      id: "urgent",
      label: "Urgent deadline",
      type: "boolean",
    },
    {
      id: "repair_details",
      label: "Repair details",
      type: "textarea",
    },
    {
      id: "client_display_name",
      label: "Preferred client name",
      type: "text",
      variableMapping: {
        targetScope: "client",
        targetField: "displayName",
      },
    },
    {
      id: "matter_title",
      label: "Short matter title",
      type: "text",
      variableMapping: {
        targetScope: "matter",
        targetField: "title",
      },
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
      title: "Repair notice package",
      default: true,
      documents: [
        {
          id: "repair_notice_letter",
          title: "Repair notice letter",
        },
        {
          id: "client_instruction_summary",
          title: "Client instruction summary",
        },
      ],
    },
    {
      id: "urgent_review_package",
      title: "Urgent review package",
      documents: [
        {
          id: "urgent_review_memo",
          title: "Urgent review memo",
        },
      ],
    },
  ],
  sections: [
    {
      id: "client-basics",
      title: "Client basics",
      items: [
        {
          id: "intro",
          kind: "display",
          body: "Synthetic intake form instructions for the client.",
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
      ],
    },
    {
      id: "issue-details",
      title: "Issue details",
      items: [
        {
          id: "issue-type-item",
          kind: "question",
          questionId: "issue_type",
        },
        {
          id: "urgent-item",
          kind: "question",
          questionId: "urgent",
        },
        {
          id: "repair-details-item",
          kind: "question",
          questionId: "repair_details",
        },
        {
          id: "evidence-upload",
          kind: "upload",
          label: "Upload supporting evidence",
          required: true,
          acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
          classification: "privileged",
          legalHold: false,
        },
        {
          id: "client-attestation",
          kind: "signature",
          label: "Client attestation",
          required: true,
          consentText: "I confirm these synthetic intake answers are accurate.",
        },
      ],
    },
  ],
};

export const sampleIntakeTemplates: IntakeTemplateRecord[] = [
  {
    id: "intake-template-001",
    firmId: sampleFirm.id,
    name: "Residential tenancy intake",
    category: "residential-tenancy",
    description: "Synthetic embedded intake for a sample residential tenancy matter.",
    provider: "embedded",
    externalTemplateId: "residential-tenancy-intake",
    active: true,
    definitionVersion: 2,
    definition: sampleResidentialTenancyIntakeDefinition,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    metadata: { source: "open-practice-sample" },
  },
];

export const sampleIntakeSessions: IntakeSessionRecord[] = [
  {
    id: "intake-session-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    templateId: "intake-template-001",
    provider: "embedded",
    externalId: "embedded:intake-session-001",
    status: "in_progress",
    clientContactId: "contact-ada",
    evidence: { mode: "seed" },
    createdAt: "2026-04-01T18:00:00.000Z",
    updatedAt: "2026-04-01T18:00:00.000Z",
  },
];

export const sampleGeneratedDocuments: GeneratedDocumentRecord[] = [
  {
    id: "generated-doc-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    provider: "embedded",
    externalId: "draft-export:draft-sample-retainer:doc-001",
    title: "Retainer agreement",
    documentId: "doc-001",
    storageKey: "matters/matter-001/draft-exports/generated-doc-001-retainer.pdf",
    checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
    evidence: {
      source: "draft_export",
      draftId: "draft-sample-retainer",
      draftVersion: 1,
      format: "pdf",
    },
    createdAt: "2026-04-03T18:20:00.000Z",
  },
];

export const sampleDocumentAssemblySetDefinitions: DocumentAssemblySetDefinitionRecord[] = [
  {
    id: "assembly-set-retainer",
    firmId: sampleFirm.id,
    name: "Retainer signature package",
    description: "Synthetic reusable retainer package metadata.",
    practiceArea: "housing",
    documentRefs: [
      {
        id: "retainer-agreement",
        title: "Retainer agreement",
        sourceKind: "draft_template",
        sourceId: "template-general-retainer",
        required: true,
        signerRoles: ["client"],
      },
    ],
    requiredMergeFields: ["client.displayName", "matter.number", "matter.title"],
    active: true,
    createdAt: "2026-04-03T18:00:00.000Z",
    updatedAt: "2026-04-03T18:00:00.000Z",
    metadata: { source: "seed" },
  },
];

export const sampleDocumentAssemblyPackages: DocumentAssemblyPackageRecord[] = [
  {
    id: "assembly-package-retainer-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    definitionId: "assembly-set-retainer",
    title: "Retainer signature package",
    status: "assembled",
    populationStatus: "populated",
    documentIds: ["doc-001"],
    generatedDocumentIds: ["generated-doc-001"],
    signatureRequestIds: ["sig-001"],
    createdByUserId: "user-licensee",
    createdAt: "2026-04-03T18:25:00.000Z",
    updatedAt: "2026-04-03T18:30:00.000Z",
    metadata: { source: "seed" },
  },
];

export const sampleSignatureEnvelopes: SignatureEnvelopeRecord[] = [
  {
    id: "signature-envelope-retainer-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    assemblyPackageId: "assembly-package-retainer-001",
    signatureRequestId: "sig-001",
    title: "Retainer client signature envelope",
    status: "sent",
    signerOrder: [{ role: "client", order: 1, required: true }],
    fieldPlacements: [
      {
        id: "client-signature",
        role: "client",
        fieldType: "signature",
        page: 1,
        required: true,
        documentId: "doc-001",
        xPercent: 72,
        yPercent: 84,
      },
      {
        id: "client-date",
        role: "client",
        fieldType: "date",
        page: 1,
        required: true,
        documentId: "doc-001",
        xPercent: 72,
        yPercent: 90,
      },
    ],
    validationStatus: "valid",
    createdByUserId: "user-licensee",
    createdAt: "2026-04-03T18:28:00.000Z",
    updatedAt: "2026-04-03T18:30:00.000Z",
    metadata: { source: "seed" },
  },
];

export const sampleDraftTemplates = buildBasicDraftTemplates(
  sampleFirm.id,
  "2026-04-01T00:00:00.000Z",
);

export const sampleAiOperationalProposals: AiOperationalProposalRecord[] = [
  {
    id: "ai-proposal-deadline-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    kind: "deadline_extraction",
    status: "proposed",
    source: {
      sourceType: "document",
      documentId: "doc-001",
      sourceLabel: "Retainer agreement",
      sourceTextLength: 360,
      confidence: "medium",
    },
    providerKey: "fake-local-ai",
    providerModel: "fake-operational-proposals-v1",
    proposal: {
      title: "Review possible response deadline",
      summary: "Synthetic deadline proposal for staff review.",
      proposedAction: "Review before adding any calendar or task record.",
      deadline: { suggestedDueAt: "2026-06-15T16:00:00.000Z" },
    },
    createdByUserId: "user-licensee",
    createdAt: "2026-06-01T16:00:00.000Z",
    updatedAt: "2026-06-01T16:00:00.000Z",
    metadata: { source: "seed", statusOnlyReview: true },
  },
  {
    id: "ai-proposal-client-update-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    kind: "client_update_draft",
    status: "approved",
    source: {
      sourceType: "document",
      documentId: "doc-001",
      sourceLabel: "Retainer agreement",
      sourceTextLength: 360,
      confidence: "low",
    },
    providerKey: "fake-local-ai",
    providerModel: "fake-operational-proposals-v1",
    proposal: {
      title: "Review client update draft",
      summary: "Synthetic client-update proposal already accepted as a proposal only.",
      proposedAction: "Use normal communications review before sending any update.",
      clientUpdate: { tone: "neutral", audience: "client" },
    },
    reviewDecision: "approved",
    reviewedByUserId: "user-licensee",
    reviewedAt: "2026-06-01T17:00:00.000Z",
    createdByUserId: "user-licensee",
    createdAt: "2026-06-01T16:05:00.000Z",
    updatedAt: "2026-06-01T17:00:00.000Z",
    metadata: { source: "seed", statusOnlyReview: true },
  },
];

export const samplePortalGrants: PortalGrant[] = [
  {
    id: "grant-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    contactId: "contact-ada",
    grantedByUserId: "user-licensee",
    permissions: ["view_documents", "upload_documents", "message", "sign"],
  },
];

export const sampleCalendarEvents: CalendarEventRecord[] = [
  {
    id: "calendar-event-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    uid: "calendar-event-001@open-practice.local",
    title: "Residential tenancy filing deadline",
    startsAt: "2026-05-05T16:00:00.000Z",
    endsAt: "2026-05-05T16:30:00.000Z",
    description: "Synthetic filing reminder for the Morgan matter.",
    location: "Open Practice office",
    status: "confirmed",
    sequence: 0,
    createdAt: "2026-04-30T12:00:00.000Z",
    updatedAt: "2026-04-30T12:00:00.000Z",
    createdByUserId: "user-licensee",
    updatedByUserId: "user-licensee",
  },
  {
    id: "calendar-event-002",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    uid: "calendar-event-002@open-practice.local",
    title: "Client preparation call",
    startsAt: "2026-05-07T18:00:00.000Z",
    endsAt: "2026-05-07T18:45:00.000Z",
    description: "Synthetic preparation call for hearing materials.",
    status: "tentative",
    sequence: 0,
    createdAt: "2026-04-30T12:00:00.000Z",
    updatedAt: "2026-04-30T12:00:00.000Z",
    createdByUserId: "user-licensee",
    updatedByUserId: "user-licensee",
    attendees: [
      {
        id: "calendar-attendee-001",
        firmId: sampleFirm.id,
        matterId: "matter-001",
        eventId: "calendar-event-002",
        name: "Ada Morgan",
        email: "ada.morgan@example.test",
        role: "required",
        responseStatus: "needs_action",
        invitationStatus: "not_sent",
        createdAt: "2026-04-30T12:00:00.000Z",
        updatedAt: "2026-04-30T12:00:00.000Z",
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      },
    ],
  },
  {
    id: "calendar-event-003",
    firmId: sampleFirm.id,
    matterId: "matter-002",
    uid: "calendar-event-003@open-practice.local",
    title: "Corporate records review",
    startsAt: "2026-05-08T17:00:00.000Z",
    endsAt: "2026-05-08T18:00:00.000Z",
    location: "Virtual",
    status: "confirmed",
    sequence: 0,
    createdAt: "2026-04-30T12:00:00.000Z",
    updatedAt: "2026-04-30T12:00:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
  },
];

export const sampleTaskDeadlines: TaskDeadlineRecord[] = [
  {
    id: "task-deadline-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    assignedToUserId: "user-licensee",
    title: "Review tenant evidence package",
    dueAt: "2026-05-01T19:00:00.000Z",
  },
  {
    id: "task-deadline-002",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    assignedToUserId: "user-staff",
    title: "Prepare filing checklist",
    dueAt: "2026-05-02T22:00:00.000Z",
  },
  {
    id: "task-deadline-003",
    firmId: sampleFirm.id,
    matterId: "matter-002",
    assignedToUserId: "user-admin",
    title: "Confirm corporate records request",
    dueAt: "2026-05-06T17:00:00.000Z",
  },
  {
    id: "task-deadline-004",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    assignedToUserId: "user-licensee",
    title: "Send synthetic retainer follow-up",
    dueAt: "2026-04-29T20:00:00.000Z",
    completedAt: "2026-04-30T17:30:00.000Z",
  },
];

export const sampleCalendarSchedulingRequests: CalendarSchedulingRequestRecord[] = [
  {
    id: "calendar-scheduling-request-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    kind: "deadline_review",
    status: "needs_review",
    title: "Review filing deadline schedule",
    taskId: "task-deadline-001",
    calendarEventId: "calendar-event-001",
    ownerUserId: "user-licensee",
    sourceType: "task_deadline",
    sourceId: "task-deadline-001",
    sourceLabel: "Review tenant evidence package",
    requestedDueAt: "2026-05-01T19:00:00.000Z",
    requestedStartsAt: "2026-05-05T16:00:00.000Z",
    requestedEndsAt: "2026-05-05T16:30:00.000Z",
    reminderPosture: "delivery_opt_in_available",
    privacy: "staff_only",
    timeCaptureCue: {
      posture: "draft_available",
      suggestedMinutes: 30,
      existingTimeEntryCount: 1,
      billable: true,
    },
    createdAt: "2026-04-30T12:00:00.000Z",
    updatedAt: "2026-04-30T12:00:00.000Z",
    createdByUserId: "user-licensee",
    updatedByUserId: "user-licensee",
  },
  {
    id: "calendar-scheduling-request-002",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    kind: "event_scheduling",
    status: "needs_review",
    title: "Schedule filing checklist review",
    taskId: "task-deadline-002",
    ownerUserId: "user-staff",
    sourceType: "task_deadline",
    sourceId: "task-deadline-002",
    sourceLabel: "Prepare filing checklist",
    requestedDueAt: "2026-05-02T22:00:00.000Z",
    reminderPosture: "none",
    privacy: "matter_team",
    timeCaptureCue: {
      posture: "draft_available",
      suggestedMinutes: 15,
      existingTimeEntryCount: 0,
      billable: true,
    },
    createdAt: "2026-04-30T12:05:00.000Z",
    updatedAt: "2026-04-30T12:05:00.000Z",
    createdByUserId: "user-licensee",
    updatedByUserId: "user-licensee",
  },
];

export const sampleTimeEntries: TimeEntry[] = [
  {
    id: "time-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    userId: "user-licensee",
    performedAt: "2026-04-04T16:30:00.000Z",
    minutes: 42,
    rateCents: 18000,
    narrative: "Reviewed tenancy branch materials and client chronology.",
    billable: true,
    billingStatus: "approved",
  },
];

export const sampleExpenseEntries: ExpenseEntry[] = [
  {
    id: "expense-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    incurredAt: "2026-04-04T18:00:00.000Z",
    amountCents: 1250,
    category: "Filing",
    description: "Tribunal evidence package upload fee",
    reimbursable: true,
    billingStatus: "approved",
  },
];

export const sampleInvoices: InvoiceRecord[] = [
  {
    id: "invoice-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    clientContactId: "contact-ada",
    invoiceNumber: "INV-2026-0001",
    status: "issued",
    issuedAt: "2026-04-06T17:00:00.000Z",
    dueAt: "2026-05-06T17:00:00.000Z",
    memo: "Initial tenancy dispute invoice",
    createdByUserId: "user-licensee",
    createdAt: "2026-04-06T17:00:00.000Z",
    subtotalCents: 12600,
    taxCents: 630,
    totalCents: 13230,
    paidCents: 0,
    balanceDueCents: 13230,
  },
];

export const sampleInvoiceLines: InvoiceLineRecord[] = [
  {
    id: "invoice-line-001",
    firmId: sampleFirm.id,
    invoiceId: "invoice-001",
    matterId: "matter-001",
    kind: "time",
    description: "Reviewed tenancy branch materials and client chronology.",
    quantity: 42,
    unitAmountCents: 300,
    subtotalCents: 12600,
    taxName: "GST",
    taxRateBps: 500,
    taxCents: 630,
    totalCents: 13230,
    timeEntryId: "time-001",
    createdAt: "2026-04-06T17:00:00.000Z",
  },
];

export const sampleManualPayments: ManualPaymentRecord[] = [];

export const samplePaymentAllocations: PaymentAllocationRecord[] = [];

export const sampleHostedPaymentRequests: HostedPaymentRequestRecord[] = [
  {
    id: "payment-request-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    clientContactId: "contact-ada",
    invoiceId: "invoice-001",
    status: "ready_to_send",
    amountCents: 13230,
    currency: "CAD",
    hostedPath: "/payments/requests/payment-request-001",
    delivery: {
      status: "not_sent",
      channel: "none",
      recipientCount: 0,
    },
    reminder: {
      status: "not_scheduled",
      reminderCount: 0,
    },
    paymentPlan: {
      status: "not_offered",
      enforcement: "none",
    },
    creditWriteOffPosture: {
      status: "none",
      movement: "none",
    },
    processor: {
      status: "not_started",
    },
    evidence: {
      source: "synthetic-payment-request-shell",
    },
    createdByUserId: "user-licensee",
    createdAt: "2026-04-06T17:10:00.000Z",
    updatedAt: "2026-04-06T17:10:00.000Z",
    expiresAt: "2026-05-06T17:00:00.000Z",
  },
];

export const sampleTrustTransferRequests: TrustTransferRequestRecord[] = [
  {
    id: "trust-transfer-request-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    clientContactId: "contact-ada",
    invoiceId: "invoice-001",
    requestedByUserId: "user-licensee",
    amountCents: 13230,
    status: "pending_approval",
    reason: "Apply trust funds to issued invoice after approval.",
    requestedAt: "2026-04-06T18:00:00.000Z",
  },
];

export const sampleLedgerAccounts: LedgerAccount[] = [
  { id: "acct-trust-bank", firmId: sampleFirm.id, name: "Pooled trust bank", type: "trust_asset" },
  {
    id: "acct-client-liability",
    firmId: sampleFirm.id,
    name: "Client trust liability",
    type: "client_liability",
  },
  {
    id: "acct-operating-revenue",
    firmId: sampleFirm.id,
    name: "Operating revenue",
    type: "operating_revenue",
  },
];

export const sampleLedgerEntries: LedgerEntry[] = [
  {
    id: "trust-retainer-1",
    transactionId: "trust-retainer",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    clientId: "contact-ada",
    accountId: "acct-trust-bank",
    debitCents: 150000,
    creditCents: 0,
    memo: "Retainer received into pooled trust",
    postedAt: "2026-04-02T17:00:00.000Z",
  },
  {
    id: "trust-retainer-2",
    transactionId: "trust-retainer",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    clientId: "contact-ada",
    accountId: "acct-client-liability",
    debitCents: 0,
    creditCents: 150000,
    memo: "Client trust liability",
    postedAt: "2026-04-02T17:00:00.000Z",
  },
];

export const sampleLedgerStatementMatchRuleProfiles: LedgerStatementMatchRuleProfileRecord[] = [
  {
    id: "statement-match-profile-standard-trust",
    firmId: sampleFirm.id,
    accountId: "acct-trust-bank",
    name: "Standard trust statement review",
    referenceStrategy: "normalized_reference",
    descriptionStrategy: "normalized_contains",
    dateWindowDays: 2,
    amountToleranceCents: 0,
    varianceCategories: ["ledger_entry_expected", "needs_follow_up"],
    reviewerExplanationRequired: true,
    reviewOnly: true,
    createdByUserId: "user-admin",
    createdAt: "2026-05-31T18:00:00.000Z",
    updatedAt: "2026-05-31T18:00:00.000Z",
  },
];

export const sampleLedgerAccountingReviewProfiles: LedgerAccountingReviewProfileRecord[] = [
  {
    id: "accounting-review-profile-trust-bank",
    firmId: sampleFirm.id,
    accountId: "acct-trust-bank",
    accountType: "trust_asset",
    boundaryPosture: "trust_only",
    protectedFunds: {
      protected: true,
      reason: "Synthetic pooled trust funds require reviewer confirmation before disbursement.",
      reviewCadence: "monthly",
    },
    bankFeedImport: {
      status: "metadata_only",
      sourceLabel: "Synthetic trust statement upload",
      lastImportedAt: "2026-05-31T18:05:00.000Z",
      automaticMatching: false,
    },
    dimensions: {
      vendorTracking: "not_applicable",
      expenseCategoryTracking: "optional",
      clientMatterTracking: "required",
      notes: "Review-only accounting posture for trust reconciliation planning.",
    },
    reviewOnly: true,
    createdByUserId: "user-admin",
    createdAt: "2026-05-31T18:05:00.000Z",
    updatedAt: "2026-05-31T18:05:00.000Z",
  },
  {
    id: "accounting-review-profile-operating-revenue",
    firmId: sampleFirm.id,
    accountId: "acct-operating-revenue",
    accountType: "operating_revenue",
    boundaryPosture: "operating_only",
    protectedFunds: {
      protected: false,
      reviewCadence: "monthly",
    },
    bankFeedImport: {
      status: "not_configured",
      automaticMatching: false,
    },
    dimensions: {
      vendorTracking: "optional",
      expenseCategoryTracking: "required",
      clientMatterTracking: "required",
      notes: "Operating revenue review posture only; no settlement automation.",
    },
    reviewOnly: true,
    createdByUserId: "user-admin",
    createdAt: "2026-05-31T18:10:00.000Z",
    updatedAt: "2026-05-31T18:10:00.000Z",
  },
];

const firstAudit = appendAuditEvent(undefined, {
  id: "audit-001",
  firmId: sampleFirm.id,
  actorId: "user-licensee",
  action: "matter.opened",
  resourceType: "matter",
  resourceId: "matter-001",
  occurredAt: "2026-04-01T16:30:00.000Z",
  metadata: { jurisdiction: "BC", practiceArea: "Residential tenancy" },
});

export const sampleAuditEvents: AuditEvent[] = [
  firstAudit,
  appendAuditEvent(firstAudit, {
    id: "audit-002",
    firmId: sampleFirm.id,
    actorId: "user-licensee",
    action: "portal.grant.created",
    resourceType: "portal_grant",
    resourceId: "grant-001",
    occurredAt: "2026-04-03T18:15:00.000Z",
    metadata: { permissions: ["view_documents", "upload_documents", "message", "sign"] },
  }),
];
