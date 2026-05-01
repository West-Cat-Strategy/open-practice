import { describe, expect, it } from "vitest";
import type {
  CalendarEventRecord,
  DashboardSectionCapability,
  DashboardSectionKey,
  DraftRecord,
  DraftTemplateRecord,
} from "@open-practice/domain";
import { sampleResidentialTenancyIntakeDefinition } from "@open-practice/domain/sample-data";
import { buildSidebarNavigationSections } from "../routes/routeCatalog";
import {
  describeDisabledNavigationReason,
  filterMatters,
  summarizeQueues,
} from "./dashboard-utils";
import {
  buildCreateShareLinkPayload,
  describeShareLinkState,
  formatSharePermission,
  replaceShareLink,
} from "./share-links-dashboard";
import {
  appendDraftToMatterDrafts,
  buildBlankDraftPayload,
  buildDraftFromTemplatePayload,
  buildDraftUpdatePayload,
  describeDraftAssistStatus,
  extractDraftPlainText,
  formatDraftApiFailure,
  insertDraftAssistSuggestion,
  isSameDraftDocument,
  loadDraftingDashboardData,
} from "./drafting-dashboard";
import {
  buildExternalUploadCreatePayload,
  buildExternalUploadListPath,
  buildExternalUploadRevokePath,
  canCreateExternalUpload,
  getExternalUploadLinkState,
  loadExternalUploadsDashboardData,
  upsertExternalUploadLink,
} from "./external-uploads-dashboard";
import {
  buildCalendarRadarBuckets,
  describeCalendarEventTiming,
  loadCalendarDashboardData,
  removeCalendarEventAttendee,
  upsertCalendarEventAttendee,
  upsertCalendarCredential,
} from "./calendar-dashboard";
import {
  buildIntakeFormLinkCreatePayload,
  buildIntakeFormLinkListPath,
  buildIntakePortalPath,
  buildIntakeTemplateEditorValue,
  buildVariableMapping,
  currentProposalValue,
  buildIntakeVariableProposalListPath,
  getIntakeFormLinkState,
  loadIntakeFormsDashboardData,
  summarizeIntakeItemAction,
  upsertIntakeFormLink,
  upsertIntakeVariableProposal,
} from "./intake-forms-dashboard";
import {
  actionComplete,
  coerceAnswer,
  errorMessage,
  itemAction,
  requiredIncompleteItemIds,
  visibleSections,
  type PublicIntakeFormPayload,
} from "./intake-forms/runner-utils";
import type {
  ExternalUploadLinkRecord,
  IntakeFormLinkSummary,
  MatterSummary,
  ShareLinkRecord,
} from "./types";

const capabilityResources: Record<DashboardSectionKey, DashboardSectionCapability["resource"]> = {
  matters: "matter",
  funds: "trust_ledger",
  billing: "time_entry",
  documents: "document",
  drafting: "draft",
  calendar: "calendar_event",
  signatures: "signature_request",
  intake: "intake_session",
  audit: "audit_log",
};

function capability(
  key: DashboardSectionKey,
  overrides: Partial<DashboardSectionCapability> = {},
): DashboardSectionCapability {
  return {
    key,
    label: `${key} from API`,
    enabled: true,
    resource: capabilityResources[key],
    actions: ["read"],
    ...overrides,
  };
}

function matter(overrides: Partial<MatterSummary>): MatterSummary {
  return {
    id: "matter-001",
    firmId: "firm-west-legal",
    number: "2026-0001",
    title: "Morgan tenancy dispute",
    practiceArea: "Residential tenancy",
    status: "open",
    jurisdiction: "BC",
    responsibleUserId: "user-licensee",
    parties: [],
    documents: [],
    timeEntries: [],
    expenses: [],
    activity: [],
    trustBalanceCents: 0,
    ...overrides,
  } as MatterSummary;
}

const editorJson = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Synthetic letter opening" }],
    },
  ],
};

function draftTemplate(overrides: Partial<DraftTemplateRecord> = {}): DraftTemplateRecord {
  return {
    id: "draft-template-legal-letter",
    firmId: "firm-west-legal",
    name: "Generic Legal Letter",
    description: "Synthetic correspondence template.",
    editorJson,
    category: "correspondence",
    active: true,
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

function draftRecord(overrides: Partial<DraftRecord> = {}): DraftRecord {
  return {
    id: "draft-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: "Generic Legal Letter - 2026-0001",
    editorJson,
    version: 1,
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
    metadata: { templateId: "draft-template-legal-letter" },
    ...overrides,
  };
}

function shareLink(overrides: Partial<ShareLinkRecord> = {}): ShareLinkRecord {
  return {
    id: "share-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    grantedByUserId: "user-admin",
    permissions: ["view_documents"],
    requireEmailVerification: true,
    createdAt: "2026-04-29T12:00:00.000Z",
    ...overrides,
  };
}

function externalUploadLink(
  overrides: Partial<ExternalUploadLinkRecord> = {},
): ExternalUploadLinkRecord {
  return {
    ...baseExternalUploadLink(),
    ...overrides,
  };
}

function calendarEvent(overrides: Partial<CalendarEventRecord> = {}): CalendarEventRecord {
  return {
    id: "calendar-event-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    uid: "calendar-event-001@open-practice.local",
    title: "Synthetic filing deadline",
    startsAt: "2026-05-05T16:00:00.000Z",
    endsAt: "2026-05-05T16:30:00.000Z",
    status: "confirmed",
    sequence: 0,
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    ...overrides,
  };
}

function baseExternalUploadLink(): ExternalUploadLinkRecord {
  return {
    id: "external-upload-link-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    requestedByUserId: "user-admin",
    expiresAt: "2026-05-01T12:00:00.000Z",
    maxUploads: 2,
    usedUploads: 0,
    createdAt: "2026-04-29T12:00:00.000Z",
  };
}

function intakeFormLink(overrides: Partial<IntakeFormLinkSummary> = {}): IntakeFormLinkSummary {
  return {
    id: "intake-form-link-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    intakeSessionId: "intake-session-001",
    requestedByUserId: "user-admin",
    expiresAt: "2026-05-01T12:00:00.000Z",
    createdAt: "2026-04-29T12:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

function publicRunnerPayload(
  overrides: Partial<PublicIntakeFormPayload> = {},
): PublicIntakeFormPayload {
  return {
    link: {
      id: "intake-form-link-001",
      status: "active",
      expiresAt: "2099-06-01T00:00:00.000Z",
    },
    template: {
      id: "intake-template-001",
      name: "Residential tenancy intake",
      definitionVersion: 2,
      definition: sampleResidentialTenancyIntakeDefinition,
    },
    actions: [],
    ...overrides,
  };
}

describe("dashboard client behavior", () => {
  it("filters matters by API-backed matter fields", () => {
    const matters = [
      matter({ id: "matter-001", title: "Morgan tenancy dispute" }),
      matter({ id: "matter-002", number: "2026-0002", title: "North Star records" }),
    ];

    expect(filterMatters(matters, "north").map((result) => result.id)).toEqual(["matter-002"]);
    expect(filterMatters(matters, "2026-0001").map((result) => result.id)).toEqual(["matter-001"]);
  });

  it("builds sidebar navigation from catalog order and labels", () => {
    const navigationSections = buildSidebarNavigationSections({
      billingCanView: true,
      shareLinksEnabled: true,
      externalUploadsEnabled: true,
      capabilitySections: [
        capability("matters"),
        capability("funds"),
        capability("documents"),
        capability("drafting"),
        capability("calendar"),
        capability("billing"),
        capability("signatures"),
        capability("intake"),
        capability("audit"),
      ],
    });

    expect(navigationSections).toEqual([
      { key: "matters", label: "Matters", enabled: true },
      { key: "funds", label: "Funds", enabled: true },
      { key: "billing", label: "Billing", enabled: true },
      { key: "documents", label: "Documents", enabled: true },
      { key: "shares", label: "Shares", enabled: true },
      { key: "externalUploads", label: "Uploads", enabled: true },
      { key: "drafting", label: "Drafting", enabled: true },
      { key: "calendar", label: "Calendar", enabled: true },
      { key: "signatures", label: "Signatures", enabled: true },
      { key: "intake", label: "Intake", enabled: true },
      { key: "audit", label: "Audit", enabled: true },
      { key: "queues", label: "Queues", enabled: true },
    ]);
  });

  it("keeps billing visibility compatible with billing dashboard access", () => {
    const navigationSections = buildSidebarNavigationSections({
      billingCanView: false,
      shareLinksEnabled: false,
      externalUploadsEnabled: false,
      capabilitySections: [
        capability("matters"),
        capability("funds"),
        capability("documents"),
        capability("drafting"),
        capability("calendar", { enabled: false }),
        capability("signatures"),
        capability("intake"),
        capability("audit"),
      ],
    });

    expect(navigationSections.find((section) => section.key === "billing")).toEqual({
      key: "billing",
      label: "Billing",
      enabled: false,
    });
    expect(navigationSections.find((section) => section.key === "shares")).toEqual({
      key: "shares",
      label: "Shares",
      enabled: false,
    });
    expect(navigationSections.find((section) => section.key === "externalUploads")).toEqual({
      key: "externalUploads",
      label: "Uploads",
      enabled: false,
    });
    expect(navigationSections.find((section) => section.key === "calendar")).toEqual({
      key: "calendar",
      label: "Calendar",
      enabled: false,
    });
    expect(navigationSections.find((section) => section.key === "queues")).toEqual({
      key: "queues",
      label: "Queues",
      enabled: true,
    });
  });

  it("describes disabled dashboard navigation and summarizes queues for live regions", () => {
    expect(
      describeDisabledNavigationReason({ key: "billing", label: "Billing", enabled: false }),
    ).toBe("Billing is unavailable for your current role.");
    expect(
      describeDisabledNavigationReason({
        key: "externalUploads",
        label: "Uploads",
        enabled: false,
      }),
    ).toBe("External uploads are unavailable until the storage provider is configured.");
    expect(
      summarizeQueues({
        sections: [
          {
            key: "review",
            label: "Review",
            items: [
              {
                id: "queue-001",
                matterId: "matter-001",
                title: "Review draft",
                status: "ready",
                priority: "high",
              },
              {
                id: "queue-002",
                title: "Check intake",
                status: "waiting",
                priority: "medium",
              },
            ],
          },
        ],
      }),
    ).toBe("2 queue items need attention. 1 high priority item.");
    expect(summarizeQueues({ sections: [] })).toBe("No queue items need attention.");
  });

  it("builds share-link payloads and replaces revoked links without leaking token hashes", () => {
    const activeShare = shareLink();
    const revokedShare = shareLink({
      revokedAt: "2026-04-29T13:00:00.000Z",
    });

    expect(
      buildCreateShareLinkPayload({
        matterId: "matter-001",
        permissions: ["view_documents"],
        expiresAt: "2026-05-01",
        requireEmailVerification: false,
      }),
    ).toEqual({
      matterId: "matter-001",
      permissions: ["view_documents"],
      expiresAt: "2026-05-01T00:00:00.000Z",
      requireEmailVerification: false,
    });
    expect(formatSharePermission("view_documents")).toBe("View documents");
    expect(describeShareLinkState(activeShare)).toEqual({ label: "active", tone: "active" });
    expect(replaceShareLink([activeShare], revokedShare)).toEqual([revokedShare]);
  });

  it("loads draft templates once and existing drafts per matter for first render", async () => {
    const template = draftTemplate();
    const draftCalls: string[] = [];
    const data = await loadDraftingDashboardData({
      matters: [matter({ id: "matter-001" }), matter({ id: "matter-002" })],
      listTemplates: async () => [template],
      listDraftsForMatter: async (matterId) => {
        draftCalls.push(matterId);
        return [draftRecord({ id: `draft-${matterId}`, matterId })];
      },
    });

    expect(data.templates).toEqual([template]);
    expect(draftCalls).toEqual(["matter-001", "matter-002"]);
    expect(data.draftsByMatterId["matter-001"]).toEqual([
      expect.objectContaining({ id: "draft-matter-001", matterId: "matter-001" }),
    ]);
    expect(data.draftsByMatterId["matter-002"]).toEqual([
      expect.objectContaining({ id: "draft-matter-002", matterId: "matter-002" }),
    ]);
  });

  it("builds template draft payloads, appends returned drafts, and previews TipTap text", () => {
    const template = draftTemplate();
    const activeMatter = matter({ id: "matter-001", number: "2026-0001" });
    const createdDraft = draftRecord();

    expect(buildDraftFromTemplatePayload({ matter: activeMatter, template })).toEqual({
      matterId: "matter-001",
      title: "Generic Legal Letter - 2026-0001",
      templateId: "draft-template-legal-letter",
    });
    expect(appendDraftToMatterDrafts({ "matter-001": [] }, createdDraft)).toEqual({
      "matter-001": [createdDraft],
    });
    expect(extractDraftPlainText(template.editorJson)).toBe("Synthetic letter opening");
  });

  it("builds explicit draft editor payloads without changing matter scope", () => {
    const activeMatter = matter({ id: "matter-001", number: "2026-0001" });
    const blankPayload = buildBlankDraftPayload({ matter: activeMatter });
    const updatedEditorJson = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Revised synthetic draft" }],
        },
      ],
    };

    expect(blankPayload).toEqual({
      matterId: "matter-001",
      title: "Blank Draft - 2026-0001",
      editorJson: { type: "doc", content: [{ type: "paragraph" }] },
    });
    expect(buildDraftUpdatePayload({ editorJson: updatedEditorJson })).toEqual({
      editorJson: updatedEditorJson,
    });
    expect(isSameDraftDocument(blankPayload.editorJson, updatedEditorJson)).toBe(false);
    expect(isSameDraftDocument(updatedEditorJson, updatedEditorJson)).toBe(true);
    expect(formatDraftApiFailure("creation", 400, { message: "Invalid request body" })).toBe(
      "Draft creation failed: 400: Invalid request body",
    );
    expect(formatDraftApiFailure("save", 500)).toBe("Draft save failed: 500");
  });

  it("describes draft assist status and inserts suggestions into local editor JSON", () => {
    const editorJson = {
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text: "Original draft" }] }],
    };
    const updated = insertDraftAssistSuggestion({
      editorJson,
      record: { suggestedText: "Suggested assist text" },
    });

    expect(describeDraftAssistStatus({ status: "disabled", reason: "not_configured" })).toBe(
      "Draft assist unavailable: not configured.",
    );
    expect(extractDraftPlainText(updated)).toBe("Original draft Suggested assist text");
    expect(extractDraftPlainText(editorJson)).toBe("Original draft");
  });

  it("builds external upload paths, create payloads, and local link state", () => {
    const expiresAtLocal = "2026-05-01T09:30";
    const upload = externalUploadLink();
    const updatedUpload = externalUploadLink({ usedUploads: 2 });

    expect(buildExternalUploadListPath("matter 001")).toBe(
      "/api/external-uploads?matterId=matter%20001",
    );
    expect(buildExternalUploadRevokePath("external/upload/001")).toBe(
      "/api/external-uploads/external%2Fupload%2F001/revoke",
    );
    expect(
      buildExternalUploadCreatePayload({
        matterId: "matter-001",
        maxUploads: "3",
        expiresAtLocal,
      }),
    ).toEqual({
      matterId: "matter-001",
      maxUploads: 3,
      expiresAt: new Date(expiresAtLocal).toISOString(),
    });
    expect(
      buildExternalUploadCreatePayload({
        matterId: "matter-001",
        maxUploads: "0",
        expiresAtLocal: "",
      }),
    ).toEqual({ matterId: "matter-001", maxUploads: 1 });
    expect(canCreateExternalUpload({ status: "available", provider: "s3" })).toBe(true);
    expect(canCreateExternalUpload({ status: "not_configured", provider: "s3" })).toBe(false);
    expect(upsertExternalUploadLink({}, upload)).toEqual({ "matter-001": [upload] });
    expect(upsertExternalUploadLink({ "matter-001": [upload] }, updatedUpload)).toEqual({
      "matter-001": [updatedUpload],
    });
    expect(getExternalUploadLinkState(upload, new Date("2026-04-30T12:00:00.000Z"))).toBe("active");
    expect(getExternalUploadLinkState(updatedUpload, new Date("2026-04-30T12:00:00.000Z"))).toBe(
      "used",
    );
    expect(
      getExternalUploadLinkState(
        externalUploadLink({ revokedAt: "2026-04-29T13:00:00.000Z" }),
        new Date("2026-04-30T12:00:00.000Z"),
      ),
    ).toBe("revoked");
  });

  it("loads external upload status and matter-scoped links for first render", async () => {
    const upload = externalUploadLink({ matterId: "matter-002" });
    const data = await loadExternalUploadsDashboardData({
      matters: [matter({ id: "matter-001" }), matter({ id: "matter-002" })],
      getStatus: async () => ({
        status: "available",
        provider: "s3",
      }),
      listUploadsForMatter: async (matterId) => (matterId === "matter-002" ? [upload] : []),
    });

    expect(data.status).toEqual({ status: "available", provider: "s3" });
    expect(data.uploadsByMatterId).toEqual({
      "matter-001": [],
      "matter-002": [upload],
    });
  });

  it("buckets calendar radar events without changing source records", () => {
    const now = new Date("2026-05-01T12:00:00.000Z");
    const overdue = calendarEvent({
      id: "calendar-event-overdue",
      startsAt: "2026-04-30T12:00:00.000Z",
    });
    const soon = calendarEvent({ id: "calendar-event-soon", startsAt: "2026-05-03T12:00:00.000Z" });
    const near = calendarEvent({ id: "calendar-event-near", startsAt: "2026-05-20T12:00:00.000Z" });
    const tentative = calendarEvent({
      id: "calendar-event-tentative",
      startsAt: "2026-05-02T12:00:00.000Z",
      status: "tentative",
    });
    const cancelled = calendarEvent({
      id: "calendar-event-cancelled",
      startsAt: "2026-05-02T12:00:00.000Z",
      status: "cancelled",
    });

    const buckets = buildCalendarRadarBuckets([near, cancelled, soon, tentative, overdue], now);

    expect(buckets.overdue.map((event) => event.id)).toEqual(["calendar-event-overdue"]);
    expect(buckets.nextSevenDays.map((event) => event.id)).toEqual([
      "calendar-event-tentative",
      "calendar-event-soon",
    ]);
    expect(buckets.nextThirtyDays.map((event) => event.id)).toEqual(["calendar-event-near"]);
    expect(buckets.tentative.map((event) => event.id)).toEqual(["calendar-event-tentative"]);
    expect(buckets.cancelled.map((event) => event.id)).toEqual(["calendar-event-cancelled"]);
    expect(describeCalendarEventTiming(near, now)).toBe("next 30 days");
  });

  it("loads calendar dashboard events, links, and credentials for first render", async () => {
    const event = calendarEvent({ matterId: "matter-002" });
    const data = await loadCalendarDashboardData({
      matters: [matter({ id: "matter-001" }), matter({ id: "matter-002" })],
      listEventsForMatter: async (matterId) => ({
        events: matterId === "matter-002" ? [event] : [],
        caldavUrl: "http://practice.example.test/caldav",
        subscriptionUrl: `webcal://practice.example.test/api/calendar/matters/${matterId}.ics`,
      }),
      listCredentials: async () => [
        {
          id: "calendar-credential-001",
          username: "firm.user.calendar-credential-001",
          label: "iOS Calendar",
          createdAt: "2026-05-01T12:00:00.000Z",
        },
      ],
    });

    expect(data.eventsByMatterId).toEqual({ "matter-001": [], "matter-002": [event] });
    expect(data.linksByMatterId["matter-001"]).toEqual({
      caldavUrl: "http://practice.example.test/caldav",
      subscriptionUrl: "webcal://practice.example.test/api/calendar/matters/matter-001.ics",
    });
    expect(
      upsertCalendarCredential(data.credentials, {
        ...data.credentials[0]!,
        revokedAt: "2026-05-01T13:00:00.000Z",
      }),
    ).toEqual([
      expect.objectContaining({ id: "calendar-credential-001", revokedAt: expect.any(String) }),
    ]);
  });

  it("updates calendar attendee state without mutating unrelated matter events", () => {
    const event = calendarEvent({
      id: "calendar-event-meeting",
      matterId: "matter-001",
      attendees: [],
    });
    const updated = upsertCalendarEventAttendee(
      { "matter-001": [event], "matter-002": [calendarEvent({ matterId: "matter-002" })] },
      "matter-001",
      event.id,
      {
        id: "calendar-attendee-test",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: event.id,
        name: "Synthetic Reviewer",
        email: "reviewer@example.test",
        role: "optional",
        responseStatus: "needs_action",
        invitationStatus: "queued",
        createdAt: "2026-05-01T12:00:00.000Z",
        updatedAt: "2026-05-01T12:00:00.000Z",
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      },
    );

    expect(updated["matter-001"]![0]!.attendees).toMatchObject([
      {
        id: "calendar-attendee-test",
        invitationStatus: "queued",
      },
    ]);
    expect(
      removeCalendarEventAttendee(updated, "matter-001", event.id, "calendar-attendee-test")[
        "matter-001"
      ]![0]!.attendees,
    ).toEqual([]);
    expect(updated["matter-002"]).toHaveLength(1);
  });

  it("builds intake form link paths, create payloads, and review state", async () => {
    const expiresAtLocal = "2026-05-01T09:30";
    const link = intakeFormLink();
    const submittedLink = intakeFormLink({
      submittedAt: "2026-04-30T12:00:00.000Z",
      status: "submitted",
    });
    const proposal = {
      id: "proposal-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      intakeSessionId: "intake-session-001",
      answerSnapshotId: "snapshot-001",
      sourceQuestionId: "matter_title",
      targetScope: "matter" as const,
      targetField: "title" as const,
      targetRecordId: "matter-001",
      proposedValue: "Synthetic title",
      status: "pending" as const,
      createdAt: "2026-04-29T12:00:00.000Z",
    };

    expect(buildIntakeFormLinkListPath("matter 001")).toBe(
      "/api/intake-form-links?matterId=matter%20001",
    );
    expect(buildIntakePortalPath("client token")).toBe("/intake-forms/client%20token");
    expect(buildIntakeVariableProposalListPath("matter 001")).toBe(
      "/api/intake-variable-proposals?matterId=matter%20001",
    );
    expect(
      buildIntakeFormLinkCreatePayload({
        intakeSessionId: "intake-session-001",
        expiresAtLocal,
      }),
    ).toEqual({
      intakeSessionId: "intake-session-001",
      expiresAt: new Date(expiresAtLocal).toISOString(),
    });
    expect(
      buildIntakeFormLinkCreatePayload({
        intakeSessionId: "intake-session-001",
        expiresAtLocal: "",
      }),
    ).toEqual({ intakeSessionId: "intake-session-001" });
    expect(upsertIntakeFormLink({}, link)).toEqual({ "matter-001": [link] });
    expect(upsertIntakeFormLink({ "matter-001": [link] }, submittedLink)).toEqual({
      "matter-001": [submittedLink],
    });
    expect(upsertIntakeVariableProposal({}, proposal)).toEqual({ "matter-001": [proposal] });
    expect(getIntakeFormLinkState(link, new Date("2026-04-30T12:00:00.000Z"))).toBe("active");
    expect(getIntakeFormLinkState(submittedLink, new Date("2026-04-30T12:00:00.000Z"))).toBe(
      "submitted",
    );
    expect(buildIntakeTemplateEditorValue()).toContain('"schemaVersion": 2');
    expect(buildVariableMapping("client", "displayName")).toEqual({
      targetScope: "client",
      targetField: "displayName",
    });
    expect(buildVariableMapping("matter", "unsupported")).toBeUndefined();
    expect(
      summarizeIntakeItemAction({
        id: "action-001",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-session-001",
        formLinkId: "intake-form-link-001",
        itemId: "evidence-upload",
        kind: "upload",
        status: "intent_created",
        evidence: {},
        createdAt: "2026-04-29T12:00:00.000Z",
      }),
    ).toBe("upload: intent created");
    expect(
      currentProposalValue(
        proposal,
        matter({
          id: "matter-001",
          title: "Current title",
          parties: [
            {
              id: "party-001",
              firmId: "firm-west-legal",
              matterId: "matter-001",
              contactId: "contact-ada",
              role: "client",
              adverse: false,
              confidential: true,
              contact: {
                id: "contact-ada",
                firmId: "firm-west-legal",
                kind: "person",
                displayName: "Ada Morgan",
                aliases: [],
                identifiers: [],
              },
            },
          ],
        }),
      ),
    ).toBe("Current title");

    const data = await loadIntakeFormsDashboardData({
      matters: [matter({ id: "matter-001" }), matter({ id: "matter-002" })],
      listLinksForMatter: async (matterId) =>
        matterId === "matter-001"
          ? {
              links: [link],
              actionsByLinkId: {
                [link.id]: [
                  {
                    id: "action-001",
                    firmId: "firm-west-legal",
                    matterId: "matter-001",
                    intakeSessionId: "intake-session-001",
                    formLinkId: link.id,
                    itemId: "evidence-upload",
                    kind: "upload",
                    status: "uploaded",
                    evidence: {},
                    createdAt: "2026-04-29T12:00:00.000Z",
                  },
                ],
              },
            }
          : { links: [], actionsByLinkId: {} },
      listProposalsForMatter: async (matterId) => (matterId === "matter-001" ? [proposal] : []),
    });

    expect(data.linksByMatterId).toEqual({ "matter-001": [link], "matter-002": [] });
    expect(data.actionsByLinkId[link.id]).toEqual([
      expect.objectContaining({ itemId: "evidence-upload", status: "uploaded" }),
    ]);
    expect(data.proposalsByMatterId).toEqual({ "matter-001": [proposal], "matter-002": [] });
  });

  it("derives public runner visibility, action state, and API error messages", () => {
    const payload = publicRunnerPayload({
      actions: [
        {
          id: "action-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          intakeSessionId: "intake-session-001",
          formLinkId: "intake-form-link-001",
          itemId: "evidence-upload",
          kind: "upload",
          status: "uploaded",
          evidence: { contentType: "application/pdf" },
          createdAt: "2026-04-29T12:00:00.000Z",
        },
      ],
    });
    const visibleItemIds = visibleSections(payload, { issue_type: "deposit", urgent: false })
      .flatMap((section) => section.items)
      .map((item) => item.id);

    expect(visibleItemIds).toContain("evidence-upload");
    expect(visibleItemIds).not.toContain("repair-details-item");
    expect(actionComplete(payload.actions[0])).toBe(true);
    expect(
      itemAction(payload.actions, { id: "evidence-upload", kind: "upload", label: "Evidence" }),
    )?.toMatchObject({ status: "uploaded" });
    expect(coerceAnswer({ id: "urgent", label: "Urgent", type: "boolean" }, false)).toBe(false);
    expect(
      requiredIncompleteItemIds({
        code: "INTAKE_FORM_INCOMPLETE",
        details: { requiredIncompleteItemIds: ["client-attestation"] },
      }),
    ).toEqual(["client-attestation"]);
    expect(errorMessage({ message: "Upload type is not accepted" }, "fallback")).toBe(
      "Upload type is not accepted",
    );
  });
});
